-- ============================================================
-- TIMESHEET ENTRIES: migrate to hours-based model
-- ============================================================

-- Add new columns (safe to re-run: IF NOT EXISTS not available for columns, 
-- so we use DO blocks)
DO $$ BEGIN
  ALTER TABLE timesheet_entries ADD COLUMN planned_hours NUMERIC;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE timesheet_entries ADD COLUMN actual_hours NUMERIC;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE timesheet_entries ADD COLUMN working_days INT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE timesheet_entries ADD COLUMN submitted_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE timesheet_entries ADD COLUMN submitted_by UUID REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Update status CHECK constraint to support new workflow:
-- Draft -> Submitted -> Approved / Rejected
ALTER TABLE timesheet_entries DROP CONSTRAINT IF EXISTS timesheet_entries_status_check;
ALTER TABLE timesheet_entries ADD CONSTRAINT timesheet_entries_status_check
  CHECK (status IN ('Draft','Submitted','Confirmed','Approved','Rejected'));

-- Migrate existing data: convert planned_percentage back to hours
-- planned_percentage was pms * 100, so pms = planned_percentage / 100
-- hours = pms * working_days * 8 (8 hours per day, ~22 working days per month)
UPDATE timesheet_entries
SET planned_hours = COALESCE(planned_percentage, 0) / 100.0 * 22 * 8,
    actual_hours  = COALESCE(confirmed_percentage, 0) / 100.0 * 22 * 8,
    working_days  = 22
WHERE planned_hours IS NULL;

-- Update 'Confirmed' status entries to 'Submitted' (new workflow)
UPDATE timesheet_entries SET status = 'Submitted' WHERE status = 'Confirmed';
