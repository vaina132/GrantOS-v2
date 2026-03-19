import { useQuery, useQueryClient } from '@tanstack/react-query'
import { absenceService, type AbsenceFilters } from '@/services/absenceService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import type { Absence } from '@/types'

export function useAbsences(filters?: Omit<AbsenceFilters, 'year'>) {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['absences', orgId, globalYear, filters?.person_id, filters?.type],
    queryFn: () => absenceService.list(orgId, { ...filters, year: globalYear }),
    enabled: !!orgId,
  })

  return { absences: data ?? [] as Absence[], isLoading, isError, error, refetch }
}

/** Invalidate all absence-related queries */
export function useInvalidateAbsences() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['absences'] })
  }
}
