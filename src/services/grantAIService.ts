import { supabase } from '@/lib/supabase'
import type { GrantAIExtraction } from '@/types'

export const grantAIService = {
  /**
   * Upload a grant agreement file and get AI-extracted project data.
   * Calls the Supabase Edge Function `parse-grant`.
   */
  async parseGrantAgreement(
    file: File,
    opts?: { organisationAbbreviation?: string; userInstructions?: string },
  ): Promise<{ extraction: GrantAIExtraction; usage?: any }> {
    const formData = new FormData()
    formData.append('file', file)
    if (opts?.organisationAbbreviation) formData.append('organisation_abbreviation', opts.organisationAbbreviation)
    if (opts?.userInstructions) formData.append('user_instructions', opts.userInstructions)

    // Get the current session token for auth
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL not configured')

    const response = await fetch(`${supabaseUrl}/functions/v1/parse-grant`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
      },
      body: formData,
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
      throw new Error(errData.error || `Failed to parse grant agreement (${response.status})`)
    }

    const data = await response.json()
    return data as { extraction: GrantAIExtraction; usage?: any }
  },
}
