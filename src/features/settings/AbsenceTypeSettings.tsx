import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { settingsService } from '@/services/settingsService'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import { Eye, EyeOff, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AbsenceType } from '@/types'

const ALL_ABSENCE_TYPES: AbsenceType[] = ['Annual Leave', 'Sick Leave', 'Training', 'Public Holiday', 'Other']

const DEFAULT_PRIVATE: AbsenceType[] = ['Sick Leave']

const DESCRIPTIONS: Record<AbsenceType, string> = {
  'Annual Leave': 'Vacation and personal time off',
  'Sick Leave': 'Illness or medical appointments',
  'Training': 'Conferences, workshops, and training events',
  'Public Holiday': 'National or regional holidays',
  'Other': 'Miscellaneous leave types',
}

export function AbsenceTypeSettings() {
  const { t } = useTranslation()
  const { orgId } = useAuthStore()
  const [privateTypes, setPrivateTypes] = useState<string[]>(DEFAULT_PRIVATE)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!orgId) return
    settingsService.getOrganisation(orgId).then((org) => {
      if (org?.private_absence_types) {
        setPrivateTypes(org.private_absence_types)
      }
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [orgId])

  const toggleType = (type: AbsenceType) => {
    setPrivateTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

  const handleSave = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      await settingsService.updateOrganisation(orgId, { private_absence_types: privateTypes } as any)
      toast({ title: t('settings.settingsSaved') })
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.failedToSave')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) {
    return <div className="text-sm text-muted-foreground py-8 text-center">{t('common.loading')}...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{t('settings.absenceTypePrivacy')}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t('settings.absenceTypePrivacyDesc')}
        </p>
      </div>

      <div className="rounded-lg border divide-y">
        {ALL_ABSENCE_TYPES.map((type) => {
          const isPrivate = privateTypes.includes(type)
          return (
            <div
              key={type}
              className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{type}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] px-1.5',
                      isPrivate
                        ? 'border-amber-300 text-amber-700 dark:text-amber-400'
                        : 'border-emerald-300 text-emerald-700 dark:text-emerald-400',
                    )}
                  >
                    {isPrivate ? t('settings.private') : t('settings.public')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{DESCRIPTIONS[type]}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleType(type)}
                className={cn(
                  'gap-1.5',
                  isPrivate
                    ? 'text-amber-600 hover:text-amber-700'
                    : 'text-emerald-600 hover:text-emerald-700',
                )}
              >
                {isPrivate ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    {t('settings.private')}
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    {t('settings.public')}
                  </>
                )}
              </Button>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-dashed p-4 bg-muted/20">
        <div className="text-xs text-muted-foreground max-w-md">
          <strong>{t('settings.howItWorks')}:</strong> {t('settings.absencePrivacyExplanation')}
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? t('common.saving') : t('common.saveChanges')}
        </Button>
      </div>
    </div>
  )
}
