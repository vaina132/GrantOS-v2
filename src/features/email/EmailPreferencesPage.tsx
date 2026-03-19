import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Mail, Bell, BellOff, Check, AlertTriangle, Loader2, Shield } from 'lucide-react'

/**
 * Public page for managing email notification preferences.
 * Accessible via /email-preferences?token=<uuid> — no login required.
 * The token is the unsubscribe_token from user_preferences.
 */

const API_BASE = import.meta.env.VITE_API_URL || ''

interface Preferences {
  email: string | null
  orgName: string | null
  email_timesheet_reminders: boolean
  email_timesheet_submitted: boolean
  email_project_alerts: boolean
  email_budget_alerts: boolean
  email_period_locked: boolean
  email_role_changes: boolean
  email_invitations: boolean
  email_welcome: boolean
  email_trial_expiring: boolean
  email_substitute_notifications: boolean
  email_absence_notifications: boolean
  email_collab_notifications: boolean
}

const PREF_GROUPS: { title: string; items: { key: keyof Omit<Preferences, 'email' | 'orgName'>; label: string; description: string }[] }[] = [
  {
    title: 'Timesheets',
    items: [
      { key: 'email_timesheet_reminders', label: 'Timesheet Reminders', description: 'Weekly reminders to submit your timesheet' },
      { key: 'email_timesheet_submitted', label: 'Timesheet Updates', description: 'Notifications about timesheet submissions, approvals, and rejections' },
      { key: 'email_period_locked', label: 'Period Locked', description: 'Notifications when a timesheet period is locked' },
    ],
  },
  {
    title: 'Projects & Budget',
    items: [
      { key: 'email_project_alerts', label: 'Project Alerts', description: 'Alerts for project status, creation, and allocation changes' },
      { key: 'email_budget_alerts', label: 'Budget Alerts', description: 'Warnings when a budget exceeds thresholds' },
    ],
  },
  {
    title: 'Absences',
    items: [
      { key: 'email_absence_notifications', label: 'Absence Updates', description: 'Notifications for absence requests, approvals, and rejections' },
      { key: 'email_substitute_notifications', label: 'Substitute Notifications', description: 'Alerts when you are nominated as a substitute' },
    ],
  },
  {
    title: 'Organisation',
    items: [
      { key: 'email_role_changes', label: 'Role Changes', description: 'Notifications when your role is updated' },
      { key: 'email_invitations', label: 'Invitations', description: 'Organisation invitation emails' },
      { key: 'email_welcome', label: 'Welcome Emails', description: 'Welcome messages after signing up' },
      { key: 'email_trial_expiring', label: 'Trial Reminders', description: 'Reminders when your trial is about to end' },
    ],
  },
  {
    title: 'Collaboration',
    items: [
      { key: 'email_collab_notifications', label: 'Collaboration Emails', description: 'Partner invitations, report reminders, and status updates' },
    ],
  },
]

export function EmailPreferencesPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set())
  const [unsubscribedAll, setUnsubscribedAll] = useState(false)

  const fetchPrefs = useCallback(async () => {
    if (!token) {
      setError('No token provided. Please use the link from your email.')
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`${API_BASE}/api/email-preferences?token=${encodeURIComponent(token)}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to load preferences' }))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setPrefs(data as Preferences)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchPrefs() }, [fetchPrefs])

  const togglePref = async (key: string, value: boolean) => {
    if (!prefs) return
    setSaving(key)
    // Optimistic update
    setPrefs({ ...prefs, [key]: value })

    try {
      const res = await fetch(`${API_BASE}/api/email-preferences?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSavedKeys(prev => new Set(prev).add(key))
      setTimeout(() => setSavedKeys(prev => { const next = new Set(prev); next.delete(key); return next }), 2000)
    } catch {
      // Revert
      setPrefs({ ...prefs, [key]: !value })
    } finally {
      setSaving(null)
    }
  }

  const handleUnsubscribeAll = async () => {
    if (!prefs) return
    if (!window.confirm('Are you sure you want to unsubscribe from all email notifications? You can re-enable them anytime.')) return

    setSaving('all')
    try {
      const res = await fetch(`${API_BASE}/api/email-preferences?token=${encodeURIComponent(token)}&action=unsubscribe-all`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to unsubscribe')
      // Update local state
      const updated = { ...prefs }
      for (const group of PREF_GROUPS) {
        for (const item of group.items) {
          (updated as any)[item.key] = false
        }
      }
      setPrefs(updated)
      setUnsubscribedAll(true)
    } catch {
      // ignore
    } finally {
      setSaving(null)
    }
  }

  // Count enabled
  const enabledCount = prefs ? PREF_GROUPS.flatMap(g => g.items).filter(i => (prefs as any)[i.key]).length : 0
  const totalCount = PREF_GROUPS.flatMap(g => g.items).length

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="border-b bg-white dark:bg-slate-900">
        <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-600 text-white">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Email Preferences</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {prefs?.orgName ? `${prefs.orgName} · ` : ''}GrantLume
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 space-y-6">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin mb-3" />
            <p className="text-sm">Loading your preferences...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <AlertTriangle className="h-7 w-7 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Unable to load preferences</h2>
            <p className="text-sm text-slate-500 max-w-sm">{error}</p>
            <p className="text-xs text-slate-400 mt-4">
              If you believe this is an error, please check your email for the most recent link, or{' '}
              <a href="https://app.grantlume.com/profile" className="text-teal-600 hover:underline">log in to manage your settings</a>.
            </p>
          </div>
        )}

        {/* Preferences */}
        {prefs && !error && (
          <>
            {/* Summary card */}
            <div className="rounded-xl border bg-white dark:bg-slate-900 p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {prefs.email ? `Preferences for ${prefs.email}` : 'Your email preferences'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {enabledCount} of {totalCount} notification types enabled
                  </p>
                </div>
              </div>
              <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                enabledCount === totalCount
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : enabledCount === 0
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              }`}>
                {enabledCount === totalCount ? 'All enabled' : enabledCount === 0 ? 'All disabled' : `${enabledCount} enabled`}
              </div>
            </div>

            {/* Unsubscribed all banner */}
            {unsubscribedAll && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 p-4 flex items-center gap-3">
                <Check className="h-5 w-5 text-emerald-600 shrink-0" />
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  You have been unsubscribed from all optional emails. You can re-enable any category below.
                </p>
              </div>
            )}

            {/* Preference groups */}
            {PREF_GROUPS.map(group => (
              <div key={group.title} className="rounded-xl border bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-5 py-3 border-b bg-slate-50 dark:bg-slate-800/50">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{group.title}</h3>
                </div>
                <div className="divide-y">
                  {group.items.map(item => {
                    const enabled = (prefs as any)[item.key] as boolean
                    const isSaving = saving === item.key
                    const justSaved = savedKeys.has(item.key)
                    return (
                      <div key={item.key} className="flex items-center justify-between px-5 py-4">
                        <div className="pr-4 min-w-0">
                          <div className="flex items-center gap-2">
                            {enabled
                              ? <Bell className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                              : <BellOff className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.label}</span>
                            {justSaved && <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 ml-5.5">{item.description}</p>
                        </div>
                        <button
                          onClick={() => togglePref(item.key, !enabled)}
                          disabled={isSaving || saving === 'all'}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                            enabled ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-600'
                          } ${isSaving ? 'opacity-60' : ''}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            enabled ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Unsubscribe all / resubscribe */}
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Unsubscribe from all</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Stop receiving all optional email notifications. Security-related emails cannot be disabled.</p>
                </div>
                <button
                  onClick={handleUnsubscribeAll}
                  disabled={saving === 'all' || enabledCount === 0}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-40 transition-colors shrink-0"
                >
                  {saving === 'all' ? 'Saving...' : 'Unsubscribe All'}
                </button>
              </div>
            </div>

            {/* Footer info */}
            <div className="text-center space-y-2 pt-2">
              <p className="text-xs text-slate-400">
                Security-related emails (password changes, email changes, account removal) cannot be disabled.
              </p>
              <p className="text-xs text-slate-400">
                You can also manage these settings by{' '}
                <a href="https://app.grantlume.com/profile" className="text-teal-600 hover:underline">logging in to your GrantLume profile</a>.
              </p>
              <p className="text-[11px] text-slate-300 dark:text-slate-600">
                &copy; {new Date().getFullYear()} GrantLume. All rights reserved.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
