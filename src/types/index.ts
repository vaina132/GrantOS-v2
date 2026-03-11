export type OrgRole = 'Admin' | 'Project Manager' | 'Finance Officer' | 'Viewer' | 'External Participant'
export type GuestAccessLevel = 'contributor' | 'read_only'
export type AccessType = 'member' | 'guest'
export type OrgPlan = 'trial' | 'starter' | 'growth' | 'enterprise'

export type ProjectStatus = 'Upcoming' | 'Active' | 'Completed' | 'Suspended'
export type AssignmentType = 'actual' | 'official'
export type TimesheetStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected'
export type EmploymentType = 'Full-time' | 'Part-time' | 'Contractor'
export type AbsenceType = 'Annual Leave' | 'Sick Leave' | 'Training' | 'Public Holiday' | 'Other'
export type AbsencePeriod = 'full' | 'am' | 'pm'
export type FinancialCategory = 'personnel' | 'travel' | 'subcontracting' | 'other' | 'indirect'
export type AllocationsMode = 'actual' | 'official' | 'compare'
export type Granularity = 'monthly' | 'quarterly' | 'annual' | 'custom'

export interface Organisation {
  id: string
  name: string
  currency: string
  working_hours_per_day: number
  working_days_per_year: number
  default_overhead_rate: number
  average_personnel_rate_pm: number
  departments: string[]
  timesheets_drive_allocations: boolean
  plan: OrgPlan
  trial_ends_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface OrgMember {
  id: string
  user_id: string
  org_id: string
  role: OrgRole
  invited_by: string | null
  created_at: string
  updated_at: string
}

export interface RolePermission {
  id: string
  org_id: string
  role: OrgRole
  // Module visibility
  can_see_dashboard: boolean
  can_see_projects: boolean
  can_see_staff: boolean
  can_see_allocations: boolean
  can_see_timesheets: boolean
  can_see_absences: boolean
  can_see_financials: boolean
  can_see_timeline: boolean
  can_see_reports: boolean
  can_see_import: boolean
  can_see_audit: boolean
  can_see_guests: boolean
  can_see_proposals: boolean
  // Data privacy
  can_see_salary_info: boolean
  can_see_financial_details: boolean
  can_see_personnel_rates: boolean
  // Action permissions
  can_edit_projects: boolean
  can_edit_allocations: boolean
  can_approve_timesheets: boolean
  can_submit_timesheets: boolean
  can_manage_budgets: boolean
  can_generate_reports: boolean
  can_manage_users: boolean
  can_manage_org: boolean
  created_at: string
  updated_at: string
}

export interface Person {
  id: string
  org_id: string
  full_name: string
  email: string | null
  department: string | null
  role: string | null
  employment_type: EmploymentType
  fte: number
  start_date: string | null
  end_date: string | null
  annual_salary: number | null
  overhead_rate: number | null
  country: string | null
  is_active: boolean
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  org_id: string
  acronym: string
  title: string
  funding_scheme_id: string | null
  grant_number: string | null
  status: ProjectStatus
  start_date: string
  end_date: string
  total_budget: number | null
  overhead_rate: number | null
  has_wps: boolean
  is_lead_organisation: boolean
  our_pm_rate: number | null
  budget_personnel: number | null
  budget_travel: number | null
  budget_subcontracting: number | null
  budget_other: number | null
  responsible_person_id: string | null
  created_at: string
  updated_at: string
  funding_schemes?: FundingScheme | null
  responsible_person?: Person | null
}

export interface WorkPackage {
  id: string
  org_id: string
  project_id: string
  number: number | null
  name: string
  description: string | null
  lead_person_id: string | null
  start_month: number | null
  end_month: number | null
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
}

export interface Assignment {
  id: string
  org_id: string
  person_id: string
  project_id: string
  work_package_id: string | null
  year: number
  month: number
  pms: number
  type: AssignmentType
  created_at: string
  updated_at: string
}

export interface PmBudget {
  id: string
  org_id: string
  project_id: string
  work_package_id: string | null
  year: number
  target_pms: number
  type: AssignmentType
  created_at: string
  updated_at: string
}

export interface TimesheetEntry {
  id: string
  org_id: string
  person_id: string
  project_id: string
  work_package_id: string | null
  year: number
  month: number
  planned_hours: number | null
  actual_hours: number | null
  total_hours: number | null
  working_days: number | null
  hours: number | null
  planned_percentage: number | null
  confirmed_percentage: number | null
  status: TimesheetStatus
  submitted_at: string | null
  submitted_by: string | null
  confirmed_at: string | null
  confirmed_by: string | null
  approved_at: string | null
  approved_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TimesheetDay {
  id: string
  org_id: string
  person_id: string
  project_id: string
  work_package_id: string | null
  date: string
  hours: number
  created_at: string
  updated_at: string
}

export interface Holiday {
  id: string
  org_id: string
  date: string
  name: string
  created_at: string
}

export interface Absence {
  id: string
  org_id: string
  person_id: string
  type: AbsenceType
  start_date: string | null
  end_date: string | null
  days: number | null
  notes: string | null
  date: string | null
  period: AbsencePeriod | null
  note: string | null
  created_at: string
  updated_at: string
}

export interface FinancialBudget {
  id: string
  org_id: string
  project_id: string
  category: FinancialCategory
  year: number
  budgeted: number
  actual: number
  created_at: string
  updated_at: string
}

export type ExpenseCategory = 'travel' | 'subcontracting' | 'other' | 'indirect'

export interface ProjectExpense {
  id: string
  org_id: string
  project_id: string
  category: ExpenseCategory
  description: string
  amount: number
  expense_date: string
  vendor: string | null
  reference: string | null
  person_id: string | null
  notes: string | null
  recorded_by: string | null
  created_at: string
  updated_at: string
}

export interface UserPreferences {
  id: string
  user_id: string
  org_id: string
  display_name: string | null
  email_timesheet_reminders: boolean
  email_timesheet_submitted: boolean
  email_project_alerts: boolean
  email_budget_alerts: boolean
  email_period_locked: boolean
  email_role_changes: boolean
  email_invitations: boolean
  email_welcome: boolean
  email_trial_expiring: boolean
  created_at: string
  updated_at: string
}

export type ProposalStatus = 'In Preparation' | 'Submitted' | 'Rejected' | 'Granted'

export interface Proposal {
  id: string
  org_id: string
  project_name: string
  call_identifier: string
  funding_scheme: string
  submission_deadline: string | null
  expected_decision: string | null
  our_pms: number
  personnel_budget: number
  travel_budget: number
  subcontracting_budget: number
  other_budget: number
  status: ProposalStatus
  converted_project_id: string | null
  responsible_person_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  responsible_person?: Person | null
}

export type NotificationType = 'info' | 'success' | 'warning' | 'assignment' | 'approval' | 'alert' | 'invitation' | 'system'

export interface AppNotification {
  id: string
  org_id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  link: string | null
  is_read: boolean
  created_at: string
}

export interface FundingScheme {
  id: string
  org_id: string
  name: string
  type: string
  overhead_rate: number
  created_at: string
  updated_at: string
}

export interface ProjectDocument {
  id: string
  org_id: string
  project_id: string
  title: string | null
  name: string | null
  document_type: string | null
  description: string | null
  file_name: string | null
  file_url: string | null
  file_size: string | null
  file_size_bytes: number | null
  uploaded_by: string | null
  uploaded_at: string | null
  valid_from: string | null
  valid_until: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
}

export interface AuditLog {
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
  org_id: string
  user_id: string | null
  entity_type: string | null
  entity_id: string | null
  field_name: string | null
  old_value: string | null
  new_value: string | null
  action: string | null
  changed_by_name: string | null
  notes: string | null
  created_at: string
}

export type GuestInvitationStatus = 'pending' | 'accepted' | 'revoked'

export interface ProjectGuest {
  id: string
  org_id: string
  project_id: string
  user_id: string | null
  invited_email: string | null
  invited_name: string | null
  guest_org_name: string | null
  invited_by: string | null
  access_level: GuestAccessLevel
  status: GuestInvitationStatus
  is_active: boolean
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface PeriodLock {
  id: string
  org_id: string
  year: number
  month: number
  locked_by: string | null
  locked_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface GuestProject {
  project_id: string
  access_level: GuestAccessLevel
}

export interface Deliverable {
  id: string
  org_id: string
  project_id: string
  work_package_id: string | null
  number: string
  title: string
  description: string | null
  lead_person_id: string | null
  due_month: number | null
  created_at: string
  updated_at: string
}

export interface Milestone {
  id: string
  org_id: string
  project_id: string
  work_package_id: string | null
  number: string
  title: string
  description: string | null
  due_month: number | null
  verification_means: string | null
  created_at: string
  updated_at: string
}

export interface ReportingPeriod {
  id: string
  org_id: string
  project_id: string
  period_number: number
  start_month: number
  end_month: number
  technical_report_due: string | null
  financial_report_due: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ── AI Grant Agreement Extraction ─────────────────────────────
export interface GrantAIExtraction {
  project: {
    acronym: string
    title: string
    grant_number: string | null
    start_date: string
    end_date: string
    total_budget: number | null
    overhead_rate: number | null
    has_wps: boolean
    is_lead_organisation: boolean
    our_pm_rate: number | null
    budget_personnel: number | null
    budget_travel: number | null
    budget_subcontracting: number | null
    budget_other: number | null
  }
  work_packages: {
    number: number
    name: string
    description: string | null
    start_month: number
    end_month: number
    person_months: number | null
  }[]
  deliverables: {
    number: string
    title: string
    description: string | null
    wp_number: number | null
    due_month: number
  }[]
  milestones: {
    number: string
    title: string
    description: string | null
    wp_number: number | null
    due_month: number
    verification_means: string | null
  }[]
  reporting_periods: {
    period_number: number
    start_month: number
    end_month: number
  }[]
  confidence_notes: string
}
