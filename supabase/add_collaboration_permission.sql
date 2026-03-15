-- Add can_see_collaboration column to role_permissions table
ALTER TABLE role_permissions
  ADD COLUMN IF NOT EXISTS can_see_collaboration BOOLEAN NOT NULL DEFAULT true;
