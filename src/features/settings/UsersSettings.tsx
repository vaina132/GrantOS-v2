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
      setMembers((data ?? []) as OrgMember[])
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
      // Look up user by email
      const { data: users } = await supabase
        .from('auth.users' as any)
        .select('id')
        .eq('email', inviteEmail)
        .maybeSingle()

      if (!users) {
        toast({
          title: 'User not found',
          description: 'The user must sign up first before being added to the organisation.',
          variant: 'destructive',
        })
        setSaving(false)
        return
      }

      const { error } = await supabase
        .from('org_members')
        .insert({
          user_id: (users as any).id,
          org_id: orgId,
          role: inviteRole,
          invited_by: user?.id,
        })

      if (error) throw error
      toast({ title: 'Member added', description: `${inviteEmail} added as ${inviteRole}.` })

      // Send invitation email (fire-and-forget)
      const baseUrl = window.location.origin
      emailService.sendInvitation({
        invitedEmail: inviteEmail,
        orgName: orgName ?? 'your organisation',
        role: inviteRole,
        invitedByName: user?.email ?? 'An administrator',
        signUpUrl: `${baseUrl}/login`,
      }).catch(() => { /* non-blocking */ })

      setInviteOpen(false)
      setInviteEmail('')
      fetchMembers()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add member'
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
                    <th className="px-4 py-2 text-left font-medium">User ID</th>
                    <th className="px-4 py-2 text-left font-medium">Role</th>
                    <th className="px-4 py-2 text-left font-medium">Joined</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="px-4 py-2 text-xs font-mono">
                        {m.user_id === user?.id ? (
                          <span>{m.user_id.slice(0, 8)}... <Badge variant="secondary" className="ml-1">You</Badge></span>
                        ) : (
                          `${m.user_id.slice(0, 8)}...`
                        )}
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
