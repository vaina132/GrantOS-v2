import { useState, useEffect, useCallback } from 'react'
import { deliverablesService } from '@/services/deliverablesService'
import { useAuthStore } from '@/stores/authStore'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { Plus, Pencil, Trash2, Save, X, ClipboardList } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { ReportingPeriod, Project } from '@/types'

interface Props {
  project: Project
  projectMonthLabel: (m: number) => string
  projectMonthCount: number
}

export function ReportingPeriodsTab({ project, projectMonthLabel, projectMonthCount }: Props) {
  const { orgId, can } = useAuthStore()

  const [periods, setPeriods] = useState<ReportingPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ReportingPeriod | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Add form
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({
    period_number: 1,
    start_month: 1,
    end_month: 18,
    technical_report_due: '',
    financial_report_due: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  // Edit fields
  const [editForm, setEditForm] = useState<Partial<ReportingPeriod & { technical_report_due_str: string; financial_report_due_str: string }>>({})
  const [editSaving, setEditSaving] = useState(false)

  const loadPeriods = useCallback(async () => {
    setLoading(true)
    try {
      const data = await deliverablesService.listReportingPeriods(project.id)
      setPeriods(data)
    } catch {
      setPeriods([])
    } finally {
      setLoading(false)
    }
  }, [project.id])

  useEffect(() => {
    loadPeriods()
  }, [loadPeriods])

  // Auto-suggest next period number
  useEffect(() => {
    if (periods.length > 0) {
      const maxNum = Math.max(...periods.map(p => p.period_number))
      const lastPeriod = periods.find(p => p.period_number === maxNum)
      setAddForm(prev => ({
        ...prev,
        period_number: maxNum + 1,
        start_month: lastPeriod ? lastPeriod.end_month + 1 : 1,
        end_month: lastPeriod ? Math.min(lastPeriod.end_month + 18, projectMonthCount) : Math.min(18, projectMonthCount),
      }))
    }
  }, [periods, projectMonthCount])

  const handleAdd = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      await deliverablesService.createReportingPeriod({
        org_id: orgId,
        project_id: project.id,
        period_number: addForm.period_number,
        start_month: addForm.start_month,
        end_month: addForm.end_month,
        technical_report_due: addForm.technical_report_due || null,
        financial_report_due: addForm.financial_report_due || null,
        notes: addForm.notes.trim() || null,
      })
      toast({ title: 'Added', description: `Reporting Period ${addForm.period_number} created.` })
      setShowAdd(false)
      loadPeriods()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to create', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (rp: ReportingPeriod) => {
    setEditingId(rp.id)
    setEditForm({
      period_number: rp.period_number,
      start_month: rp.start_month,
      end_month: rp.end_month,
      technical_report_due: rp.technical_report_due,
      financial_report_due: rp.financial_report_due,
      notes: rp.notes,
      technical_report_due_str: rp.technical_report_due ?? '',
      financial_report_due_str: rp.financial_report_due ?? '',
    })
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    setEditSaving(true)
    try {
      await deliverablesService.updateReportingPeriod(editingId, {
        period_number: editForm.period_number,
        start_month: editForm.start_month,
        end_month: editForm.end_month,
        technical_report_due: editForm.technical_report_due_str || null,
        financial_report_due: editForm.financial_report_due_str || null,
        notes: editForm.notes || null,
      })
      toast({ title: 'Updated', description: 'Reporting period updated.' })
      setEditingId(null)
      loadPeriods()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to update', variant: 'destructive' })
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deliverablesService.removeReportingPeriod(deleteTarget.id)
      toast({ title: 'Deleted', description: `Reporting Period ${deleteTarget.period_number} removed.` })
      setDeleteTarget(null)
      loadPeriods()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Periods</div>
          <div className="text-xl font-bold tabular-nums mt-0.5">{periods.length}</div>
          <div className="text-[11px] text-muted-foreground">reporting periods defined</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Project Duration</div>
          <div className="text-xl font-bold tabular-nums mt-0.5">{projectMonthCount}</div>
          <div className="text-[11px] text-muted-foreground">months total</div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Reporting Periods</CardTitle>
            </div>
            {can('canManageProjects') && (
              <Button size="sm" onClick={() => setShowAdd(v => !v)}>
                <Plus className="mr-1 h-4 w-4" /> Add Period
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
          ) : (
            <>
              {periods.length > 0 && (
                <div className="rounded-lg border mb-4 overflow-x-auto">
                  <table className="w-full text-sm min-w-[800px]">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium w-12">RP</th>
                        <th className="px-3 py-2 text-left font-medium">Period</th>
                        <th className="px-3 py-2 text-left font-medium">Technical Report Due</th>
                        <th className="px-3 py-2 text-left font-medium">Financial Report Due</th>
                        <th className="px-3 py-2 text-left font-medium">Notes</th>
                        {can('canManageProjects') && <th className="px-3 py-2 text-right font-medium">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map(rp => {
                        const isEditing = editingId === rp.id
                        return (
                          <tr key={rp.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-3 py-2 text-xs font-semibold tabular-nums">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  min={1}
                                  value={editForm.period_number ?? ''}
                                  onChange={e => setEditForm(p => ({ ...p, period_number: Number(e.target.value) }))}
                                  className="h-7 w-14 text-xs"
                                />
                              ) : rp.period_number}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {isEditing ? (
                                <div className="flex gap-1 items-center">
                                  <select
                                    value={editForm.start_month ?? 1}
                                    onChange={e => setEditForm(p => ({ ...p, start_month: Number(e.target.value) }))}
                                    className="h-7 rounded border border-input bg-background px-1 text-xs"
                                  >
                                    {Array.from({ length: projectMonthCount || 1 }, (_, i) => i + 1).map(m => (
                                      <option key={m} value={m}>{projectMonthLabel(m)}</option>
                                    ))}
                                  </select>
                                  <span className="text-muted-foreground">–</span>
                                  <select
                                    value={editForm.end_month ?? 18}
                                    onChange={e => setEditForm(p => ({ ...p, end_month: Number(e.target.value) }))}
                                    className="h-7 rounded border border-input bg-background px-1 text-xs"
                                  >
                                    {Array.from({ length: projectMonthCount || 1 }, (_, i) => i + 1).map(m => (
                                      <option key={m} value={m}>{projectMonthLabel(m)}</option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <span>{projectMonthLabel(rp.start_month)} – {projectMonthLabel(rp.end_month)}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {isEditing ? (
                                <Input
                                  type="date"
                                  value={editForm.technical_report_due_str ?? ''}
                                  onChange={e => setEditForm(p => ({ ...p, technical_report_due_str: e.target.value }))}
                                  className="h-7 text-xs w-[130px]"
                                />
                              ) : (
                                rp.technical_report_due ? formatDate(rp.technical_report_due) : '—'
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {isEditing ? (
                                <Input
                                  type="date"
                                  value={editForm.financial_report_due_str ?? ''}
                                  onChange={e => setEditForm(p => ({ ...p, financial_report_due_str: e.target.value }))}
                                  className="h-7 text-xs w-[130px]"
                                />
                              ) : (
                                rp.financial_report_due ? formatDate(rp.financial_report_due) : '—'
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground max-w-[150px] truncate">
                              {isEditing ? (
                                <Input
                                  value={editForm.notes ?? ''}
                                  onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                                  className="h-7 text-xs"
                                  placeholder="Notes"
                                />
                              ) : (rp.notes || '—')}
                            </td>
                            {can('canManageProjects') && (
                              <td className="px-3 py-2 text-right">
                                <div className="flex justify-end gap-1">
                                  {isEditing ? (
                                    <>
                                      <Button variant="ghost" size="sm" onClick={handleSaveEdit} disabled={editSaving} className="h-7 text-xs">
                                        <Save className="h-3 w-3 mr-1" />{editSaving ? '...' : 'Save'}
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="h-7 text-xs"><X className="h-3 w-3" /></Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(rp)}><Pencil className="h-3.5 w-3.5" /></Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(rp)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {periods.length === 0 && !showAdd && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No reporting periods defined yet. Click "Add Period" to get started.
                </div>
              )}

              {/* Add form */}
              {showAdd && can('canManageProjects') && (
                <div className="space-y-3 rounded-lg border p-4 bg-muted/10">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Reporting Period</div>
                  <div className="flex gap-2 items-end flex-wrap">
                    <div className="space-y-1">
                      <Label className="text-xs">Period # *</Label>
                      <Input
                        type="number"
                        min={1}
                        value={addForm.period_number}
                        onChange={e => setAddForm(p => ({ ...p, period_number: Number(e.target.value) }))}
                        className="w-16"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Start Month</Label>
                      <select
                        value={addForm.start_month}
                        onChange={e => setAddForm(p => ({ ...p, start_month: Number(e.target.value) }))}
                        className="flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
                      >
                        {Array.from({ length: projectMonthCount || 1 }, (_, i) => i + 1).map(m => (
                          <option key={m} value={m}>{projectMonthLabel(m)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End Month</Label>
                      <select
                        value={addForm.end_month}
                        onChange={e => setAddForm(p => ({ ...p, end_month: Number(e.target.value) }))}
                        className="flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
                      >
                        {Array.from({ length: projectMonthCount || 1 }, (_, i) => i + 1).map(m => (
                          <option key={m} value={m}>{projectMonthLabel(m)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 items-end flex-wrap">
                    <div className="space-y-1">
                      <Label className="text-xs">Technical Report Due</Label>
                      <Input
                        type="date"
                        value={addForm.technical_report_due}
                        onChange={e => setAddForm(p => ({ ...p, technical_report_due: e.target.value }))}
                        className="w-[160px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Financial Report Due</Label>
                      <Input
                        type="date"
                        value={addForm.financial_report_due}
                        onChange={e => setAddForm(p => ({ ...p, financial_report_due: e.target.value }))}
                        className="w-[160px]"
                      />
                    </div>
                    <div className="space-y-1 flex-1 min-w-[120px]">
                      <Label className="text-xs">Notes</Label>
                      <Input
                        value={addForm.notes}
                        onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Optional notes"
                      />
                    </div>
                    <Button onClick={handleAdd} disabled={saving}>
                      <Plus className="mr-1 h-4 w-4" /> {saving ? 'Adding...' : 'Add Period'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Reporting Period"
        message={`Are you sure you want to delete Reporting Period ${deleteTarget?.period_number}?`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
