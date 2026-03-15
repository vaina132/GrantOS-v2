-- Add missing email preference columns for absence and collaboration notifications
-- Run this in the Supabase SQL Editor

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS email_absence_notifications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_collab_notifications boolean NOT NULL DEFAULT true;
