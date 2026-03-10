import type { GrantAIExtraction } from '@/types'

export const grantAIService = {
  /**
   * Upload a grant agreement file and get AI-extracted project data.
   * Calls the Vercel serverless function at /api/parse-grant.
   */
  async parseGrantAgreement(
    file: File,
    opts?: { organisationAbbreviation?: string; userInstructions?: string },
  ): Promise<{ extraction: GrantAIExtraction; usage?: any }> {
    const formData = new FormData()
    formData.append('file', file)
    if (opts?.organisationAbbreviation) formData.append('organisation_abbreviation', opts.organisationAbbreviation)
    if (opts?.userInstructions) formData.append('user_instructions', opts.userInstructions)

    const response = await fetch('/api/parse-grant', {
      method: 'POST',
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
