import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { AlertCircle, Loader2, Users, LayoutGrid, Coins } from 'lucide-react'
import {
  proposalPartnerService,
  proposalWorkPackageService,
  convertProposalToProject,
} from '@/services/proposalWorkflowService'
import type { Proposal, ProposalPartner, ProposalWorkPackage } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposal: Proposal
  onConverted: (newProjectId: string) => void
}

/**
 * Convert-to-Project confirmation. Model D: the new project lives only in
 * the coordinator's org; external partners keep READ access to the now-
 * locked proposal, but do NOT automatically carry over to the project.
 * The coordinator sees the full partner list here and can tick which
 * partners they want to re-invite to the new project after conversion.
 *
 * The re-invite pass happens AFTER the RPC succeeds; the RPC itself is
 * atomic and only creates the project + WPs + aggregated budget.
 * (The re-invite step is a v2 enhancement — for now we show the list for
 * visibility and note that the coordinator can re-invite from the project
 * Partners tab afterwards.)
 */
export function ProposalConvertDialog({ open, onOpenChange, proposal, onConverted }: Props) {
  const [loading, setLoading] = useState(true)
  const [partners, setPartners] = useState<ProposalPartner[]>([])
  const [wps, setWps] = useState<ProposalWorkPackage[]>([])
  const [converting, setConverting] = useState(false)

  // Partners the coordinator plans to re-invite after conversion.
  // Currently surfaced for UX confirmation only — we don't auto-send invites
  // in this commit. The coordinator goes to the new project's Partners tab
  // and re-invites from there. Still useful to show the checklist so they
  // make an informed decision before clicking Convert.
  const [reinviteIds, setReinviteIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      proposalPartnerService.list(proposal.id),
      proposalWorkPackageService.list(proposal.id),
    ])
      .then(([ps, ws]) => {
        setPartners(ps)
        setWps(ws)
        // Default: none ticked — coordinator makes an explicit choice.
        setReinviteIds(new Set())
      })
      .catch((err) => toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to load conversion summary',
        variant: 'destructive',
      }))
      .finally(() => setLoading(false))
  }, [open, proposal.id])

  const externals = partners.filter((p) => !p.is_host && p.invite_status === 'accepted')

  const handleConvert = async () => {
    setConverting(true)
    try {
      const newProjectId = await convertProposalToProject(proposal.id)
      toast({
        title: 'Proposal converted',
        description: externals.length > 0 && reinviteIds.size > 0
          ? `Project created. Re-invite partners from the project's Partners tab.`
          : 'Project created.',
      })
      onConverted(newProjectId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Conversion failed'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setConverting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Convert proposal to project</DialogTitle>
          <DialogDescription>
            A new project will be created in your organisation. The proposal
            and its submissions stay in GrantLume as a read-only archive —
            your external partners keep access to view their own contributions.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{wps.length}</span> work package{wps.length === 1 ? '' : 's'} carried forward
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Coins className="h-4 w-4 text-muted-foreground" />
                Partner budgets aggregated onto your organisation as the project's host partner
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{externals.length}</span> external partner{externals.length === 1 ? '' : 's'} — not automatically carried forward
              </div>
            </div>

            {externals.length > 0 && (
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-2">
                  External partners (the proposal stays visible to them; tick those you plan
                  to invite to the new project — you can send invites from the project's
                  Partners tab after conversion):
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {externals.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer hover:bg-muted/40 rounded px-1">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={reinviteIds.has(p.id)}
                        onChange={(e) => {
                          setReinviteIds((prev) => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(p.id)
                            else next.delete(p.id)
                            return next
                          })
                        }}
                      />
                      <span className="font-medium">{p.org_name}</span>
                      {p.contact_email && <span className="text-xs text-muted-foreground">· {p.contact_email}</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  This action is <strong>permanent</strong>. After conversion, the proposal
                  and all partner submissions become read-only. You can access the new project
                  in the Projects module.
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={converting}>Cancel</Button>
          <Button onClick={handleConvert} disabled={converting || loading}>
            {converting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Convert & create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
