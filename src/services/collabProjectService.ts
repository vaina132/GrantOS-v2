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
} from '@/types'

// ============================================================================
// Projects
// ============================================================================

export const collabProjectService = {
  async list(hostOrgId: string): Promise<CollabProject[]> {
    const { data, error } = await supabase
      .from('collab_projects')
      .select('*, collab_partners(id, org_name, role, invite_status)')
      .eq('host_org_id', hostOrgId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as unknown as CollabProject[]
  },

  async get(id: string): Promise<CollabProject> {
    const { data, error } = await supabase
      .from('collab_projects')
      .select(`
        *,
        collab_partners(
          *,
          collab_contacts(*),
          collab_partner_wp_allocs(*, collab_work_packages(*))
        ),
        collab_work_packages(*)
      `)
      .eq('id', id)
      .single()
    if (error) throw error
    return data as unknown as CollabProject
  },

  async create(project: Partial<CollabProject>): Promise<CollabProject> {
    const { data, error } = await supabase
      .from('collab_projects')
      .insert(project as any)
      .select()
      .single()
    if (error) throw error
    return data as unknown as CollabProject
  },

  async update(id: string, updates: Partial<CollabProject>): Promise<CollabProject> {
    const { host_org_id, created_at, updated_at, partners, work_packages, ...clean } = updates as any
    const { data, error } = await supabase
      .from('collab_projects')
      .update(clean)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as unknown as CollabProject
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('collab_projects')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  async launch(id: string): Promise<void> {
    const { error } = await supabase
      .from('collab_projects')
      .update({ status: 'active' })
      .eq('id', id)
    if (error) throw error
  },
}

// ============================================================================
// Sync collab → My Projects
// ============================================================================

/**
 * After creating or updating a collab project, upsert a corresponding row
 * in the `projects` table that reflects **only the host organisation's**
 * budget / PM slice.  The link is maintained via `collab_project_id`.
 */
export async function syncCollabToMyProjects(
  collabProjectId: string,
  orgId: string,
): Promise<void> {
  try {
    // 1. Fetch collab project metadata
    const { data: cp, error: cpErr } = await supabase
      .from('collab_projects')
      .select('*')
      .eq('id', collabProjectId)
      .single()
    if (cpErr || !cp) return

    // 2. Find the host partner (is_host = true, or linked_org_id matches, or first coordinator)
    const { data: partners } = await supabase
      .from('collab_partners')
      .select('*')
      .eq('project_id', collabProjectId)
      .order('participant_number', { ascending: true })
    const allPartners = (partners ?? []) as any[]
    const hostPartner =
      allPartners.find((p: any) => p.is_host === true) ??
      allPartners.find((p: any) => p.linked_org_id === orgId) ??
      allPartners.find((p: any) => p.role === 'coordinator') ??
      allPartners[0]

    if (!hostPartner) return

    // 3. Compute budget values from the host partner
    const totalDirect =
      (hostPartner.budget_personnel ?? 0) +
      (hostPartner.budget_subcontracting ?? 0) +
      (hostPartner.budget_travel ?? 0) +
      (hostPartner.budget_equipment ?? 0) +
      (hostPartner.budget_other_goods ?? 0)

    const indirectBase =
      hostPartner.indirect_cost_base === 'personnel_only'
        ? (hostPartner.budget_personnel ?? 0)
        : hostPartner.indirect_cost_base === 'all_except_subcontracting'
          ? totalDirect - (hostPartner.budget_subcontracting ?? 0)
          : totalDirect
    const indirect = indirectBase * ((hostPartner.indirect_cost_rate ?? 0) / 100)
    const grandTotal = totalDirect + indirect

    // Map collab status → project status
    const statusMap: Record<string, string> = { draft: 'Upcoming', active: 'Active', archived: 'Completed' }
    const projectStatus = statusMap[cp.status] ?? 'Upcoming'

    // Compute end_date from start_date + duration if end_date is missing
    let endDate = cp.end_date
    if (!endDate && cp.start_date && cp.duration_months) {
      const d = new Date(cp.start_date)
      d.setMonth(d.getMonth() + cp.duration_months)
      endDate = d.toISOString().split('T')[0]
    }

    const projectData: Record<string, any> = {
      org_id: orgId,
      acronym: cp.acronym,
      title: cp.title,
      grant_number: cp.grant_number || null,
      status: projectStatus,
      start_date: cp.start_date || new Date().toISOString().split('T')[0],
      end_date: endDate || new Date().toISOString().split('T')[0],
      total_budget: Math.round(grandTotal),
      budget_personnel: hostPartner.budget_personnel ?? 0,
      budget_travel: hostPartner.budget_travel ?? 0,
      budget_subcontracting: hostPartner.budget_subcontracting ?? 0,
      budget_other: (hostPartner.budget_equipment ?? 0) + (hostPartner.budget_other_goods ?? 0),
      overhead_rate: hostPartner.indirect_cost_rate ?? 0,
      is_lead_organisation: hostPartner.role === 'coordinator',
      has_wps: true,
      collab_project_id: collabProjectId,
      updated_at: new Date().toISOString(),
    }

    // 4. Check if a linked project already exists
    const { data: existing } = await (supabase as any)
      .from('projects')
      .select('id')
      .eq('collab_project_id', collabProjectId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (existing?.id) {
      // Update existing
      await supabase
        .from('projects')
        .update(projectData as any)
        .eq('id', existing.id)
    } else {
      // Create new
      await supabase
        .from('projects')
        .insert(projectData as any)
    }
  } catch (err) {
    console.warn('[syncCollabToMyProjects] Sync failed (non-fatal):', err)
  }
}

// ============================================================================
// Partners
// ============================================================================

export const collabPartnerService = {
  async list(projectId: string): Promise<CollabPartner[]> {
    const { data, error } = await supabase
      .from('collab_partners')
      .select('*, collab_contacts(*)')
      .eq('project_id', projectId)
      .order('participant_number', { ascending: true })
    if (error) throw error
    return (data ?? []) as unknown as CollabPartner[]
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
  }): Promise<CollabPartner> {
    const { data, error } = await supabase
      .from('collab_partners')
      .insert(partner as any)
      .select()
      .single()
    if (error) throw error
    return data as unknown as CollabPartner
  },

  async update(id: string, updates: Partial<CollabPartner>): Promise<CollabPartner> {
    const { project_id, created_at, updated_at, contacts, wp_allocations, invite_token, ...clean } = updates as any
    const { data, error } = await supabase
      .from('collab_partners')
      .update(clean)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as unknown as CollabPartner
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('collab_partners')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}

// ============================================================================
// Work Packages
// ============================================================================

export const collabWpService = {
  async list(projectId: string): Promise<CollabWorkPackage[]> {
    const { data, error } = await supabase
      .from('collab_work_packages')
      .select('*')
      .eq('project_id', projectId)
      .order('wp_number', { ascending: true })
    if (error) throw error
    return (data ?? []) as unknown as CollabWorkPackage[]
  },

  async upsertMany(projectId: string, wps: {
    wp_number: number
    title: string
    total_person_months?: number
    start_month?: number | null
    end_month?: number | null
    leader_partner_id?: string | null
  }[]): Promise<CollabWorkPackage[]> {
    // Delete existing and re-insert for simplicity during setup
    await supabase.from('collab_work_packages').delete().eq('project_id', projectId)
    if (wps.length === 0) return []
    const rows = wps.map(wp => ({ project_id: projectId, ...wp }))
    const { data, error } = await supabase
      .from('collab_work_packages')
      .insert(rows as any)
      .select()
    if (error) throw error
    return (data ?? []) as unknown as CollabWorkPackage[]
  },
}

// ============================================================================
// Tasks
// ============================================================================

export const collabTaskService = {
  async list(wpId: string): Promise<CollabTask[]> {
    const { data, error } = await (supabase as any)
      .from('collab_tasks')
      .select('*, collab_partner_task_effort(*)')
      .eq('wp_id', wpId)
      .order('task_number', { ascending: true })
    if (error) throw error
    // Map joined name to 'effort'
    return ((data ?? []) as any[]).map(t => ({
      ...t,
      effort: t.collab_partner_task_effort ?? [],
    })) as CollabTask[]
  },

  async listByProject(projectId: string): Promise<CollabTask[]> {
    const { data, error } = await (supabase as any)
      .from('collab_tasks')
      .select('*, collab_partner_task_effort(*)')
      .eq('project_id', projectId)
      .order('task_number', { ascending: true })
    if (error) throw error
    return ((data ?? []) as any[]).map(t => ({
      ...t,
      effort: t.collab_partner_task_effort ?? [],
    })) as CollabTask[]
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
    const { data, error } = await supabase
      .from('collab_tasks')
      .insert(rows as any)
      .select()
    if (error) throw error
    return (data ?? []) as unknown as CollabTask[]
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('collab_tasks').delete().eq('id', id)
    if (error) throw error
  },

  async update(id: string, updates: Partial<CollabTask>): Promise<CollabTask> {
    const { data, error } = await supabase
      .from('collab_tasks')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as unknown as CollabTask
  },
}

// ============================================================================
// Partner Task Effort (per-partner-per-task PM allocations)
// ============================================================================

export const collabTaskEffortService = {
  async listByProject(projectId: string): Promise<CollabPartnerTaskEffort[]> {
    // Get all tasks for the project, then get effort for those tasks
    const { data: tasks } = await supabase
      .from('collab_tasks')
      .select('id')
      .eq('project_id', projectId)
    if (!tasks || tasks.length === 0) return []
    const taskIds = tasks.map(t => t.id)
    const { data, error } = await (supabase as any)
      .from('collab_partner_task_effort')
      .select('*')
      .in('task_id', taskIds)
    if (error) throw error
    return (data ?? []) as unknown as CollabPartnerTaskEffort[]
  },

  async upsertMany(efforts: { task_id: string; partner_id: string; person_months: number }[]): Promise<void> {
    if (efforts.length === 0) return
    const { error } = await (supabase as any)
      .from('collab_partner_task_effort')
      .upsert(efforts as any, { onConflict: 'task_id,partner_id' })
    if (error) throw error
  },

  async removeForTask(taskId: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('collab_partner_task_effort')
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
    const { data, error } = await supabase
      .from('collab_deliverables')
      .select('*')
      .eq('project_id', projectId)
      .order('number', { ascending: true })
    if (error) throw error
    return (data ?? []) as unknown as CollabDeliverable[]
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
    const rows = deliverables.map(d => ({ project_id: projectId, ...d }))
    const { data, error } = await supabase
      .from('collab_deliverables')
      .insert(rows as any)
      .select()
    if (error) throw error
    return (data ?? []) as unknown as CollabDeliverable[]
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('collab_deliverables').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================================
// Milestones
// ============================================================================

export const collabMilestoneService = {
  async list(projectId: string): Promise<CollabMilestone[]> {
    const { data, error } = await supabase
      .from('collab_milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('number', { ascending: true })
    if (error) throw error
    return (data ?? []) as unknown as CollabMilestone[]
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
    const rows = milestones.map(m => ({ project_id: projectId, ...m }))
    const { data, error } = await supabase
      .from('collab_milestones')
      .insert(rows as any)
      .select()
    if (error) throw error
    return (data ?? []) as unknown as CollabMilestone[]
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('collab_milestones').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================================
// Partner–WP Allocations
// ============================================================================

export const collabAllocService = {
  async list(partnerId: string): Promise<CollabPartnerWpAlloc[]> {
    const { data, error } = await supabase
      .from('collab_partner_wp_allocs')
      .select('*, collab_work_packages(*)')
      .eq('partner_id', partnerId)
    if (error) throw error
    return (data ?? []) as unknown as CollabPartnerWpAlloc[]
  },

  async upsertMany(partnerId: string, allocs: { wp_id: string; person_months: number }[]): Promise<void> {
    await supabase.from('collab_partner_wp_allocs').delete().eq('partner_id', partnerId)
    if (allocs.length === 0) return
    const rows = allocs.map(a => ({ partner_id: partnerId, ...a }))
    const { error } = await supabase
      .from('collab_partner_wp_allocs')
      .insert(rows as any)
    if (error) throw error
  },
}

// ============================================================================
// Contacts
// ============================================================================

export const collabContactService = {
  async list(partnerId: string): Promise<CollabContact[]> {
    const { data, error } = await supabase
      .from('collab_contacts')
      .select('*')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as unknown as CollabContact[]
  },

  async create(contact: Omit<CollabContact, 'id' | 'created_at'>): Promise<CollabContact> {
    const { data, error } = await supabase
      .from('collab_contacts')
      .insert(contact as any)
      .select()
      .single()
    if (error) throw error
    return data as unknown as CollabContact
  },

  async update(id: string, updates: Partial<CollabContact>): Promise<CollabContact> {
    const { partner_id, created_at, ...clean } = updates as any
    const { data, error } = await supabase
      .from('collab_contacts')
      .update(clean)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as unknown as CollabContact
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('collab_contacts')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}

// ============================================================================
// Reporting Periods
// ============================================================================

export const collabPeriodService = {
  async list(projectId: string): Promise<CollabReportingPeriod[]> {
    const { data, error } = await supabase
      .from('collab_reporting_periods')
      .select('*, collab_reports(id, partner_id, status)')
      .eq('project_id', projectId)
      .order('start_month', { ascending: true })
    if (error) throw error
    return (data ?? []) as unknown as CollabReportingPeriod[]
  },

  async create(period: {
    project_id: string
    period_type: 'formal' | 'informal'
    title: string
    start_month: number
    end_month: number
    due_date?: string
  }): Promise<CollabReportingPeriod> {
    const { data, error } = await supabase
      .from('collab_reporting_periods')
      .insert(period as any)
      .select()
      .single()
    if (error) throw error
    return data as unknown as CollabReportingPeriod
  },

  async update(id: string, updates: Partial<CollabReportingPeriod>): Promise<CollabReportingPeriod> {
    const { project_id, created_at, updated_at, reports, ...clean } = updates as any
    const { data, error } = await supabase
      .from('collab_reporting_periods')
      .update(clean)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as unknown as CollabReportingPeriod
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('collab_reporting_periods')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  async generateReports(periodId: string, projectId: string): Promise<void> {
    // Get all partners for this project
    const { data: partners, error: pErr } = await supabase
      .from('collab_partners')
      .select('id')
      .eq('project_id', projectId)
    if (pErr) throw pErr

    // Create one report per partner
    const reports = (partners ?? []).map(p => ({
      period_id: periodId,
      partner_id: p.id,
      status: 'draft',
    }))
    if (reports.length > 0) {
      const { error: rErr } = await supabase
        .from('collab_reports')
        .insert(reports as any)
      if (rErr) throw rErr
    }

    // Mark period as reports generated
    await supabase
      .from('collab_reporting_periods')
      .update({ reports_generated: true })
      .eq('id', periodId)

    // Create audit events for each report
    const { data: createdReports } = await supabase
      .from('collab_reports')
      .select('id')
      .eq('period_id', periodId)
    if (createdReports) {
      const events = createdReports.map(r => ({
        report_id: r.id,
        event_type: 'generated',
        actor_role: 'system',
        note: 'Report generated for reporting period',
      }))
      await supabase.from('collab_report_events').insert(events as any)
    }
  },
}

// ============================================================================
// Reports
// ============================================================================

export const collabReportService = {
  async get(reportId: string): Promise<CollabReport> {
    const { data, error } = await supabase
      .from('collab_reports')
      .select(`
        *,
        collab_partners(*),
        collab_reporting_periods(*),
        collab_report_lines(*, collab_work_packages(*)),
        collab_report_events(*)
      `)
      .eq('id', reportId)
      .single()
    if (error) throw error
    return data as unknown as CollabReport
  },

  async listForPeriod(periodId: string): Promise<CollabReport[]> {
    const { data, error } = await supabase
      .from('collab_reports')
      .select('*, collab_partners(org_name, participant_number)')
      .eq('period_id', periodId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as unknown as CollabReport[]
  },

  async submit(reportId: string, actorName: string): Promise<void> {
    const { error } = await supabase
      .from('collab_reports')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', reportId)
    if (error) throw error

    await supabase.from('collab_report_events').insert({
      report_id: reportId,
      event_type: 'submitted',
      actor_name: actorName,
      actor_role: 'partner',
      note: 'Report submitted for review',
    } as any)
  },

  async approve(reportId: string, reviewerId: string, actorName: string): Promise<void> {
    const { error } = await supabase
      .from('collab_reports')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewerId,
        rejection_note: null,
      })
      .eq('id', reportId)
    if (error) throw error

    await supabase.from('collab_report_events').insert({
      report_id: reportId,
      event_type: 'approved',
      actor_user_id: reviewerId,
      actor_name: actorName,
      actor_role: 'coordinator',
      note: 'Report approved',
    } as any)
  },

  async reject(reportId: string, reviewerId: string, actorName: string, rejectionNote: string): Promise<void> {
    const { error } = await supabase
      .from('collab_reports')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewerId,
        rejection_note: rejectionNote,
      })
      .eq('id', reportId)
    if (error) throw error

    await supabase.from('collab_report_events').insert({
      report_id: reportId,
      event_type: 'rejected',
      actor_user_id: reviewerId,
      actor_name: actorName,
      actor_role: 'coordinator',
      note: rejectionNote,
    } as any)
  },

  async resubmit(reportId: string, actorName: string): Promise<void> {
    const { error } = await supabase
      .from('collab_reports')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        rejection_note: null,
      })
      .eq('id', reportId)
    if (error) throw error

    await supabase.from('collab_report_events').insert({
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
    const { data, error } = await supabase
      .from('collab_report_lines')
      .select('*, collab_work_packages(*)')
      .eq('report_id', reportId)
      .order('section')
      .order('line_order', { ascending: true })
    if (error) throw error
    return (data ?? []) as unknown as CollabReportLine[]
  },

  async upsert(line: Partial<CollabReportLine> & { report_id: string; section: string }): Promise<CollabReportLine> {
    if (line.id) {
      const { id, report_id, created_at, updated_at, work_package, ...clean } = line as any
      const { data, error } = await supabase
        .from('collab_report_lines')
        .update(clean)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as unknown as CollabReportLine
    } else {
      const { data, error } = await supabase
        .from('collab_report_lines')
        .insert(line as any)
        .select()
        .single()
      if (error) throw error
      return data as unknown as CollabReportLine
    }
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('collab_report_lines')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}

// ============================================================================
// Report Events (read-only — insert happens via other service methods)
// ============================================================================

export const collabEventService = {
  async list(reportId: string): Promise<CollabReportEvent[]> {
    const { data, error } = await supabase
      .from('collab_report_events')
      .select('*')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as unknown as CollabReportEvent[]
  },
}
