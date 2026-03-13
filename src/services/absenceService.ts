import { supabase } from '@/lib/supabase'
import type { Absence, AbsenceType, AbsenceStatus } from '@/types'

export interface AbsenceFilters {
  person_id?: string
  type?: AbsenceType
  year?: number
  month?: number
}

// Select strings
const SELECT_WITH_SUB = '*, persons(full_name), substitute_person:persons!absences_substitute_person_id_fkey(full_name)'
const SELECT_BASIC = '*, persons(full_name)'

// Cached capability flag — probed once per session
let _hasSub: boolean | null = null

/** Probe once whether the substitute_person_id column exists on the absences table */
async function probeSubstitute(): Promise<boolean> {
  if (_hasSub !== null) return _hasSub
  try {
    const { data, error } = await supabase
      .from('absences')
      .select('substitute_person_id')
      .limit(0)
    _hasSub = !error && data !== null
  } catch {
    _hasSub = false
  }
  return _hasSub
}

/** Return the correct select string after probing */
async function getSel(): Promise<string> {
  await probeSubstitute()
  return _hasSub ? SELECT_WITH_SUB : SELECT_BASIC
}

/** Strip substitute fields from a payload when column is missing */
function stripSub<T extends Record<string, any>>(obj: T): T {
  if (_hasSub !== false) return obj
  const { substitute_person_id: _, ...rest } = obj
  return rest as T
}

export const absenceService = {
  async list(orgId: string | null, filters?: AbsenceFilters): Promise<Absence[]> {
    const sel = await getSel()
    let query = supabase
      .from('absences')
      .select(sel)
      .order('start_date', { ascending: false })

    if (orgId) query = query.eq('org_id', orgId)
    if (filters?.person_id) query = query.eq('person_id', filters.person_id)
    if (filters?.type) query = query.eq('type', filters.type)

    if (filters?.year) {
      const start = `${filters.year}-01-01`
      const end = `${filters.year}-12-31`
      query = query.or(`start_date.gte.${start},date.gte.${start}`)
      query = query.or(`end_date.lte.${end},date.lte.${end}`)
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as unknown as Absence[]
  },

  async create(absence: Omit<Absence, 'id' | 'created_at' | 'updated_at' | 'persons' | 'substitute_person'>): Promise<Absence> {
    const sel = await getSel()
    const payload = stripSub(absence as any)
    const { data, error } = await supabase
      .from('absences')
      .insert(payload as any)
      .select(sel)
      .single()

    if (error) throw error
    return data as unknown as Absence
  },

  async update(id: string, updates: Partial<Absence>): Promise<Absence> {
    const sel = await getSel()
    const { persons: _p, substitute_person: _sp, ...rest } = updates
    const payload = stripSub(rest as any)
    const { data, error } = await supabase
      .from('absences')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(sel)
      .single()

    if (error) throw error
    return data as unknown as Absence
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('absences')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  async getPersonAbsenceDays(
    personId: string,
    year: number,
  ): Promise<number> {
    const { data, error } = await supabase
      .from('absences')
      .select('*')
      .eq('person_id', personId)
      .gte('start_date', `${year}-01-01`)
      .lte('end_date', `${year}-12-31`)

    if (error) throw error
    let total = 0
    for (const row of data ?? []) {
      // Only count approved or legacy (null status) absences
      const s = (row as any).status as AbsenceStatus | null
      if (s === 'rejected' || s === 'cancelled') continue
      total += Number(row.days) || 0
    }
    return total
  },

  async approve(id: string, userId: string): Promise<Absence> {
    const sel = await getSel()
    const { data, error } = await supabase
      .from('absences')
      .update({
        status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(sel)
      .single()

    if (error) throw error
    return data as unknown as Absence
  },

  async reject(id: string, userId: string): Promise<Absence> {
    const sel = await getSel()
    const { data, error } = await supabase
      .from('absences')
      .update({
        status: 'rejected',
        approved_by: userId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(sel)
      .single()

    if (error) throw error
    return data as unknown as Absence
  },

  /**
   * Get overlapping absences for a given org and date range.
   * Returns approved or pending absences that overlap [startDate, endDate],
   * optionally excluding a specific person (the requester).
   */
  async getConflicts(
    orgId: string,
    startDate: string,
    endDate: string,
    excludePersonId?: string,
  ): Promise<Absence[]> {
    let query = supabase
      .from('absences')
      .select('*, persons(full_name, department, avatar_url)')
      .eq('org_id', orgId)
      .in('status', ['pending', 'approved'])
      .lte('start_date', endDate)
      .gte('end_date', startDate)

    if (excludePersonId) {
      query = query.neq('person_id', excludePersonId)
    }

    const { data, error } = await query.order('start_date')
    if (error) throw error
    return (data ?? []) as unknown as Absence[]
  },

  /**
   * Check if a specific person has any approved/pending absence overlapping [startDate, endDate].
   * Used for substitute overlap warning.
   */
  async hasOverlap(
    personId: string,
    startDate: string,
    endDate: string,
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('absences')
      .select('id')
      .eq('person_id', personId)
      .in('status', ['pending', 'approved'])
      .lte('start_date', endDate)
      .gte('end_date', startDate)
      .limit(1)

    if (error) throw error
    return (data?.length ?? 0) > 0
  },
}
