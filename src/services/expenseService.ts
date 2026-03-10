import { supabase } from '@/lib/supabase'
import { writeAudit } from './auditWriter'
import type { ProjectExpense, ExpenseCategory } from '@/types'

export interface ExpenseFilters {
  projectId?: string
  category?: ExpenseCategory
  dateFrom?: string
  dateTo?: string
}

export interface CategoryTotal {
  category: ExpenseCategory
  total: number
}

export const expenseService = {
  async list(orgId: string, filters?: ExpenseFilters): Promise<ProjectExpense[]> {
    let query = supabase
      .from('project_expenses')
      .select('*')
      .eq('org_id', orgId)
      .order('expense_date', { ascending: false })

    if (filters?.projectId) query = query.eq('project_id', filters.projectId)
    if (filters?.category) query = query.eq('category', filters.category)
    if (filters?.dateFrom) query = query.gte('expense_date', filters.dateFrom)
    if (filters?.dateTo) query = query.lte('expense_date', filters.dateTo)

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as ProjectExpense[]
  },

  async create(expense: {
    org_id: string
    project_id: string
    category: ExpenseCategory
    description: string
    amount: number
    expense_date: string
    vendor?: string | null
    reference?: string | null
    person_id?: string | null
    notes?: string | null
    recorded_by?: string | null
  }): Promise<ProjectExpense> {
    const { data, error } = await supabase
      .from('project_expenses')
      .insert(expense)
      .select()
      .single()

    if (error) throw error
    writeAudit({
      orgId: expense.org_id,
      entityType: 'expense',
      action: 'create',
      entityId: (data as ProjectExpense).id,
      details: `Recorded expense: ${expense.description} (${expense.amount})`,
    })
    return data as ProjectExpense
  },

  async update(id: string, updates: Partial<ProjectExpense>): Promise<ProjectExpense> {
    const { data, error } = await supabase
      .from('project_expenses')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    writeAudit({
      orgId: (data as ProjectExpense).org_id,
      entityType: 'expense',
      action: 'update',
      entityId: id,
      details: `Updated expense: ${(data as ProjectExpense).description}`,
    })
    return data as ProjectExpense
  },

  async remove(id: string): Promise<void> {
    // Fetch first for audit
    const { data: expense } = await supabase
      .from('project_expenses')
      .select('org_id, description, amount')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('project_expenses')
      .delete()
      .eq('id', id)

    if (error) throw error
    if (expense) {
      writeAudit({
        orgId: expense.org_id,
        entityType: 'expense',
        action: 'delete',
        entityId: id,
        details: `Deleted expense: ${expense.description} (${expense.amount})`,
      })
    }
  },

  /** Get total spent per category for a specific project */
  async getCategoryTotals(orgId: string, projectId: string): Promise<CategoryTotal[]> {
    const { data, error } = await supabase
      .from('project_expenses')
      .select('category, amount')
      .eq('org_id', orgId)
      .eq('project_id', projectId)

    if (error) throw error

    const totals = new Map<ExpenseCategory, number>()
    for (const row of data ?? []) {
      const cat = row.category as ExpenseCategory
      totals.set(cat, (totals.get(cat) ?? 0) + Number(row.amount))
    }

    return Array.from(totals.entries()).map(([category, total]) => ({ category, total }))
  },

  /** Get total spent per project per category (for financial overview sync) */
  async getProjectTotals(
    orgId: string,
    year: number,
  ): Promise<{ project_id: string; category: ExpenseCategory; total: number }[]> {
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`

    const { data, error } = await supabase
      .from('project_expenses')
      .select('project_id, category, amount')
      .eq('org_id', orgId)
      .gte('expense_date', yearStart)
      .lte('expense_date', yearEnd)

    if (error) throw error

    const map = new Map<string, number>()
    for (const row of data ?? []) {
      const key = `${row.project_id}:${row.category}`
      map.set(key, (map.get(key) ?? 0) + Number(row.amount))
    }

    return Array.from(map.entries()).map(([key, total]) => {
      const [project_id, category] = key.split(':')
      return { project_id, category: category as ExpenseCategory, total }
    })
  },
}
