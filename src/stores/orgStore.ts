import { create } from 'zustand'
import { settingsService } from '@/services/settingsService'
import type { Organisation } from '@/types'

interface OrgState {
  org: Organisation | null
  isLoading: boolean
  hasDocuSign: boolean
  load: (orgId: string) => Promise<void>
  reset: () => void
}

export const useOrgStore = create<OrgState>((set, get) => ({
  org: null,
  isLoading: false,
  hasDocuSign: false,

  load: async (orgId: string) => {
    // Skip if already loaded for this org
    if (get().org?.id === orgId && !get().isLoading) return

    set({ isLoading: true })
    try {
      const org = await settingsService.getOrganisation(orgId)
      const hasDocuSign = !!(
        org?.docusign_integration_key &&
        org?.docusign_user_id &&
        org?.docusign_account_id &&
        org?.docusign_rsa_private_key
      )
      set({ org: org ?? null, hasDocuSign, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  reset: () => set({ org: null, isLoading: false, hasDocuSign: false }),
}))
