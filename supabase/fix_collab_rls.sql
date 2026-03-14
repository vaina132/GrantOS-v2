-- ============================================================================
-- Fix RLS policy on collab_projects INSERT
-- ============================================================================
-- The INSERT policy uses a raw subquery on org_members, but org_members has
-- its own RLS. Fix: use get_user_org_id() which is SECURITY DEFINER and
-- already works for every other table in the app.
-- ============================================================================

-- 1. Replace the INSERT policy to use get_user_org_id()
DROP POLICY IF EXISTS collab_projects_host_insert ON collab_projects;
CREATE POLICY collab_projects_host_insert ON collab_projects
  FOR INSERT WITH CHECK (host_org_id = get_user_org_id());

-- 2. Also fix SELECT/UPDATE/DELETE policies that use is_collab_host_member()
--    which internally joins org_members (subject to the same RLS issue)
DROP POLICY IF EXISTS collab_projects_host_select ON collab_projects;
CREATE POLICY collab_projects_host_select ON collab_projects
  FOR SELECT USING (host_org_id = get_user_org_id());

DROP POLICY IF EXISTS collab_projects_host_update ON collab_projects;
CREATE POLICY collab_projects_host_update ON collab_projects
  FOR UPDATE USING (host_org_id = get_user_org_id());

DROP POLICY IF EXISTS collab_projects_host_delete ON collab_projects;
CREATE POLICY collab_projects_host_delete ON collab_projects
  FOR DELETE USING (host_org_id = get_user_org_id());

-- 3. Keep partner SELECT policy (uses is_collab_partner which is SECURITY DEFINER)
-- No change needed there.

-- 4. Add task_id to collab_deliverables (optional link to a specific task)
ALTER TABLE collab_deliverables
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES collab_tasks(id) ON DELETE SET NULL;
