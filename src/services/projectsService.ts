import { supabase } from '@/lib/supabase'
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
      .select('*, funding_schemes(id, name, type, overhead_rate)')
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
      .select('*, funding_schemes(id, name, type, overhead_rate)')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as Project
  },

  async create(project: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'funding_schemes'>): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .insert(project)
      .select('*, funding_schemes(id, name, type, overhead_rate)')
      .single()

    if (error) throw error
    return data as Project
  },

  async update(id: string, updates: Partial<Project>): Promise<Project> {
    const { funding_schemes: _fs, ...rest } = updates
    const { data, error } = await supabase
      .from('projects')
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, funding_schemes(id, name, type, overhead_rate)')
      .single()

    if (error) throw error
    return data as Project
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // Work Packages
  async listWorkPackages(projectId: string): Promise<WorkPackage[]> {
    const { data, error } = await supabase
      .from('work_packages')
      .select('*')
      .eq('project_id', projectId)
      .order('name')

    if (error) throw error
    return (data ?? []) as WorkPackage[]
  },

  async createWorkPackage(wp: Omit<WorkPackage, 'id' | 'created_at' | 'updated_at'>): Promise<WorkPackage> {
    const { data, error } = await supabase
      .from('work_packages')
      .insert(wp)
      .select()
      .single()

    if (error) throw error
    return data as WorkPackage
  },

  async updateWorkPackage(id: string, updates: Partial<WorkPackage>): Promise<WorkPackage> {
    const { data, error } = await supabase
      .from('work_packages')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
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
