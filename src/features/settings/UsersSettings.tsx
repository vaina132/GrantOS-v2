import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { toast } from '@/components/ui/use-toast'
import { Plus, Trash2 } from 'lucide-react'
import { emailService } from '@/services/emailService'
import { notificationService } from '@/services/notificationService'
import type { OrgRole } from '@/types'

interface OrgMember {
  id: string
  user_id: string
  role: OrgRole
  created_at: string
  user_email?: string
}

const ROLES: OrgRole[] = ['Admin', 'Project Manager', 'Finance Officer', 'Viewer', 'External Participant']

export function UsersSettings() {
  const { orgId, orgName, user } = useAuthStore()
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<OrgRole>('Viewer')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<OrgMember | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchMembers = async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('org_members')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at')

      if (error) throw error
      const rows = (data ?? []) as OrgMember[]

      // Resolve emails from user IDs via server-side API
      if (rows.length > 0) {
        try {
          const res = await fetch('/api/resolve-emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIds: rows.map((r) => r.user_id) }),
          })
          if (res.ok) {
            const { emails } = await res.json()
            for (const row of rows) {
              row.user_email = emails[row.user_id] ?? undefined
            }
          }
        } catch {
          // Non-critical — emails just won't display
        }
      }

      setMembers(rows)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load members'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMembers()
  }, [orgId])

  const handleInvite = async () => {
    if (!orgId || !inviteEmail) return
    setSaving(true)
    try {
      // Call server-side API that can use the service role key to
      // create/find the auth user and insert the org_members row.
      const res = await fetch('/api/invite-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          orgId,
          role: inviteRole,
          invitedBy: user?.id,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        const detail = data.detail ? ` (${data.detail})` : ''
        toast({
          title: res.status === 409 ? 'Already a member' : 'Error',
          description: (data.error ?? 'Failed to invite member') + detail,
          variant: 'destructive',
        })
        setSaving(false)
        return
      }

      const isNew = data.isNewUser
      toast({
        title: isNew ? 'Invitation sent' : 'Member added',
        description: isNew
          ? `An invitation email has been sent to ${inviteEmail}.`
          : `${inviteEmail} added as ${inviteRole}.`,
      })

      // Send GrantLume-branded invitation email (fire-and-forget)
      const baseUrl = window.location.origin
      emailService.sendInvitation({
        invitedEmail: inviteEmail,
        orgName: orgName ?? 'your organisation',
        role: inviteRole,
        invitedByName: user?.email ?? 'An administrator',
        signUpUrl: `${baseUrl}/signup`,
      }).catch(() => { /* non-blocking */ })

      // In-app notification to admins about the new member
      if (orgId) {
        notificationService.getAdminUserIds(orgId).then((adminIds) => {
          notificationService.notifyMany({
            orgId,
            userIds: adminIds.filter((id) => id !== user?.id),
            type: 'invitation',
            title: 'New member invited',
            message: `${inviteEmail} has been invited as ${inviteRole}.`,
            link: '/settings',
          }).catch(() => {})
        }).catch(() => {})
      }

      setInviteOpen(false)
      setInviteEmail('')
      fetchMembers()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to invite member'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleRoleChange = async (member: OrgMember, newRole: OrgRole) => {
    try {
      const { error } = await supabase
        .from('org_members')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', member.id)

      if (error) throw error
      toast({ title: 'Role updated' })

      // Send role change notification email (fire-and-forget)
      if (member.user_email) {
        const baseUrl = window.location.origin
        emailService.sendRoleChanged({
          to: member.user_email,
          userName: member.user_email,
          orgName: orgName ?? 'your organisation',
          oldRole: member.role,
          newRole: newRole,
          dashboardUrl: `${baseUrl}/dashboard`,
        }).catch(() => { /* non-blocking */ })
      }

      // In-app notification to the affected user
      if (orgId) {
        notificationService.notify({
          orgId,
          userId: member.user_id,
          type: 'info',
          title: 'Your role has changed',
          message: `Your role was changed from ${member.role} to ${newRole}.`,
          link: '/dashboard',
        }).catch(() => {})
      }

      fetchMembers()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update role'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('org_members')
        .delete()
        .eq('id', deleteTarget.id)

      if (error) throw error
      toast({ title: 'Member removed' })
      setDeleteTarget(null)
      fetchMembers()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove member'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <Skeleton className="h-48 w-full" />

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Organisation Members</CardTitle>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add Member
          </Button>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No members found.</p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">Member</th>
                    <th className="px-4 py-2 text-left font-medium">Role</th>
                    <th className="px-4 py-2 text-left font-medium">Joined</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{m.user_email ?? `${m.user_id.slice(0, 8)}...`}</span>
                          {m.user_id === user?.id && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">You</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m, e.target.value as OrgRole)}
                          disabled={m.user_id === user?.id}
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {m.user_id !== user?.id && (
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(m)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={saving || !inviteEmail}>
              {saving ? 'Adding...' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove Member"
        message="Are you sure you want to remove this member from the organisation?"
        confirmLabel="Remove"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  )
}
