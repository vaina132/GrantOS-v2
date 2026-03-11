import { supabase } from '@/lib/supabase'
import type { Proposal } from '@/types'

export const proposalService = {
  async list(orgId: string): Promise<Proposal[]> {
    const { data, error } = await supabase
      .from('proposals')
      .select('*, responsible_person:persons!proposals_responsible_person_id_fkey(id, full_name, avatar_url)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as Proposal[]
  },

  async create(proposal: Omit<Proposal, 'id' | 'created_at' | 'updated_at' | 'converted_project_id' | 'responsible_person'>): Promise<Proposal> {
    const { data, error } = await supabase
      .from('proposals')
      .insert(proposal)
      .select('*, responsible_person:persons!proposals_responsible_person_id_fkey(id, full_name, avatar_url)')
      .single()

    if (error) throw error
    return data as Proposal
  },

  async update(id: string, updates: Partial<Proposal>): Promise<Proposal> {
    const { responsible_person: _rp, ...rest } = updates
    const { data, error } = await supabase
      .from('proposals')
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, responsible_person:persons!proposals_responsible_person_id_fkey(id, full_name, avatar_url)')
      .single()

    if (error) throw error
    return data as Proposal
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('proposals')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  /** Convert a granted proposal into a project */
  async convertToProject(proposal: Proposal, orgId: string, userId: string): Promise<string> {
    const totalBudget =
      proposal.personnel_budget +
      proposal.travel_budget +
      proposal.subcontracting_budget +
      proposal.other_budget

    // Create the project
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .insert({
        org_id: orgId,
        acronym: proposal.project_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 10),
        title: proposal.project_name,
        funding_programme: proposal.call_identifier,
        status: 'Upcoming',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 3).toISOString().split('T')[0],
        total_budget: totalBudget,
        created_by: userId,
      })
      .select('id')
      .single()

    if (projErr) throw projErr

    // Mark proposal as converted
    await supabase
      .from('proposals')
      .update({
        converted_project_id: project.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposal.id)

    return project.id
  },
}
