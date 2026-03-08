import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useProject, useWorkPackages } from '@/hooks/useProjects'
import { projectsService } from '@/services/projectsService'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { DocumentList } from '@/features/documents/DocumentList'
import type { WorkPackage } from '@/types'

export function ProjectDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { project, isLoading } = useProject(id)
  const { workPackages, isLoading: loadingWPs, refetch: refetchWPs } = useWorkPackages(
    project?.has_wps ? id : undefined,
  )
  const { orgId, can } = useAuthStore()

  const [wpName, setWpName] = useState('')
  const [wpSaving, setWpSaving] = useState(false)
  const [wpDeleteTarget, setWpDeleteTarget] = useState<WorkPackage | null>(null)
  const [wpDeleting, setWpDeleting] = useState(false)

  const handleAddWP = async () => {
    if (!wpName.trim() || !id) return
    setWpSaving(true)
    try {
      await projectsService.createWorkPackage({
        org_id: orgId ?? '',
        project_id: id,
        name: wpName.trim(),
        description: null,
        lead_person_id: null,
        start_date: null,
        end_date: null,
      })
      setWpName('')
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
                    <table className="w-full text-sm min-w-[480px]">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-4 py-2 text-left font-medium">Name</th>
                          <th className="px-4 py-2 text-left font-medium">Description</th>
                          {can('canManageProjects') && (
                            <th className="px-4 py-2 text-right font-medium">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {workPackages.map((wp) => (
                          <tr key={wp.id} className="border-b last:border-0">
                            <td className="px-4 py-2 font-medium">{wp.name}</td>
                            <td className="px-4 py-2 text-muted-foreground">{wp.description ?? '—'}</td>
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
                  <div className="flex gap-2">
                    <Input
                      placeholder="Work package name..."
                      value={wpName}
                      onChange={(e) => setWpName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddWP())}
                    />
                    <Button onClick={handleAddWP} disabled={wpSaving || !wpName.trim()}>
                      <Plus className="mr-2 h-4 w-4" />
                      {wpSaving ? 'Adding...' : 'Add'}
                    </Button>
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
