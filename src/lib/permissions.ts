import type { OrgRole, GuestAccessLevel, RolePermission } from '@/types'

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
  canSeeGuests: boolean
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
    canSeeGuests: true,
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
    canSeeImport: false,
    canSeeAudit: false,
    canSeeGuests: false,
    canSeeSalary: false,
    canSeeFinancialDetails: true,
    canSeePersonnelRates: false,
    canManageProjects: true,
    canManageAllocations: true,
    canApproveTimesheets: true,
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
    canSeeAllocations: false,
    canSeeTimesheets: false,
    canSeeAbsences: false,
    canSeeFinancials: true,
    canSeeTimeline: true,
    canSeeReports: true,
    canSeeImport: false,
    canSeeAudit: true,
    canSeeGuests: false,
    canSeeSalary: true,
    canSeeFinancialDetails: true,
    canSeePersonnelRates: true,
    canManageProjects: false,
    canManageAllocations: false,
    canApproveTimesheets: false,
    canSubmitTimesheets: false,
    canManageBudgets: false,
    canGenerateReports: true,
    canManageUsers: false,
    canWrite: false,
    canManageOrg: false,
  },
  Viewer: {
    canSeeDashboard: true,
    canSeeProjects: true,
    canSeeStaff: true,
    canSeeAllocations: false,
    canSeeTimesheets: false,
    canSeeAbsences: false,
    canSeeFinancials: false,
    canSeeTimeline: true,
    canSeeReports: false,
    canSeeImport: false,
    canSeeAudit: false,
    canSeeGuests: false,
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
  },
  'External Participant': {
    canSeeDashboard: false,
    canSeeProjects: true,
    canSeeStaff: false,
    canSeeAllocations: false,
    canSeeTimesheets: true,
    canSeeAbsences: false,
    canSeeFinancials: false,
    canSeeTimeline: false,
    canSeeReports: false,
    canSeeImport: false,
    canSeeAudit: false,
    canSeeGuests: false,
    canSeeSalary: false,
    canSeeFinancialDetails: false,
    canSeePersonnelRates: false,
    canManageProjects: false,
    canManageAllocations: false,
    canApproveTimesheets: false,
    canSubmitTimesheets: true,
    canManageBudgets: false,
    canGenerateReports: false,
    canManageUsers: false,
    canWrite: true,
    canManageOrg: false,
  },
}

const GUEST_PERMISSIONS: Record<GuestAccessLevel, Permissions> = {
  contributor: {
    canSeeDashboard: false,
    canSeeProjects: true,
    canSeeStaff: false,
    canSeeAllocations: false,
    canSeeTimesheets: true,
    canSeeAbsences: false,
    canSeeFinancials: false,
    canSeeTimeline: false,
    canSeeReports: false,
    canSeeImport: false,
    canSeeAudit: false,
    canSeeGuests: false,
    canSeeSalary: false,
    canSeeFinancialDetails: false,
    canSeePersonnelRates: false,
    canManageProjects: false,
    canManageAllocations: false,
    canApproveTimesheets: false,
    canSubmitTimesheets: true,
    canManageBudgets: false,
    canGenerateReports: false,
    canManageUsers: false,
    canWrite: true,
    canManageOrg: false,
  },
  read_only: {
    canSeeDashboard: false,
    canSeeProjects: true,
    canSeeStaff: false,
    canSeeAllocations: false,
    canSeeTimesheets: false,
    canSeeAbsences: false,
    canSeeFinancials: false,
    canSeeTimeline: false,
    canSeeReports: false,
    canSeeImport: false,
    canSeeAudit: false,
    canSeeGuests: false,
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
    canSeeGuests: rp.can_see_guests,
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

export function computeGuestPermissions(accessLevel: GuestAccessLevel): Permissions {
  return GUEST_PERMISSIONS[accessLevel]
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
  canSeeGuests: false,
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
  guestAllowed?: boolean
}

export const ROUTE_PERMISSIONS: RoutePermission[] = [
  { path: '/dashboard' },
  { path: '/projects' },
  { path: '/staff' },
  { path: '/allocations', minPermission: 'canManageAllocations' },
  { path: '/timesheets', minPermission: 'canSubmitTimesheets', guestAllowed: true },
  { path: '/absences', minPermission: 'canManageAllocations' },
  { path: '/financials', minPermission: 'canSeeFinancials' },
  { path: '/timeline' },
  { path: '/reports', minPermission: 'canGenerateReports' },
  { path: '/import', minPermission: 'canManageOrg' },
  { path: '/audit', minPermission: 'canSeeFinancials' },
  { path: '/settings', minPermission: 'canManageOrg' },
]
