-- Fix duplicate assignment rows caused by NULL work_package_id
-- Run this in Supabase SQL Editor (run the whole thing at once)

-- 1) Delete ALL duplicates, keeping only the single row with the highest pms
--    (most recent meaningful value). Uses a CTE with ROW_NUMBER.
DELETE FROM assignments
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY person_id, project_id,
          COALESCE(work_package_id, '00000000-0000-0000-0000-000000000000'),
          year, month, type
        ORDER BY updated_at DESC, created_at DESC, id
      ) AS rn
    FROM assignments
  ) ranked
  WHERE rn > 1
);

-- 2) Drop the old constraint (it doesn't handle NULLs correctly)
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_person_id_project_id_work_package_id_year_month_type_key;

-- 3) Create a unique index that treats NULL work_package_id correctly
CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_unique_combo
  ON assignments (
    person_id,
    project_id,
    COALESCE(work_package_id, '00000000-0000-0000-0000-000000000000'),
    year,
    month,
    type
  );
