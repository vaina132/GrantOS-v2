import { supabase } from '@/lib/supabase'
import type {
  CollabProject,
  CollabPartner,
  CollabWorkPackage,
  CollabPartnerWpAlloc,
  CollabContact,
  CollabReportingPeriod,
  CollabReport,
  CollabReportLine,
  CollabReportEvent,
  CollabPartnerRole,
  CollabIndirectCostBase,
  CollabTask,
  CollabDeliverable,
  CollabMilestone,
  CollabPartnerTaskEffort,
  CollabProjectStatus,
  ProjectStatus,
} from '@/types'

// ============================================================================
// Legacy shim — after the merge, collab_* tables are gone.
// This service now reads/writes the unified `projects` + `project_*` tables,
// translating column names and status values so the existing UI keeps working
// with the Collab* types until the UI-merge step renames everything.
// ============================================================================

// The new project_* tables aren't yet in the generated database.types.ts
// file, so use a type-erased handle for those. Re-generate the types file
// (npx supabase gen types) to drop this.
const sb = supabase as any

// ---- status translation --------------------------------------------------
const COLLAB_TO_PROJECT_STATUS: Record<CollabProjectStatus, ProjectStatus> = {
  draft: 'Upcoming',
  active: 'Active',
  archived: 'Completed',
}

function projectStatusToCollab(s: string | null | undefined): CollabProjectStatus {
  switch (s) {
    case 'Upcoming':
      return 'draft'
    case 'Active':
    case 'Concluding':
      return 'active'
    case 'Completed':
    case 'Suspended':
      return 'archived'
    default:
      return 'draft'
  }
}

// ---- row → Collab* shape adapters ----------------------------------------
function rowToCollabProject(r: any): CollabProject {
  return {
    id: r.id,
    host_org_id: r.org_id,
    title: r.title,
    acronym: r.acronym,
    grant_number: r.grant_number ?? null,
    funding_programme: r.funding_programme ?? null,
    funding_scheme: null,
    start_date: r.start_date ?? null,
    end_date: r.end_date ?? null,
    duration_months: r.duration_months ?? null,
    status: projectStatusToCollab(r.status),
    deviation_personnel_effort: Number(r.deviation_personnel_effort ?? 20),
    deviation_personnel_costs: Number(r.deviation_personnel_costs ?? 20),
    deviation_pm_rate: Number(r.deviation_pm_rate ?? 20),
    reminder_settings: r.reminder_settings ?? {
      deliverables: { enabled: true, lead_time: 14, unit: 'days' },
      milestones: { enabled: true, lead_time: 14, unit: 'days' },
      reports: { enabled: true, lead_time: 7, unit: 'days' },
    },
    created_by: r.created_by ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    partners: r.partners ? (r.partners as any[]).map(rowToCollabPartner) : undefined,
    work_packages: r.work_packages
      ? (r.work_packages as any[]).map(rowToCollabWorkPackage)
      : undefined,
  }
}

function rowToCollabPartner(r: any): CollabPartner {
  return {
    id: r.id,
    project_id: r.project_id,
    org_name: r.org_name,
    role: (r.role === 'host' ? 'coordinator' : r.role) as CollabPartnerRole,
    participant_number: r.participant_number ?? null,
    contact_name: r.contact_name ?? null,
    contact_email: r.contact_email ?? null,
    country: r.country ?? null,
    org_type: r.org_type ?? null,
    budget_personnel: Number(r.budget_personnel ?? 0),
    budget_subcontracting: Number(r.budget_subcontracting ?? 0),
    budget_travel: Number(r.budget_travel ?? 0),
    budget_equipment: Number(r.budget_equipment ?? 0),
    budget_other_goods: Number(r.budget_other_goods ?? 0),
    total_person_months: Number(r.total_person_months ?? 0),
    funding_rate: Number(r.funding_rate ?? 100),
    indirect_cost_rate: Number(r.indirect_cost_rate ?? 25),
    indirect_cost_base: (r.indirect_cost_base ?? 'all_direct') as CollabIndirectCostBase,
    user_id: r.user_id ?? null,
    linked_org_id: r.linked_org_id ?? null,
    invite_status: r.invite_status,
    invite_token: r.invite_token ?? null,
    is_host: !!r.is_host,
    created_at: r.created_at,
    updated_at: r.updated_at,
    contacts: r.contacts ? (r.contacts as any[]).map(rowToCollabContact) : undefined,
    wp_allocations: r.wp_allocations
      ? (r.wp_allocations as any[]).map(rowToCollabAlloc)
      : undefined,
  }
}

function rowToCollabWorkPackage(r: any): CollabWorkPackage {
  return {
    id: r.id,
    project_id: r.project_id,
    wp_number: Number(r.number ?? 0),
    title: r.name ?? '',
    total_person_months: Number(r.total_person_months ?? 0),
    start_month: r.start_month ?? null,
    end_month: r.end_month ?? null,
    leader_partner_id: r.leader_partner_id ?? null,
    created_at: r.created_at,
    tasks: r.tasks ? (r.tasks as any[]).map(rowToCollabTask) : undefined,
  }
}

function rowToCollabTask(r: any): CollabTask {
  return {
    id: r.id,
    wp_id: r.wp_id,
    project_id: r.project_id,
    task_number: r.task_number,
    title: r.title,
    description: r.description ?? null,
    start_month: r.start_month ?? null,
    end_month: r.end_month ?? null,
    leader_partner_id: r.leader_partner_id ?? null,
    person_months: Number(r.person_months ?? 0),
    created_at: r.created_at,
    effort: r.effort ? (r.effort as any[]).map(rowToCollabEffort) : undefined,
  }
}

function rowToCollabEffort(r: any): CollabPartnerTaskEffort {
  return {
    id: r.id,
    task_id: r.task_id,
    partner_id: r.partner_id,
    person_months: Number(r.person_months ?? 0),
    created_at: r.created_at,
  }
}

function rowToCollabAlloc(r: any): CollabPartnerWpAlloc {
  return {
    id: r.id,
    partner_id: r.partner_id,
    wp_id: r.wp_id,
    person_months: Number(r.person_months ?? 0),
    created_at: r.created_at,
    work_package: r.work_package ? rowToCollabWorkPackage(r.work_package) : undefined,
  }
}

function rowToCollabContact(r: any): CollabContact {
  return {
    id: r.id,
    partner_id: r.partner_id,
    name: r.name,
    email: r.email,
    role_note: r.role_note ?? null,
    notify_reminders: !!r.notify_reminders,
    notify_approvals: !!r.notify_approvals,
    notify_rejections: !!r.notify_rejections,
    created_at: r.created_at,
  }
}

function rowToCollabDeliverable(r: any): CollabDeliverable {
  return {
    id: r.id,
    project_id: r.project_id,
    wp_id: r.work_package_id ?? null,
    task_id: null,
    number: r.number,
    title: r.title,
    description: r.description ?? null,
    type: r.type ?? null,
    dissemination: r.dissemination ?? null,
    due_month: Number(r.due_month ?? 0),
    leader_partner_id: r.leader_partner_id ?? null,
    created_at: r.created_at,
  }
}

function rowToCollabMilestone(r: any): CollabMilestone {
  return {
    id: r.id,
    project_id: r.project_id,
    wp_id: r.work_package_id ?? null,
    number: r.number,
    title: r.title,
    description: r.description ?? null,
    due_month: Number(r.due_month ?? 0),
    verification_means: r.verification_means ?? null,
    created_at: r.created_at,
  }
}

function rowToCollabPeriod(r: any): CollabReportingPeriod {
  return {
    id: r.id,
    project_id: r.project_id,
    period_type: r.period_type ?? 'formal',
    title: r.title ?? `Period ${r.period_number ?? ''}`,
    start_month: Number(r.start_month ?? 0),
    end_month: Number(r.end_month ?? 0),
    due_date: r.due_date ?? null,
    reports_generated: !!r.reports_generated,
    beneficiaries_notified: !!r.beneficiaries_notified,
    created_at: r.created_at,
    updated_at: r.updated_at,
    reports: r.reports ? (r.reports as any[]) : undefined,
  }
}

function rowToCollabReport(r: any): CollabReport {
  return {
    id: r.id,
    period_id: r.period_id,
    partner_id: r.partner_id,
    status: r.status,
    submitted_at: r.submitted_at ?? null,
    reviewed_at: r.reviewed_at ?? null,
    reviewed_by: r.reviewed_by ?? null,
    rejection_note: r.rejection_note ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    partner: r.partner ? rowToCollabPartner(r.partner) : undefined,
    period: r.period ? rowToCollabPeriod(r.period) : undefined,
    lines: r.lines ? (r.lines as any[]).map(rowToCollabReportLine) : undefined,
    events: r.events ? (r.events as any[]).map(rowToCollabReportEvent) : undefined,
  }
}

function rowToCollabReportLine(r: any): CollabReportLine {
  return {
    id: r.id,
    report_id: r.report_id,
    section: r.section,
    wp_id: r.wp_id ?? null,
    line_order: Number(r.line_order ?? 0),
    data: r.data ?? {},
    justification: r.justification ?? null,
    justification_required: !!r.justification_required,
    created_at: r.created_at,
    updated_at: r.updated_at,
    work_package: r.work_package ? rowToCollabWorkPackage(r.work_package) : undefined,
  }
}

function rowToCollabReportEvent(r: any): CollabReportEvent {
  return {
    id: r.id,
    report_id: r.report_id,
    event_type: r.event_type,
    actor_user_id: r.actor_user_id ?? null,
    actor_name: r.actor_name ?? null,
    actor_role: r.actor_role ?? null,
    note: r.note ?? null,
    created_at: r.created_at,
  }
}

// ============================================================================
// Projects  (collab ⇄ unified `projects` table)
// ============================================================================

export const collabProjectService = {
  /** List projects owned by the host org that have at least one external partner. */
  async list(hostOrgId: string): Promise<CollabProject[]> {
    const { data: extIds } = await sb
      .from('project_partners')
      .select('project_id')
      .eq('is_host', false)
    const externalProjectIds: string[] = Array.from(new Set<string>(((extIds ?? []) as any[]).map(r => r.project_id)))

    let query = supabase
      .from('projects')
      .select('*, partners:project_partners(id, org_name, role, invite_status, is_host)')
      .eq('org_id', hostOrgId)
      .order('created_at', { ascending: false })

    if (externalProjectIds.length > 0) {
      query = query.in('id', externalProjectIds)
    } else {
      return []
    }

    const { data, error } = await query
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToCollabProject)
  },

  /** List projects where the current user is an accepted external partner. */
  async listForPartner(userId: string): Promise<CollabProject[]> {
    const { data: partnerRows, error: pErr } = await sb
      .from('project_partners')
      .select('project_id')
      .eq('user_id', userId)
      .eq('invite_status', 'accepted')
      .eq('is_host', false)
    if (pErr) throw pErr
    const projectIds: string[] = Array.from(new Set<string>(((partnerRows ?? []) as any[]).map(r => r.project_id)))
    if (projectIds.length === 0) return []

    const { data, error } = await supabase
      .from('projects')
      .select('*, partners:project_partners(id, org_name, role, invite_status, is_host)')
      .in('id', projectIds)
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToCollabProject)
  },

  async get(id: string): Promise<CollabProject> {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        partners:project_partners(
          *,
          contacts:project_contacts(*),
          wp_allocations:project_partner_wp_allocs(*, work_package:work_packages(*))
        ),
        work_packages(*)
      `)
      .eq('id', id)
      .single()
    if (error) throw error
    return rowToCollabProject(data)
  },

  /**
   * Create a new project in collab mode. Inserts a projects row plus a
   * host-partner row representing the creating org.
   */
  async create(project: Partial<CollabProject>): Promise<CollabProject> {
    if (!project.host_org_id) throw new Error('host_org_id is required')

    const row: Record<string, any> = {
      org_id: project.host_org_id,
      title: project.title ?? 'Untitled project',
      acronym: project.acronym ?? 'NEW',
      grant_number: project.grant_number ?? null,
      funding_programme: project.funding_programme ?? null,
      status: COLLAB_TO_PROJECT_STATUS[project.status ?? 'draft'],
      start_date: project.start_date ?? new Date().toISOString().split('T')[0],
      end_date: project.end_date ?? new Date().toISOString().split('T')[0],
      duration_months: project.duration_months ?? null,
      has_wps: true,
      deviation_personnel_effort: project.deviation_personnel_effort ?? 20,
      deviation_personnel_costs: project.deviation_personnel_costs ?? 20,
      deviation_pm_rate: project.deviation_pm_rate ?? 20,
      reminder_settings: project.reminder_settings ?? undefined,
      created_by: project.created_by ?? null,
    }

    const { data: created, error } = await sb
      .from('projects')
      .insert(row)
      .select('*')
      .single()
    if (error) throw error

    // The `trg_projects_host_partner` trigger auto-creates the host partner —
    // no client-side insert needed.
    return rowToCollabProject(created)
  },

  async update(id: string, updates: Partial<CollabProject>): Promise<CollabProject> {
    const {
      host_org_id, created_at, updated_at, partners, work_packages, status, ...rest
    } = updates as any

    const row: Record<string, any> = {
      ...rest,
      updated_at: new Date().toISOString(),
    }
    if (status) row.status = COLLAB_TO_PROJECT_STATUS[status as CollabProjectStatus]

    const { data, error } = await supabase
      .from('projects')
      .update(row)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return rowToCollabProject(data)
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) throw error
  },

  async launch(id: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .update({ status: 'Active' })
      .eq('id', id)
    if (error) throw error
  },
}

// ============================================================================
// syncCollabToMyProjects — now a no-op.
// After the merge, collab projects ARE projects. There is nothing to sync.
// Kept as an exported function so callers compile; remove once the UI merge
// has removed every call site.
// ============================================================================

export async function syncCollabToMyProjects(
  _collabProjectId: string,
  _orgId: string,
): Promise<void> {
  /* no-op after projects merge */
}

// ============================================================================
// Partners
// ============================================================================

export const collabPartnerService = {
  async list(projectId: string): Promise<CollabPartner[]> {
    const { data, error } = await sb
      .from('project_partners')
      .select('*, contacts:project_contacts(*)')
      .eq('project_id', projectId)
      .order('participant_number', { ascending: true, nullsFirst: false })
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToCollabPartner)
  },

  async create(partner: {
    project_id: string
    org_name: string
    role: CollabPartnerRole
    participant_number?: number
    contact_name?: string
    contact_email?: string
    country?: string
    budget_personnel?: number
    budget_subcontracting?: number
    budget_travel?: number
    budget_equipment?: number
    budget_other_goods?: number
    total_person_months?: number
    funding_rate?: number
    indirect_cost_rate?: number
    indirect_cost_base?: CollabIndirectCostBase
    is_host?: boolean
  }): Promise<CollabPartner> {
    // A host partner is auto-created by the `trg_projects_host_partner`
    // trigger whenever a project is inserted. When the UI "creates" a host
    // partner (e.g. the coordinator row in CollabProjectSetup), we UPDATE the
    // existing stub instead of inserting a duplicate.
    if (partner.is_host) {
      const { data: existing } = await sb
        .from('project_partners')
        .select('id')
        .eq('project_id', partner.project_id)
        .eq('is_host', true)
        .limit(1)
        .maybeSingle()
      if (existing?.id) {
        const { data, error } = await sb
          .from('project_partners')
          .update(partner as any)
          .eq('id', existing.id)
          .select()
          .single()
        if (error) throw error
        return rowToCollabPartner(data)
      }
    }
    const { data, error } = await sb
      .from('project_partners')
      .insert(partner as any)
      .select()
      .single()
    if (error) throw error
    return rowToCollabPartner(data)
  },

  async update(id: string, updates: Partial<CollabPartner>): Promise<CollabPartner> {
    const {
      project_id, created_at, updated_at, contacts, wp_allocations, invite_token,
      ...clean
    } = updates as any
    const { data, error } = await sb
      .from('project_partners')
      .update(clean)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return rowToCollabPartner(data)
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb.from('project_partners').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================================
// Work Packages
// ============================================================================

export const collabWpService = {
  async list(projectId: string): Promise<CollabWorkPackage[]> {
    const { data, error } = await sb
      .from('work_packages')
      .select('*')
      .eq('project_id', projectId)
      .order('number', { ascending: true, nullsFirst: false })
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToCollabWorkPackage)
  },

  async upsertMany(projectId: string, wps: {
    wp_number: number
    title: string
    total_person_months?: number
    start_month?: number | null
    end_month?: number | null
    leader_partner_id?: string | null
  }[]): Promise<CollabWorkPackage[]> {
    // Need the project's org_id for new rows (work_packages.org_id is NOT NULL).
    const { data: pr } = await supabase
      .from('projects')
      .select('org_id')
      .eq('id', projectId)
      .single()
    const orgId = (pr as any)?.org_id
    if (!orgId) throw new Error(`Cannot find org_id for project ${projectId}`)

    await sb.from('work_packages').delete().eq('project_id', projectId)
    if (wps.length === 0) return []

    const rows = wps.map(wp => ({
      org_id: orgId,
      project_id: projectId,
      number: wp.wp_number,
      name: wp.title,
      total_person_months: wp.total_person_months ?? 0,
      start_month: wp.start_month ?? null,
      end_month: wp.end_month ?? null,
      leader_partner_id: wp.leader_partner_id ?? null,
    }))
    const { data, error } = await sb
      .from('work_packages')
      .insert(rows as any)
      .select()
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToCollabWorkPackage)
  },
}

// ============================================================================
// Tasks
// ============================================================================

export const collabTaskService = {
  async list(wpId: string): Promise<CollabTask[]> {
    const { data, error } = await (supabase as any)
      .from('project_tasks')
      .select('*, effort:project_partner_task_effort(*)')
      .eq('wp_id', wpId)
      .order('task_number', { ascending: true })
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToCollabTask)
  },

  async listByProject(projectId: string): Promise<CollabTask[]> {
    const { data, error } = await (supabase as any)
      .from('project_tasks')
      .select('*, effort:project_partner_task_effort(*)')
      .eq('project_id', projectId)
      .order('task_number', { ascending: true })
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToCollabTask)
  },

  async createMany(projectId: string, wpId: string, tasks: {
    task_number: string
    title: string
    description?: string | null
    start_month?: number | null
    end_month?: number | null
    leader_partner_id?: string | null
    person_months?: number
  }[]): Promise<CollabTask[]> {
    if (tasks.length === 0) return []
    const rows = tasks.map(t => ({ project_id: projectId, wp_id: wpId, ...t }))
    const { data, error } = await sb
      .from('project_tasks')
      .insert(rows as any)
      .select()
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToCollabTask)
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb.from('project_tasks').delete().eq('id', id)
    if (error) throw error
  },

  async update(id: string, updates: Partial<CollabTask>): Promise<CollabTask> {
    const { data, error } = await sb
      .from('project_tasks')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return rowToCollabTask(data)
  },
}

// ============================================================================
// Partner Task Effort
// ============================================================================

export const collabTaskEffortService = {
  async listByProject(projectId: string): Promise<CollabPartnerTaskEffort[]> {
    const { data: tasks } = await sb
      .from('project_tasks')
      .select('id')
      .eq('project_id', projectId)
    if (!tasks || tasks.length === 0) return []
    const taskIds = (tasks as any[]).map(t => t.id)
    const { data, error } = await (supabase as any)
      .from('project_partner_task_effort')
      .select('*')
      .in('task_id', taskIds)
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToCollabEffort)
  },

  async upsertMany(efforts: { task_id: string; partner_id: string; person_months: number }[]): Promise<void> {
    if (efforts.length === 0) return
    const { error } = await (supabase as any)
      .from('project_partner_task_effort')
      .upsert(efforts as any, { onConflict: 'task_id,partner_id' })
    if (error) throw error
  },

  async removeForTask(taskId: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('project_partner_task_effort')
      .delete()
      .eq('task_id', taskId)
    if (error) throw error
  },
}

// ============================================================================
// Deliverables
// ============================================================================

export const collabDeliverableService = {
  async list(projectId: string): Promise<CollabDeliverable[]> {
    const { data, error } = await sb
      .from('deliverables')
      .select('*')
      .eq('project_id', projectId)
      .order('number', { ascending: true })
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToCollabDeliverable)
  },

  async createMany(projectId: string, deliverables: {
    wp_id?: string | null
    task_id?: string | null
    number: string
    title: string
    description?: string | null
    type?: string | null
    dissemination?: string | null
    due_month: number
    leader_partner_id?: string | null
  }[]): Promise<CollabDeliverable[]> {
    if (deliverables.length === 0) return []

    const { data: pr } = await supabase
      .from('projects')
      .select('org_id')
      .eq('id', projectId)
      .single()
    const orgId = (pr as any)?.org_id
    if (!orgId) throw new Error(`Cannot find org_id for project ${projectId}`)

    const rows = deliverables.map(d => ({
      org_id: orgId,
      project_id: projectId,
      work_package_id: d.wp_id ?? null,
      number: d.number,
      title: d.title,
      description: d.description ?? null,
      type: d.type ?? null,
      dissemination: d.dissemination ?? null,
      due_month: d.due_month,
      leader_partner_id: d.leader_partner_id ?? null,
    }))
    const { data, error } = await sb
      .from('deliverables')
      .insert(rows as any)
      .select()
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToCollabDeliverable)
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb.from('deliverables').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================================
// Milestones
// ============================================================================

export const collabMilestoneService = {
  async list(projectId: string): Promise<CollabMilestone[]> {
    const { data, error } = await sb
      .from('milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('number', { ascending: true })
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToCollabMilestone)
  },

  async createMany(projectId: string, milestones: {
    wp_id?: string | null
    number: string
    title: string
    description?: string | null
    due_month: number
    verification_means?: string | null
  }[]): Promise<CollabMilestone[]> {
    if (milestones.length === 0) return []

    const { data: pr } = await supabase
      .from('projects')
      .select('org_id')
      .eq('id', projectId)
      .single()
    const orgId = (pr as any)?.org_id
    if (!orgId) throw new Error(`Cannot find org_id for project ${projectId}`)

    const rows = milestones.map(m => ({
      org_id: orgId,
      project_id: projectId,
      work_package_id: m.wp_id ?? null,
      number: m.number,
      title: m.title,
      description: m.description ?? null,
      due_month: m.due_month,
      verification_means: m.verification_means ?? null,
    }))
    const { data, error } = await sb
      .from('milestones')
      .insert(rows as any)
      .select()
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToCollabMilestone)
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb.from('milestones').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================================
// Partner–WP Allocations
// ============================================================================

export const collabAllocService = {
  async list(partnerId: string): Promise<CollabPartnerWpAlloc[]> {
    const { data, error } = await sb
      .from('project_partner_wp_allocs')
      .select('*, work_package:work_packages(*)')
      .eq('partner_id', partnerId)
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToCollabAlloc)
  },

  async upsertMany(partnerId: string, allocs: { wp_id: string; person_months: number }[]): Promise<void> {
    await sb.from('project_partner_wp_allocs').delete().eq('partner_id', partnerId)
    if (allocs.length === 0) return
    const rows = allocs.map(a => ({ partner_id: partnerId, ...a }))
    const { error } = await sb
      .from('project_partner_wp_allocs')
      .insert(rows as any)
    if (error) throw error
  },
}

// ============================================================================
// Contacts
// ============================================================================

export const collabContactService = {
  async list(partnerId: string): Promise<CollabContact[]> {
    const { data, error } = await sb
      .from('project_contacts')
      .select('*')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToCollabContact)
  },

  async create(contact: Omit<CollabContact, 'id' | 'created_at'>): Promise<CollabContact> {
    const { data, error } = await sb
      .from('project_contacts')
      .insert(contact as any)
      .select()
      .single()
    if (error) throw error
    return rowToCollabContact(data)
  },

  async update(id: string, updates: Partial<CollabContact>): Promise<CollabContact> {
    const { partner_id, created_at, ...clean } = updates as any
    const { data, error } = await sb
      .from('project_contacts')
      .update(clean)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return rowToCollabContact(data)
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb.from('project_contacts').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================================
// Reporting Periods
// ============================================================================

export const collabPeriodService = {
  async list(projectId: string): Promise<CollabReportingPeriod[]> {
    const { data, error } = await sb
      .from('reporting_periods')
      .select('*, reports:project_reports(id, partner_id, status)')
      .eq('project_id', projectId)
      .order('start_month', { ascending: true })
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToCollabPeriod)
  },

  async create(period: {
    project_id: string
    period_type: 'formal' | 'informal'
    title: string
    start_month: number
    end_month: number
    due_date?: string
  }): Promise<CollabReportingPeriod> {
    const { data: pr } = await supabase
      .from('projects')
      .select('org_id')
      .eq('id', period.project_id)
      .single()
    const orgId = (pr as any)?.org_id
    if (!orgId) throw new Error(`Cannot find org_id for project ${period.project_id}`)

    const row: Record<string, any> = {
      org_id: orgId,
      project_id: period.project_id,
      period_type: period.period_type,
      title: period.title,
      start_month: period.start_month,
      end_month: period.end_month,
      due_date: period.due_date ?? null,
      period_number: 1,
    }
    const { data, error } = await sb
      .from('reporting_periods')
      .insert(row)
      .select()
      .single()
    if (error) throw error
    return rowToCollabPeriod(data)
  },

  async update(id: string, updates: Partial<CollabReportingPeriod>): Promise<CollabReportingPeriod> {
    const { project_id, created_at, updated_at, reports, ...clean } = updates as any
    const { data, error } = await sb
      .from('reporting_periods')
      .update(clean)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return rowToCollabPeriod(data)
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb.from('reporting_periods').delete().eq('id', id)
    if (error) throw error
  },

  async generateReports(periodId: string, projectId: string): Promise<void> {
    const { data: partners, error: pErr } = await sb
      .from('project_partners')
      .select('id')
      .eq('project_id', projectId)
    if (pErr) throw pErr

    const reports = ((partners ?? []) as any[]).map(p => ({
      period_id: periodId,
      partner_id: p.id,
      status: 'draft',
    }))
    if (reports.length > 0) {
      const { error: rErr } = await sb
        .from('project_reports')
        .insert(reports as any)
      if (rErr) throw rErr
    }

    await sb
      .from('reporting_periods')
      .update({ reports_generated: true })
      .eq('id', periodId)

    const { data: createdReports } = await sb
      .from('project_reports')
      .select('id')
      .eq('period_id', periodId)
    if (createdReports) {
      const events = (createdReports as any[]).map(r => ({
        report_id: r.id,
        event_type: 'generated',
        actor_role: 'system',
        note: 'Report generated for reporting period',
      }))
      await sb.from('project_report_events').insert(events as any)
    }
  },
}

// ============================================================================
// Reports
// ============================================================================

export const collabReportService = {
  async get(reportId: string): Promise<CollabReport> {
    const { data, error } = await sb
      .from('project_reports')
      .select(`
        *,
        partner:project_partners(*),
        period:reporting_periods(*),
        lines:project_report_lines(*, work_package:work_packages(*)),
        events:project_report_events(*)
      `)
      .eq('id', reportId)
      .single()
    if (error) throw error
    return rowToCollabReport(data)
  },

  async listForPeriod(periodId: string): Promise<CollabReport[]> {
    const { data, error } = await sb
      .from('project_reports')
      .select('*, partner:project_partners(org_name, participant_number)')
      .eq('period_id', periodId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToCollabReport)
  },

  async submit(reportId: string, actorName: string): Promise<void> {
    const { error } = await sb
      .from('project_reports')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', reportId)
    if (error) throw error

    await sb.from('project_report_events').insert({
      report_id: reportId,
      event_type: 'submitted',
      actor_name: actorName,
      actor_role: 'partner',
      note: 'Report submitted for review',
    } as any)
  },

  async approve(reportId: string, reviewerId: string, actorName: string): Promise<void> {
    const { error } = await sb
      .from('project_reports')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewerId,
        rejection_note: null,
      })
      .eq('id', reportId)
    if (error) throw error

    await sb.from('project_report_events').insert({
      report_id: reportId,
      event_type: 'approved',
      actor_user_id: reviewerId,
      actor_name: actorName,
      actor_role: 'coordinator',
      note: 'Report approved',
    } as any)
  },

  async reject(reportId: string, reviewerId: string, actorName: string, rejectionNote: string): Promise<void> {
    const { error } = await sb
      .from('project_reports')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewerId,
        rejection_note: rejectionNote,
      })
      .eq('id', reportId)
    if (error) throw error

    await sb.from('project_report_events').insert({
      report_id: reportId,
      event_type: 'rejected',
      actor_user_id: reviewerId,
      actor_name: actorName,
      actor_role: 'coordinator',
      note: rejectionNote,
    } as any)
  },

  async resubmit(reportId: string, actorName: string): Promise<void> {
    const { error } = await sb
      .from('project_reports')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        rejection_note: null,
      })
      .eq('id', reportId)
    if (error) throw error

    await sb.from('project_report_events').insert({
      report_id: reportId,
      event_type: 'resubmitted',
      actor_name: actorName,
      actor_role: 'partner',
      note: 'Report resubmitted after corrections',
    } as any)
  },
}

// ============================================================================
// Report Lines
// ============================================================================

export const collabLineService = {
  async list(reportId: string): Promise<CollabReportLine[]> {
    const { data, error } = await sb
      .from('project_report_lines')
      .select('*, work_package:work_packages(*)')
      .eq('report_id', reportId)
      .order('section')
      .order('line_order', { ascending: true })
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToCollabReportLine)
  },

  async upsert(line: Partial<CollabReportLine> & { report_id: string; section: string }): Promise<CollabReportLine> {
    if (line.id) {
      const { id, report_id, created_at, updated_at, work_package, ...clean } = line as any
      const { data, error } = await sb
        .from('project_report_lines')
        .update(clean)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return rowToCollabReportLine(data)
    } else {
      const { data, error } = await sb
        .from('project_report_lines')
        .insert(line as any)
        .select()
        .single()
      if (error) throw error
      return rowToCollabReportLine(data)
    }
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb.from('project_report_lines').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================================
// Report Events
// ============================================================================

export const collabEventService = {
  async list(reportId: string): Promise<CollabReportEvent[]> {
    const { data, error } = await sb
      .from('project_report_events')
      .select('*')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToCollabReportEvent)
  },
}
