import { supabase } from '@/lib/supabase'
import type { Holiday } from '@/types'

// Cast to any because the generated DB types don't include the new holidays table yet.
// After running the migration and regenerating types, remove the `as any` casts.
const holidays = () => (supabase as any).from('holidays')

export const holidayService = {
  async list(orgId: string, year: number): Promise<Holiday[]> {
    const { data, error } = await holidays()
      .select('*')
      .eq('org_id', orgId)
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`)
      .order('date')

    if (error) throw error
    return (data ?? []) as Holiday[]
  },

  async listForMonth(orgId: string, year: number, month: number): Promise<Holiday[]> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const { data, error } = await holidays()
      .select('*')
      .eq('org_id', orgId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')

    if (error) throw error
    return (data ?? []) as Holiday[]
  },

  async create(orgId: string, date: string, name: string, countryCode?: string, regionCode?: string): Promise<Holiday> {
    const { data, error } = await holidays()
      .insert({ org_id: orgId, date, name, country_code: countryCode ?? null, region_code: regionCode ?? null })
      .select()
      .single()

    if (error) throw error
    return data as Holiday
  },

  async remove(id: string): Promise<void> {
    const { error } = await holidays()
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  async bulkCreate(orgId: string, items: { date: string; name: string }[], countryCode?: string, regionCode?: string): Promise<number> {
    if (items.length === 0) return 0
    const cc = countryCode ?? null
    const rc = regionCode ?? null

    // Delete existing holidays for this org+country+region first, then insert fresh
    let q = holidays().delete().eq('org_id', orgId)
    if (cc) { q = q.eq('country_code', cc) } else { q = q.is('country_code', null) }
    if (rc) { q = q.eq('region_code', rc) } else { q = q.is('region_code', null) }
    await q

    const rows = items.map(h => ({ org_id: orgId, date: h.date, name: h.name, country_code: cc, region_code: rc }))
    const BATCH = 50
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const { error } = await holidays().insert(batch)
      if (error) throw error
    }
    return rows.length
  },

  /** List holidays for a given country code (used for per-person filtering) */
  async listByCountry(orgId: string, year: number, countryCode: string): Promise<Holiday[]> {
    const { data, error } = await holidays()
      .select('*')
      .eq('org_id', orgId)
      .eq('country_code', countryCode)
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`)
      .order('date')

    if (error) throw error
    return (data ?? []) as Holiday[]
  },
}
