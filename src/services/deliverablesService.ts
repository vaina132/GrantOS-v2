import { supabase } from '@/lib/supabase'
import type { Deliverable, Milestone, ReportingPeriod } from '@/types'

// Cast to any because tables may not exist in generated DB types yet
const deliverables = () => (supabase as any).from('deliverables')
const milestones = () => (supabase as any).from('milestones')
const reportingPeriods = () => (supabase as any).from('reporting_periods')

export const deliverablesService = {
  // ── Deliverables ──────────────────────────────────────────────

  async listDeliverables(projectId: string): Promise<Deliverable[]> {
    const { data, error } = await deliverables()
      .select('*')
      .eq('project_id', projectId)
      .order('number')
    if (error) throw error
    return (data ?? []) as Deliverable[]
  },

  async createDeliverable(d: Omit<Deliverable, 'id' | 'created_at' | 'updated_at'>): Promise<Deliverable> {
    const { data, error } = await deliverables()
      .insert(d)
      .select()
      .single()
    if (error) throw error
    return data as Deliverable
  },

  async updateDeliverable(id: string, updates: Partial<Deliverable>): Promise<Deliverable> {
    const { data, error } = await deliverables()
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Deliverable
  },

  async removeDeliverable(id: string): Promise<void> {
    const { error } = await deliverables().delete().eq('id', id)
    if (error) throw error
  },

  // ── Milestones ────────────────────────────────────────────────

  async listMilestones(projectId: string): Promise<Milestone[]> {
    const { data, error } = await milestones()
      .select('*')
      .eq('project_id', projectId)
      .order('number')
    if (error) throw error
    return (data ?? []) as Milestone[]
  },

  async createMilestone(m: Omit<Milestone, 'id' | 'created_at' | 'updated_at'>): Promise<Milestone> {
    const { data, error } = await milestones()
      .insert(m)
      .select()
      .single()
    if (error) throw error
    return data as Milestone
  },

  async updateMilestone(id: string, updates: Partial<Milestone>): Promise<Milestone> {
    const { data, error } = await milestones()
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Milestone
  },

  async removeMilestone(id: string): Promise<void> {
    const { error } = await milestones().delete().eq('id', id)
    if (error) throw error
  },

  // ── Reporting Periods ─────────────────────────────────────────

  async listReportingPeriods(projectId: string): Promise<ReportingPeriod[]> {
    const { data, error } = await reportingPeriods()
      .select('*')
      .eq('project_id', projectId)
      .order('period_number')
    if (error) throw error
    return (data ?? []) as ReportingPeriod[]
  },

  async createReportingPeriod(rp: Omit<ReportingPeriod, 'id' | 'created_at' | 'updated_at'>): Promise<ReportingPeriod> {
    const { data, error } = await reportingPeriods()
      .insert(rp)
      .select()
      .single()
    if (error) throw error
    return data as ReportingPeriod
  },

  async updateReportingPeriod(id: string, updates: Partial<ReportingPeriod>): Promise<ReportingPeriod> {
    const { data, error } = await reportingPeriods()
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as ReportingPeriod
  },

  async removeReportingPeriod(id: string): Promise<void> {
    const { error } = await reportingPeriods().delete().eq('id', id)
    if (error) throw error
  },
}
