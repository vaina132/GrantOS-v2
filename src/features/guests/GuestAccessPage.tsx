import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useProjects } from '@/hooks/useProjects'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'
import { Plus, Trash2, UserCheck } from 'lucide-react'

interface ProjectGuest {
  id: string
  org_id: string
  project_id: string
  user_id: string
  invited_by: string | null
  access_level: string
  is_active: boolean
  expires_at: string | null
  created_at: string
  updated_at: string
}

export function GuestAccessPage() {
  const { orgId, can } = useAuthStore()
  const { projects } = useProjects()
  const [guests, setGuests] = useState<ProjectGuest[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProjectGuest | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Form state
  const [userId, setUserId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [accessLevel, setAccessLevel] = useState('view')

  const fetchGuests = async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('project_guests')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setGuests((data ?? []) as ProjectGuest[])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load guests'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGuests()
  }, [orgId])

  const handleInvite = async () => {
    if (!orgId || !userId || !projectId) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('project_guests')
        .insert({
          org_id: orgId,
          project_id: projectId,
          user_id: userId,
          access_level: accessLevel,
        })

      if (error) throw error
      toast({ title: 'Guest added', description: `User granted ${accessLevel} access.` })
      setInviteOpen(false)
      setUserId('')
      setProjectId('')
      setAccessLevel('view')
      fetchGuests()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add guest'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('project_guests')
        .delete()
        .eq('id', deleteTarget.id)

      if (error) throw error
      toast({ title: 'Guest removed' })
      setDeleteTarget(null)
      fetchGuests()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove guest'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const getProjectAcronym = (pid: string) => {
    const p = projects.find((pr) => pr.id === pid)
    return p?.acronym ?? '—'
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guest Access"
        description="Manage external access to project data"
        actions={
          can('canManageOrg') ? (
            <Button onClick={() => setInviteOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Guest
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : guests.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No guest access configured"
          description="Grant external users view-only access to specific projects."
          action={
            can('canManageOrg') ? (
              <Button onClick={() => setInviteOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Guest
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">User ID</th>
                <th className="px-4 py-2 text-left font-medium">Project</th>
                <th className="px-4 py-2 text-left font-medium">Access Level</th>
                <th className="px-4 py-2 text-left font-medium">Active</th>
                <th className="px-4 py-2 text-left font-medium">Added</th>
                {can('canManageOrg') && (
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {guests.map((guest) => (
                <tr key={guest.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-2 font-mono text-xs">{guest.user_id.slice(0, 12)}...</td>
                  <td className="px-4 py-2">
                    <span className="font-semibold text-primary">{getProjectAcronym(guest.project_id)}</span>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant="secondary" className="text-xs">{guest.access_level}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={guest.is_active ? 'default' : 'outline'} className="text-xs">
                      {guest.is_active ? 'Yes' : 'No'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(guest.created_at).toLocaleDateString()}
                  </td>
                  {can('canManageOrg') && (
                    <td className="px-4 py-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(guest)}>
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

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Guest Access</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>User ID *</Label>
              <Input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Paste user UUID"
              />
            </div>
            <div className="space-y-2">
              <Label>Project *</Label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.acronym} — {p.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Access Level</Label>
              <select
                value={accessLevel}
                onChange={(e) => setAccessLevel(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="view">View</option>
                <option value="edit">Edit</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={saving || !userId || !projectId}>
              {saving ? 'Adding...' : 'Add Guest'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove Guest"
        message="Are you sure you want to revoke this guest's access?"
        confirmLabel="Remove"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
