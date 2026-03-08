import { useState, useEffect, useCallback } from 'react'
import { financialService, type BudgetRow } from '@/services/financialService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { toast } from '@/components/ui/use-toast'
import type { FinancialBudget } from '@/types'

export function useFinancialBudgets() {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()
  const [budgets, setBudgets] = useState<FinancialBudget[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await financialService.listBudgets(orgId, globalYear)
      setBudgets(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load financial data'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [orgId, globalYear])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { budgets, isLoading, refetch: fetch }
}

export function useBudgetSummary() {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()
  const [rows, setRows] = useState<BudgetRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await financialService.getProjectBudgetSummary(orgId, globalYear)
      setRows(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load budget summary'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [orgId, globalYear])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { rows, isLoading, refetch: fetch }
}
