import { supabase } from '@/lib/supabase'

export interface AuditEntry {
  id: string
  org_id: string
  user_id: string | null
  user_email: string | null
  entity_type: string | null
  action: string | null
  entity_id: string | null
  details: string | null
  created_at: string
}

export interface AuditChange {
  id: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  changed_by_name: string | null
}

export interface AuditFilters {
  entity_type?: string
  action?: string
  user_email?: string
  search?: string
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
}

export const auditService = {
  async list(orgId: string | null, filters?: AuditFilters): Promise<AuditEntry[]> {
    let query = supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(filters?.limit ?? 100)

    if (orgId) query = query.eq('org_id', orgId)
    if (filters?.entity_type) query = query.eq('entity_type', filters.entity_type)
    if (filters?.action) query = query.eq('action', filters.action)
    if (filters?.user_email) query = query.ilike('user_email', `%${filters.user_email}%`)
    if (filters?.search) query = query.ilike('details', `%${filters.search}%`)
    if (filters?.date_from) query = query.gte('created_at', `${filters.date_from}T00:00:00`)
    if (filters?.date_to) query = query.lte('created_at', `${filters.date_to}T23:59:59`)
    if (filters?.offset) query = query.range(filters.offset, filters.offset + (filters.limit ?? 100) - 1)

    const { data, error } = await query
    if (error) {
      if (error.code === '42501' || error.message?.includes('policy')) {
        console.warn('[GrantLume] Audit log RLS error — run supabase/fix_audit_rls.sql:', error.message)
        throw new Error('Access denied. An administrator needs to apply the audit log RLS policies in Supabase.')
      }
      throw error
    }
    return (data ?? []) as AuditEntry[]
  },

  async getChanges(entityType: string, entityId: string): Promise<AuditChange[]> {
    const { data, error } = await supabase
      .from('audit_changes')
      .select('id, field_name, old_value, new_value, changed_by_name')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true })

    if (error) {
      console.warn('[GrantLume] Failed to load audit changes:', error.message)
      return []
    }
    return (data ?? []) as AuditChange[]
  },
}
