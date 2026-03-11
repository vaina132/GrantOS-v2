-- Migration: Add user_preferences table for personal settings and email notification preferences
-- Each user has one row per organisation. Email preferences default to true (opted in).

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  display_name TEXT,
  -- Email notification preferences (all default to opted-in)
  email_timesheet_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  email_timesheet_submitted BOOLEAN NOT NULL DEFAULT TRUE,
  email_project_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  email_budget_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  email_period_locked BOOLEAN NOT NULL DEFAULT TRUE,
  email_role_changes BOOLEAN NOT NULL DEFAULT TRUE,
  email_invitations BOOLEAN NOT NULL DEFAULT TRUE,
  email_welcome BOOLEAN NOT NULL DEFAULT TRUE,
  email_trial_expiring BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_org ON user_preferences(org_id);

-- RLS policies
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own preferences" ON user_preferences;
CREATE POLICY "Users can read own preferences" ON user_preferences
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
CREATE POLICY "Users can insert own preferences" ON user_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR UPDATE USING (user_id = auth.uid());

-- Allow the service role (cron jobs, API routes) to read any user's preferences
-- This is handled automatically by the service_role key bypassing RLS
