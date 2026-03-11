-- Fix RLS policies for onboarding flow
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/dohxxuuysqukhwvkuajq/sql/new

-- Step 1: Ensure RLS is enabled
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop and recreate organisation policies
DROP POLICY IF EXISTS "org_insert_authenticated" ON organisations;
DROP POLICY IF EXISTS "org_select_members" ON organisations;
DROP POLICY IF EXISTS "org_update_admin" ON organisations;

CREATE POLICY "org_select_members"
  ON organisations FOR SELECT
  USING (id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "org_update_admin"
  ON organisations FOR UPDATE
  USING (id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role = 'Admin'));

CREATE POLICY "org_insert_authenticated"
  ON organisations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Step 3: Drop and recreate org_members policies
DROP POLICY IF EXISTS "orgmem_select_own" ON org_members;
DROP POLICY IF EXISTS "orgmem_select_org" ON org_members;
DROP POLICY IF EXISTS "orgmem_all_admin" ON org_members;
DROP POLICY IF EXISTS "orgmem_insert_self" ON org_members;

CREATE POLICY "orgmem_select_own"
  ON org_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "orgmem_select_org"
  ON org_members FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "orgmem_all_admin"
  ON org_members FOR ALL
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role = 'Admin'));

CREATE POLICY "orgmem_insert_self"
  ON org_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Step 4: Verify policies were created
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('organisations', 'org_members')
ORDER BY tablename, policyname;
