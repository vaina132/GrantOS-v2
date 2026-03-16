import { supabase } from '@/lib/supabase'
import type { AiUsage } from '@/types'

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export const aiUsageService = {
  /** Get the current month's usage for an org */
  async getCurrentUsage(orgId: string): Promise<AiUsage | null> {
    const month = currentMonth()
    const { data, error } = await supabase
      .from('ai_usage')
      .select('*')
      .eq('org_id', orgId)
      .eq('month', month)
      .maybeSingle()

    if (error) {
      console.warn('[GrantLume] ai_usage query failed:', error.message)
      return null
    }
    return data as AiUsage | null
  },
}
