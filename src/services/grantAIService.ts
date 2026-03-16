import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { GrantAIExtraction } from '@/types'

export const grantAIService = {
  /**
   * Upload a grant agreement file and get AI-extracted project data.
   * 1. Uploads the PDF to Supabase Storage (avoids Vercel body size limit).
   * 2. Calls the Vercel serverless function with the storage path.
   * 3. Cleans up the temp file after parsing.
   */
  async parseGrantAgreement(
    file: File,
    opts?: { organisationAbbreviation?: string; userInstructions?: string },
  ): Promise<{ extraction: GrantAIExtraction; usage?: any }> {
    // 1. Upload PDF to Supabase Storage
    const storagePath = `temp/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('grant-uploads')
      .upload(storagePath, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`)
    }

    try {
      // 2. Call Vercel serverless function with storage path (small JSON body)
      const response = await fetch('/api/ai?action=parse-grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_path: storagePath,
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
    } finally {
      // 3. Clean up temp file
      await supabase.storage.from('grant-uploads').remove([storagePath]).catch(() => {})
    }
  },
}
