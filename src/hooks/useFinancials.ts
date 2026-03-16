import { useQuery, useQueryClient } from '@tanstack/react-query'
import { financialService, type BudgetRow } from '@/services/financialService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import type { FinancialBudget } from '@/types'

export function useFinancialBudgets() {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['financialBudgets', orgId, globalYear],
    queryFn: () => financialService.listBudgets(orgId, globalYear),
    enabled: !!orgId,
  })

  return { budgets: data ?? [] as FinancialBudget[], isLoading, refetch }
}

export function useBudgetSummary() {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['budgetSummary', orgId, globalYear],
    queryFn: () => financialService.getProjectBudgetSummary(orgId, globalYear),
    enabled: !!orgId,
  })

  return { rows: data ?? [] as BudgetRow[], isLoading, refetch }
}

/** Invalidate all financial-related queries */
export function useInvalidateFinancials() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['financialBudgets'] })
    queryClient.invalidateQueries({ queryKey: ['budgetSummary'] })
  }
}
