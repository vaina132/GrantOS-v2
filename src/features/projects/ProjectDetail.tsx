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
import { formatCurrency, formatDate } from '@/lib/utils'
import { DocumentList } from '@/features/documents/DocumentList'
import type { WorkPackage, PmBudget } from '@/types'

export function ProjectDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { project, isLoading } = useProject(id)
  const { workPackages, isLoading: loadingWPs, refetch: refetchWPs } = useWorkPackages(
    project?.has_wps ? id : undefined,
  )
  const { orgId, can } = useAuthStore()

  const [wpName, setWpName] = useState('')
  const [wpDesc, setWpDesc] = useState('')
  const [wpStartDate, setWpStartDate] = useState('')
  const [wpEndDate, setWpEndDate] = useState('')
  const [wpSaving, setWpSaving] = useState(false)
  const [wpDeleteTarget, setWpDeleteTarget] = useState<WorkPackage | null>(null)
  const [wpDeleting, setWpDeleting] = useState(false)

  // PM budget per year
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

  const loadPmBudgets = useCallback(async () => {
    if (!id) return
    try {
      const data = await allocationsService.listPmBudgetsByProject(id, 'actual')
      setPmBudgets(data)
      const map: Record<number, number> = {}
      for (const b of data) {
        if (!b.work_package_id) map[b.year] = b.target_pms
      }
      setPmBudgetValues(map)
      setPmBudgetDirty(false)
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

  const handleAddWP = async () => {
    if (!wpName.trim() || !id) return
    setWpSaving(true)
    try {
      await projectsService.createWorkPackage({
        org_id: orgId ?? '',
        project_id: id,
        name: wpName.trim(),
        description: wpDesc.trim() || null,
        lead_person_id: null,
        start_date: wpStartDate || null,
        end_date: wpEndDate || null,
      })
      setWpName('')
      setWpDesc('')
      setWpStartDate('')
      setWpEndDate('')
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setWpDeleting(false)
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

  return (
    <div className="space-y-6">
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

      <div className="grid gap-6 lg:grid-cols-2">
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
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Budget</CardTitle></CardHeader>
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
      </div>

      {/* PM Budget per Year */}
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

      {/* Work Packages */}
      {project.has_wps && (
        <Card>
          <CardHeader>
            <CardTitle>Work Packages</CardTitle>
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
                    <table className="w-full text-sm min-w-[600px]">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-4 py-2 text-left font-medium">Name</th>
                          <th className="px-4 py-2 text-left font-medium">Description</th>
                          <th className="px-4 py-2 text-left font-medium">Start</th>
                          <th className="px-4 py-2 text-left font-medium">End</th>
                          {can('canManageProjects') && (
                            <th className="px-4 py-2 text-right font-medium">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {workPackages.map((wp) => (
                          <tr key={wp.id} className="border-b last:border-0">
                            <td className="px-4 py-2 font-medium">{wp.name}</td>
                            <td className="px-4 py-2 text-muted-foreground text-xs max-w-[200px] truncate">{wp.description ?? '—'}</td>
                            <td className="px-4 py-2 text-xs text-muted-foreground">{wp.start_date ? formatDate(wp.start_date) : '—'}</td>
                            <td className="px-4 py-2 text-xs text-muted-foreground">{wp.end_date ? formatDate(wp.end_date) : '—'}</td>
                            {can('canManageProjects') && (
                              <td className="px-4 py-2 text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setWpDeleteTarget(wp)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {can('canManageProjects') && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="WP name *"
                        value={wpName}
                        onChange={(e) => setWpName(e.target.value)}
                      />
                      <Input
                        placeholder="Description (optional)"
                        value={wpDesc}
                        onChange={(e) => setWpDesc(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Start Date</Label>
                        <Input type="date" value={wpStartDate} onChange={(e) => setWpStartDate(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">End Date</Label>
                        <Input type="date" value={wpEndDate} onChange={(e) => setWpEndDate(e.target.value)} />
                      </div>
                      <Button onClick={handleAddWP} disabled={wpSaving || !wpName.trim()}>
                        <Plus className="mr-1 h-4 w-4" />
                        {wpSaving ? 'Adding...' : 'Add WP'}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {id && <DocumentList projectId={id} />}

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
