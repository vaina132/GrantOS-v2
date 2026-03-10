-- GrantOS v2 — RLS Policies Migration
-- Safe to re-run: drops existing policies before recreating.
-- Run this in Supabase SQL Editor.

-- ============================================================
-- 1. Enable RLS on all tables
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

-- ============================================================
-- 2. Helper functions
-- ============================================================
CREATE OR REPLACE FUNCTION auth_org_id() RETURNS UUID AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_role() RETURNS TEXT AS $$
  SELECT role FROM org_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 3. Drop all existing policies (safe re-run)
-- ============================================================
DO $$ DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ============================================================
-- 4. ORGANISATIONS
-- ============================================================
CREATE POLICY "org_select_members"
  ON organisations FOR SELECT
  USING (id = auth_org_id());

CREATE POLICY "org_update_admin"
  ON organisations FOR UPDATE
  USING (id = auth_org_id() AND auth_role() = 'Admin');

-- Allow INSERT for new org creation during onboarding (any authenticated user)
CREATE POLICY "org_insert_authenticated"
  ON organisations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- 5. ORG MEMBERS
-- ============================================================
-- Any member can see their own membership row (needed for auth bootstrap)
CREATE POLICY "orgmem_select_own"
  ON org_members FOR SELECT
  USING (user_id = auth.uid());

-- Members can see all members in their org
CREATE POLICY "orgmem_select_org"
  ON org_members FOR SELECT
  USING (org_id = auth_org_id());

-- Admins can manage members
CREATE POLICY "orgmem_all_admin"
  ON org_members FOR ALL
  USING (org_id = auth_org_id() AND auth_role() = 'Admin');

-- Self-insert for onboarding (user creates their own membership)
CREATE POLICY "orgmem_insert_self"
  ON org_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 6. FUNDING SCHEMES
-- ============================================================
CREATE POLICY "fs_select"
  ON funding_schemes FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "fs_all_admin"
  ON funding_schemes FOR ALL
  USING (org_id = auth_org_id() AND auth_role() = 'Admin');

-- ============================================================
-- 7. PERSONS
-- ============================================================
CREATE POLICY "persons_select"
  ON persons FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "persons_all_writers"
  ON persons FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Project Manager'));

-- ============================================================
-- 8. PROJECTS
-- ============================================================
CREATE POLICY "projects_select"
  ON projects FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "projects_all_managers"
  ON projects FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Project Manager'));

-- Guests can view assigned projects
CREATE POLICY "projects_select_guests"
  ON projects FOR SELECT
  USING (
    id IN (
      SELECT project_id FROM project_guests
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

-- ============================================================
-- 9. WORK PACKAGES
-- ============================================================
CREATE POLICY "wp_select"
  ON work_packages FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "wp_all_managers"
  ON work_packages FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Project Manager'));

-- ============================================================
-- 10. ASSIGNMENTS
-- ============================================================
CREATE POLICY "assign_select"
  ON assignments FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "assign_all_managers"
  ON assignments FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Project Manager'));

-- ============================================================
-- 11. PM BUDGETS
-- ============================================================
CREATE POLICY "pmb_select"
  ON pm_budgets FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "pmb_all_managers"
  ON pm_budgets FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Project Manager'));

-- ============================================================
-- 12. TIMESHEET ENTRIES
-- ============================================================
CREATE POLICY "ts_select"
  ON timesheet_entries FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "ts_all_writers"
  ON timesheet_entries FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Project Manager'));

-- ============================================================
-- 13. ABSENCES
-- ============================================================
CREATE POLICY "abs_select"
  ON absences FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "abs_all_managers"
  ON absences FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Project Manager'));

-- ============================================================
-- 14. FINANCIAL BUDGETS
-- ============================================================
CREATE POLICY "fin_select"
  ON financial_budgets FOR SELECT
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Project Manager','Finance Officer'));

CREATE POLICY "fin_all_managers"
  ON financial_budgets FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Project Manager'));

-- ============================================================
-- 15. PROJECT DOCUMENTS
-- ============================================================
CREATE POLICY "docs_select"
  ON project_documents FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "docs_all_writers"
  ON project_documents FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Project Manager'));

-- ============================================================
-- 16. AUDIT LOGS
-- ============================================================
CREATE POLICY "auditlog_select"
  ON audit_log FOR SELECT
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Finance Officer'));

CREATE POLICY "auditlog_insert"
  ON audit_log FOR INSERT
  WITH CHECK (org_id = auth_org_id());

-- ============================================================
-- 17. AUDIT CHANGES
-- ============================================================
CREATE POLICY "auditchg_select"
  ON audit_changes FOR SELECT
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Finance Officer'));

CREATE POLICY "auditchg_insert"
  ON audit_changes FOR INSERT
  WITH CHECK (org_id = auth_org_id());

-- ============================================================
-- 18. PROJECT GUESTS
-- ============================================================
CREATE POLICY "guests_select_own"
  ON project_guests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "guests_select_org"
  ON project_guests FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "guests_all_admin"
  ON project_guests FOR ALL
  USING (org_id = auth_org_id() AND auth_role() = 'Admin');

-- ============================================================
-- 19. PERIOD LOCKS
-- ============================================================
CREATE POLICY "locks_select"
  ON period_locks FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "locks_all_admin"
  ON period_locks FOR ALL
  USING (org_id = auth_org_id() AND auth_role() = 'Admin');
