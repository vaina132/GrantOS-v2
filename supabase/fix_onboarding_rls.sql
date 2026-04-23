-- Fix onboarding: create org + membership via SECURITY DEFINER function
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/dohxxuuysqukhwvkuajq/sql/new
-- SAFE TO RE-RUN.
--
-- APPROACH: Instead of fighting RLS INSERT policies, use a SECURITY DEFINER
-- function that bypasses RLS entirely. The frontend calls this function via
-- supabase.rpc('create_organisation', { ... }) instead of direct table inserts.

-- ============================================================
-- Step 1: Helper functions for RLS policies (bypass RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.org_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Step 2: Onboarding function — creates org + membership atomically
-- Sets plan='trial' and trial_ends_at = now()+30 days so the trial
-- countdown works from the moment the org is provisioned. The RPC
-- advertises plan + trial_ends_at as its default values to keep the
-- client free of that business rule.
-- ============================================================
CREATE OR REPLACE FUNCTION create_organisation(
  p_name TEXT,
  p_currency TEXT DEFAULT 'EUR'
)
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check user doesn't already have an org
  IF EXISTS (SELECT 1 FROM public.org_members WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'User already belongs to an organisation';
  END IF;

  -- Create the organisation with an active 30-day trial.
  INSERT INTO public.organisations (name, currency, plan, trial_ends_at)
  VALUES (p_name, p_currency, 'trial', NOW() + INTERVAL '30 days')
  RETURNING id INTO v_org_id;

  -- Create the membership as Admin
  INSERT INTO public.org_members (user_id, org_id, role)
  VALUES (v_user_id, v_org_id, 'Admin');

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill: any orgs currently missing trial_ends_at / plan get a trial
-- starting from their creation date. Safe to re-run — only touches rows
-- where both are missing, so paid / post-trial orgs are never reset.
UPDATE public.organisations
   SET plan          = COALESCE(plan, 'trial'),
       trial_ends_at = COALESCE(trial_ends_at, created_at + INTERVAL '30 days')
 WHERE trial_ends_at IS NULL
   AND (plan IS NULL OR plan = 'trial');

-- ============================================================
-- Step 3: Enable RLS
-- ============================================================
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Step 4: Drop ALL existing policies on organisations
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
-- Step 5: Drop ALL existing policies on org_members
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
-- Step 6: Organisations policies (SELECT + UPDATE only, INSERT via function)
-- ============================================================
CREATE POLICY "org_select_members"
  ON organisations FOR SELECT
  USING (id = get_user_org_id());

CREATE POLICY "org_update_admin"
  ON organisations FOR UPDATE
  USING (id = get_user_org_id() AND get_user_role() = 'Admin');

-- ============================================================
-- Step 7: Org members policies
-- ============================================================
CREATE POLICY "orgmem_select_own"
  ON org_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "orgmem_select_org"
  ON org_members FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "orgmem_insert_self"
  ON org_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "orgmem_all_admin"
  ON org_members FOR ALL
  USING (org_id = get_user_org_id() AND get_user_role() = 'Admin');

-- ============================================================
-- Step 8: Verify
-- ============================================================
SELECT 'FUNCTION' as type, 'create_organisation' as name, '' as cmd
UNION ALL
SELECT 'POLICY', policyname, cmd::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('organisations', 'org_members')
ORDER BY type, name;
