import { useState, useMemo, useEffect, useCallback } from 'react'
import { timesheetService, getWorkingDays } from '@/services/timesheetService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useStaff } from '@/hooks/useStaff'
import { settingsService } from '@/services/settingsService'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { ClipboardCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hoursToPm, formatPm } from '@/lib/pmUtils'
import type { TimesheetEntry, Person } from '@/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface PersonSummary {
  person: Person
  envelope: TimesheetEntry | null
  totalHours: number
}

export function AllTimesheets() {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()
  const { staff, isLoading: staffLoading } = useStaff({ is_active: true })
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [envelopes, setEnvelopes] = useState<TimesheetEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [hoursPerDay, setHoursPerDay] = useState(8)

  // Load org settings
  useEffect(() => {
    if (!orgId) return
    settingsService.getOrganisation(orgId).then(org => {
      if (org?.working_hours_per_day) setHoursPerDay(org.working_hours_per_day)
    }).catch(() => {})
  }, [orgId])

  // Load envelopes for all staff
  const loadEnvelopes = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    setLoading(true)
    try {
      const data = await timesheetService.listEnvelopes(orgId, {
        year: globalYear,
        month: selectedMonth,
      })
      setEnvelopes(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load envelopes'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [orgId, globalYear, selectedMonth])

  useEffect(() => { loadEnvelopes() }, [loadEnvelopes])

  // Build person + envelope pairs
  const personSummaries: PersonSummary[] = useMemo(() => {
    const envMap = new Map<string, TimesheetEntry>()
    for (const e of envelopes) {
      envMap.set(e.person_id, e)
    }

    return staff.map(p => {
      const env = envMap.get(p.id) ?? null
      return {
        person: p,
        envelope: env,
        totalHours: env?.total_hours ?? 0,
      }
    }).sort((a, b) => {
      // People with hours first, then alphabetical
      if (a.totalHours > 0 && b.totalHours === 0) return -1
      if (a.totalHours === 0 && b.totalHours > 0) return 1
      return a.person.full_name.localeCompare(b.person.full_name)
    })
  }, [staff, envelopes])

  const workingDays = getWorkingDays(globalYear, selectedMonth)
  const maxCapacity = workingDays * hoursPerDay
  const totalHoursAll = personSummaries.reduce((s, pe) => s + pe.totalHours, 0)
  const peopleWithHours = personSummaries.filter(pe => pe.totalHours > 0).length

  const prevMonth = () => setSelectedMonth(m => m > 1 ? m - 1 : 12)
  const nextMonth = () => setSelectedMonth(m => m < 12 ? m + 1 : 1)

  const isLoading = loading || staffLoading

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex gap-3 items-end flex-wrap">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground block mb-1">Month</label>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="inline-flex items-center rounded-lg border bg-muted/40 p-0.5 flex-wrap gap-0.5">
              {MONTHS.map((m, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedMonth(i + 1)}
                  className={cn(
                    'rounded-md px-2 py-1 text-[11px] font-semibold transition-all',
                    selectedMonth === i + 1
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5">
        <div className="text-sm font-semibold">{MONTHS[selectedMonth - 1]} {globalYear}</div>
        <div className="flex gap-4 text-xs">
          <span>{staff.length} staff</span>
          <span>{peopleWithHours} with entries</span>
          <span className="font-semibold">{totalHoursAll.toFixed(1)}h total</span>
          <span className="text-muted-foreground">{formatPm(hoursToPm(totalHoursAll, workingDays, hoursPerDay))}</span>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <SkeletonTable columns={5} rows={6} />
      ) : personSummaries.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No staff found"
          description="Add active staff members to start tracking timesheets."
        />
      ) : (
        <div className="space-y-2">
          {personSummaries.map((pe) => {
            const initials = pe.person.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
            const pct = maxCapacity > 0 ? Math.round((pe.totalHours / maxCapacity) * 100) : 0
            const hasHours = pe.totalHours > 0

            return (
              <div
                key={pe.person.id}
                className={cn(
                  'flex items-center justify-between rounded-lg border px-4 py-3 transition-colors',
                  hasHours ? 'border-l-[3px] border-l-primary' : 'border-l-[3px] border-l-transparent',
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Avatar */}
                  <div className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold',
                    hasHours ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                  )}>
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{pe.person.full_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {hasHours ? `${pe.totalHours.toFixed(1)}h` : '0h'} / {maxCapacity}h
                      {hasHours && ` · ${formatPm(hoursToPm(pe.totalHours, workingDays, hoursPerDay))}`}
                      {hasHours && ` · ${pct}%`}
                    </div>
                  </div>

                  {/* Capacity micro-bar */}
                  {hasHours && (
                    <div className="hidden sm:flex items-center gap-2 ml-2">
                      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            pct > 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500',
                          )}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
