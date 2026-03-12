-- Add country column to organisations
-- Run in Supabase SQL Editor
-- SAFE TO RE-RUN (uses IF NOT EXISTS).

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS country TEXT DEFAULT NULL;
