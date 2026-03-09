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

  async create(orgId: string, date: string, name: string): Promise<Holiday> {
    const { data, error } = await holidays()
      .insert({ org_id: orgId, date, name })
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

  async bulkCreate(orgId: string, items: { date: string; name: string }[]): Promise<number> {
    if (items.length === 0) return 0
    const rows = items.map(h => ({ org_id: orgId, date: h.date, name: h.name }))
    const { error } = await holidays()
      .upsert(rows, { onConflict: 'org_id,date' })
    if (error) throw error
    return rows.length
  },
}
