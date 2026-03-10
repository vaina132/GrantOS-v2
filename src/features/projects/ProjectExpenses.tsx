import { useState } from 'react'
import { useProjectExpenses } from '@/hooks/useExpenses'
import { expenseService } from '@/services/expenseService'
import { useAuthStore } from '@/stores/authStore'
import { useStaff } from '@/hooks/useStaff'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'
import { Plus, Trash2, Receipt, Plane, Handshake, Package, TrendingDown, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import type { Project, ExpenseCategory, ProjectExpense } from '@/types'

const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: string; icon: typeof Plane }[] = [
  { key: 'travel', label: 'Travel', icon: Plane },
  { key: 'subcontracting', label: 'Subcontracting', icon: Handshake },
  { key: 'other', label: 'Other Direct Costs', icon: Package },
  { key: 'indirect', label: 'Indirect Costs', icon: TrendingDown },
]

function getBudgetForCategory(project: Project, category: ExpenseCategory): number {
  switch (category) {
    case 'travel': return project.budget_travel ?? 0
    case 'subcontracting': return project.budget_subcontracting ?? 0
    case 'other': return project.budget_other ?? 0
    case 'indirect': {
      const total = project.total_budget ?? 0
      const rate = project.overhead_rate ?? 0
      return (total * rate) / 100
    }
  }
}

interface Props {
  project: Project
}

export function ProjectExpenses({ project }: Props) {
  const { orgId, user, can } = useAuthStore()
  const { expenses, isLoading, refetch, getTotalForCategory } = useProjectExpenses(project.id)
  const { staff } = useStaff({ is_active: true })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ProjectExpense | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProjectExpense | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | 'all'>('all')

  // Form state
  const [category, setCategory] = useState<ExpenseCategory>('travel')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0])
  const [vendor, setVendor] = useState('')
  const [reference, setReference] = useState('')
  const [personId, setPersonId] = useState('')
  const [notes, setNotes] = useState('')

  const resetForm = () => {
    setCategory('travel')
    setDescription('')
    setAmount('')
    setExpenseDate(new Date().toISOString().split('T')[0])
    setVendor('')
    setReference('')
    setPersonId('')
    setNotes('')
    setEditingExpense(null)
  }

  const openNew = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (exp: ProjectExpense) => {
    setEditingExpense(exp)
    setCategory(exp.category)
    setDescription(exp.description)
    setAmount(String(exp.amount))
    setExpenseDate(exp.expense_date)
    setVendor(exp.vendor ?? '')
    setReference(exp.reference ?? '')
    setPersonId(exp.person_id ?? '')
    setNotes(exp.notes ?? '')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!orgId || !description.trim() || !amount || !expenseDate) return
    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount < 0) {
      toast({ title: 'Invalid amount', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      if (editingExpense) {
        await expenseService.update(editingExpense.id, {
          category,
          description: description.trim(),
          amount: numAmount,
          expense_date: expenseDate,
          vendor: vendor.trim() || null,
          reference: reference.trim() || null,
          person_id: personId || null,
          notes: notes.trim() || null,
        })
        toast({ title: 'Expense updated' })
      } else {
        await expenseService.create({
          org_id: orgId,
          project_id: project.id,
          category,
          description: description.trim(),
          amount: numAmount,
          expense_date: expenseDate,
          vendor: vendor.trim() || null,
          reference: reference.trim() || null,
          person_id: personId || null,
          notes: notes.trim() || null,
          recorded_by: user?.id ?? null,
        })
        toast({ title: 'Expense recorded' })
      }
      setDialogOpen(false)
      resetForm()
      refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save expense'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await expenseService.remove(deleteTarget.id)
      toast({ title: 'Expense deleted' })
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const filteredExpenses = filterCategory === 'all'
    ? expenses
    : expenses.filter((e) => e.category === filterCategory)

  if (isLoading) return <Skeleton className="h-64 w-full" />

  return (
    <div className="space-y-6">
      {/* ── Budget consumption cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {EXPENSE_CATEGORIES.map((cat) => {
          const budget = getBudgetForCategory(project, cat.key)
          const spent = getTotalForCategory(cat.key)
          const remaining = budget - spent
          const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
          const Icon = cat.icon

          return (
            <Card key={cat.key} className="relative overflow-hidden">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{cat.label}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Budget</span>
                    <span className="tabular-nums">{formatCurrency(budget)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Spent</span>
                    <span className="tabular-nums font-medium">{formatCurrency(spent)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        pct <= 70 ? 'bg-emerald-500' : pct <= 90 ? 'bg-amber-500' : 'bg-red-500',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className={cn(
                      'font-medium',
                      remaining >= 0 ? 'text-emerald-600' : 'text-red-600',
                    )}>
                      {remaining >= 0 ? 'Remaining' : 'Over budget'}
                    </span>
                    <span className={cn(
                      'tabular-nums font-semibold',
                      remaining >= 0 ? 'text-emerald-600' : 'text-red-600',
                    )}>
                      {formatCurrency(Math.abs(remaining))}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── Smart Budget Alerts ── */}
      {(() => {
        const now = new Date()
        const start = new Date(project.start_date)
        const end = new Date(project.end_date)
        const totalDays = Math.max((end.getTime() - start.getTime()) / 86400000, 1)
        const elapsedDays = Math.max(Math.min((now.getTime() - start.getTime()) / 86400000, totalDays), 0)
        const timelinePct = (elapsedDays / totalDays) * 100

        const alerts: { category: string; spentPct: number; timelinePct: number; message: string }[] = []

        for (const cat of EXPENSE_CATEGORIES) {
          const budget = getBudgetForCategory(project, cat.key)
          if (budget <= 0) continue
          const spent = getTotalForCategory(cat.key)
          const spentPct = (spent / budget) * 100

          // Alert if spend % is more than 20 points ahead of timeline %
          if (spentPct > timelinePct + 20 && spentPct > 30) {
            alerts.push({
              category: cat.label,
              spentPct: Math.round(spentPct),
              timelinePct: Math.round(timelinePct),
              message: `${cat.label} budget is ${Math.round(spentPct)}% consumed but only ${Math.round(timelinePct)}% of the project timeline has passed.`,
            })
          }
        }

        return alerts.length > 0 ? (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.category} className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        ) : null
      })()}

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as ExpenseCategory | 'all')}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat.key} value={cat.key}>{cat.label}</option>
            ))}
          </select>
          <span className="text-sm text-muted-foreground">
            {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''}
          </span>
        </div>
        {can('canManageBudgets') && (
          <Button size="sm" onClick={openNew} className="gap-1.5">
            <Plus className="h-4 w-4" /> Record Expense
          </Button>
        )}
      </div>

      {/* ── Expense list ── */}
      {filteredExpenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses recorded"
          description="Record project expenses to track budget consumption against travel, subcontracting, and other cost categories."
        />
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2.5 text-left font-medium">Date</th>
                <th className="px-4 py-2.5 text-left font-medium">Description</th>
                <th className="px-4 py-2.5 text-left font-medium">Category</th>
                <th className="px-4 py-2.5 text-left font-medium">Vendor</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                {can('canManageBudgets') && (
                  <th className="px-4 py-2.5 text-center font-medium w-20">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((exp) => {
                const catMeta = EXPENSE_CATEGORIES.find((c) => c.key === exp.category)
                return (
                  <tr
                    key={exp.id}
                    className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                    onClick={() => can('canManageBudgets') && openEdit(exp)}
                  >
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground whitespace-nowrap">
                      {formatDate(exp.expense_date)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div>
                        <span className="font-medium">{exp.description}</span>
                        {exp.reference && (
                          <span className="ml-2 text-xs text-muted-foreground">Ref: {exp.reference}</span>
                        )}
                      </div>
                      {exp.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{exp.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-muted">
                        {catMeta?.label ?? exp.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{exp.vendor ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                      {formatCurrency(exp.amount)}
                    </td>
                    {can('canManageBudgets') && (
                      <td className="px-4 py-2.5 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTarget(exp)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted/50 font-semibold">
                <td colSpan={4} className="px-4 py-2.5 text-right">Total</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatCurrency(filteredExpenses.reduce((sum, e) => sum + e.amount, 0))}
                </td>
                {can('canManageBudgets') && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Add/Edit dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'Edit Expense' : 'Record Expense'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat.key} value={cat.key}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description *</Label>
              <Input
                placeholder="e.g. Flight to Brussels for consortium meeting"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Vendor / Payee</Label>
                <Input
                  placeholder="e.g. Lufthansa, Hotel Berlin"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Reference / Invoice #</Label>
                <Input
                  placeholder="e.g. INV-2026-001"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Person</Label>
                <select
                  value={personId}
                  onChange={(e) => setPersonId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">— None —</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Additional details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Budget context */}
            {(() => {
              const budget = getBudgetForCategory(project, category)
              const spent = getTotalForCategory(category)
              const newAmount = Number(amount) || 0
              const editOffset = editingExpense?.category === category ? editingExpense.amount : 0
              const afterSave = spent - editOffset + newAmount
              const remaining = budget - afterSave
              return budget > 0 ? (
                <div className={cn(
                  'rounded-lg p-3 text-xs',
                  remaining >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800',
                )}>
                  <div className="flex justify-between">
                    <span>Budget for {EXPENSE_CATEGORIES.find((c) => c.key === category)?.label}:</span>
                    <span className="font-medium tabular-nums">{formatCurrency(budget)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>After this expense:</span>
                    <span className="font-semibold tabular-nums">
                      {remaining >= 0 ? `${formatCurrency(remaining)} remaining` : `${formatCurrency(Math.abs(remaining))} over budget`}
                    </span>
                  </div>
                </div>
              ) : null
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !description.trim() || !amount || !expenseDate}>
              {saving ? 'Saving...' : editingExpense ? 'Update' : 'Record Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Expense"
        message={`Delete "${deleteTarget?.description}" (${deleteTarget ? formatCurrency(deleteTarget.amount) : ''})?`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        loading={deleting}
        destructive
      />
    </div>
  )
}
