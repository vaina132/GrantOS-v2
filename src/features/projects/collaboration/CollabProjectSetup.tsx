import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Check, Plus, Trash2, Upload, Sparkles, Loader2,
  FileText, X, AlertTriangle, Info,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import {
  collabProjectService, collabPartnerService, collabWpService,
  collabTaskService, collabDeliverableService, collabMilestoneService,
} from '@/services/collabProjectService'
import { collabAIService } from '@/services/collabAIService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import {
  FUNDING_PROGRAMMES, FUNDING_SCHEMES, ALL_FUNDING_SCHEMES,
  HORIZON_COUNTRIES, ORG_TYPES, BUDGET_TOOLTIPS,
} from '@/lib/collabConstants'
import type { CollabPartnerRole, CollabIndirectCostBase } from '@/types'

// ============================================================================
// Tooltip helper
// ============================================================================

function Tip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex ml-1">
      <Info
        className="h-3.5 w-3.5 text-muted-foreground cursor-help"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      />
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 rounded-md bg-popover border shadow-md text-[11px] text-popover-foreground leading-relaxed">
          {text}
        </span>
      )}
    </span>
  )
}

// ============================================================================
// Autocomplete input
// ============================================================================

function AutocompleteInput({
  value, onChange, options, placeholder, className,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() => {
    const q = (filter || value).toLowerCase()
    if (!q) return options.slice(0, 15)
    return options.filter(o => o.toLowerCase().includes(q)).slice(0, 15)
  }, [filter, value, options])

  return (
    <div ref={ref} className="relative">
      <Input
        value={value}
        onChange={e => { onChange(e.target.value); setFilter(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={className}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border bg-popover shadow-md">
          {filtered.map(opt => (
            <button
              key={opt}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent truncate"
              onClick={() => { onChange(opt); setOpen(false); setFilter('') }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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
  org_type: string
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

interface TaskFormData {
  _key: string
  task_number: string
  title: string
  start_month: string
  end_month: string
  leader_partner_idx: string
  person_months: string
}

interface WpFormData {
  _key: string
  wp_number: string
  title: string
  total_person_months: string
  start_month: string
  end_month: string
  leader_partner_idx: string
  tasks: TaskFormData[]
}

interface DeliverableFormData {
  _key: string
  number: string
  title: string
  wp_number: string
  task_number: string
  due_month: string
  type: string
  dissemination: string
  leader_partner_idx: string
}

interface MilestoneFormData {
  _key: string
  number: string
  title: string
  wp_number: string
  due_month: string
  verification_means: string
}

const STEPS = ['Project Identity', 'Partners', 'Work Plan', 'Deliverables & Milestones', 'Review & Create']

function emptyPartner(num: number): PartnerFormData {
  return {
    _key: crypto.randomUUID(),
    org_name: '',
    org_type: '',
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

function emptyTask(wpNum: string, taskIdx: number): TaskFormData {
  return {
    _key: crypto.randomUUID(),
    task_number: `T${wpNum}.${taskIdx}`,
    title: '',
    start_month: '',
    end_month: '',
    leader_partner_idx: '',
    person_months: '0',
  }
}

function emptyWp(num: number): WpFormData {
  return {
    _key: crypto.randomUUID(),
    wp_number: String(num),
    title: '',
    total_person_months: '0',
    start_month: '1',
    end_month: '',
    leader_partner_idx: '',
    tasks: [],
  }
}

function emptyDeliverable(num: number): DeliverableFormData {
  return {
    _key: crypto.randomUUID(),
    number: `D${num}`,
    title: '',
    wp_number: '',
    task_number: '',
    due_month: '',
    type: '',
    dissemination: 'public',
    leader_partner_idx: '',
  }
}

function emptyMilestone(num: number): MilestoneFormData {
  return {
    _key: crypto.randomUUID(),
    number: `MS${num}`,
    title: '',
    wp_number: '',
    due_month: '',
    verification_means: '',
  }
}

// ============================================================================
// Date / Duration helpers
// ============================================================================

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

function monthsBetween(start: string, end: string): number {
  const a = new Date(start), b = new Date(end)
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1
}

function dateWarning(project: ProjectFormData): string | null {
  if (!project.start_date || !project.duration_months) return null
  const dur = parseInt(project.duration_months)
  if (!dur || dur <= 0) return null
  const expected = addMonths(project.start_date, dur)
  if (project.end_date && project.end_date !== expected) {
    return `Based on the start date and ${dur} months duration, the end date should be ${expected}. Current: ${project.end_date}.`
  }
  return null
}

// ============================================================================
// Main Component
// ============================================================================

export function CollabProjectSetup({ mode = 'manual' }: { mode?: 'manual' | 'ai-import' }) {
  const { orgId, user } = useAuthStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // AI Import state
  const [aiFile, setAiFile] = useState<File | null>(null)
  const [aiParsing, setAiParsing] = useState(false)
  const [aiInstructions, setAiInstructions] = useState('')
  const [aiDragOver, setAiDragOver] = useState(false)

  // Form state
  const [project, setProject] = useState<ProjectFormData>({
    title: '', acronym: '', grant_number: '', funding_programme: 'Horizon Europe',
    funding_scheme: '', start_date: '', end_date: '', duration_months: '',
  })
  const [partners, setPartners] = useState<PartnerFormData[]>([emptyPartner(1)])
  const [wps, setWps] = useState<WpFormData[]>([emptyWp(1)])
  const [deliverables, setDeliverables] = useState<DeliverableFormData[]>([])
  const [milestones, setMilestones] = useState<MilestoneFormData[]>([])

  // Helpers
  const updateProject = (field: keyof ProjectFormData, value: string) => {
    setProject(prev => {
      const next = { ...prev, [field]: value }
      // Auto-calc end date when start_date or duration_months changes
      if ((field === 'start_date' || field === 'duration_months') && next.start_date && next.duration_months) {
        const dur = parseInt(next.duration_months)
        if (dur > 0) next.end_date = addMonths(next.start_date, dur)
      }
      // Auto-calc duration when end_date changes manually
      if (field === 'end_date' && next.start_date && next.end_date) {
        next.duration_months = String(monthsBetween(next.start_date, next.end_date))
      }
      return next
    })
  }

  const updatePartner = (idx: number, field: keyof PartnerFormData, value: string) =>
    setPartners(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))

  const addPartner = () => setPartners(prev => [...prev, emptyPartner(prev.length + 1)])
  const removePartner = (idx: number) => setPartners(prev => prev.filter((_, i) => i !== idx))

  const updateWp = (idx: number, field: string, value: any) =>
    setWps(prev => prev.map((w, i) => i === idx ? { ...w, [field]: value } : w))

  const addWp = () => setWps(prev => [...prev, emptyWp(prev.length + 1)])
  const removeWp = (idx: number) => setWps(prev => prev.filter((_, i) => i !== idx))

  const addTaskToWp = (wpIdx: number) => {
    setWps(prev => prev.map((w, i) => {
      if (i !== wpIdx) return w
      return { ...w, tasks: [...w.tasks, emptyTask(w.wp_number, w.tasks.length + 1)] }
    }))
  }
  const updateTask = (wpIdx: number, tIdx: number, field: string, value: string) => {
    setWps(prev => prev.map((w, wi) => {
      if (wi !== wpIdx) return w
      return { ...w, tasks: w.tasks.map((t, ti) => ti === tIdx ? { ...t, [field]: value } : t) }
    }))
  }
  const removeTask = (wpIdx: number, tIdx: number) => {
    setWps(prev => prev.map((w, wi) => {
      if (wi !== wpIdx) return w
      return { ...w, tasks: w.tasks.filter((_, ti) => ti !== tIdx) }
    }))
  }

  const addDeliverable = () => setDeliverables(prev => [...prev, emptyDeliverable(prev.length + 1)])
  const updateDeliverable = (idx: number, field: string, value: string) =>
    setDeliverables(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d))
  const removeDeliverable = (idx: number) => setDeliverables(prev => prev.filter((_, i) => i !== idx))

  const addMilestone = () => setMilestones(prev => [...prev, emptyMilestone(prev.length + 1)])
  const updateMilestone = (idx: number, field: string, value: string) =>
    setMilestones(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m))
  const removeMilestone = (idx: number) => setMilestones(prev => prev.filter((_, i) => i !== idx))

  // AI Import
  const handleAIImport = async () => {
    if (!aiFile) return
    setAiParsing(true)
    try {
      const result = await collabAIService.parseCollabGrant(aiFile, {
        userInstructions: aiInstructions.trim() || undefined,
      })

      // Check for warning (AI returned empty/useless data)
      if (result.warning) {
        toast({
          title: 'No Data Found',
          description: result.warning,
          variant: 'destructive',
        })
        setAiParsing(false)
        return
      }

      const d = result.extraction
      if (!d) {
        toast({ title: 'Import Error', description: 'AI returned no extraction data.', variant: 'destructive' })
        setAiParsing(false)
        return
      }

      // Fill project
      if (d.project) {
        setProject({
          title: d.project.title || '',
          acronym: d.project.acronym || '',
          grant_number: d.project.grant_number || '',
          funding_programme: d.project.funding_programme || 'Horizon Europe',
          funding_scheme: d.project.funding_scheme || '',
          start_date: d.project.start_date || '',
          end_date: d.project.end_date || '',
          duration_months: d.project.duration_months ? String(d.project.duration_months) : '',
        })
      }
      // Fill partners
      if (d.partners && d.partners.length > 0) {
        setPartners(d.partners.map((p, i) => ({
          _key: crypto.randomUUID(),
          org_name: p.org_name || '',
          org_type: p.org_type || '',
          role: p.role || (i === 0 ? 'coordinator' : 'partner'),
          participant_number: p.participant_number ? String(p.participant_number) : String(i + 1),
          contact_name: p.contact_name || '',
          contact_email: p.contact_email || '',
          country: p.country || '',
          budget_personnel: p.budget_personnel ? String(p.budget_personnel) : '0',
          budget_subcontracting: p.budget_subcontracting ? String(p.budget_subcontracting) : '0',
          budget_travel: p.budget_travel ? String(p.budget_travel) : '0',
          budget_equipment: p.budget_equipment ? String(p.budget_equipment) : '0',
          budget_other_goods: p.budget_other_goods ? String(p.budget_other_goods) : '0',
          total_person_months: p.total_person_months ? String(p.total_person_months) : '0',
          funding_rate: p.funding_rate ? String(p.funding_rate) : '100',
          indirect_cost_rate: p.indirect_cost_rate ? String(p.indirect_cost_rate) : '25',
          indirect_cost_base: 'all_except_subcontracting',
        })))
      }
      // Fill work packages with tasks
      if (d.work_packages && d.work_packages.length > 0) {
        setWps(d.work_packages.map(wp => ({
          _key: crypto.randomUUID(),
          wp_number: String(wp.wp_number),
          title: wp.title || '',
          total_person_months: wp.total_person_months ? String(wp.total_person_months) : '0',
          start_month: wp.start_month ? String(wp.start_month) : '1',
          end_month: wp.end_month ? String(wp.end_month) : '',
          leader_partner_idx: wp.leader_participant_number ? String(wp.leader_participant_number - 1) : '',
          tasks: (wp.tasks || []).map(t => ({
            _key: crypto.randomUUID(),
            task_number: t.task_number || '',
            title: t.title || '',
            start_month: t.start_month ? String(t.start_month) : '',
            end_month: t.end_month ? String(t.end_month) : '',
            leader_partner_idx: t.leader_participant_number ? String(t.leader_participant_number - 1) : '',
            person_months: t.person_months ? String(t.person_months) : '0',
          })),
        })))
      }
      // Fill deliverables
      if (d.deliverables && d.deliverables.length > 0) {
        setDeliverables(d.deliverables.map(del => ({
          _key: crypto.randomUUID(),
          number: del.number || '',
          title: del.title || '',
          wp_number: del.wp_number ? String(del.wp_number) : '',
          task_number: '',
          due_month: del.due_month ? String(del.due_month) : '',
          type: del.type || '',
          dissemination: del.dissemination || 'public',
          leader_partner_idx: del.leader_participant_number ? String(del.leader_participant_number - 1) : '',
        })))
      }
      // Fill milestones
      if (d.milestones && d.milestones.length > 0) {
        setMilestones(d.milestones.map(ms => ({
          _key: crypto.randomUUID(),
          number: ms.number || '',
          title: ms.title || '',
          wp_number: ms.wp_number ? String(ms.wp_number) : '',
          due_month: ms.due_month ? String(ms.due_month) : '',
          verification_means: ms.verification_means || '',
        })))
      }
      const counts = [
        d.partners?.length ? `${d.partners.length} partners` : '',
        d.work_packages?.length ? `${d.work_packages.length} WPs` : '',
        d.deliverables?.length ? `${d.deliverables.length} deliverables` : '',
        d.milestones?.length ? `${d.milestones.length} milestones` : '',
      ].filter(Boolean).join(', ')
      const usageInfo = result.usage ? ` (${result.usage.input_tokens + result.usage.output_tokens} tokens used)` : ''
      toast({
        title: 'AI Import Complete',
        description: `Extracted: ${counts || 'project data'}. Review all fields before creating.${d.confidence_notes ? ` Notes: ${d.confidence_notes}` : ''}${usageInfo}`,
      })
      setAiFile(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI import failed'
      toast({
        title: 'Import Error',
        description: `${msg}. Try a different file format or add specific instructions about where the data is located.`,
        variant: 'destructive',
      })
    } finally {
      setAiParsing(false)
    }
  }

  // Validation
  const canNext = useCallback(() => {
    if (step === 0) return project.title.trim() && project.acronym.trim()
    if (step === 1) return partners.length > 0 && partners.every(p => p.org_name.trim())
    if (step === 2) return true
    if (step === 3) return true
    return true
  }, [step, project, partners])

  // Save everything
  const handleCreate = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      // 1. Create the project
      console.log('[CollabCreate] Step 1: Creating project…')
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
      console.log('[CollabCreate] Project created:', created.id)

      // 2. Create partners (we need IDs for leadership references)
      console.log('[CollabCreate] Step 2: Creating partners…')
      const partnerMap: Record<number, string> = {}
      for (let i = 0; i < partners.length; i++) {
        const p = partners[i]
        const partnerData: Record<string, any> = {
          project_id: created.id,
          org_name: p.org_name,
          role: p.role,
          participant_number: parseInt(p.participant_number) || i + 1,
          budget_personnel: parseFloat(p.budget_personnel) || 0,
          budget_subcontracting: parseFloat(p.budget_subcontracting) || 0,
          budget_travel: parseFloat(p.budget_travel) || 0,
          budget_equipment: parseFloat(p.budget_equipment) || 0,
          budget_other_goods: parseFloat(p.budget_other_goods) || 0,
          total_person_months: parseFloat(p.total_person_months) || 0,
          funding_rate: parseFloat(p.funding_rate) || 100,
          indirect_cost_rate: parseFloat(p.indirect_cost_rate) || 25,
          indirect_cost_base: p.indirect_cost_base,
        }
        if (p.contact_name) partnerData.contact_name = p.contact_name
        if (p.contact_email) partnerData.contact_email = p.contact_email
        if (p.country) partnerData.country = p.country
        // org_type is from enhance_collab_module migration — include only if non-empty
        if (p.org_type) partnerData.org_type = p.org_type
        try {
          const cp = await collabPartnerService.create(partnerData as any)
          partnerMap[i] = cp.id
          console.log(`[CollabCreate] Partner ${i} created:`, cp.id)
        } catch (pErr) {
          // If org_type column doesn't exist, retry without it
          console.warn(`[CollabCreate] Partner ${i} create failed, retrying without org_type:`, pErr)
          delete partnerData.org_type
          const cp = await collabPartnerService.create(partnerData as any)
          partnerMap[i] = cp.id
          console.log(`[CollabCreate] Partner ${i} created (without org_type):`, cp.id)
        }
      }

      // 3. Create work packages
      console.log('[CollabCreate] Step 3: Creating work packages…')
      let createdWps: any[] = []
      const wpRows = wps.filter(w => w.title.trim()).map(w => ({
        wp_number: parseInt(w.wp_number) || 0,
        title: w.title,
        total_person_months: parseFloat(w.total_person_months) || 0,
        start_month: w.start_month ? parseInt(w.start_month) : null,
        end_month: w.end_month ? parseInt(w.end_month) : null,
        leader_partner_id: w.leader_partner_idx ? (partnerMap[parseInt(w.leader_partner_idx)] || null) : null,
      }))
      try {
        createdWps = await collabWpService.upsertMany(created.id, wpRows)
      } catch (wpErr) {
        // If new columns don't exist, retry with basic fields only
        console.warn('[CollabCreate] WP create with new fields failed, retrying basic:', wpErr)
        createdWps = await collabWpService.upsertMany(
          created.id,
          wpRows.map(({ start_month, end_month, leader_partner_id, ...basic }) => basic)
        )
      }
      console.log(`[CollabCreate] ${createdWps.length} WPs created`)

      // Build WP number → ID map
      const wpIdMap: Record<number, string> = {}
      for (const wp of createdWps) wpIdMap[wp.wp_number] = wp.id

      // 4. Create tasks for each WP (optional — table may not exist yet)
      try {
        for (const wp of wps) {
          const wpId = wpIdMap[parseInt(wp.wp_number)]
          if (!wpId || wp.tasks.length === 0) continue
          await collabTaskService.createMany(
            created.id,
            wpId,
            wp.tasks.filter(t => t.title.trim()).map(t => ({
              task_number: t.task_number,
              title: t.title,
              start_month: t.start_month ? parseInt(t.start_month) : null,
              end_month: t.end_month ? parseInt(t.end_month) : null,
              leader_partner_id: t.leader_partner_idx ? (partnerMap[parseInt(t.leader_partner_idx)] || null) : null,
              person_months: parseFloat(t.person_months) || 0,
            }))
          )
        }
        console.log('[CollabCreate] Tasks created')
      } catch (tErr) {
        console.warn('[CollabCreate] Tasks creation skipped (migration may be pending):', tErr)
      }

      // 5. Create deliverables (optional — table may not exist yet)
      try {
        const delsToCreate = deliverables.filter(d => d.title.trim()).map(d => ({
          wp_id: d.wp_number ? (wpIdMap[parseInt(d.wp_number)] || null) : null,
          number: d.number,
          title: d.title,
          type: d.type || null,
          dissemination: d.dissemination || null,
          due_month: parseInt(d.due_month) || 1,
          leader_partner_id: d.leader_partner_idx ? (partnerMap[parseInt(d.leader_partner_idx)] || null) : null,
        }))
        if (delsToCreate.length > 0) {
          await collabDeliverableService.createMany(created.id, delsToCreate)
          console.log(`[CollabCreate] ${delsToCreate.length} deliverables created`)
        }
      } catch (dErr) {
        console.warn('[CollabCreate] Deliverables creation skipped (migration may be pending):', dErr)
      }

      // 6. Create milestones (optional — table may not exist yet)
      try {
        const msToCreate = milestones.filter(m => m.title.trim()).map(m => ({
          wp_id: m.wp_number ? (wpIdMap[parseInt(m.wp_number)] || null) : null,
          number: m.number,
          title: m.title,
          due_month: parseInt(m.due_month) || 1,
          verification_means: m.verification_means || null,
        }))
        if (msToCreate.length > 0) {
          await collabMilestoneService.createMany(created.id, msToCreate)
          console.log(`[CollabCreate] ${msToCreate.length} milestones created`)
        }
      } catch (mErr) {
        console.warn('[CollabCreate] Milestones creation skipped (migration may be pending):', mErr)
      }

      toast({ title: 'Created', description: `Collaboration project "${project.acronym}" created successfully` })
      navigate(`/projects/collaboration/${created.id}`)
    } catch (err) {
      console.error('[CollabCreate] FATAL ERROR:', err)
      const msg = err instanceof Error ? err.message : 'Failed to create project'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // Funding scheme options based on selected programme
  const schemeOptions = useMemo(() => {
    if (!project.funding_programme) return ALL_FUNDING_SCHEMES
    const match = Object.keys(FUNDING_SCHEMES).find(k =>
      project.funding_programme.toLowerCase().includes(k.toLowerCase())
    )
    return match ? FUNDING_SCHEMES[match] : ALL_FUNDING_SCHEMES
  }, [project.funding_programme])

  const countryOptions = useMemo(() =>
    HORIZON_COUNTRIES.map(c => `${c.code} — ${c.name}`), [])

  const warn = dateWarning(project)

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

      {/* AI Import Banner — only shown on AI import route */}
      {mode === 'ai-import' && <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-purple-500 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-medium text-sm">Import from Grant Agreement (AI)</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload your grant agreement PDF or a screenshot of the budget table. AI will extract project details, partners, work packages, tasks, deliverables, and milestones.
                </p>
              </div>
              <div className="rounded-md border border-purple-200 dark:border-purple-800 bg-background p-2 space-y-1.5">
                <p className="text-[11px] font-medium text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" /> Best documents to upload
                </p>
                <ul className="text-[11px] text-muted-foreground space-y-0.5 ml-4 list-disc">
                  <li><strong>Grant Agreement Annex</strong> — contains budget table, work packages, deliverables</li>
                  <li><strong>Budget table screenshot</strong> — per-partner breakdown of costs</li>
                  <li><strong>Work plan section</strong> — WP descriptions, tasks, Gantt chart</li>
                  <li><strong>Deliverable / milestone table</strong> — list with due months</li>
                </ul>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={aiInstructions}
                  onChange={e => setAiInstructions(e.target.value)}
                  placeholder="Optional hints: e.g. 'Budget is in Annex 2, we are Partner 3'"
                  className="h-8 text-xs flex-1"
                />
              </div>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                  aiDragOver ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40' : 'border-muted-foreground/25 hover:border-purple-400'
                }`}
                onDragOver={e => { e.preventDefault(); setAiDragOver(true) }}
                onDragLeave={() => setAiDragOver(false)}
                onDrop={e => {
                  e.preventDefault(); setAiDragOver(false)
                  const f = e.dataTransfer.files[0]
                  if (f) setAiFile(f)
                }}
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = '.pdf,.png,.jpg,.jpeg,.webp'
                  input.onchange = (e) => {
                    const f = (e.target as HTMLInputElement).files?.[0]
                    if (f) setAiFile(f)
                  }
                  input.click()
                }}
              >
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1.5" />
                <div className="text-xs font-medium">
                  {aiFile ? aiFile.name : 'Drop PDF or image here, or click to browse'}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">PDF, PNG, JPG up to 25MB</div>
              </div>
              {aiFile && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium">{aiFile.name}</span>
                  <span className="text-xs text-muted-foreground">({(aiFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 ml-auto" onClick={() => setAiFile(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                  <Button size="sm" className="h-7 gap-1.5" onClick={handleAIImport} disabled={aiParsing}>
                    {aiParsing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {aiParsing ? 'Analyzing...' : 'Extract Data'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>}

      {/* Stepper */}
      <div className="flex items-center gap-1">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-1 flex-1">
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors w-full ${
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
              <span className="hidden lg:inline truncate text-xs">{label}</span>
            </button>
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 0 && (
        <StepProjectIdentity project={project} updateProject={updateProject} schemeOptions={schemeOptions} warn={warn} />
      )}
      {step === 1 && (
        <StepPartners partners={partners} updatePartner={updatePartner} addPartner={addPartner} removePartner={removePartner} countryOptions={countryOptions} />
      )}
      {step === 2 && (
        <StepWorkPlan wps={wps} updateWp={updateWp} addWp={addWp} removeWp={removeWp} partners={partners} addTaskToWp={addTaskToWp} updateTask={updateTask} removeTask={removeTask} />
      )}
      {step === 3 && (
        <StepDeliverablesAndMilestones
          deliverables={deliverables} addDeliverable={addDeliverable} updateDeliverable={updateDeliverable} removeDeliverable={removeDeliverable}
          milestones={milestones} addMilestone={addMilestone} updateMilestone={updateMilestone} removeMilestone={removeMilestone}
          wps={wps} partners={partners}
        />
      )}
      {step === 4 && (
        <StepReview project={project} partners={partners} wps={wps} deliverables={deliverables} milestones={milestones} />
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => step === 0 ? navigate('/projects/collaboration') : setStep(step - 1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
            Next <ArrowRight className="ml-2 h-4 w-4" />
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

function StepProjectIdentity({ project, updateProject, schemeOptions, warn }: {
  project: ProjectFormData
  updateProject: (field: keyof ProjectFormData, value: string) => void
  schemeOptions: string[]
  warn: string | null
}) {
  return (
    <Card>
      <CardHeader><CardTitle>Project Identity</CardTitle></CardHeader>
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
            <AutocompleteInput value={project.funding_programme} onChange={v => updateProject('funding_programme', v)} options={FUNDING_PROGRAMMES} placeholder="e.g. Horizon Europe" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Funding Scheme <Tip text="The specific action type or instrument under the funding programme. For Horizon Europe: RIA, IA, CSA, ERC grants, MSCA actions, EIC instruments, etc." /></Label>
          <AutocompleteInput value={project.funding_scheme} onChange={v => updateProject('funding_scheme', v)} options={schemeOptions} placeholder="e.g. Research and Innovation Action (RIA)" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input type="date" value={project.start_date} onChange={e => updateProject('start_date', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Duration (months)</Label>
            <Input type="number" value={project.duration_months} onChange={e => updateProject('duration_months', e.target.value)} placeholder="e.g. 36" />
          </div>
          <div className="space-y-2">
            <Label>End Date <span className="text-[10px] text-muted-foreground ml-1">(auto-calculated)</span></Label>
            <Input type="date" value={project.end_date} onChange={e => updateProject('end_date', e.target.value)} />
          </div>
        </div>
        {warn && (
          <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            {warn}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Step 2: Partners
// ============================================================================

function StepPartners({ partners, updatePartner, addPartner, removePartner, countryOptions }: {
  partners: PartnerFormData[]
  updatePartner: (idx: number, field: keyof PartnerFormData, value: string) => void
  addPartner: () => void
  removePartner: (idx: number) => void
  countryOptions: string[]
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

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Organisation Name *</Label>
                <Input value={p.org_name} onChange={e => updatePartner(idx, 'org_name', e.target.value)} placeholder="Organisation name" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Organisation Type <Tip text="Official EU participant type: HES = University, REC = Research Org, PRC = Private Company, PUB = Public Body, OTH = Other" /></Label>
                <select value={p.org_type} onChange={e => updatePartner(idx, 'org_type', e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">Select...</option>
                  {ORG_TYPES.map(ot => <option key={ot.code} value={ot.code}>{ot.code} — {ot.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Role</Label>
                <select value={p.role} onChange={e => updatePartner(idx, 'role', e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="coordinator">Coordinator</option>
                  <option value="partner">Partner</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Participant #</Label>
                <Input type="number" value={p.participant_number} onChange={e => updatePartner(idx, 'participant_number', e.target.value)} className="h-9 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Country <Tip text="ISO 3166-1 alpha-2 country code as used in Horizon Europe (e.g. DE, FR, IT, ES)." /></Label>
                <AutocompleteInput value={p.country} onChange={v => updatePartner(idx, 'country', v.substring(0, 2))} options={countryOptions} placeholder="e.g. DE" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Contact Name</Label>
                <Input value={p.contact_name} onChange={e => updatePartner(idx, 'contact_name', e.target.value)} placeholder="Reporting contact" className="h-9 text-sm" />
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
                  {[
                    ['budget_personnel', 'Personnel (€)'],
                    ['budget_subcontracting', 'Subcontracting (€)'],
                    ['budget_travel', 'Travel (€)'],
                    ['budget_equipment', 'Equipment (€)'],
                    ['budget_other_goods', 'Other Goods (€)'],
                  ].map(([field, label]) => (
                    <div key={field} className="space-y-1">
                      <Label className="text-xs">{label} <Tip text={BUDGET_TOOLTIPS[field]} /></Label>
                      <Input type="number" value={(p as any)[field]} onChange={e => updatePartner(idx, field as keyof PartnerFormData, e.target.value)} className="h-9 text-sm" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Person-Months <Tip text={BUDGET_TOOLTIPS.total_person_months} /></Label>
                    <Input type="number" value={p.total_person_months} onChange={e => updatePartner(idx, 'total_person_months', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Funding Rate (%) <Tip text={BUDGET_TOOLTIPS.funding_rate} /></Label>
                    <Input type="number" value={p.funding_rate} onChange={e => updatePartner(idx, 'funding_rate', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Indirect Cost Rate (%) <Tip text={BUDGET_TOOLTIPS.indirect_cost_rate} /></Label>
                    <Input type="number" value={p.indirect_cost_rate} onChange={e => updatePartner(idx, 'indirect_cost_rate', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Indirect Cost Base <Tip text={BUDGET_TOOLTIPS.indirect_cost_base} /></Label>
                    <select value={p.indirect_cost_base} onChange={e => updatePartner(idx, 'indirect_cost_base', e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
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
// Step 3: Work Plan (WPs + Tasks)
// ============================================================================

function StepWorkPlan({ wps, updateWp, addWp, removeWp, partners, addTaskToWp, updateTask, removeTask }: {
  wps: WpFormData[]
  updateWp: (idx: number, field: string, value: any) => void
  addWp: () => void
  removeWp: (idx: number) => void
  partners: PartnerFormData[]
  addTaskToWp: (wpIdx: number) => void
  updateTask: (wpIdx: number, tIdx: number, field: string, value: string) => void
  removeTask: (wpIdx: number, tIdx: number) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Work Packages & Tasks</h3>
          <p className="text-sm text-muted-foreground">Define work packages, their timing, leadership, and add tasks</p>
        </div>
        <Button variant="outline" size="sm" onClick={addWp} className="gap-2"><Plus className="h-4 w-4" /> Add WP</Button>
      </div>

      {wps.map((wp, idx) => (
        <Card key={wp._key}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">WP{wp.wp_number}</Badge>
              <span className="font-medium text-sm flex-1 truncate">{wp.title || 'Untitled'}</span>
              {wps.length > 1 && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeWp(idx)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">WP #</Label>
                <Input value={wp.wp_number} onChange={e => updateWp(idx, 'wp_number', e.target.value)} className="h-8 text-xs text-center" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-[10px]">Title *</Label>
                <Input value={wp.title} onChange={e => updateWp(idx, 'title', e.target.value)} placeholder="Work package title" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Start M</Label>
                <Input type="number" value={wp.start_month} onChange={e => updateWp(idx, 'start_month', e.target.value)} placeholder="M1" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">End M</Label>
                <Input type="number" value={wp.end_month} onChange={e => updateWp(idx, 'end_month', e.target.value)} placeholder="M36" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">PMs</Label>
                <Input type="number" value={wp.total_person_months} onChange={e => updateWp(idx, 'total_person_months', e.target.value)} className="h-8 text-xs text-right" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">WP Leader</Label>
              <select value={wp.leader_partner_idx} onChange={e => updateWp(idx, 'leader_partner_idx', e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs">
                <option value="">— Select partner —</option>
                {partners.map((p, pi) => <option key={p._key} value={String(pi)}>#{p.participant_number} {p.org_name}</option>)}
              </select>
            </div>

            {/* Tasks — always visible */}
            <div className="mt-2 pt-3 border-t space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Tasks under WP{wp.wp_number}</span>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/5" onClick={() => addTaskToWp(idx)}>
                  <Plus className="h-3.5 w-3.5" /> Add Task
                </Button>
              </div>
              {wp.tasks.length === 0 && (
                <div className="rounded-md border border-dashed border-muted-foreground/25 py-4 text-center">
                  <p className="text-xs text-muted-foreground">No tasks yet — click <strong>"Add Task"</strong> to break this WP into individual tasks</p>
                </div>
              )}
                {wp.tasks.map((t, ti) => (
                  <div key={t._key} className="flex items-start gap-2 p-2 rounded border bg-muted/20">
                    <div className="grid gap-1.5 flex-1 grid-cols-2 md:grid-cols-7">
                      <div className="space-y-0.5">
                        <Label className="text-[9px]">Task #</Label>
                        <Input value={t.task_number} onChange={e => updateTask(idx, ti, 'task_number', e.target.value)} className="h-7 text-[11px]" />
                      </div>
                      <div className="space-y-0.5 md:col-span-2">
                        <Label className="text-[9px]">Title</Label>
                        <Input value={t.title} onChange={e => updateTask(idx, ti, 'title', e.target.value)} className="h-7 text-[11px]" />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[9px]">Task Leader</Label>
                        <select value={t.leader_partner_idx} onChange={e => updateTask(idx, ti, 'leader_partner_idx', e.target.value)} className="flex h-7 w-full rounded-md border border-input bg-background px-1 py-0.5 text-[11px]">
                          <option value="">—</option>
                          {partners.map((p, pi) => <option key={p._key} value={String(pi)}>{p.org_name || `#${p.participant_number}`}</option>)}
                        </select>
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[9px]">Start M</Label>
                        <Input type="number" value={t.start_month} onChange={e => updateTask(idx, ti, 'start_month', e.target.value)} className="h-7 text-[11px]" />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[9px]">End M</Label>
                        <Input type="number" value={t.end_month} onChange={e => updateTask(idx, ti, 'end_month', e.target.value)} className="h-7 text-[11px]" />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[9px]">PMs</Label>
                        <Input type="number" value={t.person_months} onChange={e => updateTask(idx, ti, 'person_months', e.target.value)} className="h-7 text-[11px]" />
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 mt-3" onClick={() => removeTask(idx, ti)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      ))}
      {wps.length > 0 && (
        <div className="text-right text-sm text-muted-foreground">
          Total: {wps.reduce((s, w) => s + (parseFloat(w.total_person_months) || 0), 0).toFixed(1)} PMs across {wps.length} WP{wps.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Step 4: Deliverables & Milestones
// ============================================================================

function StepDeliverablesAndMilestones({
  deliverables, addDeliverable, updateDeliverable, removeDeliverable,
  milestones, addMilestone, updateMilestone, removeMilestone,
  wps, partners,
}: {
  deliverables: DeliverableFormData[]
  addDeliverable: () => void
  updateDeliverable: (idx: number, field: string, value: string) => void
  removeDeliverable: (idx: number) => void
  milestones: MilestoneFormData[]
  addMilestone: () => void
  updateMilestone: (idx: number, field: string, value: string) => void
  removeMilestone: (idx: number) => void
  wps: WpFormData[]
  partners: PartnerFormData[]
}) {
  return (
    <div className="space-y-6">
      {/* Deliverables */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Deliverables</h3>
            <p className="text-sm text-muted-foreground">Project outputs to be submitted at specific months</p>
          </div>
          <Button variant="outline" size="sm" onClick={addDeliverable} className="gap-2"><Plus className="h-4 w-4" /> Add</Button>
        </div>
        {deliverables.length === 0 && <p className="text-xs text-muted-foreground italic">No deliverables added yet.</p>}
        {deliverables.map((d, idx) => (
          <Card key={d._key}>
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <div className="grid gap-2 flex-1 grid-cols-2 md:grid-cols-4">
                  <div className="space-y-0.5">
                    <Label className="text-[10px]"># (e.g. D1.1)</Label>
                    <Input value={d.number} onChange={e => updateDeliverable(idx, 'number', e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-0.5 md:col-span-2">
                    <Label className="text-[10px]">Title *</Label>
                    <Input value={d.title} onChange={e => updateDeliverable(idx, 'title', e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px]">Due M</Label>
                    <Input type="number" value={d.due_month} onChange={e => updateDeliverable(idx, 'due_month', e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px]">WP</Label>
                    <select value={d.wp_number} onChange={e => updateDeliverable(idx, 'wp_number', e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs">
                      <option value="">—</option>
                      {wps.map(w => <option key={w._key} value={w.wp_number}>WP{w.wp_number} {w.title ? `— ${w.title}` : ''}</option>)}
                    </select>
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px]">Task</Label>
                    <select value={d.task_number} onChange={e => updateDeliverable(idx, 'task_number', e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs">
                      <option value="">—</option>
                      {wps.flatMap(w => w.tasks.map(t => (
                        <option key={t._key} value={t.task_number}>{t.task_number} {t.title ? `— ${t.title}` : ''}</option>
                      )))}
                    </select>
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px]">Type</Label>
                    <select value={d.type} onChange={e => updateDeliverable(idx, 'type', e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs">
                      <option value="">—</option>
                      <option value="report">Report</option>
                      <option value="data">Data</option>
                      <option value="software">Software</option>
                      <option value="demonstrator">Demonstrator</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px]">Lead Partner</Label>
                    <select value={d.leader_partner_idx} onChange={e => updateDeliverable(idx, 'leader_partner_idx', e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs">
                      <option value="">—</option>
                      {partners.map((p, pi) => <option key={p._key} value={String(pi)}>{p.org_name || `Partner #${p.participant_number}`}</option>)}
                    </select>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 mt-3" onClick={() => removeDeliverable(idx)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Milestones */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Milestones</h3>
            <p className="text-sm text-muted-foreground">Key checkpoints to verify project progress</p>
          </div>
          <Button variant="outline" size="sm" onClick={addMilestone} className="gap-2"><Plus className="h-4 w-4" /> Add</Button>
        </div>
        {milestones.length === 0 && <p className="text-xs text-muted-foreground italic">No milestones added yet.</p>}
        {milestones.map((m, idx) => (
          <Card key={m._key}>
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <div className="grid gap-2 flex-1 grid-cols-2 md:grid-cols-5">
                  <div className="space-y-0.5">
                    <Label className="text-[10px]"># (e.g. MS1)</Label>
                    <Input value={m.number} onChange={e => updateMilestone(idx, 'number', e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-0.5 md:col-span-2">
                    <Label className="text-[10px]">Title *</Label>
                    <Input value={m.title} onChange={e => updateMilestone(idx, 'title', e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px]">WP #</Label>
                    <select value={m.wp_number} onChange={e => updateMilestone(idx, 'wp_number', e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs">
                      <option value="">—</option>
                      {wps.map(w => <option key={w._key} value={w.wp_number}>WP{w.wp_number}</option>)}
                    </select>
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px]">Due M</Label>
                    <Input type="number" value={m.due_month} onChange={e => updateMilestone(idx, 'due_month', e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 mt-3" onClick={() => removeMilestone(idx)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
              <div className="mt-2">
                <Label className="text-[10px]">Verification Means</Label>
                <Input value={m.verification_means} onChange={e => updateMilestone(idx, 'verification_means', e.target.value)} placeholder="How to verify this milestone is reached" className="h-8 text-xs" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Step 5: Review
// ============================================================================

function StepReview({ project, partners, wps, deliverables, milestones }: {
  project: ProjectFormData
  partners: PartnerFormData[]
  wps: WpFormData[]
  deliverables: DeliverableFormData[]
  milestones: MilestoneFormData[]
}) {
  const coordinator = partners.find(p => p.role === 'coordinator')
  const totalBudget = partners.reduce((sum, p) =>
    sum + (parseFloat(p.budget_personnel) || 0) + (parseFloat(p.budget_subcontracting) || 0)
        + (parseFloat(p.budget_travel) || 0) + (parseFloat(p.budget_equipment) || 0)
        + (parseFloat(p.budget_other_goods) || 0), 0)
  const totalTasks = wps.reduce((s, w) => s + w.tasks.length, 0)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Project Summary</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <div><span className="text-muted-foreground">Title:</span> <strong>{project.title}</strong></div>
            <div><span className="text-muted-foreground">Acronym:</span> <strong>{project.acronym}</strong></div>
            {project.grant_number && <div><span className="text-muted-foreground">Grant #:</span> {project.grant_number}</div>}
            {project.funding_programme && <div><span className="text-muted-foreground">Programme:</span> {project.funding_programme}</div>}
            {project.funding_scheme && <div><span className="text-muted-foreground">Scheme:</span> {project.funding_scheme}</div>}
            {project.start_date && <div><span className="text-muted-foreground">Start:</span> {project.start_date}</div>}
            {project.end_date && <div><span className="text-muted-foreground">End:</span> {project.end_date}</div>}
            {project.duration_months && <div><span className="text-muted-foreground">Duration:</span> {project.duration_months} months</div>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Consortium ({partners.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {coordinator && (
              <div className="flex items-center gap-2">
                <Badge>Coordinator</Badge>
                <span className="font-medium">{coordinator.org_name}</span>
                {coordinator.country && <span className="text-muted-foreground">({coordinator.country})</span>}
                {coordinator.org_type && <Badge variant="outline" className="text-[10px]">{coordinator.org_type}</Badge>}
              </div>
            )}
            {partners.filter(p => p.role !== 'coordinator').map(p => (
              <div key={p._key} className="flex items-center gap-2">
                <Badge variant="secondary">#{p.participant_number}</Badge>
                <span className="font-medium">{p.org_name}</span>
                {p.country && <span className="text-muted-foreground">({p.country})</span>}
                {p.org_type && <Badge variant="outline" className="text-[10px]">{p.org_type}</Badge>}
              </div>
            ))}
          </div>
          {totalBudget > 0 && (
            <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
              Total budget: <strong className="text-foreground">&euro;{totalBudget.toLocaleString()}</strong>
            </div>
          )}
        </CardContent>
      </Card>

      {wps.filter(w => w.title.trim()).length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Work Packages ({wps.filter(w => w.title.trim()).length}) &middot; Tasks ({totalTasks})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1.5 text-sm">
              {wps.filter(w => w.title.trim()).map(w => (
                <div key={w._key}>
                  <div className="flex justify-between">
                    <span>WP{w.wp_number}: {w.title} <span className="text-muted-foreground text-xs">(M{w.start_month}–M{w.end_month || '?'})</span></span>
                    <span className="text-muted-foreground">{w.total_person_months} PMs</span>
                  </div>
                  {w.tasks.filter(t => t.title.trim()).map(t => (
                    <div key={t._key} className="ml-6 text-xs text-muted-foreground flex justify-between">
                      <span>{t.task_number}: {t.title}</span>
                      <span>{t.person_months} PMs</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(deliverables.filter(d => d.title.trim()).length > 0 || milestones.filter(m => m.title.trim()).length > 0) && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Deliverables ({deliverables.filter(d => d.title.trim()).length}) &middot; Milestones ({milestones.filter(m => m.title.trim()).length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {deliverables.filter(d => d.title.trim()).map(d => (
              <div key={d._key} className="flex justify-between">
                <span>{d.number}: {d.title} {d.type && <span className="text-muted-foreground">({d.type})</span>}</span>
                <span className="text-muted-foreground">M{d.due_month}</span>
              </div>
            ))}
            {milestones.filter(m => m.title.trim()).map(m => (
              <div key={m._key} className="flex justify-between">
                <span>{m.number}: {m.title}</span>
                <span className="text-muted-foreground">M{m.due_month}</span>
              </div>
            ))}
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
