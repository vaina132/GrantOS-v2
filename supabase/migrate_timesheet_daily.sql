-- ============================================================
-- TIMESHEET REDESIGN: Daily granularity model
-- ============================================================
-- Run this in Supabase SQL Editor after the previous migration.

-- 1. Create timesheet_days table (daily hour entries)
CREATE TABLE IF NOT EXISTS timesheet_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_package_id UUID REFERENCES work_packages(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  hours NUMERIC NOT NULL DEFAULT 0 CHECK (hours >= 0 AND hours <= 24),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, person_id, project_id, work_package_id, date)
);

-- Handle the UNIQUE constraint for NULL work_package_id 
-- (Postgres treats NULLs as distinct in UNIQUE, so we need a partial unique index)
DROP INDEX IF EXISTS idx_timesheet_days_unique_no_wp;
CREATE UNIQUE INDEX idx_timesheet_days_unique_no_wp 
  ON timesheet_days (org_id, person_id, project_id, date) 
  WHERE work_package_id IS NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_timesheet_days_person_date ON timesheet_days (person_id, date);
CREATE INDEX IF NOT EXISTS idx_timesheet_days_org_date ON timesheet_days (org_id, date);
CREATE INDEX IF NOT EXISTS idx_timesheet_days_project ON timesheet_days (project_id, date);

-- 2. Create holidays table (org-level national/public holidays)
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, date)
);

CREATE INDEX IF NOT EXISTS idx_holidays_org_date ON holidays (org_id, date);

-- 3. Add person_id-only timesheet_entries for monthly envelope
-- The existing timesheet_entries table already has person_id, year, month, status etc.
-- We need to ensure it can work as a per-person-per-month envelope.
-- Add total_hours column to store computed total.
DO $$ BEGIN
  ALTER TABLE timesheet_entries ADD COLUMN total_hours NUMERIC DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 4. Enable RLS on new tables
ALTER TABLE timesheet_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

-- RLS policies for timesheet_days (same pattern as other org tables)
DO $$ BEGIN
  CREATE POLICY "timesheet_days_org_access" ON timesheet_days
    FOR ALL USING (
      org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS policies for holidays
DO $$ BEGIN
  CREATE POLICY "holidays_org_access" ON holidays
    FOR ALL USING (
      org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Migrate existing timesheet data into timesheet_days (best-effort)
-- Old data had one row per person×project×month with actual_hours as a total.
-- We'll create a single entry on the 1st working day of that month as a placeholder.
-- This preserves the historical totals while the new system takes over.
INSERT INTO timesheet_days (org_id, person_id, project_id, work_package_id, date, hours)
SELECT 
  te.org_id,
  te.person_id,
  te.project_id,
  te.work_package_id,
  -- Use first day of the month as placeholder date
  make_date(te.year, te.month, 1),
  COALESCE(te.actual_hours, 0)
FROM timesheet_entries te
WHERE te.actual_hours IS NOT NULL AND te.actual_hours > 0
ON CONFLICT DO NOTHING;
