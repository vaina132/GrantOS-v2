-- Quick fix: Apply RLS policies to audit_log table
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- Ensure helper functions exist
CREATE OR REPLACE FUNCTION auth_org_id() RETURNS UUID AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_role() RETURNS TEXT AS $$
  SELECT role FROM org_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop any stale policies
DROP POLICY IF EXISTS "Members can view audit log" ON audit_log;
DROP POLICY IF EXISTS "System can insert audit log" ON audit_log;
DROP POLICY IF EXISTS "auditlog_select" ON audit_log;
DROP POLICY IF EXISTS "auditlog_insert" ON audit_log;

-- Enable RLS (idempotent)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Allow Admins and Finance Officers to read audit logs
CREATE POLICY "auditlog_select"
  ON audit_log FOR SELECT
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin', 'Finance Officer'));

-- Allow any authenticated org member to write audit entries
CREATE POLICY "auditlog_insert"
  ON audit_log FOR INSERT
  WITH CHECK (org_id = auth_org_id());

-- Same for audit_changes
DROP POLICY IF EXISTS "Members can view audit changes" ON audit_changes;
DROP POLICY IF EXISTS "System can insert audit changes" ON audit_changes;
DROP POLICY IF EXISTS "auditchg_select" ON audit_changes;
DROP POLICY IF EXISTS "auditchg_insert" ON audit_changes;

ALTER TABLE audit_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auditchg_select"
  ON audit_changes FOR SELECT
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin', 'Finance Officer'));

CREATE POLICY "auditchg_insert"
  ON audit_changes FOR INSERT
  WITH CHECK (org_id = auth_org_id());
