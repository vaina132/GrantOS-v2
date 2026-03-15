import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { holidayService } from '@/services/holidayService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { YearSelector } from '@/components/common/YearSelector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'
import { Plus, Trash2, Calendar, Download, Loader2, MapPin } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { HOLIDAY_REGIONS } from '@/data/holidayRegions'
import type { Holiday } from '@/types'

// Countries supported by Nager.Date API — European countries + Turkey
const HOLIDAY_COUNTRIES = [
  { code: 'AL', name: 'Albania' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AT', name: 'Austria' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EE', name: 'Estonia' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GR', name: 'Greece' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IT', name: 'Italy' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MT', name: 'Malta' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'NO', name: 'Norway' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'TR', name: 'Turkey' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'GB', name: 'United Kingdom' },
]

export function HolidaySettings() {
  const { t } = useTranslation()
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // New holiday form
  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')

  // Import from country + optional region
  const [importCountry, setImportCountry] = useState('')
  const [importRegion, setImportRegion] = useState('')
  const [importing, setImporting] = useState(false)

  // Available regions for the selected country (empty if country has no regional holidays)
  const availableRegions = useMemo(() => {
    if (!importCountry || !HOLIDAY_REGIONS[importCountry]) return []
    return Object.entries(HOLIDAY_REGIONS[importCountry])
      .sort(([, a], [, b]) => a.localeCompare(b))
  }, [importCountry])

  // Reset region when country changes
  const handleCountryChange = (code: string) => {
    setImportCountry(code)
    setImportRegion('')
  }

  interface NagerHoliday {
    date: string
    localName: string
    name: string
    global: boolean
    counties: string[] | null
    types: string[]
  }

  const handleImport = async () => {
    if (!orgId || !importCountry) return
    setImporting(true)
    try {
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${globalYear}/${importCountry}`)
      if (!res.ok) throw new Error(`API returned ${res.status}`)
      const data: NagerHoliday[] = await res.json()

      // Filter to Public type only
      const publicOnly = data.filter(h => h.types.includes('Public'))

      if (importRegion) {
        // Regional import: nationwide holidays + holidays for selected region
        const regionHols = publicOnly.filter(h =>
          h.global || (h.counties && h.counties.includes(importRegion))
        )
        if (regionHols.length === 0) {
          toast({ title: t('settings.noHolidaysFound'), description: t('settings.noHolidaysFoundDesc', { country: importCountry, year: globalYear }) })
          setImporting(false)
          return
        }
        const items = regionHols.map(h => ({ date: h.date, name: h.localName || h.name }))
        const count = await holidayService.bulkCreate(orgId, items, importCountry, importRegion)
        const regionName = HOLIDAY_REGIONS[importCountry]?.[importRegion] ?? importRegion
        const countryName = HOLIDAY_COUNTRIES.find(c => c.code === importCountry)?.name ?? importCountry
        toast({ title: t('settings.holidaysImported'), description: t('settings.holidaysImportedRegionDesc', { count, region: regionName, country: countryName, year: globalYear }) })
      } else {
        // National-only import: just global holidays (no region selected)
        const globalHolidays = publicOnly.filter(h => h.global)
        if (globalHolidays.length === 0) {
          toast({ title: t('settings.noHolidaysFound'), description: t('settings.noHolidaysFoundDesc', { country: importCountry, year: globalYear }) })
          setImporting(false)
          return
        }
        const items = globalHolidays.map(h => ({ date: h.date, name: h.localName || h.name }))
        const count = await holidayService.bulkCreate(orgId, items, importCountry)
        const countryName = HOLIDAY_COUNTRIES.find(c => c.code === importCountry)?.name ?? importCountry
        toast({ title: t('settings.holidaysImported'), description: t('settings.holidaysImportedDesc', { count, country: countryName, year: globalYear }) })
      }

      setImportCountry('')
      setImportRegion('')
      loadHolidays()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.failedToSave')
      toast({ title: t('settings.importFailed'), description: message, variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  const loadHolidays = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const data = await holidayService.list(orgId, globalYear)
      setHolidays(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.failedToSave')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [orgId, globalYear])

  useEffect(() => { loadHolidays() }, [loadHolidays])

  const handleAdd = async () => {
    if (!orgId || !newDate || !newName.trim()) return
    setSaving(true)
    try {
      await holidayService.create(orgId, newDate, newName.trim())
      setNewDate('')
      setNewName('')
      toast({ title: t('settings.holidayAdded') })
      loadHolidays()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.failedToSave')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      await holidayService.remove(id)
      toast({ title: t('settings.holidayDeleted') })
      loadHolidays()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.failedToDelete')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setDeleting(null)
    }
  }

  // Group holidays by month
  const byMonth: Record<number, Holiday[]> = {}
  for (const h of holidays) {
    const m = new Date(h.date).getMonth()
    if (!byMonth[m]) byMonth[m] = []
    byMonth[m].push(h)
  }

  const MONTHS = [t('time.january'), t('time.february'), t('time.march'), t('time.april'), t('time.may'), t('time.june'), t('time.july'), t('time.august'), t('time.september'), t('time.october'), t('time.november'), t('time.december')]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('settings.holidays')}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t('settings.holidaysDesc')}
          </p>
        </div>
        <YearSelector />
      </div>

      {/* Import from country + optional region */}
      <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('settings.importHolidays')}</div>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="space-y-1 min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground">{t('staff.country')}</label>
            <select
              value={importCountry}
              onChange={(e) => handleCountryChange(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{t('common.selectCountry')}</option>
              {HOLIDAY_COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>
                  {c.name}{HOLIDAY_REGIONS[c.code] ? ` ★` : ''}
                </option>
              ))}
            </select>
          </div>
          {availableRegions.length > 0 && (
            <div className="space-y-1 min-w-[240px]">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {t('settings.region')}
              </label>
              <select
                value={importRegion}
                onChange={(e) => setImportRegion(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{t('settings.nationalOnly')}</option>
                {availableRegions.map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>
          )}
          <Button onClick={handleImport} disabled={importing || !importCountry} variant="outline" className="gap-1.5">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {importing ? t('settings.importing') : t('settings.importYearHolidays', { year: globalYear })}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {importRegion
            ? t('settings.importRegionNote', { region: HOLIDAY_REGIONS[importCountry]?.[importRegion] ?? importRegion })
            : t('settings.importHolidaysNote')}
        </p>
      </div>

      {/* Add form */}
      <div className="flex gap-3 items-end flex-wrap">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{t('common.date')}</label>
          <Input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-[160px]"
            min={`${globalYear}-01-01`}
            max={`${globalYear}-12-31`}
          />
        </div>
        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground">{t('settings.holidayName')}</label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Christmas Day"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          />
        </div>
        <Button onClick={handleAdd} disabled={saving || !newDate || !newName.trim()} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {saving ? t('common.adding') : t('settings.addHoliday')}
        </Button>
      </div>

      {/* Holiday list */}
      {loading ? (
        <div className="text-sm text-muted-foreground">{t('common.loading')}...</div>
      ) : holidays.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-6 text-center">
          <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <div className="text-sm text-muted-foreground">{t('settings.noHolidays', { year: globalYear })}</div>
          <div className="text-xs text-muted-foreground mt-1">{t('settings.noHolidaysDesc2')}</div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground font-medium">
            {holidays.length} {t('settings.holidaysIn', { year: globalYear })}
          </div>

          {Object.keys(byMonth).sort((a, b) => Number(a) - Number(b)).map(monthStr => {
            const monthNum = Number(monthStr)
            const monthHolidays = byMonth[monthNum]
            return (
              <div key={monthNum}>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {MONTHS[monthNum]}
                </div>
                <div className="space-y-1">
                  {monthHolidays.map(h => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs tabular-nums text-muted-foreground w-[80px]">
                          {formatDate(h.date)}
                        </span>
                        <span className="text-sm font-medium">{h.name}</span>
                        {h.country_code && (
                          <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {HOLIDAY_COUNTRIES.find(c => c.code === h.country_code)?.name ?? h.country_code}
                          </span>
                        )}
                        {h.region_code && (
                          <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" />
                            {(h.country_code && HOLIDAY_REGIONS[h.country_code]?.[h.region_code]) ?? h.region_code}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-500"
                        onClick={() => handleDelete(h.id)}
                        disabled={deleting === h.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
