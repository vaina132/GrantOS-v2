import { supabase } from '@/lib/supabase'

interface AuditEntry {
  orgId: string
  entityType: string
  action: 'create' | 'update' | 'delete'
  entityId: string
  details?: string
}

/**
 * Writes an audit log entry. Fire-and-forget — errors are logged but not thrown.
 */
export async function writeAudit({ orgId, entityType, action, entityId, details }: AuditEntry) {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    await (supabase.from as any)('audit_log').insert({
      org_id: orgId,
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      entity_type: entityType,
      action,
      entity_id: entityId,
      details: details ?? null,
    })
  } catch (err) {
    console.warn('[GrantOS] Audit write failed:', err)
  }
}

/**
 * Writes field-level change entries. Fire-and-forget.
 */
export async function writeAuditChanges(
  orgId: string,
  entityType: string,
  entityId: string,
  action: string,
  changes: { field: string; oldValue: unknown; newValue: unknown }[],
) {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    const rows = changes.map((c) => ({
      org_id: orgId,
      user_id: user?.id ?? null,
      entity_type: entityType,
      entity_id: entityId,
      field_name: c.field,
      old_value: c.oldValue != null ? String(c.oldValue) : null,
      new_value: c.newValue != null ? String(c.newValue) : null,
      action,
      changed_by_name: user?.email ?? null,
    }))

    if (rows.length > 0) {
      await (supabase.from as any)('audit_changes').insert(rows)
    }
  } catch (err) {
    console.warn('[GrantOS] Audit changes write failed:', err)
  }
}
