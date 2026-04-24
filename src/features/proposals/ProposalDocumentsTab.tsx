import { useEffect, useMemo, useState } from 'react'
import {
  Circle,
  CheckCircle2,
  Clock,
  Ban,
  Loader2,
  Sparkles,
  ExternalLink,
  Download,
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import {
  proposalDocumentService,
  proposalPartnerService,
  proposalSubmissionService,
  proposalAuditService,
  proposalCallTemplateService,
  DOCUMENT_PRESETS,
  type PresetDocumentKey,
} from '@/services/proposalWorkflowService'
import type {
  Proposal,
  ProposalDocument,
  ProposalDocumentHandler,
  ProposalPartner,
  ProposalSubmission,
  ProposalSubmissionStatus,
} from '@/types'
import { ProposalFormPreview } from './ProposalFormPreview'
import { generateOcdTemplatePdf } from '@/lib/ocdTemplate'

const STATUS_META: Record<ProposalSubmissionStatus, {
  label: string
  badgeClass: string
  cellClass: string
  icon: typeof Circle
}> = {
  not_started:     { label: 'Not started',    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',   cellClass: 'bg-transparent',                icon: Circle },
  in_progress:     { label: 'In progress',    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',       cellClass: 'bg-blue-50/40',                 icon: Clock },
  submitted:       { label: 'Submitted',      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',    cellClass: 'bg-amber-50/40',                icon: Sparkles },
  approved:        { label: 'Approved',       badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', cellClass: 'bg-emerald-50/50',           icon: CheckCircle2 },
  needs_revision:  { label: 'Needs revision', badgeClass: 'bg-red-50 text-red-700 border-red-200',          cellClass: 'bg-red-50/40',                  icon: Ban },
}

interface Props {
  proposal: Proposal
  canManage: boolean
}

export function ProposalDocumentsTab({ proposal, canManage }: Props) {
  const { user } = useAuthStore()
  const [documents, setDocuments] = useState<ProposalDocument[]>([])
  const [partners, setPartners] = useState<ProposalPartner[]>([])
  const [submissions, setSubmissions] = useState<ProposalSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<{ partner: ProposalPartner; doc: ProposalDocument; submission: ProposalSubmission | null } | null>(null)
  const [managing, setManaging] = useState(false)
  const [reseeding, setReseeding] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [docs, parts, subs] = await Promise.all([
        proposalDocumentService.list(proposal.id),
        proposalPartnerService.list(proposal.id),
        proposalSubmissionService.list(proposal.id),
      ])
      setDocuments(docs)
      setPartners(parts)
      setSubmissions(subs)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to load documents',
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

  // Subject partners to render in the matrix: the host + external non-declined.
  const visiblePartners = useMemo(
    () => partners.filter((p) => p.invite_status !== 'declined'),
    [partners],
  )

  // Lookup: partnerId -> docId -> submission
  const subLookup = useMemo(() => {
    const map = new Map<string, Map<string, ProposalSubmission>>()
    for (const s of submissions) {
      if (!map.has(s.partner_id)) map.set(s.partner_id, new Map())
      map.get(s.partner_id)!.set(s.document_id, s)
    }
    return map
  }, [submissions])

  const getSubmission = (partnerId: string, docId: string) =>
    subLookup.get(partnerId)?.get(docId) ?? null

  const openCell = (partner: ProposalPartner, doc: ProposalDocument) => {
    const sub = getSubmission(partner.id, doc.id)
    setSelected({ partner, doc, submission: sub })
  }

  const handleReview = async (
    status: ProposalSubmissionStatus,
    note: string,
  ) => {
    if (!selected) return
    let sub = selected.submission
    try {
      if (!sub) {
        sub = await proposalSubmissionService.ensure({
          proposal_id: proposal.id,
          partner_id: selected.partner.id,
          document_id: selected.doc.id,
        })
      }
      await proposalSubmissionService.setStatus(sub.id, status, note || null)
      await proposalAuditService.log({
        proposal_id: proposal.id,
        actor_user_id: user?.id ?? null,
        actor_name: null,
        actor_role: 'coordinator',
        event_type: status === 'approved' ? 'submission_approved'
          : status === 'needs_revision' ? 'submission_rejected'
          : 'submission_updated',
        target_partner_id: selected.partner.id,
        target_document_id: selected.doc.id,
        target_submission_id: sub.id,
        note: note || null,
      }).catch(() => {})
      toast({ title: status === 'approved' ? 'Approved' : 'Revision requested' })
      setSelected(null)
      void load()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update submission',
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">
            Document submissions
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {documents.length} document{documents.length === 1 ? '' : 's'} · {visiblePartners.length} partner{visiblePartners.length === 1 ? '' : 's'}
            </span>
          </CardTitle>
          {canManage && (
            <div className="flex gap-2">
              {proposal.call_template_id && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={reseeding}
                  title="Add any documents from this proposal's preset that aren't already in the checklist. Existing rows are preserved."
                  onClick={async () => {
                    if (!proposal.call_template_id) return
                    setReseeding(true)
                    try {
                      const templates = await proposalCallTemplateService.list(proposal.org_id)
                      const tpl = templates.find((t) => t.id === proposal.call_template_id)
                      if (!tpl) {
                        toast({
                          title: 'Preset not found',
                          description: 'The preset linked to this proposal no longer exists.',
                          variant: 'destructive',
                        })
                        return
                      }
                      const beforeCount = documents.length
                      const result = await proposalDocumentService.reseedFromTemplate(proposal.id, tpl, { mode: 'append_missing' })
                      const added = result.length - beforeCount
                      toast({
                        title: added > 0 ? 'Checklist updated' : 'Nothing to add',
                        description:
                          added > 0
                            ? `Added ${added} document${added === 1 ? '' : 's'} from the preset.`
                            : 'Every document from the preset is already on this proposal.',
                      })
                      void load()
                    } catch (err) {
                      toast({
                        title: 'Re-seed failed',
                        description: err instanceof Error ? err.message : 'Unknown error',
                        variant: 'destructive',
                      })
                    } finally {
                      setReseeding(false)
                    }
                  }}
                >
                  {reseeding
                    ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    : <Sparkles className="h-4 w-4 mr-1" />}
                  Re-seed from preset
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setManaging(true)}
                title="Edit the checklist of required documents"
              >
                <Plus className="h-4 w-4 mr-1" /> Manage documents
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : documents.length === 0 ? (
            canManage ? (
              <EmptyStateActions
                proposalId={proposal.id}
                onSeeded={load}
              />
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">
                The coordinator hasn&apos;t set up the document checklist yet.
              </div>
            )
          ) : visiblePartners.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No partners yet. Invite partners from the Partners tab — they'll appear here with their submissions.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium sticky left-0 bg-muted/50 z-10">Partner</th>
                      {documents.map((d) => (
                        <th key={d.id} className="px-3 py-2 text-center font-medium text-xs min-w-[140px]">
                          <div className="truncate" title={d.label}>{d.label}</div>
                          {d.required ? null : (
                            <div className="text-[10px] font-normal text-muted-foreground">optional</div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePartners.map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="px-3 py-2 sticky left-0 bg-background">
                          <div className="font-medium text-sm truncate max-w-[180px]" title={p.org_name}>
                            {p.org_name}
                            {p.is_host && <span className="ml-1.5 text-[10px] text-primary">(host)</span>}
                          </div>
                          <div className="text-[10px] text-muted-foreground capitalize">{p.role}</div>
                        </td>
                        {documents.map((d) => {
                          const s = getSubmission(p.id, d.id)
                          const status = (s?.status ?? 'not_started') as ProposalSubmissionStatus
                          const meta = STATUS_META[status]
                          const Icon = meta.icon
                          return (
                            <td key={d.id} className={cn('px-2 py-2 text-center', meta.cellClass)}>
                              <button
                                onClick={() => openCell(p, d)}
                                className="group inline-flex flex-col items-center gap-1 w-full rounded px-2 py-1 hover:bg-background/60 focus:outline-none focus:ring-2 focus:ring-ring"
                                title={`${p.org_name} — ${d.label}: ${meta.label}`}
                              >
                                <Icon className={cn('h-4 w-4', {
                                  'text-muted-foreground': status === 'not_started',
                                  'text-blue-600': status === 'in_progress',
                                  'text-amber-600': status === 'submitted',
                                  'text-emerald-600': status === 'approved',
                                  'text-red-600': status === 'needs_revision',
                                })} />
                                <span className="text-[10px] text-muted-foreground">{meta.label}</span>
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Legend />
            </>
          )}
        </CardContent>
      </Card>

      {selected && (
        <ReviewPanel
          proposal={proposal}
          partner={selected.partner}
          doc={selected.doc}
          submission={selected.submission}
          canReview={canManage}
          onClose={() => setSelected(null)}
          onReview={handleReview}
          onRefresh={() => void load()}
        />
      )}

      {managing && (
        <ManageDocumentsPanel
          proposalId={proposal.id}
          onClose={() => setManaging(false)}
          onChanged={() => void load()}
        />
      )}
    </>
  )
}

/**
 * Empty-state CTA shown when a proposal has no required documents yet.
 * One-click creates the universal baseline (Part A + Budget + OCD); the
 * coordinator can then add optional extras or customise in Manage.
 */
function EmptyStateActions({
  proposalId,
  onSeeded,
}: {
  proposalId: string
  onSeeded: () => void
}) {
  const [seeding, setSeeding] = useState(false)
  const seedBaseline = async () => {
    setSeeding(true)
    try {
      await proposalDocumentService.seedBaseline(proposalId)
      toast({
        title: 'Checklist ready',
        description: 'Added Part A, Budget, and Ownership Control Declaration. Invite your partners to start filling them.',
      })
      onSeeded()
    } catch (err) {
      toast({
        title: 'Could not seed checklist',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSeeding(false)
    }
  }
  return (
    <div className="py-10 text-center space-y-4">
      <div className="mx-auto max-w-md space-y-1.5">
        <p className="text-sm font-medium">No document checklist yet</p>
        <p className="text-xs text-muted-foreground">
          Start with the three documents every EU-style proposal needs: Part A,
          Budget, and an Ownership Control Declaration. You can add custom documents
          afterwards.
        </p>
      </div>
      <Button size="sm" disabled={seeding} onClick={seedBaseline}>
        {seeding
          ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          : <Sparkles className="mr-1.5 h-4 w-4" />}
        Add Part A, Budget &amp; OCD
      </Button>
    </div>
  )
}

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
      {(Object.keys(STATUS_META) as ProposalSubmissionStatus[]).map((s) => {
        const m = STATUS_META[s]
        const Icon = m.icon
        return (
          <div key={s} className="flex items-center gap-1.5">
            <Icon className="h-3 w-3" /> {m.label}
          </div>
        )
      })}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Review panel
// ────────────────────────────────────────────────────────────────────────────

interface PanelProps {
  proposal: Proposal
  partner: ProposalPartner
  doc: ProposalDocument
  submission: ProposalSubmission | null
  canReview: boolean
  onClose: () => void
  onReview: (status: ProposalSubmissionStatus, note: string) => Promise<void>
  onRefresh: () => void
}

function ReviewPanel({ proposal, partner, doc, submission, canReview, onClose, onReview }: PanelProps) {
  const [note, setNote] = useState('')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    setNote(submission?.review_note ?? '')
  }, [submission?.id, submission?.review_note])

  const status = (submission?.status ?? 'not_started') as ProposalSubmissionStatus
  const meta = STATUS_META[status]

  const handleDownload = async () => {
    if (!submission?.current_version_id) return
    setDownloading(true)
    try {
      const { data: ver, error } = await (supabase as any)
        .from('proposal_submission_versions')
        .select('storage_bucket, storage_path, original_file_name')
        .eq('id', submission.current_version_id)
        .single()
      if (error || !ver) throw error || new Error('Version not found')
      const { data: signed } = await supabase.storage
        .from(ver.storage_bucket)
        .createSignedUrl(ver.storage_path, 60 * 10)
      if (signed?.signedUrl) {
        window.open(signed.signedUrl, '_blank', 'noopener')
      } else {
        throw new Error('Could not create download link')
      }
    } catch (err) {
      toast({
        title: 'Download failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-lg h-full bg-background border-l shadow-xl overflow-y-auto">
        <div className="sticky top-0 z-10 bg-background border-b p-4 flex items-start justify-between gap-2">
          <div>
            <div className="text-xs text-muted-foreground">{partner.org_name}</div>
            <div className="text-base font-semibold">{doc.label}</div>
            <Badge variant="outline" className={cn('mt-1 text-[10px]', meta.badgeClass)}>
              {meta.label}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {doc.description && (
            <p className="text-xs text-muted-foreground">{doc.description}</p>
          )}

          {doc.template_url && (
            <a
              href={doc.template_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Official template on EC Portal
            </a>
          )}

          {/* Built-in OCD template — the EC doesn't publish a single stable
              OCD PDF, so we generate a blank one modelled on their format.
              Shown whenever the doc is an OCD OR when the coordinator left
              `template_url` blank on any upload_with_template doc. */}
          {doc.document_type === 'ownership_control' && !doc.template_url && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => generateOcdTemplatePdf({ partnerName: partner.org_name })}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Download blank OCD template (PDF)
            </Button>
          )}

          {doc.handler === 'form' ? (
            (doc.document_type === 'part_a' || doc.document_type === 'budget') ? (
              <ProposalFormPreview
                proposalId={proposal.id}
                partnerId={partner.id}
                kind={doc.document_type}
              />
            ) : (
              <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                No preview available for this form type.
              </div>
            )
          ) : (
            <div className="rounded-lg border p-3">
              {submission?.current_version_id ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm">
                    Last upload
                    {submission.submitted_at && (
                      <span className="text-muted-foreground ml-1.5 text-xs">
                        · submitted {new Date(submission.submitted_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
                    {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                    Download
                  </Button>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No file uploaded yet.</div>
              )}
            </div>
          )}

          {canReview && submission && submission.status !== 'not_started' && (
            <div className="space-y-2 pt-2 border-t">
              <label className="text-xs font-medium text-muted-foreground">
                Comment to partner (optional for Approve, required for Revision)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Explain what needs to change…"
              />
              <div className="flex gap-2 justify-end pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!note.trim()) {
                      toast({ title: 'Please add a comment explaining the revision', variant: 'destructive' })
                      return
                    }
                    void onReview('needs_revision', note)
                  }}
                >
                  <Ban className="h-3.5 w-3.5 mr-1" /> Request revision
                </Button>
                <Button
                  size="sm"
                  onClick={() => void onReview('approved', note)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                </Button>
              </div>
            </div>
          )}

          {submission?.review_note && status === 'needs_revision' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
              <div className="text-xs font-medium text-red-800 mb-1">Revision requested</div>
              <div className="text-red-900 whitespace-pre-wrap">{submission.review_note}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
  void proposal
}

// ────────────────────────────────────────────────────────────────────────────
// Manage-documents side drawer — CRUD for the per-proposal document checklist
// ────────────────────────────────────────────────────────────────────────────

const HANDLER_OPTIONS: Array<{ value: ProposalDocumentHandler; label: string }> = [
  { value: 'upload',                label: 'File upload' },
  { value: 'upload_with_template',  label: 'File upload (with template link)' },
  { value: 'form',                  label: 'Built-in form' },
]

interface ManagePanelProps {
  proposalId: string
  onClose: () => void
  onChanged: () => void
}

function ManageDocumentsPanel({ proposalId, onClose, onChanged }: ManagePanelProps) {
  const [docs, setDocs] = useState<ProposalDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const list = await proposalDocumentService.list(proposalId)
      setDocs(list)
    } catch (err) {
      toast({
        title: 'Error loading documents',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId])

  const handleAdd = async () => {
    setAdding(true)
    try {
      const maxOrder = docs.length === 0 ? 0 : Math.max(...docs.map((d) => d.sort_order)) + 1
      const created = await proposalDocumentService.create({
        proposal_id: proposalId,
        document_type: `custom_${Date.now()}`,
        label: 'New document',
        description: null,
        handler: 'upload',
        template_url: null,
        required: true,
        sort_order: maxOrder,
      })
      setDocs((prev) => [...prev, created])
      onChanged()
      toast({ title: 'Document added' })
    } catch (err) {
      toast({
        title: 'Add failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setAdding(false)
    }
  }

  /** One-click add a common EC document by preset key. Idempotent — if
   *  the document_type is already present, the service skips silently. */
  const handleAddPreset = async (key: PresetDocumentKey) => {
    setAdding(true)
    try {
      const created = await proposalDocumentService.addPreset(proposalId, key)
      if (!created) {
        toast({
          title: 'Already on the checklist',
          description: `${DOCUMENT_PRESETS[key].label} is already configured.`,
        })
        return
      }
      setDocs((prev) => [...prev, created])
      onChanged()
      toast({ title: 'Added', description: created.label })
    } catch (err) {
      toast({
        title: 'Add failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setAdding(false)
    }
  }

  const handlePatch = async (id: string, patch: Partial<ProposalDocument>) => {
    setBusyId(id)
    // Optimistic update
    setDocs((prev) => prev.map((d) => (d.id === id ? ({ ...d, ...patch } as ProposalDocument) : d)))
    try {
      const updated = await proposalDocumentService.update(id, patch)
      setDocs((prev) => prev.map((d) => (d.id === id ? updated : d)))
      onChanged()
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
      // Reload from server on failure so UI matches truth.
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (id: string, label: string) => {
    // Pre-flight: how many submissions + uploaded versions reference this
    // document? The FK cascades (submissions → versions → storage paths),
    // so deleting here destroys partner uploads permanently. We name the
    // impact before asking for confirmation.
    setBusyId(id)
    let uploadedCount = 0
    let submittedCount = 0
    try {
      const { data: subs } = await (supabase as any)
        .from('proposal_submissions')
        .select('id, current_version_id, status')
        .eq('document_id', id)
      submittedCount = (subs ?? []).length
      uploadedCount = (subs ?? []).filter((s: any) => s.current_version_id != null).length
    } catch {
      // Non-fatal — we still let the user confirm, just without stats.
    }

    const warning = uploadedCount > 0
      ? `\n\nWARNING: ${uploadedCount} partner${uploadedCount === 1 ? '' : 's'} ${uploadedCount === 1 ? 'has' : 'have'} already uploaded a file for this document. Deleting will permanently destroy those uploads + every past version.`
      : submittedCount > 0
        ? `\n\n${submittedCount} partner submission record${submittedCount === 1 ? '' : 's'} (no files yet) will also be removed.`
        : ''

    const ok = window.confirm(
      `Delete "${label}" from the checklist?\n\nPartners will no longer see this row.${warning}\n\nType OK to confirm.`,
    )
    if (!ok) {
      setBusyId(null)
      return
    }
    try {
      await proposalDocumentService.remove(id)
      setDocs((prev) => prev.filter((d) => d.id !== id))
      onChanged()
      toast({
        title: 'Document removed',
        description: uploadedCount > 0 ? `${uploadedCount} uploaded file${uploadedCount === 1 ? '' : 's'} destroyed.` : undefined,
      })
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleMove = async (id: string, direction: -1 | 1) => {
    const ordered = [...docs].sort((a, b) => a.sort_order - b.sort_order)
    const idx = ordered.findIndex((d) => d.id === id)
    const targetIdx = idx + direction
    if (idx < 0 || targetIdx < 0 || targetIdx >= ordered.length) return
    const current = ordered[idx]
    const target = ordered[targetIdx]
    setBusyId(id)
    try {
      // Swap sort_order values
      await Promise.all([
        proposalDocumentService.update(current.id, { sort_order: target.sort_order }),
        proposalDocumentService.update(target.id,  { sort_order: current.sort_order }),
      ])
      await load()
      onChanged()
    } catch (err) {
      toast({
        title: 'Reorder failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  const sorted = [...docs].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-2xl h-full bg-background border-l shadow-xl overflow-y-auto">
        <div className="sticky top-0 z-10 bg-background border-b p-4 flex items-start justify-between gap-2">
          <div>
            <div className="text-base font-semibold">Manage documents</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              What each partner is asked to submit. Drag-equivalent ordering via the arrows.
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-3">
          {loading ? (
            <div className="py-10 text-center">
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              No documents yet. Add one to start the checklist, or create the proposal with a call template pre-selected.
            </div>
          ) : (
            sorted.map((doc, i) => (
              <DocRow
                key={doc.id}
                doc={doc}
                isFirst={i === 0}
                isLast={i === sorted.length - 1}
                busy={busyId === doc.id}
                onPatch={(patch) => handlePatch(doc.id, patch)}
                onDelete={() => handleDelete(doc.id, doc.label)}
                onMoveUp={() => handleMove(doc.id, -1)}
                onMoveDown={() => handleMove(doc.id, 1)}
              />
            ))
          )}

          {/* Preset picker — one-click add any common EC document that
              isn't already on the list. */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Add from presets
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(DOCUMENT_PRESETS) as PresetDocumentKey[]).map((key) => {
                const preset = DOCUMENT_PRESETS[key]
                const already = docs.some((d) => d.document_type === preset.document_type)
                return (
                  <Button
                    key={key}
                    size="sm"
                    variant={already ? 'secondary' : 'outline'}
                    disabled={adding || already}
                    onClick={() => handleAddPreset(key)}
                    className="text-xs"
                    title={preset.description ?? undefined}
                  >
                    {already ? <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" /> : <Plus className="h-3 w-3 mr-1" />}
                    {preset.label}
                  </Button>
                )
              })}
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleAdd}
            disabled={adding}
          >
            {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Add custom document
          </Button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Single row in the Manage Documents panel.
// Local state holds text inputs; changes flush to the parent on blur.
// Toggles (required) and selects (handler) flush immediately.
// ────────────────────────────────────────────────────────────────────────────

interface DocRowProps {
  doc: ProposalDocument
  isFirst: boolean
  isLast: boolean
  busy: boolean
  onPatch: (patch: Partial<ProposalDocument>) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

function DocRow({ doc, isFirst, isLast, busy, onPatch, onDelete, onMoveUp, onMoveDown }: DocRowProps) {
  const [label, setLabel] = useState(doc.label)
  const [description, setDescription] = useState(doc.description ?? '')
  const [templateUrl, setTemplateUrl] = useState(doc.template_url ?? '')

  // Re-sync local state if the parent hands us a fresh copy (e.g. after reorder).
  useEffect(() => { setLabel(doc.label) }, [doc.label])
  useEffect(() => { setDescription(doc.description ?? '') }, [doc.description])
  useEffect(() => { setTemplateUrl(doc.template_url ?? '') }, [doc.template_url])

  const isBuiltIn = doc.document_type === 'part_a' || doc.document_type === 'budget'

  return (
    <div className={cn(
      'rounded-lg border bg-background p-3 space-y-3',
      busy && 'opacity-60 pointer-events-none',
    )}>
      {/* Top row: order arrows · label · delete */}
      <div className="flex items-start gap-2">
        <div className="flex flex-col items-center text-muted-foreground pt-1">
          <GripVertical className="h-3.5 w-3.5 mb-0.5" />
          <button
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label="Move up"
            type="button"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label="Move down"
            type="button"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <Label className="text-xs font-medium">Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => {
                const trimmed = label.trim()
                if (!trimmed) {
                  setLabel(doc.label)
                  toast({ title: 'Label cannot be empty', variant: 'destructive' })
                  return
                }
                if (trimmed !== doc.label) onPatch({ label: trimmed })
              }}
              placeholder="e.g. Ownership declaration"
            />
          </div>

          {isBuiltIn && (
            <div className="rounded bg-muted/40 border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground">
              Built-in form ({doc.document_type === 'part_a' ? 'Part A' : 'Budget'}) —
              label and required-state are editable; handler is locked.
            </div>
          )}
        </div>

        <button
          type="button"
          className="text-muted-foreground hover:text-red-600 p-1 disabled:opacity-30"
          onClick={onDelete}
          aria-label="Delete document"
          disabled={busy}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Second row: handler · required · template URL */}
      <div className="grid sm:grid-cols-2 gap-3 pl-6">
        <div>
          <Label className="text-xs font-medium">Handler</Label>
          <select
            value={doc.handler}
            onChange={(e) => onPatch({ handler: e.target.value as ProposalDocumentHandler })}
            disabled={isBuiltIn}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {HANDLER_OPTIONS.map((h) => (
              <option key={h.value} value={h.value}>{h.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-4 pb-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={doc.required}
              onChange={(e) => onPatch({ required: e.target.checked })}
            />
            Required
          </label>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>

        {(doc.handler === 'upload_with_template' || doc.template_url) && (
          <div className="sm:col-span-2">
            <Label className="text-xs font-medium">Template URL</Label>
            <Input
              type="url"
              value={templateUrl}
              onChange={(e) => setTemplateUrl(e.target.value)}
              onBlur={() => {
                const trimmed = templateUrl.trim()
                const next = trimmed || null
                if (next !== (doc.template_url ?? null)) {
                  onPatch({ template_url: next })
                }
              }}
              placeholder="https://ec.europa.eu/…"
            />
          </div>
        )}

        <div className="sm:col-span-2">
          <Label className="text-xs font-medium">Description (optional)</Label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              const trimmed = description.trim()
              const next = trimmed || null
              if (next !== (doc.description ?? null)) {
                onPatch({ description: next })
              }
            }}
            rows={2}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="A short note partners see alongside the upload button."
          />
        </div>
      </div>
    </div>
  )
}
