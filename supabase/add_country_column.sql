-- Add country column to persons table
-- Run this in Supabase SQL Editor

ALTER TABLE persons ADD COLUMN IF NOT EXISTS country TEXT;
