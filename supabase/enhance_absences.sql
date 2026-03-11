-- Enhance Absence Module: vacation entitlements, per-country holidays, approval workflow, absence approvers
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/dohxxuuysqukhwvkuajq/sql/new
-- SAFE TO RE-RUN (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- ============================================================
-- 1. Add vacation_days_per_year to persons
-- ============================================================
ALTER TABLE persons ADD COLUMN IF NOT EXISTS vacation_days_per_year NUMERIC DEFAULT 25;

-- ============================================================
-- 2. Add country_code to holidays table (currently org-wide, now also per-country)
-- ============================================================
ALTER TABLE holidays ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT NULL;

-- ============================================================
-- 3. Add approval workflow columns to absences
-- ============================================================
ALTER TABLE absences ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));
ALTER TABLE absences ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) DEFAULT NULL;
ALTER TABLE absences ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE absences ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES auth.users(id) DEFAULT NULL;

-- Update existing absences to 'approved' so they aren't stuck in pending
UPDATE absences SET status = 'approved' WHERE status = 'pending' OR status IS NULL;

-- ============================================================
-- 4. Absence Approvers table
-- Maps org → person(s) who can approve absence requests
-- ============================================================
CREATE TABLE IF NOT EXISTS absence_approvers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, person_id)
);

-- RLS for absence_approvers
ALTER TABLE absence_approvers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'absence_approvers'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON absence_approvers', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "aa_select_org" ON absence_approvers FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "aa_manage_admin" ON absence_approvers FOR ALL
  USING (org_id = get_user_org_id() AND get_user_role() = 'Admin');

-- ============================================================
-- 5. Verify
-- ============================================================
SELECT 'persons.vacation_days_per_year' as change, 
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='persons' AND column_name='vacation_days_per_year') as ok
UNION ALL
SELECT 'holidays.country_code',
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='holidays' AND column_name='country_code')
UNION ALL
SELECT 'absences.status',
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='absences' AND column_name='status')
UNION ALL
SELECT 'absences.approved_by',
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='absences' AND column_name='approved_by')
UNION ALL
SELECT 'absence_approvers table',
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='absence_approvers');
