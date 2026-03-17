import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { grantAIService } from '@/services/grantAIService'
import { projectsService } from '@/services/projectsService'
import { deliverablesService } from '@/services/deliverablesService'
import { useAuthStore } from '@/stores/authStore'
import { useInvalidateProjects } from '@/hooks/useProjects'
import { computeProjectStatus } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'
import {
  ArrowLeft, Upload, Loader2, CheckCircle2, AlertTriangle,
  FileText, Target, ClipboardList, Package, Sparkles, X, Plus, Trash2,
} from 'lucide-react'
import type { GrantAIExtraction } from '@/types'
import { AiQuotaWidget } from '@/components/ai/AiQuotaWidget'

type WizardStep = 'upload' | 'processing' | 'review' | 'saving'

export function GrantAIWizard() {
  const navigate = useNavigate()
  const { orgId } = useAuthStore()
  const invalidateProjects = useInvalidateProjects()

  const [step, setStep] = useState<WizardStep>('upload')
  const [quotaExhausted, setQuotaExhausted] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // User context for AI
  const [orgAbbreviation, setOrgAbbreviation] = useState('')
  const [userInstructions, setUserInstructions] = useState('')

  // Extracted data (editable)
  const [data, setData] = useState<GrantAIExtraction | null>(null)
  const [confidenceNotes, setConfidenceNotes] = useState('')

  // ── Upload & Parse ────────────────────────────────────────────

  const handleFileSelect = useCallback((f: File) => {
    const validTypes = ['application/pdf']
    const validExtensions = ['.pdf']
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'))
    if (!validTypes.includes(f.type) && !validExtensions.includes(ext)) {
      setError('Please upload a PDF file.')
      return
    }
    if (f.size > 25 * 1024 * 1024) {
      setError('File is too large. Maximum size is 25MB.')
      return
    }
    setFile(f)
    setError(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFileSelect(f)
  }, [handleFileSelect])

  const handleParse = async () => {
    if (!file) return
    setStep('processing')
    setError(null)
    try {
      const result = await grantAIService.parseGrantAgreement(file, {
        organisationAbbreviation: orgAbbreviation.trim() || undefined,
        userInstructions: userInstructions.trim() || undefined,
      })
      setData(result.extraction)
      setConfidenceNotes(result.extraction.confidence_notes || '')
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse document')
      setStep('upload')
    }
  }

  // ── Review Helpers ────────────────────────────────────────────

  const updateProject = (field: string, value: any) => {
    if (!data) return
    setData({ ...data, project: { ...data.project, [field]: value } })
  }

  const updateWP = (idx: number, field: string, value: any) => {
    if (!data) return
    const wps = [...data.work_packages]
    wps[idx] = { ...wps[idx], [field]: value }
    setData({ ...data, work_packages: wps })
  }

  const removeWP = (idx: number) => {
    if (!data) return
    setData({ ...data, work_packages: data.work_packages.filter((_, i) => i !== idx) })
  }

  const addWP = () => {
    if (!data) return
    const next = data.work_packages.length + 1
    setData({
      ...data,
      work_packages: [...data.work_packages, { number: next, name: '', description: null, start_month: 1, end_month: 12, person_months: null }],
    })
  }

  const updateDeliverable = (idx: number, field: string, value: any) => {
    if (!data) return
    const dels = [...data.deliverables]
    dels[idx] = { ...dels[idx], [field]: value }
    setData({ ...data, deliverables: dels })
  }

  const removeDeliverable = (idx: number) => {
    if (!data) return
    setData({ ...data, deliverables: data.deliverables.filter((_, i) => i !== idx) })
  }

  const addDeliverable = () => {
    if (!data) return
    setData({
      ...data,
      deliverables: [...data.deliverables, { number: '', title: '', description: null, wp_number: null, due_month: 1 }],
    })
  }

  const updateMilestone = (idx: number, field: string, value: any) => {
    if (!data) return
    const ms = [...data.milestones]
    ms[idx] = { ...ms[idx], [field]: value }
    setData({ ...data, milestones: ms })
  }

  const removeMilestone = (idx: number) => {
    if (!data) return
    setData({ ...data, milestones: data.milestones.filter((_, i) => i !== idx) })
  }

  const addMilestone = () => {
    if (!data) return
    setData({
      ...data,
      milestones: [...data.milestones, { number: '', title: '', description: null, wp_number: null, due_month: 1, verification_means: null }],
    })
  }

  const updateRP = (idx: number, field: string, value: any) => {
    if (!data) return
    const rps = [...data.reporting_periods]
    rps[idx] = { ...rps[idx], [field]: value }
    setData({ ...data, reporting_periods: rps })
  }

  const removeRP = (idx: number) => {
    if (!data) return
    setData({ ...data, reporting_periods: data.reporting_periods.filter((_, i) => i !== idx) })
  }

  const addRP = () => {
    if (!data) return
    const next = data.reporting_periods.length + 1
    setData({
      ...data,
      reporting_periods: [...data.reporting_periods, { period_number: next, start_month: 1, end_month: 12 }],
    })
  }

  // ── Confirm & Create ──────────────────────────────────────────

  const handleConfirm = async () => {
    if (!data || !orgId) return
    setStep('saving')
    try {
      const p = data.project
      const status = computeProjectStatus(p.start_date, p.end_date)

      // 1. Create the project
      const project = await projectsService.create({
        org_id: orgId,
        acronym: p.acronym,
        title: p.title,
        grant_number: p.grant_number || null,
        funding_scheme_id: null,
        status,
        start_date: p.start_date,
        end_date: p.end_date,
        total_budget: p.total_budget,
        overhead_rate: p.overhead_rate,
        has_wps: data.work_packages.length > 0,
        is_lead_organisation: p.is_lead_organisation,
        our_pm_rate: p.our_pm_rate,
        budget_personnel: p.budget_personnel,
        budget_travel: p.budget_travel,
        budget_subcontracting: p.budget_subcontracting,
        budget_other: p.budget_other,
        responsible_person_id: null,
        collab_project_id: null,
      })

      // 2. Create work packages — build a map of wp_number → wp_id
      const wpMap: Record<number, string> = {}
      for (const wp of data.work_packages) {
        const created = await projectsService.createWorkPackage({
          org_id: orgId,
          project_id: project.id,
          number: wp.number,
          name: wp.name,
          description: wp.description,
          lead_person_id: null,
          start_month: wp.start_month,
          end_month: wp.end_month,
          start_date: null,
          end_date: null,
        })
        wpMap[wp.number] = created.id
      }

      // 3. Create deliverables
      for (const d of data.deliverables) {
        await deliverablesService.createDeliverable({
          org_id: orgId,
          project_id: project.id,
          work_package_id: d.wp_number ? (wpMap[d.wp_number] ?? null) : null,
          number: d.number,
          title: d.title,
          description: d.description,
          lead_person_id: null,
          due_month: d.due_month,
        })
      }

      // 4. Create milestones
      for (const m of data.milestones) {
        await deliverablesService.createMilestone({
          org_id: orgId,
          project_id: project.id,
          work_package_id: m.wp_number ? (wpMap[m.wp_number] ?? null) : null,
          number: m.number,
          title: m.title,
          description: m.description,
          due_month: m.due_month,
          verification_means: m.verification_means,
        })
      }

      // 5. Create reporting periods
      for (const rp of data.reporting_periods) {
        await deliverablesService.createReportingPeriod({
          org_id: orgId,
          project_id: project.id,
          period_number: rp.period_number,
          start_month: rp.start_month,
          end_month: rp.end_month,
          technical_report_due: null,
          financial_report_due: null,
          notes: null,
        })
      }

      invalidateProjects()
      toast({ title: 'Project Created!', description: `${p.acronym} and all related data have been imported successfully.` })
      navigate(`/projects/${project.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
      setStep('review')
    }
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import from Grant Agreement"
        actions={
          <Button variant="outline" onClick={() => navigate('/projects')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
          </Button>
        }
      />

      {/* ─── Step: Upload ─── */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Upload Grant Agreement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload your grant agreement PDF and our AI will extract the project details, work packages,
              deliverables, milestones, and reporting periods. You&apos;ll get to review and edit everything before creating the project.
            </p>

            <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Tips for best results
              </p>
              <ul className="text-[11px] text-amber-700 dark:text-amber-400 space-y-0.5 ml-5 list-disc">
                <li>Shorter documents work best &mdash; upload only the <strong>Grant Agreement</strong> or <strong>Annex with budget &amp; work plan</strong>, not the entire proposal.</li>
                <li>If you have separate annexes (budget table, work package descriptions), uploading just those sections gives faster and more accurate results.</li>
                <li>Screenshots or scanned pages of key tables (budget breakdown, deliverable list) are also accepted.</li>
                <li>Very large documents (200+ pages) will take longer to process and may incur higher AI costs.</li>
              </ul>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Our Organisation Abbreviation</Label>
                <Input
                  value={orgAbbreviation}
                  onChange={e => setOrgAbbreviation(e.target.value)}
                  placeholder="e.g. TUB, CNRS, ACME"
                />
                <p className="text-[11px] text-muted-foreground">
                  Helps AI locate your organisation&apos;s specific budget figures in multi-partner agreements.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Additional Instructions (optional)</Label>
                <Input
                  value={userInstructions}
                  onChange={e => setUserInstructions(e.target.value)}
                  placeholder="e.g. Budget is in Annex 2, we are Partner 3"
                />
                <p className="text-[11px] text-muted-foreground">
                  Any hints to help the AI find the right information in the document.
                </p>
              </div>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer ${
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = '.pdf'
                input.onchange = (e) => {
                  const f = (e.target as HTMLInputElement).files?.[0]
                  if (f) handleFileSelect(f)
                }
                input.click()
              }}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <div className="text-sm font-medium">
                {file ? file.name : 'Drop your PDF here or click to browse'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                PDF files up to 25MB
              </div>
            </div>

            {file && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{file.name}</span>
                <span className="text-muted-foreground">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="h-6 px-2 ml-auto">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <AiQuotaWidget className="mt-2" onQuotaExhausted={setQuotaExhausted} />

            <div className="flex justify-end">
              <Button onClick={handleParse} disabled={!file || quotaExhausted} size="lg">
                <Sparkles className="mr-2 h-4 w-4" />
                Analyze with AI
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Step: Processing ─── */}
      {step === 'processing' && (
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
            <div className="text-lg font-semibold">Analyzing your grant agreement...</div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Our AI is reading through the document and extracting project details,
              work packages, deliverables, milestones, and reporting periods.
              This usually takes 15–30 seconds.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── Step: Saving ─── */}
      {step === 'saving' && (
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
            <div className="text-lg font-semibold">Creating project...</div>
            <p className="text-sm text-muted-foreground">
              Setting up project, work packages, deliverables, milestones, and reporting periods.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── Step: Review ─── */}
      {step === 'review' && data && (
        <div className="space-y-6">
          {/* Confidence notes */}
          {confidenceNotes && (
            <div className="flex items-start gap-2 text-sm bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-amber-800 dark:text-amber-400 mb-1">AI Notes</div>
                <div className="text-amber-700 dark:text-amber-300">{confidenceNotes}</div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Project Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" /> Project Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Acronym *</Label>
                  <Input value={data.project.acronym} onChange={e => updateProject('acronym', e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Title *</Label>
                  <Input value={data.project.title} onChange={e => updateProject('title', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Grant Number</Label>
                  <Input value={data.project.grant_number ?? ''} onChange={e => updateProject('grant_number', e.target.value || null)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Start Date *</Label>
                  <Input type="date" value={data.project.start_date} onChange={e => updateProject('start_date', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End Date *</Label>
                  <Input type="date" value={data.project.end_date} onChange={e => updateProject('end_date', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Total Budget</Label>
                  <Input type="number" step="0.01" value={data.project.total_budget ?? ''} onChange={e => updateProject('total_budget', e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Overhead Rate (%)</Label>
                  <Input type="number" step="0.01" value={data.project.overhead_rate ?? ''} onChange={e => updateProject('overhead_rate', e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">PM Rate</Label>
                  <Input type="number" step="0.01" value={data.project.our_pm_rate ?? ''} onChange={e => updateProject('our_pm_rate', e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Personnel Budget</Label>
                  <Input type="number" step="0.01" value={data.project.budget_personnel ?? ''} onChange={e => updateProject('budget_personnel', e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Travel Budget</Label>
                  <Input type="number" step="0.01" value={data.project.budget_travel ?? ''} onChange={e => updateProject('budget_travel', e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Subcontracting Budget</Label>
                  <Input type="number" step="0.01" value={data.project.budget_subcontracting ?? ''} onChange={e => updateProject('budget_subcontracting', e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Other Budget</Label>
                  <Input type="number" step="0.01" value={data.project.budget_other ?? ''} onChange={e => updateProject('budget_other', e.target.value ? Number(e.target.value) : null)} />
                </div>
              </div>
              <div className="flex gap-6 mt-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={data.project.is_lead_organisation} onChange={e => updateProject('is_lead_organisation', e.target.checked)} className="h-4 w-4 rounded" />
                  Led by Our Organisation
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Work Packages */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" /> Work Packages ({data.work_packages.length})
                </CardTitle>
                <Button size="sm" variant="outline" onClick={addWP}><Plus className="mr-1 h-3 w-3" /> Add</Button>
              </div>
            </CardHeader>
            <CardContent>
              {data.work_packages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No work packages extracted.</p>
              ) : (
                <div className="space-y-3">
                  {data.work_packages.map((wp, i) => (
                    <div key={i} className="flex gap-2 items-start p-3 rounded-md border bg-muted/10">
                      <div className="grid gap-2 flex-1 sm:grid-cols-6">
                        <div className="space-y-1">
                          <Label className="text-[10px]">WP#</Label>
                          <Input type="number" value={wp.number} onChange={e => updateWP(i, 'number', Number(e.target.value))} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-[10px]">Name</Label>
                          <Input value={wp.name} onChange={e => updateWP(i, 'name', e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Start M</Label>
                          <Input type="number" value={wp.start_month} onChange={e => updateWP(i, 'start_month', Number(e.target.value))} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">End M</Label>
                          <Input type="number" value={wp.end_month} onChange={e => updateWP(i, 'end_month', Number(e.target.value))} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">PMs</Label>
                          <Input type="number" step="0.1" value={wp.person_months ?? ''} onChange={e => updateWP(i, 'person_months', e.target.value ? Number(e.target.value) : null)} className="h-8 text-xs" />
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-4" onClick={() => removeWP(i)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deliverables */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Deliverables ({data.deliverables.length})
                </CardTitle>
                <Button size="sm" variant="outline" onClick={addDeliverable}><Plus className="mr-1 h-3 w-3" /> Add</Button>
              </div>
            </CardHeader>
            <CardContent>
              {data.deliverables.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No deliverables extracted.</p>
              ) : (
                <div className="space-y-2">
                  {data.deliverables.map((d, i) => (
                    <div key={i} className="flex gap-2 items-start p-3 rounded-md border bg-muted/10">
                      <div className="grid gap-2 flex-1 sm:grid-cols-5">
                        <div className="space-y-1">
                          <Label className="text-[10px]">#</Label>
                          <Input value={d.number} onChange={e => updateDeliverable(i, 'number', e.target.value)} className="h-8 text-xs" placeholder="D1.1" />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-[10px]">Title</Label>
                          <Input value={d.title} onChange={e => updateDeliverable(i, 'title', e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">WP#</Label>
                          <Input type="number" value={d.wp_number ?? ''} onChange={e => updateDeliverable(i, 'wp_number', e.target.value ? Number(e.target.value) : null)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Due M</Label>
                          <Input type="number" value={d.due_month} onChange={e => updateDeliverable(i, 'due_month', Number(e.target.value))} className="h-8 text-xs" />
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-4" onClick={() => removeDeliverable(i)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Milestones */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" /> Milestones ({data.milestones.length})
                </CardTitle>
                <Button size="sm" variant="outline" onClick={addMilestone}><Plus className="mr-1 h-3 w-3" /> Add</Button>
              </div>
            </CardHeader>
            <CardContent>
              {data.milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No milestones extracted.</p>
              ) : (
                <div className="space-y-2">
                  {data.milestones.map((m, i) => (
                    <div key={i} className="flex gap-2 items-start p-3 rounded-md border bg-muted/10">
                      <div className="grid gap-2 flex-1 sm:grid-cols-5">
                        <div className="space-y-1">
                          <Label className="text-[10px]">#</Label>
                          <Input value={m.number} onChange={e => updateMilestone(i, 'number', e.target.value)} className="h-8 text-xs" placeholder="MS1" />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-[10px]">Title</Label>
                          <Input value={m.title} onChange={e => updateMilestone(i, 'title', e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">WP#</Label>
                          <Input type="number" value={m.wp_number ?? ''} onChange={e => updateMilestone(i, 'wp_number', e.target.value ? Number(e.target.value) : null)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Due M</Label>
                          <Input type="number" value={m.due_month} onChange={e => updateMilestone(i, 'due_month', Number(e.target.value))} className="h-8 text-xs" />
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-4" onClick={() => removeMilestone(i)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reporting Periods */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" /> Reporting Periods ({data.reporting_periods.length})
                </CardTitle>
                <Button size="sm" variant="outline" onClick={addRP}><Plus className="mr-1 h-3 w-3" /> Add</Button>
              </div>
            </CardHeader>
            <CardContent>
              {data.reporting_periods.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No reporting periods extracted.</p>
              ) : (
                <div className="space-y-2">
                  {data.reporting_periods.map((rp, i) => (
                    <div key={i} className="flex gap-2 items-center p-3 rounded-md border bg-muted/10">
                      <div className="grid gap-2 flex-1 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label className="text-[10px]">RP#</Label>
                          <Input type="number" value={rp.period_number} onChange={e => updateRP(i, 'period_number', Number(e.target.value))} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Start Month</Label>
                          <Input type="number" value={rp.start_month} onChange={e => updateRP(i, 'start_month', Number(e.target.value))} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">End Month</Label>
                          <Input type="number" value={rp.end_month} onChange={e => updateRP(i, 'end_month', Number(e.target.value))} className="h-8 text-xs" />
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeRP(i)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary & Confirm */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <div className="text-sm">
                  <span className="font-semibold">Ready to create:</span>{' '}
                  1 project, {data.work_packages.length} work packages, {data.deliverables.length} deliverables,{' '}
                  {data.milestones.length} milestones, {data.reporting_periods.length} reporting periods
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setStep('upload'); setData(null); setFile(null) }}>
                  Start Over
                </Button>
                <Button
                  size="lg"
                  onClick={handleConfirm}
                  disabled={!data.project.acronym.trim() || !data.project.title.trim() || !data.project.start_date || !data.project.end_date}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Create Project
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
