import { supabase } from '@/lib/supabase'
import type { UserPreferences } from '@/types'

/** Maps email template names to the preference column that controls them */
export const EMAIL_PREF_MAP: Record<string, keyof UserPreferences> = {
  timesheetReminder: 'email_timesheet_reminders',
  timesheetSubmitted: 'email_timesheet_submitted',
  projectEndingSoon: 'email_project_alerts',
  budgetAlert: 'email_budget_alerts',
  periodLocked: 'email_period_locked',
  roleChanged: 'email_role_changes',
  invitation: 'email_invitations',
  welcome: 'email_welcome',
  trialExpiring: 'email_trial_expiring',
  // guestInvitation — always sent, no opt-out (it's an access grant)
}

export const EMAIL_PREF_LABELS: { key: keyof UserPreferences; label: string; description: string }[] = [
  { key: 'email_timesheet_reminders', label: 'Timesheet Reminders', description: 'Weekly reminders to submit your timesheet' },
  { key: 'email_timesheet_submitted', label: 'Timesheet Submissions', description: 'Notifications when a team member submits a timesheet for review' },
  { key: 'email_project_alerts', label: 'Project Alerts', description: 'Alerts when projects are ending soon' },
  { key: 'email_budget_alerts', label: 'Budget Alerts', description: 'Alerts when a budget category exceeds 80% usage' },
  { key: 'email_period_locked', label: 'Period Locked', description: 'Notifications when a timesheet period is locked' },
  { key: 'email_role_changes', label: 'Role Changes', description: 'Notifications when your role is updated' },
  { key: 'email_invitations', label: 'Invitations', description: 'Organisation invitation emails' },
  { key: 'email_welcome', label: 'Welcome Email', description: 'Welcome message after signing up' },
  { key: 'email_trial_expiring', label: 'Trial Expiring', description: 'Reminders when your trial is about to end' },
]

/** Build an in-memory default preferences object (all notifications ON) */
function makeDefaults(userId: string, orgId: string): UserPreferences {
  return {
    id: '',
    user_id: userId,
    org_id: orgId,
    display_name: null,
    email_timesheet_reminders: true,
    email_timesheet_submitted: true,
    email_project_alerts: true,
    email_budget_alerts: true,
    email_period_locked: true,
    email_role_changes: true,
    email_invitations: true,
    email_welcome: true,
    email_trial_expiring: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export const preferencesService = {
  /** Get preferences for the current user in their current org. Creates defaults if none exist. */
  async get(userId: string, orgId: string): Promise<UserPreferences> {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .eq('org_id', orgId)
        .single()

      if (error && error.code === 'PGRST116') {
        // No row found — create defaults
        const { data: created, error: createErr } = await supabase
          .from('user_preferences')
          .insert({ user_id: userId, org_id: orgId })
          .select()
          .single()

        if (createErr) {
          console.warn('[GrantOS] Could not create user_preferences row:', createErr.message)
          return makeDefaults(userId, orgId)
        }
        return created as UserPreferences
      }

      if (error) {
        console.warn('[GrantOS] Could not read user_preferences:', error.message)
        return makeDefaults(userId, orgId)
      }
      return data as UserPreferences
    } catch (err) {
      // Table may not exist yet — return safe defaults
      console.warn('[GrantOS] user_preferences table may not exist yet:', err)
      return makeDefaults(userId, orgId)
    }
  },

  /** Update user preferences. Returns the updated prefs or the input merged with updates on failure. */
  async update(id: string, updates: Partial<UserPreferences>): Promise<UserPreferences | null> {
    if (!id) {
      // No persisted row yet (table may not exist) — silently skip
      console.warn('[GrantOS] Cannot update preferences: no id (table may not exist)')
      return null
    }

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.warn('[GrantOS] Could not update user_preferences:', error.message)
        return null
      }
      return data as UserPreferences
    } catch (err) {
      console.warn('[GrantOS] user_preferences update failed:', err)
      return null
    }
  },

  /** Check if a user has opted into a specific email template */
  async isEmailEnabled(userId: string, orgId: string, templateName: string): Promise<boolean> {
    const prefKey = EMAIL_PREF_MAP[templateName]
    if (!prefKey) return true // Unknown templates are always sent

    try {
      const prefs = await preferencesService.get(userId, orgId)
      return prefs[prefKey] as boolean
    } catch {
      return true // Default to enabled if we can't read preferences
    }
  },
}
