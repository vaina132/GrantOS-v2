import { useQuery, useQueryClient } from '@tanstack/react-query'
import { staffService, type StaffFilters } from '@/services/staffService'
import { useAuthStore } from '@/stores/authStore'
import type { Person } from '@/types'

export function useStaff(filters?: StaffFilters) {
  const { orgId } = useAuthStore()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['staff', orgId, filters?.search, filters?.department, filters?.employment_type, filters?.is_active],
    queryFn: () => staffService.list(orgId, filters),
    enabled: !!orgId,
  })

  return { staff: data ?? [] as Person[], isLoading, refetch }
}

export function useStaffMember(id: string | undefined) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['staffMember', id],
    queryFn: () => staffService.getById(id!),
    enabled: !!id,
  })

  return { person: data ?? null as Person | null, isLoading, refetch }
}

/** Invalidate all staff-related queries (call after mutations) */
export function useInvalidateStaff() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['staff'] })
    queryClient.invalidateQueries({ queryKey: ['staffMember'] })
  }
}
