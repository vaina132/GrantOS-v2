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
    // Find existing row (handles NULL work_package_id correctly)
    let query = supabase
      .from('assignments')
      .select('id')
      .eq('person_id', cell.person_id)
      .eq('project_id', cell.project_id)
      .eq('year', cell.year)
      .eq('month', cell.month)
      .eq('type', cell.type)

    if (cell.work_package_id) {
      query = query.eq('work_package_id', cell.work_package_id)
    } else {
      query = query.is('work_package_id', null)
    }

    const { data: existing } = await query.maybeSingle()

    if (existing) {
      const { data, error } = await supabase
        .from('assignments')
        .update({ pms: cell.pms, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      return data as Assignment
    } else {
      const { data, error } = await supabase
        .from('assignments')
        .insert({
          org_id: cell.org_id,
          person_id: cell.person_id,
          project_id: cell.project_id,
          work_package_id: cell.work_package_id,
          year: cell.year,
          month: cell.month,
          pms: cell.pms,
          type: cell.type,
        })
        .select()
        .single()
      if (error) throw error
      return data as Assignment
    }
  },

  async bulkUpsertAssignments(
    cells: (AllocationCell & { org_id: string })[],
  ): Promise<Assignment[]> {
    if (cells.length === 0) return []
    const results: Assignment[] = []
    for (const cell of cells) {
      const result = await allocationsService.upsertAssignment(cell)
      results.push(result)
    }
    return results
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
