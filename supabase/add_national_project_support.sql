-- National project support: funding schemes with time-range entry mode
-- Run this in your Supabase SQL Editor

-- 1. Add requires_time_range flag to funding_schemes
-- When true, projects using this scheme will require start_time + end_time + activity description
-- instead of simple hour entry in the timesheet grid.
alter table funding_schemes
  add column if not exists requires_time_range boolean not null default false;

-- 2. Add start_time, end_time, and description columns to timesheet_days
-- These are only used when the project's funding scheme has requires_time_range = true.
alter table timesheet_days
  add column if not exists start_time text,       -- format 'HH:MM' e.g. '08:30'
  add column if not exists end_time text,         -- format 'HH:MM' e.g. '16:30'
  add column if not exists description text;      -- daily activity description (Tätigkeitsbeschreibung)
