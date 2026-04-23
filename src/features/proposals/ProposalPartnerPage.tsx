import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Ban,
  Sparkles,
  Upload,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Loader2,
  Users,
  LayoutGrid,
  AlertCircle,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { proposalService } from '@/services/proposalService'
import {
  proposalPartnerService,
  proposalWorkPackageService,
  proposalDocumentService,
  proposalSubmissionService,
  proposalAuditService,
} from '@/services/proposalWorkflowService'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type {
  Proposal,
  ProposalPartner,
  ProposalDocument,
  ProposalSubmission,
  ProposalSubmissionStatus,
  ProposalWorkPackage,
} from '@/types'
import { ProposalPartAForm } from './ProposalPartAForm'
import { ProposalBudgetForm } from './ProposalBudgetForm'

const STATUS_META: Record<ProposalSubmissionStatus, {
  label: string
  badgeClass: string
  icon: typeof Circle
  cellClass: string
}> = {
  not_started:    { label: 'Not started',    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',   icon: Circle,        cellClass: 'text-muted-foreground' },
  in_progress:    { label: 'In progress',    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',       icon: Clock,         cellClass: 'text-blue-600' },
  submitted:      { label: 'Submitted',      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',    icon: Sparkles,      cellClass: 'text-amber-600' },
  approved:       { label: 'Approved',       badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2, cellClass: 'text-emerald-600' },
  needs_revision: { label: 'Needs revision', badgeClass: 'bg-red-50 text-red-700 border-red-200',          icon: Ban,           cellClass: 'text-red-600' },
}

export function ProposalPartnerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [myPartner, setMyPartner] = useState<ProposalPartner | null>(null)
  const [allPartners, setAllPartners] = useState<ProposalPartner[]>([])
  const [documents, setDocuments] = useState<ProposalDocument[]>([])
  const [submissions, setSubmissions] = useState<ProposalSubmission[]>([])
  const [wps, setWps] = useState<ProposalWorkPackage[]>([])
  const [showConsortium, setShowConsortium] = useState(true)
  const [showWps, setShowWps] = useState(false)
  const [formTarget, setFormTarget] = useState<{ doc: ProposalDocument; submission: ProposalSubmission | null } | null>(null)

  const load = async () => {
    if (!id || !user) return
    setLoading(true)
    try {
      const [prop, partners, docs] = await Promise.all([
        proposalService.getById(id),
        proposalPartnerService.list(id),
        proposalDocumentService.list(id),
      ])
      if (!prop) {
        toast({ title: 'Proposal not found', variant: 'destructive' })
        navigate('/')
        return
      }
      setProposal(prop)
      setAllPartners(partners)
      // Only accepted external partners get access. If the user was invited
      // and then declined / removed, we don't show them the workspace.
      const mine = partners.find(
        (p) => p.user_id === user.id && !p.is_host && p.invite_status === 'accepted',
      ) ?? null
      setMyPartner(mine)
      setDocuments(docs.filter((d) => d.required || true))  // show all; later per-partner scoping

      const [subs, wpRows] = await Promise.all([
        mine ? proposalSubmissionService.listForPartner(id, mine.id) : Promise.resolve<ProposalSubmission[]>([]),
        proposalWorkPackageService.list(id),
      ])
      setSubmissions(subs)
      setWps(wpRows)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to load proposal',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id])

  const subByDoc = useMemo(() => {
    const m = new Map<string, ProposalSubmission>()
    for (const s of submissions) m.set(s.document_id, s)
    return m
  }, [submissions])

  const progress = useMemo(() => {
    const required = documents.filter((d) => d.required)
    const total = required.length
    if (total === 0) return { pct: 0, done: 0, total: 0 }
    const done = required.filter((d) => {
      const s = subByDoc.get(d.id)
      return s?.status === 'submitted' || s?.status === 'approved'
    }).length
    return { pct: Math.round((done / total) * 100), done, total }
  }, [documents, subByDoc])

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto py-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!proposal) return null

  if (!myPartner) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-base font-medium">You don't have partner access to this proposal</p>
            <p className="text-sm text-muted-foreground">
              This page is for external partners. If you believe this is an error, please ask the
              coordinator to re-send your invitation.
            </p>
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const locked = !!proposal.converted_project_id
  const externals = allPartners.filter((p) => !p.is_host && p.invite_status === 'accepted')
  const host = allPartners.find((p) => p.is_host)

  // When the partner clicks "Open form" on a form-type document, swap the
  // whole page contents for the form editor. On back, re-sync with the API
  // so any new status/draft shows up.
  if (formTarget && formTarget.doc.document_type === 'part_a') {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <ProposalPartAForm
          proposal={proposal}
          partner={myPartner}
          document={formTarget.doc}
          submission={formTarget.submission}
          locked={locked}
          onBack={() => { setFormTarget(null); void load() }}
          onChanged={() => { void load() }}
        />
      </div>
    )
  }

  if (formTarget && formTarget.doc.document_type === 'budget') {
    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        <ProposalBudgetForm
          proposal={proposal}
          partner={myPartner}
          document={formTarget.doc}
          submission={formTarget.submission}
          locked={locked}
          onBack={() => { setFormTarget(null); void load() }}
          onChanged={() => { void load() }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title={proposal.project_name}
        description={`${host?.org_name ?? 'Coordinator'} · ${proposal.call_identifier || proposal.funding_scheme || 'Proposal workspace'}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        }
      />

      {locked && (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="py-3 flex items-start gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-emerald-600 mt-0.5" />
            <div className="text-emerald-800 dark:text-emerald-300">
              The coordinator has converted this proposal into a project. Your submissions are
              preserved here as an archive — editing is disabled.
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm">
              <span className="font-semibold">{progress.done}</span>
              <span className="text-muted-foreground"> of </span>
              <span className="font-semibold">{progress.total}</span>
              <span className="text-muted-foreground"> required documents submitted</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {proposal.submission_deadline
                ? `Deadline: ${new Date(proposal.submission_deadline).toLocaleDateString()}`
                : 'No deadline set'}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your contributions</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              The coordinator hasn't set up the document checklist yet.
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((d) => (
                <SubmissionRow
                  key={d.id}
                  doc={d}
                  submission={subByDoc.get(d.id) ?? null}
                  proposal={proposal}
                  partner={myPartner}
                  locked={locked}
                  onOpenForm={(doc, submission) => setFormTarget({ doc, submission })}
                  onChanged={() => void load()}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          className="pb-3 cursor-pointer select-none"
          onClick={() => setShowConsortium((x) => !x)}
        >
          <CardTitle className="text-sm flex items-center gap-1.5">
            {showConsortium ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Users className="h-4 w-4" />
            Consortium ({externals.length + 1})
          </CardTitle>
        </CardHeader>
        {showConsortium && (
          <CardContent>
            <div className="space-y-1 text-sm">
              {host && (
                <div className="flex items-center gap-2 py-1">
                  <Badge variant="outline" className="text-[10px]">Coordinator</Badge>
                  <span>{host.org_name}</span>
                </div>
              )}
              {externals.map((p) => (
                <div key={p.id} className="flex items-center gap-2 py-1">
                  <Badge variant="outline" className="text-[10px] capitalize">{p.role}</Badge>
                  <span>{p.org_name}</span>
                  {p.id === myPartner.id && (
                    <span className="text-xs text-muted-foreground">(you)</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader
          className="pb-3 cursor-pointer select-none"
          onClick={() => setShowWps((x) => !x)}
        >
          <CardTitle className="text-sm flex items-center gap-1.5">
            {showWps ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <LayoutGrid className="h-4 w-4" />
            Work packages ({wps.length})
          </CardTitle>
        </CardHeader>
        {showWps && (
          <CardContent>
            {wps.length === 0 ? (
              <p className="text-sm text-muted-foreground">The coordinator hasn't defined any work packages yet.</p>
            ) : (
              <div className="space-y-1 text-sm">
                {wps.map((wp) => (
                  <div key={wp.id} className="flex items-start gap-2 py-1">
                    <span className="font-mono text-xs text-muted-foreground w-10">WP{wp.wp_number}</span>
                    <span className="flex-1">{wp.title}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Submission row (one per document type)
// ────────────────────────────────────────────────────────────────────────────

interface RowProps {
  doc: ProposalDocument
  submission: ProposalSubmission | null
  proposal: Proposal
  partner: ProposalPartner
  locked: boolean
  onOpenForm: (doc: ProposalDocument, submission: ProposalSubmission | null) => void
  onChanged: () => void
}

function SubmissionRow({ doc, submission, proposal, partner, locked, onOpenForm, onChanged }: RowProps) {
  const { user } = useAuthStore()
  const status = (submission?.status ?? 'not_started') as ProposalSubmissionStatus
  const meta = STATUS_META[status]
  const Icon = meta.icon
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (file: File) => {
    if (locked) return
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 10 MB per file.', variant: 'destructive' })
      return
    }
    setUploading(true)
    try {
      // Ensure submission row exists.
      const sub = submission ?? await proposalSubmissionService.ensure({
        proposal_id: proposal.id,
        partner_id: partner.id,
        document_id: doc.id,
      })

      // Sanitise filename (same scheme as documentService).
      const safeName = (file.name || 'upload')
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^\.+/, '')
        .slice(0, 120) || 'upload'

      // Get org_id from the proposal so the path scheme matches our RLS.
      const orgId = (proposal as any).org_id
      const ts = new Date().toISOString().replace(/[:.]/g, '_')
      const storagePath = `${orgId}/${proposal.id}/${partner.id}/${doc.document_type}/${ts}_${safeName}`

      const { error: upErr } = await supabase.storage
        .from('proposal-submissions')
        .upload(storagePath, file, { contentType: file.type || 'application/octet-stream' })
      if (upErr) throw upErr

      await proposalSubmissionService.addVersion({
        submission_id: sub.id,
        storage_path: storagePath,
        file_name: safeName,
        original_file_name: file.name,
        mime_type: file.type || null,
        file_size_bytes: file.size,
      })
      await proposalSubmissionService.setStatus(sub.id, 'submitted')
      await proposalAuditService.log({
        proposal_id: proposal.id,
        actor_user_id: user?.id ?? null,
        actor_name: null,
        actor_role: 'partner',
        event_type: 'submission_submitted',
        target_partner_id: partner.id,
        target_document_id: doc.id,
        target_submission_id: sub.id,
        note: `Uploaded ${file.name}`,
      }).catch(() => {})

      toast({ title: 'Uploaded', description: 'Your submission is now with the coordinator for review.' })
      onChanged()
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={cn(
      'rounded-lg border p-3 flex items-start gap-3',
      status === 'needs_revision' && 'border-red-200 bg-red-50/40',
      status === 'approved' && 'border-emerald-200 bg-emerald-50/30',
    )}>
      <div className="mt-0.5">
        <Icon className={cn('h-4 w-4', meta.cellClass)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{doc.label}</span>
          {doc.required && <Badge variant="outline" className="text-[10px]">required</Badge>}
          <Badge variant="outline" className={cn('text-[10px]', meta.badgeClass)}>{meta.label}</Badge>
        </div>
        {doc.description && (
          <p className="text-xs text-muted-foreground mt-1">{doc.description}</p>
        )}
        {doc.template_url && (
          <a
            href={doc.template_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
          >
            <ExternalLink className="h-3 w-3" /> Download official template
          </a>
        )}
        {status === 'needs_revision' && submission?.review_note && (
          <div className="mt-2 rounded bg-red-100/60 border border-red-200 p-2 text-xs text-red-900">
            <strong>Coordinator feedback:</strong> {submission.review_note}
          </div>
        )}
      </div>
      <div className="shrink-0">
        {doc.handler === 'form' ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenForm(doc, submission)}
            disabled={doc.document_type !== 'part_a' && doc.document_type !== 'budget'}
            title="Fill the form in GrantLume"
          >
            Open form
          </Button>
        ) : (
          <label className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium cursor-pointer bg-background hover:bg-muted/60',
            (locked || uploading) && 'opacity-60 cursor-not-allowed',
          )}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {submission?.current_version_id ? 'Replace file' : 'Upload'}
            <input
              type="file"
              className="hidden"
              disabled={locked || uploading}
              accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleUpload(f)
                e.target.value = ''
              }}
            />
          </label>
        )}
      </div>
    </div>
  )
}
