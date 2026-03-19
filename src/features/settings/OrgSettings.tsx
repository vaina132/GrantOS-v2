import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { settingsService } from '@/services/settingsService'
import { useAuthStore } from '@/stores/authStore'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { Save, Download, X, Plus } from 'lucide-react'
import { exportService } from '@/services/exportService'
import { COUNTRIES } from '@/data/countries'
import { CURRENCIES, currencyForCountry } from '@/data/currencies'

export function OrgSettings() {
  const { t } = useTranslation()
  const { orgId } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [workingHoursPerDay, setWorkingHoursPerDay] = useState('8')
  const [workingDaysPerYear, setWorkingDaysPerYear] = useState('220')
  const [defaultOverheadRate, setDefaultOverheadRate] = useState('25')
  const [departments, setDepartments] = useState<string[]>([])
  const [newDept, setNewDept] = useState('')
  const [defaultVacationDays, setDefaultVacationDays] = useState('25')
  const [timesheetsDriveAllocations, setTimesheetsDriveAllocations] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(true)

  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    settingsService.getOrganisation(orgId).then((org) => {
      if (org) {
        setName(org.name ?? '')
        setCountry((org as any).country ?? '')
        setCurrency(org.currency ?? 'EUR')
        setWorkingHoursPerDay(String(org.working_hours_per_day ?? 8))
        setWorkingDaysPerYear(String(org.working_days_per_year ?? 220))
        setDefaultOverheadRate(String(org.default_overhead_rate ?? 25))
        setDepartments(org.departments ?? [])
        setDefaultVacationDays(String((org as any).default_vacation_days ?? 25))
        setTimesheetsDriveAllocations(org.timesheets_drive_allocations ?? false)
        setAiEnabled((org as any).ai_enabled ?? true)
      }
    }).catch((err) => {
      logger.warn('Failed to load organisation settings', { source: 'OrgSettings' }, err)
      toast({ title: 'Error', description: 'Failed to load organisation settings.', variant: 'destructive' })
    }).finally(() => setLoading(false))
  }, [orgId])

  const handleSave = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      await settingsService.updateOrganisation(orgId, {
        name,
        country: country || null,
        currency,
        working_hours_per_day: Number(workingHoursPerDay),
        working_days_per_year: Number(workingDaysPerYear),
        default_overhead_rate: Number(defaultOverheadRate),
        departments,
        default_vacation_days: Number(defaultVacationDays) || 25,
        timesheets_drive_allocations: timesheetsDriveAllocations,
        ai_enabled: aiEnabled,
      } as any)
      // Reload auth context so aiEnabled is reflected immediately across the app
      try { await useAuthStore.getState().reloadContext() } catch { /* non-critical */ }
      toast({ title: t('settings.settingsSaved') })
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.failedToSave')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('settings.organisation')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('settings.orgName')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('staff.country')}</Label>
            <select
              value={country}
              onChange={(e) => {
                const cc = e.target.value
                setCountry(cc)
                if (cc) setCurrency(currencyForCountry(cc))
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">{t('common.search')}...</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{t('settings.currency')}</Label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.code} ({c.symbol}) — {c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{t('settings.workingHours')}</Label>
            <Input type="number" value={workingHoursPerDay} onChange={(e) => setWorkingHoursPerDay(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('settings.workingDaysYear')}</Label>
            <Input type="number" value={workingDaysPerYear} onChange={(e) => setWorkingDaysPerYear(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('settings.defaultOverheadRate')}</Label>
            <Input type="number" value={defaultOverheadRate} onChange={(e) => setDefaultOverheadRate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('settings.defaultVacationDays')}</Label>
            <Input type="number" min="0" max="365" value={defaultVacationDays} onChange={(e) => setDefaultVacationDays(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t('settings.defaultVacationDaysDesc')}</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t('settings.departments')}</Label>
            <div className="flex flex-wrap gap-2 min-h-[2.5rem] rounded-md border border-input bg-background px-3 py-2">
              {departments.map((dept) => (
                <span
                  key={dept}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium"
                >
                  {dept}
                  <button
                    type="button"
                    onClick={() => setDepartments((prev) => prev.filter((d) => d !== dept))}
                    className="rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault()
                    const val = newDept.trim()
                    if (val && !departments.includes(val)) {
                      setDepartments((prev) => [...prev, val])
                    }
                    setNewDept('')
                  }
                }}
                placeholder={departments.length === 0 ? 'e.g. CS, EE, Physics' : 'Add department...'}
                className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            {newDept.trim() && !departments.includes(newDept.trim()) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  const val = newDept.trim()
                  if (val && !departments.includes(val)) {
                    setDepartments((prev) => [...prev, val])
                  }
                  setNewDept('')
                }}
              >
                <Plus className="h-3 w-3" />
                Add "{newDept.trim()}"
              </Button>
            )}
            <p className="text-xs text-muted-foreground">{t('settings.departmentsHint') ?? 'Press Enter or comma to add a department'}</p>
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-semibold">{t('settings.timesheetsDriveAllocations')}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('settings.timesheetsDriveAllocationsDesc')}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={timesheetsDriveAllocations}
              onClick={() => setTimesheetsDriveAllocations(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                timesheetsDriveAllocations ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  timesheetsDriveAllocations ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-semibold">{t('settings.aiEnabled')}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('settings.aiEnabledDesc')}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={aiEnabled}
              onClick={() => setAiEnabled(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                aiEnabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  aiEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {!aiEnabled && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              {t('settings.aiDisabledWarning')}
            </p>
          )}
        </div>
        <div className="flex justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={exporting || !orgId}
              onClick={async () => {
                if (!orgId) return
                setExporting(true)
                try {
                  await exportService.exportOrganisation(orgId, 'json')
                  toast({ title: t('settings.exportComplete') })
                } catch (_e) { toast({ title: t('settings.exportFailed'), variant: 'destructive' }) }
                finally { setExporting(false) }
              }}
            >
              <Download className="mr-1 h-4 w-4" />
              {exporting ? t('settings.exporting') : t('settings.exportJSON')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting || !orgId}
              onClick={async () => {
                if (!orgId) return
                setExporting(true)
                try {
                  await exportService.exportOrganisation(orgId, 'csv')
                  toast({ title: t('settings.exportComplete') })
                } catch (_e) { toast({ title: t('settings.exportFailed'), variant: 'destructive' }) }
                finally { setExporting(false) }
              }}
            >
              <Download className="mr-1 h-4 w-4" />
              {t('settings.exportCSV')}
            </Button>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
