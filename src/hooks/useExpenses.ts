import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { expenseService, type CategoryTotal } from '@/services/expenseService'
import type { ProjectExpense, ExpenseCategory } from '@/types'

export function useProjectExpenses(projectId?: string) {
  const { orgId } = useAuthStore()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['expenses', orgId, projectId],
    queryFn: async () => {
      const [expenseData, totals] = await Promise.all([
        expenseService.list(orgId!, { projectId }),
        expenseService.getCategoryTotals(orgId!, projectId!),
      ])
      return { expenses: expenseData, categoryTotals: totals }
    },
    enabled: !!orgId && !!projectId,
  })

  const expenses = data?.expenses ?? [] as ProjectExpense[]
  const categoryTotals = data?.categoryTotals ?? [] as CategoryTotal[]

  const getTotalForCategory = useCallback(
    (category: ExpenseCategory): number => {
      return categoryTotals.find((t) => t.category === category)?.total ?? 0
    },
    [categoryTotals],
  )

  return { expenses, categoryTotals, isLoading, isError, error, refetch, getTotalForCategory }
}

/** Invalidate expense queries */
export function useInvalidateExpenses() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] })
  }
}
