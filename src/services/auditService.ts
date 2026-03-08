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

export interface AuditFilters {
  entity_type?: string
  action?: string
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
    if (filters?.offset) query = query.range(filters.offset, filters.offset + (filters.limit ?? 100) - 1)

    const { data, error } = await query
    if (error) {
      // RLS may block access if policies haven't been applied yet
      if (error.code === '42501' || error.message?.includes('policy')) {
        console.warn('[GrantOS] Audit log RLS error — run supabase/fix_audit_rls.sql:', error.message)
        throw new Error('Access denied. An administrator needs to apply the audit log RLS policies in Supabase.')
      }
      throw error
    }
    return (data ?? []) as AuditEntry[]
  },
}
