import { useQuery, useQueryClient } from '@tanstack/react-query'
import { timesheetService, type TimesheetFilters } from '@/services/timesheetService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import type { TimesheetEntry } from '@/types'

export function useTimesheets(filters?: Omit<TimesheetFilters, 'year'>) {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['timesheets', orgId, globalYear, filters?.person_id, filters?.project_id, filters?.month, filters?.status],
    queryFn: () => timesheetService.list(orgId, { ...filters, year: globalYear }),
    enabled: !!orgId,
  })

  return { entries: data ?? [] as TimesheetEntry[], isLoading, refetch }
}

export function useTimesheetEnvelopes(month?: number) {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['timesheet-envelopes', orgId, globalYear, month],
    queryFn: () => timesheetService.listEnvelopes(orgId, { year: globalYear, month }),
    enabled: !!orgId,
  })

  return { envelopes: data ?? [] as TimesheetEntry[], isLoading, refetch }
}

/** Invalidate all timesheet-related queries */
export function useInvalidateTimesheets() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['timesheets'] })
    queryClient.invalidateQueries({ queryKey: ['timesheet-envelopes'] })
  }
}
