import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { absenceService } from '@/services/absenceService'
import { holidayService } from '@/services/holidayService'
import { useAuthStore } from '@/stores/authStore'
import { useAbsences } from '@/hooks/useAbsences'
import { useStaff } from '@/hooks/useStaff'
import { useUiStore } from '@/stores/uiStore'
import { YearSelector } from '@/components/common/YearSelector'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AbsenceType, Absence } from '@/types'

const ABSENCE_TYPES: AbsenceType[] = ['Annual Leave', 'Sick Leave', 'Training', 'Public Holiday', 'Other']

const ABSENCE_COLORS: Record<AbsenceType, string> = {
  'Annual Leave': 'bg-blue-400',
  'Sick Leave': 'bg-red-400',
  'Training': 'bg-purple-400',
  'Public Holiday': 'bg-amber-400',
  'Other': 'bg-gray-400',
}

const ABSENCE_COLORS_LIGHT: Record<AbsenceType, string> = {
  'Annual Leave': 'bg-blue-100 border-blue-300',
  'Sick Leave': 'bg-red-100 border-red-300',
  'Training': 'bg-purple-100 border-purple-300',
  'Public Holiday': 'bg-amber-100 border-amber-300',
  'Other': 'bg-gray-100 border-gray-300',
}

interface DaySlot {
  date: Date
  dateStr: string
  dayOfWeek: number // 0=Sun, 6=Sat
  dayNum: number
  isWeekend: boolean
}

function getDaysInMonth(year: number, month: number): DaySlot[] {
  const days: DaySlot[] = []
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    const dow = date.getDay()
    days.push({
      date,
      dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayOfWeek: dow,
      dayNum: d,
      isWeekend: dow === 0 || dow === 6,
    })
  }
  return days
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

type HalfDay = 'am' | 'pm'

interface Selection {
  personId: string
  startDate: string
  startHalf: HalfDay
  endDate: string
  endHalf: HalfDay
}

function computeDays(sel: Selection, holidayDates?: Set<string>): number {
  const start = new Date(sel.startDate)
  const end = new Date(sel.endDate)
  if (start > end) return 0

  let days = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    const dow = cursor.getDay()
    const isWeekend = dow === 0 || dow === 6
    const curStr = cursor.toISOString().slice(0, 10)
    const isHoliday = holidayDates?.has(curStr) ?? false

    if (!isWeekend && !isHoliday) {
      if (curStr === sel.startDate && curStr === sel.endDate) {
        // Same day
        if (sel.startHalf === 'am' && sel.endHalf === 'pm') days += 1
        else days += 0.5
      } else if (curStr === sel.startDate) {
        days += sel.startHalf === 'am' ? 1 : 0.5
      } else if (curStr === sel.endDate) {
        days += sel.endHalf === 'pm' ? 1 : 0.5
      } else {
        days += 1
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

interface PersonAbsenceMap {
  [dateStr: string]: {
    am?: { absence: Absence }
    pm?: { absence: Absence }
  }
}

function buildAbsenceMap(absences: Absence[], personId: string): PersonAbsenceMap {
  const map: PersonAbsenceMap = {}
  const personAbs = absences.filter((a) => a.person_id === personId)

  for (const a of personAbs) {
    const start = a.start_date ?? a.date
    const end = a.end_date ?? a.date ?? a.start_date
    if (!start) continue

    const startD = new Date(start)
    const endD = new Date(end ?? start)
    const cursor = new Date(startD)

    while (cursor <= endD) {
      const ds = cursor.toISOString().slice(0, 10)
      if (!map[ds]) map[ds] = {}

      // Determine which halves are covered
      const isFirst = ds === start
      const isLast = ds === (end ?? start)

      if (a.period === 'am') {
        map[ds].am = { absence: a }
      } else if (a.period === 'pm') {
        map[ds].pm = { absence: a }
      } else {
        // Full day or multi-day: check if first/last day are half days based on .days
        // Default: full coverage
        if (isFirst && isLast && a.days != null && a.days === 0.5) {
          // Half day — default to AM
          map[ds].am = { absence: a }
        } else {
          map[ds].am = { absence: a }
          map[ds].pm = { absence: a }
        }
      }

      cursor.setDate(cursor.getDate() + 1)
    }
  }
  return map
}

const CELL_W = 28
const CELL_H = 20
const NAME_W = 160

export function AbsenceTimeline() {
  const { orgId, can } = useAuthStore()
  const { globalYear } = useUiStore()
  const { staff } = useStaff({ is_active: true })
  const { absences, isLoading, refetch } = useAbsences()

  const [month, setMonth] = useState(new Date().getMonth())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [absenceType, setAbsenceType] = useState<AbsenceType>('Annual Leave')
  const [holidays, setHolidays] = useState<{ date: string; name: string }[]>([])

  // Load holidays for the current month
  useEffect(() => {
    if (!orgId) return
    holidayService.listForMonth(orgId, globalYear, month + 1).then(setHolidays).catch(() => setHolidays([]))
  }, [orgId, globalYear, month])

  const holidaySet = useMemo(() => new Set(holidays.map(h => h.date)), [holidays])
  const holidayNames = useMemo(() => new Map(holidays.map(h => [h.date, h.name])), [holidays])

  // Selection state for drag
  const [selection, setSelection] = useState<Selection | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef<{ personId: string; dateStr: string; half: HalfDay } | null>(null)

  const days = useMemo(() => getDaysInMonth(globalYear, month), [globalYear, month])

  const prevMonth = () => setMonth((m) => (m > 0 ? m - 1 : 11))
  const nextMonth = () => setMonth((m) => (m < 11 ? m + 1 : 0))

  // Build absence maps per person
  const absenceMaps = useMemo(() => {
    const maps: Record<string, PersonAbsenceMap> = {}
    for (const p of staff) {
      maps[p.id] = buildAbsenceMap(absences, p.id)
    }
    return maps
  }, [absences, staff])

  const handleMouseDown = useCallback((personId: string, dateStr: string, half: HalfDay) => {
    if (!can('canManageAllocations')) return
    dragStart.current = { personId, dateStr, half }
    setIsDragging(true)
    setSelection({
      personId,
      startDate: dateStr,
      startHalf: half,
      endDate: dateStr,
      endHalf: half,
    })
  }, [can])

  const handleMouseEnter = useCallback((personId: string, dateStr: string, half: HalfDay) => {
    if (!isDragging || !dragStart.current) return
    if (personId !== dragStart.current.personId) return

    const startDate = dragStart.current.dateStr
    const startHalf = dragStart.current.half

    // Determine direction
    if (dateStr >= startDate) {
      setSelection({
        personId,
        startDate,
        startHalf,
        endDate: dateStr,
        endHalf: half,
      })
    } else {
      setSelection({
        personId,
        startDate: dateStr,
        startHalf: half,
        endDate: startDate,
        endHalf: startHalf,
      })
    }
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    if (!isDragging || !selection) {
      setIsDragging(false)
      return
    }
    setIsDragging(false)
    // Open dialog to confirm absence type
    setDialogOpen(true)
  }, [isDragging, selection])

  // Attach mouseup to window
  useEffect(() => {
    const handler = () => handleMouseUp()
    window.addEventListener('mouseup', handler)
    return () => window.removeEventListener('mouseup', handler)
  }, [handleMouseUp])

  const handleSave = async () => {
    if (!selection || !orgId) return
    setSaving(true)
    try {
      const dayCount = computeDays(selection)
      await absenceService.create({
        org_id: orgId,
        person_id: selection.personId,
        type: absenceType,
        start_date: selection.startDate,
        end_date: selection.endDate,
        days: dayCount,
        date: selection.startDate,
        period: selection.startDate === selection.endDate && dayCount === 0.5
          ? selection.startHalf
          : null,
        notes: null,
        note: null,
      } as any)
      toast({ title: 'Absence recorded', description: `${dayCount} day${dayCount !== 1 ? 's' : ''} added.` })
      setDialogOpen(false)
      setSelection(null)
      refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const isInSelection = (personId: string, dateStr: string, half: HalfDay): boolean => {
    if (!selection || selection.personId !== personId) return false
    if (dateStr < selection.startDate || dateStr > selection.endDate) return false
    if (dateStr === selection.startDate && dateStr === selection.endDate) {
      // Same day: check half order
      if (selection.startHalf === 'am' && selection.endHalf === 'am') return half === 'am'
      if (selection.startHalf === 'pm' && selection.endHalf === 'pm') return half === 'pm'
      return true
    }
    if (dateStr === selection.startDate) {
      return selection.startHalf === 'am' ? true : half === 'pm'
    }
    if (dateStr === selection.endDate) {
      return selection.endHalf === 'pm' ? true : half === 'am'
    }
    return true
  }

  const personName = (pid: string) => staff.find((s) => s.id === pid)?.full_name ?? ''

  return (
    <div className="space-y-4">
      {/* Year & Month navigation */}
      <div className="flex items-center gap-4">
        <YearSelector />
        <div className="h-6 w-px bg-border" />
        <Button variant="outline" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold min-w-[180px] text-center">
          {MONTH_NAMES[month]} {globalYear}
        </h3>
        <Button variant="outline" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {ABSENCE_TYPES.map((t) => (
          <div key={t} className="flex items-center gap-1.5">
            <span className={cn('inline-block w-3 h-3 rounded-sm', ABSENCE_COLORS[t])} />
            <span>{t}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          <span className="inline-block w-3 h-3 rounded-sm bg-muted border" />
          <span>Weekend</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-100 border border-amber-300" />
          <span>National Holiday</span>
        </div>
      </div>

      {/* Timeline grid */}
      {isLoading ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground">Loading...</div>
      ) : (
        <div className="rounded-lg border overflow-x-auto select-none" onMouseLeave={() => { if (isDragging) { /* keep selection */ } }}>
          <div style={{ minWidth: NAME_W + days.length * CELL_W }}>
            {/* Header row: day numbers */}
            <div className="flex border-b bg-muted/50 sticky top-0 z-10">
              <div className="shrink-0 px-3 py-1 text-xs font-medium border-r flex items-end" style={{ width: NAME_W }}>
                Staff
              </div>
              {days.map((day) => (
                <div
                  key={day.dateStr}
                  className={cn(
                    'text-center text-[10px] border-r last:border-r-0 py-1 flex flex-col items-center justify-end leading-tight',
                    day.isWeekend && 'bg-muted/80',
                    !day.isWeekend && holidaySet.has(day.dateStr) && 'bg-amber-100 dark:bg-amber-900/30',
                  )}
                  style={{ width: CELL_W }}
                  title={holidayNames.get(day.dateStr) ?? undefined}
                >
                  <span className="text-muted-foreground">{DAY_LABELS[day.dayOfWeek]}</span>
                  <span className={cn('font-medium', !day.isWeekend && holidaySet.has(day.dateStr) && 'text-amber-700 dark:text-amber-400')}>{day.dayNum}</span>
                </div>
              ))}
            </div>

            {/* Staff rows */}
            {staff.map((person) => {
              const absMap = absenceMaps[person.id] || {}
              return (
                <div key={person.id} className="flex border-b last:border-b-0 hover:bg-muted/5">
                  <div
                    className="shrink-0 px-3 py-0.5 text-xs font-medium border-r flex items-center truncate"
                    style={{ width: NAME_W }}
                    title={person.full_name}
                  >
                    {person.full_name}
                  </div>
                  {days.map((day) => {
                    const amAbs = absMap[day.dateStr]?.am?.absence
                    const pmAbs = absMap[day.dateStr]?.pm?.absence
                    const amSel = isDragging && isInSelection(person.id, day.dateStr, 'am')
                    const pmSel = isDragging && isInSelection(person.id, day.dateStr, 'pm')

                    return (
                      <div
                        key={day.dateStr}
                        className={cn(
                          'border-r last:border-r-0 flex flex-col cursor-crosshair',
                          day.isWeekend && 'bg-muted/40',
                          !day.isWeekend && holidaySet.has(day.dateStr) && !amAbs && !pmAbs && 'bg-amber-50 dark:bg-amber-900/20',
                        )}
                        style={{ width: CELL_W, height: CELL_H * 2 }}
                        title={holidayNames.get(day.dateStr) ?? undefined}
                      >
                        {/* AM half */}
                        <div
                          className={cn(
                            'flex-1 border-b border-dashed border-muted-foreground/20 transition-colors',
                            amAbs && ABSENCE_COLORS_LIGHT[amAbs.type],
                            amSel && !amAbs && 'bg-blue-200/60',
                          )}
                          onMouseDown={(e) => { e.preventDefault(); handleMouseDown(person.id, day.dateStr, 'am') }}
                          onMouseEnter={() => handleMouseEnter(person.id, day.dateStr, 'am')}
                          title={amAbs ? `${amAbs.type} (AM)` : `${day.dateStr} AM`}
                        />
                        {/* PM half */}
                        <div
                          className={cn(
                            'flex-1 transition-colors',
                            pmAbs && ABSENCE_COLORS_LIGHT[pmAbs.type],
                            pmSel && !pmAbs && 'bg-blue-200/60',
                          )}
                          onMouseDown={(e) => { e.preventDefault(); handleMouseDown(person.id, day.dateStr, 'pm') }}
                          onMouseEnter={() => handleMouseEnter(person.id, day.dateStr, 'pm')}
                          title={pmAbs ? `${pmAbs.type} (PM)` : `${day.dateStr} PM`}
                        />
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Absence creation dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setSelection(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Absence</DialogTitle>
          </DialogHeader>
          {selection && (
            <div className="space-y-4 py-4">
              <div className="text-sm">
                <span className="font-medium">{personName(selection.personId)}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">From:</span>{' '}
                  <span className="font-medium">{selection.startDate}</span>{' '}
                  <Badge variant="outline" className="text-[10px]">{selection.startHalf.toUpperCase()}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">To:</span>{' '}
                  <span className="font-medium">{selection.endDate}</span>{' '}
                  <Badge variant="outline" className="text-[10px]">{selection.endHalf.toUpperCase()}</Badge>
                </div>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Working days:</span>{' '}
                <span className="font-semibold">{computeDays(selection, holidaySet)}</span>
              </div>
              <div className="space-y-2">
                <Label>Absence Type</Label>
                <div className="flex flex-wrap gap-2">
                  {ABSENCE_TYPES.map((t) => (
                    <Button
                      key={t}
                      variant={absenceType === t ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAbsenceType(t)}
                      className="text-xs"
                    >
                      <span className={cn('inline-block w-2.5 h-2.5 rounded-sm mr-1.5', ABSENCE_COLORS[t])} />
                      {t}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setSelection(null) }} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Absence'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
