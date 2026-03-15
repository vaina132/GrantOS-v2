-- Add region column to persons table
-- This stores the ISO 3166-2 subdivision code (e.g. 'DE-BY' for Bavaria)
-- Used to match regional public holidays to individual staff members
-- Run this in the Supabase SQL Editor

ALTER TABLE persons
  ADD COLUMN IF NOT EXISTS region TEXT;
