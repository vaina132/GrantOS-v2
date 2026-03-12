import { supabase } from '@/lib/supabase'
import { writeAudit } from './auditWriter'
import { emailService } from './emailService'
import { notificationService } from './notificationService'
import type { Project, WorkPackage } from '@/types'

export interface ProjectFilters {
  search?: string
  status?: string
  funding_scheme_id?: string
}

export const projectsService = {
  async list(orgId: string | null, filters?: ProjectFilters): Promise<Project[]> {
    let query = supabase
      .from('projects')
      .select('*, funding_schemes(id, name, type, overhead_rate), responsible_person:persons!projects_responsible_person_id_fkey(id, full_name, avatar_url)')
      .order('acronym')

    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.funding_scheme_id) {
      query = query.eq('funding_scheme_id', filters.funding_scheme_id)
    }

    if (filters?.search) {
      query = query.or(`acronym.ilike.%${filters.search}%,title.ilike.%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) throw error
    return (data ?? []) as Project[]
  },

  async getById(id: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*, funding_schemes(id, name, type, overhead_rate), responsible_person:persons!projects_responsible_person_id_fkey(id, full_name, avatar_url)')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as Project
  },

  async create(project: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'funding_schemes' | 'responsible_person'>): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .insert(project)
      .select('*, funding_schemes(id, name, type, overhead_rate), responsible_person:persons!projects_responsible_person_id_fkey(id, full_name, avatar_url)')
      .single()

    if (error) throw error
    writeAudit({ orgId: project.org_id, entityType: 'project', action: 'create', entityId: (data as Project).id, details: `Created project ${project.acronym}` })

    // Fire-and-forget: notify org admins about the new project
    const created = data as Project
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.grantlume.com'
    Promise.resolve(supabase.auth.getUser()).then(({ data: authData }) => {
      const creatorEmail = authData?.user?.email
      const creatorName = authData?.user?.user_metadata?.first_name
        ? `${authData.user.user_metadata.first_name} ${authData.user.user_metadata.last_name || ''}`.trim()
        : creatorEmail?.split('@')[0] ?? 'Someone'
      Promise.resolve(
        supabase.from('organisations').select('name').eq('id', project.org_id).single()
      ).then(({ data: org }) => {
        const orgName = (org as any)?.name ?? ''
        // Get admin members with their linked persons (for email)
        notificationService.getAdminUserIds(project.org_id).then(adminIds => {
          const otherAdmins = adminIds.filter(id => id !== authData?.user?.id)
          if (otherAdmins.length === 0) return
          // Look up emails from persons table (linked via user_id)
          Promise.resolve(
            supabase.from('persons').select('email, full_name, user_id').eq('org_id', project.org_id).in('user_id', otherAdmins)
          ).then(({ data: persons }) => {
            for (const p of (persons ?? []) as any[]) {
              if (!p.email) continue
              emailService.sendProjectCreated({
                to: p.email,
                recipientName: p.full_name || p.email.split('@')[0],
                orgName,
                projectAcronym: created.acronym,
                projectTitle: created.title,
                createdBy: creatorName,
                projectUrl: `${origin}/projects/${created.id}`,
              }).catch(() => {})
            }
          }).catch(() => {})
        }).catch(() => {})
      }).catch(() => {})
    }).catch(() => {})

    return data as Project
  },

  async update(id: string, updates: Partial<Project>): Promise<Project> {
    const { funding_schemes: _fs, responsible_person: _rp, ...rest } = updates
    const { data, error } = await supabase
      .from('projects')
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, funding_schemes(id, name, type, overhead_rate), responsible_person:persons!projects_responsible_person_id_fkey(id, full_name, avatar_url)')
      .single()

    if (error) throw error
    writeAudit({ orgId: (data as Project).org_id, entityType: 'project', action: 'update', entityId: id, details: `Updated project ${(data as Project).acronym}` })
    return data as Project
  },

  async remove(id: string): Promise<void> {
    const proj = await this.getById(id)
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)

    if (error) throw error
    if (proj) writeAudit({ orgId: proj.org_id, entityType: 'project', action: 'delete', entityId: id, details: `Deleted project ${proj.acronym}` })
  },

  // Work Packages
  async listWorkPackages(projectId: string): Promise<WorkPackage[]> {
    const { data, error } = await supabase
      .from('work_packages')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at')

    if (error) throw error
    // Sort by number (nulls last), then name
    const wps = (data ?? []) as WorkPackage[]
    wps.sort((a, b) => {
      const an = a.number ?? 999
      const bn = b.number ?? 999
      if (an !== bn) return an - bn
      return a.name.localeCompare(b.name)
    })
    return wps
  },

  async createWorkPackage(wp: Omit<WorkPackage, 'id' | 'created_at' | 'updated_at'>): Promise<WorkPackage> {
    // Try with all fields first; if DB doesn't have new columns yet, retry without them
    const { data, error } = await supabase
      .from('work_packages')
      .insert(wp)
      .select()
      .single()

    if (error) {
      // Retry without new columns that may not exist yet
      const { number: _n, start_month: _sm, end_month: _em, ...fallback } = wp as any
      const { data: d2, error: e2 } = await supabase
        .from('work_packages')
        .insert(fallback)
        .select()
        .single()
      if (e2) throw e2
      return d2 as WorkPackage
    }
    return data as WorkPackage
  },

  async updateWorkPackage(id: string, updates: Partial<WorkPackage>): Promise<WorkPackage> {
    const payload = { ...updates, updated_at: new Date().toISOString() }
    const { data, error } = await supabase
      .from('work_packages')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      // Retry without new columns that may not exist yet
      const { number: _n, start_month: _sm, end_month: _em, ...fallback } = payload as any
      const { data: d2, error: e2 } = await supabase
        .from('work_packages')
        .update(fallback)
        .eq('id', id)
        .select()
        .single()
      if (e2) throw e2
      return d2 as WorkPackage
    }
    return data as WorkPackage
  },

  async removeWorkPackage(id: string): Promise<void> {
    const { error } = await supabase
      .from('work_packages')
      .delete()
      .eq('id', id)

    if (error) throw error
  },
}
