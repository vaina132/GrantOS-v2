import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import {
  computePermissions,
  rolePermissionToPermissions,
  DEFAULT_PERMISSIONS,
  type Permissions,
  type PermissionKey,
} from '@/lib/permissions'
import type { OrgRole, OrgPlan, AccessType } from '@/types'
import type { User } from '@supabase/supabase-js'
import { writeSecurityAudit } from '@/services/auditWriter'

interface AuthState {
  user: User | null
  orgId: string | null
  orgName: string | null
  role: OrgRole | null
  permissions: Permissions
  accessType: AccessType | null
  orgPlan: OrgPlan | null
  trialEndsAt: string | null
  isLoading: boolean
  error: string | null

  // MFA state
  mfaFactorId: string | null
  mfaChallengeId: string | null

  initialize: () => Promise<void>
  reloadContext: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  verifyMfa: (code: string) => Promise<void>
  cancelMfa: () => void
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
  orgPlan: null,
  trialEndsAt: null,
  isLoading: true,
  error: null,
  mfaFactorId: null,
  mfaChallengeId: null,

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
        // Skip loading context if an MFA challenge is in progress —
        // we have an AAL1 session but the user must complete MFA first
        if (get().mfaChallengeId) return

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
          orgPlan: null,
          trialEndsAt: null,
          isLoading: false,
          error: null,
        })
      }
    })
  },

  reloadContext: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await loadUserContext(user, set)
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null, mfaFactorId: null, mfaChallengeId: null })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      // Check if MFA verification is required
      // When user has TOTP enrolled, Supabase returns an MFA challenge instead of a session
      if (data.session === null && data.user === null) {
        // This shouldn't happen, but guard against it
        throw new Error('Sign in failed — no session or user returned')
      }

      // If user has MFA enrolled, we need to check the AAL level
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aalData && aalData.currentLevel === 'aal1' && aalData.nextLevel === 'aal2') {
        // User needs to verify MFA — find their TOTP factor
        const { data: factorsData } = await supabase.auth.mfa.listFactors()
        const totp = factorsData?.totp?.[0]
        if (totp) {
          // Create MFA challenge
          const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: totp.id })
          if (challengeErr) throw challengeErr
          // IMPORTANT: Do NOT set user here — keep user null so LoginPage stays
          // mounted (App.tsx redirects away if user is set). The AAL1 session
          // is stored by the Supabase client internally and will be used for
          // the mfa.verify() call.
          set({
            isLoading: false,
            user: null,
            mfaFactorId: totp.id,
            mfaChallengeId: challengeData.id,
          })
          return // Don't navigate — LoginPage will show MFA verification
        }
      }

      if (data.user) {
        await loadUserContext(data.user, set)
        writeSecurityAudit({ action: 'login', details: 'Password login (no MFA)' })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed'
      set({ isLoading: false, error: message, mfaFactorId: null, mfaChallengeId: null })
      writeSecurityAudit({ action: 'login_failed', details: message, targetEmail: email })
      throw err
    }
  },

  verifyMfa: async (code: string) => {
    const { mfaFactorId, mfaChallengeId } = get()
    if (!mfaFactorId || !mfaChallengeId) {
      throw new Error('No MFA challenge in progress')
    }

    set({ isLoading: true, error: null })
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: mfaChallengeId,
        code,
      })
      if (error) throw error

      set({ mfaFactorId: null, mfaChallengeId: null })

      // After MFA verification, load user context
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await loadUserContext(user, set)
        writeSecurityAudit({ action: 'mfa_verify', details: 'MFA verification successful' })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'MFA verification failed'
      set({ isLoading: false, error: message })
      throw err
    }
  },

  cancelMfa: () => {
    supabase.auth.signOut().catch(() => {})
    set({
      mfaFactorId: null,
      mfaChallengeId: null,
      isLoading: false,
      error: null,
      user: null,
    })
  },

  signUp: async (email, password, meta) => {
    // Do NOT set isLoading here — SignUpPage manages its own loading state.
    // Setting isLoading: true would cause App.tsx to show LoadingScreen,
    // which unmounts SignUpPage and resets the success state.
    try {
      const { data, error } = await supabase.auth.signUp({
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
      console.log('[SignUp] Response:', { error, user: data?.user?.id, identities: data?.user?.identities?.length })
      if (error) throw error

      // Supabase returns a user with empty identities when the email already exists
      // (to prevent email enumeration). Detect this and show a helpful message.
      if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
        throw new Error('An account with this email already exists. Please sign in instead.')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed'
      set({ error: message })
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
    writeSecurityAudit({ action: 'logout' })
    initialized = false
    await supabase.auth.signOut()
    set({
      user: null,
      orgId: null,
      orgName: null,
      role: null,
      permissions: DEFAULT_PERMISSIONS,
      accessType: null,
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

  // Log query errors but do NOT bootstrap as admin — fall through to collab check
  if (memberError) {
    console.warn('[GrantLume] org_members query error:', memberError.code, memberError.message)
  }

  if (member) {
    const role = member.role as OrgRole

    // Auto-link person record to this auth user by email (fire-and-forget)
    if (user.email) {
      try {
        supabase.from('persons').update({
          user_id: user.id,
          invite_status: 'accepted',
        } as any).eq('email', user.email.toLowerCase()).then(() => {})
      } catch { /* non-critical */ }
    }

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
      orgPlan: (org?.plan as OrgPlan) ?? null,
      trialEndsAt: org?.trial_ends_at ?? null,
      isLoading: false,
      error: null,
    })
    return
  }

  // No org membership — check if user is a collab partner
  const { data: collabPartner } = await supabase
    .from('collab_partners')
    .select('id')
    .eq('user_id', user.id)
    .eq('invite_status', 'accepted')
    .limit(1)
    .maybeSingle()

  if (collabPartner) {
    // Collab-only user — skip onboarding, give limited access
    set({
      user,
      orgId: null,
      orgName: null,
      role: 'External Participant',
      permissions: computePermissions('External Participant'),
      accessType: 'collab_partner',
      orgPlan: null,
      trialEndsAt: null,
      isLoading: false,
      error: null,
    })
    return
  }

  // Not yet accepted — but check user_metadata for invite_context.
  // This handles the race condition where AuthCallbackPage hasn't finished
  // calling collab-accept yet, but we know this user is a collab invitee.
  const inviteCtx = user.user_metadata?.invite_context as
    | { type?: string } | undefined
  if (inviteCtx?.type === 'collab') {
    console.log('[GrantLume] Collab invite_context found in metadata — treating as collab partner (pending accept)')
    set({
      user,
      orgId: null,
      orgName: null,
      role: 'External Participant',
      permissions: computePermissions('External Participant'),
      accessType: 'collab_partner',
      orgPlan: null,
      trialEndsAt: null,
      isLoading: false,
      error: null,
    })
    return
  }

  // No membership and not a collab partner — user needs to create an org (onboarding wizard)
  set({
    user,
    orgId: null,
    orgName: null,
    role: null,
    permissions: DEFAULT_PERMISSIONS,
    accessType: null,
    orgPlan: null,
    trialEndsAt: null,
    isLoading: false,
    error: null,
  })
}
