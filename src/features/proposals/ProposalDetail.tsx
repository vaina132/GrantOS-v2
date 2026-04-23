import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Ban,
  SkipForward,
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Loader2,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { proposalService } from '@/services/proposalService'
import { proposalPhaseService } from '@/services/proposalPhaseService'
import { staffService } from '@/services/staffService'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type {
  Proposal,
  Person,
  ProposalPhase,
  ProposalTask,
  ProposalPhaseStatus,
  ProposalTaskStatus,
} from '@/types'

const PHASE_STATUS_META: Record<ProposalPhaseStatus, { label: string; color: string }> = {
  todo: { label: 'To do', color: 'bg-slate-100 text-slate-700' },
  in_progress: { label: 'In progress', color: 'bg-blue-100 text-blue-700' },
  done: { label: 'Done', color: 'bg-emerald-100 text-emerald-700' },
  blocked: { label: 'Blocked', color: 'bg-red-100 text-red-700' },
  skipped: { label: 'Skipped', color: 'bg-zinc-100 text-zinc-500' },
}

const TASK_STATUS_META: Record<ProposalTaskStatus, { icon: typeof Circle; color: string }> = {
  todo: { icon: Circle, color: 'text-muted-foreground' },
  in_progress: { icon: Clock, color: 'text-blue-600' },
  done: { icon: CheckCircle2, color: 'text-emerald-600' },
  blocked: { icon: Ban, color: 'text-red-600' },
}

export function ProposalDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { orgId } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [phases, setPhases] = useState<ProposalPhase[]>([])
  const [tasks, setTasks] = useState<ProposalTask[]>([])
  const [staff, setStaff] = useState<Person[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [addingTaskPhaseId, setAddingTaskPhaseId] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingPhase, setAddingPhase] = useState(false)
  const [newPhaseName, setNewPhaseName] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = async () => {
    if (!id || !orgId) return
    setLoading(true)
    try {
      const [p, list] = await Promise.all([
        proposalService.getById(id),
        (async () => {
          await proposalPhaseService.ensureSeeded(orgId, id)
          return Promise.all([
            proposalPhaseService.list(id),
            proposalPhaseService.listTasks(id),
          ])
        })(),
      ])
      const [phaseRows, taskRows] = list
      setProposal(p)
      setPhases(phaseRows)
      setTasks(taskRows)
      setExpanded(new Set(phaseRows.map(ph => ph.id)))
      staffService.list(orgId, { is_active: true }).then(setStaff).catch(() => {})
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, orgId])

  const tasksByPhase = useMemo(() => {
    const map: Record<string, ProposalTask[]> = {}
    for (const t of tasks) {
      ;(map[t.phase_id] ??= []).push(t)
    }
    return map
  }, [tasks])

  const completion = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter(t => t.status === 'done').length
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
  }, [tasks])

  const togglePhase = (phaseId: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(phaseId)) next.delete(phaseId)
      else next.add(phaseId)
      return next
    })
  }

  const cyclePhaseStatus = async (phase: ProposalPhase) => {
    const order: ProposalPhaseStatus[] = ['todo', 'in_progress', 'done', 'blocked', 'skipped']
    const nextStatus = order[(order.indexOf(phase.status) + 1) % order.length]
    setSavingId(phase.id)
    try {
      const updated = await proposalPhaseService.updatePhase(phase.id, { status: nextStatus })
      setPhases(prev => prev.map(p => (p.id === phase.id ? updated : p)))
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update',
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  const cycleTaskStatus = async (task: ProposalTask) => {
    const order: ProposalTaskStatus[] = ['todo', 'in_progress', 'done', 'blocked']
    const nextStatus = order[(order.indexOf(task.status) + 1) % order.length]
    setSavingId(task.id)
    try {
      const updated = await proposalPhaseService.updateTask(task.id, { status: nextStatus })
      setTasks(prev => prev.map(t => (t.id === task.id ? updated : t)))
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update',
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  const updatePhaseField = async (phaseId: string, patch: Partial<ProposalPhase>) => {
    setSavingId(phaseId)
    try {
      const updated = await proposalPhaseService.updatePhase(phaseId, patch)
      setPhases(prev => prev.map(p => (p.id === phaseId ? updated : p)))
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update',
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  const updateTaskField = async (taskId: string, patch: Partial<ProposalTask>) => {
    setSavingId(taskId)
    try {
      const updated = await proposalPhaseService.updateTask(taskId, patch)
      setTasks(prev => prev.map(t => (t.id === taskId ? updated : t)))
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update',
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  const addTask = async (phaseId: string) => {
    if (!orgId || !id || !newTaskTitle.trim()) return
    setSavingId(phaseId)
    try {
      const created = await proposalPhaseService.createTask(orgId, id, phaseId, {
        title: newTaskTitle.trim(),
        sort_order: (tasksByPhase[phaseId]?.length ?? 0) + 1,
      })
      setTasks(prev => [...prev, created])
      setNewTaskTitle('')
      setAddingTaskPhaseId(null)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to add task',
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  const addPhase = async () => {
    if (!orgId || !id || !newPhaseName.trim()) return
    setSavingId('new-phase')
    try {
      const lastSort = phases.length > 0 ? phases[phases.length - 1].sort_order : 0
      const created = await proposalPhaseService.createPhase(orgId, id, {
        name: newPhaseName.trim(),
        sort_order: lastSort + 1,
      })
      setPhases(prev => [...prev, created])
      setExpanded(prev => new Set([...prev, created.id]))
      setNewPhaseName('')
      setAddingPhase(false)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to add phase',
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  const removePhase = async (phaseId: string) => {
    setSavingId(phaseId)
    try {
      await proposalPhaseService.deletePhase(phaseId)
      setPhases(prev => prev.filter(p => p.id !== phaseId))
      setTasks(prev => prev.filter(t => t.phase_id !== phaseId))
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete',
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  const removeTask = async (taskId: string) => {
    setSavingId(taskId)
    try {
      await proposalPhaseService.deleteTask(taskId)
      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete',
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">{t('common.notFound')}</p>
        <Button variant="outline" className="mt-3" onClick={() => navigate('/proposals')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to proposals
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={proposal.project_name}
        description={proposal.call_identifier || proposal.funding_scheme || 'Grant proposal workspace'}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/proposals')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        }
      />

      {/* Summary card */}
      <Card>
        <CardContent className="pt-4 grid gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant="outline" className="mt-1">{proposal.status}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Submission deadline</p>
            <p className="text-sm font-medium mt-1">
              {proposal.submission_deadline
                ? new Date(proposal.submission_deadline).toLocaleDateString()
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Responsible</p>
            <p className="text-sm font-medium mt-1">{proposal.responsible_person?.full_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Checklist completion</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${completion.pct}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {completion.done}/{completion.total}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phases */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Preparation phases</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddingPhase(true)}
            disabled={addingPhase}
          >
            <Plus className="h-4 w-4 mr-1" /> Add phase
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {phases.map(phase => {
            const phaseTasks = tasksByPhase[phase.id] ?? []
            const isExpanded = expanded.has(phase.id)
            const meta = PHASE_STATUS_META[phase.status]
            const phaseSaving = savingId === phase.id
            return (
              <div key={phase.id} className="rounded-lg border bg-card">
                <div className="flex items-center gap-2 p-3">
                  <button
                    onClick={() => togglePhase(phase.id)}
                    className="p-0.5 hover:bg-muted rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{phase.name}</span>
                      <button onClick={() => cyclePhaseStatus(phase)}>
                        <Badge className={cn(meta.color, 'text-[10px] cursor-pointer')}>
                          {phaseSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : meta.label}
                        </Badge>
                      </button>
                    </div>
                    {phase.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {phase.description}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {phaseTasks.filter(t => t.status === 'done').length}/{phaseTasks.length}
                  </div>
                  <div className="flex items-center gap-1">
                    <select
                      value={phase.owner_person_id ?? ''}
                      onChange={e =>
                        updatePhaseField(phase.id, {
                          owner_person_id: e.target.value || null,
                        })
                      }
                      className="text-xs rounded border bg-background px-2 py-1 max-w-[140px]"
                    >
                      <option value="">No owner</option>
                      {staff.map(s => (
                        <option key={s.id} value={s.id}>{s.full_name}</option>
                      ))}
                    </select>
                    <Input
                      type="date"
                      value={phase.due_date ?? ''}
                      onChange={e =>
                        updatePhaseField(phase.id, { due_date: e.target.value || null })
                      }
                      className="h-7 text-xs w-[140px]"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removePhase(phase.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t bg-muted/20 px-3 py-2 space-y-1">
                    {phaseTasks.length === 0 && (
                      <p className="text-xs text-muted-foreground py-1">
                        No tasks yet in this phase.
                      </p>
                    )}
                    {phaseTasks.map(task => {
                      const tMeta = TASK_STATUS_META[task.status]
                      const Icon = tMeta.icon
                      const taskSaving = savingId === task.id
                      return (
                        <div
                          key={task.id}
                          className="flex items-center gap-2 py-1 px-2 rounded hover:bg-background"
                        >
                          <button onClick={() => cycleTaskStatus(task)}>
                            {taskSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Icon className={cn('h-4 w-4', tMeta.color)} />
                            )}
                          </button>
                          <span
                            className={cn(
                              'flex-1 text-sm',
                              task.status === 'done' && 'line-through text-muted-foreground',
                            )}
                          >
                            {task.title}
                          </span>
                          <select
                            value={task.owner_person_id ?? ''}
                            onChange={e =>
                              updateTaskField(task.id, {
                                owner_person_id: e.target.value || null,
                              })
                            }
                            className="text-xs rounded border bg-background px-2 py-0.5 max-w-[120px]"
                          >
                            <option value="">—</option>
                            {staff.map(s => (
                              <option key={s.id} value={s.id}>{s.full_name}</option>
                            ))}
                          </select>
                          <Input
                            type="date"
                            value={task.due_date ?? ''}
                            onChange={e =>
                              updateTaskField(task.id, { due_date: e.target.value || null })
                            }
                            className="h-6 text-xs w-[130px]"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeTask(task.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      )
                    })}

                    {addingTaskPhaseId === phase.id ? (
                      <div className="flex items-center gap-2 py-1 px-2">
                        <Circle className="h-4 w-4 text-muted-foreground" />
                        <Input
                          autoFocus
                          value={newTaskTitle}
                          onChange={e => setNewTaskTitle(e.target.value)}
                          placeholder="Task title"
                          className="h-7 text-sm"
                          onKeyDown={e => {
                            if (e.key === 'Enter') void addTask(phase.id)
                            if (e.key === 'Escape') {
                              setAddingTaskPhaseId(null)
                              setNewTaskTitle('')
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => addTask(phase.id)}
                          disabled={!newTaskTitle.trim()}
                        >
                          Add
                        </Button>
                      </div>
                    ) : (
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground py-1 px-2 flex items-center gap-1"
                        onClick={() => {
                          setAddingTaskPhaseId(phase.id)
                          setNewTaskTitle('')
                        }}
                      >
                        <Plus className="h-3 w-3" /> Add task
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {addingPhase && (
            <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/20">
              <Input
                autoFocus
                value={newPhaseName}
                onChange={e => setNewPhaseName(e.target.value)}
                placeholder="Phase name"
                className="h-8 text-sm"
                onKeyDown={e => {
                  if (e.key === 'Enter') void addPhase()
                  if (e.key === 'Escape') {
                    setAddingPhase(false)
                    setNewPhaseName('')
                  }
                }}
              />
              <Button size="sm" onClick={addPhase} disabled={!newPhaseName.trim()}>
                <SkipForward className="h-3 w-3 mr-1" /> Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAddingPhase(false)}>
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
