import { supabase } from '@/lib/supabase'
import type { Assignment, PmBudget, PeriodLock } from '@/types'
import type { AssignmentType } from '@/types'

export interface AllocationCell {
  person_id: string
  project_id: string
  work_package_id: string | null
  year: number
  month: number
  pms: number
  type: AssignmentType
  id?: string
}

export const allocationsService = {
  // Assignments
  async listAssignments(
    orgId: string | null,
    year: number,
    type: AssignmentType,
  ): Promise<Assignment[]> {
    let query = supabase
      .from('assignments')
      .select('*')
      .eq('year', year)
      .eq('type', type)
      .order('month')

    if (orgId) query = query.eq('org_id', orgId)

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as Assignment[]
  },

  async listAssignmentsByProject(
    projectId: string,
    year: number,
    type: AssignmentType,
  ): Promise<Assignment[]> {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('project_id', projectId)
      .eq('year', year)
      .eq('type', type)
      .order('month')

    if (error) throw error
    return (data ?? []) as Assignment[]
  },

  async listAssignmentsByPerson(
    personId: string,
    year: number,
    type: AssignmentType,
  ): Promise<Assignment[]> {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('person_id', personId)
      .eq('year', year)
      .eq('type', type)
      .order('month')

    if (error) throw error
    return (data ?? []) as Assignment[]
  },

  async upsertAssignment(cell: AllocationCell & { org_id: string }): Promise<Assignment> {
    const { data, error } = await supabase
      .from('assignments')
      .upsert(
        {
          org_id: cell.org_id,
          person_id: cell.person_id,
          project_id: cell.project_id,
          work_package_id: cell.work_package_id,
          year: cell.year,
          month: cell.month,
          pms: cell.pms,
          type: cell.type,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'person_id,project_id,work_package_id,year,month,type',
        },
      )
      .select()
      .single()

    if (error) throw error
    return data as Assignment
  },

  async bulkUpsertAssignments(
    cells: (AllocationCell & { org_id: string })[],
  ): Promise<Assignment[]> {
    if (cells.length === 0) return []

    const rows = cells.map((c) => ({
      org_id: c.org_id,
      person_id: c.person_id,
      project_id: c.project_id,
      work_package_id: c.work_package_id,
      year: c.year,
      month: c.month,
      pms: c.pms,
      type: c.type,
      updated_at: new Date().toISOString(),
    }))

    const { data, error } = await supabase
      .from('assignments')
      .upsert(rows, {
        onConflict: 'person_id,project_id,work_package_id,year,month,type',
      })
      .select()

    if (error) throw error
    return (data ?? []) as Assignment[]
  },

  async deleteAssignment(id: string): Promise<void> {
    const { error } = await supabase.from('assignments').delete().eq('id', id)
    if (error) throw error
  },

  // PM Budgets
  async listPmBudgets(
    orgId: string | null,
    year: number,
    type: AssignmentType,
  ): Promise<PmBudget[]> {
    let query = supabase
      .from('pm_budgets')
      .select('*')
      .eq('year', year)
      .eq('type', type)

    if (orgId) query = query.eq('org_id', orgId)

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as PmBudget[]
  },

  async upsertPmBudget(budget: {
    org_id: string
    project_id: string
    work_package_id: string | null
    year: number
    target_pms: number
    type: AssignmentType
  }): Promise<PmBudget> {
    const { data, error } = await supabase
      .from('pm_budgets')
      .upsert(
        { ...budget, updated_at: new Date().toISOString() },
        { onConflict: 'project_id,work_package_id,year,type' },
      )
      .select()
      .single()

    if (error) throw error
    return data as PmBudget
  },

  // Period Locks
  async listPeriodLocks(orgId: string | null, year: number): Promise<PeriodLock[]> {
    let query = supabase
      .from('period_locks')
      .select('*')
      .eq('year', year)
      .order('month')

    if (orgId) query = query.eq('org_id', orgId)

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as PeriodLock[]
  },

  async togglePeriodLock(
    orgId: string,
    year: number,
    month: number,
    userId: string,
  ): Promise<{ locked: boolean }> {
    // Check if already locked
    const { data: existing } = await supabase
      .from('period_locks')
      .select('id')
      .eq('org_id', orgId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('period_locks')
        .delete()
        .eq('id', existing.id)
      if (error) throw error
      return { locked: false }
    } else {
      const { error } = await supabase
        .from('period_locks')
        .insert({
          org_id: orgId,
          year,
          month,
          locked_by: userId,
        })
      if (error) throw error
      return { locked: true }
    }
  },
}
