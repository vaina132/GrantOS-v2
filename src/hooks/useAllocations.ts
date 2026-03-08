import { useState, useEffect, useCallback } from 'react'
import { allocationsService } from '@/services/allocationsService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { toast } from '@/components/ui/use-toast'
import type { Assignment, PmBudget, PeriodLock } from '@/types'
import type { AssignmentType } from '@/types'

export function useAssignments(type: AssignmentType) {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await allocationsService.listAssignments(orgId, globalYear, type)
      setAssignments(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load assignments'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [orgId, globalYear, type])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { assignments, isLoading, refetch: fetch }
}

export function usePmBudgets(type: AssignmentType) {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()
  const [budgets, setBudgets] = useState<PmBudget[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await allocationsService.listPmBudgets(orgId, globalYear, type)
      setBudgets(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load PM budgets'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [orgId, globalYear, type])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { budgets, isLoading, refetch: fetch }
}

export function usePeriodLocks() {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()
  const [locks, setLocks] = useState<PeriodLock[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await allocationsService.listPeriodLocks(orgId, globalYear)
      setLocks(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load period locks'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [orgId, globalYear])

  useEffect(() => {
    fetch()
  }, [fetch])

  const isLocked = useCallback(
    (month: number) => locks.some((l) => l.month === month),
    [locks],
  )

  return { locks, isLoading, isLocked, refetch: fetch }
}
