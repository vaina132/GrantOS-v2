import { useState, useEffect } from 'react'
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
      toast({ title: 'Saved', description: 'Absence type privacy settings updated.' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Absence Type Privacy</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configure which absence types are shown as private in the conflict visibility panel.
          Private types will appear as "Absence" instead of the specific type when other colleagues
          check for overlapping absences.
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
                    {isPrivate ? 'Private' : 'Public'}
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
                    Private
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Public
                  </>
                )}
              </Button>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-dashed p-4 bg-muted/20">
        <div className="text-xs text-muted-foreground max-w-md">
          <strong>How it works:</strong> When a colleague checks for leave conflicts before submitting
          their own absence, private absence types will show the person as "Absent" without revealing
          the specific reason (e.g. sick leave or parental leave).
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
