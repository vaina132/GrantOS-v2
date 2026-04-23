import { useEffect, useState, useCallback } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Save,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
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
  proposalPartAService,
  proposalSubmissionService,
  proposalAuditService,
} from '@/services/proposalWorkflowService'
import type {
  Proposal,
  ProposalPartner,
  ProposalDocument,
  ProposalSubmission,
  ProposalPartA,
  PartAContact,
  PartAResearcher,
  PartAAchievement,
  PartAProject,
  PartAInfrastructure,
  PartADirectCost,
  PartARiAsset,
  PartAAffiliatedEntity,
  PartAPlannedEvent,
} from '@/types'

/**
 * Part A form — full EC-style accordion covering every section of the
 * administrative form that a partner org has to complete. Each section
 * edits a slice of `proposal_part_a` via a `form` state held in memory;
 * `Save draft` flushes the full row via upsert. `Submit for review` flips
 * the partner's submission status so the coordinator can approve or
 * request a revision.
 */

const ORG_TYPE_OPTIONS: Array<{ value: NonNullable<ProposalPartA['org_type']>; label: string }> = [
  { value: 'academic',   label: 'Academic / Higher education' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'rto',        label: 'Research & Technology Organisation' },
  { value: 'public',     label: 'Public body' },
  { value: 'sme',        label: 'SME (Small / Medium Enterprise)' },
  { value: 'other',      label: 'Other' },
]

const GENDER_OPTIONS: Array<{ value: NonNullable<PartAContact['gender']>; label: string }> = [
  { value: 'woman',     label: 'Woman' },
  { value: 'man',       label: 'Man' },
  { value: 'nonbinary', label: 'Non-binary' },
  { value: 'other',     label: 'Other / prefer not to say' },
]

const CAREER_STAGE_OPTIONS: Array<{ value: NonNullable<PartAResearcher['career_stage']>; label: string }> = [
  { value: 'A', label: 'R1 — First-stage researcher (pre-doc)' },
  { value: 'B', label: 'R2 — Recognised researcher (PhD holder, not yet independent)' },
  { value: 'C', label: 'R3 — Established researcher (independent)' },
  { value: 'D', label: 'R4 — Leading researcher' },
]

const ACHIEVEMENT_KIND_OPTIONS: Array<{ value: PartAAchievement['kind']; label: string }> = [
  { value: 'publication', label: 'Publication' },
  { value: 'dataset',     label: 'Dataset' },
  { value: 'software',    label: 'Software' },
  { value: 'good',        label: 'Good' },
  { value: 'service',     label: 'Service' },
  { value: 'other',       label: 'Other' },
]

const DEFAULT_ROLE_OPTIONS = [
  'Work package leader',
  'Task leader',
  'Deliverable lead',
  'Technical contributor',
  'Data / results owner',
  'Pilot / demonstrator host',
  'Dissemination & communication',
  'Exploitation & business case',
  'Ethics / GDPR reviewer',
  'Standardisation lead',
]

type FormState = Partial<ProposalPartA>

const EMPTY_CONTACT: PartAContact = {
  title: '', first_name: '', last_name: '', gender: undefined,
  position: '', email: '', phone: '', address: '',
}
const EMPTY_RESEARCHER: PartAResearcher = {
  title: '', first_name: '', last_name: '', gender: undefined,
  nationality: '', email: '', career_stage: undefined, role: undefined, orcid: '',
}
const EMPTY_ACHIEVEMENT: PartAAchievement = { kind: 'publication', description: '' }
const EMPTY_PROJECT: PartAProject = { name: '', description: '' }
const EMPTY_INFRA: PartAInfrastructure = { name: '', description: '' }
const EMPTY_DIRECT: PartADirectCost = { label: '', amount: null, justification: '' }
const EMPTY_RI_ASSET: PartARiAsset = { asset_name: '', partners: '', reference_projects: '', current_trl: undefined, target_trl: undefined, description: '' }
const EMPTY_EVENT: PartAPlannedEvent = { kind: 'Workshop', description: '' }
const EMPTY_AFFILIATE: PartAAffiliatedEntity = { legal_name: '', pic: '' }

const EMPTY_FORM: FormState = {
  legal_name: '', acronym: '', city: '', country: '', website: '',
  is_non_profit: null, pic: '', org_type: null, org_type_other: '',
  ubo_location: null, ubo_country: '', ubo_notes: '',
  main_contact: null,
  other_contacts: [],
  departments: [],
  researchers: [],
  roles: [],
  achievements: [],
  previous_projects: [],
  infrastructure: [],
  has_gep: null, gep_notes: '',
  pm_rate_currency: 'EUR', pm_rate_amount: null,
  other_direct_costs: [],
  standards_bodies: [],
  ri_assets: [],
  similar_projects: [],
  dissemination_plan: '', exploitation_plan: '',
  planned_events: [],
  planned_publications: '', dissemination_bodies: '',
  standardisation_involvement: '', patents_planned: '',
  short_profile: '', role_description: '',
  affiliated_entities: [],
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

export function ProposalPartAForm({
  proposal, partner, document, submission, locked, onBack, onChanged,
}: Props) {
  const { user } = useAuthStore()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [dirty, setDirty] = useState(false)

  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['1.1']))
  const toggle = (id: string) => setOpenSections(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const row = await proposalPartAService.get(proposal.id, partner.id)
        if (cancelled) return
        if (row) {
          setForm({ ...EMPTY_FORM, ...row })
          setLastSavedAt(new Date(row.updated_at))
        } else {
          setForm(EMPTY_FORM)
        }
      } catch (err) {
        toast({
          title: 'Error loading Part A',
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

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }, [])

  const doSave = useCallback(async (opts?: { silent?: boolean }): Promise<ProposalPartA | null> => {
    if (saving || submitting) return null
    setSaving(true)
    try {
      const saved = await proposalPartAService.upsert({
        ...form,
        proposal_id: proposal.id,
        partner_id: partner.id,
      })
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
          note: 'Part A draft started',
        }).catch(() => {})
      }
      if (!opts?.silent) {
        toast({ title: 'Draft saved', description: 'Your changes are safe.' })
      }
      return saved
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
      return null
    } finally {
      setSaving(false)
    }
  }, [form, proposal.id, partner.id, document.id, saving, submitting, submission, user?.id])

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
      await doSave({ silent: true })
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
        note: 'Part A submitted for review',
      }).catch(() => {})
      toast({
        title: 'Submitted',
        description: 'Your Part A is now with the coordinator for review.',
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

  const canSubmit = !!form.legal_name && !!form.country && !!form.org_type && !locked

  // Helpers to keep the section bodies short.
  const mainContact = (form.main_contact ?? EMPTY_CONTACT) as PartAContact
  const updateMainContact = (patch: Partial<PartAContact>) => {
    update('main_contact', { ...mainContact, ...patch })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
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

      {/* ─── 1.1 Organisation data ───────────────────────────────── */}
      <Section id="1.1" title="1.1 Organisation data"
        description="Legal identity of your organisation as registered on the EC Funding & Tenders Portal."
        isOpen={openSections.has('1.1')} onToggle={() => toggle('1.1')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Legal name *">
            <Input value={form.legal_name ?? ''} onChange={e => update('legal_name', e.target.value)}
              disabled={locked} placeholder="e.g. International Data Spaces e.V." />
          </Field>
          <Field label="Short name / Acronym">
            <Input value={form.acronym ?? ''} onChange={e => update('acronym', e.target.value)}
              disabled={locked} placeholder="e.g. IDSA" maxLength={20} />
          </Field>
          <Field label="City">
            <Input value={form.city ?? ''} onChange={e => update('city', e.target.value)}
              disabled={locked} placeholder="e.g. Dortmund" />
          </Field>
          <Field label="Country *">
            <Input value={form.country ?? ''} onChange={e => update('country', e.target.value)}
              disabled={locked} placeholder="e.g. Germany" />
          </Field>
          <Field label="Website">
            <Input type="url" value={form.website ?? ''} onChange={e => update('website', e.target.value)}
              disabled={locked} placeholder="https://www.example.org" />
          </Field>
          <Field label="PIC (Participant Identification Code)">
            <Input value={form.pic ?? ''} onChange={e => update('pic', e.target.value)}
              disabled={locked} placeholder="9-digit code from the F&T Portal" maxLength={12} />
          </Field>
          <Field label="Profit or non-profit?">
            <Select
              value={form.is_non_profit === null || form.is_non_profit === undefined
                ? '' : form.is_non_profit ? 'np' : 'p'}
              onChange={v => update('is_non_profit', v === '' ? null : v === 'np')}
              disabled={locked}
              options={[
                { value: '',   label: '— Select —' },
                { value: 'np', label: 'Non-profit' },
                { value: 'p',  label: 'For-profit' },
              ]} />
          </Field>
          <Field label="Organisation type *">
            <Select
              value={form.org_type ?? ''}
              onChange={v => update('org_type', (v || null) as ProposalPartA['org_type'])}
              disabled={locked}
              options={[{ value: '', label: '— Select —' }, ...ORG_TYPE_OPTIONS]} />
          </Field>
          {form.org_type === 'other' && (
            <Field label="If other, please specify">
              <Input value={form.org_type_other ?? ''} onChange={e => update('org_type_other', e.target.value)}
                disabled={locked} />
            </Field>
          )}
        </div>
      </Section>

      {/* ─── 1.2 Ultimate beneficial owners ──────────────────────── */}
      <Section id="1.2" title="1.2 Ultimate beneficial owners (UBOs)"
        description="Where is ultimate control of your organisation located?"
        isOpen={openSections.has('1.2')} onToggle={() => toggle('1.2')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="UBO location">
            <Select
              value={form.ubo_location ?? ''}
              onChange={v => update('ubo_location', (v || null) as ProposalPartA['ubo_location'])}
              disabled={locked}
              options={[
                { value: '',           label: '— Select —' },
                { value: 'eu',         label: 'In the EU / associated country' },
                { value: 'outside_eu', label: 'Outside the EU' },
                { value: 'unknown',    label: 'Unknown / not disclosed' },
              ]} />
          </Field>
          <Field label="Country of ultimate control">
            <Input value={form.ubo_country ?? ''} onChange={e => update('ubo_country', e.target.value)}
              disabled={locked} placeholder="e.g. Germany, United States" />
          </Field>
          <Field label="Notes" full>
            <Textarea value={form.ubo_notes ?? ''} onChange={e => update('ubo_notes', e.target.value)}
              rows={3} disabled={locked}
              placeholder="Optional — any clarification about ownership structure." />
          </Field>
        </div>
      </Section>

      {/* ─── 1.3 Contact persons ─────────────────────────────────── */}
      <Section id="1.3" title="1.3 Contact persons"
        description="One main contact plus any additional contacts who should receive notifications."
        isOpen={openSections.has('1.3')} onToggle={() => toggle('1.3')}>
        <div className="space-y-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Main contact
            </div>
            <ContactFields value={mainContact} onChange={updateMainContact} locked={locked} />
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Other contacts
              </div>
              <Button variant="outline" size="sm" disabled={locked}
                onClick={() => update('other_contacts', [...(form.other_contacts ?? []), { ...EMPTY_CONTACT }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add contact
              </Button>
            </div>
            {(form.other_contacts ?? []).length === 0 ? (
              <EmptyHint>No additional contacts yet.</EmptyHint>
            ) : (
              <div className="space-y-4">
                {(form.other_contacts ?? []).map((c, idx) => (
                  <RowWrapper key={idx} onRemove={() => {
                    const next = [...(form.other_contacts ?? [])]
                    next.splice(idx, 1)
                    update('other_contacts', next)
                  }} disabled={locked}>
                    <ContactFields
                      value={c}
                      onChange={(patch) => {
                        const next = [...(form.other_contacts ?? [])]
                        next[idx] = { ...c, ...patch }
                        update('other_contacts', next)
                      }}
                      locked={locked}
                    />
                  </RowWrapper>
                ))}
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ─── 1.4 Departments ─────────────────────────────────────── */}
      <Section id="1.4" title="1.4 Departments carrying out the work"
        description="The departments or units inside your organisation that will contribute."
        isOpen={openSections.has('1.4')} onToggle={() => toggle('1.4')}>
        <StringListEditor
          values={form.departments ?? []}
          onChange={(next) => update('departments', next)}
          placeholder="e.g. Department of Electrical Engineering"
          addLabel="Add department"
          disabled={locked}
        />
      </Section>

      {/* ─── 1.5 Researchers ─────────────────────────────────────── */}
      <Section id="1.5" title="1.5 Researchers to be involved"
        description="Key research staff. Career stages follow the EU framework (R1–R4)."
        isOpen={openSections.has('1.5')} onToggle={() => toggle('1.5')}>
        <RepeatableRows
          rows={form.researchers ?? []}
          onChange={(next) => update('researchers', next)}
          disabled={locked}
          empty={EMPTY_RESEARCHER}
          addLabel="Add researcher"
          render={(r, patch) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title">
                <Input value={r.title ?? ''} onChange={e => patch({ title: e.target.value })} disabled={locked} placeholder="Prof. / Dr. / Mr. / Ms." />
              </Field>
              <Field label="Gender">
                <Select value={r.gender ?? ''} onChange={v => patch({ gender: (v || undefined) as PartAResearcher['gender'] })}
                  disabled={locked}
                  options={[{ value: '', label: '— Select —' }, ...GENDER_OPTIONS]} />
              </Field>
              <Field label="First name *">
                <Input value={r.first_name ?? ''} onChange={e => patch({ first_name: e.target.value })} disabled={locked} />
              </Field>
              <Field label="Last name *">
                <Input value={r.last_name ?? ''} onChange={e => patch({ last_name: e.target.value })} disabled={locked} />
              </Field>
              <Field label="Nationality">
                <Input value={r.nationality ?? ''} onChange={e => patch({ nationality: e.target.value })} disabled={locked} />
              </Field>
              <Field label="Email">
                <Input type="email" value={r.email ?? ''} onChange={e => patch({ email: e.target.value })} disabled={locked} />
              </Field>
              <Field label="Career stage">
                <Select value={r.career_stage ?? ''} onChange={v => patch({ career_stage: (v || undefined) as PartAResearcher['career_stage'] })}
                  disabled={locked}
                  options={[{ value: '', label: '— Select —' }, ...CAREER_STAGE_OPTIONS]} />
              </Field>
              <Field label="Role in project">
                <Select value={r.role ?? ''} onChange={v => patch({ role: (v || undefined) as PartAResearcher['role'] })}
                  disabled={locked}
                  options={[
                    { value: '',            label: '— Select —' },
                    { value: 'leading',     label: 'Leading researcher' },
                    { value: 'team_member', label: 'Team member' },
                  ]} />
              </Field>
              <Field label="ORCID" full>
                <Input value={r.orcid ?? ''} onChange={e => patch({ orcid: e.target.value })} disabled={locked}
                  placeholder="0000-0000-0000-0000" />
              </Field>
            </div>
          )}
        />
      </Section>

      {/* ─── 1.6 Role in the project ─────────────────────────────── */}
      <Section id="1.6" title="1.6 Role in the project"
        description="Which activities does your organisation contribute to? Tick all that apply."
        isOpen={openSections.has('1.6')} onToggle={() => toggle('1.6')}>
        <CheckboxGroup
          allOptions={DEFAULT_ROLE_OPTIONS}
          selected={form.roles ?? []}
          onChange={(next) => update('roles', next)}
          disabled={locked}
          allowCustom
        />
      </Section>

      {/* ─── 1.7 Relevant publications, products, services ──────── */}
      <Section id="1.7" title="1.7 Relevant publications, products, services"
        description="Up to 5 achievements relevant to the call."
        isOpen={openSections.has('1.7')} onToggle={() => toggle('1.7')}>
        <RepeatableRows
          rows={form.achievements ?? []}
          onChange={(next) => update('achievements', next.slice(0, 5))}
          disabled={locked}
          empty={EMPTY_ACHIEVEMENT}
          addLabel="Add achievement"
          maxRows={5}
          render={(a, patch) => (
            <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
              <Field label="Kind">
                <Select value={a.kind} onChange={v => patch({ kind: (v || 'other') as PartAAchievement['kind'] })}
                  disabled={locked} options={ACHIEVEMENT_KIND_OPTIONS} />
              </Field>
              <Field label="Description">
                <Textarea value={a.description} onChange={e => patch({ description: e.target.value })}
                  rows={2} disabled={locked}
                  placeholder="Short citation or description — include DOI/URL if applicable." />
              </Field>
            </div>
          )}
        />
      </Section>

      {/* ─── 1.8 Previous / ongoing projects ─────────────────────── */}
      <Section id="1.8" title="1.8 Previous / ongoing projects"
        description="Up to 5 projects relevant to the subject of this proposal."
        isOpen={openSections.has('1.8')} onToggle={() => toggle('1.8')}>
        <RepeatableRows
          rows={form.previous_projects ?? []}
          onChange={(next) => update('previous_projects', next.slice(0, 5))}
          disabled={locked}
          empty={EMPTY_PROJECT}
          addLabel="Add project"
          maxRows={5}
          render={(p, patch) => (
            <div className="grid gap-3 sm:grid-cols-[240px_1fr]">
              <Field label="Project name / acronym">
                <Input value={p.name} onChange={e => patch({ name: e.target.value })} disabled={locked} />
              </Field>
              <Field label="Description">
                <Textarea value={p.description} onChange={e => patch({ description: e.target.value })}
                  rows={2} disabled={locked}
                  placeholder="One-sentence summary — role, programme, period." />
              </Field>
            </div>
          )}
        />
      </Section>

      {/* ─── 1.9 Infrastructure & equipment ──────────────────────── */}
      <Section id="1.9" title="1.9 Infrastructure & equipment"
        description="Significant infrastructure your organisation brings to the project."
        isOpen={openSections.has('1.9')} onToggle={() => toggle('1.9')}>
        <RepeatableRows
          rows={form.infrastructure ?? []}
          onChange={(next) => update('infrastructure', next)}
          disabled={locked}
          empty={EMPTY_INFRA}
          addLabel="Add infrastructure"
          render={(inf, patch) => (
            <div className="grid gap-3 sm:grid-cols-[260px_1fr]">
              <Field label="Name">
                <Input value={inf.name} onChange={e => patch({ name: e.target.value })} disabled={locked}
                  placeholder="e.g. HPC cluster, pilot line, test bench" />
              </Field>
              <Field label="Description">
                <Textarea value={inf.description} onChange={e => patch({ description: e.target.value })}
                  rows={2} disabled={locked} />
              </Field>
            </div>
          )}
        />
      </Section>

      {/* ─── 1.10 Gender Equality Plan ───────────────────────────── */}
      <Section id="1.10" title="1.10 Gender Equality Plan"
        description="Do you have a published Gender Equality Plan (GEP) as required for Horizon Europe?"
        isOpen={openSections.has('1.10')} onToggle={() => toggle('1.10')}>
        <div className="grid gap-4 sm:grid-cols-[260px_1fr]">
          <Field label="GEP in place">
            <Select
              value={form.has_gep === null || form.has_gep === undefined ? '' : form.has_gep ? 'yes' : 'no'}
              onChange={v => update('has_gep', v === '' ? null : v === 'yes')}
              disabled={locked}
              options={[
                { value: '',    label: '— Select —' },
                { value: 'yes', label: 'Yes' },
                { value: 'no',  label: 'No / in preparation' },
              ]} />
          </Field>
          <Field label="Notes">
            <Textarea value={form.gep_notes ?? ''} onChange={e => update('gep_notes', e.target.value)}
              rows={3} disabled={locked}
              placeholder="Link to the published GEP or a short description of its scope." />
          </Field>
        </div>
      </Section>

      {/* ─── 2. Budget details ───────────────────────────────────── */}
      <Section id="2" title="2. Budget details"
        description="Average personnel-month (PM) rate and any other direct costs your organisation needs to cover."
        isOpen={openSections.has('2')} onToggle={() => toggle('2')}>
        <div className="grid gap-4 sm:grid-cols-[160px_1fr_1fr]">
          <Field label="Currency">
            <Input value={form.pm_rate_currency ?? 'EUR'} onChange={e => update('pm_rate_currency', e.target.value.toUpperCase())}
              disabled={locked} maxLength={3} placeholder="EUR" />
          </Field>
          <Field label="Average PM rate">
            <Input type="number" inputMode="decimal"
              value={form.pm_rate_amount ?? ''} onChange={e => update('pm_rate_amount', e.target.value === '' ? null : Number(e.target.value))}
              disabled={locked} placeholder="e.g. 9500" />
          </Field>
          <div className="hidden sm:block" />
        </div>

        <div className="mt-5 pt-4 border-t">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Other direct costs
            </div>
            <Button variant="outline" size="sm" disabled={locked}
              onClick={() => update('other_direct_costs', [...(form.other_direct_costs ?? []), { ...EMPTY_DIRECT }])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add line
            </Button>
          </div>
          {(form.other_direct_costs ?? []).length === 0 ? (
            <EmptyHint>No other direct cost lines yet (travel, equipment, subcontracting are captured in the Budget form).</EmptyHint>
          ) : (
            <div className="space-y-3">
              {(form.other_direct_costs ?? []).map((cost, idx) => (
                <RowWrapper key={idx} onRemove={() => {
                  const next = [...(form.other_direct_costs ?? [])]
                  next.splice(idx, 1)
                  update('other_direct_costs', next)
                }} disabled={locked}>
                  <div className="grid gap-3 sm:grid-cols-[1fr_160px_2fr]">
                    <Field label="Label">
                      <Input value={cost.label} onChange={e => {
                        const next = [...(form.other_direct_costs ?? [])]
                        next[idx] = { ...cost, label: e.target.value }
                        update('other_direct_costs', next)
                      }} disabled={locked} placeholder="e.g. Open-access publication fees" />
                    </Field>
                    <Field label={`Amount (${form.pm_rate_currency ?? 'EUR'})`}>
                      <Input type="number" inputMode="decimal" value={cost.amount ?? ''} onChange={e => {
                        const next = [...(form.other_direct_costs ?? [])]
                        next[idx] = { ...cost, amount: e.target.value === '' ? null : Number(e.target.value) }
                        update('other_direct_costs', next)
                      }} disabled={locked} />
                    </Field>
                    <Field label="Justification">
                      <Input value={cost.justification ?? ''} onChange={e => {
                        const next = [...(form.other_direct_costs ?? [])]
                        next[idx] = { ...cost, justification: e.target.value }
                        update('other_direct_costs', next)
                      }} disabled={locked} />
                    </Field>
                  </div>
                </RowWrapper>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ─── 3. Standards & R&I assets ───────────────────────────── */}
      <Section id="3" title="3. Participation in standards bodies, R&I assets"
        description="Standardisation bodies and key research/innovation assets your organisation contributes."
        isOpen={openSections.has('3')} onToggle={() => toggle('3')}>
        <div className="space-y-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              3.1 Standards bodies
            </div>
            <StringListEditor
              values={form.standards_bodies ?? []}
              onChange={(next) => update('standards_bodies', next)}
              placeholder="e.g. ETSI, CEN, ISO/IEC JTC1"
              addLabel="Add body"
              disabled={locked}
            />
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                3.2 R&I assets you bring or plan to advance
              </div>
              <Button variant="outline" size="sm" disabled={locked}
                onClick={() => update('ri_assets', [...(form.ri_assets ?? []), { ...EMPTY_RI_ASSET }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add asset
              </Button>
            </div>
            {(form.ri_assets ?? []).length === 0 ? (
              <EmptyHint>No assets listed yet.</EmptyHint>
            ) : (
              <div className="space-y-3">
                {(form.ri_assets ?? []).map((asset, idx) => (
                  <RowWrapper key={idx} onRemove={() => {
                    const next = [...(form.ri_assets ?? [])]
                    next.splice(idx, 1)
                    update('ri_assets', next)
                  }} disabled={locked}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Asset name">
                        <Input value={asset.asset_name} onChange={e => {
                          const next = [...(form.ri_assets ?? [])]
                          next[idx] = { ...asset, asset_name: e.target.value }
                          update('ri_assets', next)
                        }} disabled={locked} />
                      </Field>
                      <Field label="Partner(s) contributing">
                        <Input value={asset.partners ?? ''} onChange={e => {
                          const next = [...(form.ri_assets ?? [])]
                          next[idx] = { ...asset, partners: e.target.value }
                          update('ri_assets', next)
                        }} disabled={locked} />
                      </Field>
                      <Field label="Reference project(s)">
                        <Input value={asset.reference_projects ?? ''} onChange={e => {
                          const next = [...(form.ri_assets ?? [])]
                          next[idx] = { ...asset, reference_projects: e.target.value }
                          update('ri_assets', next)
                        }} disabled={locked} />
                      </Field>
                      <div className="grid gap-3 grid-cols-2">
                        <Field label="Current TRL">
                          <Input type="number" min={1} max={9} value={asset.current_trl ?? ''} onChange={e => {
                            const next = [...(form.ri_assets ?? [])]
                            next[idx] = { ...asset, current_trl: e.target.value === '' ? undefined : Number(e.target.value) }
                            update('ri_assets', next)
                          }} disabled={locked} />
                        </Field>
                        <Field label="Target TRL">
                          <Input type="number" min={1} max={9} value={asset.target_trl ?? ''} onChange={e => {
                            const next = [...(form.ri_assets ?? [])]
                            next[idx] = { ...asset, target_trl: e.target.value === '' ? undefined : Number(e.target.value) }
                            update('ri_assets', next)
                          }} disabled={locked} />
                        </Field>
                      </div>
                      <Field label="Description" full>
                        <Textarea value={asset.description ?? ''} onChange={e => {
                          const next = [...(form.ri_assets ?? [])]
                          next[idx] = { ...asset, description: e.target.value }
                          update('ri_assets', next)
                        }} rows={2} disabled={locked} />
                      </Field>
                    </div>
                  </RowWrapper>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              3.3 Similar projects in preparation / recently submitted
            </div>
            <StringListEditor
              values={form.similar_projects ?? []}
              onChange={(next) => update('similar_projects', next)}
              placeholder="e.g. HE-CL4-2024-DATA-04, under evaluation"
              addLabel="Add project"
              disabled={locked}
            />
          </div>
        </div>
      </Section>

      {/* ─── 4. Dissemination, communication, exploitation ───────── */}
      <Section id="4" title="4. Dissemination, communication, exploitation"
        description="How will your organisation spread and exploit the results?"
        isOpen={openSections.has('4')} onToggle={() => toggle('4')}>
        <div className="space-y-5">
          <Field label="Dissemination plan" full>
            <Textarea value={form.dissemination_plan ?? ''} onChange={e => update('dissemination_plan', e.target.value)}
              rows={3} disabled={locked}
              placeholder="Channels, target audiences, frequency…" />
          </Field>
          <Field label="Exploitation plan" full>
            <Textarea value={form.exploitation_plan ?? ''} onChange={e => update('exploitation_plan', e.target.value)}
              rows={3} disabled={locked}
              placeholder="How will the results create value post-project?" />
          </Field>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Planned events
              </div>
              <Button variant="outline" size="sm" disabled={locked}
                onClick={() => update('planned_events', [...(form.planned_events ?? []), { ...EMPTY_EVENT }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add event
              </Button>
            </div>
            {(form.planned_events ?? []).length === 0 ? (
              <EmptyHint>No events planned yet.</EmptyHint>
            ) : (
              <div className="space-y-3">
                {(form.planned_events ?? []).map((ev, idx) => (
                  <RowWrapper key={idx} onRemove={() => {
                    const next = [...(form.planned_events ?? [])]
                    next.splice(idx, 1)
                    update('planned_events', next)
                  }} disabled={locked}>
                    <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                      <Field label="Kind">
                        <Input value={ev.kind} onChange={e => {
                          const next = [...(form.planned_events ?? [])]
                          next[idx] = { ...ev, kind: e.target.value }
                          update('planned_events', next)
                        }} disabled={locked} placeholder="Workshop / Webinar / Showcase…" />
                      </Field>
                      <Field label="Description">
                        <Textarea value={ev.description} onChange={e => {
                          const next = [...(form.planned_events ?? [])]
                          next[idx] = { ...ev, description: e.target.value }
                          update('planned_events', next)
                        }} rows={2} disabled={locked} />
                      </Field>
                    </div>
                  </RowWrapper>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Planned publications">
              <Textarea value={form.planned_publications ?? ''} onChange={e => update('planned_publications', e.target.value)}
                rows={3} disabled={locked}
                placeholder="Target journals, conferences, timelines." />
            </Field>
            <Field label="Bodies that will help with dissemination">
              <Textarea value={form.dissemination_bodies ?? ''} onChange={e => update('dissemination_bodies', e.target.value)}
                rows={3} disabled={locked}
                placeholder="Associations, clusters, media partners." />
            </Field>
            <Field label="Standardisation involvement">
              <Textarea value={form.standardisation_involvement ?? ''} onChange={e => update('standardisation_involvement', e.target.value)}
                rows={3} disabled={locked}
                placeholder="How will the results feed standardisation bodies?" />
            </Field>
            <Field label="Patents / IPR planned">
              <Textarea value={form.patents_planned ?? ''} onChange={e => update('patents_planned', e.target.value)}
                rows={3} disabled={locked}
                placeholder="Patents, utility models, trademarks, licenses." />
            </Field>
          </div>
        </div>
      </Section>

      {/* ─── 5. Organisation profile & role ──────────────────────── */}
      <Section id="5" title="5. Organisation profile & role in the project"
        description="A short editorial description of your organisation and your role."
        isOpen={openSections.has('5')} onToggle={() => toggle('5')}>
        <div className="space-y-4">
          <Field label="Short profile of your organisation" full>
            <Textarea value={form.short_profile ?? ''} onChange={e => update('short_profile', e.target.value)}
              rows={5} disabled={locked}
              placeholder="A paragraph that can be reused as-is in the proposal text." />
          </Field>
          <Field label="Your role in this project" full>
            <Textarea value={form.role_description ?? ''} onChange={e => update('role_description', e.target.value)}
              rows={5} disabled={locked}
              placeholder="The specific contribution your organisation brings — in 3–5 sentences." />
          </Field>
        </div>
      </Section>

      {/* ─── 6. Affiliated entities ──────────────────────────────── */}
      <Section id="6" title="6. Affiliated entities"
        description="Any affiliated entities that will contribute to the project."
        isOpen={openSections.has('6')} onToggle={() => toggle('6')}>
        <RepeatableRows
          rows={form.affiliated_entities ?? []}
          onChange={(next) => update('affiliated_entities', next)}
          disabled={locked}
          empty={EMPTY_AFFILIATE}
          addLabel="Add affiliated entity"
          render={(ent, patch) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Legal name">
                <Input value={ent.legal_name} onChange={e => patch({ legal_name: e.target.value })} disabled={locked} />
              </Field>
              <Field label="PIC">
                <Input value={ent.pic ?? ''} onChange={e => patch({ pic: e.target.value })} disabled={locked} maxLength={12} />
              </Field>
            </div>
          )}
        />
      </Section>

      {/* ─── Action bar ──────────────────────────────────────────── */}
      <div className="sticky bottom-4 z-10">
        <Card className="shadow-lg">
          <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-muted-foreground">
              {canSubmit
                ? 'All required fields are filled. You can submit for review.'
                : 'Fill in legal name, country and organisation type to submit.'}
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
// Local helpers — section shell, field row, repeatable-row editor, etc.
// ────────────────────────────────────────────────────────────────────────────

function Section({
  id, title, description, isOpen, onToggle, children,
}: {
  id: string
  title: string
  description: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <Card id={`section-${id}`}>
      <CardHeader
        className={cn('cursor-pointer select-none py-3', isOpen && 'border-b')}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
        {description && <p className="text-xs text-muted-foreground mt-1 pl-6">{description}</p>}
      </CardHeader>
      {isOpen && <CardContent className="pt-4">{children}</CardContent>}
    </Card>
  )
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={cn('space-y-1.5', full && 'sm:col-span-2')}>
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

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props
  return (
    <textarea
      {...rest}
      className={cn(
        'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    />
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
      {children}
    </div>
  )
}

function RowWrapper({
  children, onRemove, disabled,
}: {
  children: React.ReactNode
  onRemove: () => void
  disabled?: boolean
}) {
  return (
    <div className="rounded-md border bg-background/50 p-3 relative">
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="absolute top-2 right-2 text-muted-foreground hover:text-red-600 disabled:opacity-40"
        aria-label="Remove row"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <div className="pr-6">{children}</div>
    </div>
  )
}

function ContactFields({
  value, onChange, locked,
}: {
  value: PartAContact
  onChange: (patch: Partial<PartAContact>) => void
  locked: boolean
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Title">
        <Input value={value.title ?? ''} onChange={e => onChange({ title: e.target.value })} disabled={locked} placeholder="Prof. / Dr. / Mr. / Ms." />
      </Field>
      <Field label="Gender">
        <Select value={value.gender ?? ''} onChange={v => onChange({ gender: (v || undefined) as PartAContact['gender'] })}
          disabled={locked}
          options={[{ value: '', label: '— Select —' }, ...GENDER_OPTIONS]} />
      </Field>
      <Field label="First name">
        <Input value={value.first_name ?? ''} onChange={e => onChange({ first_name: e.target.value })} disabled={locked} />
      </Field>
      <Field label="Last name">
        <Input value={value.last_name ?? ''} onChange={e => onChange({ last_name: e.target.value })} disabled={locked} />
      </Field>
      <Field label="Position">
        <Input value={value.position ?? ''} onChange={e => onChange({ position: e.target.value })} disabled={locked} />
      </Field>
      <Field label="Email">
        <Input type="email" value={value.email ?? ''} onChange={e => onChange({ email: e.target.value })} disabled={locked} />
      </Field>
      <Field label="Phone">
        <Input type="tel" value={value.phone ?? ''} onChange={e => onChange({ phone: e.target.value })} disabled={locked} />
      </Field>
      <Field label="Address">
        <Input value={value.address ?? ''} onChange={e => onChange({ address: e.target.value })} disabled={locked} />
      </Field>
    </div>
  )
}

function StringListEditor({
  values, onChange, placeholder, addLabel, disabled,
}: {
  values: string[]
  onChange: (next: string[]) => void
  placeholder: string
  addLabel: string
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      {values.length === 0 && (
        <EmptyHint>Nothing added yet.</EmptyHint>
      )}
      {values.map((v, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={v}
            onChange={(e) => {
              const next = [...values]
              next[i] = e.target.value
              onChange(next)
            }}
            disabled={disabled}
            placeholder={placeholder}
          />
          <Button
            variant="ghost" size="icon"
            disabled={disabled}
            onClick={() => {
              const next = [...values]
              next.splice(i, 1)
              onChange(next)
            }}
            aria-label="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onChange([...values, ''])}>
        <Plus className="h-3.5 w-3.5 mr-1" /> {addLabel}
      </Button>
    </div>
  )
}

function RepeatableRows<T>({
  rows, onChange, disabled, empty, addLabel, maxRows, render,
}: {
  rows: T[]
  onChange: (next: T[]) => void
  disabled: boolean
  empty: T
  addLabel: string
  maxRows?: number
  render: (row: T, patch: (p: Partial<T>) => void) => React.ReactNode
}) {
  const atMax = maxRows !== undefined && rows.length >= maxRows
  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <EmptyHint>No rows yet.</EmptyHint>
      ) : (
        rows.map((row, idx) => (
          <RowWrapper key={idx}
            onRemove={() => {
              const next = [...rows]
              next.splice(idx, 1)
              onChange(next)
            }}
            disabled={disabled}
          >
            {render(row, (patch) => {
              const next = [...rows]
              next[idx] = { ...(row as object), ...(patch as object) } as T
              onChange(next)
            })}
          </RowWrapper>
        ))
      )}
      <Button
        variant="outline" size="sm"
        disabled={disabled || atMax}
        onClick={() => onChange([...rows, { ...(empty as object) } as T])}
        title={atMax ? `Maximum ${maxRows} rows` : undefined}
      >
        <Plus className="h-3.5 w-3.5 mr-1" /> {addLabel}
      </Button>
    </div>
  )
}

function CheckboxGroup({
  allOptions, selected, onChange, disabled, allowCustom,
}: {
  allOptions: string[]
  selected: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  allowCustom?: boolean
}) {
  const [custom, setCustom] = useState('')
  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter(x => x !== v))
    else onChange([...selected, v])
  }
  const addCustom = () => {
    const t = custom.trim()
    if (!t) return
    if (!selected.includes(t)) onChange([...selected, t])
    setCustom('')
  }
  // Custom items = selected items that aren't in allOptions.
  const customItems = selected.filter(s => !allOptions.includes(s))

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-y-1.5 gap-x-4">
        {allOptions.map(opt => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              disabled={disabled}
              onChange={() => toggle(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
      {customItems.length > 0 && (
        <div className="pt-3 border-t">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Custom
          </div>
          <div className="flex flex-wrap gap-2">
            {customItems.map(item => (
              <span key={item} className="inline-flex items-center gap-1 text-xs rounded-full border bg-muted/30 px-2 py-1">
                {item}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(selected.filter(x => x !== item))}
                  className="text-muted-foreground hover:text-red-600"
                  aria-label="Remove"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      {allowCustom && (
        <div className="flex gap-2 pt-2 border-t">
          <Input
            value={custom}
            onChange={e => setCustom(e.target.value)}
            placeholder="Add a custom role…"
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); addCustom() }
            }}
          />
          <Button variant="outline" size="sm" disabled={disabled || !custom.trim()} onClick={addCustom}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>
      )}
    </div>
  )
}
