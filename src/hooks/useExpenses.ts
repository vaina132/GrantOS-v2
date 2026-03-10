import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { expenseService, type CategoryTotal } from '@/services/expenseService'
import { toast } from '@/components/ui/use-toast'
import type { ProjectExpense, ExpenseCategory } from '@/types'

export function useProjectExpenses(projectId?: string) {
  const { orgId } = useAuthStore()
  const [expenses, setExpenses] = useState<ProjectExpense[]>([])
  const [categoryTotals, setCategoryTotals] = useState<CategoryTotal[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!orgId || !projectId) return
    setIsLoading(true)
    try {
      const [expenseData, totals] = await Promise.all([
        expenseService.list(orgId, { projectId }),
        expenseService.getCategoryTotals(orgId, projectId),
      ])
      setExpenses(expenseData)
      setCategoryTotals(totals)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load expenses'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [orgId, projectId])

  useEffect(() => {
    fetch()
  }, [fetch])

  const getTotalForCategory = useCallback(
    (category: ExpenseCategory): number => {
      return categoryTotals.find((t) => t.category === category)?.total ?? 0
    },
    [categoryTotals],
  )

  return { expenses, categoryTotals, isLoading, refetch: fetch, getTotalForCategory }
}
