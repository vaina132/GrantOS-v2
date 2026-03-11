import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStaff } from '@/hooks/useStaff'
import type { StaffFilters } from '@/services/staffService'
import { staffService } from '@/services/staffService'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import { Plus, Search, Trash2, Pencil, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PersonAvatar } from '@/components/common/PersonAvatar'
import type { Person } from '@/types'

export function StaffList() {
  const navigate = useNavigate()
  const { can } = useAuthStore()
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(true)
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filters: StaffFilters = {
    search: search || undefined,
    is_active: activeFilter,
  }
  const { staff, isLoading, refetch } = useStaff(filters)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await staffService.remove(deleteTarget.id)
      toast({ title: 'Deleted', description: `${deleteTarget.full_name} has been removed.` })
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
        title="Staff"
        description="Manage your organisation's staff members"
        actions={
          can('canWrite') ? (
            <Button onClick={() => navigate('/staff/new')}>
              <Plus className="mr-2 h-4 w-4" /> Add Person
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {[
            { label: 'Active', value: true },
            { label: 'Inactive', value: false },
            { label: 'All', value: undefined },
          ].map((opt) => (
            <Button
              key={String(opt.value)}
              variant={activeFilter === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable columns={6} rows={8} />
      ) : staff.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No staff members found"
          description={search ? 'Try adjusting your search.' : 'Add your first team member to get started.'}
          action={
            can('canWrite') ? (
              <Button onClick={() => navigate('/staff/new')}>
                <Plus className="mr-2 h-4 w-4" /> Add Person
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
        <div className="text-xs text-muted-foreground mb-2">
          Showing {staff.length} member{staff.length !== 1 ? 's' : ''}
        </div>
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium sticky top-0 bg-muted/50">Name</th>
                  <th className="px-4 py-3 text-left font-medium sticky top-0 bg-muted/50">Department</th>
                  <th className="px-4 py-3 text-left font-medium sticky top-0 bg-muted/50">Role</th>
                  <th className="px-4 py-3 text-left font-medium sticky top-0 bg-muted/50">Type</th>
                  <th className="px-4 py-3 text-right font-medium sticky top-0 bg-muted/50">FTE</th>
                  <th className="px-4 py-3 text-left font-medium sticky top-0 bg-muted/50">Status</th>
                  {can('canWrite') && <th className="px-4 py-3 text-right font-medium sticky top-0 bg-muted/50">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {staff.map((person, idx) => (
                  <tr
                    key={person.id}
                    className={cn(
                      'border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors',
                      idx % 2 === 1 && 'bg-muted/[0.03]',
                    )}
                    onClick={() => navigate(`/staff/${person.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <PersonAvatar name={person.full_name} avatarUrl={person.avatar_url} size="sm" />
                        <div>
                          <div className="font-medium">{person.full_name}</div>
                          {person.email && (
                            <div className="text-xs text-muted-foreground">{person.email}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{person.department ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{person.role ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{person.employment_type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{person.fte.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={person.is_active ? 'default' : 'outline'}>
                        {person.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    {can('canWrite') && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/staff/${person.id}/edit`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(person)}
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

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Staff Member"
        message={`Are you sure you want to delete "${deleteTarget?.full_name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
