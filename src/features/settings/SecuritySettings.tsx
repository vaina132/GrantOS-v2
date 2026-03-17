import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { ShieldCheck, Save } from 'lucide-react'

interface OrgSecuritySettings {
  id?: string
  org_id: string
  mfa_required: boolean
  idle_timeout_minutes: number
  max_login_attempts: number
  lockout_duration_seconds: number
  password_min_length: number
  session_max_hours: number
}

const DEFAULTS: Omit<OrgSecuritySettings, 'org_id'> = {
  mfa_required: false,
  idle_timeout_minutes: 30,
  max_login_attempts: 6,
  lockout_duration_seconds: 60,
  password_min_length: 8,
  session_max_hours: 24,
}

export function SecuritySettings() {
  const { t } = useTranslation()
  const { orgId } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<OrgSecuritySettings | null>(null)

  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    ;(supabase.from as any)('org_security_settings')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle()
      .then(({ data, error }: { data: any; error: any }) => {
        if (error) {
          console.warn('[SecuritySettings] Load error:', error.message)
        }
        if (data) {
          setSettings(data)
        } else {
          setSettings({ org_id: orgId, ...DEFAULTS })
        }
      })
      .finally(() => setLoading(false))
  }, [orgId])

  const handleSave = async () => {
    if (!settings || !orgId) return
    setSaving(true)
    try {
      const payload = {
        org_id: orgId,
        mfa_required: settings.mfa_required,
        idle_timeout_minutes: settings.idle_timeout_minutes,
        max_login_attempts: settings.max_login_attempts,
        lockout_duration_seconds: settings.lockout_duration_seconds,
        password_min_length: settings.password_min_length,
        session_max_hours: settings.session_max_hours,
      }

      if (settings.id) {
        const { error } = await (supabase.from as any)('org_security_settings')
          .update(payload)
          .eq('id', settings.id)
        if (error) throw error
      } else {
        const { data, error } = await (supabase.from as any)('org_security_settings')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        if (data) setSettings(data)
      }
      toast({ title: t('settings.settingsSaved') })
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.failedToSave')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const update = <K extends keyof OrgSecuritySettings>(key: K, value: OrgSecuritySettings[K]) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  if (!settings) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">{t('settings.securityTitle')}</CardTitle>
        </div>
        <CardDescription>{t('settings.securityDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* MFA enforcement */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 pr-4">
            <div className="text-sm font-medium">{t('settings.requireMfa')}</div>
            <div className="text-xs text-muted-foreground">{t('settings.requireMfaDesc')}</div>
          </div>
          <Switch
            checked={settings.mfa_required}
            onCheckedChange={(checked: boolean) => update('mfa_required', checked)}
          />
        </div>

        <div className="border-t pt-4 grid gap-4 sm:grid-cols-2">
          {/* Idle timeout */}
          <div className="space-y-2">
            <Label>{t('settings.idleTimeout')}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={5}
                max={120}
                value={settings.idle_timeout_minutes}
                onChange={(e) => update('idle_timeout_minutes', Math.max(5, Math.min(120, Number(e.target.value))))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">{t('settings.minutes')}</span>
            </div>
          </div>

          {/* Session max hours */}
          <div className="space-y-2">
            <Label>{t('settings.sessionMaxHours')}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={168}
                value={settings.session_max_hours}
                onChange={(e) => update('session_max_hours', Math.max(1, Math.min(168, Number(e.target.value))))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">{t('settings.hours')}</span>
            </div>
          </div>

          {/* Max login attempts */}
          <div className="space-y-2">
            <Label>{t('settings.maxLoginAttempts')}</Label>
            <Input
              type="number"
              min={3}
              max={20}
              value={settings.max_login_attempts}
              onChange={(e) => update('max_login_attempts', Math.max(3, Math.min(20, Number(e.target.value))))}
              className="w-24"
            />
          </div>

          {/* Lockout duration */}
          <div className="space-y-2">
            <Label>{t('settings.lockoutDuration')}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={30}
                max={600}
                value={settings.lockout_duration_seconds}
                onChange={(e) => update('lockout_duration_seconds', Math.max(30, Math.min(600, Number(e.target.value))))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">{t('settings.seconds')}</span>
            </div>
          </div>

          {/* Password min length */}
          <div className="space-y-2">
            <Label>{t('settings.passwordMinLength')}</Label>
            <Input
              type="number"
              min={6}
              max={32}
              value={settings.password_min_length}
              onChange={(e) => update('password_min_length', Math.max(6, Math.min(32, Number(e.target.value))))}
              className="w-24"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
