import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjects } from '@/hooks/useProjects'
import type { ProjectFilters } from '@/services/projectsService'
import { projectsService } from '@/services/projectsService'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'
import { Plus, Search, Trash2, Pencil, FolderKanban } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Project, ProjectStatus } from '@/types'

const STATUS_OPTIONS: (ProjectStatus | 'All')[] = ['All', 'Active', 'Upcoming', 'Concluding', 'Completed', 'Suspended']

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
        title="Projects"
        description="Manage your grant projects"
        actions={
          can('canManageProjects') ? (
            <Button onClick={() => navigate('/projects/new')}>
              <Plus className="mr-2 h-4 w-4" /> New Project
            </Button>
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
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Acronym</th>
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-left font-medium">Scheme</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Period</th>
                  <th className="px-4 py-3 text-right font-medium">Budget</th>
                  {can('canManageProjects') && <th className="px-4 py-3 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr
                    key={project.id}
                    className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-primary">{project.acronym}</span>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate">{project.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {project.funding_schemes?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={project.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {formatDate(project.start_date)} – {formatDate(project.end_date)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {project.total_budget != null ? formatCurrency(project.total_budget) : '—'}
                    </td>
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
