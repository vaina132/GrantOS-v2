-- Add number, start_month, end_month to work_packages
ALTER TABLE work_packages
  ADD COLUMN IF NOT EXISTS number integer,
  ADD COLUMN IF NOT EXISTS start_month integer,
  ADD COLUMN IF NOT EXISTS end_month integer;
