-- GrantOS v2 Seed Script
-- Run this AFTER schema.sql has been executed successfully.
-- This creates a test organisation and links your test user as Admin.

-- Step 1: Create the organisation
INSERT INTO organisations (id, name, plan, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'My Research Lab',
  'enterprise',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Link your test user as Admin
-- This looks up the user by email from Supabase auth.users
INSERT INTO org_members (user_id, org_id, role)
SELECT
  id,
  '00000000-0000-0000-0000-000000000001',
  'Admin'
FROM auth.users
WHERE email = 'anilturkmayali@gmail.com'
ON CONFLICT (user_id, org_id) DO NOTHING;
