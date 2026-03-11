-- Fix RLS policies for onboarding flow
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/dohxxuuysqukhwvkuajq/sql/new

-- Allow any authenticated user to create an organisation (onboarding)
DROP POLICY IF EXISTS "org_insert_authenticated" ON organisations;
CREATE POLICY "org_insert_authenticated"
  ON organisations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow any authenticated user to create their own membership (onboarding)
DROP POLICY IF EXISTS "orgmem_insert_self" ON org_members;
CREATE POLICY "orgmem_insert_self"
  ON org_members FOR INSERT
  WITH CHECK (user_id = auth.uid());
