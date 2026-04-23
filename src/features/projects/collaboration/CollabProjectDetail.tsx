import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Users, FileText, Calendar, Rocket, Trash2, Send, Mail, Plus, Pencil, DollarSign, LayoutGrid, Archive, ArchiveRestore, Download, ChevronDown, ChevronRight, Target, ListChecks, GanttChart as GanttIcon, Bell, ClipboardList, FolderOpen, Receipt } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { collabProjectService, collabPartnerService, collabWpService, collabAllocService, collabPeriodService, collabReportService, collabTaskService, collabDeliverableService, collabMilestoneService, collabTaskEffortService, syncCollabToMyProjects } from '@/services/collabProjectService'
import { emailService } from '@/services/emailService'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import { EditPartnerDialog } from './EditPartnerDialog'
import { EditWpDialog } from './EditWpDialog'
import { EditProjectDialog } from './EditProjectDialog'
import { EditAllocDialog } from './EditAllocDialog'
import { EditContactDialog } from './EditContactDialog'
import { CollabGanttChart } from './CollabGanttChart'
import { CollabExpenses } from './CollabExpenses'
import { DocumentList } from '@/features/documents/DocumentList'
import { generateCollabBudgetPDF } from '@/services/reportGenerator'
import { formatDate } from '@/lib/utils'
import type { CollabProject, CollabPartner, CollabWorkPackage, CollabPartnerWpAlloc, CollabReportingPeriod, CollabReport, CollabTask, CollabDeliverable, CollabMilestone, CollabReminderSettings, CollabReminderUnit } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  archived: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const INVITE_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
  invited: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400',
  accepted: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400',
  declined: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400',
}

const TAB_KEYS = [
  { value: 'general', labelKey: 'collaboration.tabGeneral', icon: FileText },
  { value: 'budget', labelKey: 'collaboration.tabBudget', icon: DollarSign },
  { value: 'expenses', labelKey: 'projects.expenses', icon: Receipt },
  { value: 'partners', labelKey: 'collaboration.tabPartners', icon: Users },
  { value: 'wps', labelKey: 'projects.tabWpsTasks', icon: LayoutGrid },
  { value: 'periods', labelKey: 'collaboration.tabPeriods', icon: Calendar },
  { value: 'deliverables', labelKey: 'collaboration.tabDelMs', icon: ListChecks },
  { value: 'reports', labelKey: 'collaboration.tabReports', icon: ClipboardList },
  { value: 'effort', labelKey: 'collaboration.tabEffort', icon: Target },
  { value: 'gantt', labelKey: 'collaboration.tabTimeline', icon: GanttIcon },
  { value: 'documents', labelKey: 'projects.documents', icon: FolderOpen },
]

const DEFAULT_REMINDER_SETTINGS: CollabReminderSettings = {
  deliverables: { enabled: true, lead_time: 14, unit: 'days' },
  milestones: { enabled: true, lead_time: 14, unit: 'days' },
  reports: { enabled: true, lead_time: 7, unit: 'days' },
}

export function CollabProjectDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { orgId, orgName, user } = useAuthStore()
  const [project, setProject] = useState<CollabProject | null>(null)
  const [partners, setPartners] = useState<CollabPartner[]>([])
  const [wps, setWps] = useState<CollabWorkPackage[]>([])
  const [allocs, setAllocs] = useState<CollabPartnerWpAlloc[]>([])
  const [periods, setPeriods] = useState<CollabReportingPeriod[]>([])
  const [tasksByWp, setTasksByWp] = useState<Record<string, CollabTask[]>>({})
  const [deliverables, setDeliverables] = useState<CollabDeliverable[]>([])
  const [milestones, setMilestones] = useState<CollabMilestone[]>([])
  const [expandedWps, setExpandedWps] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('general')
  const [sendingInvites, setSendingInvites] = useState(false)

  // Edit dialogs
  const [editPartner, setEditPartner] = useState<CollabPartner | null>(null)
  const [showPartnerDialog, setShowPartnerDialog] = useState(false)
  const [showWpDialog, setShowWpDialog] = useState(false)
  const [showProjectDialog, setShowProjectDialog] = useState(false)
  const [allocPartner, setAllocPartner] = useState<CollabPartner | null>(null)
  const [contactPartner, setContactPartner] = useState<CollabPartner | null>(null)

  // Period reports
  const [periodReports, setPeriodReports] = useState<Record<string, CollabReport[]>>({})
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null)

  // Add period form
  const [showAddPeriod, setShowAddPeriod] = useState(false)
  const [newPeriod, setNewPeriod] = useState({ title: '', period_type: 'informal' as 'formal' | 'informal', start_month: '', end_month: '', due_date: '' })
  const [editPeriodId, setEditPeriodId] = useState<string | null>(null)
  const [editPeriod, setEditPeriod] = useState({ title: '', period_type: 'informal' as 'formal' | 'informal', start_month: '', end_month: '', due_date: '' })

  // Task add/edit
  const [addTaskWpId, setAddTaskWpId] = useState<string | null>(null)
  const [newTask, setNewTask] = useState({ task_number: '', title: '', start_month: '', end_month: '', leader_partner_id: '' })
  const emptyNewTask = { task_number: '', title: '', start_month: '', end_month: '', leader_partner_id: '' }

  // Effort data for effort overview
  const [effortData, setEffortData] = useState<{ task_id: string; partner_id: string; person_months: number }[]>([])

  // Reminder settings
  const [reminderSettings, setReminderSettings] = useState<CollabReminderSettings>(DEFAULT_REMINDER_SETTINGS)
  const [savingReminders, setSavingReminders] = useState(false)

  const handleSaveReminders = async () => {
    if (!id) return
    setSavingReminders(true)
    try {
      await collabProjectService.update(id, { reminder_settings: reminderSettings } as any)
      toast({ title: t('common.saved'), description: t('collaboration.reminderSettingsSaved') })
    } catch {
      toast({ title: t('common.error'), description: t('common.failedToSave'), variant: 'destructive' })
    } finally {
      setSavingReminders(false)
    }
  }

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [proj, parts, workPackages, rPeriods] = await Promise.all([
        collabProjectService.get(id),
        collabPartnerService.list(id),
        collabWpService.list(id),
        collabPeriodService.list(id),
      ])
      setProject(proj)
      if (proj.reminder_settings) {
        setReminderSettings({ ...DEFAULT_REMINDER_SETTINGS, ...proj.reminder_settings })
      }
      setPartners(parts)
      setWps(workPackages)
      setPeriods(rPeriods)
      // Load all allocations for each partner
      const allAllocs: CollabPartnerWpAlloc[] = []
      for (const p of parts) {
        try {
          const a = await collabAllocService.list(p.id)
          allAllocs.push(...a)
        } catch { /* ignore */ }
      }
      setAllocs(allAllocs)
      // Load tasks for each WP
      const tMap: Record<string, CollabTask[]> = {}
      for (const wp of workPackages) {
        try {
          tMap[wp.id] = await collabTaskService.list(wp.id)
        } catch { /* ignore */ }
      }
      setTasksByWp(tMap)
      // Load deliverables & milestones
      try {
        const [dels, mss] = await Promise.all([
          collabDeliverableService.list(id),
          collabMilestoneService.list(id),
        ])
        setDeliverables(dels)
        setMilestones(mss)
      } catch { /* ignore */ }
      // Pre-load reports for generated periods so status badges show
      const rpMap: Record<string, CollabReport[]> = {}
      for (const per of rPeriods) {
        if (per.reports_generated) {
          try {
            rpMap[per.id] = await collabReportService.listForPeriod(per.id)
          } catch { /* ignore */ }
        }
      }
      setPeriodReports(rpMap)
      // Load effort data
      try {
        const eff = await collabTaskEffortService.listByProject(id)
        setEffortData(eff.map(e => ({ task_id: e.task_id, partner_id: e.partner_id, person_months: e.person_months })))
      } catch { /* ignore — table may not exist yet */ }
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToLoadProject'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const handleLaunch = async () => {
    if (!id || !confirm(t('collaboration.confirmLaunchProject'))) return
    try {
      await collabProjectService.launch(id)
      if (orgId) await syncCollabToMyProjects(id, orgId)
      toast({ title: t('collaboration.launched'), description: t('collaboration.projectNowActive') })
      load()
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToLaunchProject'), variant: 'destructive' })
    }
  }

  const handleArchive = async () => {
    if (!id || !project) return
    const newStatus = project.status === 'archived' ? 'active' : 'archived'
    const label = newStatus === 'archived' ? t('collaboration.archive') : t('collaboration.unarchive')
    if (!confirm(`${label}?`)) return
    try {
      await collabProjectService.update(id, { status: newStatus } as any)
      if (orgId) await syncCollabToMyProjects(id, orgId)
      toast({ title: label, description: newStatus === 'archived' ? t('collaboration.projectArchived') : t('collaboration.projectRestoredActive') })
      load()
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToArchiveProject'), variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!id || !confirm(t('collaboration.confirmDeleteProject'))) return
    try {
      await collabProjectService.remove(id)
      toast({ title: t('common.deleted') })
      navigate('/projects/collaboration')
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToDeleteProject'), variant: 'destructive' })
    }
  }

  const getInviteUrl = (p: CollabPartner) => {
    const base = window.location.origin
    const params = new URLSearchParams({
      type: 'collab',
      token: p.invite_token || '',
      org: p.org_name,
      role: p.role === 'coordinator' ? 'Coordinator' : 'Partner',
    })
    if (p.contact_email) params.set('email', p.contact_email)
    if (project) {
      params.set('project', project.acronym)
      params.set('projectTitle', project.title)
    }
    if (user?.email) params.set('invitedBy', user.email)
    return `${base}/invite/accept?${params.toString()}`
  }

  const handleSendInvite = async (p: CollabPartner) => {
    if (!project || !p.contact_email) return
    try {
      await emailService.sendCollabPartnerInvitation({
        to: p.contact_email,
        contactName: p.contact_name || '',
        orgName: p.org_name,
        projectAcronym: project.acronym,
        projectTitle: project.title,
        coordinatorOrg: orgName || 'Coordinator',
        senderName: user?.email || 'Coordinator',
        role: p.role,
        acceptUrl: getInviteUrl(p),
      })
      // Mark partner as 'invited' (email sent)
      if (p.invite_status === 'pending') {
        await collabPartnerService.update(p.id, { invite_status: 'invited' })
        setPartners(prev => prev.map(pp => pp.id === p.id ? { ...pp, invite_status: 'invited' } : pp))
      }
      toast({ title: t('common.sent'), description: t('collaboration.invitationSentTo', { email: p.contact_email }) })
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToSendInvitation'), variant: 'destructive' })
    }
  }

  const handleSendAllInvites = async () => {
    if (!project) return
    const uninvited = partners.filter(p => p.invite_status === 'pending' && p.contact_email)
    if (uninvited.length === 0) {
      toast({ title: t('collaboration.noPendingInvitations'), description: t('collaboration.allPartnersInvited') })
      return
    }
    setSendingInvites(true)
    let sent = 0
    const sentIds: string[] = []
    for (const p of uninvited) {
      try {
        await emailService.sendCollabPartnerInvitation({
          to: p.contact_email!,
          contactName: p.contact_name || '',
          orgName: p.org_name,
          projectAcronym: project.acronym,
          projectTitle: project.title,
          coordinatorOrg: orgName || 'Coordinator',
          senderName: user?.email || 'Coordinator',
          role: p.role,
          acceptUrl: getInviteUrl(p),
        })
        // Mark partner as 'invited'
        await collabPartnerService.update(p.id, { invite_status: 'invited' }).catch(() => {})
        sentIds.push(p.id)
        sent++
      } catch {
        // continue sending to others
      }
    }
    // Update local state in one batch
    if (sentIds.length > 0) {
      setPartners(prev => prev.map(pp => sentIds.includes(pp.id) ? { ...pp, invite_status: 'invited' } : pp))
    }
    setSendingInvites(false)
    toast({ title: t('collaboration.invitationsSent'), description: t('collaboration.sentCountInvitations', { sent, total: uninvited.length }) })
  }

  const handleAddPeriod = async () => {
    if (!id || !newPeriod.title || !newPeriod.start_month || !newPeriod.end_month) return
    try {
      await collabPeriodService.create({
        project_id: id,
        period_type: newPeriod.period_type,
        title: newPeriod.title,
        start_month: parseInt(newPeriod.start_month),
        end_month: parseInt(newPeriod.end_month),
        due_date: newPeriod.due_date || undefined,
      })
      toast({ title: t('common.created'), description: t('collaboration.periodAdded') })
      setShowAddPeriod(false)
      setNewPeriod({ title: '', period_type: 'informal', start_month: '', end_month: '', due_date: '' })
      load()
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToCreatePeriod'), variant: 'destructive' })
    }
  }

  const handleGenerateReports = async (periodId: string) => {
    if (!id || !confirm(t('collaboration.confirmGenerateReports'))) return
    try {
      await collabPeriodService.generateReports(periodId, id)
      toast({ title: t('collaboration.generated'), description: t('collaboration.reportsCreatedForPartners') })
      load()
      // Auto-expand to show generated reports
      await loadPeriodReports(periodId)
      setExpandedPeriod(periodId)
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToGenerateReports'), variant: 'destructive' })
    }
  }

  const loadPeriodReports = async (periodId: string) => {
    try {
      const reports = await collabReportService.listForPeriod(periodId)
      setPeriodReports(prev => ({ ...prev, [periodId]: reports }))
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToLoadReports'), variant: 'destructive' })
    }
  }

  const togglePeriod = async (periodId: string) => {
    if (expandedPeriod === periodId) {
      setExpandedPeriod(null)
      return
    }
    setExpandedPeriod(periodId)
    if (!periodReports[periodId]) {
      await loadPeriodReports(periodId)
    }
  }

  const startEditPeriod = (p: CollabReportingPeriod) => {
    setEditPeriodId(p.id)
    setEditPeriod({
      title: p.title,
      period_type: p.period_type,
      start_month: String(p.start_month),
      end_month: String(p.end_month),
      due_date: p.due_date || '',
    })
  }

  const handleUpdatePeriod = async () => {
    if (!editPeriodId || !editPeriod.title || !editPeriod.start_month || !editPeriod.end_month) return
    try {
      await collabPeriodService.update(editPeriodId, {
        title: editPeriod.title,
        period_type: editPeriod.period_type,
        start_month: parseInt(editPeriod.start_month),
        end_month: parseInt(editPeriod.end_month),
        due_date: editPeriod.due_date || null,
      } as any)
      toast({ title: t('common.updated'), description: t('collaboration.periodUpdated') })
      setEditPeriodId(null)
      load()
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToUpdatePeriod'), variant: 'destructive' })
    }
  }

  const handleDeletePeriod = async (periodId: string, title: string) => {
    if (!confirm(t('collaboration.confirmDeletePeriod', { title }))) return
    try {
      await collabPeriodService.remove(periodId)
      toast({ title: t('common.deleted'), description: t('collaboration.periodRemoved', { title }) })
      load()
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToDeletePeriod'), variant: 'destructive' })
    }
  }

  const handleAddTask = async (wpId: string) => {
    if (!id || !newTask.title.trim()) return
    const sm = parseInt(newTask.start_month) || undefined
    const em = parseInt(newTask.end_month) || undefined
    if (sm && em && em < sm) {
      toast({ title: t('common.invalid'), description: t('collaboration.endMonthMustBeGte'), variant: 'destructive' })
      return
    }
    try {
      await collabTaskService.createMany(id, wpId, [{
        task_number: newTask.task_number || 'T' + ((tasksByWp[wpId]?.length ?? 0) + 1),
        title: newTask.title,
        start_month: sm ?? null,
        end_month: em ?? null,
        leader_partner_id: newTask.leader_partner_id || null,
      }])
      toast({ title: t('common.added'), description: t('collaboration.taskCreated') })
      setAddTaskWpId(null)
      setNewTask(emptyNewTask)
      load()
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToAddTask'), variant: 'destructive' })
    }
  }

  const handleDeleteTask = async (taskId: string, taskTitle: string) => {
    if (!confirm(t('collaboration.confirmDeleteTask', { title: taskTitle }))) return
    try {
      await collabTaskService.remove(taskId)
      toast({ title: t('common.deleted'), description: t('collaboration.taskRemoved', { title: taskTitle }) })
      load()
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToDeleteTask'), variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>{t('collaboration.projectNotFound')}</p>
        <Button variant="link" onClick={() => navigate('/projects/collaboration')}>{t('collaboration.backToList')}</Button>
      </div>
    )
  }

  const totalBudget = partners.reduce((sum, p) =>
    sum + p.budget_personnel + p.budget_subcontracting + p.budget_travel + p.budget_equipment + p.budget_other_goods
  , 0)
  const totalPMs = partners.reduce((sum, p) => sum + p.total_person_months, 0)
  const uninvitedCount = partners.filter(p => p.invite_status === 'pending' && p.contact_email).length
  const invitedCount = partners.filter(p => p.invite_status === 'invited').length
  const acceptedCount = partners.filter(p => p.invite_status === 'accepted').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects/collaboration')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{project.acronym}</h1>
              <Badge className={STATUS_COLORS[project.status] ?? ''} variant="secondary">
                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">{project.title}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground mt-2">
              {project.grant_number && <span>GA {project.grant_number}</span>}
              {project.funding_programme && <span>{project.funding_programme}</span>}
              {project.start_date && project.end_date && (
                <span>{formatDate(project.start_date)} → {formatDate(project.end_date)}</span>
              )}
              {project.duration_months && <span>{project.duration_months} {t('collaboration.months')}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => navigate(`/projects/collaboration/${id}/edit`)} className="gap-2">
            <Pencil className="h-4 w-4" /> {t('collaboration.editAll')}
          </Button>
          {uninvitedCount > 0 && (
            <Button variant="outline" onClick={handleSendAllInvites} disabled={sendingInvites} className="gap-2">
              <Send className="h-4 w-4" />
              {sendingInvites ? t('common.sending') : t('collaboration.inviteAll', { count: uninvitedCount })}
            </Button>
          )}
          {project.status === 'draft' && (
            <Button onClick={handleLaunch} className="gap-2">
              <Rocket className="h-4 w-4" /> {t('collaboration.launch')}
            </Button>
          )}
          {project.status === 'active' && (
            <Button variant="outline" size="sm" onClick={handleArchive} className="gap-2">
              <Archive className="h-4 w-4" /> {t('collaboration.archive')}
            </Button>
          )}
          {project.status === 'archived' && (
            <Button variant="outline" size="sm" onClick={handleArchive} className="gap-2">
              <ArchiveRestore className="h-4 w-4" /> {t('collaboration.unarchive')}
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Mobile dropdown (visible < sm) */}
        <div className="sm:hidden mb-4">
          <select
            value={activeTab}
            onChange={e => setActiveTab(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {TAB_KEYS.map(tab => (
              <option key={tab.value} value={tab.value}>{t(tab.labelKey)}</option>
            ))}
          </select>
        </div>
        {/* Scrollable tabs (visible >= sm) */}
        <div className="hidden sm:block overflow-x-auto -mx-1 px-1 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
          <TabsList className="inline-flex w-max min-w-full justify-start">
            {TAB_KEYS.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-1 text-xs whitespace-nowrap px-2.5 py-1.5">
                <tab.icon className="h-3.5 w-3.5 shrink-0" /> {t(tab.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* General Tab */}
        <TabsContent value="general" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-5 space-y-5">
              {/* Project identity */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t('collaboration.acronym')}</p>
                  <p className="font-semibold">{project.acronym}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t('common.status')}</p>
                  <Badge className={STATUS_COLORS[project.status] ?? ''} variant="secondary">
                    {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                  </Badge>
                </div>
                {project.grant_number && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{t('collaboration.grantAgreement')}</p>
                    <p className="font-medium">{project.grant_number}</p>
                  </div>
                )}
                {project.funding_programme && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{t('collaboration.programme')}</p>
                    <p className="font-medium">{project.funding_programme}</p>
                  </div>
                )}
                {project.funding_scheme && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{t('collaboration.scheme')}</p>
                    <p className="font-medium">{project.funding_scheme}</p>
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
                {project.duration_months && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{t('collaboration.duration')}</p>
                    <p className="font-medium">{project.duration_months} {t('collaboration.months')}</p>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t" />

              {/* Summary numbers */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                <div className="text-center">
                  <p className="text-xl font-bold">{partners.length}</p>
                  <p className="text-[11px] text-muted-foreground">{t('collaboration.partners')}</p>
                  <p className="text-[10px] text-muted-foreground">{acceptedCount} {t('collaboration.accepted')} · {invitedCount} {t('collaboration.invited')} · {uninvitedCount} {t('collaboration.pending')}</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">{wps.length}</p>
                  <p className="text-[11px] text-muted-foreground">{t('collaboration.workPackages')}</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">{deliverables.length}</p>
                  <p className="text-[11px] text-muted-foreground">{t('collaboration.deliverables')}</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">{milestones.length}</p>
                  <p className="text-[11px] text-muted-foreground">{t('collaboration.milestones')}</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">{totalPMs.toFixed(1)}</p>
                  <p className="text-[11px] text-muted-foreground">{t('collaboration.personMonths')}</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">€{totalBudget.toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground">{t('collaboration.totalBudget')}</p>
                </div>
              </div>

              {/* Coordinator info */}
              {(() => {
                const coord = partners.find(p => p.role === 'coordinator')
                if (!coord) return null
                return (
                  <>
                    <div className="border-t" />
                    <div className="text-sm">
                      <p className="text-xs text-muted-foreground mb-1">{t('collaboration.coordinator')}</p>
                      <p className="font-medium">{coord.org_name}</p>
                      {coord.contact_name && <p className="text-xs text-muted-foreground">{coord.contact_name} {coord.contact_email && `· ${coord.contact_email}`}</p>}
                    </div>
                  </>
                )
              })()}
            </CardContent>
          </Card>

          {/* Reminder Settings */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{t('collaboration.reminderSettings')}</h3>
              </div>
              <p className="text-xs text-muted-foreground">{t('collaboration.reminderSettingsDesc')}</p>

              {(['deliverables', 'milestones', 'reports'] as const).map(cat => {
                const setting = reminderSettings[cat]
                return (
                  <div key={cat} className="flex items-center gap-3 flex-wrap">
                    <label className="flex items-center gap-2 min-w-[160px]">
                      <input
                        type="checkbox"
                        checked={setting.enabled}
                        onChange={e => setReminderSettings(prev => ({
                          ...prev,
                          [cat]: { ...prev[cat], enabled: e.target.checked },
                        }))}
                        className="accent-primary h-4 w-4"
                      />
                      <span className="text-sm font-medium capitalize">{t(`collaboration.reminder_${cat}`)}</span>
                    </label>
                    {setting.enabled && (
                      <div className="flex items-center gap-2 text-sm">
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={setting.lead_time}
                          onChange={e => setReminderSettings(prev => ({
                            ...prev,
                            [cat]: { ...prev[cat], lead_time: parseInt(e.target.value) || 1 },
                          }))}
                          className="h-8 w-20 text-sm"
                        />
                        <select
                          value={setting.unit}
                          onChange={e => setReminderSettings(prev => ({
                            ...prev,
                            [cat]: { ...prev[cat], unit: e.target.value as CollabReminderUnit },
                          }))}
                          className="flex h-8 rounded-md border border-input bg-background px-2 py-1 text-sm"
                        >
                          <option value="days">{t('collaboration.unitDays')}</option>
                          <option value="weeks">{t('collaboration.unitWeeks')}</option>
                          <option value="months">{t('collaboration.unitMonths')}</option>
                        </select>
                        <span className="text-xs text-muted-foreground">{t('collaboration.beforeDue')}</span>
                      </div>
                    )}
                  </div>
                )
              })}

              <div className="pt-2">
                <Button size="sm" onClick={handleSaveReminders} disabled={savingReminders}>
                  {savingReminders ? t('common.saving') : t('common.saveChanges')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="mt-4">
          {id && <CollabExpenses projectId={id} />}
        </TabsContent>

        {/* Partners Tab */}
        <TabsContent value="partners" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => { setEditPartner(null); setShowPartnerDialog(true) }} className="gap-2">
              <Plus className="h-4 w-4" /> {t('collaboration.addPartner')}
            </Button>
          </div>
          {partners.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t('collaboration.noPartnersYet')}</p>
          ) : (
            <div className="space-y-3">
              {partners.map(p => (
                <Card key={p.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant={p.role === 'coordinator' ? 'default' : 'secondary'}>
                            {p.role === 'coordinator' ? t('collaboration.coordinator') : `#${p.participant_number}`}
                          </Badge>
                          <span className="font-medium">{p.org_name}</span>
                          <Badge variant="outline" className={`text-[10px] ${INVITE_STATUS_COLORS[p.invite_status] ?? ''}`}>
                            {p.invite_status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground mt-2">
                          {p.country && <span>{p.country}</span>}
                          {p.contact_name && <span>{p.contact_name}</span>}
                          {p.contact_email && <span>{p.contact_email}</span>}
                          <span>{p.total_person_months} PMs</span>
                          <span>€{(p.budget_personnel + p.budget_subcontracting + p.budget_travel + p.budget_equipment + p.budget_other_goods).toLocaleString()}</span>
                          <span>{t('collaboration.funding')}: {p.funding_rate}%</span>
                          <span>{t('collaboration.indirect')}: {p.indirect_cost_rate}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { setEditPartner(p); setShowPartnerDialog(true) }}>
                          <Pencil className="h-3.5 w-3.5" /> {t('common.edit')}
                        </Button>
                        {(p.invite_status === 'pending' || p.invite_status === 'invited') && p.contact_email && (
                          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleSendInvite(p)}>
                            <Mail className="h-3.5 w-3.5" /> {p.invite_status === 'invited' ? t('collaboration.resend') : t('common.email')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Work Packages Tab */}
        <TabsContent value="wps" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowWpDialog(true)} className="gap-2">
              <Pencil className="h-4 w-4" /> {t('collaboration.editWorkPackages')}
            </Button>
          </div>
          {wps.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t('collaboration.noWpsDefined')}</p>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-3 font-medium w-20">{t('collaboration.wpNumber')}</th>
                      <th className="p-3 font-medium">{t('common.title')}</th>
                      <th className="p-3 font-medium text-right w-28">{t('collaboration.budgetedPMs')}</th>
                      {partners.map(p => (
                        <th key={p.id} className="p-3 font-medium text-right text-xs" title={p.org_name}>
                          {p.role === 'coordinator' ? 'C' : `#${p.participant_number}`}
                        </th>
                      ))}
                      <th className="p-3 font-medium text-right w-28">{t('collaboration.allocated')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wps.map(wp => {
                      const wpAllocs = allocs.filter(a => a.wp_id === wp.id)
                      const totalAllocated = wpAllocs.reduce((s, a) => s + a.person_months, 0)
                      const wpTasks = tasksByWp[wp.id] ?? []
                      const isExpWp = expandedWps.has(wp.id)
                      const leaderPartner = wp.leader_partner_id ? partners.find(p => p.id === wp.leader_partner_id) : null
                      return (
                        <React.Fragment key={wp.id}>
                          <tr
                            className="border-b hover:bg-muted/30 cursor-pointer"
                            onClick={() => setExpandedWps(prev => {
                              const next = new Set(prev)
                              next.has(wp.id) ? next.delete(wp.id) : next.add(wp.id)
                              return next
                            })}
                          >
                            <td className="p-3 font-mono">
                              <div className="flex items-center gap-1">
                                {wpTasks.length > 0 ? (
                                  isExpWp ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                ) : <span className="w-3" />}
                                {wp.wp_number}
                              </div>
                            </td>
                            <td className="p-3">
                              <div>{wp.title}</div>
                              <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                                {leaderPartner && <span>{t('collaboration.lead')}: {leaderPartner.org_name}</span>}
                                {wp.start_month != null && wp.end_month != null && <span>M{wp.start_month}–M{wp.end_month}</span>}
                                {wpTasks.length > 0 && <span>{t('collaboration.taskCount', { count: wpTasks.length })}</span>}
                              </div>
                            </td>
                            <td className="p-3 text-right">{wp.total_person_months}</td>
                            {partners.map(p => {
                              const a = wpAllocs.find(al => al.partner_id === p.id)
                              return (
                                <td key={p.id} className="p-3 text-right tabular-nums text-xs text-muted-foreground">
                                  {a ? a.person_months : '—'}
                                </td>
                              )
                            })}
                            <td className={`p-3 text-right tabular-nums font-medium ${
                              Math.abs(totalAllocated - wp.total_person_months) > 0.1
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {totalAllocated.toFixed(1)}
                            </td>
                          </tr>
                          {isExpWp && wpTasks.map(tk => {
                            const taskLeader = tk.leader_partner_id ? partners.find(p => p.id === tk.leader_partner_id) : null
                            const taskEffortTotal = effortData.filter(e => e.task_id === tk.id).reduce((s, e) => s + e.person_months, 0)
                            return (
                              <tr key={tk.id} className="border-b bg-muted/[0.04]">
                                <td className="p-2 pl-8 font-mono text-xs text-muted-foreground">{tk.task_number}</td>
                                <td className="p-2 text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <span>{tk.title}</span>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 opacity-50 hover:opacity-100" onClick={(e) => { e.stopPropagation(); handleDeleteTask(tk.id, tk.title) }}>
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </div>
                                  <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                                    {taskLeader && <span>{t('collaboration.lead')}: {taskLeader.org_name}</span>}
                                    {tk.start_month != null && tk.end_month != null && <span>M{tk.start_month}–M{tk.end_month}</span>}
                                  </div>
                                </td>
                                <td className="p-2 text-right text-xs text-muted-foreground">{taskEffortTotal > 0 ? taskEffortTotal.toFixed(1) : (tk.person_months > 0 ? tk.person_months : '—')}</td>
                                {partners.map(p => {
                                  const eff = effortData.find(e => e.task_id === tk.id && e.partner_id === p.id)
                                  return (
                                    <td key={p.id} className="p-2 text-right tabular-nums text-[10px] text-muted-foreground">
                                      {eff && eff.person_months > 0 ? eff.person_months.toFixed(1) : ''}
                                    </td>
                                  )
                                })}
                                <td className="p-2"></td>
                              </tr>
                            )
                          })}
                          {/* Add Task row */}
                          {isExpWp && addTaskWpId === wp.id && (
                            <tr className="border-b bg-blue-50/50 dark:bg-blue-950/10">
                              <td className="p-2 pl-8">
                                <Input value={newTask.task_number} onChange={e => setNewTask(t => ({ ...t, task_number: e.target.value }))} placeholder="#" className="h-7 w-16 text-[11px]" />
                              </td>
                              <td className="p-2">
                                <div className="flex gap-2">
                                  <Input value={newTask.title} onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))} placeholder={t('collaboration.taskTitle')} className="h-7 text-[11px] flex-1" />
                                  <select value={newTask.leader_partner_id} onChange={e => setNewTask(t => ({ ...t, leader_partner_id: e.target.value }))} className="flex h-7 rounded-md border border-input bg-background px-1 text-[11px] w-28">
                                    <option value="">{t('collaboration.leader')}…</option>
                                    {partners.map(p => <option key={p.id} value={p.id}>{p.org_name}</option>)}
                                  </select>
                                  <Input type="number" value={newTask.start_month} onChange={e => setNewTask(t => ({ ...t, start_month: e.target.value }))} placeholder={t('collaboration.startM')} className="h-7 w-16 text-[11px]" />
                                  <Input type="number" value={newTask.end_month} onChange={e => setNewTask(t => ({ ...t, end_month: e.target.value }))} placeholder={t('collaboration.endM')} className="h-7 w-16 text-[11px]" />
                                </div>
                              </td>
                              <td className="p-2" colSpan={partners.length + 2}>
                                <div className="flex gap-1.5">
                                  <Button size="sm" className="h-7 text-xs" onClick={() => handleAddTask(wp.id)} disabled={!newTask.title.trim()}>{t('common.add')}</Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAddTaskWpId(null); setNewTask(emptyNewTask) }}>{t('common.cancel')}</Button>
                                </div>
                              </td>
                            </tr>
                          )}
                          {isExpWp && addTaskWpId !== wp.id && (
                            <tr className="border-b">
                              <td colSpan={3 + partners.length + 1} className="p-1.5 pl-8">
                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary" onClick={(e) => { e.stopPropagation(); setAddTaskWpId(wp.id); setNewTask(emptyNewTask) }}>
                                  <Plus className="h-3 w-3" /> {t('collaboration.addTask')}
                                </Button>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                    <tr className="bg-muted/50 font-medium">
                      <td className="p-3" colSpan={2}>{t('common.total')}</td>
                      <td className="p-3 text-right">
                        {wps.reduce((sum, w) => sum + w.total_person_months, 0).toFixed(1)}
                      </td>
                      {partners.map(p => {
                        const partnerTotal = allocs.filter(a => a.partner_id === p.id).reduce((s, a) => s + a.person_months, 0)
                        return (
                          <td key={p.id} className="p-3 text-right tabular-nums text-xs">
                            {partnerTotal > 0 ? partnerTotal.toFixed(1) : '—'}
                          </td>
                        )
                      })}
                      <td className="p-3 text-right tabular-nums">
                        {allocs.reduce((s, a) => s + a.person_months, 0).toFixed(1)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Reporting Periods Tab */}
        <TabsContent value="periods" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t('collaboration.periodsConfigured', { count: periods.length })}
            </p>
            <Button variant="outline" size="sm" onClick={() => setShowAddPeriod(!showAddPeriod)} className="gap-2">
              <Plus className="h-4 w-4" /> {t('collaboration.addPeriod')}
            </Button>
          </div>

          {showAddPeriod && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('common.title')} *</Label>
                    <Input value={newPeriod.title} onChange={e => setNewPeriod(p => ({ ...p, title: e.target.value }))} placeholder="e.g. RP1" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('collaboration.type')}</Label>
                    <select value={newPeriod.period_type} onChange={e => setNewPeriod(p => ({ ...p, period_type: e.target.value as any }))} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                      <option value="informal">{t('collaboration.informal')}</option>
                      <option value="formal">{t('collaboration.formal')}</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('collaboration.startMonth')} *</Label>
                    <Input type="number" value={newPeriod.start_month} onChange={e => setNewPeriod(p => ({ ...p, start_month: e.target.value }))} placeholder="1" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('collaboration.endMonth')} *</Label>
                    <Input type="number" value={newPeriod.end_month} onChange={e => setNewPeriod(p => ({ ...p, end_month: e.target.value }))} placeholder="18" className="h-9 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('collaboration.dueDate')}</Label>
                    <Input type="date" value={newPeriod.due_date} onChange={e => setNewPeriod(p => ({ ...p, due_date: e.target.value }))} className="h-9 text-sm" />
                  </div>
                  <div className="col-span-3 flex items-end gap-2">
                    <Button size="sm" onClick={handleAddPeriod} disabled={!newPeriod.title || !newPeriod.start_month || !newPeriod.end_month}>
                      {t('collaboration.addPeriod')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowAddPeriod(false)}>
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {periods.length === 0 && !showAddPeriod ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-2">{t('collaboration.noPeriodsConfigured')}</p>
              <p className="text-xs text-muted-foreground">
                {t('collaboration.addPeriodsDesc')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {periods.map(p => {
                const isExpanded = expandedPeriod === p.id
                const reports = periodReports[p.id] ?? []
                return (
                  <Card key={p.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <button className="text-left flex-1" onClick={() => p.reports_generated && togglePeriod(p.id)}>
                          <div className="flex items-center gap-2">
                            <Badge variant={p.period_type === 'formal' ? 'default' : 'secondary'}>
                              {p.period_type}
                            </Badge>
                            <span className="font-medium">{p.title}</span>
                            {p.reports_generated && reports.length > 0 && (() => {
                              const statusCounts = reports.reduce((acc, r) => {
                                acc[r.status] = (acc[r.status] || 0) + 1
                                return acc
                              }, {} as Record<string, number>)
                              return (
                                <span className="flex items-center gap-1.5 text-[10px]">
                                  {isExpanded ? '▾' : '▸'}
                                  {statusCounts.approved && <Badge variant="secondary" className="h-4 text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{statusCounts.approved} {t('collaboration.approved')}</Badge>}
                                  {statusCounts.submitted && <Badge variant="secondary" className="h-4 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{statusCounts.submitted} {t('collaboration.submitted')}</Badge>}
                                  {statusCounts.draft && <Badge variant="secondary" className="h-4 text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">{statusCounts.draft} {t('collaboration.draft')}</Badge>}
                                  {statusCounts.rejected && <Badge variant="secondary" className="h-4 text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{statusCounts.rejected} {t('collaboration.returned')}</Badge>}
                                </span>
                              )
                            })()}
                            {p.reports_generated && reports.length === 0 && (
                              <span className="text-xs text-muted-foreground">
                                {isExpanded ? '▾' : '▸'} reports
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Month {p.start_month} – {p.end_month}
                            {p.due_date && ` · Due: ${p.due_date}`}
                          </p>
                        </button>
                        <div className="flex items-center gap-2">
                          {p.reports_generated ? (
                            <Button size="sm" variant="ghost" onClick={() => togglePeriod(p.id)} className="gap-1.5 text-xs">
                              <FileText className="h-3.5 w-3.5" /> {isExpanded ? t('collaboration.hideReports') : t('collaboration.viewReports')}
                            </Button>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleGenerateReports(p.id)} className="gap-1.5 text-xs">
                                <FileText className="h-3.5 w-3.5" /> {t('collaboration.generateReports')}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => startEditPeriod(p)} className="h-8 w-8 p-0">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDeletePeriod(p.id, p.title)} className="h-8 w-8 p-0">
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {editPeriodId === p.id && (
                        <div className="mt-3 pt-3 border-t space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">{t('common.title')} *</Label>
                              <Input value={editPeriod.title} onChange={e => setEditPeriod(ep => ({ ...ep, title: e.target.value }))} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">{t('collaboration.type')}</Label>
                              <select value={editPeriod.period_type} onChange={e => setEditPeriod(ep => ({ ...ep, period_type: e.target.value as any }))} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                                <option value="informal">{t('collaboration.informal')}</option>
                                <option value="formal">{t('collaboration.formal')}</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">{t('collaboration.startMonth')}</Label>
                              <Input type="number" value={editPeriod.start_month} onChange={e => setEditPeriod(ep => ({ ...ep, start_month: e.target.value }))} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">{t('collaboration.endMonth')}</Label>
                              <Input type="number" value={editPeriod.end_month} onChange={e => setEditPeriod(ep => ({ ...ep, end_month: e.target.value }))} className="h-9 text-sm" />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">{t('collaboration.dueDate')}</Label>
                              <Input type="date" value={editPeriod.due_date} onChange={e => setEditPeriod(ep => ({ ...ep, due_date: e.target.value }))} className="h-9 text-sm" />
                            </div>
                            <div className="col-span-3 flex items-end gap-2">
                              <Button size="sm" onClick={handleUpdatePeriod} disabled={!editPeriod.title || !editPeriod.start_month || !editPeriod.end_month}>
                                {t('common.saveChanges')}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditPeriodId(null)}>
                                {t('common.cancel')}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t space-y-1.5">
                          {reports.length === 0 ? (
                            <p className="text-xs text-muted-foreground">{t('common.loading')}...</p>
                          ) : (
                            reports.map(r => {
                              const rPartner = r.partner
                              const statusColor: Record<string, string> = {
                                draft: 'bg-slate-100 text-slate-700',
                                submitted: 'bg-blue-100 text-blue-800',
                                approved: 'bg-emerald-100 text-emerald-800',
                                rejected: 'bg-red-100 text-red-800',
                              }
                              return (
                                <div key={r.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">
                                      {rPartner?.org_name ?? `Partner #${rPartner?.participant_number ?? '?'}`}
                                    </span>
                                    <Badge variant="outline" className={`text-[10px] ${statusColor[r.status] ?? ''}`}>
                                      {r.status}
                                    </Badge>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => navigate(`/projects/collaboration/report/${r.id}`)}
                                  >
                                    {r.status === 'submitted' ? t('collaboration.review') : t('collaboration.open')}
                                  </Button>
                                </div>
                              )
                            })
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Reports Tab — EC-compatible report generation */}
        <TabsContent value="reports" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">{t('collaboration.reportsTabDesc')}</p>

          {/* Periodic Technical Report */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    {t('collaboration.periodicTechnicalReport')}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-lg">{t('collaboration.periodicTechnicalReportDesc')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    defaultValue=""
                    id="tech-report-period"
                  >
                    <option value="" disabled>{t('collaboration.selectPeriod')}</option>
                    {periods.map(p => (
                      <option key={p.id} value={p.id}>{p.title} (M{p.start_month}–M{p.end_month})</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      const periodId = (document.getElementById('tech-report-period') as HTMLSelectElement)?.value
                      if (!periodId) { toast({ title: t('collaboration.selectPeriodFirst'), variant: 'destructive' }); return }
                      const period = periods.find(p => p.id === periodId)
                      if (!period || !project) return
                      import('@/services/reportGenerator').then(mod => {
                        mod.generateCollabPeriodicReportPDF(project, partners, wps, tasksByWp, deliverables, milestones, period, periodReports[periodId] ?? [])
                      })
                    }}
                  >
                    <Download className="h-4 w-4" /> {t('collaboration.generatePdf')}
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400" /> {t('collaboration.reportIncludesObjectives')}</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> {t('collaboration.reportIncludesWpProgress')}</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> {t('collaboration.reportIncludesDeliverables')}</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-400" /> {t('collaboration.reportIncludesMilestones')}</div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Statement (Form C) */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-500" />
                    {t('collaboration.financialStatement')}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-lg">{t('collaboration.financialStatementDesc')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    defaultValue=""
                    id="fin-report-period"
                  >
                    <option value="" disabled>{t('collaboration.selectPeriod')}</option>
                    {periods.filter(p => p.reports_generated).map(p => (
                      <option key={p.id} value={p.id}>{p.title} (M{p.start_month}–M{p.end_month})</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      const periodId = (document.getElementById('fin-report-period') as HTMLSelectElement)?.value
                      if (!periodId) { toast({ title: t('collaboration.selectPeriodFirst'), variant: 'destructive' }); return }
                      const period = periods.find(p => p.id === periodId)
                      if (!period || !project) return
                      import('@/services/reportGenerator').then(mod => {
                        mod.generateCollabFinancialStatementPDF(project, partners, period, periodReports[periodId] ?? [])
                      })
                    }}
                  >
                    <Download className="h-4 w-4" /> {t('collaboration.generatePdf')}
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> {t('collaboration.reportIncludesCostBreakdown')}</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400" /> {t('collaboration.reportIncludesPerPartner')}</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> {t('collaboration.reportIncludesIndirectCosts')}</div>
              </div>
            </CardContent>
          </Card>

          {/* Publishable Summary */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-violet-500" />
                    {t('collaboration.publishableSummary')}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-lg">{t('collaboration.publishableSummaryDesc')}</p>
                </div>
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    if (!project) return
                    import('@/services/reportGenerator').then(mod => {
                      mod.generateCollabPublishableSummaryPDF(project, partners, wps, deliverables, milestones)
                    })
                  }}
                >
                  <Download className="h-4 w-4" /> {t('collaboration.generatePdf')}
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-400" /> {t('collaboration.reportIncludesConsortium')}</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400" /> {t('collaboration.reportIncludesWorkPlan')}</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> {t('collaboration.reportIncludesImpact')}</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deliverables & Milestones Tab */}
        <TabsContent value="deliverables" className="mt-4 space-y-6">
          {/* Deliverables */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">{t('collaboration.deliverables')}</h3>
              <Badge variant="secondary" className="text-[10px]">{deliverables.length}</Badge>
            </div>
            {deliverables.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">{t('collaboration.noDeliverablesYet')}</p>
            ) : (
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium text-xs w-20">#</th>
                        <th className="px-3 py-2 text-left font-medium text-xs">{t('common.title')}</th>
                        <th className="px-3 py-2 text-left font-medium text-xs w-16">{t('collaboration.wp')}</th>
                        <th className="px-3 py-2 text-left font-medium text-xs w-20">{t('collaboration.type')}</th>
                        <th className="px-3 py-2 text-left font-medium text-xs w-24">{t('collaboration.dissemination')}</th>
                        <th className="px-3 py-2 text-left font-medium text-xs w-20">{t('collaboration.due')}</th>
                        <th className="px-3 py-2 text-left font-medium text-xs">{t('collaboration.lead')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliverables.map((d, idx) => {
                        const wp = d.wp_id ? wps.find(w => w.id === d.wp_id) : null
                        const leader = d.leader_partner_id ? partners.find(p => p.id === d.leader_partner_id) : null
                        return (
                          <tr key={d.id} className={`border-b last:border-0 ${idx % 2 === 1 ? 'bg-muted/[0.03]' : ''}`}>
                            <td className="px-3 py-2 font-mono text-xs">{d.number}</td>
                            <td className="px-3 py-2">{d.title}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{wp ? `WP${wp.wp_number}` : '—'}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground capitalize">{d.type || '—'}</td>
                            <td className="px-3 py-2 text-xs">
                              {d.dissemination ? (
                                <Badge variant="outline" className="text-[10px] capitalize">{d.dissemination}</Badge>
                              ) : '—'}
                            </td>
                            <td className="px-3 py-2 text-xs font-mono">M{d.due_month}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{leader?.org_name ?? '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Milestones */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">{t('collaboration.milestones')}</h3>
              <Badge variant="secondary" className="text-[10px]">{milestones.length}</Badge>
            </div>
            {milestones.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">{t('collaboration.noMilestonesYet')}</p>
            ) : (
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium text-xs w-20">#</th>
                        <th className="px-3 py-2 text-left font-medium text-xs">{t('common.title')}</th>
                        <th className="px-3 py-2 text-left font-medium text-xs w-16">{t('collaboration.wp')}</th>
                        <th className="px-3 py-2 text-left font-medium text-xs w-20">{t('collaboration.due')}</th>
                        <th className="px-3 py-2 text-left font-medium text-xs">{t('collaboration.verificationMeans')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {milestones.map((m, idx) => {
                        const wp = m.wp_id ? wps.find(w => w.id === m.wp_id) : null
                        return (
                          <tr key={m.id} className={`border-b last:border-0 ${idx % 2 === 1 ? 'bg-muted/[0.03]' : ''}`}>
                            <td className="px-3 py-2 font-mono text-xs">{m.number}</td>
                            <td className="px-3 py-2">{m.title}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{wp ? `WP${wp.wp_number}` : '—'}</td>
                            <td className="px-3 py-2 text-xs font-mono">M{m.due_month}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{m.verification_means || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Gantt / Timeline Tab */}
        <TabsContent value="gantt" className="mt-4">
          <CollabGanttChart
            project={project}
            partners={partners}
            wps={wps}
            tasksByWp={tasksByWp}
            deliverables={deliverables}
            milestones={milestones}
            periods={periods}
          />
        </TabsContent>

        {/* Budget Overview Tab */}
        <TabsContent value="budget" className="mt-4 space-y-4">
          {partners.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t('collaboration.addPartnersForBudget')}</p>
          ) : (<>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => generateCollabBudgetPDF(project.acronym, partners, orgName || '')} className="gap-2">
                <Download className="h-4 w-4" /> {t('collaboration.exportPdf')}
              </Button>
            </div>
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-3 font-medium sticky left-0 bg-background">{t('collaboration.partner')}</th>
                      <th className="p-3 font-medium">{t('collaboration.country')}</th>
                      <th className="p-3 font-medium text-right">{t('collaboration.personnel')}</th>
                      <th className="p-3 font-medium text-right">{t('collaboration.subcontracting')}</th>
                      <th className="p-3 font-medium text-right">{t('collaboration.travel')}</th>
                      <th className="p-3 font-medium text-right">{t('collaboration.equipment')}</th>
                      <th className="p-3 font-medium text-right">{t('collaboration.otherGoods')}</th>
                      <th className="p-3 font-medium text-right">{t('collaboration.totalDirect')}</th>
                      <th className="p-3 font-medium text-right">{t('collaboration.indirect')}</th>
                      <th className="p-3 font-medium text-right font-bold">{t('collaboration.grandTotal')}</th>
                      <th className="p-3 font-medium text-right">{t('collaboration.funding')}</th>
                      <th className="p-3 font-medium text-right">{t('collaboration.pms')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.map(p => {
                      const direct = p.budget_personnel + p.budget_subcontracting + p.budget_travel + p.budget_equipment + p.budget_other_goods
                      const indirectBase = p.indirect_cost_base === 'personnel_only'
                        ? p.budget_personnel
                        : p.indirect_cost_base === 'all_except_subcontracting'
                          ? direct - p.budget_subcontracting
                          : direct
                      const indirect = indirectBase * (p.indirect_cost_rate / 100)
                      const grand = direct + indirect
                      const funding = grand * (p.funding_rate / 100)
                      return (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-3 font-medium sticky left-0 bg-background">
                            <div className="flex items-center gap-1.5">
                              <Badge variant={p.role === 'coordinator' ? 'default' : 'secondary'} className="text-[10px]">
                                {p.role === 'coordinator' ? 'C' : `#${p.participant_number}`}
                              </Badge>
                              {p.org_name}
                            </div>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">{p.country || '—'}</td>
                          <td className="p-3 text-right tabular-nums">€{p.budget_personnel.toLocaleString()}</td>
                          <td className="p-3 text-right tabular-nums">€{p.budget_subcontracting.toLocaleString()}</td>
                          <td className="p-3 text-right tabular-nums">€{p.budget_travel.toLocaleString()}</td>
                          <td className="p-3 text-right tabular-nums">€{p.budget_equipment.toLocaleString()}</td>
                          <td className="p-3 text-right tabular-nums">€{p.budget_other_goods.toLocaleString()}</td>
                          <td className="p-3 text-right tabular-nums font-medium">€{direct.toLocaleString()}</td>
                          <td className="p-3 text-right tabular-nums text-muted-foreground">€{Math.round(indirect).toLocaleString()}</td>
                          <td className="p-3 text-right tabular-nums font-bold">€{Math.round(grand).toLocaleString()}</td>
                          <td className="p-3 text-right tabular-nums text-muted-foreground">€{Math.round(funding).toLocaleString()}</td>
                          <td className="p-3 text-right tabular-nums">{p.total_person_months}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    {(() => {
                      const totals = partners.reduce((acc, p) => {
                        const direct = p.budget_personnel + p.budget_subcontracting + p.budget_travel + p.budget_equipment + p.budget_other_goods
                        const indirectBase = p.indirect_cost_base === 'personnel_only'
                          ? p.budget_personnel
                          : p.indirect_cost_base === 'all_except_subcontracting'
                            ? direct - p.budget_subcontracting
                            : direct
                        const indirect = indirectBase * (p.indirect_cost_rate / 100)
                        const grand = direct + indirect
                        const funding = grand * (p.funding_rate / 100)
                        return {
                          personnel: acc.personnel + p.budget_personnel,
                          subcontracting: acc.subcontracting + p.budget_subcontracting,
                          travel: acc.travel + p.budget_travel,
                          equipment: acc.equipment + p.budget_equipment,
                          other: acc.other + p.budget_other_goods,
                          direct: acc.direct + direct,
                          indirect: acc.indirect + indirect,
                          grand: acc.grand + grand,
                          funding: acc.funding + funding,
                          pms: acc.pms + p.total_person_months,
                        }
                      }, { personnel: 0, subcontracting: 0, travel: 0, equipment: 0, other: 0, direct: 0, indirect: 0, grand: 0, funding: 0, pms: 0 })
                      return (
                        <tr className="bg-muted/50 font-medium border-t-2">
                          <td className="p-3 sticky left-0 bg-muted/50">{t('common.total')} ({t('collaboration.partnerCount', { count: partners.length })})</td>
                          <td className="p-3"></td>
                          <td className="p-3 text-right tabular-nums">€{totals.personnel.toLocaleString()}</td>
                          <td className="p-3 text-right tabular-nums">€{totals.subcontracting.toLocaleString()}</td>
                          <td className="p-3 text-right tabular-nums">€{totals.travel.toLocaleString()}</td>
                          <td className="p-3 text-right tabular-nums">€{totals.equipment.toLocaleString()}</td>
                          <td className="p-3 text-right tabular-nums">€{totals.other.toLocaleString()}</td>
                          <td className="p-3 text-right tabular-nums">€{totals.direct.toLocaleString()}</td>
                          <td className="p-3 text-right tabular-nums">€{Math.round(totals.indirect).toLocaleString()}</td>
                          <td className="p-3 text-right tabular-nums font-bold">€{Math.round(totals.grand).toLocaleString()}</td>
                          <td className="p-3 text-right tabular-nums">€{Math.round(totals.funding).toLocaleString()}</td>
                          <td className="p-3 text-right tabular-nums">{totals.pms.toFixed(1)}</td>
                        </tr>
                      )
                    })()}
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          </>)}
        </TabsContent>

        {/* Effort Overview Tab */}
        <TabsContent value="effort" className="mt-4 space-y-4">
          {partners.length === 0 || wps.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t('collaboration.addPartnersWpsForEffort')}</p>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left bg-muted/50">
                      <th className="p-3 font-medium sticky left-0 bg-muted/50">{t('collaboration.wpTask')}</th>
                      {partners.map(p => (
                        <th key={p.id} className="p-3 font-medium text-right text-xs min-w-[80px]" title={p.org_name}>
                          <div className="truncate max-w-[80px]">{p.org_name}</div>
                          <div className="text-[10px] text-muted-foreground font-normal">{p.role === 'coordinator' ? t('collaboration.coord') : `#${p.participant_number}`}</div>
                        </th>
                      ))}
                      <th className="p-3 font-medium text-right w-24">{t('common.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wps.map(wp => {
                      const wpTasks = tasksByWp[wp.id] ?? []
                      // Compute per-partner PMs for this WP (sum of task efforts)
                      const wpPartnerPMs = partners.map(p => {
                        return wpTasks.reduce((s, tk) => {
                          const eff = effortData.find(e => e.task_id === tk.id && e.partner_id === p.id)
                          return s + (eff?.person_months ?? 0)
                        }, 0)
                      })
                      const wpTotal = wpPartnerPMs.reduce((s, v) => s + v, 0)
                      return (
                        <React.Fragment key={wp.id}>
                          <tr className="border-b bg-primary/[0.03] font-medium">
                            <td className="p-2.5 sticky left-0 bg-primary/[0.03]">
                              <span className="font-mono text-xs mr-1.5">WP{wp.wp_number}</span>
                              {wp.title}
                            </td>
                            {wpPartnerPMs.map((pm, i) => (
                              <td key={partners[i].id} className="p-2.5 text-right tabular-nums text-xs">
                                {pm > 0 ? pm.toFixed(1) : <span className="text-muted-foreground/40">—</span>}
                              </td>
                            ))}
                            <td className="p-2.5 text-right tabular-nums font-bold">
                              {wpTotal > 0 ? wpTotal.toFixed(1) : '—'}
                            </td>
                          </tr>
                          {wpTasks.map(tk => {
                            const taskPartnerPMs = partners.map(p => {
                              const eff = effortData.find(e => e.task_id === tk.id && e.partner_id === p.id)
                              return eff?.person_months ?? 0
                            })
                            const taskTotal = taskPartnerPMs.reduce((s, v) => s + v, 0)
                            return (
                              <tr key={tk.id} className="border-b">
                                <td className="p-2 pl-8 sticky left-0 bg-background text-xs text-muted-foreground">
                                  <span className="font-mono mr-1">{tk.task_number}</span>
                                  {tk.title}
                                </td>
                                {taskPartnerPMs.map((pm, i) => (
                                  <td key={partners[i].id} className="p-2 text-right tabular-nums text-[11px] text-muted-foreground">
                                    {pm > 0 ? pm.toFixed(1) : ''}
                                  </td>
                                ))}
                                <td className="p-2 text-right tabular-nums text-xs font-medium">
                                  {taskTotal > 0 ? taskTotal.toFixed(1) : (tk.person_months > 0 ? tk.person_months.toFixed(1) : '')}
                                </td>
                              </tr>
                            )
                          })}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 font-medium border-t-2">
                      <td className="p-3 sticky left-0 bg-muted/50">{t('common.total')}</td>
                      {partners.map(p => {
                        const partnerTotal = effortData.filter(e => e.partner_id === p.id).reduce((s, e) => s + e.person_months, 0)
                        return (
                          <td key={p.id} className="p-3 text-right tabular-nums text-xs">
                            {partnerTotal > 0 ? partnerTotal.toFixed(1) : '—'}
                          </td>
                        )
                      })}
                      <td className="p-3 text-right tabular-nums font-bold">
                        {effortData.reduce((s, e) => s + e.person_months, 0).toFixed(1)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Documents Tab ────────────────────────────────────── */}
        <TabsContent value="documents" className="mt-4">
          {id && <DocumentList projectId={id} />}
        </TabsContent>
      </Tabs>
      <EditProjectDialog
        project={project}
        open={showProjectDialog}
        onClose={() => setShowProjectDialog(false)}
        onSaved={load}
      />
      <EditPartnerDialog
        partner={editPartner}
        projectId={id!}
        open={showPartnerDialog}
        onClose={() => setShowPartnerDialog(false)}
        onSaved={load}
      />
      <EditWpDialog
        projectId={id!}
        existing={wps}
        open={showWpDialog}
        onClose={() => setShowWpDialog(false)}
        onSaved={load}
      />
      {allocPartner && (
        <EditAllocDialog
          partner={allocPartner}
          wps={wps}
          open={!!allocPartner}
          onClose={() => setAllocPartner(null)}
          onSaved={load}
        />
      )}
      {contactPartner && (
        <EditContactDialog
          partnerId={contactPartner.id}
          partnerName={contactPartner.org_name}
          open={!!contactPartner}
          onClose={() => setContactPartner(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
