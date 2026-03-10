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
import { Plus, Pencil, Trash2, Save, X, FileText, Target } from 'lucide-react'
import type { Deliverable, Milestone, WorkPackage, Project } from '@/types'

interface Props {
  project: Project
  workPackages: WorkPackage[]
  projectMonthLabel: (m: number) => string
  projectMonthCount: number
}

export function DeliverablesTab({ project, workPackages, projectMonthLabel, projectMonthCount }: Props) {
  const { orgId, can } = useAuthStore()

  // Deliverables state
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [loadingDel, setLoadingDel] = useState(true)
  const [editingDelId, setEditingDelId] = useState<string | null>(null)
  const [deleteDelTarget, setDeleteDelTarget] = useState<Deliverable | null>(null)
  const [deletingDel, setDeletingDel] = useState(false)

  // Milestones state
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loadingMs, setLoadingMs] = useState(true)
  const [editingMsId, setEditingMsId] = useState<string | null>(null)
  const [deleteMsTarget, setDeleteMsTarget] = useState<Milestone | null>(null)
  const [deletingMs, setDeletingMs] = useState(false)

  // Add deliverable form
  const [showAddDel, setShowAddDel] = useState(false)
  const [addDel, setAddDel] = useState({ number: '', title: '', description: '', wp_id: '', due_month: 1 })
  const [savingDel, setSavingDel] = useState(false)

  // Add milestone form
  const [showAddMs, setShowAddMs] = useState(false)
  const [addMs, setAddMs] = useState({ number: '', title: '', description: '', wp_id: '', due_month: 1, verification_means: '' })
  const [savingMs, setSavingMs] = useState(false)

  // Edit fields
  const [editDel, setEditDel] = useState<Partial<Deliverable>>({})
  const [editMs, setEditMs] = useState<Partial<Milestone>>({})
  const [editSaving, setEditSaving] = useState(false)

  // Helper: get allowed month range for a given WP id
  const getWpMonthRange = useCallback((wpId: string | null): { min: number; max: number } => {
    if (!wpId) return { min: 1, max: projectMonthCount || 1 }
    const wp = workPackages.find(w => w.id === wpId)
    if (!wp) return { min: 1, max: projectMonthCount || 1 }
    return { min: wp.start_month ?? 1, max: wp.end_month ?? (projectMonthCount || 1) }
  }, [workPackages, projectMonthCount])

  // Month options builder for a given WP
  const monthOptions = useCallback((wpId: string | null) => {
    const { min, max } = getWpMonthRange(wpId)
    const opts: number[] = []
    for (let m = min; m <= max; m++) opts.push(m)
    return opts
  }, [getWpMonthRange])

  // When WP changes in add forms, clamp due_month
  const handleDelWpChange = (wpId: string) => {
    const { min, max } = getWpMonthRange(wpId || null)
    setAddDel(p => ({ ...p, wp_id: wpId, due_month: Math.max(min, Math.min(p.due_month, max)) }))
  }

  const handleMsWpChange = (wpId: string) => {
    const { min, max } = getWpMonthRange(wpId || null)
    setAddMs(p => ({ ...p, wp_id: wpId, due_month: Math.max(min, Math.min(p.due_month, max)) }))
  }

  const handleEditDelWpChange = (wpId: string) => {
    const { min, max } = getWpMonthRange(wpId || null)
    setEditDel(p => ({ ...p, work_package_id: wpId || null, due_month: Math.max(min, Math.min(p.due_month ?? min, max)) }))
  }

  const handleEditMsWpChange = (wpId: string) => {
    const { min, max } = getWpMonthRange(wpId || null)
    setEditMs(p => ({ ...p, work_package_id: wpId || null, due_month: Math.max(min, Math.min(p.due_month ?? min, max)) }))
  }

  const loadDeliverables = useCallback(async () => {
    setLoadingDel(true)
    try {
      const data = await deliverablesService.listDeliverables(project.id)
      setDeliverables(data)
    } catch {
      setDeliverables([])
    } finally {
      setLoadingDel(false)
    }
  }, [project.id])

  const loadMilestones = useCallback(async () => {
    setLoadingMs(true)
    try {
      const data = await deliverablesService.listMilestones(project.id)
      setMilestones(data)
    } catch {
      setMilestones([])
    } finally {
      setLoadingMs(false)
    }
  }, [project.id])

  useEffect(() => {
    loadDeliverables()
    loadMilestones()
  }, [loadDeliverables, loadMilestones])

  // ── Deliverable handlers ──────────────────────────────────────

  const handleAddDeliverable = async () => {
    if (!orgId || !addDel.number.trim() || !addDel.title.trim()) return
    setSavingDel(true)
    try {
      await deliverablesService.createDeliverable({
        org_id: orgId,
        project_id: project.id,
        work_package_id: addDel.wp_id || null,
        number: addDel.number.trim(),
        title: addDel.title.trim(),
        description: addDel.description.trim() || null,
        lead_person_id: null,
        due_month: addDel.due_month,
      })
      toast({ title: 'Added', description: `Deliverable ${addDel.number} created.` })
      setAddDel({ number: '', title: '', description: '', wp_id: '', due_month: 1 })
      setShowAddDel(false)
      loadDeliverables()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to create deliverable', variant: 'destructive' })
    } finally {
      setSavingDel(false)
    }
  }

  const startEditDel = (d: Deliverable) => {
    setEditingDelId(d.id)
    setEditDel({ number: d.number, title: d.title, description: d.description, work_package_id: d.work_package_id, due_month: d.due_month })
  }

  const handleSaveEditDel = async () => {
    if (!editingDelId) return
    setEditSaving(true)
    try {
      await deliverablesService.updateDeliverable(editingDelId, {
        number: editDel.number,
        title: editDel.title,
        description: editDel.description || null,
        work_package_id: editDel.work_package_id || null,
        due_month: editDel.due_month,
      })
      toast({ title: 'Updated', description: 'Deliverable updated.' })
      setEditingDelId(null)
      loadDeliverables()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to update', variant: 'destructive' })
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeleteDel = async () => {
    if (!deleteDelTarget) return
    setDeletingDel(true)
    try {
      await deliverablesService.removeDeliverable(deleteDelTarget.id)
      toast({ title: 'Deleted', description: `Deliverable ${deleteDelTarget.number} removed.` })
      setDeleteDelTarget(null)
      loadDeliverables()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete', variant: 'destructive' })
    } finally {
      setDeletingDel(false)
    }
  }

  // ── Milestone handlers ────────────────────────────────────────

  const handleAddMilestone = async () => {
    if (!orgId || !addMs.number.trim() || !addMs.title.trim()) return
    setSavingMs(true)
    try {
      await deliverablesService.createMilestone({
        org_id: orgId,
        project_id: project.id,
        work_package_id: addMs.wp_id || null,
        number: addMs.number.trim(),
        title: addMs.title.trim(),
        description: addMs.description.trim() || null,
        due_month: addMs.due_month,
        verification_means: addMs.verification_means.trim() || null,
      })
      toast({ title: 'Added', description: `Milestone ${addMs.number} created.` })
      setAddMs({ number: '', title: '', description: '', wp_id: '', due_month: 1, verification_means: '' })
      setShowAddMs(false)
      loadMilestones()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to create milestone', variant: 'destructive' })
    } finally {
      setSavingMs(false)
    }
  }

  const startEditMs = (m: Milestone) => {
    setEditingMsId(m.id)
    setEditMs({ number: m.number, title: m.title, description: m.description, work_package_id: m.work_package_id, due_month: m.due_month, verification_means: m.verification_means })
  }

  const handleSaveEditMs = async () => {
    if (!editingMsId) return
    setEditSaving(true)
    try {
      await deliverablesService.updateMilestone(editingMsId, {
        number: editMs.number,
        title: editMs.title,
        description: editMs.description || null,
        work_package_id: editMs.work_package_id || null,
        due_month: editMs.due_month,
        verification_means: editMs.verification_means || null,
      })
      toast({ title: 'Updated', description: 'Milestone updated.' })
      setEditingMsId(null)
      loadMilestones()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to update', variant: 'destructive' })
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeleteMs = async () => {
    if (!deleteMsTarget) return
    setDeletingMs(true)
    try {
      await deliverablesService.removeMilestone(deleteMsTarget.id)
      toast({ title: 'Deleted', description: `Milestone ${deleteMsTarget.number} removed.` })
      setDeleteMsTarget(null)
      loadMilestones()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete', variant: 'destructive' })
    } finally {
      setDeletingMs(false)
    }
  }

  const wpName = (wpId: string | null) => {
    if (!wpId) return '—'
    const wp = workPackages.find(w => w.id === wpId)
    return wp ? `WP${wp.number ?? ''} ${wp.name}` : '—'
  }

  const delTotal = deliverables.length
  const msTotal = milestones.length

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Deliverables</div>
          <div className="text-xl font-bold tabular-nums mt-0.5">{delTotal}</div>
          <div className="text-[11px] text-muted-foreground">defined for this project</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Milestones</div>
          <div className="text-xl font-bold tabular-nums mt-0.5">{msTotal}</div>
          <div className="text-[11px] text-muted-foreground">defined for this project</div>
        </div>
      </div>

      {/* Deliverables table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Deliverables</CardTitle>
            </div>
            {can('canManageProjects') && (
              <Button size="sm" onClick={() => setShowAddDel(v => !v)}>
                <Plus className="mr-1 h-4 w-4" /> Add Deliverable
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingDel ? (
            <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
          ) : (
            <>
              {deliverables.length > 0 && (
                <div className="rounded-lg border mb-4 overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium w-16">#</th>
                        <th className="px-3 py-2 text-left font-medium">Title</th>
                        <th className="px-3 py-2 text-left font-medium">Work Package</th>
                        <th className="px-3 py-2 text-left font-medium">Due</th>
                        {can('canManageProjects') && <th className="px-3 py-2 text-right font-medium">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {deliverables.map(d => {
                        const isEditing = editingDelId === d.id
                        const editMonths = monthOptions(isEditing ? (editDel.work_package_id ?? null) : null)
                        return (
                          <tr key={d.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-3 py-2 text-xs font-semibold tabular-nums">
                              {isEditing ? (
                                <Input value={editDel.number ?? ''} onChange={e => setEditDel(p => ({ ...p, number: e.target.value }))} className="h-7 w-16 text-xs" />
                              ) : d.number}
                            </td>
                            <td className="px-3 py-2">
                              {isEditing ? (
                                <div className="space-y-1">
                                  <Input value={editDel.title ?? ''} onChange={e => setEditDel(p => ({ ...p, title: e.target.value }))} className="h-7 text-xs" placeholder="Title" />
                                  <Input value={editDel.description ?? ''} onChange={e => setEditDel(p => ({ ...p, description: e.target.value }))} className="h-7 text-xs" placeholder="Description" />
                                </div>
                              ) : (
                                <>
                                  <div className="font-medium">{d.title}</div>
                                  {d.description && <div className="text-xs text-muted-foreground truncate max-w-[250px]">{d.description}</div>}
                                </>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {isEditing ? (
                                <select
                                  value={editDel.work_package_id ?? ''}
                                  onChange={e => handleEditDelWpChange(e.target.value)}
                                  className="h-7 rounded border border-input bg-background px-1 text-xs"
                                >
                                  <option value="">None</option>
                                  {workPackages.map(wp => (
                                    <option key={wp.id} value={wp.id}>WP{wp.number ?? ''} {wp.name}</option>
                                  ))}
                                </select>
                              ) : wpName(d.work_package_id)}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {isEditing ? (
                                <select
                                  value={editDel.due_month ?? 1}
                                  onChange={e => setEditDel(p => ({ ...p, due_month: Number(e.target.value) }))}
                                  className="h-7 rounded border border-input bg-background px-1 text-xs"
                                >
                                  {editMonths.map(m => (
                                    <option key={m} value={m}>{projectMonthLabel(m)}</option>
                                  ))}
                                </select>
                              ) : (
                                d.due_month ? projectMonthLabel(d.due_month) : '—'
                              )}
                            </td>
                            {can('canManageProjects') && (
                              <td className="px-3 py-2 text-right">
                                <div className="flex justify-end gap-1">
                                  {isEditing ? (
                                    <>
                                      <Button variant="ghost" size="sm" onClick={handleSaveEditDel} disabled={editSaving} className="h-7 text-xs">
                                        <Save className="h-3 w-3 mr-1" />{editSaving ? '...' : 'Save'}
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={() => setEditingDelId(null)} className="h-7 text-xs"><X className="h-3 w-3" /></Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditDel(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteDelTarget(d)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
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

              {deliverables.length === 0 && !showAddDel && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No deliverables defined yet. Click "Add Deliverable" to get started.
                </div>
              )}

              {/* Add form */}
              {showAddDel && can('canManageProjects') && (
                <div className="space-y-3 rounded-lg border p-4 bg-muted/10">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Deliverable</div>
                  <div className="flex gap-2 items-end flex-wrap">
                    <div className="space-y-1">
                      <Label className="text-xs">Number *</Label>
                      <Input value={addDel.number} onChange={e => setAddDel(p => ({ ...p, number: e.target.value }))} placeholder="D1.1" className="w-20" />
                    </div>
                    <div className="space-y-1 flex-1 min-w-[150px]">
                      <Label className="text-xs">Title *</Label>
                      <Input value={addDel.title} onChange={e => setAddDel(p => ({ ...p, title: e.target.value }))} placeholder="Deliverable title" />
                    </div>
                    <div className="space-y-1 flex-1 min-w-[120px]">
                      <Label className="text-xs">Description</Label>
                      <Input value={addDel.description} onChange={e => setAddDel(p => ({ ...p, description: e.target.value }))} placeholder="Optional" />
                    </div>
                  </div>
                  <div className="flex gap-2 items-end flex-wrap">
                    <div className="space-y-1">
                      <Label className="text-xs">Work Package</Label>
                      <select
                        value={addDel.wp_id}
                        onChange={e => handleDelWpChange(e.target.value)}
                        className="flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
                      >
                        <option value="">None</option>
                        {workPackages.map(wp => (
                          <option key={wp.id} value={wp.id}>WP{wp.number ?? ''} {wp.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Due Month</Label>
                      <select
                        value={addDel.due_month}
                        onChange={e => setAddDel(p => ({ ...p, due_month: Number(e.target.value) }))}
                        className="flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
                      >
                        {monthOptions(addDel.wp_id || null).map(m => (
                          <option key={m} value={m}>{projectMonthLabel(m)}</option>
                        ))}
                      </select>
                    </div>
                    <Button onClick={handleAddDeliverable} disabled={savingDel || !addDel.number.trim() || !addDel.title.trim()}>
                      <Plus className="mr-1 h-4 w-4" /> {savingDel ? 'Adding...' : 'Add'}
                    </Button>
                  </div>
                  {addDel.wp_id && (
                    <div className="text-[11px] text-muted-foreground">
                      Due month restricted to WP range: {projectMonthLabel(getWpMonthRange(addDel.wp_id).min)} – {projectMonthLabel(getWpMonthRange(addDel.wp_id).max)}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Milestones table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Milestones</CardTitle>
            </div>
            {can('canManageProjects') && (
              <Button size="sm" onClick={() => setShowAddMs(v => !v)}>
                <Plus className="mr-1 h-4 w-4" /> Add Milestone
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingMs ? (
            <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
          ) : (
            <>
              {milestones.length > 0 && (
                <div className="rounded-lg border mb-4 overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium w-16">#</th>
                        <th className="px-3 py-2 text-left font-medium">Title</th>
                        <th className="px-3 py-2 text-left font-medium">Work Package</th>
                        <th className="px-3 py-2 text-left font-medium">Due</th>
                        <th className="px-3 py-2 text-left font-medium">Verification</th>
                        {can('canManageProjects') && <th className="px-3 py-2 text-right font-medium">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {milestones.map(m => {
                        const isEditing = editingMsId === m.id
                        const editMonths = monthOptions(isEditing ? (editMs.work_package_id ?? null) : null)
                        return (
                          <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-3 py-2 text-xs font-semibold tabular-nums">
                              {isEditing ? (
                                <Input value={editMs.number ?? ''} onChange={e => setEditMs(p => ({ ...p, number: e.target.value }))} className="h-7 w-16 text-xs" />
                              ) : m.number}
                            </td>
                            <td className="px-3 py-2">
                              {isEditing ? (
                                <div className="space-y-1">
                                  <Input value={editMs.title ?? ''} onChange={e => setEditMs(p => ({ ...p, title: e.target.value }))} className="h-7 text-xs" placeholder="Title" />
                                  <Input value={editMs.description ?? ''} onChange={e => setEditMs(p => ({ ...p, description: e.target.value }))} className="h-7 text-xs" placeholder="Description" />
                                </div>
                              ) : (
                                <>
                                  <div className="font-medium">{m.title}</div>
                                  {m.description && <div className="text-xs text-muted-foreground truncate max-w-[250px]">{m.description}</div>}
                                </>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {isEditing ? (
                                <select
                                  value={editMs.work_package_id ?? ''}
                                  onChange={e => handleEditMsWpChange(e.target.value)}
                                  className="h-7 rounded border border-input bg-background px-1 text-xs"
                                >
                                  <option value="">None</option>
                                  {workPackages.map(wp => (
                                    <option key={wp.id} value={wp.id}>WP{wp.number ?? ''} {wp.name}</option>
                                  ))}
                                </select>
                              ) : wpName(m.work_package_id)}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {isEditing ? (
                                <select
                                  value={editMs.due_month ?? 1}
                                  onChange={e => setEditMs(p => ({ ...p, due_month: Number(e.target.value) }))}
                                  className="h-7 rounded border border-input bg-background px-1 text-xs"
                                >
                                  {editMonths.map(mo => (
                                    <option key={mo} value={mo}>{projectMonthLabel(mo)}</option>
                                  ))}
                                </select>
                              ) : (
                                m.due_month ? projectMonthLabel(m.due_month) : '—'
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {isEditing ? (
                                <Input value={editMs.verification_means ?? ''} onChange={e => setEditMs(p => ({ ...p, verification_means: e.target.value }))} className="h-7 text-xs" placeholder="Means of verification" />
                              ) : (
                                m.verification_means || '—'
                              )}
                            </td>
                            {can('canManageProjects') && (
                              <td className="px-3 py-2 text-right">
                                <div className="flex justify-end gap-1">
                                  {isEditing ? (
                                    <>
                                      <Button variant="ghost" size="sm" onClick={handleSaveEditMs} disabled={editSaving} className="h-7 text-xs">
                                        <Save className="h-3 w-3 mr-1" />{editSaving ? '...' : 'Save'}
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={() => setEditingMsId(null)} className="h-7 text-xs"><X className="h-3 w-3" /></Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditMs(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteMsTarget(m)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
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

              {milestones.length === 0 && !showAddMs && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No milestones defined yet. Click "Add Milestone" to get started.
                </div>
              )}

              {/* Add milestone form */}
              {showAddMs && can('canManageProjects') && (
                <div className="space-y-3 rounded-lg border p-4 bg-muted/10">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Milestone</div>
                  <div className="flex gap-2 items-end flex-wrap">
                    <div className="space-y-1">
                      <Label className="text-xs">Number *</Label>
                      <Input value={addMs.number} onChange={e => setAddMs(p => ({ ...p, number: e.target.value }))} placeholder="MS1" className="w-20" />
                    </div>
                    <div className="space-y-1 flex-1 min-w-[150px]">
                      <Label className="text-xs">Title *</Label>
                      <Input value={addMs.title} onChange={e => setAddMs(p => ({ ...p, title: e.target.value }))} placeholder="Milestone title" />
                    </div>
                    <div className="space-y-1 flex-1 min-w-[120px]">
                      <Label className="text-xs">Verification Means</Label>
                      <Input value={addMs.verification_means} onChange={e => setAddMs(p => ({ ...p, verification_means: e.target.value }))} placeholder="e.g. Report submitted" />
                    </div>
                  </div>
                  <div className="flex gap-2 items-end flex-wrap">
                    <div className="space-y-1">
                      <Label className="text-xs">Work Package</Label>
                      <select
                        value={addMs.wp_id}
                        onChange={e => handleMsWpChange(e.target.value)}
                        className="flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
                      >
                        <option value="">None</option>
                        {workPackages.map(wp => (
                          <option key={wp.id} value={wp.id}>WP{wp.number ?? ''} {wp.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Due Month</Label>
                      <select
                        value={addMs.due_month}
                        onChange={e => setAddMs(p => ({ ...p, due_month: Number(e.target.value) }))}
                        className="flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
                      >
                        {monthOptions(addMs.wp_id || null).map(m => (
                          <option key={m} value={m}>{projectMonthLabel(m)}</option>
                        ))}
                      </select>
                    </div>
                    <Button onClick={handleAddMilestone} disabled={savingMs || !addMs.number.trim() || !addMs.title.trim()}>
                      <Plus className="mr-1 h-4 w-4" /> {savingMs ? 'Adding...' : 'Add'}
                    </Button>
                  </div>
                  {addMs.wp_id && (
                    <div className="text-[11px] text-muted-foreground">
                      Due month restricted to WP range: {projectMonthLabel(getWpMonthRange(addMs.wp_id).min)} – {projectMonthLabel(getWpMonthRange(addMs.wp_id).max)}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        open={!!deleteDelTarget}
        onOpenChange={(open) => !open && setDeleteDelTarget(null)}
        title="Delete Deliverable"
        message={`Are you sure you want to delete deliverable "${deleteDelTarget?.number} ${deleteDelTarget?.title}"?`}
        confirmLabel="Delete"
        destructive
        loading={deletingDel}
        onConfirm={handleDeleteDel}
      />

      <ConfirmModal
        open={!!deleteMsTarget}
        onOpenChange={(open) => !open && setDeleteMsTarget(null)}
        title="Delete Milestone"
        message={`Are you sure you want to delete milestone "${deleteMsTarget?.number} ${deleteMsTarget?.title}"?`}
        confirmLabel="Delete"
        destructive
        loading={deletingMs}
        onConfirm={handleDeleteMs}
      />
    </div>
  )
}
