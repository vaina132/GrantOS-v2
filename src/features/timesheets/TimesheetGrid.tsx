import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { timesheetService, toDateStr } from '@/services/timesheetService'
import { holidayService } from '@/services/holidayService'
import { absenceService } from '@/services/absenceService'
import { settingsService } from '@/services/settingsService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useStaff } from '@/hooks/useStaff'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { Send, Copy, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hoursToPm, formatPm, pmToHours } from '@/lib/pmUtils'
import type { Holiday, Absence, Assignment, TimesheetEntry } from '@/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const PROJECT_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16']

interface DayInfo {
  date: Date
  dateStr: string
  dayNum: number
  dow: number
  isWeekend: boolean
  isHoliday: boolean
  holidayName: string | null
  isAbsence: boolean
  absenceType: string | null
  isAvailable: boolean
}

interface ProjectRow {
  project_id: string
  work_package_id: string | null
  acronym: string
  wpName: string | null
  allocPm: number
  color: string
}

interface GridState {
  [key: string]: number // key = `${project_id}:${wp_id}:${dateStr}` → hours
}

export function TimesheetGrid() {
  const { orgId, user, can } = useAuthStore()
  const { globalYear } = useUiStore()
  const { staff } = useStaff({ is_active: true })
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [autoFilling, setAutoFilling] = useState(false)
  const [copying, setCopying] = useState(false)

  // Data state
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [envelope, setEnvelope] = useState<TimesheetEntry | null>(null)
  const [hoursPerDay, setHoursPerDay] = useState(8)

  // Grid state (local edits before save)
  const [grid, setGrid] = useState<GridState>({})
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Determine person: staff sees self, admin can switch
  const isAdmin = can('canApproveTimesheets') || can('canManageProjects')
  const currentPersonId = selectedPersonId || staff.find(p => p.email === user?.email)?.id || ''

  // Load org settings (hours per day)
  useEffect(() => {
    if (!orgId) return
    settingsService.getOrganisation(orgId).then(org => {
      if (org?.working_hours_per_day) setHoursPerDay(org.working_hours_per_day)
    }).catch(() => {})
  }, [orgId])

  // Load all data when person/month changes
  const loadData = useCallback(async () => {
    if (!orgId || !currentPersonId) { setLoading(false); return }
    setLoading(true)
    try {
      const [days, hols, abs, alloc, env] = await Promise.all([
        timesheetService.listDays(orgId, currentPersonId, globalYear, selectedMonth),
        holidayService.listForMonth(orgId, globalYear, selectedMonth),
        absenceService.list(orgId, { person_id: currentPersonId, year: globalYear }),
        loadAssignments(orgId, currentPersonId, globalYear, selectedMonth),
        timesheetService.ensureEnvelope(orgId, currentPersonId, globalYear, selectedMonth),
      ])
      setHolidays(hols)
      setAbsences(abs)
      setAssignments(alloc)
      setEnvelope(env)

      // Build grid state from loaded day entries
      const g: GridState = {}
      for (const d of days) {
        const key = `${d.project_id}:${d.work_package_id ?? ''}:${d.date}`
        g[key] = d.hours
      }
      setGrid(g)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load timesheet data'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [orgId, currentPersonId, globalYear, selectedMonth])

  useEffect(() => { loadData() }, [loadData])

  // Load assignments for person in month
  async function loadAssignments(orgId: string, personId: string, year: number, month: number): Promise<Assignment[]> {
    const { data, error } = await (await import('@/lib/supabase')).supabase
      .from('assignments')
      .select('*, projects(acronym, title), work_packages(name)')
      .eq('org_id', orgId)
      .eq('person_id', personId)
      .eq('year', year)
      .eq('month', month)
      .eq('type', 'actual')

    if (error) throw error
    return (data ?? []) as unknown as Assignment[]
  }

  // Build calendar days for the month
  const calendarDays: DayInfo[] = useMemo(() => {
    const daysInMonth = new Date(globalYear, selectedMonth, 0).getDate()
    const holidaySet = new Set(holidays.map(h => h.date))
    const holidayNames = new Map(holidays.map(h => [h.date, h.name]))

    // Build absence date set for this person
    const absenceDates = new Set<string>()
    const absenceTypeMap = new Map<string, string>()
    for (const a of absences.filter(ab => ab.person_id === currentPersonId)) {
      const start = a.start_date ?? a.date
      const end = a.end_date ?? a.date ?? a.start_date
      if (!start) continue
      const startD = new Date(start)
      const endD = new Date(end ?? start)
      const cursor = new Date(startD)
      while (cursor <= endD) {
        const ds = toDateStr(cursor)
        absenceDates.add(ds)
        absenceTypeMap.set(ds, a.type)
        cursor.setDate(cursor.getDate() + 1)
      }
    }

    const result: DayInfo[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(globalYear, selectedMonth - 1, d)
      const dow = date.getDay()
      const dateStr = toDateStr(date)
      const isWeekend = dow === 0 || dow === 6
      const isHoliday = holidaySet.has(dateStr)
      const isAbsence = absenceDates.has(dateStr)
      result.push({
        date, dateStr, dayNum: d, dow, isWeekend, isHoliday,
        holidayName: holidayNames.get(dateStr) ?? null,
        isAbsence, absenceType: absenceTypeMap.get(dateStr) ?? null,
        isAvailable: !isWeekend && !isHoliday && !isAbsence,
      })
    }
    return result
  }, [globalYear, selectedMonth, holidays, absences, currentPersonId])

  const availableDays = useMemo(() => calendarDays.filter(d => d.isAvailable), [calendarDays])
  const availableDateStrs = useMemo(() => availableDays.map(d => d.dateStr), [availableDays])

  // Build project rows from assignments
  const projectRows: ProjectRow[] = useMemo(() => {
    if (assignments.length === 0) return []
    return assignments.map((a: any, i: number) => ({
      project_id: a.project_id,
      work_package_id: a.work_package_id,
      acronym: a.projects?.acronym ?? '—',
      wpName: a.work_packages?.name ?? null,
      allocPm: a.pms ?? 0,
      color: PROJECT_COLORS[i % PROJECT_COLORS.length],
    }))
  }, [assignments])

  // Compute totals
  const projectTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const row of projectRows) {
      const key = `${row.project_id}:${row.work_package_id ?? ''}`
      let sum = 0
      for (const d of calendarDays) {
        const gKey = `${row.project_id}:${row.work_package_id ?? ''}:${d.dateStr}`
        sum += (grid[gKey] || 0)
      }
      totals[key] = sum
    }
    return totals
  }, [grid, projectRows, calendarDays])

  const dailyTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const d of calendarDays) {
      let sum = 0
      for (const row of projectRows) {
        const gKey = `${row.project_id}:${row.work_package_id ?? ''}:${d.dateStr}`
        sum += (grid[gKey] || 0)
      }
      totals[d.dateStr] = sum
    }
    return totals
  }, [grid, projectRows, calendarDays])

  const grandTotal = useMemo(() => Object.values(projectTotals).reduce((a, b) => a + b, 0), [projectTotals])
  const totalCapacity = availableDays.length * hoursPerDay
  const capacityPct = totalCapacity > 0 ? Math.round((grandTotal / totalCapacity) * 100) : 0
  const grandTotalPm = hoursToPm(grandTotal, availableDays.length, hoursPerDay)

  // Grid cell change handler with debounced auto-save
  const handleCellChange = useCallback((projectId: string, wpId: string | null, dateStr: string, value: number) => {
    const key = `${projectId}:${wpId ?? ''}:${dateStr}`
    setGrid(prev => ({ ...prev, [key]: value }))

    // Debounced save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (!orgId || !currentPersonId) return
      try {
        await timesheetService.upsertDay(orgId, currentPersonId, projectId, wpId, dateStr, value)
      } catch (err) {
        console.error('Auto-save failed:', err)
      }
    }, 800)
  }, [orgId, currentPersonId])

  // Fill from plan
  const handleAutoFill = async () => {
    if (!orgId || !currentPersonId) return
    setAutoFilling(true)
    try {
      const result = await timesheetService.autoFillFromPlan(
        orgId, currentPersonId, globalYear, selectedMonth, availableDateStrs, hoursPerDay,
      )
      toast({ title: 'Filled from plan', description: `${result.filled} cells populated from allocations.` })
      await loadData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to auto-fill'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setAutoFilling(false)
    }
  }

  // Copy previous month
  const handleCopyPrevMonth = async () => {
    if (!orgId || !currentPersonId) return
    setCopying(true)
    try {
      const result = await timesheetService.copyPreviousMonth(
        orgId, currentPersonId, globalYear, selectedMonth, availableDateStrs,
      )
      toast({ title: 'Copied', description: `${result.copied} cells copied from previous month.` })
      await loadData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to copy'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setCopying(false)
    }
  }

  // Submit for approval
  const handleSubmit = async () => {
    if (!orgId || !currentPersonId || !user) return
    setSubmitting(true)
    try {
      await timesheetService.submit(orgId, currentPersonId, globalYear, selectedMonth, user.id)
      toast({ title: 'Submitted', description: 'Timesheet submitted for approval.' })
      await loadData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const prevMonth = () => setSelectedMonth(m => m > 1 ? m - 1 : 12)
  const nextMonth = () => setSelectedMonth(m => m < 12 ? m + 1 : 1)
  const prevMonthName = MONTHS[(selectedMonth - 2 + 12) % 12]
  const isLocked = envelope?.status === 'Submitted' || envelope?.status === 'Approved'

  if (loading) return <SkeletonTable columns={6} rows={6} />

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-3 items-end flex-wrap">
          {isAdmin && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Person</label>
              <select
                value={currentPersonId}
                onChange={(e) => setSelectedPersonId(e.target.value)}
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select person...</option>
                {staff.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Month</label>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="inline-flex items-center rounded-lg border bg-muted/40 p-0.5 gap-0.5 flex-wrap">
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

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleAutoFill} disabled={autoFilling || isLocked} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            {autoFilling ? 'Filling...' : 'Fill from Plan'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyPrevMonth} disabled={copying || isLocked} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" />
            {copying ? 'Copying...' : `Copy ${prevMonthName}`}
          </Button>
          {!isLocked && grandTotal > 0 && (
            <Button size="sm" onClick={handleSubmit} disabled={submitting} className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              {submitting ? 'Submitting...' : 'Submit'}
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Working Days</div>
          <div className="text-xl font-bold tabular-nums mt-0.5">{availableDays.length}</div>
          <div className="text-[11px] text-muted-foreground">{MONTHS[selectedMonth - 1]} {globalYear}</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total Hours</div>
          <div className="text-xl font-bold tabular-nums mt-0.5 text-primary">{grandTotal.toFixed(1)}h</div>
          <div className="text-[11px] text-muted-foreground">= {formatPm(grandTotalPm)} · max {totalCapacity}h</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Capacity Used</div>
          <div className={cn('text-xl font-bold tabular-nums mt-0.5', capacityPct > 100 ? 'text-red-500' : capacityPct >= 80 ? 'text-amber-500' : 'text-emerald-500')}>{capacityPct}%</div>
          <div className="text-[11px] text-muted-foreground">
            {calendarDays.filter(d => d.isHoliday).length > 0 && `${calendarDays.filter(d => d.isHoliday).length} holiday · `}
            {calendarDays.filter(d => d.isAbsence).length > 0 && `${calendarDays.filter(d => d.isAbsence).length} absence · `}
            {projectRows.length} projects
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Status</div>
          <div className="mt-1"><StatusBadge status={envelope?.status ?? 'Draft'} /></div>
        </div>
      </div>

      {/* Capacity progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', capacityPct > 100 ? 'bg-red-500' : capacityPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500')}
            style={{ width: `${Math.min(capacityPct, 100)}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{grandTotal.toFixed(1)} / {totalCapacity}h</span>
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border bg-background" /> Editable</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-muted" /> Weekend</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-50 border-red-200 border" /> Holiday</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-50 border-blue-200 border" /> Absence</span>
      </div>

      {/* THE GRID */}
      {projectRows.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <div className="text-muted-foreground text-sm">No allocations found for this period.</div>
          <div className="text-muted-foreground text-xs mt-1">Create allocations in the Allocations module first, then come back here.</div>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-max min-w-full border-collapse text-xs">
              <thead>
                <tr className="bg-muted/60">
                  <th className="sticky left-0 z-10 bg-muted/60 px-3 py-2 text-left font-semibold text-muted-foreground min-w-[160px] border-r border-b">
                    Project / WP
                  </th>
                  {calendarDays.map(d => (
                    <th
                      key={d.dateStr}
                      className={cn(
                        'px-0 py-1 text-center font-medium border-b min-w-[42px] w-[42px]',
                        d.isWeekend && 'bg-muted/40',
                        d.isHoliday && 'bg-red-50',
                      )}
                      title={d.isHoliday ? d.holidayName ?? 'Holiday' : undefined}
                    >
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{DAY_NAMES[d.dow]}</div>
                      <div className={cn('text-[11px] font-bold', d.isHoliday && 'text-red-500')}>{d.dayNum}</div>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-bold border-b border-l min-w-[64px] bg-muted/60">Total</th>
                </tr>
              </thead>
              <tbody>
                {projectRows.map((row, rowIdx) => {
                  const rowKey = `${row.project_id}:${row.work_package_id ?? ''}`
                  const rowTotal = projectTotals[rowKey] || 0
                  const allocHours = pmToHours(row.allocPm, availableDays.length, hoursPerDay)
                  const rowPm = hoursToPm(rowTotal, availableDays.length, hoursPerDay)

                  return (
                    <tr key={rowKey} className={cn('border-b last:border-0', rowIdx % 2 === 1 && 'bg-muted/10')}>
                      <td
                        className="sticky left-0 z-[1] bg-card px-3 py-2 border-r font-medium"
                        style={{ borderLeft: `3px solid ${row.color}` }}
                      >
                        <div className="text-primary font-semibold text-xs">{row.acronym}</div>
                        {row.wpName && <div className="text-[10px] text-muted-foreground">{row.wpName}</div>}
                        <div className="text-[10px] text-muted-foreground">Plan: {allocHours.toFixed(1)}h ({formatPm(row.allocPm)})</div>
                      </td>
                      {calendarDays.map(d => {
                        const cellKey = `${row.project_id}:${row.work_package_id ?? ''}:${d.dateStr}`
                        const value = grid[cellKey] || 0
                        const editable = d.isAvailable && !isLocked

                        return (
                          <td
                            key={d.dateStr}
                            className={cn(
                              'px-0.5 py-0.5 text-center',
                              d.isWeekend && 'bg-muted/30',
                              d.isHoliday && 'bg-red-50/50',
                              d.isAbsence && !d.isWeekend && 'bg-blue-50/50',
                            )}
                          >
                            {editable ? (
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max={hoursPerDay.toString()}
                                value={value || ''}
                                placeholder="·"
                                onChange={(e) => {
                                  const raw = parseFloat(e.target.value) || 0
                                  const v = Math.min(Math.max(raw, 0), hoursPerDay)
                                  handleCellChange(row.project_id, row.work_package_id, d.dateStr, v)
                                }}
                                className={cn(
                                  'w-full h-7 text-center text-xs tabular-nums rounded border border-transparent bg-transparent outline-none transition-all',
                                  'hover:border-border hover:bg-muted/50 focus:border-primary focus:bg-primary/5 focus:ring-1 focus:ring-primary/20',
                                  value > 0 && 'font-bold',
                                )}
                              />
                            ) : (
                              <div className="h-7 flex items-center justify-center text-muted-foreground/40 text-[10px]">
                                {d.isHoliday ? '🏛' : d.isAbsence ? '🏖' : ''}
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-2 py-2 text-center bg-muted/30 border-l">
                        <div className={cn('font-bold tabular-nums text-xs', rowTotal > allocHours + 0.5 && 'text-amber-600')}>{rowTotal.toFixed(1)}h</div>
                        <div className="text-[10px] text-muted-foreground tabular-nums">{formatPm(rowPm)}</div>
                      </td>
                    </tr>
                  )
                })}

                {/* Daily totals row */}
                <tr className="bg-muted/50 border-t-2">
                  <td className="sticky left-0 z-[1] bg-muted/50 px-3 py-2 border-r">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Daily Total</div>
                  </td>
                  {calendarDays.map(d => {
                    const total = dailyTotals[d.dateStr] || 0
                    const pct = total / hoursPerDay
                    const isOver = total > hoursPerDay
                    const isNear = pct >= 0.9 && !isOver

                    return (
                      <td key={d.dateStr} className={cn('px-0.5 py-1 text-center', d.isWeekend && 'bg-muted/30')}>
                        {!d.isWeekend && !d.isHoliday && (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={cn('text-[10px] font-bold tabular-nums', isOver && 'text-red-500', isNear && 'text-amber-500')}>
                              {total > 0 ? total.toFixed(1) : ''}
                            </span>
                            <div className="w-5 h-1 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn('h-full rounded-full', isOver ? 'bg-red-500' : isNear ? 'bg-amber-500' : 'bg-emerald-500')}
                                style={{ width: `${Math.min(pct * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-2 py-2 text-center bg-muted/50 border-l">
                    <div className={cn('font-bold tabular-nums text-sm', capacityPct > 100 && 'text-red-500')}>{grandTotal.toFixed(1)}h</div>
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                      {formatPm(grandTotalPm)}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bottom hint */}
      <div className="text-[11px] text-muted-foreground">
        💡 Hours auto-save as you type. Tab between cells to navigate. Click "Fill from Plan" to auto-distribute from allocations.
      </div>
    </div>
  )
}
