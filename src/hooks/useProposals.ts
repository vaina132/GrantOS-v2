import { useQuery, useQueryClient } from '@tanstack/react-query'
import { proposalService } from '@/services/proposalService'
import { useAuthStore } from '@/stores/authStore'
import type { Proposal } from '@/types'

export function useProposals() {
  const { orgId } = useAuthStore()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['proposals', orgId],
    queryFn: () => proposalService.list(orgId!),
    enabled: !!orgId,
  })

  return { proposals: data ?? [] as Proposal[], isLoading, refetch }
}

/** Invalidate all proposal-related queries */
export function useInvalidateProposals() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['proposals'] })
  }
}
