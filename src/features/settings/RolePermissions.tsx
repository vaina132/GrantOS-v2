import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { Save, Shield, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { computePermissions } from '@/lib/permissions'
import type { OrgRole, RolePermission } from '@/types'

const CONFIGURABLE_ROLES: OrgRole[] = ['Project Manager', 'Finance Officer', 'Viewer']

/** DB column names grouped by category for the UI */
interface PermissionItem {
  key: keyof RolePermission
  label: string
  description: string
}

const MODULE_PERMISSIONS: PermissionItem[] = [
  { key: 'can_see_dashboard', label: 'Dashboard', description: 'Organisation overview and KPIs' },
  { key: 'can_see_projects', label: 'Our Projects', description: 'Project list, details, work packages' },
  { key: 'can_see_staff', label: 'Staff', description: 'Personnel directory and profiles' },
  { key: 'can_see_allocations', label: 'Allocations', description: 'Person-month allocation grid and matrices' },
  { key: 'can_see_timesheets', label: 'Timesheets', description: 'Time tracking and approval' },
  { key: 'can_see_absences', label: 'Absences', description: 'Leave and absence management' },
  { key: 'can_see_financials', label: 'Financials', description: 'Budget tracking and cost reporting' },
  { key: 'can_see_timeline', label: 'Timeline', description: 'Gantt chart and project timeline' },
  { key: 'can_see_reports', label: 'Reports', description: 'Generate and export reports' },
  { key: 'can_see_import', label: 'Import', description: 'Data import tools' },
  { key: 'can_see_audit', label: 'Audit Log', description: 'Activity and change history' },
  { key: 'can_see_proposals', label: 'Proposals', description: 'View and manage grant proposals pipeline' },
  { key: 'can_see_collaboration' as any, label: 'Collaboration', description: 'Multi-partner collaboration projects' },
]

const DATA_PRIVACY_PERMISSIONS: PermissionItem[] = [
  { key: 'can_see_salary_info', label: 'Salary Information', description: 'Annual salary, hourly rates, employment cost' },
  { key: 'can_see_financial_details', label: 'Financial Details', description: 'Project budgets, cost breakdowns, budget consumption' },
  { key: 'can_see_personnel_rates', label: 'Personnel Rates', description: 'Individual PM rates and cost per person' },
]

const ACTION_PERMISSIONS: PermissionItem[] = [
  { key: 'can_edit_projects', label: 'Create / Edit Projects', description: 'Add and modify project details and work packages' },
  { key: 'can_edit_allocations', label: 'Edit Allocations', description: 'Modify person-month allocations' },
  { key: 'can_approve_timesheets', label: 'Approve Timesheets', description: 'Review and approve timesheet submissions' },
  { key: 'can_submit_timesheets', label: 'Submit Timesheets', description: 'Enter and submit own timesheets' },
  { key: 'can_manage_budgets', label: 'Manage Budgets', description: 'Set PM budgets and financial targets' },
  { key: 'can_generate_reports', label: 'Generate Reports', description: 'Create and download reports' },
  { key: 'can_manage_users', label: 'Manage Users', description: 'Invite, remove, and change user roles' },
  { key: 'can_manage_org', label: 'Manage Organisation', description: 'Organisation settings, funding schemes, holidays' },
]

type RolePermissionMap = Record<string, Partial<RolePermission>>

export function RolePermissions() {
  const { orgId } = useAuthStore()
  const [permissions, setPermissions] = useState<RolePermissionMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [selectedRole, setSelectedRole] = useState<OrgRole>('Project Manager')

  const fetchPermissions = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const { data, error } = await (supabase as any)
        .from('role_permissions')
        .select('*')
        .eq('org_id', orgId)

      if (error) throw error

      const map: RolePermissionMap = {}
      for (const rp of (data ?? [])) {
        map[rp.role] = rp
      }
      setPermissions(map)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load role permissions'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  const getPermValue = (role: OrgRole, key: keyof RolePermission): boolean => {
    const rp = permissions[role]
    if (rp && key in rp) return rp[key] as boolean
    // Fallback to hardcoded default
    const defaults = computePermissions(role)
    const keyMap: Record<string, string> = {
      can_see_dashboard: 'canSeeDashboard',
      can_see_projects: 'canSeeProjects',
      can_see_staff: 'canSeeStaff',
      can_see_allocations: 'canSeeAllocations',
      can_see_timesheets: 'canSeeTimesheets',
      can_see_absences: 'canSeeAbsences',
      can_see_financials: 'canSeeFinancials',
      can_see_timeline: 'canSeeTimeline',
      can_see_reports: 'canSeeReports',
      can_see_import: 'canSeeImport',
      can_see_audit: 'canSeeAudit',
      can_see_proposals: 'canSeeProposals',
      can_see_collaboration: 'canSeeCollaboration',
      can_see_salary_info: 'canSeeSalary',
      can_see_financial_details: 'canSeeFinancialDetails',
      can_see_personnel_rates: 'canSeePersonnelRates',
      can_edit_projects: 'canManageProjects',
      can_edit_allocations: 'canManageAllocations',
      can_approve_timesheets: 'canApproveTimesheets',
      can_submit_timesheets: 'canSubmitTimesheets',
      can_manage_budgets: 'canManageBudgets',
      can_generate_reports: 'canGenerateReports',
      can_manage_users: 'canManageUsers',
      can_manage_org: 'canManageOrg',
    }
    const permKey = keyMap[key as string]
    return permKey ? (defaults as any)[permKey] ?? false : false
  }

  const togglePerm = (role: OrgRole, key: keyof RolePermission) => {
    const current = getPermValue(role, key)
    setPermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [key]: !current,
      },
    }))
    setDirty(true)
  }

  const handleSave = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      for (const role of CONFIGURABLE_ROLES) {
        const rp = permissions[role]
        if (!rp) continue

        const existing = rp.id
        const row: Record<string, any> = {
          org_id: orgId,
          role,
          updated_at: new Date().toISOString(),
        }

        // Set all permission columns from current state
        for (const group of [MODULE_PERMISSIONS, DATA_PRIVACY_PERMISSIONS, ACTION_PERMISSIONS]) {
          for (const item of group) {
            row[item.key as string] = getPermValue(role, item.key)
          }
        }

        if (existing) {
          const { error } = await (supabase as any)
            .from('role_permissions')
            .update(row)
            .eq('id', existing)
          if (error) throw error
        } else {
          const { error } = await (supabase as any)
            .from('role_permissions')
            .insert(row)
          if (error) throw error
        }
      }

      toast({ title: 'Saved', description: 'Role permissions have been updated. Users will see changes on next login.' })
      setDirty(false)
      fetchPermissions()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleResetToDefaults = () => {
    const proceed = window.confirm(
      `Reset "${selectedRole}" permissions to defaults?\n\nThis will discard any customizations for this role.`
    )
    if (!proceed) return

    const defaults = computePermissions(selectedRole)
    const keyMap: Record<string, string> = {
      canSeeDashboard: 'can_see_dashboard',
      canSeeProjects: 'can_see_projects',
      canSeeStaff: 'can_see_staff',
      canSeeAllocations: 'can_see_allocations',
      canSeeTimesheets: 'can_see_timesheets',
      canSeeAbsences: 'can_see_absences',
      canSeeFinancials: 'can_see_financials',
      canSeeTimeline: 'can_see_timeline',
      canSeeReports: 'can_see_reports',
      canSeeImport: 'can_see_import',
      canSeeAudit: 'can_see_audit',
      canSeeProposals: 'can_see_proposals',
      canSeeCollaboration: 'can_see_collaboration',
      canSeeSalary: 'can_see_salary_info',
      canSeeFinancialDetails: 'can_see_financial_details',
      canSeePersonnelRates: 'can_see_personnel_rates',
      canManageProjects: 'can_edit_projects',
      canManageAllocations: 'can_edit_allocations',
      canApproveTimesheets: 'can_approve_timesheets',
      canSubmitTimesheets: 'can_submit_timesheets',
      canManageBudgets: 'can_manage_budgets',
      canGenerateReports: 'can_generate_reports',
      canManageUsers: 'can_manage_users',
      canManageOrg: 'can_manage_org',
    }

    const reset: Partial<RolePermission> = { ...permissions[selectedRole] }
    for (const [permKey, dbKey] of Object.entries(keyMap)) {
      (reset as any)[dbKey] = (defaults as any)[permKey]
    }

    setPermissions(prev => ({ ...prev, [selectedRole]: reset }))
    setDirty(true)
  }

  if (loading) return <Skeleton className="h-96 w-full" />

  const renderPermissionGroup = (title: string, description: string, items: PermissionItem[]) => (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-1">
        {items.map(item => {
          const checked = getPermValue(selectedRole, item.key)
          return (
            <label
              key={item.key as string}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors',
                'hover:bg-muted/50',
                checked && 'bg-primary/5',
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => togglePerm(selectedRole, item.key)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="block text-xs text-muted-foreground">{item.description}</span>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Role Permissions
          </CardTitle>
          <CardDescription>
            Configure what each role can see and do. Administrators always have full access.
            External Participants can only access projects they are invited to and are not configurable here.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleResetToDefaults} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to Defaults
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty || saving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Role selector tabs */}
        <div className="inline-flex items-center rounded-lg border bg-muted/40 p-0.5 flex-wrap">
          {CONFIGURABLE_ROLES.map(role => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={cn(
                'rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all',
                selectedRole === role
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {role}
            </button>
          ))}
        </div>

        {/* Admin note */}
        <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30 px-3 py-2">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Note:</strong> Administrator role always has full access to all modules and data. Changes below apply to <strong>{selectedRole}</strong> users only.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div>
            {renderPermissionGroup(
              'Module Visibility',
              'Which sections appear in the sidebar',
              MODULE_PERMISSIONS,
            )}
          </div>
          <div>
            {renderPermissionGroup(
              'Sensitive Data',
              'Access to confidential information',
              DATA_PRIVACY_PERMISSIONS,
            )}
          </div>
          <div>
            {renderPermissionGroup(
              'Actions',
              'What this role can create, edit, or manage',
              ACTION_PERMISSIONS,
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
