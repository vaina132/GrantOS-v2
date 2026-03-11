import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import {
  computePermissions,
  computeGuestPermissions,
  rolePermissionToPermissions,
  DEFAULT_PERMISSIONS,
  type Permissions,
  type PermissionKey,
} from '@/lib/permissions'
import type { OrgRole, OrgPlan, AccessType, GuestProject } from '@/types'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  orgId: string | null
  orgName: string | null
  role: OrgRole | null
  permissions: Permissions
  accessType: AccessType | null
  guestProjects: GuestProject[]
  orgPlan: OrgPlan | null
  trialEndsAt: string | null
  isLoading: boolean
  error: string | null

  initialize: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, meta?: { firstName?: string; lastName?: string }) => Promise<void>
  signInWithProvider: (provider: 'google' | 'azure' | 'slack') => Promise<void>
  signOut: () => Promise<void>
  can: (permission: PermissionKey) => boolean
}

let initialized = false

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  orgId: null,
  orgName: null,
  role: null,
  permissions: DEFAULT_PERMISSIONS,
  accessType: null,
  guestProjects: [],
  orgPlan: null,
  trialEndsAt: null,
  isLoading: true,
  error: null,

  initialize: async () => {
    if (initialized) return
    initialized = true

    try {
      // If we're on the /auth/callback route with a code param, skip initialize
      // and let the AuthCallbackPage handle the code exchange (PKCE codes are single-use)
      const isAuthCallback = window.location.pathname === '/auth/callback'
      const hasCode = new URLSearchParams(window.location.search).has('code')
      const hasHash = window.location.hash.includes('access_token')

      if (isAuthCallback && (hasCode || hasHash)) {
        set({ isLoading: false, user: null })
        return
      }

      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        set({ isLoading: false, user: null })
      } else {
        await loadUserContext(session.user, set)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize auth'
      set({ isLoading: false, error: message })
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Only reload context if user changed (avoid duplicate on init)
        const current = get().user
        if (current?.id !== session.user.id) {
          await loadUserContext(session.user, set)
        } else if (!get().orgId && !get().error) {
          // Re-attempt if we haven't loaded context yet
          await loadUserContext(session.user, set)
        }
      } else if (event === 'SIGNED_OUT') {
        set({
          user: null,
          orgId: null,
          orgName: null,
          role: null,
          permissions: DEFAULT_PERMISSIONS,
          accessType: null,
          guestProjects: [],
          orgPlan: null,
          trialEndsAt: null,
          isLoading: false,
          error: null,
        })
      }
    })
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (data.user) {
        await loadUserContext(data.user, set)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed'
      set({ isLoading: false, error: message })
      throw err
    }
  },

  signUp: async (email, password, meta) => {
    set({ isLoading: true, error: null })
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: meta?.firstName ?? '',
            last_name: meta?.lastName ?? '',
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      set({ isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed'
      set({ isLoading: false, error: message })
      throw err
    }
  },

  signInWithProvider: async (provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
  },

  signOut: async () => {
    initialized = false
    await supabase.auth.signOut()
    set({
      user: null,
      orgId: null,
      orgName: null,
      role: null,
      permissions: DEFAULT_PERMISSIONS,
      accessType: null,
      guestProjects: [],
      orgPlan: null,
      trialEndsAt: null,
      isLoading: false,
      error: null,
    })
  },

  can: (permission: PermissionKey) => {
    return get().permissions[permission]
  },
}))

async function loadUserContext(
  user: User,
  set: (state: Partial<AuthState>) => void,
) {
  // Try org_members first
  const { data: member, error: memberError } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  // Any error (table missing, RLS, etc.) — bootstrap as admin in early dev
  if (memberError) {
    console.warn('[GrantLume] org_members query failed, bootstrapping as admin:', memberError.code, memberError.message)
    set({
      user,
      orgId: null,
      orgName: 'Development',
      role: 'Admin',
      permissions: computePermissions('Admin'),
      accessType: 'member',
      guestProjects: [],
      orgPlan: 'enterprise',
      trialEndsAt: null,
      isLoading: false,
      error: null,
    })
    return
  }

  if (member) {
    const role = member.role as OrgRole

    // Fetch org details
    const { data: org } = await supabase
      .from('organisations')
      .select('name, plan, trial_ends_at, is_active')
      .eq('id', member.org_id)
      .single()

    if (org && !org.is_active) {
      set({ isLoading: false, error: 'Account suspended. Contact support.' })
      return
    }

    if (org && org.trial_ends_at && new Date(org.trial_ends_at) < new Date()) {
      set({ isLoading: false, error: 'Trial expired. Please upgrade.' })
      return
    }

    // Try loading configurable permissions from role_permissions table
    let permissions: Permissions = computePermissions(role)
    try {
      const { data: rp } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('org_id', member.org_id)
        .eq('role', role)
        .maybeSingle()
      if (rp) {
        permissions = rolePermissionToPermissions(rp as import('@/types').RolePermission)
      }
    } catch {
      // Fallback to hardcoded if table doesn't exist yet
    }

    // Admin always gets full permissions regardless of DB config
    if (role === 'Admin') {
      permissions = computePermissions('Admin')
    }

    set({
      user,
      orgId: member.org_id,
      orgName: org?.name ?? null,
      role,
      permissions,
      accessType: 'member',
      guestProjects: [],
      orgPlan: (org?.plan as OrgPlan) ?? null,
      trialEndsAt: org?.trial_ends_at ?? null,
      isLoading: false,
      error: null,
    })
    return
  }

  // Try project_guests — use SECURITY DEFINER function to claim pending
  // invitations by email and return all active guest entries in one step.
  const { data: guests, error: guestError } = await supabase
    .rpc('claim_guest_invitations', { p_user_id: user.id, p_email: user.email ?? '' })

  // Any error — bootstrap as admin in early dev
  if (guestError) {
    console.warn('[GrantLume] claim_guest_invitations failed, bootstrapping as admin:', guestError.code, guestError.message)
    set({
      user,
      orgId: null,
      orgName: 'Development',
      role: 'Admin',
      permissions: computePermissions('Admin'),
      accessType: 'member',
      guestProjects: [],
      orgPlan: 'enterprise',
      trialEndsAt: null,
      isLoading: false,
      error: null,
    })
    return
  }

  const guestRows = (guests ?? []) as { id: string; org_id: string; project_id: string; access_level: string; status: string }[]

  if (guestRows.length > 0) {
    const first = guestRows[0]
    const accessLevel = first.access_level as 'contributor' | 'read_only'

    set({
      user,
      orgId: first.org_id,
      orgName: null,
      role: null,
      permissions: computeGuestPermissions(accessLevel),
      accessType: 'guest',
      guestProjects: guestRows.map((g) => ({
        project_id: g.project_id,
        access_level: g.access_level as 'contributor' | 'read_only',
      })),
      orgPlan: null,
      trialEndsAt: null,
      isLoading: false,
      error: null,
    })
    return
  }

  // No membership found — user needs to create an org (onboarding wizard)
  set({
    user,
    orgId: null,
    orgName: null,
    role: null,
    permissions: DEFAULT_PERMISSIONS,
    accessType: null,
    guestProjects: [],
    orgPlan: null,
    trialEndsAt: null,
    isLoading: false,
    error: null,
  })
}
