import { useState, useEffect, useMemo, useCallback } from 'react'
import { allocationsService } from '@/services/allocationsService'
import type { AllocationCell } from '@/services/allocationsService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useStaff } from '@/hooks/useStaff'
import { useProjects } from '@/hooks/useProjects'
import { useAssignments, usePeriodLocks } from '@/hooks/useAllocations'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import { Undo2, Redo2, Save, Grid3x3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BulkFillDialog } from './BulkFillDialog'
import type { AssignmentType, Person, Project } from '@/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type CellKey = string // "personId:projectId:wpId:month"

function makeCellKey(personId: string, projectId: string, wpId: string | null, month: number): CellKey {
  return `${personId}:${projectId}:${wpId ?? 'null'}:${month}`
}

interface GridRow {
  person: Person
  project: Project
  wpId: string | null
}

interface AllocationGridProps {
  mode: AssignmentType
  compareMode?: boolean
}

export function AllocationGrid({ mode, compareMode }: AllocationGridProps) {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()
  const { staff, isLoading: loadingStaff } = useStaff({ is_active: true })
  const { projects, isLoading: loadingProjects } = useProjects()
  const { assignments: actualAssignments, isLoading: loadingActual, refetch: refetchActual } = useAssignments('actual')
  const { assignments: officialAssignments, isLoading: loadingOfficial, refetch: refetchOfficial } = useAssignments('official')
  const { isLocked } = usePeriodLocks()

  const assignments = mode === 'actual' ? actualAssignments : officialAssignments
  const isLoading = loadingStaff || loadingProjects || loadingActual || (compareMode ? loadingOfficial : false)

  // Local editable state with undo/redo
  const { state: cells, set: setCells, undo, redo, reset: resetCells, canUndo, canRedo } = useUndoRedo<Record<CellKey, number>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bulkFillOpen, setBulkFillOpen] = useState(false)
  const [bulkFillTarget, setBulkFillTarget] = useState<{ personId: string; projectId: string; wpId: string | null } | null>(null)
  const [manualRows, setManualRows] = useState<{ personId: string; projectId: string }[]>([])
  const [addPersonId, setAddPersonId] = useState('')
  const [addProjectId, setAddProjectId] = useState('')

  // Build cell map from loaded assignments
  useEffect(() => {
    const map: Record<CellKey, number> = {}
    for (const a of assignments) {
      const key = makeCellKey(a.person_id, a.project_id, a.work_package_id, a.month)
      map[key] = a.pms
    }
    resetCells(map)
    setDirty(false)
  }, [assignments, resetCells])

  // Build compare map for compare mode
  const compareCells = useMemo(() => {
    if (!compareMode) return {}
    const other = mode === 'actual' ? officialAssignments : actualAssignments
    const map: Record<CellKey, number> = {}
    for (const a of other) {
      const key = makeCellKey(a.person_id, a.project_id, a.work_package_id, a.month)
      map[key] = a.pms
    }
    return map
  }, [compareMode, mode, officialAssignments, actualAssignments])

  // Build grid rows: one row per person-project combination
  const rows = useMemo(() => {
    const result: GridRow[] = []
    const personIds = new Set(assignments.map((a) => a.person_id))
    const projectIds = new Set(assignments.map((a) => a.project_id))

    // Include all active staff and projects (even with no assignments)
    for (const person of staff) personIds.add(person.id)
    for (const project of projects) projectIds.add(project.id)

    const personMap = new Map(staff.map((p) => [p.id, p]))
    const projectMap = new Map(projects.map((p) => [p.id, p]))

    // Build a set of visible person+project pairs
    const visiblePairs = new Set<string>()

    // Rows from existing assignment data
    for (const a of assignments) {
      const pairKey = `${a.person_id}:${a.project_id}`
      if (!visiblePairs.has(pairKey)) {
        const person = personMap.get(a.person_id)
        const project = projectMap.get(a.project_id)
        if (person && project) {
          result.push({ person, project, wpId: null })
          visiblePairs.add(pairKey)
        }
      }
    }

    // Manually added rows
    for (const mr of manualRows) {
      const pairKey = `${mr.personId}:${mr.projectId}`
      if (!visiblePairs.has(pairKey)) {
        const person = personMap.get(mr.personId)
        const project = projectMap.get(mr.projectId)
        if (person && project) {
          result.push({ person, project, wpId: null })
          visiblePairs.add(pairKey)
        }
      }
    }

    result.sort((a, b) => {
      const nameCmp = a.person.full_name.localeCompare(b.person.full_name)
      if (nameCmp !== 0) return nameCmp
      return a.project.acronym.localeCompare(b.project.acronym)
    })

    return result
  }, [staff, projects, assignments, manualRows])

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

  const handleSave = async () => {
    if (!orgId) return
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
      await allocationsService.bulkUpsertAssignments(upserts)
      toast({ title: 'Saved', description: 'Allocations have been saved.' })
      setDirty(false)
      if (mode === 'actual') refetchActual()
      else refetchOfficial()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      toast({ title: 'Error', description: message, variant: 'destructive' })
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
    const exists = rows.some((r) => r.person.id === addPersonId && r.project.id === addProjectId)
    if (exists) {
      toast({ title: 'Already exists', description: 'This person-project combination is already in the grid.' })
      return
    }
    setManualRows((prev) => [...prev, { personId: addPersonId, projectId: addProjectId }])
    setAddPersonId('')
    setAddProjectId('')
  }

  const addRowUI = staff.length > 0 && projects.length > 0 ? (
    <div className="flex items-end gap-2 flex-wrap">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Person</label>
        <select
          value={addPersonId}
          onChange={(e) => setAddPersonId(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Select person...</option>
          {staff.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Project</label>
        <select
          value={addProjectId}
          onChange={(e) => setAddProjectId(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Select project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.acronym} — {p.title}</option>
          ))}
        </select>
      </div>
      <Button size="sm" variant="outline" onClick={handleAddRow} disabled={!addPersonId || !addProjectId}>
        + Add Row
      </Button>
    </div>
  ) : null

  if (rows.length === 0 && !addRowUI) {
    return (
      <EmptyState
        icon={Grid3x3}
        title="No allocations yet"
        description="Add staff and projects first, then create assignments here."
      />
    )
  }

  if (rows.length === 0 && addRowUI) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-6 text-center space-y-4">
          <Grid3x3 className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="font-semibold">No allocation rows yet</h3>
          <p className="text-sm text-muted-foreground">Select a person and project to start entering person-month allocations.</p>
        </div>
        {addRowUI}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo}>
          <Undo2 className="mr-1 h-4 w-4" /> Undo
        </Button>
        <Button variant="outline" size="sm" onClick={redo} disabled={!canRedo}>
          <Redo2 className="mr-1 h-4 w-4" /> Redo
        </Button>
        <div className="flex-1" />
        {dirty && (
          <Badge variant="secondary" className="text-xs">Unsaved changes</Badge>
        )}
        <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
          <Save className="mr-1 h-4 w-4" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium sticky left-0 bg-muted/50 min-w-[140px]">Person</th>
              <th className="px-3 py-2 text-left font-medium min-w-[100px]">Project</th>
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
              <th className="px-3 py-2 text-right font-medium min-w-[60px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              let rowTotal = 0
              return (
                <tr key={`${row.person.id}:${row.project.id}:${row.wpId}`} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-1 sticky left-0 bg-background font-medium text-xs truncate max-w-[140px]">
                    {row.person.full_name}
                  </td>
                  <td className="px-3 py-1 text-xs">
                    <span className="font-semibold text-primary">{row.project.acronym}</span>
                  </td>
                  {MONTHS.map((_, i) => {
                    const month = i + 1
                    const key = makeCellKey(row.person.id, row.project.id, row.wpId, month)
                    const value = cells[key] ?? 0
                    rowTotal += value
                    const locked = isLocked(month)
                    const compareValue = compareMode ? (compareCells[key] ?? 0) : null
                    const diff = compareValue !== null ? value - compareValue : null
                    const personTotal = personMonthTotals[`${row.person.id}:${month}`] ?? 0
                    const overAllocated = personTotal > row.person.fte

                    return (
                      <td
                        key={month}
                        className={cn(
                          'px-0 py-0 text-center relative',
                          locked && 'bg-amber-50/50',
                          overAllocated && 'bg-red-50',
                        )}
                      >
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={value || ''}
                          placeholder="0"
                          disabled={locked}
                          onChange={(e) => {
                            const v = Math.min(1, Math.max(0, Number(e.target.value) || 0))
                            updateCell(row.person.id, row.project.id, row.wpId, month, v)
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            setBulkFillTarget({ personId: row.person.id, projectId: row.project.id, wpId: row.wpId })
                            setBulkFillOpen(true)
                          }}
                          className={cn(
                            'w-full h-8 text-center text-xs tabular-nums bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-primary',
                            locked && 'opacity-50 cursor-not-allowed',
                            value > 0 && 'font-medium',
                          )}
                        />
                        {diff !== null && diff !== 0 && (
                          <span
                            className={cn(
                              'absolute bottom-0 right-0.5 text-[9px] leading-none',
                              diff > 0 ? 'text-green-600' : 'text-red-600',
                            )}
                          >
                            {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                          </span>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-3 py-1 text-right tabular-nums text-xs font-semibold">
                    {rowTotal > 0 ? rowTotal.toFixed(2) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {addRowUI}

      <BulkFillDialog
        open={bulkFillOpen}
        onOpenChange={setBulkFillOpen}
        onApply={handleBulkFill}
      />
    </div>
  )
}
