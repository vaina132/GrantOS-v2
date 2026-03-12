-- Fix holidays table: allow multiple countries to have holidays on the same date
-- Currently UNIQUE(org_id, date) means only one holiday per date per org,
-- so importing Germany + Turkey overwrites overlapping dates.
-- New constraint: UNIQUE(org_id, date, country_code)
-- Run in Supabase SQL Editor. SAFE TO RE-RUN.

-- 1. Drop the old unique constraint
ALTER TABLE holidays DROP CONSTRAINT IF EXISTS holidays_org_id_date_key;

-- 2. Also drop any unique index with the old pattern (some setups use index instead of constraint)
DROP INDEX IF EXISTS holidays_org_id_date_key;

-- 3. Create a new unique index that includes country_code
-- Uses COALESCE so that NULL country_code is treated as '' for uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS holidays_org_country_date_unique
  ON holidays (org_id, date, COALESCE(country_code, ''));

-- 4. Delete any existing holidays that have NULL country_code
-- (these were imported before the country_code column was added and can't be filtered correctly)
-- The user should re-import holidays from Settings after running this migration.
DELETE FROM holidays WHERE country_code IS NULL;

-- Verification
SELECT 'holidays_per_country_fix' AS migration,
       COUNT(*) AS remaining_holidays
FROM holidays;
