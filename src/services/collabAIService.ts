import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { apiFetch } from '@/lib/apiClient'

export interface CollabAIExtraction {
  project: {
    title: string
    acronym: string
    grant_number: string | null
    funding_programme: string | null
    funding_scheme: string | null
    start_date: string | null
    end_date: string | null
    duration_months: number | null
  }
  partners: {
    org_name: string
    role: 'coordinator' | 'partner'
    participant_number: number
    country: string | null
    org_type: string | null
    contact_name: string | null
    contact_email: string | null
    budget_personnel: number | null
    budget_subcontracting: number | null
    budget_travel: number | null
    budget_equipment: number | null
    budget_other_goods: number | null
    total_person_months: number | null
    funding_rate: number | null
    indirect_cost_rate: number | null
  }[]
  work_packages: {
    wp_number: number
    title: string
    start_month: number | null
    end_month: number | null
    total_person_months: number | null
    leader_participant_number: number | null
    tasks: {
      task_number: string
      title: string
      description: string | null
      start_month: number | null
      end_month: number | null
      leader_participant_number: number | null
      person_months: number | null
    }[]
  }[]
  deliverables: {
    number: string
    title: string
    description: string | null
    wp_number: number | null
    due_month: number
    type: string | null
    dissemination: string | null
    leader_participant_number: number | null
  }[]
  milestones: {
    number: string
    title: string
    description: string | null
    wp_number: number | null
    due_month: number
    verification_means: string | null
  }[]
  confidence_notes: string
}

export const collabAIService = {
  async parseCollabGrant(
    file: File,
    opts?: { userInstructions?: string },
  ): Promise<{ extraction: CollabAIExtraction; usage?: any; warning?: string }> {
    const storagePath = `collab-temp/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('grant-uploads')
      .upload(storagePath, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`)
    }

    try {
      const response = await apiFetch('/api/ai?action=parse-collab-grant', {
        method: 'POST',
        body: JSON.stringify({
          storage_path: storagePath,
          file_name: file.name,
          user_instructions: opts?.userInstructions || '',
          org_id: useAuthStore.getState().orgId || '',
          user_id: useAuthStore.getState().user?.id || '',
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(errData.error || `Failed to parse document (${response.status})`)
      }

      const data = await response.json()
      return data as { extraction: CollabAIExtraction; usage?: any; warning?: string }
    } finally {
      await supabase.storage.from('grant-uploads').remove([storagePath]).catch(() => {})
    }
  },
}
