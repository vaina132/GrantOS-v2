-- Migration: Add unsubscribe_token to user_preferences
-- This token allows users to manage email preferences from a link in emails
-- without needing to log in.

-- Add the column (nullable — backfill generates tokens for existing rows)
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS unsubscribe_token UUID DEFAULT uuid_generate_v4();

-- Add columns that were added after the initial migration (idempotent)
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS email_substitute_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_absence_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_collab_notifications BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill tokens for any existing rows that are NULL
UPDATE user_preferences
  SET unsubscribe_token = uuid_generate_v4()
  WHERE unsubscribe_token IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE user_preferences
  ALTER COLUMN unsubscribe_token SET NOT NULL;

-- Add unique index for fast token lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_preferences_unsub_token
  ON user_preferences(unsubscribe_token);

-- Default for new rows
ALTER TABLE user_preferences
  ALTER COLUMN unsubscribe_token SET DEFAULT uuid_generate_v4();
