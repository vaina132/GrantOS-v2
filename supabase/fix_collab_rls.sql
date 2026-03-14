-- ============================================================================
-- Fix RLS policy on collab_projects INSERT
-- ============================================================================
-- The INSERT policy uses a subquery on org_members, but org_members itself
-- has RLS enabled. The subquery runs as the current user, so it may be
-- blocked by org_members' own RLS. Fix: use a SECURITY DEFINER function.
-- ============================================================================

-- 1. Create a SECURITY DEFINER helper that checks membership
CREATE OR REPLACE FUNCTION is_org_member(p_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Replace the INSERT policy on collab_projects
DROP POLICY IF EXISTS collab_projects_host_insert ON collab_projects;
CREATE POLICY collab_projects_host_insert ON collab_projects
  FOR INSERT WITH CHECK (is_org_member(host_org_id));

-- 3. Add task_id to collab_deliverables (optional link to a specific task)
ALTER TABLE collab_deliverables
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES collab_tasks(id) ON DELETE SET NULL;
