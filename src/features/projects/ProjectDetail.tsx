import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useProject, useWorkPackages } from '@/hooks/useProjects'
import { projectsService } from '@/services/projectsService'
import { allocationsService } from '@/services/allocationsService'
import { deliverablesService } from '@/services/deliverablesService'
import { useAuthStore } from '@/stores/authStore'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { ArrowLeft, Pencil, Plus, Trash2, Save, FileText, DollarSign, LayoutGrid, ListChecks, FolderOpen, Target, GanttChart as GanttIcon, ClipboardList, Calendar, Receipt } from 'lucide-react'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { DocumentList } from '@/features/documents/DocumentList'
import { DeliverablesTab } from './DeliverablesTab'
import { ReportingPeriodsTab } from './ReportingPeriodsTab'
import { BudgetConsumptionChart } from './BudgetConsumptionChart'
import { ProjectExpenses } from './ProjectExpenses'
import { ProjectGanttChart } from './ProjectGanttChart'
import { collabTaskEffortService, collabPartnerService, collabWpService, collabTaskService } from '@/services/collabProjectService'
import type { WorkPackage, PmBudget, Assignment, CollabPartner, CollabWorkPackage, CollabTask, CollabPartnerTaskEffort } from '@/types'

type DetailTab = 'general' | 'budget' | 'expenses' | 'workpackages' | 'periods' | 'deliverables' | 'reporting' | 'effort' | 'timeline' | 'documents'

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  Completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  Suspended: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  Terminated: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

const TAB_KEYS: { value: DetailTab; labelKey: string; icon: typeof FileText; permKey?: string }[] = [
  { value: 'general', labelKey: 'collaboration.tabGeneral', icon: FileText },
  { value: 'budget', labelKey: 'collaboration.tabBudget', icon: DollarSign, permKey: 'canSeeFinancialDetails' },
  { value: 'expenses', labelKey: 'projects.expenses', icon: Receipt, permKey: 'canSeeFinancialDetails' },
  { value: 'workpackages', labelKey: 'projects.tabWpsTasks', icon: LayoutGrid },
  { value: 'periods', labelKey: 'collaboration.tabPeriods', icon: Calendar },
  { value: 'deliverables', labelKey: 'collaboration.tabDelMs', icon: ListChecks },
  { value: 'reporting', labelKey: 'collaboration.tabReports', icon: ClipboardList },
  { value: 'effort', labelKey: 'projects.tabOurEffort', icon: Target },
  { value: 'timeline', labelKey: 'collaboration.tabTimeline', icon: GanttIcon },
  { value: 'documents', labelKey: 'projects.documents', icon: FolderOpen },
]

export function ProjectDetail() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { project, isLoading } = useProject(id)
  const { workPackages, isLoading: loadingWPs, refetch: refetchWPs } = useWorkPackages(id)
  const { orgId, can } = useAuthStore()
  const [detailTab, setDetailTab] = useState<DetailTab>('general')

  const [wpNumber, setWpNumber] = useState<number>(1)
  const [wpName, setWpName] = useState('')
  const [wpDesc, setWpDesc] = useState('')
  const [wpStartMonth, setWpStartMonth] = useState<number>(1)
  const [wpEndMonth, setWpEndMonth] = useState<number>(1)
  const [wpSaving, setWpSaving] = useState(false)
  const [wpDeleteTarget, setWpDeleteTarget] = useState<WorkPackage | null>(null)
  const [wpDeleting, setWpDeleting] = useState(false)
  const [editingWpId, setEditingWpId] = useState<string | null>(null)
  const [editWpNumber, setEditWpNumber] = useState<number>(1)
  const [editWpName, setEditWpName] = useState('')
  const [editWpDesc, setEditWpDesc] = useState('')
  const [editWpStartMonth, setEditWpStartMonth] = useState<number>(1)
  const [editWpEndMonth, setEditWpEndMonth] = useState<number>(1)
  const [editWpSaving, setEditWpSaving] = useState(false)

  // PM budget per year (project-level)
  const [, setPmBudgets] = useState<PmBudget[]>([])
  const [pmBudgetValues, setPmBudgetValues] = useState<Record<number, number>>({})
  const [pmBudgetSaving, setPmBudgetSaving] = useState(false)
  const [pmBudgetDirty, setPmBudgetDirty] = useState(false)

  const projectYears = useMemo(() => {
    if (!project) return []
    const startYear = new Date(project.start_date).getFullYear()
    const endYear = new Date(project.end_date).getFullYear()
    const years: number[] = []
    for (let y = startYear; y <= endYear; y++) years.push(y)
    return years
  }, [project])

  // Project duration in months and helper to convert project month → actual date
  const projectMonthCount = useMemo(() => {
    if (!project) return 0
    const s = new Date(project.start_date)
    const e = new Date(project.end_date)
    return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1
  }, [project])

  const projectMonthToDate = useCallback((m: number, isEnd: boolean): string => {
    if (!project) return ''
    const s = new Date(project.start_date)
    const targetMonth = s.getMonth() + (m - 1)
    const y = s.getFullYear() + Math.floor(targetMonth / 12)
    const mo = targetMonth % 12
    if (isEnd) {
      // last day of month
      const last = new Date(y, mo + 1, 0)
      return last.toISOString().slice(0, 10)
    }
    // first day of month
    return `${y}-${String(mo + 1).padStart(2, '0')}-01`
  }, [project])

  const projectMonthLabel = useCallback((m: number): string => {
    if (!project) return `M${m}`
    const s = new Date(project.start_date)
    const targetMonth = s.getMonth() + (m - 1)
    const y = s.getFullYear() + Math.floor(targetMonth / 12)
    const mo = targetMonth % 12
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `M${m} (${MONTHS[mo]} ${y})`
  }, [project])

  // WP PM budgets: wpId -> target PMs (total across years)
  const [wpPmBudgets, setWpPmBudgets] = useState<Record<string, number>>({})
  const [wpPmBudgetDirty, setWpPmBudgetDirty] = useState(false)
  const [wpPmBudgetSaving, setWpPmBudgetSaving] = useState(false)

  // Allocations for this project (to show allocated vs budget)
  const [projectAllocations, setProjectAllocations] = useState<Assignment[]>([])

  // KPI counts for General tab summary
  const [deliverablesCount, setDeliverablesCount] = useState(0)
  const [milestonesCount, setMilestonesCount] = useState(0)
  const [periodsCount, setPeriodsCount] = useState(0)

  // Collab effort data (for "Our Effort" tab — loaded when project has collab_project_id)
  const [collabPartners, setCollabPartners] = useState<CollabPartner[]>([])
  const [collabWps, setCollabWps] = useState<CollabWorkPackage[]>([])
  const [collabTasks, setCollabTasks] = useState<CollabTask[]>([])
  const [collabEffort, setCollabEffort] = useState<CollabPartnerTaskEffort[]>([])
  const [effortLoading, setEffortLoading] = useState(false)

  const loadPmBudgets = useCallback(async () => {
    if (!id) return
    try {
      const data = await allocationsService.listPmBudgetsByProject(id, 'actual')
      setPmBudgets(data)
      const map: Record<number, number> = {}
      const wpMap: Record<string, number> = {}
      for (const b of data) {
        if (!b.work_package_id) {
          map[b.year] = b.target_pms
        } else {
          wpMap[b.work_package_id] = (wpMap[b.work_package_id] ?? 0) + b.target_pms
        }
      }
      setPmBudgetValues(map)
      setWpPmBudgets(wpMap)
      setPmBudgetDirty(false)
      setWpPmBudgetDirty(false)
    } catch { /* ignore */ }
  }, [id])

  useEffect(() => {
    loadPmBudgets()
  }, [loadPmBudgets])

  // Load KPI counts for summary
  useEffect(() => {
    if (!id) return
    deliverablesService.listDeliverables(id).then(d => setDeliverablesCount(d.length)).catch(() => {})
    deliverablesService.listMilestones(id).then(m => setMilestonesCount(m.length)).catch(() => {})
    deliverablesService.listReportingPeriods(id).then(p => setPeriodsCount(p.length)).catch(() => {})
  }, [id])

  // Load collab effort data when project is linked to a collab project
  useEffect(() => {
    const cpId = project?.collab_project_id
    if (!cpId) return
    setEffortLoading(true)
    Promise.all([
      collabPartnerService.list(cpId),
      collabWpService.list(cpId),
      collabTaskService.listByProject(cpId),
      collabTaskEffortService.listByProject(cpId),
    ]).then(([partners, wps, tasks, effort]) => {
      setCollabPartners(partners)
      setCollabWps(wps)
      setCollabTasks(tasks)
      setCollabEffort(effort)
    }).catch(() => {}).finally(() => setEffortLoading(false))
  }, [project?.collab_project_id])

  // Group collab tasks by WP for effort table
  const collabTasksByWp = useMemo(() => {
    const map: Record<string, CollabTask[]> = {}
    for (const t of collabTasks) {
      const key = t.wp_id ?? '__none__'
      ;(map[key] ??= []).push(t)
    }
    return map
  }, [collabTasks])

  const handleSavePmBudgets = async () => {
    if (!id || !orgId) return
    setPmBudgetSaving(true)
    try {
      for (const year of projectYears) {
        const pms = pmBudgetValues[year] ?? 0
        await allocationsService.upsertPmBudget({
          org_id: orgId,
          project_id: id,
          work_package_id: null,
          year,
          target_pms: pms,
          type: 'actual',
        })
      }
      toast({ title: t('common.success'), description: t('projects.pmBudgetsUpdated') })
      setPmBudgetDirty(false)
      loadPmBudgets()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setPmBudgetSaving(false)
    }
  }

  // Load allocations for this project (all years)
  const loadAllocations = useCallback(async () => {
    if (!id) return
    try {
      const allAllocs: Assignment[] = []
      for (const y of projectYears) {
        const data = await allocationsService.listAssignmentsByProject(id, y, 'actual')
        allAllocs.push(...data)
      }
      setProjectAllocations(allAllocs)
    } catch { /* ignore */ }
  }, [id, projectYears])

  useEffect(() => {
    if (projectYears.length > 0) loadAllocations()
  }, [loadAllocations, projectYears])

  // WP allocated PMs (from assignments)
  const wpAllocatedPms = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of projectAllocations) {
      const wpKey = a.work_package_id ?? '__project__'
      map[wpKey] = (map[wpKey] ?? 0) + a.pms
    }
    return map
  }, [projectAllocations])

  // Project-level totals
  const totalProjectBudgetPm = useMemo(() => Object.values(pmBudgetValues).reduce((a, b) => a + b, 0), [pmBudgetValues])
  const totalWpBudgetPm = useMemo(() => Object.values(wpPmBudgets).reduce((a, b) => a + b, 0), [wpPmBudgets])
  const totalAllocatedPm = useMemo(() => projectAllocations.reduce((a, b) => a + b.pms, 0), [projectAllocations])

  const handleSaveWpPmBudgets = async () => {
    if (!id || !orgId) return
    setWpPmBudgetSaving(true)
    try {
      for (const wp of workPackages) {
        const pms = wpPmBudgets[wp.id] ?? 0
        await allocationsService.upsertPmBudget({
          org_id: orgId,
          project_id: id,
          work_package_id: wp.id,
          year: projectYears[0] ?? new Date().getFullYear(),
          target_pms: pms,
          type: 'actual',
        })
      }
      toast({ title: t('common.success'), description: t('projects.wpPmBudgetsUpdated') })
      setWpPmBudgetDirty(false)
      loadPmBudgets()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setWpPmBudgetSaving(false)
    }
  }

  const handleAddWP = async () => {
    if (!wpName.trim() || !id) return
    setWpSaving(true)
    try {
      await projectsService.createWorkPackage({
        org_id: orgId ?? '',
        project_id: id,
        number: wpNumber,
        name: wpName.trim(),
        description: wpDesc.trim() || null,
        lead_person_id: null,
        start_month: wpStartMonth,
        end_month: wpEndMonth,
        start_date: projectMonthToDate(wpStartMonth, false),
        end_date: projectMonthToDate(wpEndMonth, true),
      })
      setWpNumber(wpNumber + 1)
      setWpName('')
      setWpDesc('')
      setWpStartMonth(1)
      setWpEndMonth(projectMonthCount || 1)
      toast({ title: t('projects.wpAdded') })
      refetchWPs()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setWpSaving(false)
    }
  }

  const handleDeleteWP = async () => {
    if (!wpDeleteTarget) return
    setWpDeleting(true)
    try {
      await projectsService.removeWorkPackage(wpDeleteTarget.id)
      toast({ title: t('projects.wpDeleted') })
      setWpDeleteTarget(null)
      refetchWPs()
      loadPmBudgets()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setWpDeleting(false)
    }
  }

  const startEditWp = (wp: WorkPackage) => {
    setEditingWpId(wp.id)
    setEditWpNumber(wp.number ?? 1)
    setEditWpName(wp.name)
    setEditWpDesc(wp.description ?? '')
    setEditWpStartMonth(wp.start_month ?? 1)
    setEditWpEndMonth(wp.end_month ?? (projectMonthCount || 1))
  }

  const handleSaveEditWp = async () => {
    if (!editingWpId || !editWpName.trim()) return
    setEditWpSaving(true)
    try {
      await projectsService.updateWorkPackage(editingWpId, {
        number: editWpNumber,
        name: editWpName.trim(),
        description: editWpDesc.trim() || null,
        start_month: editWpStartMonth,
        end_month: editWpEndMonth,
        start_date: projectMonthToDate(editWpStartMonth, false),
        end_date: projectMonthToDate(editWpEndMonth, true),
      })
      toast({ title: t('common.success'), description: t('projects.wpUpdated') })
      setEditingWpId(null)
      refetchWPs()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setEditWpSaving(false)
    }
  }

  const durationMonths = useMemo(() => {
    if (!project) return null
    const s = new Date(project.start_date)
    const e = new Date(project.end_date)
    return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1
  }, [project])

  const visibleTabs = useMemo(() =>
    TAB_KEYS.filter(tab => !tab.permKey || can(tab.permKey as any)),
  [can])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-96" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>{t('projects.notFound')}</p>
        <Button variant="link" onClick={() => navigate('/projects')}>{t('projects.backToProjects')}</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header (Collab-style) ──────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{project.acronym}</h1>
              <Badge className={STATUS_COLORS[project.status] ?? ''} variant="secondary">
                {project.status}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">{project.title}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground mt-2">
              {project.grant_number && <span>GA {project.grant_number}</span>}
              {project.funding_schemes?.name && <span>{project.funding_schemes.name}</span>}
              {project.start_date && project.end_date && (
                <span>{formatDate(project.start_date)} → {formatDate(project.end_date)}</span>
              )}
              {durationMonths && <span>{durationMonths} {t('collaboration.months')}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {can('canManageProjects') && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${project.id}/edit`)} className="gap-2">
              <Pencil className="h-4 w-4" /> {t('common.edit')}
            </Button>
          )}
        </div>
      </div>

      {/* ── Tabs (icon-based, matching Collab style) ───────────── */}
      <Tabs value={detailTab} onValueChange={v => setDetailTab(v as DetailTab)}>
        {/* Mobile dropdown */}
        <div className="md:hidden mb-4">
          <select
            value={detailTab}
            onChange={e => setDetailTab(e.target.value as DetailTab)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {visibleTabs.map(tab => (
              <option key={tab.value} value={tab.value}>{t(tab.labelKey)}</option>
            ))}
          </select>
        </div>
        {/* Desktop scrollable tabs */}
        <TabsList className="hidden md:inline-flex w-full justify-start overflow-x-auto">
          {visibleTabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 text-xs whitespace-nowrap">
              <tab.icon className="h-3.5 w-3.5" /> {t(tab.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── General Tab ──────────────────────────────────────── */}
        <TabsContent value="general" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-5 space-y-5">
              {/* Project identity — 4-column grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t('projects.acronym')}</p>
                  <p className="font-semibold">{project.acronym}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t('common.status')}</p>
                  <Badge className={STATUS_COLORS[project.status] ?? ''} variant="secondary">
                    {project.status}
                  </Badge>
                </div>
                {project.grant_number && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{t('projects.grantNumber')}</p>
                    <p className="font-medium">{project.grant_number}</p>
                  </div>
                )}
                {project.funding_schemes?.name && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{t('projects.fundingScheme')}</p>
                    <p className="font-medium">{project.funding_schemes.name}</p>
                  </div>
                )}
                {project.start_date && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{t('common.startDate')}</p>
                    <p className="font-medium">{formatDate(project.start_date)}</p>
                  </div>
                )}
                {project.end_date && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{t('common.endDate')}</p>
                    <p className="font-medium">{formatDate(project.end_date)}</p>
                  </div>
                )}
                {durationMonths && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{t('collaboration.duration')}</p>
                    <p className="font-medium">{durationMonths} {t('collaboration.months')}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t('projects.ledByOurOrg')}</p>
                  <Badge variant={project.is_lead_organisation ? 'default' : 'secondary'}>
                    {project.is_lead_organisation ? t('common.yes') : t('common.no')}
                  </Badge>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t" />

              {/* KPI summary numbers */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                <div className="text-center">
                  <p className="text-xl font-bold">{workPackages.length}</p>
                  <p className="text-[11px] text-muted-foreground">{t('projects.workPackages')}</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">{deliverablesCount}</p>
                  <p className="text-[11px] text-muted-foreground">{t('projects.deliverables')}</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">{milestonesCount}</p>
                  <p className="text-[11px] text-muted-foreground">{t('projects.milestones')}</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">{totalProjectBudgetPm.toFixed(1)}</p>
                  <p className="text-[11px] text-muted-foreground">{t('collaboration.personMonths')}</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">{project.total_budget != null ? formatCurrency(project.total_budget) : '—'}</p>
                  <p className="text-[11px] text-muted-foreground">{t('projects.totalBudget')}</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">{periodsCount}</p>
                  <p className="text-[11px] text-muted-foreground">{t('projects.reporting')}</p>
                </div>
              </div>

              {/* Responsible person */}
              {project.responsible_person?.full_name && (
                <>
                  <div className="border-t" />
                  <div className="text-sm">
                    <p className="text-xs text-muted-foreground mb-1">{t('projects.responsiblePerson')}</p>
                    <p className="font-medium">{project.responsible_person.full_name}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Budget Tab ─────────────────────────────────────── */}
        <TabsContent value="budget" className="mt-4 space-y-6">
          <Card>
            <CardHeader><CardTitle>{t('projects.budgetBreakdown')}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t('projects.totalBudget')}</p>
                  <p className="font-semibold tabular-nums">{project.total_budget != null ? formatCurrency(project.total_budget) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t('financials.personnelBudget')}</p>
                  <p className="font-medium tabular-nums">{project.budget_personnel != null ? formatCurrency(project.budget_personnel) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t('projects.travel')}</p>
                  <p className="font-medium tabular-nums">{project.budget_travel != null ? formatCurrency(project.budget_travel) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t('projects.subcontracting')}</p>
                  <p className="font-medium tabular-nums">{project.budget_subcontracting != null ? formatCurrency(project.budget_subcontracting) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t('projects.other')}</p>
                  <p className="font-medium tabular-nums">{project.budget_other != null ? formatCurrency(project.budget_other) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t('projects.overheadRate')}</p>
                  <p className="font-medium tabular-nums">{project.overhead_rate != null ? `${project.overhead_rate}%` : '—'}</p>
                </div>
                {can('canSeePersonnelRates') && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{t('projects.ourPmRate')}</p>
                    <p className="font-medium tabular-nums">{project.our_pm_rate != null ? formatCurrency(project.our_pm_rate) : '—'}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {projectYears.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('projects.personMonthsPerYear')}</CardTitle>
                  {can('canManageProjects') && pmBudgetDirty && (
                    <Button size="sm" onClick={handleSavePmBudgets} disabled={pmBudgetSaving}>
                      <Save className="mr-1 h-4 w-4" />
                      {pmBudgetSaving ? t('common.saving') : t('common.save')}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(projectYears.length, 6)}, 1fr)` }}>
                  {projectYears.map((year) => (
                    <div key={year} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{year}</Label>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        value={pmBudgetValues[year] ?? ''}
                        placeholder="0"
                        onChange={(e) => {
                          setPmBudgetValues((prev) => ({ ...prev, [year]: Number(e.target.value) || 0 }))
                          setPmBudgetDirty(true)
                        }}
                        disabled={!can('canManageProjects')}
                        className="tabular-nums"
                      />
                    </div>
                  ))}
                </div>
                {projectYears.length > 0 && (
                  <div className="mt-3 text-sm text-muted-foreground">
                    {t('common.total')}: <span className="font-semibold text-foreground">{Object.values(pmBudgetValues).reduce((a, b) => a + b, 0).toFixed(1)} PM</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <BudgetConsumptionChart project={project} projectYears={projectYears} />
        </TabsContent>

        {/* ── Expenses Tab ─────────────────────────────────────── */}
        <TabsContent value="expenses" className="mt-4">
          <ProjectExpenses project={project} />
        </TabsContent>

        {/* ── WPs & Tasks Tab ──────────────────────────────────── */}
        <TabsContent value="workpackages" className="mt-4 space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border bg-card p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('projects.projectBudget')}</div>
              <div className="text-xl font-bold tabular-nums mt-0.5">{totalProjectBudgetPm.toFixed(1)} PM</div>
              <div className="text-[11px] text-muted-foreground">{t('projects.totalAcrossYears')}</div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('projects.assignedToWPs')}</div>
              <div className={cn('text-xl font-bold tabular-nums mt-0.5', totalWpBudgetPm > totalProjectBudgetPm + 0.01 ? 'text-red-500' : 'text-foreground')}>
                {totalWpBudgetPm.toFixed(1)} PM
              </div>
              <div className="text-[11px] text-muted-foreground">
                {totalProjectBudgetPm > 0 ? `${Math.round((totalWpBudgetPm / totalProjectBudgetPm) * 100)}%` : '—'} {t('projects.ofBudget')}
              </div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('projects.allocated')}</div>
              <div className={cn('text-xl font-bold tabular-nums mt-0.5', totalAllocatedPm > totalProjectBudgetPm + 0.01 ? 'text-amber-500' : 'text-primary')}>
                {totalAllocatedPm.toFixed(1)} PM
              </div>
              <div className="text-[11px] text-muted-foreground">{t('projects.peopleAllocated')}</div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('projects.remaining')}</div>
              <div className={cn('text-xl font-bold tabular-nums mt-0.5', (totalProjectBudgetPm - totalAllocatedPm) < 0 ? 'text-red-500' : 'text-emerald-500')}>
                {(totalProjectBudgetPm - totalAllocatedPm).toFixed(1)} PM
              </div>
              <div className="text-[11px] text-muted-foreground">{t('projects.budgetMinusAllocated')}</div>
            </div>
          </div>

          {/* WP list with PM budgets */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('projects.workPackages')}</CardTitle>
                {can('canManageProjects') && wpPmBudgetDirty && (
                  <Button size="sm" onClick={handleSaveWpPmBudgets} disabled={wpPmBudgetSaving}>
                    <Save className="mr-1 h-4 w-4" />
                    {wpPmBudgetSaving ? t('common.saving') : t('projects.savePmBudgets')}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingWPs ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <>
                  {workPackages.length > 0 && (
                    <div className="rounded-lg border mb-4 overflow-x-auto">
                      <table className="w-full text-sm min-w-[700px]">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="px-4 py-2 text-left font-medium w-12">#</th>
                            <th className="px-4 py-2 text-left font-medium">{t('common.name')}</th>
                            <th className="px-4 py-2 text-left font-medium">{t('common.period')}</th>
                            <th className="px-4 py-2 text-right font-medium">{t('projects.budgetPM')}</th>
                            <th className="px-4 py-2 text-right font-medium">{t('projects.allocated')}</th>
                            <th className="px-4 py-2 text-right font-medium">{t('projects.remaining')}</th>
                            {can('canManageProjects') && (
                              <th className="px-4 py-2 text-right font-medium">{t('common.actions')}</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {workPackages.map((wp) => {
                            const wpBudget = wpPmBudgets[wp.id] ?? 0
                            const wpAlloc = wpAllocatedPms[wp.id] ?? 0
                            const wpRemaining = wpBudget - wpAlloc
                            const isEditing = editingWpId === wp.id

                            return (
                              <tr key={wp.id} className="border-b last:border-0 hover:bg-muted/20">
                                <td className="px-4 py-2 text-xs tabular-nums text-muted-foreground">
                                  {isEditing ? (
                                    <select
                                      value={editWpNumber}
                                      onChange={e => setEditWpNumber(Number(e.target.value))}
                                      className="h-7 w-14 rounded border border-input bg-background px-1 text-xs"
                                    >
                                      {Array.from({ length: 40 }, (_, i) => i + 1).map(n => (
                                        <option key={n} value={n}>{n}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="font-semibold">{wp.number ?? '—'}</span>
                                  )}
                                </td>
                                <td className="px-4 py-2">
                                  {isEditing ? (
                                    <div className="space-y-1">
                                      <Input value={editWpName} onChange={e => setEditWpName(e.target.value)} className="h-7 text-xs" placeholder="WP name" />
                                      <Input value={editWpDesc} onChange={e => setEditWpDesc(e.target.value)} className="h-7 text-xs" placeholder="Description" />
                                    </div>
                                  ) : (
                                    <>
                                      <div className="font-medium">{wp.name}</div>
                                      {wp.description && <div className="text-muted-foreground text-xs truncate max-w-[200px]">{wp.description}</div>}
                                    </>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-xs text-muted-foreground">
                                  {isEditing ? (
                                    <div className="flex gap-1 items-center">
                                      <select
                                        value={editWpStartMonth}
                                        onChange={e => setEditWpStartMonth(Number(e.target.value))}
                                        className="h-7 rounded border border-input bg-background px-1 text-xs"
                                      >
                                        {Array.from({ length: projectMonthCount }, (_, i) => i + 1).map(m => (
                                          <option key={m} value={m}>{projectMonthLabel(m)}</option>
                                        ))}
                                      </select>
                                      <span className="text-muted-foreground">–</span>
                                      <select
                                        value={editWpEndMonth}
                                        onChange={e => setEditWpEndMonth(Number(e.target.value))}
                                        className="h-7 rounded border border-input bg-background px-1 text-xs"
                                      >
                                        {Array.from({ length: projectMonthCount }, (_, i) => i + 1).map(m => (
                                          <option key={m} value={m}>{projectMonthLabel(m)}</option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : (
                                    <>
                                      {wp.start_month ? projectMonthLabel(wp.start_month) : '—'}
                                      {' – '}
                                      {wp.end_month ? projectMonthLabel(wp.end_month) : '—'}
                                    </>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-right">
                                  {can('canManageProjects') ? (
                                    <Input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      value={wpBudget || ''}
                                      placeholder="0"
                                      onChange={(e) => {
                                        setWpPmBudgets(prev => ({ ...prev, [wp.id]: Number(e.target.value) || 0 }))
                                        setWpPmBudgetDirty(true)
                                      }}
                                      className="w-20 ml-auto text-right tabular-nums h-7 text-xs"
                                    />
                                  ) : (
                                    <span className="tabular-nums font-medium">{wpBudget.toFixed(1)}</span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums text-xs">
                                  <span className={cn(wpAlloc > wpBudget + 0.01 && wpBudget > 0 ? 'text-amber-600 font-semibold' : 'text-muted-foreground')}>
                                    {wpAlloc.toFixed(2)}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums text-xs">
                                  <span className={cn(wpRemaining < 0 ? 'text-red-500 font-semibold' : 'text-emerald-600')}>
                                    {wpBudget > 0 ? wpRemaining.toFixed(2) : '—'}
                                  </span>
                                </td>
                                {can('canManageProjects') && (
                                  <td className="px-4 py-2 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      {isEditing ? (
                                        <>
                                          <Button variant="ghost" size="sm" onClick={handleSaveEditWp} disabled={editWpSaving} className="h-7 text-xs">
                                            <Save className="h-3 w-3 mr-1" />
                                            {editWpSaving ? '...' : t('common.save')}
                                          </Button>
                                          <Button variant="ghost" size="sm" onClick={() => setEditingWpId(null)} className="h-7 text-xs">{t('common.cancel')}</Button>
                                        </>
                                      ) : (
                                        <>
                                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditWp(wp)}>
                                            <Pencil className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWpDeleteTarget(wp)}>
                                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                          {/* Totals row */}
                          <tr className="bg-muted/30 font-semibold text-xs">
                            <td className="px-4 py-2" colSpan={3}>{t('common.total')}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{totalWpBudgetPm.toFixed(1)} PM</td>
                            <td className="px-4 py-2 text-right tabular-nums">{totalAllocatedPm.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right tabular-nums">
                              <span className={cn((totalWpBudgetPm - totalAllocatedPm) < 0 ? 'text-red-500' : 'text-emerald-600')}>
                                {totalWpBudgetPm > 0 ? (totalWpBudgetPm - totalAllocatedPm).toFixed(2) : '—'}
                              </span>
                            </td>
                            {can('canManageProjects') && <td />}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Budget distribution bar */}
                  {workPackages.length > 0 && totalProjectBudgetPm > 0 && (
                    <div className="mb-4 space-y-1.5">
                      <div className="text-xs text-muted-foreground">{t('projects.pmBudgetDistribution')}</div>
                      <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                        {workPackages.map((wp, i) => {
                          const wpBudget = wpPmBudgets[wp.id] ?? 0
                          const pct = totalProjectBudgetPm > 0 ? (wpBudget / totalProjectBudgetPm) * 100 : 0
                          const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-red-400', 'bg-pink-500', 'bg-cyan-500', 'bg-lime-500']
                          return pct > 0 ? (
                            <div
                              key={wp.id}
                              className={cn('h-full', colors[i % colors.length])}
                              style={{ width: `${pct}%` }}
                              title={`${wp.name}: ${wpBudget.toFixed(1)} PM (${pct.toFixed(0)}%)`}
                            />
                          ) : null
                        })}
                      </div>
                      <div className="flex gap-3 flex-wrap text-[10px] text-muted-foreground">
                        {workPackages.map((wp, i) => {
                          const wpBudget = wpPmBudgets[wp.id] ?? 0
                          const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-red-400', 'bg-pink-500', 'bg-cyan-500', 'bg-lime-500']
                          return (
                            <span key={wp.id} className="flex items-center gap-1">
                              <span className={cn('w-2 h-2 rounded-sm', colors[i % colors.length])} />
                              {wp.name}: {wpBudget.toFixed(1)} PM
                            </span>
                          )
                        })}
                        {totalProjectBudgetPm - totalWpBudgetPm > 0.01 && (
                          <span className="flex items-center gap-1 text-amber-600">
                            {t('projects.unassigned')}: {(totalProjectBudgetPm - totalWpBudgetPm).toFixed(1)} PM
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Add new WP form */}
                  {can('canManageProjects') && (
                    <div className="space-y-3 rounded-lg border p-4 bg-muted/10">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('projects.addWorkPackage')}</div>
                      <div className="flex gap-2 items-end flex-wrap">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{t('projects.wpNumber')}</Label>
                          <select
                            value={wpNumber}
                            onChange={(e) => setWpNumber(Number(e.target.value))}
                            className="flex h-9 w-16 rounded-md border border-input bg-background px-2 py-1 text-sm"
                          >
                            {Array.from({ length: 40 }, (_, i) => i + 1).map(n => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1 flex-1 min-w-[120px]">
                          <Label className="text-xs text-muted-foreground">{t('projects.wpName')} *</Label>
                          <Input
                            placeholder="WP name"
                            value={wpName}
                            onChange={(e) => setWpName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1 flex-1 min-w-[120px]">
                          <Label className="text-xs text-muted-foreground">{t('projects.wpDescription')}</Label>
                          <Input
                            placeholder="Optional"
                            value={wpDesc}
                            onChange={(e) => setWpDesc(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 items-end flex-wrap">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{t('projects.startMonth')}</Label>
                          <select
                            value={wpStartMonth}
                            onChange={(e) => setWpStartMonth(Number(e.target.value))}
                            className="flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
                          >
                            {Array.from({ length: projectMonthCount || 1 }, (_, i) => i + 1).map(m => (
                              <option key={m} value={m}>{projectMonthLabel(m)}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{t('projects.endMonth')}</Label>
                          <select
                            value={wpEndMonth}
                            onChange={(e) => setWpEndMonth(Number(e.target.value))}
                            className="flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
                          >
                            {Array.from({ length: projectMonthCount || 1 }, (_, i) => i + 1).map(m => (
                              <option key={m} value={m}>{projectMonthLabel(m)}</option>
                            ))}
                          </select>
                        </div>
                        <Button onClick={handleAddWP} disabled={wpSaving || !wpName.trim()}>
                          <Plus className="mr-1 h-4 w-4" />
                          {wpSaving ? t('common.adding') : t('projects.addWP')}
                        </Button>
                      </div>
                      {projectMonthCount > 0 && (
                        <div className="text-[11px] text-muted-foreground">
                          {t('projects.projectDuration', { months: projectMonthCount, start: formatDate(project.start_date), end: formatDate(project.end_date) })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Periods Tab ──────────────────────────────────────── */}
        <TabsContent value="periods" className="mt-4">
          <ReportingPeriodsTab
            project={project}
            projectMonthLabel={projectMonthLabel}
            projectMonthCount={projectMonthCount}
          />
        </TabsContent>

        {/* ── Del. & MS Tab ────────────────────────────────────── */}
        <TabsContent value="deliverables" className="mt-4">
          <DeliverablesTab
            project={project}
            workPackages={workPackages}
            projectMonthLabel={projectMonthLabel}
            projectMonthCount={projectMonthCount}
          />
        </TabsContent>

        {/* ── Reports Tab ──────────────────────────────────────── */}
        <TabsContent value="reporting" className="mt-4">
          <ReportingPeriodsTab
            project={project}
            projectMonthLabel={projectMonthLabel}
            projectMonthCount={projectMonthCount}
          />
        </TabsContent>

        {/* ── Our Effort Tab ───────────────────────────────────── */}
        <TabsContent value="effort" className="mt-4">
          {!project.collab_project_id ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                <Target className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
                <p className="font-medium">{t('projects.noCollabLinked')}</p>
                <p className="text-xs mt-1">{t('projects.noCollabLinkedDesc')}</p>
              </CardContent>
            </Card>
          ) : effortLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : collabPartners.length === 0 || collabWps.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                <p>{t('projects.noEffortData')}</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t('projects.ourEffortOverview')}</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left bg-muted/50">
                      <th className="p-3 font-medium sticky left-0 bg-muted/50">{t('projects.wpTask')}</th>
                      {collabPartners.map(p => (
                        <th key={p.id} className="p-3 font-medium text-right text-xs min-w-[80px]" title={p.org_name}>
                          <div className="truncate max-w-[80px]">{p.org_name}</div>
                          <div className="text-[10px] text-muted-foreground font-normal">
                            {p.role === 'coordinator' ? t('collaboration.coord') : `#${p.participant_number}`}
                          </div>
                        </th>
                      ))}
                      <th className="p-3 font-medium text-right w-24">{t('common.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collabWps.map(wp => {
                      const wpTasks = collabTasksByWp[wp.id] ?? []
                      const wpPartnerPMs = collabPartners.map(p =>
                        wpTasks.reduce((s, tk) => {
                          const eff = collabEffort.find(e => e.task_id === tk.id && e.partner_id === p.id)
                          return s + (eff?.person_months ?? 0)
                        }, 0)
                      )
                      const wpTotal = wpPartnerPMs.reduce((s, v) => s + v, 0)
                      return (
                        <tr key={wp.id} className="border-b bg-primary/[0.03] font-medium">
                          <td className="p-2.5 sticky left-0 bg-primary/[0.03]">
                            <span className="font-mono text-xs mr-1.5">WP{wp.wp_number}</span>
                            {wp.title}
                          </td>
                          {wpPartnerPMs.map((pm, i) => (
                            <td key={collabPartners[i].id} className="p-2.5 text-right tabular-nums text-xs">
                              {pm > 0 ? pm.toFixed(1) : <span className="text-muted-foreground/40">—</span>}
                            </td>
                          ))}
                          <td className="p-2.5 text-right tabular-nums font-bold">
                            {wpTotal > 0 ? wpTotal.toFixed(1) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 font-medium border-t-2">
                      <td className="p-3 sticky left-0 bg-muted/50">{t('common.total')}</td>
                      {collabPartners.map(p => {
                        const partnerTotal = collabEffort.filter(e => e.partner_id === p.id).reduce((s, e) => s + e.person_months, 0)
                        return (
                          <td key={p.id} className="p-3 text-right tabular-nums text-xs">
                            {partnerTotal > 0 ? partnerTotal.toFixed(1) : '—'}
                          </td>
                        )
                      })}
                      <td className="p-3 text-right tabular-nums font-bold">
                        {collabEffort.reduce((s, e) => s + e.person_months, 0).toFixed(1)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Timeline Tab ─────────────────────────────────────── */}
        <TabsContent value="timeline" className="mt-4">
          <ProjectGanttChart
            project={project}
            workPackages={workPackages}
            projectMonthCount={projectMonthCount}
          />
        </TabsContent>

        {/* ── Documents Tab ────────────────────────────────────── */}
        <TabsContent value="documents" className="mt-4">
          {id && <DocumentList projectId={id} />}
        </TabsContent>
      </Tabs>

      <ConfirmModal
        open={!!wpDeleteTarget}
        onOpenChange={(open) => !open && setWpDeleteTarget(null)}
        title={t('projects.deleteWP')}
        message={t('projects.deleteWPConfirm', { name: wpDeleteTarget?.name })}
        confirmLabel={t('common.delete')}
        destructive
        loading={wpDeleting}
        onConfirm={handleDeleteWP}
      />
    </div>
  )
}
