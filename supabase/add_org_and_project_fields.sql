-- Add timesheets_drive_allocations to organisations
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS timesheets_drive_allocations boolean NOT NULL DEFAULT false;

-- Add is_lead_organisation to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_lead_organisation boolean NOT NULL DEFAULT false;
