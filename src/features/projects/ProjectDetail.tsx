import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useProject, useWorkPackages } from '@/hooks/useProjects'
import { projectsService } from '@/services/projectsService'
import { allocationsService } from '@/services/allocationsService'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { ArrowLeft, Pencil, Plus, Trash2, Save } from 'lucide-react'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { DocumentList } from '@/features/documents/DocumentList'
import type { WorkPackage, PmBudget, Assignment } from '@/types'

type DetailTab = 'overview' | 'budget' | 'workpackages' | 'documents'

export function ProjectDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { project, isLoading } = useProject(id)
  const { workPackages, isLoading: loadingWPs, refetch: refetchWPs } = useWorkPackages(id)
  const { orgId, can } = useAuthStore()
  const [detailTab, setDetailTab] = useState<DetailTab>('overview')

  const [wpNumber, setWpNumber] = useState<number>(1)
  const [wpName, setWpName] = useState('')
  const [wpDesc, setWpDesc] = useState('')
  const [wpStartMonth, setWpStartMonth] = useState<number>(1)
  const [wpEndMonth, setWpEndMonth] = useState<number>(1)
  const [wpSaving, setWpSaving] = useState(false)
  const [wpDeleteTarget, setWpDeleteTarget] = useState<WorkPackage | null>(null)
  const [wpDeleting, setWpDeleting] = useState(false)
  const [editingWpId, setEditingWpId] = useState<string | null>(null)
  const [editWpNumber, setEditWpNumber] = useState<number>(1)
  const [editWpName, setEditWpName] = useState('')
  const [editWpDesc, setEditWpDesc] = useState('')
  const [editWpStartMonth, setEditWpStartMonth] = useState<number>(1)
  const [editWpEndMonth, setEditWpEndMonth] = useState<number>(1)
  const [editWpSaving, setEditWpSaving] = useState(false)

  // PM budget per year (project-level)
  const [, setPmBudgets] = useState<PmBudget[]>([])
  const [pmBudgetValues, setPmBudgetValues] = useState<Record<number, number>>({})
  const [pmBudgetSaving, setPmBudgetSaving] = useState(false)
  const [pmBudgetDirty, setPmBudgetDirty] = useState(false)

  const projectYears = useMemo(() => {
    if (!project) return []
    const startYear = new Date(project.start_date).getFullYear()
    const endYear = new Date(project.end_date).getFullYear()
    const years: number[] = []
    for (let y = startYear; y <= endYear; y++) years.push(y)
    return years
  }, [project])

  // Project duration in months and helper to convert project month → actual date
  const projectMonthCount = useMemo(() => {
    if (!project) return 0
    const s = new Date(project.start_date)
    const e = new Date(project.end_date)
    return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1
  }, [project])

  const projectMonthToDate = useCallback((m: number, isEnd: boolean): string => {
    if (!project) return ''
    const s = new Date(project.start_date)
    const targetMonth = s.getMonth() + (m - 1)
    const y = s.getFullYear() + Math.floor(targetMonth / 12)
    const mo = targetMonth % 12
    if (isEnd) {
      // last day of month
      const last = new Date(y, mo + 1, 0)
      return last.toISOString().slice(0, 10)
    }
    // first day of month
    return `${y}-${String(mo + 1).padStart(2, '0')}-01`
  }, [project])

  const projectMonthLabel = useCallback((m: number): string => {
    if (!project) return `M${m}`
    const s = new Date(project.start_date)
    const targetMonth = s.getMonth() + (m - 1)
    const y = s.getFullYear() + Math.floor(targetMonth / 12)
    const mo = targetMonth % 12
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `M${m} (${MONTHS[mo]} ${y})`
  }, [project])

  // WP PM budgets: wpId -> target PMs (total across years)
  const [wpPmBudgets, setWpPmBudgets] = useState<Record<string, number>>({})
  const [wpPmBudgetDirty, setWpPmBudgetDirty] = useState(false)
  const [wpPmBudgetSaving, setWpPmBudgetSaving] = useState(false)

  // Allocations for this project (to show allocated vs budget)
  const [projectAllocations, setProjectAllocations] = useState<Assignment[]>([])

  const loadPmBudgets = useCallback(async () => {
    if (!id) return
    try {
      const data = await allocationsService.listPmBudgetsByProject(id, 'actual')
      setPmBudgets(data)
      const map: Record<number, number> = {}
      const wpMap: Record<string, number> = {}
      for (const b of data) {
        if (!b.work_package_id) {
          map[b.year] = b.target_pms
        } else {
          wpMap[b.work_package_id] = (wpMap[b.work_package_id] ?? 0) + b.target_pms
        }
      }
      setPmBudgetValues(map)
      setWpPmBudgets(wpMap)
      setPmBudgetDirty(false)
      setWpPmBudgetDirty(false)
    } catch { /* ignore */ }
  }, [id])

  useEffect(() => {
    loadPmBudgets()
  }, [loadPmBudgets])

  const handleSavePmBudgets = async () => {
    if (!id || !orgId) return
    setPmBudgetSaving(true)
    try {
      for (const year of projectYears) {
        const pms = pmBudgetValues[year] ?? 0
        await allocationsService.upsertPmBudget({
          org_id: orgId,
          project_id: id,
          work_package_id: null,
          year,
          target_pms: pms,
          type: 'actual',
        })
      }
      toast({ title: 'Saved', description: 'PM budgets updated.' })
      setPmBudgetDirty(false)
      loadPmBudgets()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save PM budgets'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setPmBudgetSaving(false)
    }
  }

  // Load allocations for this project (all years)
  const loadAllocations = useCallback(async () => {
    if (!id) return
    try {
      const allAllocs: Assignment[] = []
      for (const y of projectYears) {
        const data = await allocationsService.listAssignmentsByProject(id, y, 'actual')
        allAllocs.push(...data)
      }
      setProjectAllocations(allAllocs)
    } catch { /* ignore */ }
  }, [id, projectYears])

  useEffect(() => {
    if (projectYears.length > 0) loadAllocations()
  }, [loadAllocations, projectYears])

  // WP allocated PMs (from assignments)
  const wpAllocatedPms = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of projectAllocations) {
      const wpKey = a.work_package_id ?? '__project__'
      map[wpKey] = (map[wpKey] ?? 0) + a.pms
    }
    return map
  }, [projectAllocations])

  // Project-level totals
  const totalProjectBudgetPm = useMemo(() => Object.values(pmBudgetValues).reduce((a, b) => a + b, 0), [pmBudgetValues])
  const totalWpBudgetPm = useMemo(() => Object.values(wpPmBudgets).reduce((a, b) => a + b, 0), [wpPmBudgets])
  const totalAllocatedPm = useMemo(() => projectAllocations.reduce((a, b) => a + b.pms, 0), [projectAllocations])

  const handleSaveWpPmBudgets = async () => {
    if (!id || !orgId) return
    setWpPmBudgetSaving(true)
    try {
      for (const wp of workPackages) {
        const pms = wpPmBudgets[wp.id] ?? 0
        await allocationsService.upsertPmBudget({
          org_id: orgId,
          project_id: id,
          work_package_id: wp.id,
          year: projectYears[0] ?? new Date().getFullYear(),
          target_pms: pms,
          type: 'actual',
        })
      }
      toast({ title: 'Saved', description: 'WP PM budgets updated.' })
      setWpPmBudgetDirty(false)
      loadPmBudgets()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save WP budgets'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setWpPmBudgetSaving(false)
    }
  }

  const handleAddWP = async () => {
    if (!wpName.trim() || !id) return
    setWpSaving(true)
    try {
      await projectsService.createWorkPackage({
        org_id: orgId ?? '',
        project_id: id,
        number: wpNumber,
        name: wpName.trim(),
        description: wpDesc.trim() || null,
        lead_person_id: null,
        start_month: wpStartMonth,
        end_month: wpEndMonth,
        start_date: projectMonthToDate(wpStartMonth, false),
        end_date: projectMonthToDate(wpEndMonth, true),
      })
      setWpNumber(wpNumber + 1)
      setWpName('')
      setWpDesc('')
      setWpStartMonth(1)
      setWpEndMonth(projectMonthCount || 1)
      toast({ title: 'Work package added' })
      refetchWPs()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add work package'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setWpSaving(false)
    }
  }

  const handleDeleteWP = async () => {
    if (!wpDeleteTarget) return
    setWpDeleting(true)
    try {
      await projectsService.removeWorkPackage(wpDeleteTarget.id)
      toast({ title: 'Work package deleted' })
      setWpDeleteTarget(null)
      refetchWPs()
      loadPmBudgets()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setWpDeleting(false)
    }
  }

  const startEditWp = (wp: WorkPackage) => {
    setEditingWpId(wp.id)
    setEditWpNumber(wp.number ?? 1)
    setEditWpName(wp.name)
    setEditWpDesc(wp.description ?? '')
    setEditWpStartMonth(wp.start_month ?? 1)
    setEditWpEndMonth(wp.end_month ?? (projectMonthCount || 1))
  }

  const handleSaveEditWp = async () => {
    if (!editingWpId || !editWpName.trim()) return
    setEditWpSaving(true)
    try {
      await projectsService.updateWorkPackage(editingWpId, {
        number: editWpNumber,
        name: editWpName.trim(),
        description: editWpDesc.trim() || null,
        start_month: editWpStartMonth,
        end_month: editWpEndMonth,
        start_date: projectMonthToDate(editWpStartMonth, false),
        end_date: projectMonthToDate(editWpEndMonth, true),
      })
      toast({ title: 'Updated', description: 'Work package updated.' })
      setEditingWpId(null)
      refetchWPs()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setEditWpSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <PageHeader title="Project Not Found" />
        <Button variant="outline" onClick={() => navigate('/projects')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
        </Button>
      </div>
    )
  }

  const detailTabs: { key: DetailTab; label: string; show: boolean }[] = [
    { key: 'overview', label: 'Overview', show: true },
    { key: 'budget', label: 'Budget', show: true },
    { key: 'workpackages', label: 'Work Packages', show: true },
    { key: 'documents', label: 'Documents', show: true },
  ]

  return (
    <div className="space-y-0">
      <PageHeader
        title={project.acronym}
        description={project.title}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/projects')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            {can('canManageProjects') && (
              <Button onClick={() => navigate(`/projects/${project.id}/edit`)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
            )}
          </div>
        }
      />

      <div className="border-b mt-4">
        <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Tabs">
          {detailTabs.filter((t) => t.show).map((t) => {
            const active = detailTab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setDetailTab(t.key)}
                className={cn(
                  'whitespace-nowrap pb-3 pt-1 text-sm font-medium border-b-2 transition-colors',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30',
                )}
              >
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="pt-5 animate-fade-in" key={detailTab}>
        {/* Overview Tab */}
        {detailTab === 'overview' && (
          <Card>
            <CardHeader><CardTitle>Project Details</CardTitle></CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm text-muted-foreground">Grant Number</dt>
                  <dd className="text-sm font-medium">{project.grant_number ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-muted-foreground">Funding Scheme</dt>
                  <dd className="text-sm font-medium">{project.funding_schemes?.name ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-muted-foreground">Status</dt>
                  <dd><StatusBadge status={project.status} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-muted-foreground">Period</dt>
                  <dd className="text-sm font-medium">
                    {formatDate(project.start_date)} – {formatDate(project.end_date)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-muted-foreground">Work Packages</dt>
                  <dd>
                    <Badge variant={project.has_wps ? 'default' : 'secondary'}>
                      {project.has_wps ? 'Yes' : 'No'}
                    </Badge>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-muted-foreground">Led by Our Organisation</dt>
                  <dd>
                    <Badge variant={project.is_lead_organisation ? 'default' : 'secondary'}>
                      {project.is_lead_organisation ? 'Yes' : 'No'}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Budget Tab */}
        {detailTab === 'budget' && (
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Budget Breakdown</CardTitle></CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Total Budget</dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {project.total_budget != null ? formatCurrency(project.total_budget) : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Personnel</dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {project.budget_personnel != null ? formatCurrency(project.budget_personnel) : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Travel</dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {project.budget_travel != null ? formatCurrency(project.budget_travel) : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Subcontracting</dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {project.budget_subcontracting != null ? formatCurrency(project.budget_subcontracting) : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Other</dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {project.budget_other != null ? formatCurrency(project.budget_other) : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Overhead Rate</dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {project.overhead_rate != null ? `${project.overhead_rate}%` : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Our PM Rate</dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {project.our_pm_rate != null ? formatCurrency(project.our_pm_rate) : '—'}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {projectYears.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Person-Months per Year</CardTitle>
                    {can('canManageProjects') && pmBudgetDirty && (
                      <Button size="sm" onClick={handleSavePmBudgets} disabled={pmBudgetSaving}>
                        <Save className="mr-1 h-4 w-4" />
                        {pmBudgetSaving ? 'Saving...' : 'Save'}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(projectYears.length, 6)}, 1fr)` }}>
                    {projectYears.map((year) => (
                      <div key={year} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{year}</Label>
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          value={pmBudgetValues[year] ?? ''}
                          placeholder="0"
                          onChange={(e) => {
                            setPmBudgetValues((prev) => ({ ...prev, [year]: Number(e.target.value) || 0 }))
                            setPmBudgetDirty(true)
                          }}
                          disabled={!can('canManageProjects')}
                          className="tabular-nums"
                        />
                      </div>
                    ))}
                  </div>
                  {projectYears.length > 0 && (
                    <div className="mt-3 text-sm text-muted-foreground">
                      Total: <span className="font-semibold text-foreground">{Object.values(pmBudgetValues).reduce((a, b) => a + b, 0).toFixed(1)} PM</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Work Packages Tab */}
        {detailTab === 'workpackages' && (
          <div className="space-y-6">
            {/* Summary card: project PM budget vs WP allocation vs allocated */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border bg-card p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Project Budget</div>
                <div className="text-xl font-bold tabular-nums mt-0.5">{totalProjectBudgetPm.toFixed(1)} PM</div>
                <div className="text-[11px] text-muted-foreground">Total across all years</div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Assigned to WPs</div>
                <div className={cn('text-xl font-bold tabular-nums mt-0.5', totalWpBudgetPm > totalProjectBudgetPm + 0.01 ? 'text-red-500' : 'text-foreground')}>
                  {totalWpBudgetPm.toFixed(1)} PM
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {totalProjectBudgetPm > 0 ? `${Math.round((totalWpBudgetPm / totalProjectBudgetPm) * 100)}%` : '—'} of budget
                </div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Allocated</div>
                <div className={cn('text-xl font-bold tabular-nums mt-0.5', totalAllocatedPm > totalProjectBudgetPm + 0.01 ? 'text-amber-500' : 'text-primary')}>
                  {totalAllocatedPm.toFixed(1)} PM
                </div>
                <div className="text-[11px] text-muted-foreground">People allocated to project</div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Remaining</div>
                <div className={cn('text-xl font-bold tabular-nums mt-0.5', (totalProjectBudgetPm - totalAllocatedPm) < 0 ? 'text-red-500' : 'text-emerald-500')}>
                  {(totalProjectBudgetPm - totalAllocatedPm).toFixed(1)} PM
                </div>
                <div className="text-[11px] text-muted-foreground">Budget minus allocated</div>
              </div>
            </div>

            {/* WP list with PM budgets */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Work Packages</CardTitle>
                  {can('canManageProjects') && wpPmBudgetDirty && (
                    <Button size="sm" onClick={handleSaveWpPmBudgets} disabled={wpPmBudgetSaving}>
                      <Save className="mr-1 h-4 w-4" />
                      {wpPmBudgetSaving ? 'Saving...' : 'Save PM Budgets'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingWPs ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : (
                  <>
                    {workPackages.length > 0 && (
                      <div className="rounded-lg border mb-4 overflow-x-auto">
                        <table className="w-full text-sm min-w-[700px]">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="px-4 py-2 text-left font-medium w-12">#</th>
                              <th className="px-4 py-2 text-left font-medium">Name</th>
                              <th className="px-4 py-2 text-left font-medium">Period</th>
                              <th className="px-4 py-2 text-right font-medium">Budget PM</th>
                              <th className="px-4 py-2 text-right font-medium">Allocated</th>
                              <th className="px-4 py-2 text-right font-medium">Remaining</th>
                              {can('canManageProjects') && (
                                <th className="px-4 py-2 text-right font-medium">Actions</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {workPackages.map((wp) => {
                              const wpBudget = wpPmBudgets[wp.id] ?? 0
                              const wpAlloc = wpAllocatedPms[wp.id] ?? 0
                              const wpRemaining = wpBudget - wpAlloc
                              const isEditing = editingWpId === wp.id

                              return (
                                <tr key={wp.id} className="border-b last:border-0 hover:bg-muted/20">
                                  <td className="px-4 py-2 text-xs tabular-nums text-muted-foreground">
                                    {isEditing ? (
                                      <select
                                        value={editWpNumber}
                                        onChange={e => setEditWpNumber(Number(e.target.value))}
                                        className="h-7 w-14 rounded border border-input bg-background px-1 text-xs"
                                      >
                                        {Array.from({ length: 40 }, (_, i) => i + 1).map(n => (
                                          <option key={n} value={n}>{n}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className="font-semibold">{wp.number ?? '—'}</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2">
                                    {isEditing ? (
                                      <div className="space-y-1">
                                        <Input value={editWpName} onChange={e => setEditWpName(e.target.value)} className="h-7 text-xs" placeholder="WP name" />
                                        <Input value={editWpDesc} onChange={e => setEditWpDesc(e.target.value)} className="h-7 text-xs" placeholder="Description" />
                                      </div>
                                    ) : (
                                      <>
                                        <div className="font-medium">{wp.name}</div>
                                        {wp.description && <div className="text-muted-foreground text-xs truncate max-w-[200px]">{wp.description}</div>}
                                      </>
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-xs text-muted-foreground">
                                    {isEditing ? (
                                      <div className="flex gap-1 items-center">
                                        <select
                                          value={editWpStartMonth}
                                          onChange={e => setEditWpStartMonth(Number(e.target.value))}
                                          className="h-7 rounded border border-input bg-background px-1 text-xs"
                                        >
                                          {Array.from({ length: projectMonthCount }, (_, i) => i + 1).map(m => (
                                            <option key={m} value={m}>{projectMonthLabel(m)}</option>
                                          ))}
                                        </select>
                                        <span className="text-muted-foreground">–</span>
                                        <select
                                          value={editWpEndMonth}
                                          onChange={e => setEditWpEndMonth(Number(e.target.value))}
                                          className="h-7 rounded border border-input bg-background px-1 text-xs"
                                        >
                                          {Array.from({ length: projectMonthCount }, (_, i) => i + 1).map(m => (
                                            <option key={m} value={m}>{projectMonthLabel(m)}</option>
                                          ))}
                                        </select>
                                      </div>
                                    ) : (
                                      <>
                                        {wp.start_month ? projectMonthLabel(wp.start_month) : '—'}
                                        {' – '}
                                        {wp.end_month ? projectMonthLabel(wp.end_month) : '—'}
                                      </>
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    {can('canManageProjects') ? (
                                      <Input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        value={wpBudget || ''}
                                        placeholder="0"
                                        onChange={(e) => {
                                          setWpPmBudgets(prev => ({ ...prev, [wp.id]: Number(e.target.value) || 0 }))
                                          setWpPmBudgetDirty(true)
                                        }}
                                        className="w-20 ml-auto text-right tabular-nums h-7 text-xs"
                                      />
                                    ) : (
                                      <span className="tabular-nums font-medium">{wpBudget.toFixed(1)}</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-right tabular-nums text-xs">
                                    <span className={cn(wpAlloc > wpBudget + 0.01 && wpBudget > 0 ? 'text-amber-600 font-semibold' : 'text-muted-foreground')}>
                                      {wpAlloc.toFixed(2)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-right tabular-nums text-xs">
                                    <span className={cn(wpRemaining < 0 ? 'text-red-500 font-semibold' : 'text-emerald-600')}>
                                      {wpBudget > 0 ? wpRemaining.toFixed(2) : '—'}
                                    </span>
                                  </td>
                                  {can('canManageProjects') && (
                                    <td className="px-4 py-2 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        {isEditing ? (
                                          <>
                                            <Button variant="ghost" size="sm" onClick={handleSaveEditWp} disabled={editWpSaving} className="h-7 text-xs">
                                              <Save className="h-3 w-3 mr-1" />
                                              {editWpSaving ? '...' : 'Save'}
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => setEditingWpId(null)} className="h-7 text-xs">Cancel</Button>
                                          </>
                                        ) : (
                                          <>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditWp(wp)}>
                                              <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWpDeleteTarget(wp)}>
                                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              )
                            })}
                            {/* Totals row */}
                            <tr className="bg-muted/30 font-semibold text-xs">
                              <td className="px-4 py-2" colSpan={3}>Total</td>
                              <td className="px-4 py-2 text-right tabular-nums">{totalWpBudgetPm.toFixed(1)} PM</td>
                              <td className="px-4 py-2 text-right tabular-nums">{totalAllocatedPm.toFixed(2)}</td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                <span className={cn((totalWpBudgetPm - totalAllocatedPm) < 0 ? 'text-red-500' : 'text-emerald-600')}>
                                  {totalWpBudgetPm > 0 ? (totalWpBudgetPm - totalAllocatedPm).toFixed(2) : '—'}
                                </span>
                              </td>
                              {can('canManageProjects') && <td />}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Budget distribution bar */}
                    {workPackages.length > 0 && totalProjectBudgetPm > 0 && (
                      <div className="mb-4 space-y-1.5">
                        <div className="text-xs text-muted-foreground">PM Budget Distribution</div>
                        <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                          {workPackages.map((wp, i) => {
                            const wpBudget = wpPmBudgets[wp.id] ?? 0
                            const pct = totalProjectBudgetPm > 0 ? (wpBudget / totalProjectBudgetPm) * 100 : 0
                            const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-red-400', 'bg-pink-500', 'bg-cyan-500', 'bg-lime-500']
                            return pct > 0 ? (
                              <div
                                key={wp.id}
                                className={cn('h-full', colors[i % colors.length])}
                                style={{ width: `${pct}%` }}
                                title={`${wp.name}: ${wpBudget.toFixed(1)} PM (${pct.toFixed(0)}%)`}
                              />
                            ) : null
                          })}
                        </div>
                        <div className="flex gap-3 flex-wrap text-[10px] text-muted-foreground">
                          {workPackages.map((wp, i) => {
                            const wpBudget = wpPmBudgets[wp.id] ?? 0
                            const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-red-400', 'bg-pink-500', 'bg-cyan-500', 'bg-lime-500']
                            return (
                              <span key={wp.id} className="flex items-center gap-1">
                                <span className={cn('w-2 h-2 rounded-sm', colors[i % colors.length])} />
                                {wp.name}: {wpBudget.toFixed(1)} PM
                              </span>
                            )
                          })}
                          {totalProjectBudgetPm - totalWpBudgetPm > 0.01 && (
                            <span className="flex items-center gap-1 text-amber-600">
                              Unassigned: {(totalProjectBudgetPm - totalWpBudgetPm).toFixed(1)} PM
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Add new WP form */}
                    {can('canManageProjects') && (
                      <div className="space-y-3 rounded-lg border p-4 bg-muted/10">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Add Work Package</div>
                        <div className="flex gap-2 items-end flex-wrap">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">WP #</Label>
                            <select
                              value={wpNumber}
                              onChange={(e) => setWpNumber(Number(e.target.value))}
                              className="flex h-9 w-16 rounded-md border border-input bg-background px-2 py-1 text-sm"
                            >
                              {Array.from({ length: 40 }, (_, i) => i + 1).map(n => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1 flex-1 min-w-[120px]">
                            <Label className="text-xs text-muted-foreground">Name *</Label>
                            <Input
                              placeholder="WP name"
                              value={wpName}
                              onChange={(e) => setWpName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1 flex-1 min-w-[120px]">
                            <Label className="text-xs text-muted-foreground">Description</Label>
                            <Input
                              placeholder="Optional"
                              value={wpDesc}
                              onChange={(e) => setWpDesc(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 items-end flex-wrap">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Start Month</Label>
                            <select
                              value={wpStartMonth}
                              onChange={(e) => setWpStartMonth(Number(e.target.value))}
                              className="flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
                            >
                              {Array.from({ length: projectMonthCount || 1 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>{projectMonthLabel(m)}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">End Month</Label>
                            <select
                              value={wpEndMonth}
                              onChange={(e) => setWpEndMonth(Number(e.target.value))}
                              className="flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
                            >
                              {Array.from({ length: projectMonthCount || 1 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>{projectMonthLabel(m)}</option>
                              ))}
                            </select>
                          </div>
                          <Button onClick={handleAddWP} disabled={wpSaving || !wpName.trim()}>
                            <Plus className="mr-1 h-4 w-4" />
                            {wpSaving ? 'Adding...' : 'Add WP'}
                          </Button>
                        </div>
                        {projectMonthCount > 0 && (
                          <div className="text-[11px] text-muted-foreground">
                            Project duration: {projectMonthCount} months ({formatDate(project!.start_date)} – {formatDate(project!.end_date)})
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Documents Tab */}
        {detailTab === 'documents' && id && <DocumentList projectId={id} />}
      </div>

      <ConfirmModal
        open={!!wpDeleteTarget}
        onOpenChange={(open) => !open && setWpDeleteTarget(null)}
        title="Delete Work Package"
        message={`Are you sure you want to delete "${wpDeleteTarget?.name}"?`}
        confirmLabel="Delete"
        destructive
        loading={wpDeleting}
        onConfirm={handleDeleteWP}
      />
    </div>
  )
}
