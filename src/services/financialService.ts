import { supabase } from '@/lib/supabase'
import type { FinancialBudget } from '@/types'

export type BudgetCategory = 'personnel' | 'travel' | 'subcontracting' | 'other' | 'indirect'

export interface BudgetRow {
  project_id: string
  project_acronym: string
  category: BudgetCategory
  budgeted: number
  actual: number
  year: number
}

export const financialService = {
  async listBudgets(orgId: string | null, year: number): Promise<FinancialBudget[]> {
    let query = supabase
      .from('financial_budgets')
      .select('*, projects(acronym, title)')
      .eq('year', year)

    if (orgId) query = query.eq('org_id', orgId)

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as FinancialBudget[]
  },

  async upsertBudget(budget: {
    org_id: string
    project_id: string
    category: BudgetCategory
    year: number
    budgeted: number
    actual: number
  }): Promise<FinancialBudget> {
    const { data, error } = await supabase
      .from('financial_budgets')
      .upsert(
        { ...budget, updated_at: new Date().toISOString() },
        { onConflict: 'project_id,category,year' },
      )
      .select('*, projects(acronym, title)')
      .single()

    if (error) throw error
    return data as FinancialBudget
  },

  async computePersonnelActuals(
    orgId: string,
    year: number,
  ): Promise<{ project_id: string; total: number }[]> {
    // Sum assignments * person salary to estimate personnel actuals
    const { data, error } = await supabase
      .from('assignments')
      .select('project_id, pms, persons(annual_salary)')
      .eq('org_id', orgId)
      .eq('year', year)
      .eq('type', 'actual')

    if (error) throw error

    const totals = new Map<string, number>()
    for (const row of data ?? []) {
      const salary = (row as any).persons?.annual_salary ?? 0
      const monthlySalary = salary / 12
      const cost = row.pms * monthlySalary
      totals.set(row.project_id, (totals.get(row.project_id) ?? 0) + cost)
    }

    return Array.from(totals.entries()).map(([project_id, total]) => ({ project_id, total }))
  },

  async getProjectBudgetSummary(
    orgId: string | null,
    year: number,
  ): Promise<BudgetRow[]> {
    const budgets = await financialService.listBudgets(orgId, year)
    return budgets.map((b) => ({
      project_id: b.project_id,
      project_acronym: (b as any).projects?.acronym ?? '?',
      category: b.category as BudgetCategory,
      budgeted: b.budgeted,
      actual: b.actual,
      year: b.year,
    }))
  },
}
