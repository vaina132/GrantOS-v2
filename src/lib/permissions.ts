import type { OrgRole, RolePermission } from '@/types'

export interface Permissions {
  // Module visibility
  canSeeDashboard: boolean
  canSeeProjects: boolean
  canSeeStaff: boolean
  canSeeAllocations: boolean
  canSeeTimesheets: boolean
  canSeeAbsences: boolean
  canSeeFinancials: boolean
  canSeeTimeline: boolean
  canSeeReports: boolean
  canSeeImport: boolean
  canSeeAudit: boolean
  canSeeProposals: boolean
  canSeeCollaboration: boolean
  // Data privacy
  canSeeSalary: boolean
  canSeeFinancialDetails: boolean
  canSeePersonnelRates: boolean
  // Action permissions
  canManageProjects: boolean
  canManageAllocations: boolean
  canApproveTimesheets: boolean
  canSubmitTimesheets: boolean
  canManageBudgets: boolean
  canGenerateReports: boolean
  canManageUsers: boolean
  canWrite: boolean
  canManageOrg: boolean
}

export type PermissionKey = keyof Permissions

/** Hardcoded fallback permissions per role (used when no DB role_permissions exist) */
const ROLE_PERMISSIONS: Record<OrgRole, Permissions> = {
  Admin: {
    canSeeDashboard: true,
    canSeeProjects: true,
    canSeeStaff: true,
    canSeeAllocations: true,
    canSeeTimesheets: true,
    canSeeAbsences: true,
    canSeeFinancials: true,
    canSeeTimeline: true,
    canSeeReports: true,
    canSeeImport: true,
    canSeeAudit: true,
    canSeeProposals: true,
    canSeeCollaboration: true,
    canSeeSalary: true,
    canSeeFinancialDetails: true,
    canSeePersonnelRates: true,
    canManageProjects: true,
    canManageAllocations: true,
    canApproveTimesheets: true,
    canSubmitTimesheets: true,
    canManageBudgets: true,
    canGenerateReports: true,
    canManageUsers: true,
    canWrite: true,
    canManageOrg: true,
  },
  'Project Manager': {
    canSeeDashboard: true,
    canSeeProjects: true,
    canSeeStaff: true,
    canSeeAllocations: true,
    canSeeTimesheets: true,
    canSeeAbsences: true,
    canSeeFinancials: true,
    canSeeTimeline: true,
    canSeeReports: true,
    canSeeImport: true,
    canSeeAudit: false,
    canSeeProposals: true,
    canSeeCollaboration: true,
    canSeeSalary: false,
    canSeeFinancialDetails: true,
    canSeePersonnelRates: false,
    canManageProjects: true,
    canManageAllocations: true,
    canApproveTimesheets: false,
    canSubmitTimesheets: true,
    canManageBudgets: true,
    canGenerateReports: true,
    canManageUsers: false,
    canWrite: true,
    canManageOrg: false,
  },
  'Finance Officer': {
    canSeeDashboard: true,
    canSeeProjects: true,
    canSeeStaff: true,
    canSeeAllocations: true,
    canSeeTimesheets: true,
    canSeeAbsences: true,
    canSeeFinancials: true,
    canSeeTimeline: true,
    canSeeReports: true,
    canSeeImport: true,
    canSeeAudit: true,
    canSeeProposals: true,
    canSeeCollaboration: true,
    canSeeSalary: true,
    canSeeFinancialDetails: true,
    canSeePersonnelRates: true,
    canManageProjects: false,
    canManageAllocations: true,
    canApproveTimesheets: true,
    canSubmitTimesheets: true,
    canManageBudgets: true,
    canGenerateReports: true,
    canManageUsers: false,
    canWrite: true,
    canManageOrg: false,
  },
  'External Participant': {
    canSeeDashboard: false,
    canSeeProjects: false,
    canSeeStaff: false,
    canSeeAllocations: false,
    canSeeTimesheets: false,
    canSeeAbsences: false,
    canSeeFinancials: false,
    canSeeTimeline: false,
    canSeeReports: false,
    canSeeImport: false,
    canSeeAudit: false,
    canSeeProposals: false,
    canSeeCollaboration: true,
    canSeeSalary: false,
    canSeeFinancialDetails: false,
    canSeePersonnelRates: false,
    canManageProjects: false,
    canManageAllocations: false,
    canApproveTimesheets: false,
    canSubmitTimesheets: false,
    canManageBudgets: false,
    canGenerateReports: false,
    canManageUsers: false,
    canWrite: true,
    canManageOrg: false,
  },
}

/** Convert a DB RolePermission record to a Permissions object */
export function rolePermissionToPermissions(rp: RolePermission): Permissions {
  return {
    canSeeDashboard: rp.can_see_dashboard,
    canSeeProjects: rp.can_see_projects,
    canSeeStaff: rp.can_see_staff,
    canSeeAllocations: rp.can_see_allocations,
    canSeeTimesheets: rp.can_see_timesheets,
    canSeeAbsences: rp.can_see_absences,
    canSeeFinancials: rp.can_see_financials,
    canSeeTimeline: rp.can_see_timeline,
    canSeeReports: rp.can_see_reports,
    canSeeImport: rp.can_see_import,
    canSeeAudit: rp.can_see_audit,
    canSeeProposals: rp.can_see_proposals ?? true,
    canSeeCollaboration: (rp as any).can_see_collaboration ?? true,
    canSeeSalary: rp.can_see_salary_info,
    canSeeFinancialDetails: rp.can_see_financial_details,
    canSeePersonnelRates: rp.can_see_personnel_rates,
    canManageProjects: rp.can_edit_projects,
    canManageAllocations: rp.can_edit_allocations,
    canApproveTimesheets: rp.can_approve_timesheets,
    canSubmitTimesheets: rp.can_submit_timesheets,
    canManageBudgets: rp.can_manage_budgets,
    canGenerateReports: rp.can_generate_reports,
    canManageUsers: rp.can_manage_users,
    canWrite: rp.can_edit_projects || rp.can_edit_allocations || rp.can_submit_timesheets,
    canManageOrg: rp.can_manage_org,
  }
}

/** Hardcoded fallback — used when role_permissions table is empty or unavailable */
export function computePermissions(role: OrgRole): Permissions {
  return ROLE_PERMISSIONS[role] ?? DEFAULT_PERMISSIONS
}

export const DEFAULT_PERMISSIONS: Permissions = {
  canSeeDashboard: false,
  canSeeProjects: false,
  canSeeStaff: false,
  canSeeAllocations: false,
  canSeeTimesheets: false,
  canSeeAbsences: false,
  canSeeFinancials: false,
  canSeeTimeline: false,
  canSeeReports: false,
  canSeeImport: false,
  canSeeAudit: false,
  canSeeProposals: false,
  canSeeCollaboration: false,
  canSeeSalary: false,
  canSeeFinancialDetails: false,
  canSeePersonnelRates: false,
  canManageProjects: false,
  canManageAllocations: false,
  canApproveTimesheets: false,
  canSubmitTimesheets: false,
  canManageBudgets: false,
  canGenerateReports: false,
  canManageUsers: false,
  canWrite: false,
  canManageOrg: false,
}

export interface RoutePermission {
  path: string
  minPermission?: PermissionKey
}

export const ROUTE_PERMISSIONS: RoutePermission[] = [
  { path: '/dashboard', minPermission: 'canSeeDashboard' },
  { path: '/projects', minPermission: 'canSeeProjects' },
  { path: '/staff', minPermission: 'canSeeStaff' },
  { path: '/allocations', minPermission: 'canSeeAllocations' },
  { path: '/timesheets', minPermission: 'canSeeTimesheets' },
  { path: '/absences', minPermission: 'canSeeAbsences' },
  { path: '/financials', minPermission: 'canSeeFinancials' },
  { path: '/timeline', minPermission: 'canSeeTimeline' },
  { path: '/reports', minPermission: 'canSeeReports' },
  { path: '/audit', minPermission: 'canSeeAudit' },
  { path: '/proposals', minPermission: 'canSeeProposals' },
  { path: '/projects/collaboration', minPermission: 'canSeeCollaboration' },
  { path: '/settings', minPermission: 'canManageOrg' },
]
