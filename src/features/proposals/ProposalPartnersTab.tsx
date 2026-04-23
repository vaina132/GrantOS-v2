import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Mail,
  Trash2,
  RotateCw,
  CheckCircle2,
  Clock,
  XCircle,
  Crown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { proposalPartnerService, proposalAuditService } from '@/services/proposalWorkflowService'
import { emailService } from '@/services/emailService'
import type { Proposal, ProposalPartner, ProposalPartnerInviteStatus } from '@/types'

const INVITE_STATUS: Record<ProposalPartnerInviteStatus, { label: string; classes: string; icon: typeof Clock }> = {
  pending: { label: 'Invited', classes: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  accepted: { label: 'Accepted', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  declined: { label: 'Declined', classes: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
}

interface Props {
  proposal: Proposal
  canManage: boolean
}

export function ProposalPartnersTab({ proposal, canManage }: Props) {
  const { t } = useTranslation()
  const { orgName, user } = useAuthStore()
  const [partners, setPartners] = useState<ProposalPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<ProposalPartner | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const rows = await proposalPartnerService.list(proposal.id)
      setPartners(rows)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to load partners',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal.id])

  const host = partners.find((p) => p.is_host) ?? null
  const externals = partners.filter((p) => !p.is_host)

  const handleRemove = async () => {
    if (!removeTarget) return
    try {
      await proposalPartnerService.remove(removeTarget.id)
      await proposalAuditService.log({
        proposal_id: proposal.id,
        actor_user_id: user?.id ?? null,
        actor_name: null,
        actor_role: 'coordinator',
        event_type: 'partner_removed',
        target_partner_id: removeTarget.id,
        target_document_id: null,
        target_submission_id: null,
        note: `Removed ${removeTarget.org_name}`,
      }).catch(() => {})
      toast({ title: 'Partner removed' })
      setRemoveTarget(null)
      void load()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to remove partner',
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">
            Consortium
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({externals.length} external {externals.length === 1 ? 'partner' : 'partners'})
            </span>
          </CardTitle>
          {canManage && (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Invite partner
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Organisation</th>
                    <th className="px-3 py-2 text-left font-medium">Role</th>
                    <th className="px-3 py-2 text-left font-medium">Contact</th>
                    <th className="px-3 py-2 text-left font-medium">Country</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    {canManage && <th className="px-3 py-2 text-right font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {host && (
                    <tr className="border-b last:border-0 bg-primary/5">
                      <td className="px-3 py-2 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Crown className="h-3.5 w-3.5 text-primary" />
                          {host.org_name}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px]">Coordinator (host)</Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{host.contact_email ?? '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{host.country ?? '—'}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> You
                        </Badge>
                      </td>
                      {canManage && <td className="px-3 py-2"></td>}
                    </tr>
                  )}
                  {externals.length === 0 && (
                    <tr>
                      <td colSpan={canManage ? 6 : 5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                        No external partners yet. Click "Invite partner" to add one.
                      </td>
                    </tr>
                  )}
                  {externals.map((p) => {
                    const meta = INVITE_STATUS[p.invite_status]
                    const Icon = meta.icon
                    return (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">{p.org_name}</td>
                        <td className="px-3 py-2 text-muted-foreground capitalize">{p.role}</td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">
                          {p.contact_name ? <div>{p.contact_name}</div> : null}
                          {p.contact_email ? <div>{p.contact_email}</div> : <span>—</span>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{p.country ?? '—'}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={cn('text-[10px]', meta.classes)}>
                            <Icon className="h-3 w-3 mr-1" />
                            {meta.label}
                          </Badge>
                        </td>
                        {canManage && (
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {p.invite_status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="Resend invite email"
                                  onClick={() => resendInvite(p, proposal, orgName)}
                                >
                                  <RotateCw className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Remove partner"
                                onClick={() => setRemoveTarget(p)}
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
          )}
        </CardContent>
      </Card>

      <InvitePartnerDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        proposal={proposal}
        onCreated={() => {
          setInviteOpen(false)
          void load()
        }}
      />

      <ConfirmModal
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove partner"
        message={`Remove ${removeTarget?.org_name} from this proposal? Their submissions will be deleted.`}
        confirmLabel="Remove"
        destructive
        onConfirm={handleRemove}
      />
    </>
  )

  void t
}

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposal: Proposal
  onCreated: () => void
}

function InvitePartnerDialog({ open, onOpenChange, proposal, onCreated }: DialogProps) {
  const { user, orgName } = useAuthStore()
  const [orgNameInput, setOrgNameInput] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [country, setCountry] = useState('')
  const [role, setRole] = useState<'partner' | 'coordinator'>('partner')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setOrgNameInput('')
      setContactName('')
      setContactEmail('')
      setCountry('')
      setRole('partner')
    }
  }, [open])

  const handleInvite = async () => {
    if (!orgNameInput.trim() || !contactEmail.trim()) {
      toast({ title: 'Organisation name and contact email are required', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const created = await proposalPartnerService.create({
        proposal_id: proposal.id,
        org_name: orgNameInput.trim(),
        role,
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim(),
        country: country.trim() || null,
      })

      await proposalAuditService.log({
        proposal_id: proposal.id,
        actor_user_id: user?.id ?? null,
        actor_name: null,
        actor_role: 'coordinator',
        event_type: 'partner_invited',
        target_partner_id: created.id,
        target_document_id: null,
        target_submission_id: null,
        note: `Invited ${created.org_name} (${contactEmail})`,
      }).catch(() => {})

      // Fire-and-forget email. The invite URL re-uses the `/collab/accept`
      // route which the lookup endpoint now matches against both project and
      // proposal partners.
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.grantlume.com'
      const acceptUrl = `${origin}/collab/accept?token=${created.invite_token}`
      const senderName = user?.user_metadata?.first_name
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
        : user?.email?.split('@')[0] ?? 'The coordinator'
      emailService.sendCollabPartnerInvitation({
        to: contactEmail.trim(),
        contactName: contactName.trim() || contactEmail.split('@')[0],
        orgName: orgNameInput.trim(),
        projectAcronym: proposal.project_name.slice(0, 20),
        projectTitle: proposal.project_name,
        coordinatorOrg: orgName ?? '',
        senderName,
        role,
        acceptUrl,
      }).catch((err) => console.warn('[Proposals] invite email failed:', err))

      toast({ title: 'Partner invited', description: `${created.org_name} will receive an email.` })
      onCreated()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to invite partner',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite partner</DialogTitle>
          <DialogDescription>
            They'll get an email with a secure link to sign in and start contributing their documents.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Organisation name *</Label>
            <Input value={orgNameInput} onChange={(e) => setOrgNameInput(e.target.value)} placeholder="e.g. TU Delft" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contact name</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact email *</Label>
              <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. NL" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'partner' | 'coordinator')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="partner">Partner</option>
                <option value="coordinator">Coordinator substitute</option>
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleInvite} disabled={submitting}>
            <Mail className="h-4 w-4 mr-1" /> Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

async function resendInvite(partner: ProposalPartner, proposal: Proposal, orgName: string | null) {
  if (!partner.contact_email || !partner.invite_token) {
    toast({ title: 'Cannot resend', description: 'Partner has no contact email on file.', variant: 'destructive' })
    return
  }
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.grantlume.com'
    const acceptUrl = `${origin}/collab/accept?token=${partner.invite_token}`
    await emailService.sendCollabPartnerInvitation({
      to: partner.contact_email,
      contactName: partner.contact_name || partner.contact_email.split('@')[0],
      orgName: partner.org_name,
      projectAcronym: proposal.project_name.slice(0, 20),
      projectTitle: proposal.project_name,
      coordinatorOrg: orgName ?? '',
      senderName: 'The coordinator',
      role: partner.role,
      acceptUrl,
    })
    toast({ title: 'Invite re-sent', description: partner.contact_email })
  } catch {
    toast({ title: 'Failed to resend', variant: 'destructive' })
  }
}
