/**
 * Pure financial calculation helpers — no DB dependencies.
 * Extracted from financialService so they can be unit-tested.
 */

export type BudgetCategory = 'personnel' | 'travel' | 'subcontracting' | 'other' | 'indirect'

export const ALL_CATEGORIES: BudgetCategory[] = ['personnel', 'travel', 'subcontracting', 'other', 'indirect']

export interface ProjectBudgetInput {
  start_date: string
  end_date: string
  budget_personnel: number | null
  budget_travel: number | null
  budget_subcontracting: number | null
  budget_other: number | null
  total_budget: number | null
  overhead_rate: number | null
}

/**
 * Distribute a project's total category budgets evenly across its active years.
 * Returns the per-year budgeted amount for each category.
 */
export function computeAnnualBudgets(
  project: ProjectBudgetInput,
): Record<BudgetCategory, number> {
  const pStart = new Date(project.start_date).getFullYear()
  const pEnd = new Date(project.end_date).getFullYear()
  const projectYears = Math.max(pEnd - pStart + 1, 1)

  return {
    personnel: round2((project.budget_personnel ?? 0) / projectYears),
    travel: round2((project.budget_travel ?? 0) / projectYears),
    subcontracting: round2((project.budget_subcontracting ?? 0) / projectYears),
    other: round2((project.budget_other ?? 0) / projectYears),
    indirect: round2(((project.total_budget ?? 0) * (project.overhead_rate ?? 0) / 100) / projectYears),
  }
}

/**
 * Compute personnel cost from person-months and annual salary.
 * cost = pms × (annualSalary / 12)
 */
export function personnelCost(pms: number, annualSalary: number): number {
  return round2(pms * (annualSalary / 12))
}

/**
 * Aggregate personnel costs for multiple assignments.
 * Returns a Map of projectId → total personnel cost.
 */
export function aggregatePersonnelCosts(
  assignments: { project_id: string; pms: number; annual_salary: number }[],
): Map<string, number> {
  const totals = new Map<string, number>()
  for (const a of assignments) {
    const cost = personnelCost(a.pms, a.annual_salary)
    totals.set(a.project_id, (totals.get(a.project_id) ?? 0) + cost)
  }
  // Round final totals
  for (const [k, v] of totals) {
    totals.set(k, round2(v))
  }
  return totals
}

/**
 * Check whether a year falls within a project's date range.
 */
export function isYearInRange(year: number, startDate: string, endDate: string): boolean {
  const pStart = new Date(startDate).getFullYear()
  const pEnd = new Date(endDate).getFullYear()
  return year >= pStart && year <= pEnd
}

/** Round to 2 decimal places */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}
