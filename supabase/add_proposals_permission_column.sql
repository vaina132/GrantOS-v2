-- Migration: Add can_see_proposals column to role_permissions table
ALTER TABLE role_permissions
  ADD COLUMN IF NOT EXISTS can_see_proposals BOOLEAN NOT NULL DEFAULT TRUE;
