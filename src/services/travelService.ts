import { supabase } from '@/lib/supabase'
import type { Travel } from '@/types'

const table = () => (supabase as any).from('travels')

export const travelService = {
  async list(orgId: string, filters?: { person_id?: string; year?: number; month?: number }): Promise<Travel[]> {
    let query = table()
      .select('*, persons(full_name), projects(acronym, title)')
      .eq('org_id', orgId)
      .order('date')

    if (filters?.person_id) query = query.eq('person_id', filters.person_id)
    if (filters?.year && filters?.month) {
      const startDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`
      const lastDay = new Date(filters.year, filters.month, 0).getDate()
      const endDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      query = query.gte('date', startDate).lte('date', endDate)
    } else if (filters?.year) {
      query = query.gte('date', `${filters.year}-01-01`).lte('date', `${filters.year}-12-31`)
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as Travel[]
  },

  async create(travel: {
    org_id: string
    person_id: string
    project_id: string | null
    date: string
    location: string
    notes?: string | null
  }): Promise<Travel> {
    const { data, error } = await table()
      .insert(travel)
      .select('*, persons(full_name), projects(acronym, title)')
      .single()

    if (error) throw error
    return data as Travel
  },

  async update(id: string, updates: Partial<{ project_id: string | null; date: string; location: string; notes: string | null }>): Promise<Travel> {
    const { data, error } = await table()
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, persons(full_name), projects(acronym, title)')
      .single()

    if (error) throw error
    return data as Travel
  },

  async remove(id: string): Promise<void> {
    const { error } = await table().delete().eq('id', id)
    if (error) throw error
  },

  /** Get travel date set for a person in a month (for grid indicators) */
  async getTravelDates(orgId: string, personId: string, year: number, month: number): Promise<Map<string, Travel>> {
    const travels = await travelService.list(orgId, { person_id: personId, year, month })
    const map = new Map<string, Travel>()
    for (const t of travels) {
      map.set(t.date, t)
    }
    return map
  },
}
