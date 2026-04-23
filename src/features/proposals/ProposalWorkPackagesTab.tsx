import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import {
  proposalWorkPackageService,
  proposalPartnerService,
} from '@/services/proposalWorkflowService'
import type { Proposal, ProposalWorkPackage, ProposalPartner } from '@/types'

interface Props {
  proposal: Proposal
  canManage: boolean
}

export function ProposalWorkPackagesTab({ proposal, canManage }: Props) {
  const [wps, setWps] = useState<ProposalWorkPackage[]>([])
  const [partners, setPartners] = useState<ProposalPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ProposalWorkPackage | null>(null)
  const [removeTarget, setRemoveTarget] = useState<ProposalWorkPackage | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [wpRows, partnerRows] = await Promise.all([
        proposalWorkPackageService.list(proposal.id),
        proposalPartnerService.list(proposal.id),
      ])
      setWps(wpRows)
      setPartners(partnerRows)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to load work packages',
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

  const partnerName = (id: string | null | undefined) =>
    id ? partners.find((p) => p.id === id)?.org_name ?? '—' : '—'

  const handleRemove = async () => {
    if (!removeTarget) return
    try {
      await proposalWorkPackageService.remove(removeTarget.id)
      toast({ title: 'Work package removed' })
      setRemoveTarget(null)
      void load()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to remove',
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">
            Work packages
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({wps.length})
            </span>
          </CardTitle>
          {canManage && (
            <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}>
              <Plus className="h-4 w-4 mr-1" /> Add WP
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : wps.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                No work packages defined yet. Add the WPs your consortium agrees on — partners will commit person-months per WP in their Budget form.
              </p>
              {canManage && (
                <Button size="sm" variant="outline" onClick={() => { setEditing(null); setDialogOpen(true) }}>
                  <Plus className="h-4 w-4 mr-1" /> Add your first WP
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium w-16">#</th>
                    <th className="px-3 py-2 text-left font-medium">Title</th>
                    <th className="px-3 py-2 text-left font-medium">Lead partner</th>
                    <th className="px-3 py-2 text-left font-medium">Description</th>
                    {canManage && <th className="px-3 py-2 text-right font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {wps.map((wp) => (
                    <tr key={wp.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono text-xs">WP{wp.wp_number}</td>
                      <td className="px-3 py-2 font-medium">{wp.title}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{partnerName(wp.leader_partner_id)}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs max-w-sm truncate">{wp.description ?? '—'}</td>
                      {canManage && (
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(wp); setDialogOpen(true) }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRemoveTarget(wp)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <WpDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        proposal={proposal}
        editing={editing}
        partners={partners}
        existingWpNumbers={wps.map((w) => w.wp_number)}
        onSaved={() => { setDialogOpen(false); void load() }}
      />

      <ConfirmModal
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove work package"
        message={`Remove WP${removeTarget?.wp_number} "${removeTarget?.title}"? Any partner budget lines referencing it will also be removed.`}
        confirmLabel="Remove"
        destructive
        onConfirm={handleRemove}
      />
    </>
  )
}

interface WpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposal: Proposal
  editing: ProposalWorkPackage | null
  partners: ProposalPartner[]
  existingWpNumbers: number[]
  onSaved: () => void
}

function WpDialog({ open, onOpenChange, proposal, editing, partners, existingWpNumbers, onSaved }: WpDialogProps) {
  const [wpNumber, setWpNumber] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [leaderId, setLeaderId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      if (editing) {
        setWpNumber(String(editing.wp_number))
        setTitle(editing.title)
        setDescription(editing.description ?? '')
        setLeaderId(editing.leader_partner_id ?? '')
      } else {
        const next = existingWpNumbers.length === 0 ? 1 : Math.max(...existingWpNumbers) + 1
        setWpNumber(String(next))
        setTitle('')
        setDescription('')
        setLeaderId('')
      }
    }
  }, [open, editing, existingWpNumbers])

  const handleSave = async () => {
    const n = parseInt(wpNumber, 10)
    if (!n || n < 1) {
      toast({ title: 'Enter a positive WP number', variant: 'destructive' })
      return
    }
    if (!title.trim()) {
      toast({ title: 'Enter a title', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await proposalWorkPackageService.update(editing.id, {
          wp_number: n,
          title: title.trim(),
          description: description.trim() || null,
          leader_partner_id: leaderId || null,
        })
      } else {
        await proposalWorkPackageService.create({
          proposal_id: proposal.id,
          wp_number: n,
          title: title.trim(),
          description: description.trim() || null,
          leader_partner_id: leaderId || null,
        })
      }
      onSaved()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit work package' : 'Add work package'}</DialogTitle>
          <DialogDescription>
            Minimal WP definition — number, title, and optional lead partner. Partners will commit
            person-months per WP via their Budget form.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label>WP number *</Label>
              <Input type="number" min={1} value={wpNumber} onChange={(e) => setWpNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Project Coordination" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Lead partner</Label>
            <select
              value={leaderId}
              onChange={(e) => setLeaderId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— Not assigned —</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.org_name}{p.is_host ? ' (coordinator)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{editing ? 'Save changes' : 'Add WP'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
