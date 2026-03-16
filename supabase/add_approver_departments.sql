-- Add department scoping to approver tables
-- NULL = org-wide approver, non-null = approves only staff in that department

-- Absence approvers: add department column
ALTER TABLE absence_approvers ADD COLUMN IF NOT EXISTS department TEXT DEFAULT NULL;

-- Drop old unique constraint and add new one that includes department
ALTER TABLE absence_approvers DROP CONSTRAINT IF EXISTS absence_approvers_org_id_person_id_key;
ALTER TABLE absence_approvers ADD CONSTRAINT absence_approvers_org_person_dept_key UNIQUE (org_id, person_id, department);

-- Timesheet approvers: if table already exists without department column, add it
-- (New installs get it from add_timesheet_approvers.sql; this handles upgrades)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'timesheet_approvers'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'timesheet_approvers' AND column_name = 'department'
    ) THEN
      ALTER TABLE timesheet_approvers ADD COLUMN department TEXT DEFAULT NULL;
      -- Update unique constraint
      ALTER TABLE timesheet_approvers DROP CONSTRAINT IF EXISTS timesheet_approvers_org_id_person_id_key;
      ALTER TABLE timesheet_approvers ADD CONSTRAINT timesheet_approvers_org_person_dept_key UNIQUE (org_id, person_id, department);
    END IF;
  END IF;
END $$;
