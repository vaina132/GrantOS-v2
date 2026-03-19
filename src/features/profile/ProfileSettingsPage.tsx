import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { preferencesService, EMAIL_PREF_LABELS } from '@/services/preferencesService'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { Switch } from '@/components/ui/switch'
import { User, Bell, Lock, Save, Info, Globe, Check, ExternalLink } from 'lucide-react'
import { MfaEnrollment } from './MfaEnrollment'
import { writeSecurityAudit } from '@/services/auditWriter'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n'
import type { UserPreferences } from '@/types'

export function ProfileSettingsPage() {
  const { t, i18n } = useTranslation()
  const { user, orgId, orgName, role } = useAuthStore()
  const [prefs, setPrefs] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // Profile fields
  const [displayName, setDisplayName] = useState('')

  // Password change
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Whether preferences are actually persisted in DB (id is non-empty)
  const isPersisted = Boolean(prefs?.id)

  useEffect(() => {
    if (!user?.id || !orgId) return
    setLoading(true)
    preferencesService.get(user.id, orgId)
      .then((p) => {
        setPrefs(p)
        setDisplayName(p.display_name ?? user.email?.split('@')[0] ?? '')
      })
      .finally(() => setLoading(false))
  }, [user?.id, orgId])

  const handleSaveProfile = async () => {
    if (!prefs) return
    setSaving(true)
    try {
      if (!isPersisted) {
        toast({ title: t('common.warning'), description: t('profile.prefsNotAvailable'), variant: 'destructive' })
        return
      }
      const updated = await preferencesService.update(prefs.id, {
        display_name: displayName.trim() || null,
      })
      if (updated) {
        setPrefs(updated)
        toast({ title: t('profile.profileSaved') })
      } else {
        toast({ title: t('common.warning'), description: t('profile.couldNotSave') })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.failedToSave')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleEmail = async (key: keyof UserPreferences, value: boolean) => {
    if (!prefs) return
    if (!isPersisted) {
      toast({ title: t('common.warning'), description: t('profile.prefsNotAvailable') })
      return
    }
    const prev = prefs[key]
    // Optimistic update
    setPrefs({ ...prefs, [key]: value })
    const result = await preferencesService.update(prefs.id, { [key]: value } as Partial<UserPreferences>)
    if (!result) {
      // Revert
      setPrefs({ ...prefs, [key]: prev })
      toast({ title: t('common.warning'), description: t('profile.couldNotSavePref') })
    }
  }

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: t('profile.passwordTooShort'), variant: 'destructive' })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({ title: t('profile.passwordMismatch'), variant: 'destructive' })
      return
    }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      writeSecurityAudit({ action: 'password_change', details: 'Password changed via profile settings' })
      toast({ title: t('profile.passwordUpdated') })
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.failedToSave')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Settings" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-0">
      <PageHeader
        title="My Settings"
        description="Manage your personal profile, password, and email notification preferences"
      />

      <div className="space-y-6 pt-5 max-w-2xl">
        {!isPersisted && (
          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Note:</strong> Email notification preferences require a database migration.
              Run <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">supabase/add_user_preferences.sql</code> in your Supabase SQL Editor to enable saving preferences.
              Until then, all notifications are enabled by default.
            </div>
          </div>
        )}
        {/* ── Profile ── */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Profile</CardTitle>
            </div>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email ?? ''} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Organisation</Label>
                <Input value={orgName ?? ''} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input value={role ?? ''} disabled className="bg-muted" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={saving} size="sm" className="gap-1.5">
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Language ── */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">{t('settings.language')}</CardTitle>
            </div>
            <CardDescription>{t('settings.languageDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isActive = i18n.language === lang.code || i18n.language?.startsWith(lang.code + '-')
                return (
                  <button
                    key={lang.code}
                    onClick={() => {
                      i18n.changeLanguage(lang.code)
                      localStorage.setItem('gl_language', lang.code)
                      toast({ title: lang.label, description: `Interface language changed to ${lang.label}` })
                    }}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-all ${
                      isActive
                        ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                        : 'border-border hover:border-muted-foreground/30 hover:bg-accent text-foreground'
                    }`}
                  >
                    <span className="text-lg">{lang.flag}</span>
                    <span className="flex-1">{lang.label}</span>
                    {isActive && <Check className="h-4 w-4 text-primary" />}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Password ── */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Change Password</CardTitle>
            </div>
            <CardDescription>Update your login password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleChangePassword}
                disabled={savingPassword || !newPassword}
                size="sm"
                variant="outline"
                className="gap-1.5"
              >
                <Lock className="h-3.5 w-3.5" />
                {savingPassword ? 'Updating...' : 'Change Password'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Two-Factor Authentication ── */}
        <MfaEnrollment />

        {/* ── Email Notifications ── */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Email Notifications</CardTitle>
            </div>
            <CardDescription>Choose which email notifications you want to receive. Changes are saved automatically.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {EMAIL_PREF_LABELS.map((pref) => {
                const enabled = prefs ? (prefs[pref.key] as boolean) : true
                return (
                  <div key={pref.key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="space-y-0.5 pr-4">
                      <div className="text-sm font-medium">{pref.label}</div>
                      <div className="text-xs text-muted-foreground">{pref.description}</div>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked: boolean) => handleToggleEmail(pref.key, checked)}
                    />
                  </div>
                )
              })}
            </div>

            {/* Unsubscribe link info */}
            {prefs?.unsubscribe_token && (
              <div className="mt-5 pt-4 border-t">
                <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Every email from GrantLume includes a <strong>"Manage notification preferences"</strong> link in the footer. You or your team members can use it to change email settings without logging in.</p>
                    <a
                      href={`/email-preferences?token=${prefs.unsubscribe_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                    >
                      Preview your preferences page
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
