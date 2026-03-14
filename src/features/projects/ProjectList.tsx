import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjects } from '@/hooks/useProjects'
import type { ProjectFilters } from '@/services/projectsService'
import { projectsService } from '@/services/projectsService'
import { collabProjectService } from '@/services/collabProjectService'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'
import { Plus, Search, Trash2, Pencil, FolderKanban, Sparkles, Globe } from 'lucide-react'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import type { Project, ProjectStatus, CollabProject } from '@/types'

const STATUS_OPTIONS: (ProjectStatus | 'All')[] = ['All', 'Upcoming', 'Active', 'Completed', 'Suspended']

export function ProjectList() {
  const navigate = useNavigate()
  const { can } = useAuthStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filters: ProjectFilters = {
    search: search || undefined,
    status: statusFilter || undefined,
  }
  const { projects, isLoading, refetch } = useProjects(filters)

  // Collaboration projects
  const { orgId } = useAuthStore()
  const [collabProjects, setCollabProjects] = useState<CollabProject[]>([])
  const [collabLoading, setCollabLoading] = useState(true)

  useEffect(() => {
    if (!orgId) return
    setCollabLoading(true)
    collabProjectService.list(orgId)
      .then(setCollabProjects)
      .catch(() => setCollabProjects([]))
      .finally(() => setCollabLoading(false))
  }, [orgId])

  const filteredCollab = collabProjects.filter(cp => {
    if (search) {
      const q = search.toLowerCase()
      if (!cp.title.toLowerCase().includes(q) && !cp.acronym.toLowerCase().includes(q)) return false
    }
    return true
  })

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await projectsService.remove(deleteTarget.id)
      toast({ title: 'Deleted', description: `${deleteTarget.acronym} has been removed.` })
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Projects"
        description="Your organisation's share of each project"
        actions={
          can('canManageProjects') ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/projects/collaboration')}>
                <Globe className="mr-2 h-4 w-4" /> Collaboration
              </Button>
              <Button variant="outline" onClick={() => navigate('/projects/import-ai')}>
                <Sparkles className="mr-2 h-4 w-4" /> Import with AI
              </Button>
              <Button onClick={() => navigate('/projects/new')}>
                <Plus className="mr-2 h-4 w-4" /> New Project
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by acronym or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPTIONS.map((s) => (
            <Button
              key={s}
              variant={(s === 'All' ? !statusFilter : statusFilter === s) ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(s === 'All' ? '' : s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable columns={6} rows={8} />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects found"
          description={search ? 'Try adjusting your search.' : 'Create your first project to get started.'}
          action={
            can('canManageProjects') ? (
              <Button onClick={() => navigate('/projects/new')}>
                <Plus className="mr-2 h-4 w-4" /> New Project
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
        <div className="text-xs text-muted-foreground mb-2">
          Showing {projects.length} project{projects.length !== 1 ? 's' : ''}
        </div>
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium sticky top-0 bg-muted/50">Acronym</th>
                  <th className="px-4 py-3 text-left font-medium sticky top-0 bg-muted/50">Title</th>
                  <th className="px-4 py-3 text-left font-medium sticky top-0 bg-muted/50">Scheme</th>
                  <th className="px-4 py-3 text-left font-medium sticky top-0 bg-muted/50">Lead</th>
                  <th className="px-4 py-3 text-left font-medium sticky top-0 bg-muted/50">Status</th>
                  <th className="px-4 py-3 text-left font-medium sticky top-0 bg-muted/50">Period</th>
                  {can('canSeeFinancialDetails') && <th className="px-4 py-3 text-right font-medium sticky top-0 bg-muted/50">Budget</th>}
                  {can('canManageProjects') && <th className="px-4 py-3 text-right font-medium sticky top-0 bg-muted/50">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {projects.map((project, idx) => (
                  <tr
                    key={project.id}
                    className={cn(
                      'border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors',
                      idx % 2 === 1 && 'bg-muted/[0.03]',
                    )}
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-primary">{project.acronym}</span>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate">{project.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {project.funding_schemes?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {project.responsible_person?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={project.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {formatDate(project.start_date)} – {formatDate(project.end_date)}
                    </td>
                    {can('canSeeFinancialDetails') && (
                      <td className="px-4 py-3 text-right tabular-nums">
                        {project.total_budget != null ? formatCurrency(project.total_budget) : '—'}
                      </td>
                    )}
                    {can('canManageProjects') && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/projects/${project.id}/edit`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(project)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {/* Collaboration Projects Section */}
      {!collabLoading && filteredCollab.length > 0 && (
        <div className="space-y-2 mt-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Collaboration Projects</h3>
            <Badge variant="secondary" className="text-[10px]">{filteredCollab.length}</Badge>
          </div>
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium text-xs">Acronym</th>
                    <th className="px-4 py-2 text-left font-medium text-xs">Title</th>
                    <th className="px-4 py-2 text-left font-medium text-xs">Programme</th>
                    <th className="px-4 py-2 text-left font-medium text-xs">Partners</th>
                    <th className="px-4 py-2 text-left font-medium text-xs">Status</th>
                    <th className="px-4 py-2 text-left font-medium text-xs">Period</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCollab.map((cp, idx) => (
                    <tr
                      key={cp.id}
                      className={cn(
                        'border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors',
                        idx % 2 === 1 && 'bg-muted/[0.03]',
                      )}
                      onClick={() => navigate(`/projects/collaboration/${cp.id}`)}
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="font-semibold text-primary">{cp.acronym}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 max-w-xs truncate">{cp.title}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{cp.funding_programme ?? '—'}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">
                        {(cp as any).collab_partners?.length ?? '—'}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={cp.status === 'active' ? 'default' : 'secondary'} className="text-[10px] capitalize">
                          {cp.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs whitespace-nowrap">
                        {cp.start_date ? formatDate(cp.start_date) : '—'} – {cp.end_date ? formatDate(cp.end_date) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Project"
        message={`Are you sure you want to delete "${deleteTarget?.acronym}"? This will also delete all associated work packages, allocations, and timesheets.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
