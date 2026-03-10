-- Migration: Rename roles and create role_permissions table
-- 1. Rename existing roles in org_members
UPDATE org_members SET role = 'Project Manager' WHERE role = 'Grant Manager';

-- 2. Update the CHECK constraint to accept new role names
ALTER TABLE org_members DROP CONSTRAINT IF EXISTS org_members_role_check;
ALTER TABLE org_members ADD CONSTRAINT org_members_role_check
  CHECK (role IN ('Admin','Project Manager','Finance Officer','Viewer','External Participant'));

-- 2. Create role_permissions table for configurable module visibility & data privacy
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role text NOT NULL,
  -- Module visibility (which sidebar modules this role can see)
  can_see_dashboard boolean NOT NULL DEFAULT true,
  can_see_projects boolean NOT NULL DEFAULT true,
  can_see_staff boolean NOT NULL DEFAULT true,
  can_see_allocations boolean NOT NULL DEFAULT false,
  can_see_timesheets boolean NOT NULL DEFAULT true,
  can_see_absences boolean NOT NULL DEFAULT false,
  can_see_financials boolean NOT NULL DEFAULT false,
  can_see_timeline boolean NOT NULL DEFAULT true,
  can_see_reports boolean NOT NULL DEFAULT false,
  can_see_import boolean NOT NULL DEFAULT false,
  can_see_audit boolean NOT NULL DEFAULT false,
  can_see_guests boolean NOT NULL DEFAULT false,
  -- Data privacy (what sensitive data this role can see)
  can_see_salary_info boolean NOT NULL DEFAULT false,
  can_see_financial_details boolean NOT NULL DEFAULT false,
  can_see_personnel_rates boolean NOT NULL DEFAULT false,
  -- Action permissions
  can_edit_projects boolean NOT NULL DEFAULT false,
  can_edit_allocations boolean NOT NULL DEFAULT false,
  can_approve_timesheets boolean NOT NULL DEFAULT false,
  can_submit_timesheets boolean NOT NULL DEFAULT true,
  can_manage_budgets boolean NOT NULL DEFAULT false,
  can_generate_reports boolean NOT NULL DEFAULT false,
  can_manage_users boolean NOT NULL DEFAULT false,
  can_manage_org boolean NOT NULL DEFAULT false,
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, role)
);

-- Enable RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS: members can read their org's role_permissions
DROP POLICY IF EXISTS "Members can read role_permissions" ON role_permissions;
CREATE POLICY "Members can read role_permissions"
  ON role_permissions FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

-- RLS: only admins can insert/update/delete
DROP POLICY IF EXISTS "Admins can manage role_permissions" ON role_permissions;
CREATE POLICY "Admins can manage role_permissions"
  ON role_permissions FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role = 'Admin'
    )
  );

-- 3. Insert default role_permissions for each existing org
-- Administrator (full access — but these are defaults, Admin always overrides to full in code)
INSERT INTO role_permissions (org_id, role,
  can_see_dashboard, can_see_projects, can_see_staff, can_see_allocations,
  can_see_timesheets, can_see_absences, can_see_financials, can_see_timeline,
  can_see_reports, can_see_import, can_see_audit, can_see_guests,
  can_see_salary_info, can_see_financial_details, can_see_personnel_rates,
  can_edit_projects, can_edit_allocations, can_approve_timesheets, can_submit_timesheets,
  can_manage_budgets, can_generate_reports, can_manage_users, can_manage_org
)
SELECT id, 'Admin',
  true, true, true, true,
  true, true, true, true,
  true, true, true, true,
  true, true, true,
  true, true, true, true,
  true, true, true, true
FROM organisations
ON CONFLICT (org_id, role) DO NOTHING;

-- Project Manager
INSERT INTO role_permissions (org_id, role,
  can_see_dashboard, can_see_projects, can_see_staff, can_see_allocations,
  can_see_timesheets, can_see_absences, can_see_financials, can_see_timeline,
  can_see_reports, can_see_import, can_see_audit, can_see_guests,
  can_see_salary_info, can_see_financial_details, can_see_personnel_rates,
  can_edit_projects, can_edit_allocations, can_approve_timesheets, can_submit_timesheets,
  can_manage_budgets, can_generate_reports, can_manage_users, can_manage_org
)
SELECT id, 'Project Manager',
  true, true, true, true,
  true, true, true, true,
  true, false, false, false,
  false, true, false,
  true, true, true, true,
  true, true, false, false
FROM organisations
ON CONFLICT (org_id, role) DO NOTHING;

-- Finance Officer
INSERT INTO role_permissions (org_id, role,
  can_see_dashboard, can_see_projects, can_see_staff, can_see_allocations,
  can_see_timesheets, can_see_absences, can_see_financials, can_see_timeline,
  can_see_reports, can_see_import, can_see_audit, can_see_guests,
  can_see_salary_info, can_see_financial_details, can_see_personnel_rates,
  can_edit_projects, can_edit_allocations, can_approve_timesheets, can_submit_timesheets,
  can_manage_budgets, can_generate_reports, can_manage_users, can_manage_org
)
SELECT id, 'Finance Officer',
  true, true, true, false,
  false, false, true, true,
  true, false, true, false,
  true, true, true,
  false, false, false, false,
  false, true, false, false
FROM organisations
ON CONFLICT (org_id, role) DO NOTHING;

-- Viewer
INSERT INTO role_permissions (org_id, role,
  can_see_dashboard, can_see_projects, can_see_staff, can_see_allocations,
  can_see_timesheets, can_see_absences, can_see_financials, can_see_timeline,
  can_see_reports, can_see_import, can_see_audit, can_see_guests,
  can_see_salary_info, can_see_financial_details, can_see_personnel_rates,
  can_edit_projects, can_edit_allocations, can_approve_timesheets, can_submit_timesheets,
  can_manage_budgets, can_generate_reports, can_manage_users, can_manage_org
)
SELECT id, 'Viewer',
  true, true, true, false,
  false, false, false, true,
  false, false, false, false,
  false, false, false,
  false, false, false, false,
  false, false, false, false
FROM organisations
ON CONFLICT (org_id, role) DO NOTHING;

-- External Participant
INSERT INTO role_permissions (org_id, role,
  can_see_dashboard, can_see_projects, can_see_staff, can_see_allocations,
  can_see_timesheets, can_see_absences, can_see_financials, can_see_timeline,
  can_see_reports, can_see_import, can_see_audit, can_see_guests,
  can_see_salary_info, can_see_financial_details, can_see_personnel_rates,
  can_edit_projects, can_edit_allocations, can_approve_timesheets, can_submit_timesheets,
  can_manage_budgets, can_generate_reports, can_manage_users, can_manage_org
)
SELECT id, 'External Participant',
  false, true, false, false,
  true, false, false, false,
  false, false, false, false,
  false, false, false,
  false, false, false, true,
  false, false, false, false
FROM organisations
ON CONFLICT (org_id, role) DO NOTHING;
