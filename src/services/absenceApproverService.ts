import { supabase } from '@/lib/supabase'
import type { AbsenceApprover } from '@/types'

export const absenceApproverService = {
  async list(orgId: string): Promise<AbsenceApprover[]> {
    const { data, error } = await supabase
      .from('absence_approvers' as any)
      .select('*, persons(id, full_name, email)')
      .eq('org_id', orgId)
      .order('created_at')

    if (error) throw error
    return (data ?? []).map((row: any) => ({
      ...row,
      person: row.persons ?? null,
    })) as AbsenceApprover[]
  },

  async add(orgId: string, personId: string, userId: string | null, department: string | null = null): Promise<AbsenceApprover> {
    const { data, error } = await supabase
      .from('absence_approvers' as any)
      .insert({ org_id: orgId, person_id: personId, user_id: userId, department })
      .select('*, persons(id, full_name, email)')
      .single()

    if (error) throw error
    const row = data as any
    return { ...row, person: row.persons ?? null } as AbsenceApprover
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('absence_approvers' as any)
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  /** Get approver user_ids for sending notifications */
  async getApproverUserIds(orgId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('absence_approvers' as any)
      .select('user_id')
      .eq('org_id', orgId)

    if (error) return []
    return (data ?? []).map((r: any) => r.user_id).filter(Boolean) as string[]
  },

  /** Get approver emails for sending email notifications */
  async getApproverEmails(orgId: string): Promise<{ email: string; name: string }[]> {
    const { data, error } = await supabase
      .from('absence_approvers' as any)
      .select('persons(full_name, email)')
      .eq('org_id', orgId)

    if (error) return []
    return (data ?? [])
      .map((r: any) => ({ email: r.persons?.email, name: r.persons?.full_name ?? '' }))
      .filter((r: any) => r.email) as { email: string; name: string }[]
  },

  /** Get approvers that cover a specific person's department (org-wide + matching department) */
  async getApproversForPerson(orgId: string, personDepartment: string | null): Promise<AbsenceApprover[]> {
    const { data, error } = await supabase
      .from('absence_approvers' as any)
      .select('*, persons(id, full_name, email)')
      .eq('org_id', orgId)

    if (error) return []
    return (data ?? [])
      .filter((r: any) => r.department === null || r.department === personDepartment)
      .map((r: any) => ({ ...r, person: r.persons ?? null })) as AbsenceApprover[]
  },
}
