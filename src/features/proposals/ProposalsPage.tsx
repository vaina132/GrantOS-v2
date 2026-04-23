import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate, Routes, Route, useSearchParams } from 'react-router-dom'
import { ProposalDetail } from './ProposalDetail'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { useInvalidateProjects } from '@/hooks/useProjects'
import { useProposals } from '@/hooks/useProposals'
import { proposalService } from '@/services/proposalService'
import { generateProposalsPipelinePDF } from '@/services/reportGenerator'
import { ImportExportButtons } from '@/components/common/ImportExportButtons'
import { staffService } from '@/services/staffService'
import { emailService } from '@/services/emailService'
import { notificationService } from '@/services/notificationService'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'
import { formatCurrency } from '@/lib/utils'
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRightCircle,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
} from 'lucide-react'
import type { Proposal, ProposalStatus, Person } from '@/types'
import { ImportDialog } from '@/components/import/ImportDialog'
import { exportToExcel } from '@/lib/exportUtils'
import { ComboInput, type ComboOption } from '@/components/common/ComboInput'
import { supabase } from '@/lib/supabase'
import { apiFetch } from '@/lib/apiClient'
import {
  proposalCallTemplateService,
  proposalDocumentService,
} from '@/services/proposalWorkflowService'
import type { ProposalCallTemplate } from '@/types'

const STATUS_OPTIONS: ProposalStatus[] = ['In Preparation', 'Submitted', 'Rejected', 'Granted']

const STATUS_CONFIG: Record<ProposalStatus, { color: string; bg: string; icon: typeof Clock }> = {
  'In Preparation': { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Clock },
  'Submitted': { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Send },
  'Granted': { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  'Rejected': { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: XCircle },
}

const EMPTY_FORM = {
  project_name: '',
  call_identifier: '',
  funding_scheme: '',
  submission_deadline: '',
  expected_decision: '',
  our_pms: 0,
  personnel_budget: 0,
  travel_budget: 0,
  subcontracting_budget: 0,
  other_budget: 0,
  status: 'In Preparation' as ProposalStatus,
  responsible_person_id: '',
  notes: '',
  call_template_id: '',
  // UI-only helper (not persisted). Lets the user tell us what kind of
  // funder they're applying to, which adjusts placeholder / help-text
  // copy on the Call Identifier field so non-EU users don't feel routed
  // through SEDIA. Leave '' for "I don't know / mixed".
  funder_hint: '' as '' | 'eu' | 'ukri' | 'dfg' | 'nsf' | 'snsf' | 'anr' | 'other',
}

const FUNDER_OPTIONS: Array<{ value: (typeof EMPTY_FORM)['funder_hint']; label: string; callLabel: string; callPlaceholder: string }> = [
  { value: '',      label: '— I don\'t know / mixed —',              callLabel: 'Topic ID / Call identifier',  callPlaceholder: 'Search EU calls, or type any identifier' },
  { value: 'eu',    label: 'European Commission (Horizon, LIFE, Erasmus+…)', callLabel: 'Topic ID',                callPlaceholder: 'e.g. HORIZON-CL5-2024-D2-01-02' },
  { value: 'ukri',  label: 'UKRI (EPSRC, ESRC, BBSRC…)',             callLabel: 'Opportunity reference',           callPlaceholder: 'e.g. EP/Z000000/1' },
  { value: 'dfg',   label: 'DFG (Sachbeihilfe, SFB, GRK…)',           callLabel: 'Programme / Antragsreferenz',     callPlaceholder: 'e.g. Sachbeihilfe 2026-01' },
  { value: 'nsf',   label: 'NSF (Solicitation or Program)',           callLabel: 'Solicitation / Program number',   callPlaceholder: 'e.g. NSF 24-500' },
  { value: 'snsf',  label: 'SNSF Project Funding',                    callLabel: 'Scheme reference',                callPlaceholder: 'e.g. Project Funding Oct 2025' },
  { value: 'anr',   label: 'ANR (AAPG, LabCom…)',                     callLabel: 'Appel à projets',                 callPlaceholder: 'e.g. ANR AAPG 2026 — PRC' },
  { value: 'other', label: 'Other (national, private, internal)',     callLabel: 'Call reference',                  callPlaceholder: 'Any identifier, number, or name' },
]

export function ProposalsPage() {
  return (
    <Routes>
      <Route index element={<ProposalsList />} />
      <Route path=":id" element={<ProposalDetail />} />
    </Routes>
  )
}

function ProposalsList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { orgId, user } = useAuthStore()
  const invalidateProjects = useInvalidateProjects()
  const { proposals, isLoading: loading, refetch: refetchProposals } = useProposals()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Proposal | null>(null)
  const [convertTarget, setConvertTarget] = useState<Proposal | null>(null)
  const [converting, setConverting] = useState(false)
  const [filterStatus, setFilterStatus] = useState<ProposalStatus | 'All'>('All')
  const [importOpen, setImportOpen] = useState(false)
  const [importAiOpen, setImportAiOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [fundingSchemeOptions, setFundingSchemeOptions] = useState<ComboOption[]>([])
  const [staffList, setStaffList] = useState<Person[]>([])
  const [callTemplates, setCallTemplates] = useState<ProposalCallTemplate[]>([])

  // Search EU Funding & Tenders Portal for call identifiers.
  // Uses an AbortController so out-of-order responses from a fast typist
  // can't clobber a newer query result, and times out after 8s so a slow
  // SEDIA doesn't stall the dropdown indefinitely.
  const searchAbortRef = useRef<AbortController | null>(null)
  const searchEuCalls = useCallback(async (query: string): Promise<ComboOption[]> => {
    // Cancel any in-flight request from a previous keystroke.
    searchAbortRef.current?.abort()
    const ctrl = new AbortController()
    searchAbortRef.current = ctrl
    const timeout = setTimeout(() => ctrl.abort(), 8000)
    try {
      const res = await apiFetch(
        `/api/ai?action=eu-calls&q=${encodeURIComponent(query)}&pageSize=15`,
        { signal: ctrl.signal } as RequestInit,
      )
      if (!res.ok) return []
      const { topics } = await res.json()
      return (topics ?? []).map((t: any) => ({
        value: t.identifier,
        label: t.identifier,
        description: t.title
          ? `${t.title}${t.deadlineDate ? ` — Deadline: ${t.deadlineDate}` : ''}`
          : undefined,
      }))
    } catch {
      return []
    } finally {
      clearTimeout(timeout)
    }
  }, [])

  // Pre-fill from ?call=…&name=… coming from the Calls module.
  useEffect(() => {
    const call = searchParams.get('call')
    const name = searchParams.get('name')
    if (call || name) {
      setEditingId(null)
      setForm({
        ...EMPTY_FORM,
        call_identifier: call ?? '',
        project_name: name ?? '',
      })
      setDialogOpen(true)
      const next = new URLSearchParams(searchParams)
      next.delete('call')
      next.delete('name')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load supporting data (staff list, funding schemes, call templates)
  useEffect(() => {
    if (!orgId) return
    staffService.list(orgId, { is_active: true }).then(setStaffList).catch(() => {})
    // Explicit org scope (defense-in-depth; RLS already scopes, but if the
    // policy ever regresses this client-side filter prevents cross-tenant leak).
    proposalCallTemplateService.list(orgId).then(setCallTemplates).catch(() => setCallTemplates([]))
    supabase
      .from('funding_schemes')
      .select('id, name, type')
      .eq('org_id', orgId)
      .order('name')
      .then(({ data }) => {
        if (data) {
          setFundingSchemeOptions(
            data.map((fs: any) => ({
              value: fs.name,
              label: fs.name,
              description: fs.type || undefined,
            })),
          )
        }
      })
  }, [orgId])

  const filtered = useMemo(() => {
    if (filterStatus === 'All') return proposals
    return proposals.filter((p) => p.status === filterStatus)
  }, [proposals, filterStatus])

  const stats = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of STATUS_OPTIONS) counts[s] = 0
    for (const p of proposals) counts[p.status] = (counts[p.status] ?? 0) + 1
    const totalBudget = proposals.reduce(
      (sum, p) => sum + p.personnel_budget + p.travel_budget + p.subcontracting_budget + p.other_budget,
      0,
    )
    return { counts, totalBudget, total: proposals.length }
  }, [proposals])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (p: Proposal) => {
    setEditingId(p.id)
    setForm({
      project_name: p.project_name,
      call_identifier: p.call_identifier,
      funding_scheme: p.funding_scheme,
      submission_deadline: p.submission_deadline ?? '',
      expected_decision: p.expected_decision ?? '',
      our_pms: p.our_pms,
      personnel_budget: p.personnel_budget,
      travel_budget: p.travel_budget,
      subcontracting_budget: p.subcontracting_budget,
      other_budget: p.other_budget,
      status: p.status,
      responsible_person_id: p.responsible_person_id ?? '',
      notes: p.notes ?? '',
      call_template_id: p.call_template_id ?? '',
      funder_hint: '', // UI-only; not persisted on the proposal row
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!orgId || !form.project_name.trim()) {
      toast({ title: t('validation.projectNameRequired'), variant: 'destructive' })
      return
    }
    // Basic length / format guardrails on free-text fields so a paste of 10 MB
    // or a trailing URL slash doesn't make it to the DB.
    const cleanCallId = form.call_identifier
      .trim()
      .replace(/\/+$/, '') // strip trailing slashes
      .slice(0, 200)
    const cleanFundingScheme = form.funding_scheme.trim().slice(0, 120)
    // Guard against stale template IDs (e.g. template deleted by an admin
    // between page-load and save).
    const templateIdToSave =
      form.call_template_id && callTemplates.some((tpl) => tpl.id === form.call_template_id)
        ? form.call_template_id
        : null
    setSaving(true)
    try {
      const payload = {
        org_id: orgId,
        project_name: form.project_name.trim().slice(0, 300),
        call_identifier: cleanCallId,
        funding_scheme: cleanFundingScheme,
        submission_deadline: form.submission_deadline || null,
        expected_decision: form.expected_decision || null,
        our_pms: Number(form.our_pms) || 0,
        personnel_budget: Number(form.personnel_budget) || 0,
        travel_budget: Number(form.travel_budget) || 0,
        subcontracting_budget: Number(form.subcontracting_budget) || 0,
        other_budget: Number(form.other_budget) || 0,
        status: form.status,
        responsible_person_id: form.responsible_person_id || null,
        notes: form.notes.trim() || null,
        created_by: user?.id ?? null,
        call_template_id: templateIdToSave,
      }

      // 20-second guard so the dialog can't hang forever if Supabase never
      // responds (stale auth token, network stall). The user sees an error
      // instead of an indefinite spinner.
      const withTimeout = <T,>(p: Promise<T>, ms = 20000, label = 'save'): Promise<T> =>
        Promise.race<T>([
          p,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s — check your network or try again`)), ms),
          ),
        ])

      if (editingId) {
        // Detect status change for email notification
        const oldProposal = proposals.find(p => p.id === editingId)
        const oldStatus = oldProposal?.status
        await withTimeout(proposalService.update(editingId, payload), 20000, 'Update proposal')
        toast({ title: t('proposals.proposalUpdated') })

        // Fire-and-forget: notify admins if proposal status changed
        if (oldStatus && oldStatus !== form.status && orgId) {
          const changerName = user?.user_metadata?.first_name
            ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
            : user?.email?.split('@')[0] ?? 'Someone'
          const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.grantlume.com'
          notificationService.getAdminUserIds(orgId).then(adminIds => {
            const others = adminIds.filter(id => id !== user?.id)
            if (others.length === 0) return
            Promise.resolve(
              supabase.from('persons').select('email, full_name, user_id').eq('org_id', orgId).in('user_id', others)
            ).then(({ data: persons }) => {
              for (const p of (persons ?? []) as any[]) {
                if (!p.email) continue
                emailService.sendProposalStatusChanged({
                  to: p.email,
                  recipientName: p.full_name || p.email.split('@')[0],
                  orgName: '',
                  proposalTitle: form.project_name,
                  oldStatus: oldStatus,
                  newStatus: form.status,
                  changedBy: changerName,
                  proposalsUrl: `${origin}/proposals`,
                }).catch(() => {})
              }
            }).catch(() => {})
          }).catch(() => {})
        }
      } else {
        const created = await withTimeout(proposalService.create(payload), 20000, 'Create proposal')
        // Seed the required-documents checklist from the picked template.
        // Non-fatal: if seeding fails we keep the proposal — but we tell the
        // user clearly so they don't assume an empty checklist was intended.
        let seedStatus: 'skipped' | 'ok' | 'failed' = 'skipped'
        if (templateIdToSave) {
          const template = callTemplates.find((tpl) => tpl.id === templateIdToSave)
          if (template) {
            try {
              await withTimeout(
                proposalDocumentService.seedFromTemplate(created.id, template),
                15000,
                'Seed checklist',
              )
              seedStatus = 'ok'
            } catch (seedErr) {
              console.warn('[Proposals] Failed to seed document checklist:', seedErr)
              seedStatus = 'failed'
            }
          }
        }
        if (seedStatus === 'failed') {
          toast({
            title: t('proposals.proposalCreated'),
            description:
              'Proposal created, but the document checklist failed to seed. Open the proposal and click "Re-seed checklist" in the Documents tab.',
            variant: 'destructive',
          })
        } else {
          toast({ title: t('proposals.proposalCreated') })
        }
      }
      setDialogOpen(false)
      refetchProposals()
    } catch (err) {
      // Verbose logging so the user can screenshot it for support.
      console.error('[Proposals] Save failed', err)
      const message = err instanceof Error ? err.message : t('common.failedToSave')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await proposalService.remove(deleteTarget.id)
      toast({ title: t('proposals.proposalDeleted') })
      setDeleteTarget(null)
      refetchProposals()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.failedToDelete')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    }
  }

  const handleConvert = async () => {
    if (!convertTarget || !orgId || !user?.id) return
    setConverting(true)
    try {
      const projectId = await proposalService.convertToProject(convertTarget, orgId, user.id)
      invalidateProjects()
      toast({ title: t('proposals.projectCreated'), description: t('proposals.projectCreatedDesc') })
      setConvertTarget(null)
      navigate(`/projects/${projectId}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.failedToSave')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setConverting(false)
    }
  }

  const setField = (key: string, value: string | number) => setForm((f) => ({ ...f, [key]: value }))

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('proposals.title')} />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('proposals.title')}
        description="Track grant proposal applications and convert granted ones into projects"
        actions={
          <div className="flex gap-2">
            <ImportExportButtons
              onImportFile={() => setImportOpen(true)}
              onImportAI={() => setImportAiOpen(true)}
              onExportExcel={() => exportToExcel(
                proposals,
                [
                  { header: 'Title', accessor: (p) => p.project_name },
                  { header: 'Call ID', accessor: (p) => p.call_identifier ?? '' },
                  { header: 'Programme', accessor: (p) => p.funding_scheme ?? '' },
                  { header: 'Status', accessor: (p) => p.status },
                  { header: 'Submission Deadline', accessor: (p) => p.submission_deadline ?? '' },
                  { header: 'Our PMs', accessor: (p) => p.our_pms ?? '' },
                  { header: 'Personnel Budget', accessor: (p) => p.personnel_budget ?? '' },
                  { header: 'Travel Budget', accessor: (p) => p.travel_budget ?? '' },
                  { header: 'Notes', accessor: (p) => p.notes ?? '' },
                ],
                'proposals_export',
                'Proposals',
              )}
              onExportPDF={() => generateProposalsPipelinePDF(proposals, '')}
              hasData={proposals.length > 0}
            />
            <Button onClick={openCreate} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> New Proposal
            </Button>
          </div>
        }
      />

      {/* Pipeline Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground', filter: 'All' as const },
          ...STATUS_OPTIONS.map((s) => ({
            label: s,
            value: stats.counts[s],
            color: STATUS_CONFIG[s].color,
            filter: s,
          })),
        ].map((item) => (
          <Card
            key={item.label}
            className={`cursor-pointer transition-all ${filterStatus === item.filter ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
            onClick={() => setFilterStatus(item.filter)}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Proposals Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {filterStatus === 'All' ? 'All Proposals' : `${filterStatus} Proposals`}
            <span className="ml-2 text-sm font-normal text-muted-foreground">({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No proposals found</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> Add your first proposal
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm min-w-[1100px]">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Project Name</th>
                    <th className="px-3 py-2 text-left font-medium">Lead</th>
                    <th className="px-3 py-2 text-left font-medium">Call</th>
                    <th className="px-3 py-2 text-left font-medium">Scheme</th>
                    <th className="px-3 py-2 text-left font-medium">Deadline</th>
                    <th className="px-3 py-2 text-left font-medium">Decision</th>
                    <th className="px-3 py-2 text-right font-medium">PMs</th>
                    <th className="px-3 py-2 text-right font-medium">Total Budget</th>
                    <th className="px-3 py-2 text-center font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const total = p.personnel_budget + p.travel_budget + p.subcontracting_budget + p.other_budget
                    const cfg = STATUS_CONFIG[p.status]
                    const StatusIcon = cfg.icon
                    return (
                      <tr
                        key={p.id}
                        className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                        onClick={() => navigate(`/proposals/${p.id}`)}
                      >
                        <td className="px-3 py-2 font-medium max-w-[200px]">
                          <div className="truncate" title={p.project_name}>{p.project_name}</div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs max-w-[120px]">
                          <div className="truncate">{p.responsible_person?.full_name || '—'}</div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[180px]">
                          <div className="truncate" title={p.call_identifier}>{p.call_identifier || '—'}</div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[120px]">
                          <div className="truncate" title={p.funding_scheme}>{p.funding_scheme || '—'}</div>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {p.submission_deadline
                            ? new Date(p.submission_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {p.expected_decision
                            ? new Date(p.expected_decision).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.our_pms > 0 ? p.our_pms : '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{total > 0 ? formatCurrency(total) : '—'}</td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant="outline" className={`${cfg.bg} ${cfg.color} border gap-1`}>
                            <StatusIcon className="h-3 w-3" />
                            {p.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {p.status === 'Granted' && !p.converted_project_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                                onClick={() => setConvertTarget(p)}
                                title="Convert to Project"
                              >
                                <ArrowRightCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {p.converted_project_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-primary"
                                onClick={() => navigate(`/projects/${p.converted_project_id}`)}
                                title="Go to Project"
                              >
                                <ArrowRightCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setDeleteTarget(p)}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Proposal' : 'New Proposal'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update the proposal details below.' : 'Enter the details of your grant proposal application.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Project Name *</Label>
                <Input value={form.project_name} onChange={(e) => setField('project_name', e.target.value)} placeholder="e.g. AI-Enhanced Grant Management" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Funder</Label>
                <select
                  value={form.funder_hint}
                  onChange={(e) => setField('funder_hint', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {FUNDER_OPTIONS.map((opt) => (
                    <option key={opt.value || 'unset'} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Adjusts the Call identifier placeholder and search behaviour. Not stored on the proposal.
                </p>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>{FUNDER_OPTIONS.find(o => o.value === form.funder_hint)?.callLabel ?? 'Topic ID / Call identifier'}</Label>
                <ComboInput
                  value={form.call_identifier}
                  onChange={(v) => setField('call_identifier', v)}
                  onSearch={form.funder_hint === '' || form.funder_hint === 'eu' ? searchEuCalls : undefined}
                  placeholder={FUNDER_OPTIONS.find(o => o.value === form.funder_hint)?.callPlaceholder ?? 'Any identifier, number, or name'}
                  emptyMessage={form.funder_hint === 'eu' || form.funder_hint === ''
                    ? 'Keep typing — at least 2 characters — to search the EU portal. Any value you type is also accepted.'
                    : 'No suggestions for this funder — type the reference exactly as it appears on the funder\'s call page.'}
                  debounceMs={400}
                />
                <p className="text-xs text-muted-foreground">
                  {form.funder_hint === 'eu' || form.funder_hint === ''
                    ? 'Searches open calls on the EU Funding & Tenders Portal. For national, private, or internal calls, just type the reference.'
                    : 'Any text you enter is saved exactly. We don\'t currently auto-search this funder\'s database.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{form.funder_hint === 'eu' ? 'Type of action / Scheme' : 'Funding scheme'}</Label>
                <ComboInput
                  value={form.funding_scheme}
                  onChange={(v) => setField('funding_scheme', v)}
                  options={fundingSchemeOptions}
                  placeholder={form.funder_hint === 'eu' ? 'RIA / IA / CSA / Cofund…' : 'Select a scheme, or type a new one'}
                  emptyMessage={fundingSchemeOptions.length === 0
                    ? 'No schemes saved yet. Type the scheme name to add it.'
                    : 'No match. Press Enter to save what you typed.'}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Submission preset (document checklist)</Label>
                <select
                  value={form.call_template_id}
                  onChange={(e) => setField('call_template_id', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">— Start with an empty checklist —</option>
                  {callTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                      {tpl.is_builtin ? '' : ' (custom)'}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {editingId
                    ? 'Changing the preset here updates the record but does NOT re-seed the checklist — use "Re-seed from preset" in the Documents tab to merge in any missing documents.'
                    : 'Adds that preset\'s required documents to this proposal\'s checklist. You can add or remove documents later from the Documents tab.'}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Responsible Person</Label>
                <select
                  value={form.responsible_person_id}
                  onChange={(e) => setField('responsible_person_id', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Submission Deadline</Label>
                <Input type="date" value={form.submission_deadline} onChange={(e) => setField('submission_deadline', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Approx. Decision Date</Label>
                <Input type="date" value={form.expected_decision} onChange={(e) => setField('expected_decision', e.target.value)} />
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Budget Breakdown</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>Our PMs</Label>
                  <Input type="number" step="0.5" min="0" value={form.our_pms || ''} onChange={(e) => setField('our_pms', e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Personnel Budget</Label>
                  <Input type="number" step="0.01" min="0" value={form.personnel_budget || ''} onChange={(e) => setField('personnel_budget', e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Travel Budget</Label>
                  <Input type="number" step="0.01" min="0" value={form.travel_budget || ''} onChange={(e) => setField('travel_budget', e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Subcontracting Budget</Label>
                  <Input type="number" step="0.01" min="0" value={form.subcontracting_budget || ''} onChange={(e) => setField('subcontracting_budget', e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Other Budget</Label>
                  <Input type="number" step="0.01" min="0" value={form.other_budget || ''} onChange={(e) => setField('other_budget', e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Total Budget</Label>
                  <Input
                    value={formatCurrency(
                      (Number(form.personnel_budget) || 0) +
                      (Number(form.travel_budget) || 0) +
                      (Number(form.subcontracting_budget) || 0) +
                      (Number(form.other_budget) || 0)
                    )}
                    disabled
                    className="bg-muted font-semibold"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <textarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Any additional notes about this proposal..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update Proposal' : 'Create Proposal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        onConfirm={handleDelete}
        title="Delete Proposal"
        message={`Are you sure you want to delete "${deleteTarget?.project_name}"? This cannot be undone.`}
        destructive
      />

      {/* Convert to Project Confirmation */}
      <ConfirmModal
        open={!!convertTarget}
        onOpenChange={(open) => { if (!open) setConvertTarget(null) }}
        onConfirm={handleConvert}
        title="Convert to Project"
        message={`This will create a new project from "${convertTarget?.project_name}" with the proposal's budget data. You can then edit the project details. Continue?`}
        confirmLabel={converting ? 'Converting...' : 'Create Project'}
        loading={converting}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        importType="proposals"
        onImportComplete={() => refetchProposals()}
      />
      <ImportDialog
        open={importAiOpen}
        onOpenChange={setImportAiOpen}
        importType="proposals"
        aiMode
        onImportComplete={() => refetchProposals()}
      />
    </div>
  )
}
