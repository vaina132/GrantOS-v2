import type { OrgRole, GuestAccessLevel } from '@/types'

export interface Permissions {
  canSeeSalary: boolean
  canSeeFinancials: boolean
  canManageBudgets: boolean
  canManageProjects: boolean
  canManageAllocations: boolean
  canApproveTimesheets: boolean
  canSubmitTimesheets: boolean
  canGenerateReports: boolean
  canManageUsers: boolean
  canWrite: boolean
  canManageOrg: boolean
}

export type PermissionKey = keyof Permissions

const ROLE_PERMISSIONS: Record<OrgRole, Permissions> = {
  Admin: {
    canSeeSalary: true,
    canSeeFinancials: true,
    canManageBudgets: true,
    canManageProjects: true,
    canManageAllocations: true,
    canApproveTimesheets: true,
    canSubmitTimesheets: true,
    canGenerateReports: true,
    canManageUsers: true,
    canWrite: true,
    canManageOrg: true,
  },
  'Grant Manager': {
    canSeeSalary: false,
    canSeeFinancials: true,
    canManageBudgets: true,
    canManageProjects: true,
    canManageAllocations: true,
    canApproveTimesheets: true,
    canSubmitTimesheets: true,
    canGenerateReports: true,
    canManageUsers: false,
    canWrite: true,
    canManageOrg: false,
  },
  'Finance Officer': {
    canSeeSalary: true,
    canSeeFinancials: true,
    canManageBudgets: false,
    canManageProjects: false,
    canManageAllocations: false,
    canApproveTimesheets: false,
    canSubmitTimesheets: false,
    canGenerateReports: true,
    canManageUsers: false,
    canWrite: false,
    canManageOrg: false,
  },
  Viewer: {
    canSeeSalary: false,
    canSeeFinancials: false,
    canManageBudgets: false,
    canManageProjects: false,
    canManageAllocations: false,
    canApproveTimesheets: false,
    canSubmitTimesheets: false,
    canGenerateReports: false,
    canManageUsers: false,
    canWrite: false,
    canManageOrg: false,
  },
}

const GUEST_PERMISSIONS: Record<GuestAccessLevel, Permissions> = {
  contributor: {
    canSeeSalary: false,
    canSeeFinancials: false,
    canManageBudgets: false,
    canManageProjects: false,
    canManageAllocations: false,
    canApproveTimesheets: false,
    canSubmitTimesheets: true,
    canGenerateReports: false,
    canManageUsers: false,
    canWrite: true,
    canManageOrg: false,
  },
  read_only: {
    canSeeSalary: false,
    canSeeFinancials: false,
    canManageBudgets: false,
    canManageProjects: false,
    canManageAllocations: false,
    canApproveTimesheets: false,
    canSubmitTimesheets: false,
    canGenerateReports: false,
    canManageUsers: false,
    canWrite: false,
    canManageOrg: false,
  },
}

export function computePermissions(role: OrgRole): Permissions {
  return ROLE_PERMISSIONS[role]
}

export function computeGuestPermissions(accessLevel: GuestAccessLevel): Permissions {
  return GUEST_PERMISSIONS[accessLevel]
}

export const DEFAULT_PERMISSIONS: Permissions = {
  canSeeSalary: false,
  canSeeFinancials: false,
  canManageBudgets: false,
  canManageProjects: false,
  canManageAllocations: false,
  canApproveTimesheets: false,
  canSubmitTimesheets: false,
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
