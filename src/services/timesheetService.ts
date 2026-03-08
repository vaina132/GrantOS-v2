import { supabase } from '@/lib/supabase'
import type { TimesheetEntry, TimesheetStatus } from '@/types'

export interface TimesheetFilters {
  person_id?: string
  project_id?: string
  year?: number
  month?: number
  status?: TimesheetStatus
}

export const timesheetService = {
  async list(orgId: string | null, filters?: TimesheetFilters): Promise<TimesheetEntry[]> {
    let query = supabase
      .from('timesheet_entries')
      .select('*, persons(full_name), projects(acronym, title)')
      .order('month')

    if (orgId) query = query.eq('org_id', orgId)
    if (filters?.person_id) query = query.eq('person_id', filters.person_id)
    if (filters?.project_id) query = query.eq('project_id', filters.project_id)
    if (filters?.year) query = query.eq('year', filters.year)
    if (filters?.month) query = query.eq('month', filters.month)
    if (filters?.status) query = query.eq('status', filters.status)

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as TimesheetEntry[]
  },

  async generate(
    orgId: string,
    year: number,
    month: number,
  ): Promise<TimesheetEntry[]> {
    // Fetch all assignments for that period
    const { data: assignments, error: aErr } = await supabase
      .from('assignments')
      .select('person_id, project_id, work_package_id, pms')
      .eq('org_id', orgId)
      .eq('year', year)
      .eq('month', month)
      .eq('type', 'actual')

    if (aErr) throw aErr
    if (!assignments || assignments.length === 0) {
      throw new Error('No assignments found for this period. Create allocations first.')
    }

    // Check existing entries to avoid duplicates
    const { data: existing } = await supabase
      .from('timesheet_entries')
      .select('person_id, project_id')
      .eq('org_id', orgId)
      .eq('year', year)
      .eq('month', month)

    const existingSet = new Set(
      (existing ?? []).map((e: { person_id: string; project_id: string }) => `${e.person_id}:${e.project_id}`),
    )

    const newEntries = assignments
      .filter((a) => !existingSet.has(`${a.person_id}:${a.project_id}`))
      .map((a) => ({
        org_id: orgId,
        person_id: a.person_id,
        project_id: a.project_id,
        work_package_id: a.work_package_id,
        year,
        month,
        planned_percentage: a.pms * 100,
        status: 'Draft' as TimesheetStatus,
      }))

    if (newEntries.length === 0) {
      throw new Error('All timesheet entries for this period already exist.')
    }

    const { data, error } = await supabase
      .from('timesheet_entries')
      .insert(newEntries)
      .select('*, persons(full_name), projects(acronym, title)')

    if (error) throw error
    return (data ?? []) as TimesheetEntry[]
  },

  async updateStatus(
    id: string,
    status: TimesheetStatus,
    userId: string,
    notes?: string,
  ): Promise<TimesheetEntry> {
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === 'Confirmed') {
      updates.confirmed_at = new Date().toISOString()
      updates.confirmed_by = userId
    } else if (status === 'Approved') {
      updates.approved_at = new Date().toISOString()
      updates.approved_by = userId
    }

    if (notes !== undefined) updates.notes = notes

    const { data, error } = await supabase
      .from('timesheet_entries')
      .update(updates)
      .eq('id', id)
      .select('*, persons(full_name), projects(acronym, title)')
      .single()

    if (error) throw error
    return data as TimesheetEntry
  },

  async updatePercentage(
    id: string,
    confirmed_percentage: number,
  ): Promise<TimesheetEntry> {
    const { data, error } = await supabase
      .from('timesheet_entries')
      .update({
        confirmed_percentage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, persons(full_name), projects(acronym, title)')
      .single()

    if (error) throw error
    return data as TimesheetEntry
  },

  async bulkUpdateStatus(
    ids: string[],
    status: TimesheetStatus,
    userId: string,
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }
    if (status === 'Confirmed') {
      updates.confirmed_at = new Date().toISOString()
      updates.confirmed_by = userId
    } else if (status === 'Approved') {
      updates.approved_at = new Date().toISOString()
      updates.approved_by = userId
    }

    const { error } = await supabase
      .from('timesheet_entries')
      .update(updates)
      .in('id', ids)

    if (error) throw error
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('timesheet_entries')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}
