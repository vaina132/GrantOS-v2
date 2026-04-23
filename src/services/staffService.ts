import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { writeAudit } from './auditWriter'
import type { Person } from '@/types'

export interface StaffFilters {
  search?: string
  department?: string
  employment_type?: string
  is_active?: boolean
}

/**
 * Salary and overhead_rate are sensitive. We expose them only to callers
 * whose `canSeeSalary` permission is true. Everyone else reads from the
 * `persons_masked` view which omits those columns server-side. A malicious
 * caller who hits `from('persons')` directly is still bounded by RLS, but
 * the masked read is the correct default.
 */
function canSeeSalary(): boolean {
  try {
    return !!useAuthStore.getState().can('canSeeSalary')
  } catch {
    return false
  }
}

function personsSource() {
  return canSeeSalary() ? 'persons' : 'persons_masked'
}

export const staffService = {
  async list(orgId: string | null, filters?: StaffFilters): Promise<Person[]> {
    let query = (supabase as any)
      .from(personsSource())
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
    const { data, error } = await (supabase as any)
      .from(personsSource())
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
    writeAudit({ orgId: person.org_id, entityType: 'person', action: 'create', entityId: (data as Person).id, details: `Created person ${person.full_name}` })
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
    writeAudit({ orgId: (data as Person).org_id, entityType: 'person', action: 'update', entityId: id, details: `Updated person ${(data as Person).full_name}` })
    return data as Person
  },

  async remove(id: string): Promise<void> {
    const person = await this.getById(id)
    const { error } = await supabase
      .from('persons')
      .delete()
      .eq('id', id)

    if (error) throw error
    if (person) writeAudit({ orgId: person.org_id, entityType: 'person', action: 'delete', entityId: id, details: `Deleted person ${person.full_name}` })
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
