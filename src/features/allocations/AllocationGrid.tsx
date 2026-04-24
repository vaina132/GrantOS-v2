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
import { Undo2, Redo2, Save, Grid3x3, Plus, UserPlus, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PersonAvatar } from '@/components/common/PersonAvatar'
import { useDraftKeeper } from '@/lib/draftKeeper'
import {
  DraftSavePill,
  DraftRestoreBanner,
} from '@/components/draft'
import { getWorkingDaysInMonth, hoursToPm } from '@/lib/pmUtils'
import { settingsService } from '@/services/settingsService'
import { timesheetService } from '@/services/timesheetService'
import { emailService } from '@/services/emailService'
import { BulkFillDialog } from './BulkFillDialog'
import { projectsService } from '@/services/projectsService'
import type { AssignmentType, Person, Project, WorkPackage } from '@/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const CURRENT_MONTH = new Date().getMonth() + 1
const CURRENT_YEAR = new Date().getFullYear()

/** Returns a heatmap background class based on utilisation % (allocated / capacity). */
function heatmapBg(utilisation: number): string {
  if (utilisation <= 0) return ''
  if (utilisation <= 0.25) return 'bg-emerald-50/60 dark:bg-emerald-950/15'
  if (utilisation <= 0.5) return 'bg-emerald-100/70 dark:bg-emerald-950/25'
  if (utilisation <= 0.75) return 'bg-yellow-50/80 dark:bg-yellow-950/25'
  if (utilisation <= 0.95) return 'bg-amber-100/80 dark:bg-amber-950/30'
  if (utilisation <= 1.0) return 'bg-orange-100/80 dark:bg-orange-950/30'
  return 'bg-red-100 dark:bg-red-950/40'
}

/** Returns a heatmap text color class for summary row utilisation values. */
function heatmapText(utilisation: number): string {
  if (utilisation <= 0) return 'text-muted-foreground/50'
  if (utilisation <= 0.5) return 'text-emerald-600 dark:text-emerald-400'
  if (utilisation <= 0.75) return 'text-yellow-600 dark:text-yellow-400'
  if (utilisation <= 0.95) return 'text-amber-600 dark:text-amber-400'
  if (utilisation <= 1.0) return 'text-orange-600 dark:text-orange-400 font-semibold'
  return 'text-red-600 dark:text-red-400 font-bold'
}

/** Returns a utilisation badge for the person header. */
function utilisationBadge(utilisation: number): { label: string; className: string } {
  if (utilisation <= 0) return { label: 'Unallocated', className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' }
  if (utilisation <= 0.5) return { label: `${(utilisation * 100).toFixed(0)}%`, className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' }
  if (utilisation <= 0.8) return { label: `${(utilisation * 100).toFixed(0)}%`, className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' }
  if (utilisation <= 1.0) return { label: `${(utilisation * 100).toFixed(0)}%`, className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' }
  return { label: `${(utilisation * 100).toFixed(0)}% ⚠`, className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' }
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

/**
 * Shape DraftKeeper persists for the grid. `cells` is the sparse map of
 * PM values keyed by person:project:wp:month; `manualRows` are rows the
 * user added for a (person, project) pair that has no server assignments
 * yet. UI-only state (collapsed persons, add-row panel open) is NOT in
 * the draft — restoring shouldn't fiddle with the user's current view.
 */
type AllocationDraft = {
  cells: Record<string, number>
  manualRows: Array<{ personId: string; projectId: string }>
}

export function AllocationGrid() {
  const { t } = useTranslation()
  const mode: AssignmentType = 'actual'
  const { orgId, user } = useAuthStore()
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
  const [baseline, setBaseline] = useState<AllocationDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [bulkFillOpen, setBulkFillOpen] = useState(false)
  const [bulkFillTarget, setBulkFillTarget] = useState<{ personId: string; projectId: string; wpId: string | null } | null>(null)
  const [manualRows, setManualRows] = useState<{ personId: string; projectId: string }[]>([])
  const [addPersonId, setAddPersonId] = useState('')
  const [addProjectId, setAddProjectId] = useState('')
  const [addRowOpen, setAddRowOpen] = useState(false)
  const [collapsedPersons, setCollapsedPersons] = useState<Set<string>>(new Set())

  const togglePerson = useCallback((personId: string) => {
    setCollapsedPersons(prev => {
      const next = new Set(prev)
      if (next.has(personId)) next.delete(personId)
      else next.add(personId)
      return next
    })
  }, [])

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
      setBaseline({ cells: map, manualRows: [] })
    } else {
      const map: Record<CellKey, number> = {}
      for (const a of assignments) {
        const key = makeCellKey(a.person_id, a.project_id, a.work_package_id, a.month)
        map[key] = a.pms
      }
      resetCells(map)
      setBaseline({ cells: map, manualRows: [] })
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

  // Group rows by person for the grouped UI
  const groupedByPerson = useMemo(() => {
    const groups: { person: Person; rows: GridRow[]; personId: string }[] = []
    const map = new Map<string, GridRow[]>()
    const order: string[] = []
    for (const row of rows) {
      if (!map.has(row.person.id)) {
        map.set(row.person.id, [])
        order.push(row.person.id)
      }
      map.get(row.person.id)!.push(row)
    }
    for (const pid of order) {
      const personRows = map.get(pid)!
      groups.push({ person: personRows[0].person, rows: personRows, personId: pid })
    }
    return groups
  }, [rows])

  // Combined draft value — the sparse cell map plus any manually-added
  // rows the user was building. Persisted as a single blob; with ~1,400
  // cells this is ~50KB stringified, well within localStorage limits,
  // and the 1.5 s debounce means we don't rewrite on every keystroke.
  const draftValue = useMemo<AllocationDraft>(
    () => ({ cells, manualRows }),
    [cells, manualRows],
  )

  const draft = useDraftKeeper<AllocationDraft>({
    key: {
      orgId: orgId ?? '_no-org',
      userId: user?.id ?? '_anon',
      formKey: 'allocation-grid',
      recordId: String(globalYear),
    },
    value: draftValue,
    setValue: (next) => {
      resetCells(next.cells)
      setManualRows(next.manualRows)
    },
    // Skip DraftKeeper in timesheet-driven mode — cells are computed
    // read-only from server data; nothing for the user to lose.
    enabled: !isLoading && !timesheetDriven,
    schemaVersion: 1,
    baseline,
    silentRestoreWindowMs: 0,
  })

  const updateCell = useCallback(
    (personId: string, projectId: string, wpId: string | null, month: number, value: number) => {
      const key = makeCellKey(personId, projectId, wpId, month)
      setCells({ ...cells, [key]: value })
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
      // Promote current state to baseline; DraftKeeper will see value ===
      // baseline on the next tick and clear the local draft. Manual rows
      // are emptied because their (person, project) pairs now resolve via
      // server assignments.
      setBaseline({ cells: { ...cells }, manualRows: [] })
      setManualRows([])
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

  const isCurrentYear = globalYear === CURRENT_YEAR

  return (
    <div className="space-y-3">
      {/* Draft recovery — only appears when an unsaved edit was stashed on
          a previous visit. Timesheet-driven mode disables DraftKeeper, so
          this never surfaces there. */}
      {draft.hasDraft && (
        <DraftRestoreBanner
          ageMs={draft.draftAge}
          onRestore={draft.restore}
          onDiscard={draft.discard}
        />
      )}

      {/* Toolbar */}
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
          <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo} className="h-8">
            <Undo2 className="mr-1 h-3.5 w-3.5" /> {t('allocations.undo')}
          </Button>
          <Button variant="outline" size="sm" onClick={redo} disabled={!canRedo} className="h-8">
            <Redo2 className="mr-1 h-3.5 w-3.5" /> {t('allocations.redo')}
          </Button>
          <div className="flex-1" />
          <DraftSavePill status={draft.status} lastSavedAt={draft.lastSavedAt} className="mr-1" />
          {draft.isDirty && (
            <Badge variant="secondary" className="text-xs animate-pulse">{t('allocations.unsavedChanges')}</Badge>
          )}
          <Button size="sm" onClick={handleSave} disabled={!draft.isDirty || saving} className="h-8">
            <Save className="mr-1 h-3.5 w-3.5" />
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      )}

      {/* Grid */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse" style={{ minWidth: '900px' }}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-muted/70 dark:bg-muted/40 border-b">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sticky left-0 z-30 bg-muted/70 dark:bg-muted/40 min-w-[220px] w-[220px]">
                  {t('common.project')}
                </th>
                {MONTHS.map((m, i) => {
                  const month = i + 1
                  const locked = isLocked(month)
                  const isCurrent = isCurrentYear && month === CURRENT_MONTH
                  return (
                    <th
                      key={m}
                      className={cn(
                        'px-1 py-2.5 text-center text-xs font-semibold uppercase tracking-wider w-[62px] min-w-[62px]',
                        locked && 'text-amber-600 dark:text-amber-400',
                        isCurrent && !locked && 'text-primary',
                        !isCurrent && !locked && 'text-muted-foreground',
                      )}
                    >
                      <span className="flex items-center justify-center gap-0.5">
                        {m}
                        {locked && <span className="text-[9px]">🔒</span>}
                      </span>
                      {isCurrent && <div className="h-0.5 mt-1 mx-auto w-4 rounded-full bg-primary" />}
                    </th>
                  )
                })}
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground min-w-[72px]">
                  {t('common.total')}
                </th>
              </tr>
            </thead>
            <tbody>
              {groupedByPerson.map((group) => {
                const collapsed = collapsedPersons.has(group.personId)
                const projectCount = group.rows.length

                // Compute person year totals for the header
                let personYearTotal = 0
                const monthTotals = MONTHS.map((_, i) => {
                  const month = i + 1
                  const pTotal = personMonthTotals[`${group.personId}:${month}`] ?? 0
                  const absPm = absencePmMap[`${group.personId}:${month}`] ?? 0
                  const cap = Math.max(0, group.person.fte - absPm)
                  const util = cap > 0 ? pTotal / cap : pTotal > 0 ? 2 : 0
                  personYearTotal += pTotal
                  return { month, pTotal, cap, util }
                })
                const yearCap = group.person.fte * 12
                const yearUtil = yearCap > 0 ? personYearTotal / yearCap : 0
                const badge = utilisationBadge(yearUtil)

                return (
                  <Fragment key={group.personId}>
                    {/* Person group header */}
                    <tr
                      className="border-b bg-slate-50/80 dark:bg-slate-900/30 cursor-pointer select-none group/person hover:bg-slate-100/80 dark:hover:bg-slate-800/30 transition-colors"
                      onClick={() => togglePerson(group.personId)}
                    >
                      <td className="px-3 py-2 sticky left-0 z-10 bg-slate-50/80 dark:bg-slate-900/30 group-hover/person:bg-slate-100/80 dark:group-hover/person:bg-slate-800/30 transition-colors">
                        <div className="flex items-center gap-2">
                          {collapsed
                            ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          }
                          <PersonAvatar name={group.person.full_name} avatarUrl={group.person.avatar_url} size="xs" />
                          <div className="min-w-0">
                            <span className="font-semibold text-sm truncate block">{group.person.full_name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              FTE {group.person.fte} · {projectCount} {projectCount === 1 ? 'project' : 'projects'}
                            </span>
                          </div>
                          <span className={cn('ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0', badge.className)}>
                            {badge.label}
                          </span>
                        </div>
                      </td>
                      {/* Summary month cells in person header */}
                      {monthTotals.map((mc) => {
                        const isCurrent = isCurrentYear && mc.month === CURRENT_MONTH
                        return (
                          <td
                            key={mc.month}
                            className={cn(
                              'px-1 py-2 text-center tabular-nums text-xs',
                              isCurrent && 'bg-primary/[0.04]',
                              heatmapText(mc.util),
                            )}
                            title={`${(mc.util * 100).toFixed(0)}% — ${mc.pTotal.toFixed(2)} / ${mc.cap.toFixed(2)} PM`}
                          >
                            {mc.pTotal > 0 ? mc.pTotal.toFixed(2) : ''}
                          </td>
                        )
                      })}
                      <td className={cn('px-3 py-2 text-right tabular-nums text-xs font-bold', heatmapText(yearUtil))}>
                        {personYearTotal > 0 ? `${personYearTotal.toFixed(2)}` : ''}
                      </td>
                    </tr>

                    {/* Project rows (hidden when collapsed) */}
                    {!collapsed && group.rows.map((row) => {
                      let rowTotal = 0
                      return (
                        <tr
                          key={`${row.person.id}:${row.project.id}:${row.wpId}`}
                          className="border-b border-dashed border-muted/60 last:border-b-0 hover:bg-muted/10 transition-colors"
                        >
                          <td className="py-0.5 sticky left-0 z-10 bg-card">
                            <div className="flex items-center pl-10 pr-3">
                              <span className="font-medium text-xs text-primary">{row.project.acronym}</span>
                              {row.wpName && (
                                <span className="ml-1.5 text-[10px] text-muted-foreground truncate max-w-[90px]">/ {row.wpName}</span>
                              )}
                            </div>
                          </td>
                          {MONTHS.map((_, i) => {
                            const month = i + 1
                            const key = makeCellKey(row.person.id, row.project.id, row.wpId, month)
                            const value = cells[key] ?? 0
                            rowTotal += value
                            const locked = isLocked(month)
                            const isCurrent = isCurrentYear && month === CURRENT_MONTH
                            const personTotal = personMonthTotals[`${row.person.id}:${month}`] ?? 0
                            const absencePm = absencePmMap[`${row.person.id}:${month}`] ?? 0
                            const availableCapacity = Math.max(0, row.person.fte - absencePm)

                            return (
                              <td
                                key={month}
                                className={cn(
                                  'px-0 py-0 text-center relative',
                                  locked && 'bg-amber-50/40 dark:bg-amber-950/10',
                                  isCurrent && !locked && 'bg-primary/[0.03]',
                                  !locked && !isCurrent && availableCapacity > 0 && heatmapBg(personTotal / availableCapacity),
                                  !locked && availableCapacity === 0 && personTotal > 0 && 'bg-red-50 dark:bg-red-950/20',
                                )}
                                title={`${row.project.acronym} · ${MONTHS[i]} — ${value.toFixed(2)} PM\n${(availableCapacity > 0 ? (personTotal / availableCapacity * 100) : personTotal > 0 ? 999 : 0).toFixed(0)}% person utilisation`}
                              >
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="1"
                                  value={value || ''}
                                  placeholder=""
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
                                    'w-full h-8 text-center text-xs tabular-nums bg-transparent border-0 outline-none',
                                    'focus:ring-2 focus:ring-primary/40 focus:bg-white dark:focus:bg-slate-900 rounded-sm transition-shadow',
                                    (locked || timesheetDriven) && 'opacity-40 cursor-not-allowed',
                                    value > 0 && 'font-semibold text-foreground',
                                    !value && 'text-muted-foreground/30',
                                  )}
                                />
                              </td>
                            )
                          })}
                          <td className="px-3 py-0.5 text-right tabular-nums text-xs">
                            {rowTotal > 0 ? (
                              <div>
                                <span className="font-semibold">{rowTotal.toFixed(2)}</span>
                                <span className="text-[10px] text-muted-foreground font-normal ml-0.5">PM</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Heatmap legend */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground px-1 flex-wrap">
        <span className="font-medium text-foreground mr-1">Utilisation:</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-emerald-100" />0–50%</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-yellow-100" />50–75%</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-amber-100" />75–95%</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-orange-100" />95–100%</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-red-100" />&gt;100%</span>
        <span className="ml-auto text-muted-foreground/60">Right-click cell to bulk fill</span>
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
