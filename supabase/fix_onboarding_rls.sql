-- Fix RLS policies for onboarding flow (org + org_members creation)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/dohxxuuysqukhwvkuajq/sql/new
-- SAFE TO RE-RUN: drops all existing policies on these two tables first.

-- ============================================================
-- Step 1: Enable RLS
-- ============================================================
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Step 2: Drop ALL existing policies on organisations
-- ============================================================
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organisations'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON organisations', r.policyname);
  END LOOP;
END $$;

-- ============================================================
-- Step 3: Drop ALL existing policies on org_members
-- ============================================================
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'org_members'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON org_members', r.policyname);
  END LOOP;
END $$;

-- ============================================================
-- Step 4: Create organisations policies
-- NOTE: We do NOT use auth_org_id() because during onboarding
-- the user has no org_members row yet, so auth_org_id() = NULL.
-- ============================================================

-- Any authenticated user can INSERT a new org (onboarding)
CREATE POLICY "org_insert_authenticated"
  ON organisations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Members can SELECT their own org
CREATE POLICY "org_select_members"
  ON organisations FOR SELECT
  USING (id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

-- Admins can UPDATE their own org
CREATE POLICY "org_update_admin"
  ON organisations FOR UPDATE
  USING (id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role = 'Admin'));

-- ============================================================
-- Step 5: Create org_members policies
-- ============================================================

-- Users can see their own membership (auth bootstrap)
CREATE POLICY "orgmem_select_own"
  ON org_members FOR SELECT
  USING (user_id = auth.uid());

-- Members can see all members in their org
CREATE POLICY "orgmem_select_org"
  ON org_members FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

-- Any authenticated user can INSERT themselves (onboarding)
CREATE POLICY "orgmem_insert_self"
  ON org_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can do everything on org_members in their org
CREATE POLICY "orgmem_all_admin"
  ON org_members FOR ALL
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role = 'Admin'));

-- ============================================================
-- Step 6: Verify
-- ============================================================
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('organisations', 'org_members')
ORDER BY tablename, policyname;
