-- Add per-project reminder settings to collab_projects
-- Run this in the Supabase SQL Editor

-- Reminder configuration stored as JSONB for flexibility
-- Format: { "deliverables": { "enabled": true, "lead_time": 14, "unit": "days" },
--           "milestones":   { "enabled": true, "lead_time": 2, "unit": "weeks" },
--           "reports":      { "enabled": true, "lead_time": 7, "unit": "days" } }
ALTER TABLE collab_projects
  ADD COLUMN IF NOT EXISTS reminder_settings jsonb NOT NULL DEFAULT '{
    "deliverables": { "enabled": true, "lead_time": 14, "unit": "days" },
    "milestones":   { "enabled": true, "lead_time": 14, "unit": "days" },
    "reports":      { "enabled": true, "lead_time": 7, "unit": "days" }
  }'::jsonb;
