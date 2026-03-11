import { useState, useEffect } from 'react'
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
import { User, Bell, Lock, Save } from 'lucide-react'
import type { UserPreferences } from '@/types'

export function ProfileSettingsPage() {
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

  useEffect(() => {
    if (!user?.id || !orgId) return
    setLoading(true)
    preferencesService.get(user.id, orgId)
      .then((p) => {
        setPrefs(p)
        setDisplayName(p.display_name ?? user.email?.split('@')[0] ?? '')
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Failed to load preferences'
        toast({ title: 'Error', description: message, variant: 'destructive' })
      })
      .finally(() => setLoading(false))
  }, [user?.id, orgId])

  const handleSaveProfile = async () => {
    if (!prefs) return
    setSaving(true)
    try {
      const updated = await preferencesService.update(prefs.id, {
        display_name: displayName.trim() || null,
      })
      setPrefs(updated)
      toast({ title: 'Profile saved' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleEmail = async (key: keyof UserPreferences, value: boolean) => {
    if (!prefs) return
    const prev = prefs[key]
    // Optimistic update
    setPrefs({ ...prefs, [key]: value })
    try {
      await preferencesService.update(prefs.id, { [key]: value } as Partial<UserPreferences>)
    } catch (err) {
      // Revert
      setPrefs({ ...prefs, [key]: prev })
      const message = err instanceof Error ? err.message : 'Failed to update'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: 'Password too short', description: 'Must be at least 6 characters.', variant: 'destructive' })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' })
      return
    }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast({ title: 'Password updated successfully' })
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change password'
      toast({ title: 'Error', description: message, variant: 'destructive' })
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
