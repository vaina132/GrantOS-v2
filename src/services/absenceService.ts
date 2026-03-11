import { supabase } from '@/lib/supabase'
import type { Absence, AbsenceType, AbsenceStatus } from '@/types'

export interface AbsenceFilters {
  person_id?: string
  type?: AbsenceType
  year?: number
  month?: number
}

export const absenceService = {
  async list(orgId: string | null, filters?: AbsenceFilters): Promise<Absence[]> {
    let query = supabase
      .from('absences')
      .select('*, persons(full_name)')
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

  async create(absence: Omit<Absence, 'id' | 'created_at' | 'updated_at' | 'persons'>): Promise<Absence> {
    const { data, error } = await supabase
      .from('absences')
      .insert(absence)
      .select('*, persons(full_name)')
      .single()

    if (error) throw error
    return data as unknown as Absence
  },

  async update(id: string, updates: Partial<Absence>): Promise<Absence> {
    const { ...rest } = updates
    const { data, error } = await supabase
      .from('absences')
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, persons(full_name)')
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
    const { data, error } = await supabase
      .from('absences')
      .update({
        status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, persons(full_name)')
      .single()

    if (error) throw error
    return data as unknown as Absence
  },

  async reject(id: string, userId: string): Promise<Absence> {
    const { data, error } = await supabase
      .from('absences')
      .update({
        status: 'rejected',
        approved_by: userId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, persons(full_name)')
      .single()

    if (error) throw error
    return data as unknown as Absence
  },
}
