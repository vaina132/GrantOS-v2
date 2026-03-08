-- GrantOS v2 Database Schema
-- Run this in your Supabase SQL Editor to create all required tables.
-- This creates tables, views, indexes, and RLS policies.

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ORGANISATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS organisations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  working_hours_per_day NUMERIC NOT NULL DEFAULT 8,
  working_days_per_year NUMERIC NOT NULL DEFAULT 220,
  default_overhead_rate NUMERIC NOT NULL DEFAULT 25,
  average_personnel_rate_pm NUMERIC NOT NULL DEFAULT 0,
  departments TEXT[] NOT NULL DEFAULT '{}',
  plan TEXT NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial','starter','growth','enterprise')),
  trial_ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ORG MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'Viewer' CHECK (role IN ('Admin','Grant Manager','Finance Officer','Viewer')),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, org_id)
);

-- ============================================================
-- FUNDING SCHEMES
-- ============================================================
CREATE TABLE IF NOT EXISTS funding_schemes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '',
  overhead_rate NUMERIC NOT NULL DEFAULT 25,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PERSONS (Staff)
-- ============================================================
CREATE TABLE IF NOT EXISTS persons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  department TEXT,
  role TEXT,
  employment_type TEXT NOT NULL DEFAULT 'Full-time' CHECK (employment_type IN ('Full-time','Part-time','Contractor')),
  fte NUMERIC NOT NULL DEFAULT 1.0,
  start_date DATE,
  end_date DATE,
  annual_salary NUMERIC,
  overhead_rate NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Masked view that hides salary for non-privileged users
CREATE OR REPLACE VIEW persons_masked AS
SELECT
  id, org_id, full_name, email, department, role,
  employment_type, fte, start_date, end_date, is_active,
  created_at, updated_at
FROM persons;

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  acronym TEXT NOT NULL,
  title TEXT NOT NULL,
  funding_scheme_id UUID REFERENCES funding_schemes(id) ON DELETE SET NULL,
  grant_number TEXT,
  status TEXT NOT NULL DEFAULT 'Upcoming' CHECK (status IN ('Active','Upcoming','Concluding','Completed','Suspended')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_budget NUMERIC,
  overhead_rate NUMERIC,
  has_wps BOOLEAN NOT NULL DEFAULT FALSE,
  our_pm_rate NUMERIC,
  budget_personnel NUMERIC,
  budget_travel NUMERIC,
  budget_subcontracting NUMERIC,
  budget_other NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- WORK PACKAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS work_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  lead_person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ASSIGNMENTS (allocations)
-- ============================================================
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_package_id UUID REFERENCES work_packages(id) ON DELETE SET NULL,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  pms NUMERIC NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'actual' CHECK (type IN ('actual','official')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(person_id, project_id, work_package_id, year, month, type)
);

-- ============================================================
-- PM BUDGETS
-- ============================================================
CREATE TABLE IF NOT EXISTS pm_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_package_id UUID REFERENCES work_packages(id) ON DELETE SET NULL,
  year INT NOT NULL,
  target_pms NUMERIC NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'actual' CHECK (type IN ('actual','official')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, work_package_id, year, type)
);

-- ============================================================
-- TIMESHEET ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_package_id UUID REFERENCES work_packages(id) ON DELETE SET NULL,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  hours NUMERIC,
  planned_percentage NUMERIC,
  confirmed_percentage NUMERIC,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Confirmed','Approved','Rejected')),
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ABSENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS absences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'Annual Leave' CHECK (type IN ('Annual Leave','Sick Leave','Training','Public Holiday','Other')),
  start_date DATE,
  end_date DATE,
  days NUMERIC,
  date DATE,
  period TEXT CHECK (period IN ('full','am','pm')),
  notes TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- FINANCIAL BUDGETS
-- ============================================================
CREATE TABLE IF NOT EXISTS financial_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('personnel','travel','subcontracting','other','indirect')),
  year INT NOT NULL,
  budgeted NUMERIC NOT NULL DEFAULT 0,
  actual NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, category, year)
);

-- ============================================================
-- PROJECT DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS project_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT,
  name TEXT,
  document_type TEXT,
  description TEXT,
  file_name TEXT,
  file_url TEXT,
  file_size TEXT,
  file_size_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  valid_from DATE,
  valid_until DATE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  entity_type TEXT,
  action TEXT,
  entity_id TEXT,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AUDIT CHANGES (field-level)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  entity_type TEXT,
  entity_id TEXT,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  action TEXT,
  changed_by_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PROJECT GUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS project_guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES auth.users(id),
  access_level TEXT NOT NULL DEFAULT 'read_only' CHECK (access_level IN ('contributor','read_only')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- ============================================================
-- PERIOD LOCKS
-- ============================================================
CREATE TABLE IF NOT EXISTS period_locks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  locked_by UUID REFERENCES auth.users(id),
  locked_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, year, month)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_persons_org ON persons(org_id);
CREATE INDEX IF NOT EXISTS idx_persons_active ON persons(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(org_id, status);
CREATE INDEX IF NOT EXISTS idx_work_packages_project ON work_packages(project_id);
CREATE INDEX IF NOT EXISTS idx_assignments_person ON assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_assignments_project ON assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_assignments_period ON assignments(org_id, year, month);
CREATE INDEX IF NOT EXISTS idx_timesheet_person ON timesheet_entries(person_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_project ON timesheet_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_period ON timesheet_entries(org_id, year, month);
CREATE INDEX IF NOT EXISTS idx_absences_person ON absences(person_id);
CREATE INDEX IF NOT EXISTS idx_financial_project ON financial_budgets(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_project_guests_user ON project_guests(user_id);
CREATE INDEX IF NOT EXISTS idx_period_locks_org ON period_locks(org_id, year, month);
CREATE INDEX IF NOT EXISTS idx_funding_schemes_org ON funding_schemes(org_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_locks ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's org_id
CREATE OR REPLACE FUNCTION auth_org_id() RETURNS UUID AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION auth_role() RETURNS TEXT AS $$
  SELECT role FROM org_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ORG MEMBERS: users can see their own membership
CREATE POLICY "Users can view own memberships"
  ON org_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage org members"
  ON org_members FOR ALL
  USING (org_id = auth_org_id() AND auth_role() = 'Admin');

-- ORGANISATIONS: members can view their org
CREATE POLICY "Members can view their org"
  ON organisations FOR SELECT
  USING (id = auth_org_id());

CREATE POLICY "Admins can update their org"
  ON organisations FOR UPDATE
  USING (id = auth_org_id() AND auth_role() = 'Admin');

-- For all org-scoped tables, members can read, writers can modify
-- FUNDING SCHEMES
CREATE POLICY "Members can view funding schemes"
  ON funding_schemes FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "Admins can manage funding schemes"
  ON funding_schemes FOR ALL
  USING (org_id = auth_org_id() AND auth_role() = 'Admin');

-- PERSONS
CREATE POLICY "Members can view persons"
  ON persons FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "Writers can manage persons"
  ON persons FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Grant Manager'));

-- PROJECTS
CREATE POLICY "Members can view projects"
  ON projects FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "Project managers can manage projects"
  ON projects FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Grant Manager'));

-- Guests can view assigned projects
CREATE POLICY "Guests can view assigned projects"
  ON projects FOR SELECT
  USING (
    id IN (
      SELECT project_id FROM project_guests
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

-- WORK PACKAGES
CREATE POLICY "Members can view work packages"
  ON work_packages FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "Project managers can manage work packages"
  ON work_packages FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Grant Manager'));

-- ASSIGNMENTS
CREATE POLICY "Members can view assignments"
  ON assignments FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "Managers can manage assignments"
  ON assignments FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Grant Manager'));

-- PM BUDGETS
CREATE POLICY "Members can view pm budgets"
  ON pm_budgets FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "Managers can manage pm budgets"
  ON pm_budgets FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Grant Manager'));

-- TIMESHEET ENTRIES
CREATE POLICY "Members can view timesheets"
  ON timesheet_entries FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "Writers can manage timesheets"
  ON timesheet_entries FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Grant Manager'));

-- ABSENCES
CREATE POLICY "Members can view absences"
  ON absences FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "Managers can manage absences"
  ON absences FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Grant Manager'));

-- FINANCIAL BUDGETS
CREATE POLICY "Finance users can view financial budgets"
  ON financial_budgets FOR SELECT
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Grant Manager','Finance Officer'));

CREATE POLICY "Managers can manage financial budgets"
  ON financial_budgets FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Grant Manager'));

-- PROJECT DOCUMENTS
CREATE POLICY "Members can view project documents"
  ON project_documents FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "Writers can manage project documents"
  ON project_documents FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Grant Manager'));

-- AUDIT LOG
CREATE POLICY "Members can view audit log"
  ON audit_log FOR SELECT
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Finance Officer'));

CREATE POLICY "System can insert audit log"
  ON audit_log FOR INSERT
  WITH CHECK (org_id = auth_org_id());

-- AUDIT CHANGES
CREATE POLICY "Members can view audit changes"
  ON audit_changes FOR SELECT
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Finance Officer'));

CREATE POLICY "System can insert audit changes"
  ON audit_changes FOR INSERT
  WITH CHECK (org_id = auth_org_id());

-- PROJECT GUESTS
CREATE POLICY "Users can view own guest access"
  ON project_guests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage project guests"
  ON project_guests FOR ALL
  USING (org_id = auth_org_id() AND auth_role() = 'Admin');

-- PERIOD LOCKS
CREATE POLICY "Members can view period locks"
  ON period_locks FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "Admins can manage period locks"
  ON period_locks FOR ALL
  USING (org_id = auth_org_id() AND auth_role() = 'Admin');

-- ============================================================
-- SEED: Bootstrap org and admin for test user
-- Replace the user_id below after your test user signs up.
-- ============================================================
-- Step 1: Create org
-- INSERT INTO organisations (id, name, plan) VALUES
--   ('00000000-0000-0000-0000-000000000001', 'My Research Lab', 'enterprise');

-- Step 2: Link test user (get user id from auth.users after first login)
-- INSERT INTO org_members (user_id, org_id, role) VALUES
--   ('<your-user-uuid-here>', '00000000-0000-0000-0000-000000000001', 'Admin');
