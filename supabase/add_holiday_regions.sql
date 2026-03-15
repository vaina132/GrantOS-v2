-- Add region_code column to holidays table for sub-national/regional holidays
-- e.g. DE-BY (Bavaria), ES-CT (Catalonia), CH-ZH (Zürich)
-- Run in Supabase SQL Editor. SAFE TO RE-RUN.

-- 1. Add region_code column (nullable — NULL means nationwide)
ALTER TABLE holidays ADD COLUMN IF NOT EXISTS region_code TEXT DEFAULT NULL;

-- 2. Drop the old unique index
DROP INDEX IF EXISTS holidays_org_country_date_unique;

-- 3. Create a new unique index that includes region_code
-- Uses COALESCE so that NULL values are treated as '' for uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS holidays_org_country_region_date_unique
  ON holidays (org_id, date, COALESCE(country_code, ''), COALESCE(region_code, ''));

-- Verification
SELECT 'add_holiday_regions' AS migration,
       COUNT(*) AS total_holidays
FROM holidays;
