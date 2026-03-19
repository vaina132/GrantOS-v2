import { useQuery, useQueryClient } from '@tanstack/react-query'
import { travelService } from '@/services/travelService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import type { Travel } from '@/types'

export function useTravels(filters?: { person_id?: string; month?: number }) {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['travels', orgId, globalYear, filters?.person_id, filters?.month],
    queryFn: () => travelService.list(orgId!, {
      person_id: filters?.person_id,
      year: globalYear,
      month: filters?.month,
    }),
    enabled: !!orgId,
  })

  return { travels: data ?? [] as Travel[], isLoading, refetch }
}

export function useInvalidateTravels() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['travels'] })
  }
}
