import { supabase } from '@/lib/supabase'
import type { FundingScheme, Organisation } from '@/types'

export const settingsService = {
  // Funding Schemes
  async listFundingSchemes(orgId: string | null): Promise<FundingScheme[]> {
    let query = supabase
      .from('funding_schemes')
      .select('*')
      .order('name')

    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    const { data, error } = await query

    if (error) throw error
    return (data ?? []) as FundingScheme[]
  },

  async createFundingScheme(
    scheme: Omit<FundingScheme, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<FundingScheme> {
    const { data, error } = await supabase
      .from('funding_schemes')
      .insert(scheme)
      .select()
      .single()

    if (error) throw error
    return data as FundingScheme
  },

  async updateFundingScheme(id: string, updates: Partial<FundingScheme>): Promise<FundingScheme> {
    const { data, error } = await supabase
      .from('funding_schemes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as FundingScheme
  },

  async removeFundingScheme(id: string): Promise<void> {
    const { error } = await supabase
      .from('funding_schemes')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // Organisation
  async getOrganisation(orgId: string): Promise<Organisation | null> {
    const { data, error } = await supabase
      .from('organisations')
      .select('*')
      .eq('id', orgId)
      .single()

    if (error) throw error
    return data as Organisation
  },

  async updateOrganisation(orgId: string, updates: Partial<Organisation>): Promise<Organisation> {
    const { data, error } = await supabase
      .from('organisations')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', orgId)
      .select()
      .single()

    if (error) throw error
    return data as Organisation
  },
}
