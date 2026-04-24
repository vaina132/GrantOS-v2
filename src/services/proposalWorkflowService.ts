import { supabase } from '@/lib/supabase'
import type {
  ProposalPartner,
  ProposalWorkPackage,
  ProposalDocument,
  ProposalSubmission,
  ProposalSubmissionVersion,
  ProposalPartA,
  ProposalBudget,
  ProposalBudgetLine,
  ProposalCallTemplate,
  ProposalAuditEvent,
  ProposalSubmissionStatus,
} from '@/types'

// The new proposal_* tables aren't in the generated database.types.ts yet.
// Use a type-erased handle — regenerate with `npx supabase gen types` to drop.
const sb = supabase as any

// ============================================================================
// Call templates (built-in + per-org)
// ============================================================================

export const proposalCallTemplateService = {
  /** List all templates the current user can see (global built-ins + own org).
   *
   *  Defense-in-depth: we explicitly filter by org_id even though RLS already
   *  scopes reads to `org_id IS NULL OR org_id = auth_org_id()`. If the RLS
   *  policy is ever dropped during a migration, this client-side filter still
   *  prevents a cross-tenant template leak. Pass the orgId (from `useAuthStore`)
   *  — the old zero-arg form remains for callers that haven't been updated. */
  async list(orgId?: string | null): Promise<ProposalCallTemplate[]> {
    let query = sb
      .from('proposal_call_templates')
      .select('*')
      .order('is_builtin', { ascending: false })
      .order('name', { ascending: true })
    if (orgId) {
      query = query.or(`org_id.is.null,org_id.eq.${orgId}`)
    } else {
      // No orgId provided — at least restrict to the global built-ins so an
      // unauthenticated or half-loaded client can't enumerate per-org customisations.
      query = query.is('org_id', null)
    }
    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as ProposalCallTemplate[]
  },
}

// ============================================================================
// Proposal partners (invite + manage)
// ============================================================================

export const proposalPartnerService = {
  async list(proposalId: string): Promise<ProposalPartner[]> {
    const { data, error } = await sb
      .from('proposal_partners')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('participant_number', { ascending: true, nullsFirst: false })
    if (error) throw error
    return (data ?? []) as ProposalPartner[]
  },

  async create(partner: {
    proposal_id: string
    org_name: string
    role?: 'coordinator' | 'partner'
    contact_name?: string | null
    contact_email?: string | null
    country?: string | null
    org_type?: string | null
    pic?: string | null
    participant_number?: number | null
  }): Promise<ProposalPartner> {
    const { data, error } = await sb
      .from('proposal_partners')
      .insert({
        role: 'partner',
        ...partner,
      })
      .select()
      .single()
    if (error) throw error
    return data as ProposalPartner
  },

  async update(id: string, patch: Partial<ProposalPartner>): Promise<ProposalPartner> {
    const {
      id: _id, proposal_id, created_at, updated_at, invite_token, user_id, is_host,
      ...clean
    } = patch as any
    void _id; void proposal_id; void created_at; void updated_at; void invite_token; void user_id; void is_host
    const { data, error } = await sb
      .from('proposal_partners')
      .update(clean)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as ProposalPartner
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb.from('proposal_partners').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================================
// Work packages
// ============================================================================

export const proposalWorkPackageService = {
  async list(proposalId: string): Promise<ProposalWorkPackage[]> {
    const { data, error } = await sb
      .from('proposal_work_packages')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('wp_number', { ascending: true })
    if (error) throw error
    return (data ?? []) as ProposalWorkPackage[]
  },

  async create(wp: {
    proposal_id: string
    wp_number: number
    title: string
    description?: string | null
    leader_partner_id?: string | null
    sort_order?: number
  }): Promise<ProposalWorkPackage> {
    const { data, error } = await sb
      .from('proposal_work_packages')
      .insert(wp)
      .select()
      .single()
    if (error) throw error
    return data as ProposalWorkPackage
  },

  async update(id: string, patch: Partial<ProposalWorkPackage>): Promise<ProposalWorkPackage> {
    const { id: _id, proposal_id, created_at, updated_at, ...clean } = patch as any
    void _id; void proposal_id; void created_at; void updated_at
    const { data, error } = await sb
      .from('proposal_work_packages')
      .update(clean)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as ProposalWorkPackage
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb.from('proposal_work_packages').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================================
// Required-document checklist
// ============================================================================

export const proposalDocumentService = {
  async list(proposalId: string): Promise<ProposalDocument[]> {
    const { data, error } = await sb
      .from('proposal_documents')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return (data ?? []) as ProposalDocument[]
  },

  /** Seed a proposal's document checklist from a call-template. Call this
   *  once right after the proposal is created. */
  async seedFromTemplate(proposalId: string, template: ProposalCallTemplate): Promise<ProposalDocument[]> {
    const rows = template.default_documents.map((d, idx) => ({
      proposal_id: proposalId,
      document_type: d.type,
      label: d.label,
      description: d.description,
      handler: d.handler,
      template_url: d.template_url,
      required: d.required,
      sort_order: idx,
    }))
    if (rows.length === 0) return []
    const { data, error } = await sb
      .from('proposal_documents')
      .insert(rows)
      .select()
    if (error) throw error
    return (data ?? []) as ProposalDocument[]
  },

  /** Re-seed / reset an existing proposal's checklist against the given
   *  template. Modes:
   *   - `append_missing` (default): add rows whose `document_type` isn't
   *     already present. Preserves user edits. Safe default for "restore".
   *   - `replace_all`: delete every existing doc row and re-insert the
   *     template's full set. Destructive — caller must confirm, and any
   *     submissions attached to deleted docs will cascade away.
   *
   *  Returns the new/updated `proposal_documents` list. */
  async reseedFromTemplate(
    proposalId: string,
    template: ProposalCallTemplate,
    opts: { mode?: 'append_missing' | 'replace_all' } = {},
  ): Promise<ProposalDocument[]> {
    const mode = opts.mode ?? 'append_missing'

    const { data: existing, error: existingErr } = await sb
      .from('proposal_documents')
      .select('*')
      .eq('proposal_id', proposalId)
    if (existingErr) throw existingErr
    const existingTypes = new Set<string>(((existing ?? []) as ProposalDocument[]).map((d) => d.document_type))

    if (mode === 'replace_all') {
      const { error: delErr } = await sb
        .from('proposal_documents')
        .delete()
        .eq('proposal_id', proposalId)
      if (delErr) throw delErr
      return this.seedFromTemplate(proposalId, template)
    }

    // append_missing
    const maxOrder = ((existing ?? []) as ProposalDocument[])
      .reduce((m, d) => Math.max(m, d.sort_order), -1)
    const toAdd = template.default_documents
      .filter((d) => !existingTypes.has(d.type))
      .map((d, idx) => ({
        proposal_id: proposalId,
        document_type: d.type,
        label: d.label,
        description: d.description,
        handler: d.handler,
        template_url: d.template_url,
        required: d.required,
        sort_order: maxOrder + 1 + idx,
      }))
    if (toAdd.length === 0) {
      return (existing ?? []) as ProposalDocument[]
    }
    const { error: insErr } = await sb.from('proposal_documents').insert(toAdd)
    if (insErr) throw insErr
    const { data: final, error: listErr } = await sb
      .from('proposal_documents')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('sort_order', { ascending: true })
    if (listErr) throw listErr
    return (final ?? []) as ProposalDocument[]
  },

  async create(doc: Omit<ProposalDocument, 'id' | 'created_at' | 'updated_at'>): Promise<ProposalDocument> {
    const { data, error } = await sb
      .from('proposal_documents')
      .insert(doc)
      .select()
      .single()
    if (error) throw error
    return data as ProposalDocument
  },

  async update(id: string, patch: Partial<ProposalDocument>): Promise<ProposalDocument> {
    const { id: _id, proposal_id, created_at, updated_at, ...clean } = patch as any
    void _id; void proposal_id; void created_at; void updated_at
    const { data, error } = await sb
      .from('proposal_documents')
      .update(clean)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as ProposalDocument
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb.from('proposal_documents').delete().eq('id', id)
    if (error) throw error
  },

  /**
   * Seed the universal baseline checklist — Part A, Budget, OCD — so a
   * proposal that was created without a call template still ships with
   * the three documents every EU-style grant expects. Idempotent per
   * document_type: documents that already exist are skipped.
   *
   * Returns the final `proposal_documents` list (in sort order).
   */
  async seedBaseline(proposalId: string): Promise<ProposalDocument[]> {
    const { data: existing, error: existingErr } = await sb
      .from('proposal_documents')
      .select('*')
      .eq('proposal_id', proposalId)
    if (existingErr) throw existingErr
    const existingList = (existing ?? []) as ProposalDocument[]
    const existingTypes = new Set<string>(existingList.map((d) => d.document_type))

    const baseline = BASELINE_DOCUMENTS
    const maxOrder = existingList.reduce((m, d) => Math.max(m, d.sort_order), -1)
    const toAdd = baseline
      .filter((b) => !existingTypes.has(b.document_type))
      .map((b, idx) => ({
        proposal_id: proposalId,
        document_type: b.document_type,
        label: b.label,
        description: b.description,
        handler: b.handler,
        template_url: b.template_url,
        required: b.required,
        sort_order: maxOrder + 1 + idx,
      }))

    if (toAdd.length === 0) return existingList
    const { error: insErr } = await sb.from('proposal_documents').insert(toAdd)
    if (insErr) throw insErr

    const { data: final, error: listErr } = await sb
      .from('proposal_documents')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('sort_order', { ascending: true })
    if (listErr) throw listErr
    return (final ?? []) as ProposalDocument[]
  },

  /**
   * Add a single preset document to a proposal (coordinator-side quick-add).
   * Skipped silently if an entry with the same `document_type` already
   * exists — presets identify by type, not label.
   */
  async addPreset(proposalId: string, presetKey: PresetDocumentKey): Promise<ProposalDocument | null> {
    const preset = DOCUMENT_PRESETS[presetKey]
    if (!preset) throw new Error(`Unknown preset: ${presetKey}`)

    const { data: existing } = await sb
      .from('proposal_documents')
      .select('id, sort_order, document_type')
      .eq('proposal_id', proposalId)
    const list = (existing ?? []) as Array<{ id: string; sort_order: number; document_type: string }>
    if (list.some((d) => d.document_type === preset.document_type)) return null
    const maxOrder = list.reduce((m, d) => Math.max(m, d.sort_order), -1)

    const { data, error } = await sb
      .from('proposal_documents')
      .insert({
        proposal_id: proposalId,
        document_type: preset.document_type,
        label: preset.label,
        description: preset.description,
        handler: preset.handler,
        template_url: preset.template_url,
        required: preset.required,
        sort_order: maxOrder + 1,
      })
      .select()
      .single()
    if (error) throw error
    return data as ProposalDocument
  },
}

// ============================================================================
// Baseline + preset catalogue
// ============================================================================

type BaselineDoc = {
  document_type: string
  label: string
  description: string | null
  handler: 'form' | 'upload' | 'upload_with_template'
  template_url: string | null
  required: boolean
}

/**
 * The three documents every EU-style proposal needs. Kept separate from
 * call templates so a coordinator who forgets to pick a template on
 * create still gets sane defaults.
 *
 *   part_a     → structured form, handled by `ProposalPartAForm`
 *   budget     → structured form, handled by `ProposalBudgetForm`
 *   ownership_control → EC OCD; partner downloads template, signs, uploads.
 *                       `template_url` is null so the UI offers our built-in
 *                       jsPDF-generated template via a "Download template"
 *                       button (see `generateOcdTemplatePdf` in lib/ocdTemplate.ts).
 *                       Coordinator can override per-proposal with a specific
 *                       EC PDF URL if their call provides one.
 */
const BASELINE_DOCUMENTS: BaselineDoc[] = [
  {
    document_type: 'part_a',
    label: 'Part A — Partner profile',
    description: 'Administrative and profile information for each partner organisation (legal identity, researchers, contributions).',
    handler: 'form',
    template_url: null,
    required: true,
  },
  {
    document_type: 'budget',
    label: 'Budget commitment',
    description: 'Person-months per work package, PM rate, and other direct costs.',
    handler: 'form',
    template_url: null,
    required: true,
  },
  {
    document_type: 'ownership_control',
    label: 'Ownership Control Declaration',
    description: 'Download the EC OCD template, fill it in, sign, and upload the signed PDF. One per partner organisation.',
    handler: 'upload_with_template',
    template_url: null,
    required: true,
  },
]

/** Coordinator-side quick-add presets beyond the baseline. */
export type PresetDocumentKey =
  | 'ownership_control'
  | 'commitment_letter'
  | 'mandate_letter'
  | 'cv'
  | 'ethics_assessment'
  | 'gdpr_statement'
  | 'letter_of_intent'

export const DOCUMENT_PRESETS: Record<PresetDocumentKey, BaselineDoc> = {
  ownership_control: BASELINE_DOCUMENTS[2],
  commitment_letter: {
    document_type: 'commitment_letter',
    label: 'Letter of Commitment',
    description: 'Signed letter committing the partner organisation to the project.',
    handler: 'upload',
    template_url: null,
    required: true,
  },
  mandate_letter: {
    document_type: 'mandate_letter',
    label: 'Mandate letter',
    description: 'Signed mandate giving the coordinator authority to act on the partner’s behalf.',
    handler: 'upload',
    template_url: null,
    required: true,
  },
  cv: {
    document_type: 'cv',
    label: 'CVs of key researchers',
    description: 'PDFs of CVs for each key researcher listed in Part A.',
    handler: 'upload',
    template_url: null,
    required: false,
  },
  ethics_assessment: {
    document_type: 'ethics_assessment',
    label: 'Ethics self-assessment',
    description: 'Horizon Europe ethics checklist — download from the EC reference documents page, complete, and upload.',
    handler: 'upload_with_template',
    template_url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/how-to-participate/reference-documents',
    required: false,
  },
  gdpr_statement: {
    document_type: 'gdpr_statement',
    label: 'GDPR / data-protection statement',
    description: 'Partner’s statement on how personal data collected during the project will be handled.',
    handler: 'upload',
    template_url: null,
    required: false,
  },
  letter_of_intent: {
    document_type: 'letter_of_intent',
    label: 'Letter of Intent',
    description: 'Non-binding letter expressing the partner’s intent to collaborate on the proposal.',
    handler: 'upload',
    template_url: null,
    required: false,
  },
}

// ============================================================================
// Submissions (per partner × document)
// ============================================================================

export const proposalSubmissionService = {
  async list(proposalId: string): Promise<ProposalSubmission[]> {
    const { data, error } = await sb
      .from('proposal_submissions')
      .select(`
        *,
        document:proposal_documents(*),
        partner:proposal_partners(*),
        current_version:proposal_submission_versions!proposal_submissions_current_version_fkey(*)
      `)
      .eq('proposal_id', proposalId)
    if (error) throw error
    return (data ?? []) as ProposalSubmission[]
  },

  async listForPartner(proposalId: string, partnerId: string): Promise<ProposalSubmission[]> {
    const { data, error } = await sb
      .from('proposal_submissions')
      .select(`
        *,
        document:proposal_documents(*),
        current_version:proposal_submission_versions!proposal_submissions_current_version_fkey(*)
      `)
      .eq('proposal_id', proposalId)
      .eq('partner_id', partnerId)
    if (error) throw error
    return (data ?? []) as ProposalSubmission[]
  },

  /** Upsert a submission row (idempotent). Called when a partner starts
   *  working on a document — creates the row if missing. Race-safe: uses
   *  ON CONFLICT against the unique index `(proposal_id, partner_id,
   *  document_id)` so two concurrent callers never double-insert. */
  async ensure(params: {
    proposal_id: string
    partner_id: string
    document_id: string
  }): Promise<ProposalSubmission> {
    const { data, error } = await sb
      .from('proposal_submissions')
      .upsert(
        {
          proposal_id: params.proposal_id,
          partner_id: params.partner_id,
          document_id: params.document_id,
          status: 'not_started',
        },
        {
          onConflict: 'proposal_id,partner_id,document_id',
          // Don't overwrite an existing row's state.
          ignoreDuplicates: true,
        },
      )
      .select()
      .maybeSingle()
    if (error) throw error
    if (data) return data as ProposalSubmission

    // `ignoreDuplicates` returned no row because the row already existed —
    // fetch it explicitly.
    const { data: existing, error: selErr } = await sb
      .from('proposal_submissions')
      .select('*')
      .eq('proposal_id', params.proposal_id)
      .eq('partner_id', params.partner_id)
      .eq('document_id', params.document_id)
      .single()
    if (selErr) throw selErr
    return existing as ProposalSubmission
  },

  async setStatus(
    id: string,
    status: ProposalSubmissionStatus,
    reviewNote?: string | null,
  ): Promise<ProposalSubmission> {
    const patch: Record<string, unknown> = { status, review_note: reviewNote ?? null }
    if (status === 'submitted') patch.submitted_at = new Date().toISOString()
    if (status === 'approved' || status === 'needs_revision') {
      patch.reviewed_at = new Date().toISOString()
    }
    const { data, error } = await sb
      .from('proposal_submissions')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as ProposalSubmission
  },

  async addVersion(params: {
    submission_id: string
    storage_path: string
    file_name: string
    original_file_name: string
    mime_type: string | null
    file_size_bytes: number
    note?: string | null
  }): Promise<ProposalSubmissionVersion> {
    const { data: version, error } = await sb
      .from('proposal_submission_versions')
      .insert(params)
      .select()
      .single()
    if (error) throw error
    // Point the submission's current_version at the new row.
    await sb
      .from('proposal_submissions')
      .update({ current_version_id: (version as any).id })
      .eq('id', params.submission_id)
    return version as ProposalSubmissionVersion
  },

  async listVersions(submissionId: string): Promise<ProposalSubmissionVersion[]> {
    const { data, error } = await sb
      .from('proposal_submission_versions')
      .select('*')
      .eq('submission_id', submissionId)
      .order('uploaded_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ProposalSubmissionVersion[]
  },
}

// ============================================================================
// Part A form
// ============================================================================

export const proposalPartAService = {
  async get(proposalId: string, partnerId: string): Promise<ProposalPartA | null> {
    const { data, error } = await sb
      .from('proposal_part_a')
      .select('*')
      .eq('proposal_id', proposalId)
      .eq('partner_id', partnerId)
      .maybeSingle()
    if (error) throw error
    return (data ?? null) as ProposalPartA | null
  },

  async upsert(row: Partial<ProposalPartA> & { proposal_id: string; partner_id: string }): Promise<ProposalPartA> {
    const { id: _id, created_at, updated_at, ...clean } = row as any
    void _id; void created_at; void updated_at
    const { data, error } = await sb
      .from('proposal_part_a')
      .upsert(clean, { onConflict: 'proposal_id,partner_id' })
      .select()
      .single()
    if (error) throw error
    return data as ProposalPartA
  },
}

// ============================================================================
// Budgets (header + lines)
// ============================================================================

export const proposalBudgetService = {
  async get(proposalId: string, partnerId: string): Promise<ProposalBudget | null> {
    const { data, error } = await sb
      .from('proposal_budgets')
      .select('*, lines:proposal_budget_lines(*, wp:proposal_work_packages(*))')
      .eq('proposal_id', proposalId)
      .eq('partner_id', partnerId)
      .maybeSingle()
    if (error) throw error
    return (data ?? null) as ProposalBudget | null
  },

  async upsertHeader(
    row: Partial<ProposalBudget> & { proposal_id: string; partner_id: string },
  ): Promise<ProposalBudget> {
    const { id: _id, created_at, updated_at, lines: _lines, ...clean } = row as any
    void _id; void created_at; void updated_at; void _lines
    const { data, error } = await sb
      .from('proposal_budgets')
      .upsert(clean, { onConflict: 'proposal_id,partner_id' })
      .select()
      .single()
    if (error) throw error
    return data as ProposalBudget
  },

  async replaceLines(budgetId: string, lines: Omit<ProposalBudgetLine, 'id' | 'created_at' | 'budget_id'>[]): Promise<void> {
    await sb.from('proposal_budget_lines').delete().eq('budget_id', budgetId)
    if (lines.length === 0) return
    const rows = lines.map(l => ({ ...l, budget_id: budgetId }))
    const { error } = await sb.from('proposal_budget_lines').insert(rows)
    if (error) throw error
  },
}

// ============================================================================
// Audit events
// ============================================================================

export const proposalAuditService = {
  async list(proposalId: string, limit = 200): Promise<ProposalAuditEvent[]> {
    const { data, error } = await sb
      .from('proposal_audit_events')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as ProposalAuditEvent[]
  },

  async log(event: Omit<ProposalAuditEvent, 'id' | 'created_at'>): Promise<void> {
    const { error } = await sb.from('proposal_audit_events').insert(event)
    if (error) throw error
  },
}

// ============================================================================
// Convert-to-project (atomic RPC)
// ============================================================================

export async function convertProposalToProject(proposalId: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc('rpc_convert_proposal_to_project', {
    p_proposal_id: proposalId,
  })
  if (error) throw error
  return data as string
}
