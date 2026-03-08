import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import {
  computePermissions,
  computeGuestPermissions,
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
    console.warn('[GrantOS] org_members query failed, bootstrapping as admin:', memberError.code, memberError.message)
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

    set({
      user,
      orgId: member.org_id,
      orgName: org?.name ?? null,
      role,
      permissions: computePermissions(role),
      accessType: 'member',
      guestProjects: [],
      orgPlan: (org?.plan as OrgPlan) ?? null,
      trialEndsAt: org?.trial_ends_at ?? null,
      isLoading: false,
      error: null,
    })
    return
  }

  // Try project_guests
  const { data: guests, error: guestError } = await supabase
    .from('project_guests')
    .select('org_id, project_id, access_level')
    .eq('user_id', user.id)
    .eq('is_active', true)

  // Any error — bootstrap as admin in early dev
  if (guestError) {
    console.warn('[GrantOS] project_guests query failed, bootstrapping as admin:', guestError.code, guestError.message)
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

  if (guests && guests.length > 0) {
    const first = guests[0]
    const accessLevel = first.access_level as 'contributor' | 'read_only'

    set({
      user,
      orgId: first.org_id,
      orgName: null,
      role: null,
      permissions: computeGuestPermissions(accessLevel),
      accessType: 'guest',
      guestProjects: guests.map((g) => ({
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

  // No membership found — in development, bootstrap as admin
  // In production, this would show an error
  console.warn('[GrantOS] No org membership or guest access found — bootstrapping as admin for development.')
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
}
