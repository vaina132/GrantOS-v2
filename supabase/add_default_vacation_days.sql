-- Add default vacation days per year to organisations
-- This value is used as the default when creating new staff members.
-- Run this in your Supabase SQL Editor.

alter table organisations
  add column if not exists default_vacation_days integer not null default 25;
