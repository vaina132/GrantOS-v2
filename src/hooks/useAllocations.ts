import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { allocationsService } from '@/services/allocationsService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import type { Assignment, PmBudget, PeriodLock } from '@/types'
import type { AssignmentType } from '@/types'

export function useAssignments(type: AssignmentType) {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['assignments', orgId, globalYear, type],
    queryFn: () => allocationsService.listAssignments(orgId, globalYear, type),
    enabled: !!orgId,
  })

  return { assignments: data ?? [] as Assignment[], isLoading, isError, error, refetch }
}

export function usePmBudgets(type: AssignmentType) {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pmBudgets', orgId, globalYear, type],
    queryFn: () => allocationsService.listPmBudgets(orgId, globalYear, type),
    enabled: !!orgId,
  })

  return { budgets: data ?? [] as PmBudget[], isLoading, isError, error, refetch }
}

export function usePeriodLocks() {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['periodLocks', orgId, globalYear],
    queryFn: () => allocationsService.listPeriodLocks(orgId, globalYear),
    enabled: !!orgId,
  })

  const locks = data ?? [] as PeriodLock[]

  const isLocked = useCallback(
    (month: number) => locks.some((l) => l.month === month),
    [locks],
  )

  return { locks, isLoading, isError, error, isLocked, refetch }
}

/** Invalidate all allocation-related queries */
export function useInvalidateAllocations() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['assignments'] })
    queryClient.invalidateQueries({ queryKey: ['pmBudgets'] })
    queryClient.invalidateQueries({ queryKey: ['periodLocks'] })
  }
}
