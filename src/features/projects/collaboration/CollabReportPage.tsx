import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Send, CheckCircle, XCircle, RotateCcw, Clock, Plus, Trash2, Save } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useDraftKeeper } from '@/lib/draftKeeper'
import { DraftSavePill, DraftRestoreBanner } from '@/components/draft'
import { collabReportService, collabLineService, collabWpService, collabPartnerService, collabAllocService, collabProjectService } from '@/services/collabProjectService'
import { emailService } from '@/services/emailService'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import type { CollabReport, CollabReportLine, CollabReportSection, CollabWorkPackage, CollabPartner, CollabPartnerWpAlloc } from '@/types'

const REPORT_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

const SECTIONS: { key: CollabReportSection; labelKey: string }[] = [
  { key: 'personnel_effort', labelKey: 'collaboration.sectionPersonnelEffort' },
  { key: 'personnel_costs', labelKey: 'collaboration.sectionPersonnelCosts' },
  { key: 'subcontracting', labelKey: 'collaboration.sectionSubcontracting' },
  { key: 'travel', labelKey: 'collaboration.sectionTravel' },
  { key: 'equipment', labelKey: 'collaboration.sectionEquipment' },
  { key: 'other_goods', labelKey: 'collaboration.sectionOtherGoods' },
]

/**
 * Shape DraftKeeper persists for this page. Covers the three pieces of
 * user input that have no server counterpart yet: edits to existing lines
 * (keyed by line id), the array of unsaved new lines, and the coordinator's
 * rejection note. If the user's session ends mid-edit, these are all
 * recoverable on next load.
 */
type CollabReportDraft = {
  editData: Record<string, { amount: string; justification: string }>
  newLines: { section: CollabReportSection; wp_id: string; amount: string; justification: string }[]
  rejectionNote: string
}

export function CollabReportPage() {
  const { t } = useTranslation()
  const { reportId } = useParams<{ reportId: string }>()
  const navigate = useNavigate()
  const { user, orgId: memberOrgId } = useAuthStore()
  const [report, setReport] = useState<CollabReport | null>(null)
  const [lines, setLines] = useState<CollabReportLine[]>([])
  const [wps, setWps] = useState<CollabWorkPackage[]>([])
  const [partner, setPartner] = useState<CollabPartner | null>(null)
  const [allocs, setAllocs] = useState<CollabPartnerWpAlloc[]>([])
  const [projectAcronym, setProjectAcronym] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rejectionNote, setRejectionNote] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [baseline, setBaseline] = useState<CollabReportDraft | null>(null)

  // Editable line data — keyed by line ID
  const [editData, setEditData] = useState<Record<string, { amount: string; justification: string }>>({})
  // New lines to add
  const [newLines, setNewLines] = useState<{ section: CollabReportSection; wp_id: string; amount: string; justification: string }[]>([])

  const load = async () => {
    if (!reportId) return
    setLoading(true)
    try {
      const [r, l] = await Promise.all([
        collabReportService.get(reportId),
        collabLineService.list(reportId),
      ])
      setReport(r)
      setLines(l)
      // Load WPs, project info, and partner planned data
      if (r?.period?.project_id) {
        try {
          const wpList = await collabWpService.list(r.period.project_id)
          setWps(wpList)
        } catch { /* non-critical */ }
        try {
          const proj = await collabProjectService.get(r.period.project_id)
          setProjectAcronym(proj.acronym || '')
        } catch { /* non-critical */ }
      }
      // Load partner details (planned budget)
      if (r?.partner_id) {
        try {
          const partners = r?.period?.project_id ? await collabPartnerService.list(r.period.project_id) : []
          const p = partners.find(p => p.id === r.partner_id)
          if (p) setPartner(p)
          // Load WP allocations for this partner
          try {
            const a = await collabAllocService.list(r.partner_id)
            setAllocs(a)
          } catch { /* non-critical */ }
        } catch { /* non-critical */ }
      }
      // Initialize edit data
      const ed: Record<string, { amount: string; justification: string }> = {}
      for (const line of l) {
        ed[line.id] = {
          amount: String(line.data?.amount ?? ''),
          justification: line.justification || '',
        }
      }
      setEditData(ed)
      setNewLines([])
      setRejectionNote('')
      // Baseline reflects pristine server state — any user-side diff from
      // this set is "unsaved work" as far as DraftKeeper is concerned.
      setBaseline({ editData: ed, newLines: [], rejectionNote: '' })
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToLoadReport'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [reportId])

  const canEdit = report?.status === 'draft' || report?.status === 'rejected'
  const canReview = report?.status === 'submitted'

  const draftValue = useMemo<CollabReportDraft>(
    () => ({ editData, newLines, rejectionNote }),
    [editData, newLines, rejectionNote],
  )

  // DraftKeeper persists partner + coordinator edits alike. Role-based
  // visibility of the reject form means a partner and a coordinator can't
  // contend over the same fields on the same user account.
  const draft = useDraftKeeper<CollabReportDraft>({
    key: {
      orgId: memberOrgId ?? '_collab',
      userId: user?.id ?? '_anon',
      formKey: 'collab-report',
      recordId: reportId ?? 'new',
    },
    value: draftValue,
    setValue: (next) => {
      setEditData(next.editData)
      setNewLines(next.newLines)
      setRejectionNote(next.rejectionNote)
    },
    enabled: !loading && !!reportId && (canEdit || canReview),
    schemaVersion: 1,
    baseline,
    silentRestoreWindowMs: 0,
  })
  const canSubmit = canEdit && lines.length > 0

  const handleSaveLine = async (lineId: string) => {
    const ed = editData[lineId]
    if (!ed) return
    setSaving(true)
    try {
      await collabLineService.upsert({
        id: lineId,
        report_id: reportId!,
        section: lines.find(l => l.id === lineId)?.section ?? 'personnel_costs',
        data: { amount: parseFloat(ed.amount) || 0 },
        justification: ed.justification || null,
      })
      toast({ title: t('common.saved') })
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToSave'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAll = async () => {
    setSaving(true)
    let saved = 0
    try {
      // Save existing lines
      for (const line of lines) {
        const ed = editData[line.id]
        if (!ed) continue
        await collabLineService.upsert({
          id: line.id,
          report_id: reportId!,
          section: line.section,
          data: { amount: parseFloat(ed.amount) || 0 },
          justification: ed.justification || null,
        })
        saved++
      }
      // Save new lines
      for (const nl of newLines) {
        if (!nl.amount && !nl.justification) continue
        await collabLineService.upsert({
          report_id: reportId!,
          section: nl.section,
          wp_id: nl.wp_id || null,
          data: { amount: parseFloat(nl.amount) || 0 },
          justification: nl.justification || null,
          line_order: lines.filter(l => l.section === nl.section).length + 1,
        })
        saved++
      }
      setNewLines([])
      toast({ title: t('common.saved'), description: t('collaboration.linesSaved', { count: saved }) })
      load()
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToSaveLines'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteLine = async (lineId: string) => {
    if (!confirm(t('collaboration.confirmRemoveLine'))) return
    try {
      await collabLineService.remove(lineId)
      toast({ title: t('common.removed') })
      load()
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToRemove'), variant: 'destructive' })
    }
  }

  const handleSubmit = async () => {
    if (!reportId || !confirm(t('collaboration.confirmSubmitReport'))) return
    try {
      await handleSaveAll()
      await collabReportService.submit(reportId, user?.email || 'Partner')
      toast({ title: t('collaboration.submitted'), description: t('collaboration.reportSentForReview') })
      load()
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToSubmit'), variant: 'destructive' })
    }
  }

  const handleResubmit = async () => {
    if (!reportId || !confirm(t('collaboration.confirmResubmitReport'))) return
    try {
      await handleSaveAll()
      await collabReportService.resubmit(reportId, user?.email || 'Partner')
      toast({ title: t('collaboration.resubmitted'), description: t('collaboration.reportSentForReview') })
      load()
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToResubmit'), variant: 'destructive' })
    }
  }

  const handleApprove = async () => {
    if (!reportId || !user || !confirm(t('collaboration.confirmApproveReport'))) return
    try {
      await collabReportService.approve(reportId, user.id, user.email || 'Coordinator')
      toast({ title: t('collaboration.approved') })
      // Send status email to partner
      const contactEmail = partner?.contact_email || report?.partner?.contact_email
      if (contactEmail) {
        emailService.sendCollabReportStatus({
          to: contactEmail,
          contactName: partner?.contact_name || '',
          orgName: partner?.org_name || partnerName,
          projectAcronym,
          periodTitle,
          status: 'approved',
          reviewerName: user.email || 'Coordinator',
          reportUrl: `${window.location.origin}/projects/collaboration/report/${reportId}`,
        }).catch(() => { /* fire-and-forget */ })
      }
      load()
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToApprove'), variant: 'destructive' })
    }
  }

  const handleReject = async () => {
    if (!reportId || !user || !rejectionNote.trim()) return
    try {
      await collabReportService.reject(reportId, user.id, user.email || 'Coordinator', rejectionNote.trim())
      toast({ title: t('collaboration.returned'), description: t('collaboration.reportReturnedForCorrections') })
      // Send status email to partner
      const contactEmail = partner?.contact_email || report?.partner?.contact_email
      if (contactEmail) {
        emailService.sendCollabReportStatus({
          to: contactEmail,
          contactName: partner?.contact_name || '',
          orgName: partner?.org_name || partnerName,
          projectAcronym,
          periodTitle,
          status: 'rejected',
          reviewerName: user.email || 'Coordinator',
          rejectionNote: rejectionNote.trim(),
          reportUrl: `${window.location.origin}/projects/collaboration/report/${reportId}`,
        }).catch(() => { /* fire-and-forget */ })
      }
      setShowRejectForm(false)
      setRejectionNote('')
      load()
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToReject'), variant: 'destructive' })
    }
  }

  const addNewLine = (section: CollabReportSection) => {
    setNewLines([...newLines, { section, wp_id: '', amount: '', justification: '' }])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>{t('collaboration.reportNotFound')}</p>
        <Button variant="link" onClick={() => navigate(-1)}>{t('collaboration.goBack')}</Button>
      </div>
    )
  }

  const partnerName = report.partner?.org_name ?? 'Partner'
  const periodTitle = report.period?.title ?? 'Period'
  const projectId = report.period?.project_id

  // Group lines by section
  const linesBySection: Record<string, CollabReportLine[]> = {}
  for (const s of SECTIONS) {
    linesBySection[s.key] = lines.filter(l => l.section === s.key)
  }

  // Compute totals per section
  const sectionTotals: Record<string, number> = {}
  for (const s of SECTIONS) {
    sectionTotals[s.key] = linesBySection[s.key].reduce((sum, l) => {
      const ed = editData[l.id]
      return sum + (parseFloat(ed?.amount || '0') || 0)
    }, 0)
  }
  const grandTotal = Object.values(sectionTotals).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      {draft.hasDraft && (
        <DraftRestoreBanner
          ageMs={draft.draftAge}
          onRestore={draft.restore}
          onDiscard={draft.discard}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => projectId ? navigate(`/projects/collaboration/${projectId}`) : navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{partnerName}</h1>
              <Badge className={REPORT_STATUS_COLORS[report.status] ?? ''} variant="secondary">
                {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              {t('collaboration.financialReport')} — {periodTitle}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground mt-2">
              {report.submitted_at && <span>{t('collaboration.submitted')}: {new Date(report.submitted_at).toLocaleDateString()}</span>}
              {report.reviewed_at && <span>{t('collaboration.reviewed')}: {new Date(report.reviewed_at).toLocaleDateString()}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DraftSavePill status={draft.status} lastSavedAt={draft.lastSavedAt} />
          {canEdit && (
            <>
              <Button variant="outline" onClick={handleSaveAll} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" /> {saving ? t('common.saving') : t('collaboration.saveAll')}
              </Button>
              {report.status === 'draft' && canSubmit && (
                <Button onClick={handleSubmit} className="gap-2">
                  <Send className="h-4 w-4" /> {t('collaboration.submit')}
                </Button>
              )}
              {report.status === 'rejected' && (
                <Button onClick={handleResubmit} className="gap-2">
                  <RotateCcw className="h-4 w-4" /> {t('collaboration.resubmit')}
                </Button>
              )}
            </>
          )}
          {canReview && (
            <>
              <Button variant="outline" onClick={() => setShowRejectForm(!showRejectForm)} className="gap-2 text-destructive border-destructive/30">
                <XCircle className="h-4 w-4" /> {t('collaboration.return')}
              </Button>
              <Button onClick={handleApprove} className="gap-2">
                <CheckCircle className="h-4 w-4" /> {t('collaboration.approve')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Rejection note banner */}
      {report.rejection_note && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-destructive mb-1">{t('collaboration.correctionsRequested')}</p>
            <p className="text-sm">{report.rejection_note}</p>
          </CardContent>
        </Card>
      )}

      {/* Reject form (coordinator) */}
      {showRejectForm && (
        <Card className="border-destructive/30">
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-medium">{t('collaboration.reasonForReturning')}</Label>
            <textarea
              value={rejectionNote}
              onChange={e => setRejectionNote(e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
              placeholder={t('collaboration.describeCorrections')}
            />
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={handleReject} disabled={!rejectionNote.trim()}>
                {t('collaboration.returnReport')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowRejectForm(false); setRejectionNote('') }}>
                {t('common.cancel')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Planned vs Actual summary */}
      {(() => {
        const plannedBudget = partner
          ? partner.budget_personnel + partner.budget_subcontracting + partner.budget_travel + partner.budget_equipment + partner.budget_other_goods
          : 0
        const plannedPMs = partner?.total_person_months ?? 0
        const reportedPMs = sectionTotals.personnel_effort ?? 0
        const deviationPMs = plannedPMs > 0 ? ((reportedPMs - plannedPMs) / plannedPMs) * 100 : 0
        const deviationBudget = plannedBudget > 0 ? ((grandTotal - plannedBudget) / plannedBudget) * 100 : 0
        const devColor = (pct: number) => Math.abs(pct) < 10 ? 'text-emerald-600' : Math.abs(pct) < 25 ? 'text-amber-600' : 'text-red-600'

        // Planned budget by section (from partner data)
        const plannedBySection: Record<string, number> = {
          personnel_effort: plannedPMs,
          personnel_costs: partner?.budget_personnel ?? 0,
          subcontracting: partner?.budget_subcontracting ?? 0,
          travel: partner?.budget_travel ?? 0,
          equipment: partner?.budget_equipment ?? 0,
          other_goods: partner?.budget_other_goods ?? 0,
        }

        return (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium capitalize">{report.status}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{t('collaboration.costLineCount', { count: lines.length })}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-lg font-bold">{reportedPMs.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">{t('collaboration.reportedPMs')}</p>
                  {plannedPMs > 0 && (
                    <p className={`text-[10px] font-medium mt-0.5 ${devColor(deviationPMs)}`}>
                      of {plannedPMs} planned ({deviationPMs >= 0 ? '+' : ''}{deviationPMs.toFixed(1)}%)
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-lg font-bold">€{grandTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  <p className="text-xs text-muted-foreground">{t('collaboration.totalReported')}</p>
                  {plannedBudget > 0 && (
                    <p className={`text-[10px] font-medium mt-0.5 ${devColor(deviationBudget)}`}>
                      of €{plannedBudget.toLocaleString()} planned ({deviationBudget >= 0 ? '+' : ''}{deviationBudget.toFixed(1)}%)
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-lg font-bold">{allocs.length > 0 ? allocs.reduce((s, a) => s + a.person_months, 0).toFixed(1) : '—'}</p>
                  <p className="text-xs text-muted-foreground">{t('collaboration.wpAllocationsPMs')}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-lg font-bold">{partner?.funding_rate ?? '—'}%</p>
                  <p className="text-xs text-muted-foreground">{t('collaboration.fundingRate')}</p>
                </CardContent>
              </Card>
            </div>

            {/* Per-section planned vs actual */}
            {partner && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{t('collaboration.plannedVsReported')}</CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left bg-muted/50">
                        <th className="p-3 font-medium text-xs">{t('collaboration.category')}</th>
                        <th className="p-3 font-medium text-xs text-right">{t('collaboration.planned')}</th>
                        <th className="p-3 font-medium text-xs text-right">{t('collaboration.reported')}</th>
                        <th className="p-3 font-medium text-xs text-right">{t('collaboration.deviation')}</th>
                        <th className="p-3 font-medium text-xs w-32">{t('collaboration.progress')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SECTIONS.map(s => {
                        const planned = plannedBySection[s.key] ?? 0
                        const reported = sectionTotals[s.key] ?? 0
                        const dev = planned > 0 ? ((reported - planned) / planned) * 100 : 0
                        const pct = planned > 0 ? Math.min(100, (reported / planned) * 100) : 0
                        const isMonetary = s.key !== 'personnel_effort'
                        const prefix = isMonetary ? '€' : ''
                        const fmt = (v: number) => isMonetary ? `${prefix}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : v.toFixed(1)
                        return (
                          <tr key={s.key} className="border-b last:border-0">
                            <td className="p-3 text-xs font-medium">{t(s.labelKey)}</td>
                            <td className="p-3 text-xs text-right tabular-nums text-muted-foreground">{planned > 0 ? fmt(planned) : '—'}</td>
                            <td className="p-3 text-xs text-right tabular-nums font-medium">{fmt(reported)}</td>
                            <td className={`p-3 text-xs text-right tabular-nums font-medium ${planned > 0 ? devColor(dev) : 'text-muted-foreground'}`}>
                              {planned > 0 ? `${dev >= 0 ? '+' : ''}${dev.toFixed(1)}%` : '—'}
                            </td>
                            <td className="p-3">
                              {planned > 0 && (
                                <div className="w-full bg-muted rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full transition-all ${pct > 100 ? 'bg-red-400' : pct > 80 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                    style={{ width: `${Math.min(100, pct)}%` }}
                                  />
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {/* Per-WP allocation vs reported effort */}
            {allocs.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{t('collaboration.effortByWp')}</CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left bg-muted/50">
                        <th className="p-3 font-medium text-xs">{t('collaboration.workPackage')}</th>
                        <th className="p-3 font-medium text-xs text-right">{t('collaboration.allocatedPMs')}</th>
                        <th className="p-3 font-medium text-xs text-right">{t('collaboration.reportedPMs')}</th>
                        <th className="p-3 font-medium text-xs text-right">{t('collaboration.deviation')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wps.map(wp => {
                        const alloc = allocs.find(a => a.wp_id === wp.id)
                        const allocPMs = alloc?.person_months ?? 0
                        const wpEffortLines = lines.filter(l => l.section === 'personnel_effort' && l.wp_id === wp.id)
                        const reportedPMs = wpEffortLines.reduce((s, l) => {
                          const ed = editData[l.id]
                          return s + (parseFloat(ed?.amount || '0') || 0)
                        }, 0)
                        const dev = allocPMs > 0 ? ((reportedPMs - allocPMs) / allocPMs) * 100 : 0
                        return (
                          <tr key={wp.id} className="border-b last:border-0">
                            <td className="p-3 text-xs font-medium">WP{wp.wp_number}: {wp.title}</td>
                            <td className="p-3 text-xs text-right tabular-nums text-muted-foreground">{allocPMs > 0 ? allocPMs.toFixed(1) : '—'}</td>
                            <td className="p-3 text-xs text-right tabular-nums font-medium">{reportedPMs > 0 ? reportedPMs.toFixed(1) : '0.0'}</td>
                            <td className={`p-3 text-xs text-right tabular-nums font-medium ${allocPMs > 0 ? devColor(dev) : 'text-muted-foreground'}`}>
                              {allocPMs > 0 ? `${dev >= 0 ? '+' : ''}${dev.toFixed(1)}%` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </>
        )
      })()}

      {/* Cost sections */}
      <Tabs defaultValue="personnel_costs">
        <TabsList className="flex-wrap h-auto gap-1">
          {SECTIONS.map(s => (
            <TabsTrigger key={s.key} value={s.key} className="text-xs">
              {t(s.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        {SECTIONS.map(s => {
          const sectionLines = linesBySection[s.key]
          const sectionNewLines = newLines.filter(nl => nl.section === s.key)

          return (
            <TabsContent key={s.key} value={s.key} className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t(s.labelKey)}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('collaboration.subtotal')}: €{sectionTotals[s.key]?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                  </p>
                </div>
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={() => addNewLine(s.key)} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> {t('collaboration.addLine')}
                  </Button>
                )}
              </div>

              {sectionLines.length === 0 && sectionNewLines.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{t('collaboration.noEntriesYet')}</p>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="p-3 font-medium w-16">#</th>
                          <th className="p-3 font-medium">{t('collaboration.wp')}</th>
                          <th className="p-3 font-medium w-40">{t('collaboration.amount')} (€)</th>
                          <th className="p-3 font-medium">{t('collaboration.justification')}</th>
                          {canEdit && <th className="p-3 font-medium w-20"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {sectionLines.map((line, idx) => {
                          const ed = editData[line.id] ?? { amount: '', justification: '' }
                          return (
                            <tr key={line.id} className="border-b last:border-0">
                              <td className="p-3 text-muted-foreground">{idx + 1}</td>
                              <td className="p-3 text-xs">
                                {line.work_package
                                  ? `WP${wps.find(w => w.id === line.wp_id)?.wp_number ?? '?'}: ${line.work_package.title}`
                                  : '—'}
                              </td>
                              <td className="p-3">
                                {canEdit ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={ed.amount}
                                    onChange={e => setEditData(d => ({ ...d, [line.id]: { ...ed, amount: e.target.value } }))}
                                    className="h-8 text-sm w-full"
                                  />
                                ) : (
                                  <span>€{parseFloat(ed.amount || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                )}
                              </td>
                              <td className="p-3">
                                {canEdit ? (
                                  <Input
                                    value={ed.justification}
                                    onChange={e => setEditData(d => ({ ...d, [line.id]: { ...ed, justification: e.target.value } }))}
                                    className="h-8 text-sm w-full"
                                    placeholder={t('collaboration.optionalNote')}
                                  />
                                ) : (
                                  <span className="text-xs text-muted-foreground">{ed.justification || '—'}</span>
                                )}
                              </td>
                              {canEdit && (
                                <td className="p-3">
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSaveLine(line.id)}>
                                      <Save className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteLine(line.id)}>
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          )
                        })}
                        {sectionNewLines.map((nl, idx) => {
                          const globalIdx = newLines.indexOf(nl)
                          return (
                            <tr key={`new-${idx}`} className="border-b last:border-0 bg-primary/5">
                              <td className="p-3 text-muted-foreground text-xs">new</td>
                              <td className="p-3">
                                <select
                                  value={nl.wp_id}
                                  onChange={e => {
                                    const updated = [...newLines]
                                    updated[globalIdx] = { ...nl, wp_id: e.target.value }
                                    setNewLines(updated)
                                  }}
                                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                                >
                                  <option value="">— {t('collaboration.selectWp')} —</option>
                                  {wps.map(wp => (
                                    <option key={wp.id} value={wp.id}>WP{wp.wp_number}: {wp.title}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-3">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={nl.amount}
                                  onChange={e => {
                                    const updated = [...newLines]
                                    updated[globalIdx] = { ...nl, amount: e.target.value }
                                    setNewLines(updated)
                                  }}
                                  className="h-8 text-sm w-full"
                                  placeholder="0.00"
                                />
                              </td>
                              <td className="p-3">
                                <Input
                                  value={nl.justification}
                                  onChange={e => {
                                    const updated = [...newLines]
                                    updated[globalIdx] = { ...nl, justification: e.target.value }
                                    setNewLines(updated)
                                  }}
                                  className="h-8 text-sm w-full"
                                  placeholder={t('collaboration.justification')}
                                />
                              </td>
                              {canEdit && (
                                <td className="p-3">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setNewLines(newLines.filter((_, i) => i !== globalIdx))}>
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )
        })}
      </Tabs>

      {/* Activity log */}
      {report.events && report.events.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('collaboration.activityLog')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {report.events.map(ev => (
                <div key={ev.id} className="px-4 py-2.5 flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    {ev.event_type === 'approved' && <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />}
                    {ev.event_type === 'rejected' && <XCircle className="h-3.5 w-3.5 text-red-600" />}
                    {ev.event_type === 'submitted' && <Send className="h-3.5 w-3.5 text-blue-600" />}
                    {ev.event_type === 'resubmitted' && <RotateCcw className="h-3.5 w-3.5 text-blue-600" />}
                    {!['approved', 'rejected', 'submitted', 'resubmitted'].includes(ev.event_type) && <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{ev.actor_name || ev.actor_role || 'System'}</span>
                      {' '}{ev.note}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
