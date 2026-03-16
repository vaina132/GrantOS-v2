import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { absenceApproverService } from '@/services/absenceApproverService'
import { settingsService } from '@/services/settingsService'
import { useAuthStore } from '@/stores/authStore'
import { useStaff } from '@/hooks/useStaff'
import { PersonAvatar } from '@/components/common/PersonAvatar'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { Plus, Trash2, UserCheck, Info } from 'lucide-react'
import type { AbsenceApprover } from '@/types'

export function AbsenceApprovers() {
  const { t } = useTranslation()
  const { orgId } = useAuthStore()
  const { staff } = useStaff({ is_active: true })
  const [approvers, setApprovers] = useState<AbsenceApprover[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [selectedDept, setSelectedDept] = useState<string>('')  // '' = org-wide

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [data, org] = await Promise.all([
        absenceApproverService.list(orgId),
        settingsService.getOrganisation(orgId),
      ])
      setApprovers(data)
      setDepartments(org?.departments ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.failedToSave')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!orgId || !selectedPersonId) return
    setSaving(true)
    try {
      const person = staff.find(p => p.id === selectedPersonId)
      const dept = selectedDept || null
      await absenceApproverService.add(orgId, selectedPersonId, null, dept)
      const scope = dept ? `absences for ${dept}` : 'all absences (org-wide)'
      toast({ title: t('settings.approverAdded'), description: `${person?.full_name ?? ''} can now approve ${scope}.` })
      setSelectedPersonId('')
      setSelectedDept('')
      load()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.failedToSave')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (approver: AbsenceApprover) => {
    try {
      await absenceApproverService.remove(approver.id)
      toast({ title: t('settings.approverRemoved'), description: t('common.hasBeenRemoved', { name: approver.person?.full_name ?? '' }) })
      load()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.failedToDelete')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    }
  }

  // A person can be added multiple times with different departments
  const existingKeys = new Set(approvers.map(a => `${a.person_id}::${a.department ?? ''}`))
  const wouldDuplicate = existingKeys.has(`${selectedPersonId}::${selectedDept}`)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{t('settings.absenceApprovers')}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t('settings.absenceApproversDesc')}
        </p>
      </div>

      {/* Info callout */}
      <div className="rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 p-4 flex gap-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <p className="font-medium">{t('settings.howApprovalsWork')}</p>
          <ul className="list-disc list-inside text-xs space-y-0.5 text-blue-700 dark:text-blue-400">
            <li>{t('settings.approvalStep1')}</li>
            <li>{t('settings.approvalStep2')}</li>
            <li>{t('settings.approvalStep3')}</li>
            <li>{t('settings.approvalStep4')}</li>
            <li>{t('settings.approvalDeptNote')}</li>
          </ul>
        </div>
      </div>

      {/* Add approver */}
      <div className="flex gap-3 items-end flex-wrap">
        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground">{t('settings.staffMember')}</label>
          <select
            value={selectedPersonId}
            onChange={(e) => setSelectedPersonId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t('common.selectPerson')}</option>
            {staff.map(p => (
              <option key={p.id} value={p.id}>{p.full_name}{p.role ? ` — ${p.role}` : ''}{p.department ? ` (${p.department})` : ''}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1 min-w-[180px]">
          <label className="text-xs font-medium text-muted-foreground">{t('settings.approverScope')}</label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t('settings.allDepartments')}</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <Button onClick={handleAdd} disabled={saving || !selectedPersonId || wouldDuplicate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {saving ? t('common.adding') : t('settings.addApprover')}
        </Button>
      </div>

      {/* Current approvers list */}
      {loading ? (
        <div className="text-sm text-muted-foreground">{t('common.loading')}...</div>
      ) : approvers.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-6 text-center">
          <UserCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <div className="text-sm text-muted-foreground">{t('settings.noApprovers')}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {t('settings.noApproversDesc')}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground font-medium">
            {approvers.length} {t('settings.approversCount')}
          </div>
          {approvers.map(approver => (
            <div
              key={approver.id}
              className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <PersonAvatar name={approver.person?.full_name ?? '?'} size="sm" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{approver.person?.full_name ?? 'Unknown'}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      approver.department
                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    }`}>
                      {approver.department ?? t('settings.orgWide')}
                    </span>
                  </div>
                  {(approver.person as any)?.email && (
                    <div className="text-xs text-muted-foreground">{(approver.person as any).email}</div>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-red-500"
                onClick={() => handleRemove(approver)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
