import { useAuthStore } from '@/stores/authStore'
import { apiFetch } from '@/lib/apiClient'
import type { GrantAIExtraction } from '@/types'

export const grantAIService = {
  /**
   * Send a grant agreement file to AI for extraction.
   * File is encoded as base64 and sent directly in the request body.
   */
  async parseGrantAgreement(
    file: File,
    opts?: { organisationAbbreviation?: string; userInstructions?: string },
  ): Promise<{ extraction: GrantAIExtraction; usage?: any }> {
    // 1. Read file as base64
    const arrayBuffer = await file.arrayBuffer()
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    )

    if (base64.length > 4_000_000) {
      throw new Error('File is too large for AI processing (max ~3MB). Please use a smaller file.')
    }

    // 2. Call Vercel serverless function with base64 data
    const response = await apiFetch('/api/ai?action=parse-grant', {
      method: 'POST',
      body: JSON.stringify({
        file_data: base64,
        file_name: file.name,
        organisation_abbreviation: opts?.organisationAbbreviation || '',
        user_instructions: opts?.userInstructions || '',
        org_id: useAuthStore.getState().orgId || '',
        user_id: useAuthStore.getState().user?.id || '',
      }),
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
      throw new Error(errData.error || `Failed to parse grant agreement (${response.status})`)
    }

    const data = await response.json()
    return data as { extraction: GrantAIExtraction; usage?: any }
  },
}
