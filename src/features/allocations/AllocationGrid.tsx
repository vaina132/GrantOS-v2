import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { allocationsService } from '@/services/allocationsService'
import type { AllocationCell } from '@/services/allocationsService'
import { useAuthStore } from '@/stores/authStore'
import { logger } from '@/lib/logger'
import { useUiStore } from '@/stores/uiStore'
import { useStaff } from '@/hooks/useStaff'
import { useProjects } from '@/hooks/useProjects'
import { useAssignments, usePeriodLocks } from '@/hooks/useAllocations'
import { useAbsences } from '@/hooks/useAbsences'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import { Undo2, Redo2, Save, Grid3x3, Plus, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PersonAvatar } from '@/components/common/PersonAvatar'
import { getWorkingDaysInMonth, pmToHours, hoursToPm } from '@/lib/pmUtils'
import { settingsService } from '@/services/settingsService'
import { timesheetService } from '@/services/timesheetService'
import { emailService } from '@/services/emailService'
import { BulkFillDialog } from './BulkFillDialog'
import { projectsService } from '@/services/projectsService'
import type { AssignmentType, Person, Project, WorkPackage } from '@/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Returns a heatmap background class based on utilisation % (allocated / capacity). */
function heatmapBg(utilisation: number): string {
  if (utilisation <= 0) return ''
  if (utilisation <= 0.5) return 'bg-emerald-50 dark:bg-emerald-950/20'
  if (utilisation <= 0.8) return 'bg-yellow-50 dark:bg-yellow-950/20'
  if (utilisation <= 1.0) return 'bg-amber-50 dark:bg-amber-950/20'
  return 'bg-red-50 dark:bg-red-950/20'
}

/** Returns a heatmap text color class for summary row utilisation values. */
function heatmapText(utilisation: number): string {
  if (utilisation <= 0) return 'text-muted-foreground'
  if (utilisation <= 0.5) return 'text-emerald-700 dark:text-emerald-400'
  if (utilisation <= 0.8) return 'text-yellow-700 dark:text-yellow-400'
  if (utilisation <= 1.0) return 'text-amber-700 dark:text-amber-400'
  return 'text-red-700 dark:text-red-400 font-bold'
}

type CellKey = string // "personId:projectId:wpId:month"

function makeCellKey(personId: string, projectId: string, wpId: string | null, month: number): CellKey {
  return `${personId}:${projectId}:${wpId ?? 'null'}:${month}`
}

interface GridRow {
  person: Person
  project: Project
  wpId: string | null
  wpName: string | null
}

export function AllocationGrid() {
  const { t } = useTranslation()
  const mode: AssignmentType = 'actual'
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()
  const { staff, isLoading: loadingStaff } = useStaff({ is_active: true })
  const { projects, isLoading: loadingProjects } = useProjects()
  const { assignments: actualAssignments, isLoading: loadingActual, refetch: refetchActual } = useAssignments('actual')
  const { isLocked } = usePeriodLocks()
  const { absences } = useAbsences()
  const [hoursPerDay, setHoursPerDay] = useState(8)
  const [timesheetsDriveAllocations, setTimesheetsDriveAllocations] = useState(false)
  const [tsAggregates, setTsAggregates] = useState<{ person_id: string; project_id: string; work_package_id: string | null; month: number; totalHours: number }[]>([])

  // Load org settings
  useEffect(() => {
    if (!orgId) return
    settingsService.getOrganisation(orgId).then(org => {
      if (org?.working_hours_per_day) setHoursPerDay(org.working_hours_per_day)
      setTimesheetsDriveAllocations(org?.timesheets_drive_allocations ?? false)
    }).catch((err) => logger.warn('Failed to load org settings', { source: 'AllocationGrid' }, err))
  }, [orgId])

  // When timesheets drive allocations: load aggregated timesheet hours
  useEffect(() => {
    if (!orgId || !timesheetsDriveAllocations) { setTsAggregates([]); return }
    timesheetService.aggregateHoursByYear(orgId, globalYear).then(setTsAggregates).catch(() => setTsAggregates([]))
  }, [orgId, globalYear, timesheetsDriveAllocations])

  // When timesheets drive allocations: override cells with computed PMs from timesheet hours
  const timesheetDriven = timesheetsDriveAllocations

  // Fetch work packages for all projects
  const [wpsByProject, setWpsByProject] = useState<Record<string, WorkPackage[]>>({})
  useEffect(() => {
    if (projects.length === 0) { setWpsByProject({}); return }
    Promise.all(
      projects.map((p) => projectsService.listWorkPackages(p.id).then((wps) => ({ pid: p.id, wps })))
    ).then((results) => {
      const map: Record<string, WorkPackage[]> = {}
      for (const r of results) if (r.wps.length > 0) map[r.pid] = r.wps
      setWpsByProject(map)
    }).catch((err) => logger.warn('Failed to load work packages', { source: 'AllocationGrid' }, err))
  }, [projects])

  const assignments = actualAssignments
  const isLoading = loadingStaff || loadingProjects || loadingActual

  // Compute absence PM per person per month: "personId:month" -> PM lost
  const absencePmMap = useMemo(() => {
    const map: Record<string, number> = {}
    const WORKING_DAYS_PER_MONTH = 22
    for (const a of absences) {
      if (!a.start_date) continue
      const start = new Date(a.start_date)
      const end = a.end_date ? new Date(a.end_date) : start
      const cursor = new Date(start)
      // Distribute absence days across months they span
      while (cursor <= end) {
        const m = cursor.getMonth() + 1
        const y = cursor.getFullYear()
        if (y === globalYear) {
          const dow = cursor.getDay()
          if (dow !== 0 && dow !== 6) {
            const key = `${a.person_id}:${m}`
            map[key] = (map[key] ?? 0) + 1
          }
        }
        cursor.setDate(cursor.getDate() + 1)
      }
    }
    // Convert days to PM fraction
    for (const key of Object.keys(map)) {
      map[key] = map[key] / WORKING_DAYS_PER_MONTH
    }
    return map
  }, [absences, globalYear])

  // Local editable state with undo/redo
  const { state: cells, set: setCells, undo, redo, reset: resetCells, canUndo, canRedo } = useUndoRedo<Record<CellKey, number>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bulkFillOpen, setBulkFillOpen] = useState(false)
  const [bulkFillTarget, setBulkFillTarget] = useState<{ personId: string; projectId: string; wpId: string | null } | null>(null)
  const [manualRows, setManualRows] = useState<{ personId: string; projectId: string }[]>([])
  const [addPersonId, setAddPersonId] = useState('')
  const [addProjectId, setAddProjectId] = useState('')
  const [addRowOpen, setAddRowOpen] = useState(false)

  // Build cell map from loaded assignments OR from timesheet aggregates
  useEffect(() => {
    if (timesheetDriven && tsAggregates.length > 0) {
      // Compute PMs from timesheet hours
      const map: Record<CellKey, number> = {}
      for (const agg of tsAggregates) {
        const workingDays = getWorkingDaysInMonth(globalYear, agg.month)
        const pms = hoursToPm(agg.totalHours, workingDays, hoursPerDay)
        const key = makeCellKey(agg.person_id, agg.project_id, agg.work_package_id, agg.month)
        map[key] = Math.round(pms * 100) / 100
      }
      resetCells(map)
      setDirty(false)
    } else {
      const map: Record<CellKey, number> = {}
      for (const a of assignments) {
        const key = makeCellKey(a.person_id, a.project_id, a.work_package_id, a.month)
        map[key] = a.pms
      }
      resetCells(map)
      setDirty(false)
    }
  }, [assignments, resetCells, timesheetDriven, tsAggregates, globalYear, hoursPerDay])

  // Build grid rows: one row per person-project (or person-project-wp) combination
  const rows = useMemo(() => {
    const result: GridRow[] = []
    const personMap = new Map(staff.map((p) => [p.id, p]))
    const projectMap = new Map(projects.map((p) => [p.id, p]))

    // Build a set of visible person+project+wp triples
    const visibleTriples = new Set<string>()

    // Rows from existing assignment data
    for (const a of assignments) {
      const tripleKey = `${a.person_id}:${a.project_id}:${a.work_package_id ?? 'null'}`
      if (!visibleTriples.has(tripleKey)) {
        const person = personMap.get(a.person_id)
        const project = projectMap.get(a.project_id)
        if (person && project) {
          const wps = wpsByProject[project.id]
          const wp = wps?.find((w) => w.id === a.work_package_id)
          result.push({ person, project, wpId: a.work_package_id, wpName: wp?.name ?? null })
          visibleTriples.add(tripleKey)
        }
      }
    }

    // Rows from timesheet aggregates (when timesheets drive allocations)
    if (timesheetDriven) {
      for (const agg of tsAggregates) {
        const tripleKey = `${agg.person_id}:${agg.project_id}:${agg.work_package_id ?? 'null'}`
        if (!visibleTriples.has(tripleKey)) {
          const person = personMap.get(agg.person_id)
          const project = projectMap.get(agg.project_id)
          if (person && project) {
            const wps = wpsByProject[project.id]
            const wp = wps?.find((w) => w.id === agg.work_package_id)
            result.push({ person, project, wpId: agg.work_package_id, wpName: wp?.name ?? null })
            visibleTriples.add(tripleKey)
          }
        }
      }
    }

    // Manually added rows — expand to WP rows if project uses WPs
    for (const mr of manualRows) {
      const person = personMap.get(mr.personId)
      const project = projectMap.get(mr.projectId)
      if (!person || !project) continue
      const wps = wpsByProject[project.id]
      if (wps && wps.length > 0) {
        for (const wp of wps) {
          const tripleKey = `${mr.personId}:${mr.projectId}:${wp.id}`
          if (!visibleTriples.has(tripleKey)) {
            result.push({ person, project, wpId: wp.id, wpName: wp.name })
            visibleTriples.add(tripleKey)
          }
        }
      } else {
        const tripleKey = `${mr.personId}:${mr.projectId}:null`
        if (!visibleTriples.has(tripleKey)) {
          result.push({ person, project, wpId: null, wpName: null })
          visibleTriples.add(tripleKey)
        }
      }
    }

    result.sort((a, b) => {
      const nameCmp = a.person.full_name.localeCompare(b.person.full_name)
      if (nameCmp !== 0) return nameCmp
      const projCmp = a.project.acronym.localeCompare(b.project.acronym)
      if (projCmp !== 0) return projCmp
      return (a.wpName ?? '').localeCompare(b.wpName ?? '')
    })

    return result
  }, [staff, projects, assignments, manualRows, wpsByProject, timesheetDriven, tsAggregates])

  const updateCell = useCallback(
    (personId: string, projectId: string, wpId: string | null, month: number, value: number) => {
      const key = makeCellKey(personId, projectId, wpId, month)
      setCells({ ...cells, [key]: value })
      setDirty(true)
    },
    [cells, setCells],
  )

  // Person-month totals per person per month
  const personMonthTotals = useMemo(() => {
    const totals: Record<string, number> = {} // "personId:month" -> total
    for (const [key, val] of Object.entries(cells)) {
      const parts = key.split(':')
      const personId = parts[0]
      const month = parts[3]
      const totalKey = `${personId}:${month}`
      totals[totalKey] = (totals[totalKey] ?? 0) + val
    }
    return totals
  }, [cells])

  // Workload preview for the selected person
  const selectedPerson = addPersonId ? staff.find((p) => p.id === addPersonId) : null
  const selectedPersonLoad = useMemo(() => {
    if (!selectedPerson) return null
    const months = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1
      let allocated = 0
      for (const [key, val] of Object.entries(cells)) {
        const parts = key.split(':')
        if (parts[0] === selectedPerson.id && Number(parts[3]) === month) allocated += val
      }
      const absencePm = absencePmMap[`${selectedPerson.id}:${month}`] ?? 0
      const capacity = Math.max(0, selectedPerson.fte - absencePm)
      return { month, allocated, absencePm, capacity, free: Math.max(0, capacity - allocated) }
    })
    const yearTotal = months.reduce((s, m) => s + m.allocated, 0)
    return { months, yearTotal }
  }, [selectedPerson, cells, absencePmMap])

  // Already-assigned projects for selected person (for context)
  const selectedPersonProjects = useMemo(() => {
    if (!selectedPerson) return []
    const projectMap = new Map(projects.map((p) => [p.id, p]))
    const seen = new Set<string>()
    const result: { acronym: string; total: number }[] = []
    for (const [key, val] of Object.entries(cells)) {
      const parts = key.split(':')
      if (parts[0] !== selectedPerson.id || val === 0) continue
      const pid = parts[1]
      if (!seen.has(pid)) {
        seen.add(pid)
        let total = 0
        for (const [k2, v2] of Object.entries(cells)) {
          const p2 = k2.split(':')
          if (p2[0] === selectedPerson.id && p2[1] === pid) total += v2
        }
        const proj = projectMap.get(pid)
        if (proj) result.push({ acronym: proj.acronym, total })
      }
    }
    return result.sort((a, b) => b.total - a.total)
  }, [selectedPerson, cells, projects])

  const handleSave = async () => {
    if (!orgId) return

    // Check for over-allocated person-months considering absences
    const overAllocatedWarnings: string[] = []
    const personMap = new Map(staff.map((p) => [p.id, p]))
    for (const [pmKey, total] of Object.entries(personMonthTotals)) {
      const [pid, mStr] = pmKey.split(':')
      const person = personMap.get(pid)
      if (!person) continue
      const absencePm = absencePmMap[pmKey] ?? 0
      const capacity = Math.max(0, person.fte - absencePm)
      if (total > capacity + 0.001) {
        overAllocatedWarnings.push(
          `${person.full_name} in ${MONTHS[Number(mStr) - 1]}: ${total.toFixed(2)} PM allocated but only ${capacity.toFixed(2)} PM available`
        )
      }
    }
    if (overAllocatedWarnings.length > 0) {
      const proceed = window.confirm(
        `Warning: The following allocations exceed available capacity (FTE minus absences):\n\n${overAllocatedWarnings.slice(0, 5).join('\n')}${overAllocatedWarnings.length > 5 ? `\n...and ${overAllocatedWarnings.length - 5} more` : ''}\n\nSave anyway?`
      )
      if (!proceed) return
    }

    setSaving(true)
    try {
      const upserts: (AllocationCell & { org_id: string })[] = []
      for (const [key, pms] of Object.entries(cells)) {
        const parts = key.split(':')
        upserts.push({
          org_id: orgId,
          person_id: parts[0],
          project_id: parts[1],
          work_package_id: parts[2] === 'null' ? null : parts[2],
          year: globalYear,
          month: Number(parts[3]),
          pms,
          type: mode,
        })
      }
      // Snapshot old values before save (for change detection)
      const oldMap = new Map<string, number>()
      for (const a of assignments) {
        oldMap.set(makeCellKey(a.person_id, a.project_id, a.work_package_id, a.month), a.pms)
      }

      await allocationsService.bulkUpsertAssignments(upserts)
      toast({ title: t('allocations.saved'), description: t('allocations.allocationsSaved') })
      setDirty(false)
      refetchActual()

      // Fire-and-forget: notify persons whose annual PMs changed
      try {
        // Group changes by person+project → sum old/new annual PMs
        const changedPersonProjects = new Map<string, { personId: string; projectId: string; oldTotal: number; newTotal: number }>()
        for (const u of upserts) {
          const ppKey = `${u.person_id}:${u.project_id}`
          if (!changedPersonProjects.has(ppKey)) {
            changedPersonProjects.set(ppKey, { personId: u.person_id, projectId: u.project_id, oldTotal: 0, newTotal: 0 })
          }
          const entry = changedPersonProjects.get(ppKey)!
          const cellKey = makeCellKey(u.person_id, u.project_id, u.work_package_id, u.month)
          entry.newTotal += u.pms
          entry.oldTotal += oldMap.get(cellKey) ?? 0
        }
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.grantlume.com'
        for (const [, { personId, projectId, oldTotal, newTotal }] of changedPersonProjects) {
          if (Math.abs(oldTotal - newTotal) < 0.01) continue // no meaningful change
          const person = staff.find(s => s.id === personId)
          const project = projects.find(p => p.id === projectId)
          if (!person?.email || !project) continue
          emailService.sendAllocationChanged({
            to: person.email,
            employeeName: person.full_name,
            orgName: '',
            projectAcronym: project.acronym,
            year: globalYear,
            oldPms: oldTotal.toFixed(2),
            newPms: newTotal.toFixed(2),
            allocationsUrl: `${origin}/allocations`,
          }).catch(() => {})
        }
      } catch { /* ignore email errors */ }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.failedToSave')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleBulkFill = (pms: number, months: number[]) => {
    if (!bulkFillTarget) return
    const newCells = { ...cells }
    for (const month of months) {
      const key = makeCellKey(bulkFillTarget.personId, bulkFillTarget.projectId, bulkFillTarget.wpId, month)
      newCells[key] = pms
    }
    setCells(newCells)
    setDirty(true)
    setBulkFillTarget(null)
  }

  if (isLoading) return <SkeletonTable columns={14} rows={6} />

  const handleAddRow = () => {
    if (!addPersonId || !addProjectId) return
    const existsInGrid = rows.some((r) => r.person.id === addPersonId && r.project.id === addProjectId)
    const existsInManual = manualRows.some((mr) => mr.personId === addPersonId && mr.projectId === addProjectId)
    if (existsInGrid || existsInManual) {
      toast({ title: t('allocations.alreadyExists'), description: t('allocations.alreadyExistsDesc') })
      return
    }
    setManualRows((prev) => [...prev, { personId: addPersonId, projectId: addProjectId }])
    setAddPersonId('')
    setAddProjectId('')
    setAddRowOpen(false)
  }

  const canAddRow = staff.length > 0 && projects.length > 0

  const addRowPanel = canAddRow ? (
    <>
      {!addRowOpen ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAddRowOpen(true)}
          className="gap-2"
        >
          <UserPlus className="h-4 w-4" />
          {t('allocations.addPersonToProject')}
        </Button>
      ) : (
        <div className="rounded-lg border bg-card">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              {t('allocations.addAllocationRow')}
            </div>
            <button
              onClick={() => { setAddRowOpen(false); setAddPersonId(''); setAddProjectId('') }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t('common.cancel')}
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t('common.person')}</label>
                <select
                  value={addPersonId}
                  onChange={(e) => setAddPersonId(e.target.value)}
                  className="flex w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">{t('allocations.selectPerson')}</option>
                  {staff.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name} (FTE {p.fte})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t('common.project')}</label>
                <select
                  value={addProjectId}
                  onChange={(e) => setAddProjectId(e.target.value)}
                  className="flex w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">{t('allocations.selectProject')}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.acronym} — {p.title}</option>
                  ))}
                </select>
              </div>
              <Button size="sm" onClick={handleAddRow} disabled={!addPersonId || !addProjectId} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                {t('common.add')}
              </Button>
            </div>

            {/* Workload preview — only shows when a person is selected */}
            {selectedPerson && selectedPersonLoad && (
              <div className="space-y-3 pt-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium">
                    {selectedPerson.full_name}
                    <span className="text-muted-foreground font-normal ml-1.5">FTE {selectedPerson.fte}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t('allocations.yearTotal')}: <span className="font-semibold text-foreground">{selectedPersonLoad.yearTotal.toFixed(1)} PM</span>
                  </span>
                </div>

                {/* Monthly capacity bars */}
                <div className="grid grid-cols-12 gap-1">
                  {selectedPersonLoad.months.map((m) => {
                    const pct = selectedPerson.fte > 0 ? Math.min(1, m.allocated / selectedPerson.fte) : 0
                    const absPct = selectedPerson.fte > 0 ? Math.min(1, m.absencePm / selectedPerson.fte) : 0
                    const isOver = m.allocated > m.capacity + 0.001
                    return (
                      <div key={m.month} className="text-center">
                        <div className="text-[10px] text-muted-foreground mb-1">{MONTHS[m.month - 1]}</div>
                        <div
                          className="h-8 rounded-sm bg-muted/60 relative overflow-hidden"
                          title={`Allocated: ${m.allocated.toFixed(2)} / Capacity: ${m.capacity.toFixed(2)} PM${m.absencePm > 0 ? ` (${(m.absencePm * 22).toFixed(0)}d absent)` : ''}`}
                        >
                          {/* Absence portion (from top) */}
                          {absPct > 0 && (
                            <div
                              className="absolute top-0 left-0 right-0 bg-orange-200/70"
                              style={{ height: `${Math.round(absPct * 100)}%` }}
                            />
                          )}
                          {/* Allocated portion (from bottom) */}
                          <div
                            className={cn(
                              'absolute bottom-0 left-0 right-0 transition-all',
                              isOver ? 'bg-red-400' : pct > 0.8 ? 'bg-amber-400' : 'bg-primary/60',
                            )}
                            style={{ height: `${Math.round(pct * 100)}%` }}
                          />
                        </div>
                        <div className={cn(
                          'text-[10px] mt-0.5 tabular-nums',
                          m.free <= 0 ? 'text-red-500 font-semibold' : m.free < 0.3 ? 'text-amber-600' : 'text-muted-foreground',
                        )}>
                          {m.free.toFixed(1)}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary/60" />{t('allocations.allocated')}</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-orange-200/70" />{t('allocations.absent')}</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-muted/60" />{t('allocations.free')}</span>
                  <span className="ml-auto">{t('allocations.freePmPerMonth')}</span>
                </div>

                {/* Current projects list */}
                {selectedPersonProjects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] text-muted-foreground mr-1 self-center">{t('allocations.currentlyOn')}:</span>
                    {selectedPersonProjects.map((p) => (
                      <span
                        key={p.acronym}
                        className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium"
                      >
                        {p.acronym}
                        <span className="text-muted-foreground ml-1">{p.total.toFixed(1)}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  ) : null

  if (rows.length === 0 && !canAddRow) {
    return (
      <EmptyState
        icon={Grid3x3}
        title={t('allocations.noAllocationsYet')}
        description={t('allocations.noAllocationsDesc')}
      />
    )
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-6 text-center space-y-3">
          <Grid3x3 className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="font-semibold">{t('allocations.noAllocationRows')}</h3>
          <p className="text-sm text-muted-foreground">{t('allocations.noAllocationRowsDesc')}</p>
        </div>
        {addRowPanel}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {timesheetDriven && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 px-4 py-3 flex items-start gap-3">
          <div className="text-blue-600 text-sm mt-0.5">ℹ️</div>
          <div>
            <div className="text-sm font-medium text-blue-900 dark:text-blue-200">{t('allocations.timesheetsDriveAllocations')}</div>
            <div className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
              {t('allocations.timesheetsDriveDesc')}
            </div>
          </div>
        </div>
      )}
      {!timesheetDriven && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo}>
            <Undo2 className="mr-1 h-4 w-4" /> {t('allocations.undo')}
          </Button>
          <Button variant="outline" size="sm" onClick={redo} disabled={!canRedo}>
            <Redo2 className="mr-1 h-4 w-4" /> {t('allocations.redo')}
          </Button>
          <div className="flex-1" />
          {dirty && (
            <Badge variant="secondary" className="text-xs">{t('allocations.unsavedChanges')}</Badge>
          )}
          <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      )}

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium sticky left-0 bg-muted/50 min-w-[140px]">{t('common.person')}</th>
              <th className="px-3 py-2 text-left font-medium min-w-[100px]">{t('common.project')}</th>
              {MONTHS.map((m, i) => (
                <th
                  key={m}
                  className={cn(
                    'px-2 py-2 text-center font-medium min-w-[60px]',
                    isLocked(i + 1) && 'bg-amber-50 text-amber-700',
                  )}
                >
                  {m}
                  {isLocked(i + 1) && <span className="block text-[10px]">🔒</span>}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium min-w-[60px]">{t('common.total')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              let rowTotal = 0
              const nextRow = rows[rowIdx + 1]
              const isLastRowForPerson = !nextRow || nextRow.person.id !== row.person.id
              return (<Fragment key={`${row.person.id}:${row.project.id}:${row.wpId}`}>
                <tr className={cn('border-b last:border-0 hover:bg-muted/20', isLastRowForPerson && 'border-b-0')}>
                  <td className="px-3 py-1 sticky left-0 bg-background font-medium text-xs max-w-[160px]">
                    <div className="flex items-center gap-1.5">
                      <PersonAvatar name={row.person.full_name} avatarUrl={row.person.avatar_url} size="xs" />
                      <span className="truncate">{row.person.full_name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-1 text-xs">
                    <span className="font-semibold text-primary">{row.project.acronym}</span>
                    {row.wpName && (
                      <span className="block text-[10px] text-muted-foreground truncate max-w-[100px]">{row.wpName}</span>
                    )}
                  </td>
                  {MONTHS.map((_, i) => {
                    const month = i + 1
                    const key = makeCellKey(row.person.id, row.project.id, row.wpId, month)
                    const value = cells[key] ?? 0
                    rowTotal += value
                    const locked = isLocked(month)
                    const personTotal = personMonthTotals[`${row.person.id}:${month}`] ?? 0
                    const absencePm = absencePmMap[`${row.person.id}:${month}`] ?? 0
                    const availableCapacity = Math.max(0, row.person.fte - absencePm)

                    return (
                      <td
                        key={month}
                        className={cn(
                          'px-0 py-0 text-center relative',
                          locked && 'bg-amber-50/50',
                          !locked && availableCapacity > 0 && heatmapBg(personTotal / availableCapacity),
                          !locked && availableCapacity === 0 && personTotal > 0 && 'bg-red-50 dark:bg-red-950/20',
                        )}
                        title={`${(availableCapacity > 0 ? (personTotal / availableCapacity * 100) : personTotal > 0 ? 999 : 0).toFixed(0)}% utilised — ${personTotal.toFixed(2)} / ${availableCapacity.toFixed(2)} PM${absencePm > 0 ? ` (${(absencePm * 22).toFixed(0)}d absent)` : ''}`}
                      >
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={value || ''}
                          placeholder="0"
                          disabled={locked || timesheetDriven}
                          onChange={(e) => {
                            const v = Math.min(1, Math.max(0, Number(e.target.value) || 0))
                            updateCell(row.person.id, row.project.id, row.wpId, month, v)
                          }}
                          onContextMenu={(e) => {
                            if (timesheetDriven) return
                            e.preventDefault()
                            setBulkFillTarget({ personId: row.person.id, projectId: row.project.id, wpId: row.wpId })
                            setBulkFillOpen(true)
                          }}
                          className={cn(
                            'w-full h-8 text-center text-xs tabular-nums bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-primary',
                            (locked || timesheetDriven) && 'opacity-50 cursor-not-allowed',
                            value > 0 && 'font-medium',
                          )}
                        />
                      </td>
                    )
                  })}
                  <td className="px-3 py-1 text-right tabular-nums text-xs font-semibold">
                    {rowTotal > 0 ? (
                      <div>
                        <span>{rowTotal.toFixed(2)} PM</span>
                        <span className="block text-[10px] text-muted-foreground font-normal">
                          {(() => {
                            let totalHours = 0
                            for (let m = 1; m <= 12; m++) {
                              const k = makeCellKey(row.person.id, row.project.id, row.wpId, m)
                              const pm = cells[k] ?? 0
                              if (pm > 0) totalHours += pmToHours(pm, getWorkingDaysInMonth(globalYear, m), hoursPerDay)
                            }
                            return `${totalHours.toFixed(0)}h`
                          })()}
                        </span>
                      </div>
                    ) : '—'}
                  </td>
                </tr>
                {isLastRowForPerson && (() => {
                  let personYearTotal = 0
                  const monthCells = MONTHS.map((_, i) => {
                    const month = i + 1
                    const pTotal = personMonthTotals[`${row.person.id}:${month}`] ?? 0
                    const absPm = absencePmMap[`${row.person.id}:${month}`] ?? 0
                    const cap = Math.max(0, row.person.fte - absPm)
                    const util = cap > 0 ? pTotal / cap : pTotal > 0 ? 2 : 0
                    personYearTotal += pTotal
                    return { month, pTotal, cap, util }
                  })
                  const yearCap = row.person.fte * 12
                  const yearUtil = yearCap > 0 ? personYearTotal / yearCap : 0
                  return (
                    <tr key={`summary:${row.person.id}`} className="border-b bg-muted/30">
                      <td className="px-3 py-0.5 sticky left-0 bg-muted/30" />
                      <td className="px-3 py-0.5 text-[10px] text-muted-foreground font-medium">{t('common.total')}</td>
                      {monthCells.map((mc) => (
                        <td
                          key={mc.month}
                          className={cn('px-1 py-0.5 text-center text-[10px] tabular-nums', heatmapText(mc.util))}
                          title={`${(mc.util * 100).toFixed(0)}% — ${mc.pTotal.toFixed(2)} / ${mc.cap.toFixed(2)} PM`}
                        >
                          {mc.pTotal > 0 ? mc.pTotal.toFixed(2) : ''}
                        </td>
                      ))}
                      <td className={cn('px-3 py-0.5 text-right text-[10px] tabular-nums font-semibold', heatmapText(yearUtil))}>
                        {personYearTotal > 0 ? `${personYearTotal.toFixed(2)}` : ''}
                      </td>
                    </tr>
                  )
                })()}
              </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {addRowPanel}

      <BulkFillDialog
        open={bulkFillOpen}
        onOpenChange={setBulkFillOpen}
        onApply={handleBulkFill}
      />
    </div>
  )
}
