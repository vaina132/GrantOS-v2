import { useState, useEffect, useMemo } from 'react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'
import { emailService } from '@/services/emailService'
import {
  Plus, Trash2, UserCheck, Mail, Building2, Clock,
  CheckCircle2, XCircle, Send, AlertTriangle, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface GuestRow {
  id: string
  org_id: string
  project_id: string
  user_id: string | null
  invited_email: string | null
  invited_name: string | null
  guest_org_name: string | null
  invited_by: string | null
  access_level: string
  status: string
  is_active: boolean
  expires_at: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock }> = {
  pending: { label: 'Pending', variant: 'outline', icon: Clock },
  accepted: { label: 'Accepted', variant: 'default', icon: CheckCircle2 },
  revoked: { label: 'Revoked', variant: 'destructive', icon: XCircle },
}

export function GuestAccessPage() {
  const { orgId, orgName, user, can } = useAuthStore()
  const { projects } = useProjects()
  const [guests, setGuests] = useState<GuestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<GuestRow | null>(null)
  const [revoking, setRevoking] = useState(false)

  // Invite form state
  const [guestEmail, setGuestEmail] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestOrg, setGuestOrg] = useState('')
  const [projectId, setProjectId] = useState('')
  const [accessLevel, setAccessLevel] = useState<'contributor' | 'read_only'>('contributor')

  // Only show projects where we are the lead organisation
  const ledProjects = useMemo(
    () => projects.filter((p) => (p as any).is_lead_organisation === true),
    [projects],
  )

  // If no led projects, show all projects as fallback (org may not use this field)
  const availableProjects = ledProjects.length > 0 ? ledProjects : projects

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
      setGuests((data ?? []) as GuestRow[])
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

  // ─── Invite handler ─────────────────────────────

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const handleInvite = async () => {
    if (!orgId || !guestEmail || !projectId) return
    if (!isValidEmail(guestEmail)) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email address.', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('project_guests')
        .insert({
          org_id: orgId,
          project_id: projectId,
          invited_email: guestEmail.trim().toLowerCase(),
          invited_name: guestName.trim() || null,
          guest_org_name: guestOrg.trim() || null,
          invited_by: user?.id ?? null,
          access_level: accessLevel,
          status: 'pending',
        } as any)

      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Already invited', description: 'This email has already been invited to this project.', variant: 'destructive' })
        } else {
          throw error
        }
        return
      }

      toast({ title: 'Invitation sent', description: `${guestName || guestEmail} has been invited as a ${accessLevel === 'contributor' ? 'contributor' : 'read-only viewer'}.` })

      // Send invitation email
      const selectedProject = projects.find((p) => p.id === projectId)
      if (selectedProject) {
        emailService.sendGuestInvitation({
          guestEmail: guestEmail.trim().toLowerCase(),
          orgName: orgName ?? 'the organisation',
          projectAcronym: selectedProject.acronym,
          invitedByName: user?.email ?? 'An administrator',
          accessLevel,
          loginUrl: `${window.location.origin}/login`,
        }).catch(() => { /* non-blocking */ })
      }

      resetForm()
      fetchGuests()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send invitation'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setInviteOpen(false)
    setGuestEmail('')
    setGuestName('')
    setGuestOrg('')
    setProjectId('')
    setAccessLevel('contributor')
  }

  // ─── Revoke handler ─────────────────────────────

  const handleRevoke = async () => {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      const { error } = await supabase
        .from('project_guests')
        .update({ status: 'revoked', is_active: false } as any)
        .eq('id', revokeTarget.id)

      if (error) throw error
      toast({ title: 'Access revoked', description: `${revokeTarget.invited_name || revokeTarget.invited_email || 'Guest'} has been removed.` })
      setRevokeTarget(null)
      fetchGuests()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to revoke access'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setRevoking(false)
    }
  }

  // ─── Resend invitation ──────────────────────────

  const handleResend = async (guest: GuestRow) => {
    const selectedProject = projects.find((p) => p.id === guest.project_id)
    if (!guest.invited_email || !selectedProject) return

    try {
      await emailService.sendGuestInvitation({
        guestEmail: guest.invited_email,
        orgName: orgName ?? 'the organisation',
        projectAcronym: selectedProject.acronym,
        invitedByName: user?.email ?? 'An administrator',
        accessLevel: guest.access_level,
        loginUrl: `${window.location.origin}/login`,
      })
      toast({ title: 'Invitation resent', description: `Email sent to ${guest.invited_email}` })
    } catch {
      toast({ title: 'Failed to resend', variant: 'destructive' })
    }
  }

  // ─── Helpers ────────────────────────────────────

  const getProjectAcronym = (pid: string) => {
    const p = projects.find((pr) => pr.id === pid)
    return p?.acronym ?? '—'
  }

  const getProjectTitle = (pid: string) => {
    const p = projects.find((pr) => pr.id === pid)
    return p?.title ?? ''
  }

  const canManage = can('canManageOrg') || can('canManageProjects')

  // Split guests into active and revoked
  const activeGuests = guests.filter((g) => g.status !== 'revoked')
  const revokedGuests = guests.filter((g) => g.status === 'revoked')

  return (
    <div className="space-y-6">
      <PageHeader
        title="External Partners"
        description="Invite external partners to contribute to projects you lead. They can submit timesheets and financial data for their staff."
        actions={
          canManage ? (
            <Button onClick={() => setInviteOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Invite Partner
            </Button>
          ) : undefined
        }
      />

      {/* Summary cards */}
      {!loading && guests.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <UserCheck className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeGuests.filter((g) => g.status === 'accepted').length}</p>
                  <p className="text-[11px] text-muted-foreground">Active partners</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeGuests.filter((g) => g.status === 'pending').length}</p>
                  <p className="text-[11px] text-muted-foreground">Pending invitations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {new Set(activeGuests.map((g) => g.guest_org_name || g.invited_email).filter(Boolean)).size}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Organisations</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Guest list */}
      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : activeGuests.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No external partners yet"
          description="Invite partners from other organisations to contribute to projects you lead. They'll be able to submit timesheets and financial reports for their staff."
          action={
            canManage ? (
              <Button onClick={() => setInviteOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Invite Partner
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Partners & Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2.5 text-left font-medium">Partner</th>
                    <th className="px-4 py-2.5 text-left font-medium">Project</th>
                    <th className="px-4 py-2.5 text-left font-medium">Access</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5 text-left font-medium">Invited</th>
                    {canManage && (
                      <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {activeGuests.map((guest) => {
                    const statusCfg = STATUS_CONFIG[guest.status] ?? STATUS_CONFIG.pending
                    const StatusIcon = statusCfg.icon

                    return (
                      <tr key={guest.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            <p className="font-medium text-sm">
                              {guest.invited_name || guest.invited_email || '—'}
                            </p>
                            {guest.invited_name && guest.invited_email && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {guest.invited_email}
                              </p>
                            )}
                            {guest.guest_org_name && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Building2 className="h-3 w-3" /> {guest.guest_org_name}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-primary text-sm">{getProjectAcronym(guest.project_id)}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{getProjectTitle(guest.project_id)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            {guest.access_level === 'contributor' ? 'Contributor' : 'Read only'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={statusCfg.variant} className="text-xs">
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusCfg.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(guest.created_at).toLocaleDateString()}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {guest.status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleResend(guest)}
                                  className="text-xs h-7 px-2"
                                >
                                  <Send className="h-3 w-3 mr-1" /> Resend
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setRevokeTarget(guest)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revoked guests (collapsed) */}
      {revokedGuests.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
            {revokedGuests.length} revoked invitation{revokedGuests.length !== 1 ? 's' : ''}
          </summary>
          <div className="mt-2 rounded-lg border overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <tbody>
                {revokedGuests.map((guest) => (
                  <tr key={guest.id} className="border-b last:border-0 opacity-50">
                    <td className="px-4 py-2 text-sm">{guest.invited_name || guest.invited_email || '—'}</td>
                    <td className="px-4 py-2 text-sm">{getProjectAcronym(guest.project_id)}</td>
                    <td className="px-4 py-2">
                      <Badge variant="destructive" className="text-xs">Revoked</Badge>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {new Date(guest.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { if (!open) resetForm(); else setInviteOpen(true) }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Invite External Partner</DialogTitle>
            <DialogDescription>
              Invite someone from another organisation to contribute to a project you lead.
              They'll receive an email with instructions to access the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="guest-email">Email address *</Label>
              <Input
                id="guest-email"
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="partner@university.edu"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="guest-name">Contact name</Label>
                <Input
                  id="guest-name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Dr. Jane Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-org">Organisation</Label>
                <Input
                  id="guest-org"
                  value={guestOrg}
                  onChange={(e) => setGuestOrg(e.target.value)}
                  placeholder="University of Oslo"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest-project">Project *</Label>
              <select
                id="guest-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a project you lead...</option>
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.acronym} — {p.title}</option>
                ))}
              </select>
              {ledProjects.length > 0 && (
                <p className="text-[10px] text-muted-foreground">Only projects where your organisation is the lead are shown.</p>
              )}
              {ledProjects.length === 0 && projects.length > 0 && (
                <p className="text-[10px] text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  No projects marked as "lead organisation". Showing all projects.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Access level</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAccessLevel('contributor')}
                  className={cn(
                    'rounded-lg border-2 p-3 text-left transition-all',
                    accessLevel === 'contributor'
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent bg-muted/50 hover:bg-muted',
                  )}
                >
                  <p className="text-sm font-medium">Contributor</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Can submit timesheets & view project data</p>
                </button>
                <button
                  type="button"
                  onClick={() => setAccessLevel('read_only')}
                  className={cn(
                    'rounded-lg border-2 p-3 text-left transition-all',
                    accessLevel === 'read_only'
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent bg-muted/50 hover:bg-muted',
                  )}
                >
                  <p className="text-sm font-medium">Read only</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Can only view project data</p>
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button onClick={handleInvite} disabled={saving || !guestEmail || !projectId}>
              <Send className="mr-2 h-4 w-4" />
              {saving ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <ConfirmModal
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke Access"
        message={`Are you sure you want to revoke access for ${revokeTarget?.invited_name || revokeTarget?.invited_email || 'this guest'}? They will no longer be able to access this project.`}
        confirmLabel="Revoke Access"
        destructive
        loading={revoking}
        onConfirm={handleRevoke}
      />
    </div>
  )
}
