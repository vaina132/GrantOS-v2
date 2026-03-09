import { supabase } from '@/lib/supabase'
import type { TimesheetEntry, TimesheetStatus } from '@/types'

export interface TimesheetFilters {
  person_id?: string
  project_id?: string
  year?: number
  month?: number
  status?: TimesheetStatus
}

// Count working days (Mon-Fri) in a given month/year
export function getWorkingDays(year: number, month: number): number {
  let count = 0
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

const HOURS_PER_DAY = 8

const SELECT_WITH_JOINS = '*, persons(full_name, fte), projects(acronym, title)'

export const timesheetService = {
  async list(orgId: string | null, filters?: TimesheetFilters): Promise<TimesheetEntry[]> {
    let query = supabase
      .from('timesheet_entries')
      .select(SELECT_WITH_JOINS)
      .order('month')

    if (orgId) query = query.eq('org_id', orgId)
    if (filters?.person_id) query = query.eq('person_id', filters.person_id)
    if (filters?.project_id) query = query.eq('project_id', filters.project_id)
    if (filters?.year) query = query.eq('year', filters.year)
    if (filters?.month) query = query.eq('month', filters.month)
    if (filters?.status) query = query.eq('status', filters.status)

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as unknown as TimesheetEntry[]
  },

  /**
   * Smart sync: creates new entries for person-project combos that don't exist yet,
   * and updates planned_hours for existing Draft entries whose allocations changed.
   * Returns count of created + updated entries.
   */
  async generate(
    orgId: string,
    year: number,
    month: number,
  ): Promise<{ created: number; updated: number }> {
    // 1. Fetch actual assignments for this period
    const { data: assignments, error: aErr } = await supabase
      .from('assignments')
      .select('person_id, project_id, work_package_id, pms')
      .eq('org_id', orgId)
      .eq('year', year)
      .eq('month', month)
      .eq('type', 'actual')

    if (aErr) throw aErr
    if (!assignments || assignments.length === 0) {
      throw new Error('No actual allocations found for this period. Create allocations first.')
    }

    const workingDays = getWorkingDays(year, month)

    // 2. Fetch existing entries
    const { data: existing, error: exErr } = await supabase
      .from('timesheet_entries')
      .select('id, person_id, project_id, planned_hours, status')
      .eq('org_id', orgId)
      .eq('year', year)
      .eq('month', month)

    if (exErr) throw exErr

    const existingRows = (existing ?? []) as unknown as { id: string; person_id: string; project_id: string; planned_hours: number | null; status: string }[]
    const existingMap = new Map(
      existingRows.map((e) => [`${e.person_id}:${e.project_id}`, e]),
    )

    // 3. Build inserts and updates
    const toInsert: Record<string, unknown>[] = []
    const toUpdate: { id: string; planned_hours: number }[] = []

    for (const a of assignments) {
      const key = `${a.person_id}:${a.project_id}`
      const plannedHours = Math.round(a.pms * workingDays * HOURS_PER_DAY * 100) / 100

      const ex = existingMap.get(key)
      if (!ex) {
        toInsert.push({
          org_id: orgId,
          person_id: a.person_id,
          project_id: a.project_id,
          work_package_id: a.work_package_id,
          year,
          month,
          working_days: workingDays,
          planned_hours: plannedHours,
          status: 'Draft',
        })
      } else if (ex.status === 'Draft' && Math.abs((ex.planned_hours ?? 0) - plannedHours) > 0.01) {
        toUpdate.push({ id: ex.id, planned_hours: plannedHours })
      }
    }

    // 4. Execute
    let created = 0
    let updated = 0

    if (toInsert.length > 0) {
      const { error } = await supabase.from('timesheet_entries').insert(toInsert as any)
      if (error) throw error
      created = toInsert.length
    }

    for (const u of toUpdate) {
      const { error } = await supabase
        .from('timesheet_entries')
        .update({ planned_hours: u.planned_hours, working_days: workingDays, updated_at: new Date().toISOString() })
        .eq('id', u.id)
      if (error) throw error
      updated++
    }

    if (created === 0 && updated === 0) {
      return { created: 0, updated: 0 }
    }

    return { created, updated }
  },

  async updateActualHours(id: string, actual_hours: number): Promise<TimesheetEntry> {
    const { data, error } = await supabase
      .from('timesheet_entries')
      .update({ actual_hours, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(SELECT_WITH_JOINS)
      .single()

    if (error) throw error
    return data as unknown as TimesheetEntry
  },

  async updateNotes(id: string, notes: string): Promise<void> {
    const { error } = await supabase
      .from('timesheet_entries')
      .update({ notes, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
  },

  async submit(ids: string[], userId: string): Promise<void> {
    const { error } = await supabase
      .from('timesheet_entries')
      .update({
        status: 'Submitted',
        submitted_at: new Date().toISOString(),
        submitted_by: userId,
        updated_at: new Date().toISOString(),
      })
      .in('id', ids)

    if (error) throw error
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

    if (status === 'Submitted') {
      updates.submitted_at = new Date().toISOString()
      updates.submitted_by = userId
    } else if (status === 'Approved') {
      updates.approved_at = new Date().toISOString()
      updates.approved_by = userId
    }

    if (notes !== undefined) updates.notes = notes

    const { data, error } = await supabase
      .from('timesheet_entries')
      .update(updates)
      .eq('id', id)
      .select(SELECT_WITH_JOINS)
      .single()

    if (error) throw error
    return data as unknown as TimesheetEntry
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
    if (status === 'Submitted') {
      updates.submitted_at = new Date().toISOString()
      updates.submitted_by = userId
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
