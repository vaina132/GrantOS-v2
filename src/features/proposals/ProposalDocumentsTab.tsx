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
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
} from '@/services/proposalWorkflowService'
import type {
  Proposal,
  ProposalDocument,
  ProposalPartner,
  ProposalSubmission,
  ProposalSubmissionStatus,
} from '@/types'
import { ProposalFormPreview } from './ProposalFormPreview'

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
            <Button
              size="sm"
              variant="outline"
              onClick={() => alert('Editing the checklist lands in a follow-up commit — for now, documents come from the call template.')}
              title="Edit the checklist of required documents"
            >
              <Plus className="h-4 w-4 mr-1" /> Manage documents
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : documents.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No required documents configured for this proposal. Pick a call template when creating the proposal, or add documents manually.
            </div>
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
    </>
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
  void Trash2
  void proposal
}
