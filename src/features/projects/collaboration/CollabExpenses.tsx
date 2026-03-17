import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectExpenses } from '@/hooks/useExpenses'
import { expenseService } from '@/services/expenseService'
import { useAuthStore } from '@/stores/authStore'
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
import { Plus, Trash2, Receipt, Plane, Handshake, Package, TrendingDown } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { ExpenseCategory, ProjectExpense } from '@/types'

const EXPENSE_CATEGORIES: { key: ExpenseCategory; labelKey: string; icon: typeof Plane }[] = [
  { key: 'travel', labelKey: 'projects.travel', icon: Plane },
  { key: 'subcontracting', labelKey: 'projects.subcontracting', icon: Handshake },
  { key: 'other', labelKey: 'projects.otherDirectCosts', icon: Package },
  { key: 'indirect', labelKey: 'projects.indirectCosts', icon: TrendingDown },
]

interface Props {
  projectId: string
}

export function CollabExpenses({ projectId }: Props) {
  const { t } = useTranslation()
  const { orgId, user } = useAuthStore()
  const { expenses, isLoading, refetch, getTotalForCategory } = useProjectExpenses(projectId)
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
  const [notes, setNotes] = useState('')

  const resetForm = () => {
    setCategory('travel')
    setDescription('')
    setAmount('')
    setExpenseDate(new Date().toISOString().split('T')[0])
    setVendor('')
    setReference('')
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
    setNotes(exp.notes ?? '')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!orgId || !description.trim() || !amount || !expenseDate) return
    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount < 0) {
      toast({ title: t('expenses.invalidAmount'), variant: 'destructive' })
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
          notes: notes.trim() || null,
        })
        toast({ title: t('expenses.expenseUpdated') })
      } else {
        await expenseService.create({
          org_id: orgId,
          project_id: projectId,
          category,
          description: description.trim(),
          amount: numAmount,
          expense_date: expenseDate,
          vendor: vendor.trim() || null,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
          recorded_by: user?.id ?? null,
        })
        toast({ title: t('expenses.expenseRecorded') })
      }
      setDialogOpen(false)
      resetForm()
      refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.failedToSave')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await expenseService.remove(deleteTarget.id)
      toast({ title: t('expenses.expenseDeleted') })
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.failedToDelete')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
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
      {/* ── Category summary cards ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {EXPENSE_CATEGORIES.map((cat) => {
          const spent = getTotalForCategory(cat.key)
          const Icon = cat.icon
          return (
            <Card key={cat.key} className="relative overflow-hidden">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-xs font-medium">{t(cat.labelKey)}</span>
                </div>
                <div className="text-lg font-bold tabular-nums">{formatCurrency(spent)}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as ExpenseCategory | 'all')}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">{t('common.allCategories')}</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat.key} value={cat.key}>{t(cat.labelKey)}</option>
            ))}
          </select>
          <span className="text-sm text-muted-foreground">
            {filteredExpenses.length !== 1 ? t('expenses.expenseCountPlural', { count: filteredExpenses.length }) : t('expenses.expenseCount', { count: filteredExpenses.length })}
          </span>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="h-4 w-4" /> {t('expenses.recordExpense')}
        </Button>
      </div>

      {/* ── Expense list ── */}
      {filteredExpenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t('expenses.noExpenses')}
          description={t('expenses.noExpensesDesc')}
        />
      ) : (
        <div className="rounded-lg border overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2.5 text-left font-medium">{t('common.date')}</th>
                <th className="px-4 py-2.5 text-left font-medium">{t('common.description')}</th>
                <th className="px-4 py-2.5 text-left font-medium">{t('common.category')}</th>
                <th className="px-4 py-2.5 text-left font-medium">{t('common.vendor')}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t('common.amount')}</th>
                <th className="px-4 py-2.5 text-center font-medium w-20">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((exp) => {
                const catMeta = EXPENSE_CATEGORIES.find((c) => c.key === exp.category)
                return (
                  <tr
                    key={exp.id}
                    className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                    onClick={() => openEdit(exp)}
                  >
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground whitespace-nowrap">
                      {formatDate(exp.expense_date)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div>
                        <span className="font-medium">{exp.description}</span>
                        {exp.reference && (
                          <span className="ml-2 text-xs text-muted-foreground">{t('common.ref', { ref: exp.reference })}</span>
                        )}
                      </div>
                      {exp.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{exp.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-muted">
                        {catMeta ? t(catMeta.labelKey) : exp.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{exp.vendor ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                      {formatCurrency(exp.amount)}
                    </td>
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
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted/50 font-semibold">
                <td colSpan={4} className="px-4 py-2.5 text-right">{t('common.total')}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatCurrency(filteredExpenses.reduce((sum, e) => sum + e.amount, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Add/Edit dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingExpense ? t('expenses.editExpense') : t('expenses.recordExpense')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('common.category')} *</Label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat.key} value={cat.key}>{t(cat.labelKey)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>{t('common.date')} *</Label>
                <Input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('common.description')} *</Label>
              <Input
                placeholder={t('expenses.descriptionPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('common.amount')} *</Label>
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
                <Label>{t('expenses.vendorPayee')}</Label>
                <Input
                  placeholder={t('expenses.vendorPlaceholder')}
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('expenses.referenceInvoice')}</Label>
                <Input
                  placeholder={t('expenses.referencePlaceholder')}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('common.notes')}</Label>
                <Input
                  placeholder={t('expenses.additionalDetails')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !description.trim() || !amount || !expenseDate}>
              {saving ? t('common.saving') : editingExpense ? t('common.update') : t('expenses.recordExpense')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('expenses.deleteExpense')}
        message={t('expenses.deleteExpenseConfirm', { name: deleteTarget?.description ?? '', amount: deleteTarget ? formatCurrency(deleteTarget.amount) : '' })}
        confirmLabel={t('common.delete')}
        onConfirm={handleDelete}
        loading={deleting}
        destructive
      />
    </div>
  )
}
