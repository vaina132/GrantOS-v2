import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  ArrowLeft,
  Save,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import {
  proposalBudgetService,
  proposalSubmissionService,
  proposalWorkPackageService,
  proposalAuditService,
} from '@/services/proposalWorkflowService'
import type {
  Proposal,
  ProposalPartner,
  ProposalDocument,
  ProposalSubmission,
  ProposalBudget,
  ProposalBudgetLine,
  ProposalPartnerBudgetRole,
  ProposalWorkPackage,
} from '@/types'

/**
 * Budget form — the partner fills in their slice of the consortium budget.
 *
 *   Header  → one row per partner/proposal in `proposal_budgets`
 *   Lines   → one row per (budget, work package) in `proposal_budget_lines`
 *
 * The form computes totals live. `Save draft` upserts the header then
 * replaces the lines; `Submit for review` flips the submission status.
 */

type HeaderState = {
  pm_rate_currency: string
  pm_rate_amount: number | null
  budget_travel: number
  budget_subcontracting: number
  budget_equipment: number
  budget_other_goods: number
  funding_rate: number
  indirect_cost_rate: number
  indirect_cost_base: ProposalBudget['indirect_cost_base']
  notes: string
}

type LineState = {
  wp_id: string
  person_months: number
  partner_role: ProposalPartnerBudgetRole
  notes: string
}

const EMPTY_HEADER: HeaderState = {
  pm_rate_currency: 'EUR',
  pm_rate_amount: null,
  budget_travel: 0,
  budget_subcontracting: 0,
  budget_equipment: 0,
  budget_other_goods: 0,
  funding_rate: 100,
  indirect_cost_rate: 25,
  indirect_cost_base: 'all_except_subcontracting',
  notes: '',
}

interface Props {
  proposal: Proposal
  partner: ProposalPartner
  document: ProposalDocument
  submission: ProposalSubmission | null
  locked: boolean
  onBack: () => void
  onChanged: () => void
}

export function ProposalBudgetForm({
  proposal, partner, document, submission, locked, onBack, onChanged,
}: Props) {
  const { user } = useAuthStore()
  const [header, setHeader] = useState<HeaderState>(EMPTY_HEADER)
  const [wps, setWps] = useState<ProposalWorkPackage[]>([])
  const [lines, setLines] = useState<LineState[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [budget, wpRows] = await Promise.all([
          proposalBudgetService.get(proposal.id, partner.id),
          proposalWorkPackageService.list(proposal.id),
        ])
        if (cancelled) return

        setWps(wpRows)

        if (budget) {
          setHeader({
            pm_rate_currency: budget.pm_rate_currency ?? 'EUR',
            pm_rate_amount: budget.pm_rate_amount,
            budget_travel: budget.budget_travel ?? 0,
            budget_subcontracting: budget.budget_subcontracting ?? 0,
            budget_equipment: budget.budget_equipment ?? 0,
            budget_other_goods: budget.budget_other_goods ?? 0,
            funding_rate: budget.funding_rate ?? 100,
            indirect_cost_rate: budget.indirect_cost_rate ?? 25,
            indirect_cost_base: budget.indirect_cost_base ?? 'all_except_subcontracting',
            notes: budget.notes ?? '',
          })
          setLastSavedAt(new Date(budget.updated_at))
          // Seed lines from persisted values, one per existing WP. Any WP
          // without a stored line starts at 0 PMs.
          const byWp = new Map<string, ProposalBudgetLine>()
          for (const l of budget.lines ?? []) byWp.set(l.wp_id, l)
          setLines(wpRows.map(wp => {
            const l = byWp.get(wp.id)
            return {
              wp_id: wp.id,
              person_months: l?.person_months ?? 0,
              partner_role: l?.partner_role ?? 'partner',
              notes: l?.notes ?? '',
            }
          }))
        } else {
          setHeader(EMPTY_HEADER)
          setLines(wpRows.map(wp => ({
            wp_id: wp.id, person_months: 0, partner_role: 'partner', notes: '',
          })))
        }
      } catch (err) {
        toast({
          title: 'Error loading budget',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [proposal.id, partner.id])

  const patchHeader = useCallback(<K extends keyof HeaderState>(key: K, value: HeaderState[K]) => {
    setHeader(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }, [])

  const patchLine = useCallback((wpId: string, patch: Partial<LineState>) => {
    setLines(prev => prev.map(l => l.wp_id === wpId ? { ...l, ...patch } : l))
    setDirty(true)
  }, [])

  // ── Derived totals ──────────────────────────────────────────────
  const totals = useMemo(() => {
    const currency = header.pm_rate_currency || 'EUR'
    const rate = header.pm_rate_amount ?? 0
    const pms = lines.reduce((sum, l) => sum + (l.person_months || 0), 0)
    const personnel = pms * rate
    const directExSub =
      personnel + header.budget_travel + header.budget_equipment + header.budget_other_goods
    const directAll = directExSub + header.budget_subcontracting

    let indirectBase = 0
    switch (header.indirect_cost_base) {
      case 'all_direct':                indirectBase = directAll; break
      case 'personnel_only':            indirectBase = personnel; break
      case 'all_except_subcontracting': indirectBase = directExSub; break
    }
    const indirect = indirectBase * (header.indirect_cost_rate / 100)
    const total = directAll + indirect
    const funded = total * (header.funding_rate / 100)

    return {
      currency, rate, pms, personnel, directAll, indirect, total, funded,
    }
  }, [header, lines])

  const doSave = useCallback(async (opts?: { silent?: boolean }): Promise<boolean> => {
    if (saving || submitting) return false
    setSaving(true)
    try {
      const savedHeader = await proposalBudgetService.upsertHeader({
        proposal_id: proposal.id,
        partner_id: partner.id,
        ...header,
        notes: header.notes || null,
      })
      await proposalBudgetService.replaceLines(
        savedHeader.id,
        lines
          .filter(l => l.person_months > 0 || l.notes)
          .map(l => ({
            wp_id: l.wp_id,
            person_months: l.person_months,
            partner_role: l.partner_role,
            notes: l.notes || null,
          })),
      )
      setLastSavedAt(new Date())
      setDirty(false)

      let sub = submission
      if (!sub) {
        sub = await proposalSubmissionService.ensure({
          proposal_id: proposal.id,
          partner_id: partner.id,
          document_id: document.id,
        })
      }
      if (sub.status === 'not_started') {
        await proposalSubmissionService.setStatus(sub.id, 'in_progress')
        await proposalAuditService.log({
          proposal_id: proposal.id,
          actor_user_id: user?.id ?? null,
          actor_name: null,
          actor_role: 'partner',
          event_type: 'submission_started',
          target_partner_id: partner.id,
          target_document_id: document.id,
          target_submission_id: sub.id,
          note: 'Budget draft started',
        }).catch(() => {})
      }
      if (!opts?.silent) {
        toast({ title: 'Budget saved', description: 'Your changes are safe.' })
      }
      return true
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
      return false
    } finally {
      setSaving(false)
    }
  }, [header, lines, proposal.id, partner.id, document.id, saving, submitting, submission, user?.id])

  // Auto-save on unmount if dirty.
  useEffect(() => {
    return () => {
      if (dirty && !locked) {
        void doSave({ silent: true })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, locked])

  const handleSubmitForReview = async () => {
    if (submitting || saving) return
    setSubmitting(true)
    try {
      const ok = await doSave({ silent: true })
      if (!ok) return
      const sub = submission ?? await proposalSubmissionService.ensure({
        proposal_id: proposal.id,
        partner_id: partner.id,
        document_id: document.id,
      })
      await proposalSubmissionService.setStatus(sub.id, 'submitted')
      await proposalAuditService.log({
        proposal_id: proposal.id,
        actor_user_id: user?.id ?? null,
        actor_name: null,
        actor_role: 'partner',
        event_type: 'submission_submitted',
        target_partner_id: partner.id,
        target_document_id: document.id,
        target_submission_id: sub.id,
        note: 'Budget submitted for review',
      }).catch(() => {})
      toast({
        title: 'Submitted',
        description: 'Your Budget is now with the coordinator for review.',
      })
      onChanged()
      onBack()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Submit failed',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  const canSubmit = !!header.pm_rate_amount && header.pm_rate_amount > 0 && !locked
  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(n))

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <Card>
        <CardContent className="pt-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <h2 className="text-lg font-semibold mt-1">{document.label}</h2>
            <p className="text-sm text-muted-foreground">
              {partner.org_name} · {proposal.project_name}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 text-xs">
            {lastSavedAt && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                Saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            {dirty && <span className="text-amber-700">Unsaved changes</span>}
            {submission?.status && (
              <Badge variant="outline" className="text-[10px] mt-1 capitalize">
                {submission.status.replace('_', ' ')}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {locked && (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="py-3 flex items-start gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-emerald-600 mt-0.5" />
            <span className="text-emerald-800 dark:text-emerald-300">
              This proposal has been converted. Your submission is archived and read-only.
            </span>
          </CardContent>
        </Card>
      )}

      {submission?.status === 'needs_revision' && submission.review_note && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="py-3 text-sm">
            <div className="font-medium text-red-800 dark:text-red-300 mb-1">
              Coordinator requested a revision
            </div>
            <div className="text-red-900 dark:text-red-200 whitespace-pre-wrap">
              {submission.review_note}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rate & funding */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Rate & funding</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 grid gap-4 sm:grid-cols-4">
          <Field label="Currency">
            <Input value={header.pm_rate_currency} maxLength={3}
              onChange={e => patchHeader('pm_rate_currency', e.target.value.toUpperCase())}
              disabled={locked} />
          </Field>
          <Field label="Average PM rate *">
            <Input type="number" inputMode="decimal"
              value={header.pm_rate_amount ?? ''}
              onChange={e => patchHeader('pm_rate_amount', e.target.value === '' ? null : Number(e.target.value))}
              disabled={locked} placeholder="e.g. 9500" />
          </Field>
          <Field label="Funding rate (%)">
            <Input type="number" min={0} max={100}
              value={header.funding_rate}
              onChange={e => patchHeader('funding_rate', Number(e.target.value) || 0)}
              disabled={locked} />
          </Field>
          <Field label="Indirect cost rate (%)">
            <Input type="number" min={0} max={100}
              value={header.indirect_cost_rate}
              onChange={e => patchHeader('indirect_cost_rate', Number(e.target.value) || 0)}
              disabled={locked} />
          </Field>
          <Field label="Indirect cost base" full>
            <Select
              value={header.indirect_cost_base}
              onChange={v => patchHeader('indirect_cost_base', v as HeaderState['indirect_cost_base'])}
              disabled={locked}
              options={[
                { value: 'all_direct',                label: 'All direct costs' },
                { value: 'personnel_only',            label: 'Personnel only' },
                { value: 'all_except_subcontracting', label: 'All except subcontracting (Horizon Europe default)' },
              ]} />
          </Field>
        </CardContent>
      </Card>

      {/* Per-WP personnel effort */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Personnel effort per work package</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {wps.length === 0 ? (
            <div className="rounded border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              <Info className="inline h-4 w-4 mr-1 mb-0.5" />
              The coordinator has not yet defined the work packages. Once they do, they will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium w-16">WP</th>
                    <th className="px-3 py-2 text-left font-medium">Title</th>
                    <th className="px-3 py-2 text-right font-medium w-32">Person-months</th>
                    <th className="px-3 py-2 text-left font-medium w-40">Role</th>
                    <th className="px-3 py-2 text-left font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {wps.map(wp => {
                    const line = lines.find(l => l.wp_id === wp.id)!
                    return (
                      <tr key={wp.id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-mono text-xs">WP{wp.wp_number}</td>
                        <td className="px-3 py-2">{wp.title}</td>
                        <td className="px-3 py-2">
                          <Input type="number" min={0} step={0.1}
                            value={line.person_months || ''}
                            onChange={e => patchLine(wp.id, { person_months: Number(e.target.value) || 0 })}
                            disabled={locked}
                            className="text-right" />
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            value={line.partner_role}
                            onChange={v => patchLine(wp.id, { partner_role: v as ProposalPartnerBudgetRole })}
                            disabled={locked}
                            options={[
                              { value: 'lead',        label: 'WP Lead' },
                              { value: 'partner',     label: 'Partner' },
                              { value: 'contributor', label: 'Contributor' },
                            ]} />
                        </td>
                        <td className="px-3 py-2">
                          <Input value={line.notes}
                            onChange={e => patchLine(wp.id, { notes: e.target.value })}
                            disabled={locked}
                            placeholder="optional" />
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="bg-muted/30 font-medium">
                    <td className="px-3 py-2" colSpan={2}>Total person-months</td>
                    <td className="px-3 py-2 text-right">{totals.pms.toFixed(1)}</td>
                    <td className="px-3 py-2" colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Other direct costs */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Other direct cost categories ({totals.currency})</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 grid gap-4 sm:grid-cols-4">
          <Field label="Travel">
            <Input type="number" min={0} value={header.budget_travel}
              onChange={e => patchHeader('budget_travel', Number(e.target.value) || 0)} disabled={locked} />
          </Field>
          <Field label="Subcontracting">
            <Input type="number" min={0} value={header.budget_subcontracting}
              onChange={e => patchHeader('budget_subcontracting', Number(e.target.value) || 0)} disabled={locked} />
          </Field>
          <Field label="Equipment">
            <Input type="number" min={0} value={header.budget_equipment}
              onChange={e => patchHeader('budget_equipment', Number(e.target.value) || 0)} disabled={locked} />
          </Field>
          <Field label="Other goods & services">
            <Input type="number" min={0} value={header.budget_other_goods}
              onChange={e => patchHeader('budget_other_goods', Number(e.target.value) || 0)} disabled={locked} />
          </Field>
        </CardContent>
      </Card>

      {/* Totals + notes */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Totals</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 grid gap-3 sm:grid-cols-4 text-sm">
          <Stat label="Personnel" value={`${fmt(totals.personnel)} ${totals.currency}`} />
          <Stat label="Direct costs" value={`${fmt(totals.directAll)} ${totals.currency}`} />
          <Stat label="Indirect costs" value={`${fmt(totals.indirect)} ${totals.currency}`} />
          <Stat label="Total budget" value={`${fmt(totals.total)} ${totals.currency}`} strong />
          <Stat
            label={`Funded (${header.funding_rate}%)`}
            value={`${fmt(totals.funded)} ${totals.currency}`}
            strong
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Notes for the coordinator</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <textarea
            value={header.notes}
            onChange={e => patchHeader('notes', e.target.value)}
            rows={3} disabled={locked}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Any caveats, currency conversion notes, dependencies on another partner…"
          />
        </CardContent>
      </Card>

      {/* Action bar */}
      <div className="sticky bottom-4 z-10">
        <Card className="shadow-lg">
          <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-muted-foreground">
              {canSubmit
                ? 'Ready to submit. The coordinator can still request revisions.'
                : 'Fill in the average PM rate to submit.'}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={locked || saving || !dirty} onClick={() => void doSave()}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Save draft
              </Button>
              <Button size="sm" disabled={locked || submitting || !canSubmit} onClick={() => void handleSubmitForReview()}>
                {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                Submit for review
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Local UI helpers
// ────────────────────────────────────────────────────────────────────────────

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={cn('space-y-1.5', full && 'sm:col-span-4')}>
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  )
}

function Select({
  value, onChange, options, disabled,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('mt-0.5 tabular-nums', strong ? 'text-lg font-semibold' : 'text-sm font-medium')}>
        {value}
      </div>
    </div>
  )
}
