-- Add substitute_person_id column to absences table
-- This allows a staff member to nominate a colleague as their substitute when requesting leave.

ALTER TABLE absences
  ADD COLUMN IF NOT EXISTS substitute_person_id UUID REFERENCES persons(id) ON DELETE SET NULL;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_absences_substitute_person_id ON absences(substitute_person_id);

-- Add email_substitute_notifications column to user_preferences table
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS email_substitute_notifications BOOLEAN NOT NULL DEFAULT true;

-- Add private_absence_types to organisations table (default: Sick Leave is private)
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS private_absence_types TEXT[] NOT NULL DEFAULT ARRAY['Sick Leave'];
