import { supabase } from '@/lib/supabase'
import type { ProposalPhase, ProposalTask } from '@/types'

// These tables aren't in the generated database.types.ts yet. Use a typed-
// erased handle — regenerate with `npx supabase gen types` to drop this.
const sb = supabase as any

const DEFAULT_TEMPLATE: Array<{ name: string; description: string; sort_order: number }> = [
  {
    name: 'Concept & outline',
    description:
      'Decide on the scope, target call, lead investigators, and the high-level pitch.',
    sort_order: 1,
  },
  {
    name: 'Partner confirmation',
    description:
      'Identify and formally invite the external partners that will be part of the consortium.',
    sort_order: 2,
  },
  {
    name: 'Part A — Administrative forms',
    description:
      'Complete the administrative forms on the Funding & Tenders portal: participants, budgets table, contact info.',
    sort_order: 3,
  },
  {
    name: 'Part B — Technical proposal',
    description:
      'Draft Excellence / Impact / Implementation sections, work packages, Gantt, risk register.',
    sort_order: 4,
  },
  {
    name: 'Budget collection from partners',
    description:
      'Collect effort and cost breakdowns from every partner. Reconcile against the overall call ceiling.',
    sort_order: 5,
  },
  {
    name: 'Internal review & polish',
    description:
      'Peer review, proof-reading, format compliance check, final version locked.',
    sort_order: 6,
  },
  {
    name: 'Submission',
    description: 'Submit on the F&T portal and archive the submission receipt.',
    sort_order: 7,
  },
]

export const proposalPhaseService = {
  async list(proposalId: string): Promise<ProposalPhase[]> {
    const { data, error } = await sb
      .from('proposal_phases')
      .select(
        '*, owner:persons!proposal_phases_owner_person_id_fkey(id, full_name, avatar_url)',
      )
      .eq('proposal_id', proposalId)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToPhase)
  },

  async listTasks(proposalId: string): Promise<ProposalTask[]> {
    const { data, error } = await sb
      .from('proposal_tasks')
      .select(
        '*, owner:persons!proposal_tasks_owner_person_id_fkey(id, full_name, avatar_url)',
      )
      .eq('proposal_id', proposalId)
      .order('phase_id', { ascending: true })
      .order('sort_order', { ascending: true })
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToTask)
  },

  /**
   * Seed the default template for a proposal that has zero phases. Safe to
   * call repeatedly — it checks for existing phases first.
   */
  async ensureSeeded(orgId: string, proposalId: string): Promise<void> {
    const { data: existing } = await sb
      .from('proposal_phases')
      .select('id')
      .eq('proposal_id', proposalId)
      .limit(1)
    if (existing && existing.length > 0) return

    const rows = DEFAULT_TEMPLATE.map(tpl => ({
      org_id: orgId,
      proposal_id: proposalId,
      name: tpl.name,
      description: tpl.description,
      sort_order: tpl.sort_order,
    }))
    const { error } = await sb.from('proposal_phases').insert(rows)
    if (error) throw error
  },

  async updatePhase(id: string, patch: Partial<ProposalPhase>): Promise<ProposalPhase> {
    const { owner, ...clean } = patch as any
    void owner
    const { data, error } = await sb
      .from('proposal_phases')
      .update(clean)
      .eq('id', id)
      .select(
        '*, owner:persons!proposal_phases_owner_person_id_fkey(id, full_name, avatar_url)',
      )
      .single()
    if (error) throw error
    return rowToPhase(data)
  },

  async deletePhase(id: string): Promise<void> {
    const { error } = await sb.from('proposal_phases').delete().eq('id', id)
    if (error) throw error
  },

  async createPhase(
    orgId: string,
    proposalId: string,
    phase: Partial<ProposalPhase>,
  ): Promise<ProposalPhase> {
    const { data, error } = await sb
      .from('proposal_phases')
      .insert({
        org_id: orgId,
        proposal_id: proposalId,
        name: phase.name ?? 'New phase',
        description: phase.description ?? null,
        sort_order: phase.sort_order ?? 99,
        status: phase.status ?? 'todo',
        due_date: phase.due_date ?? null,
        owner_person_id: phase.owner_person_id ?? null,
        notes: phase.notes ?? null,
      })
      .select(
        '*, owner:persons!proposal_phases_owner_person_id_fkey(id, full_name, avatar_url)',
      )
      .single()
    if (error) throw error
    return rowToPhase(data)
  },

  async createTask(
    orgId: string,
    proposalId: string,
    phaseId: string,
    task: Partial<ProposalTask>,
  ): Promise<ProposalTask> {
    const { data, error } = await sb
      .from('proposal_tasks')
      .insert({
        org_id: orgId,
        proposal_id: proposalId,
        phase_id: phaseId,
        title: task.title ?? 'New task',
        description: task.description ?? null,
        sort_order: task.sort_order ?? 99,
        status: task.status ?? 'todo',
        owner_person_id: task.owner_person_id ?? null,
        due_date: task.due_date ?? null,
      })
      .select(
        '*, owner:persons!proposal_tasks_owner_person_id_fkey(id, full_name, avatar_url)',
      )
      .single()
    if (error) throw error
    return rowToTask(data)
  },

  async updateTask(id: string, patch: Partial<ProposalTask>): Promise<ProposalTask> {
    const { owner, ...clean } = patch as any
    void owner
    if (patch.status) {
      clean.completed_at = patch.status === 'done' ? new Date().toISOString() : null
    }
    const { data, error } = await sb
      .from('proposal_tasks')
      .update(clean)
      .eq('id', id)
      .select(
        '*, owner:persons!proposal_tasks_owner_person_id_fkey(id, full_name, avatar_url)',
      )
      .single()
    if (error) throw error
    return rowToTask(data)
  },

  async deleteTask(id: string): Promise<void> {
    const { error } = await sb.from('proposal_tasks').delete().eq('id', id)
    if (error) throw error
  },
}

function rowToPhase(r: any): ProposalPhase {
  return {
    id: r.id,
    org_id: r.org_id,
    proposal_id: r.proposal_id,
    name: r.name,
    description: r.description ?? null,
    sort_order: Number(r.sort_order ?? 0),
    status: r.status,
    due_date: r.due_date ?? null,
    owner_person_id: r.owner_person_id ?? null,
    notes: r.notes ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    owner: r.owner
      ? { id: r.owner.id, full_name: r.owner.full_name, avatar_url: r.owner.avatar_url ?? null }
      : null,
  }
}

function rowToTask(r: any): ProposalTask {
  return {
    id: r.id,
    org_id: r.org_id,
    proposal_id: r.proposal_id,
    phase_id: r.phase_id,
    title: r.title,
    description: r.description ?? null,
    sort_order: Number(r.sort_order ?? 0),
    status: r.status,
    owner_person_id: r.owner_person_id ?? null,
    due_date: r.due_date ?? null,
    completed_at: r.completed_at ?? null,
    completed_by: r.completed_by ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    owner: r.owner
      ? { id: r.owner.id, full_name: r.owner.full_name, avatar_url: r.owner.avatar_url ?? null }
      : null,
  }
}
