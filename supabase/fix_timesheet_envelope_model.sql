-- ============================================================
-- FIX: Timesheet envelope model — make project_id nullable
-- ============================================================
-- The new timesheet model uses timesheet_entries as a per-person-per-month
-- envelope (no project). Daily hours per project are stored in timesheet_days.
-- The old schema had project_id NOT NULL which breaks the new insert.

-- 1. Make project_id nullable (was NOT NULL in original schema)
ALTER TABLE timesheet_entries ALTER COLUMN project_id DROP NOT NULL;

-- 2. Update status CHECK to include all new workflow statuses
ALTER TABLE timesheet_entries DROP CONSTRAINT IF EXISTS timesheet_entries_status_check;
ALTER TABLE timesheet_entries ADD CONSTRAINT timesheet_entries_status_check
  CHECK (status IN ('Draft','Submitted','Signing','Signed','Approved','Rejected','Confirmed'));

-- 3. Add unique constraint for envelope model (one envelope per person per month per org)
-- Use a partial index for rows without project_id (envelope rows)
CREATE UNIQUE INDEX IF NOT EXISTS idx_timesheet_entries_envelope_unique
  ON timesheet_entries (org_id, person_id, year, month)
  WHERE project_id IS NULL;
