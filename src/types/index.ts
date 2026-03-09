export type OrgRole = 'Admin' | 'Grant Manager' | 'Finance Officer' | 'Viewer'
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
  our_pm_rate: number | null
  budget_personnel: number | null
  budget_travel: number | null
  budget_subcontracting: number | null
  budget_other: number | null
  created_at: string
  updated_at: string
  funding_schemes?: FundingScheme | null
}

export interface WorkPackage {
  id: string
  org_id: string
  project_id: string
  name: string
  description: string | null
  lead_person_id: string | null
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

export interface ProjectGuest {
  id: string
  org_id: string
  project_id: string
  user_id: string
  invited_by: string | null
  access_level: GuestAccessLevel
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
