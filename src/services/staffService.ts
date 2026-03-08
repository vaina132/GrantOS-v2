import { supabase } from '@/lib/supabase'
import type { Person } from '@/types'

export interface StaffFilters {
  search?: string
  department?: string
  employment_type?: string
  is_active?: boolean
}

export const staffService = {
  async list(orgId: string | null, filters?: StaffFilters): Promise<Person[]> {
    let query = supabase
      .from('persons')
      .select('*')
      .order('full_name')

    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active)
    }

    if (filters?.department) {
      query = query.eq('department', filters.department)
    }

    if (filters?.employment_type) {
      query = query.eq('employment_type', filters.employment_type)
    }

    if (filters?.search) {
      query = query.ilike('full_name', `%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) throw error
    return (data ?? []) as Person[]
  },

  async getById(id: string): Promise<Person | null> {
    const { data, error } = await supabase
      .from('persons')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as Person
  },

  async create(person: Omit<Person, 'id' | 'created_at' | 'updated_at'>): Promise<Person> {
    const { data, error } = await supabase
      .from('persons')
      .insert(person)
      .select()
      .single()

    if (error) throw error
    return data as Person
  },

  async update(id: string, updates: Partial<Person>): Promise<Person> {
    const { data, error } = await supabase
      .from('persons')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as Person
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('persons')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async getDepartments(orgId: string | null): Promise<string[]> {
    let query = supabase
      .from('persons')
      .select('department')

    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    const { data, error } = await query

    if (error) throw error

    const departments = new Set<string>()
    for (const row of data ?? []) {
      if (row.department) departments.add(row.department as string)
    }
    return Array.from(departments).sort()
  },
}
