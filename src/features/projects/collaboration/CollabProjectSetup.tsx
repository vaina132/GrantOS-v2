import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { collabProjectService, collabPartnerService, collabWpService } from '@/services/collabProjectService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import type { CollabPartnerRole, CollabIndirectCostBase } from '@/types'

// ============================================================================
// Types for local form state
// ============================================================================

interface ProjectFormData {
  title: string
  acronym: string
  grant_number: string
  funding_programme: string
  funding_scheme: string
  start_date: string
  end_date: string
  duration_months: string
}

interface PartnerFormData {
  _key: string
  org_name: string
  role: CollabPartnerRole
  participant_number: string
  contact_name: string
  contact_email: string
  country: string
  budget_personnel: string
  budget_subcontracting: string
  budget_travel: string
  budget_equipment: string
  budget_other_goods: string
  total_person_months: string
  funding_rate: string
  indirect_cost_rate: string
  indirect_cost_base: CollabIndirectCostBase
}

interface WpFormData {
  _key: string
  wp_number: string
  title: string
  total_person_months: string
}

const STEPS = ['Project Identity', 'Partners', 'Work Packages', 'Review & Create']

function emptyPartner(num: number): PartnerFormData {
  return {
    _key: crypto.randomUUID(),
    org_name: '',
    role: num === 1 ? 'coordinator' : 'partner',
    participant_number: String(num),
    contact_name: '',
    contact_email: '',
    country: '',
    budget_personnel: '0',
    budget_subcontracting: '0',
    budget_travel: '0',
    budget_equipment: '0',
    budget_other_goods: '0',
    total_person_months: '0',
    funding_rate: '100',
    indirect_cost_rate: '25',
    indirect_cost_base: 'all_except_subcontracting',
  }
}

function emptyWp(num: number): WpFormData {
  return { _key: crypto.randomUUID(), wp_number: String(num), title: '', total_person_months: '0' }
}

// ============================================================================
// Main Component
// ============================================================================

export function CollabProjectSetup() {
  const { orgId, user } = useAuthStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Form state
  const [project, setProject] = useState<ProjectFormData>({
    title: '', acronym: '', grant_number: '', funding_programme: 'Horizon Europe',
    funding_scheme: '', start_date: '', end_date: '', duration_months: '',
  })
  const [partners, setPartners] = useState<PartnerFormData[]>([emptyPartner(1)])
  const [wps, setWps] = useState<WpFormData[]>([emptyWp(1)])

  // Helpers
  const updateProject = (field: keyof ProjectFormData, value: string) =>
    setProject(prev => ({ ...prev, [field]: value }))

  const updatePartner = (idx: number, field: keyof PartnerFormData, value: string) =>
    setPartners(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))

  const addPartner = () => setPartners(prev => [...prev, emptyPartner(prev.length + 1)])
  const removePartner = (idx: number) => setPartners(prev => prev.filter((_, i) => i !== idx))

  const updateWp = (idx: number, field: keyof WpFormData, value: string) =>
    setWps(prev => prev.map((w, i) => i === idx ? { ...w, [field]: value } : w))

  const addWp = () => setWps(prev => [...prev, emptyWp(prev.length + 1)])
  const removeWp = (idx: number) => setWps(prev => prev.filter((_, i) => i !== idx))

  // Validation
  const canNext = useCallback(() => {
    if (step === 0) return project.title.trim() && project.acronym.trim()
    if (step === 1) return partners.length > 0 && partners.every(p => p.org_name.trim())
    if (step === 2) return true
    return true
  }, [step, project, partners])

  // Save everything
  const handleCreate = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      // 1. Create the project
      const created = await collabProjectService.create({
        host_org_id: orgId,
        title: project.title,
        acronym: project.acronym,
        grant_number: project.grant_number || null,
        funding_programme: project.funding_programme || null,
        funding_scheme: project.funding_scheme || null,
        start_date: project.start_date || null,
        end_date: project.end_date || null,
        duration_months: project.duration_months ? parseInt(project.duration_months) : null,
        status: 'draft',
        created_by: user?.id || null,
      } as any)

      // 2. Create work packages
      await collabWpService.upsertMany(
        created.id,
        wps.filter(w => w.title.trim()).map(w => ({
          wp_number: parseInt(w.wp_number) || 0,
          title: w.title,
          total_person_months: parseFloat(w.total_person_months) || 0,
        }))
      )

      // 3. Create partners
      for (const p of partners) {
        await collabPartnerService.create({
          project_id: created.id,
          org_name: p.org_name,
          role: p.role,
          participant_number: parseInt(p.participant_number) || undefined,
          contact_name: p.contact_name || undefined,
          contact_email: p.contact_email || undefined,
          budget_personnel: parseFloat(p.budget_personnel) || 0,
          budget_subcontracting: parseFloat(p.budget_subcontracting) || 0,
          budget_travel: parseFloat(p.budget_travel) || 0,
          budget_equipment: parseFloat(p.budget_equipment) || 0,
          budget_other_goods: parseFloat(p.budget_other_goods) || 0,
          total_person_months: parseFloat(p.total_person_months) || 0,
          funding_rate: parseFloat(p.funding_rate) || 100,
          indirect_cost_rate: parseFloat(p.indirect_cost_rate) || 25,
          indirect_cost_base: p.indirect_cost_base,
        })
      }

      toast({ title: 'Created', description: `Collaboration project "${project.acronym}" created successfully` })
      navigate(`/projects/collaboration/${created.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create project'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/projects/collaboration')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">New Collaboration Project</h1>
          <p className="text-sm text-muted-foreground">Set up a multi-partner project with external reporting</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-1 flex-1">
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full ${
                i === step
                  ? 'bg-primary text-primary-foreground'
                  : i < step
                  ? 'bg-primary/10 text-primary cursor-pointer hover:bg-primary/20'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0 ${
                i < step ? 'bg-primary text-primary-foreground' : i === step ? 'bg-primary-foreground text-primary' : 'bg-muted-foreground/20'
              }`}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="hidden sm:inline truncate">{label}</span>
            </button>
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 0 && (
        <StepProjectIdentity project={project} updateProject={updateProject} />
      )}
      {step === 1 && (
        <StepPartners
          partners={partners}
          updatePartner={updatePartner}
          addPartner={addPartner}
          removePartner={removePartner}
        />
      )}
      {step === 2 && (
        <StepWorkPackages
          wps={wps}
          updateWp={updateWp}
          addWp={addWp}
          removeWp={removeWp}
        />
      )}
      {step === 3 && (
        <StepReview project={project} partners={partners} wps={wps} />
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button
          variant="outline"
          onClick={() => step === 0 ? navigate('/projects/collaboration') : setStep(step - 1)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={saving || !canNext()}>
            {saving ? 'Creating...' : 'Create Project'}
            <Check className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Step 1: Project Identity
// ============================================================================

function StepProjectIdentity({ project, updateProject }: {
  project: ProjectFormData
  updateProject: (field: keyof ProjectFormData, value: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Identity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Project Title *</Label>
            <Input value={project.title} onChange={e => updateProject('title', e.target.value)} placeholder="Full project title" />
          </div>
          <div className="space-y-2">
            <Label>Acronym *</Label>
            <Input value={project.acronym} onChange={e => updateProject('acronym', e.target.value)} placeholder="e.g. ODEON, DataBridge" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Grant Agreement Number</Label>
            <Input value={project.grant_number} onChange={e => updateProject('grant_number', e.target.value)} placeholder="e.g. 101136128" />
          </div>
          <div className="space-y-2">
            <Label>Funding Programme</Label>
            <Input value={project.funding_programme} onChange={e => updateProject('funding_programme', e.target.value)} placeholder="e.g. Horizon Europe" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Funding Scheme</Label>
          <Input value={project.funding_scheme} onChange={e => updateProject('funding_scheme', e.target.value)} placeholder="e.g. Research and Innovation Action" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input type="date" value={project.start_date} onChange={e => updateProject('start_date', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input type="date" value={project.end_date} onChange={e => updateProject('end_date', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Duration (months)</Label>
            <Input type="number" value={project.duration_months} onChange={e => updateProject('duration_months', e.target.value)} placeholder="e.g. 36" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Step 2: Partners
// ============================================================================

function StepPartners({ partners, updatePartner, addPartner, removePartner }: {
  partners: PartnerFormData[]
  updatePartner: (idx: number, field: keyof PartnerFormData, value: string) => void
  addPartner: () => void
  removePartner: (idx: number) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Consortium Partners</h3>
          <p className="text-sm text-muted-foreground">Add all organisations including the coordinator</p>
        </div>
        <Button variant="outline" size="sm" onClick={addPartner} className="gap-2">
          <Plus className="h-4 w-4" /> Add Partner
        </Button>
      </div>

      {partners.map((p, idx) => (
        <Card key={p._key}>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={p.role === 'coordinator' ? 'default' : 'secondary'}>
                  {p.role === 'coordinator' ? 'Coordinator' : `Partner #${p.participant_number}`}
                </Badge>
                {p.org_name && <span className="font-medium text-sm">{p.org_name}</span>}
              </div>
              {partners.length > 1 && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removePartner(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Organisation Name *</Label>
                <Input value={p.org_name} onChange={e => updatePartner(idx, 'org_name', e.target.value)} placeholder="Organisation name" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Role</Label>
                <select
                  value={p.role}
                  onChange={e => updatePartner(idx, 'role', e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="coordinator">Coordinator</option>
                  <option value="partner">Partner</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Participant #</Label>
                <Input type="number" value={p.participant_number} onChange={e => updatePartner(idx, 'participant_number', e.target.value)} className="h-9 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Contact Name</Label>
                <Input value={p.contact_name} onChange={e => updatePartner(idx, 'contact_name', e.target.value)} placeholder="Financial reporting contact" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Contact Email</Label>
                <Input type="email" value={p.contact_email} onChange={e => updatePartner(idx, 'contact_email', e.target.value)} placeholder="email@organisation.eu" className="h-9 text-sm" />
              </div>
            </div>

            <details className="group">
              <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                Budget & Rates ▸
              </summary>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Personnel (€)</Label>
                    <Input type="number" value={p.budget_personnel} onChange={e => updatePartner(idx, 'budget_personnel', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Subcontracting (€)</Label>
                    <Input type="number" value={p.budget_subcontracting} onChange={e => updatePartner(idx, 'budget_subcontracting', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Travel (€)</Label>
                    <Input type="number" value={p.budget_travel} onChange={e => updatePartner(idx, 'budget_travel', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Equipment (€)</Label>
                    <Input type="number" value={p.budget_equipment} onChange={e => updatePartner(idx, 'budget_equipment', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Other (€)</Label>
                    <Input type="number" value={p.budget_other_goods} onChange={e => updatePartner(idx, 'budget_other_goods', e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Person-Months</Label>
                    <Input type="number" value={p.total_person_months} onChange={e => updatePartner(idx, 'total_person_months', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Funding Rate (%)</Label>
                    <Input type="number" value={p.funding_rate} onChange={e => updatePartner(idx, 'funding_rate', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Indirect Cost Rate (%)</Label>
                    <Input type="number" value={p.indirect_cost_rate} onChange={e => updatePartner(idx, 'indirect_cost_rate', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Indirect Cost Base</Label>
                    <select
                      value={p.indirect_cost_base}
                      onChange={e => updatePartner(idx, 'indirect_cost_base', e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    >
                      <option value="all_direct">All direct costs</option>
                      <option value="personnel_only">Personnel only</option>
                      <option value="all_except_subcontracting">All except subcontracting</option>
                    </select>
                  </div>
                </div>
              </div>
            </details>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================================================
// Step 3: Work Packages
// ============================================================================

function StepWorkPackages({ wps, updateWp, addWp, removeWp }: {
  wps: WpFormData[]
  updateWp: (idx: number, field: keyof WpFormData, value: string) => void
  addWp: () => void
  removeWp: (idx: number) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Work Packages</h3>
          <p className="text-sm text-muted-foreground">Define the project work package structure</p>
        </div>
        <Button variant="outline" size="sm" onClick={addWp} className="gap-2">
          <Plus className="h-4 w-4" /> Add WP
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            {wps.map((wp, idx) => (
              <div key={wp._key} className="flex items-center gap-3">
                <div className="w-20">
                  <Input
                    value={wp.wp_number}
                    onChange={e => updateWp(idx, 'wp_number', e.target.value)}
                    placeholder="WP#"
                    className="h-9 text-sm text-center"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    value={wp.title}
                    onChange={e => updateWp(idx, 'title', e.target.value)}
                    placeholder="Work package title"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="w-28">
                  <Input
                    type="number"
                    value={wp.total_person_months}
                    onChange={e => updateWp(idx, 'total_person_months', e.target.value)}
                    placeholder="PMs"
                    className="h-9 text-sm text-right"
                  />
                </div>
                {wps.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeWp(idx)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          {wps.length > 0 && (
            <div className="flex justify-end mt-3 pt-3 border-t text-sm text-muted-foreground">
              Total: {wps.reduce((sum, w) => sum + (parseFloat(w.total_person_months) || 0), 0).toFixed(1)} PMs
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Per-partner WP allocations can be configured after project creation.
      </p>
    </div>
  )
}

// ============================================================================
// Step 4: Review
// ============================================================================

function StepReview({ project, partners, wps }: {
  project: ProjectFormData
  partners: PartnerFormData[]
  wps: WpFormData[]
}) {
  const coordinator = partners.find(p => p.role === 'coordinator')
  const totalBudget = partners.reduce((sum, p) =>
    sum + (parseFloat(p.budget_personnel) || 0)
        + (parseFloat(p.budget_subcontracting) || 0)
        + (parseFloat(p.budget_travel) || 0)
        + (parseFloat(p.budget_equipment) || 0)
        + (parseFloat(p.budget_other_goods) || 0)
  , 0)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Project Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <div><span className="text-muted-foreground">Title:</span> <strong>{project.title}</strong></div>
            <div><span className="text-muted-foreground">Acronym:</span> <strong>{project.acronym}</strong></div>
            {project.grant_number && <div><span className="text-muted-foreground">Grant #:</span> {project.grant_number}</div>}
            {project.funding_programme && <div><span className="text-muted-foreground">Programme:</span> {project.funding_programme}</div>}
            {project.start_date && <div><span className="text-muted-foreground">Start:</span> {project.start_date}</div>}
            {project.end_date && <div><span className="text-muted-foreground">End:</span> {project.end_date}</div>}
            {project.duration_months && <div><span className="text-muted-foreground">Duration:</span> {project.duration_months} months</div>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Consortium ({partners.length} organisation{partners.length !== 1 ? 's' : ''})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {coordinator && (
              <div className="flex items-center gap-2">
                <Badge>Coordinator</Badge>
                <span className="font-medium">{coordinator.org_name}</span>
                {coordinator.contact_email && <span className="text-muted-foreground">({coordinator.contact_email})</span>}
              </div>
            )}
            {partners.filter(p => p.role !== 'coordinator').map((p) => (
              <div key={p._key} className="flex items-center gap-2">
                <Badge variant="secondary">Partner #{p.participant_number}</Badge>
                <span className="font-medium">{p.org_name}</span>
                {p.contact_email && <span className="text-muted-foreground">({p.contact_email})</span>}
              </div>
            ))}
          </div>
          {totalBudget > 0 && (
            <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
              Total consortium budget: <strong className="text-foreground">€{totalBudget.toLocaleString()}</strong>
            </div>
          )}
        </CardContent>
      </Card>

      {wps.filter(w => w.title.trim()).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Work Packages ({wps.filter(w => w.title.trim()).length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              {wps.filter(w => w.title.trim()).map(w => (
                <div key={w._key} className="flex justify-between">
                  <span>WP{w.wp_number}: {w.title}</span>
                  <span className="text-muted-foreground">{w.total_person_months} PMs</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 text-sm">
        <p className="font-medium text-amber-800 dark:text-amber-300">The project will be created in Draft status.</p>
        <p className="text-amber-700 dark:text-amber-400 mt-1">
          You can continue editing, add more details, and configure reporting periods.
          When ready, launch the project to send invitations to all partners.
        </p>
      </div>
    </div>
  )
}
