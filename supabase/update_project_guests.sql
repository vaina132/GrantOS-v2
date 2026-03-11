-- ============================================================
-- UPDATE PROJECT_GUESTS FOR EMAIL-BASED INVITATIONS
-- ============================================================
-- This migration:
-- 1. Adds invited_email, invited_name, guest_org_name columns
-- 2. Makes user_id nullable (guests may not have an account yet)
-- 3. Adds status column for invitation tracking
-- 4. Updates constraints and indexes
-- 5. Updates RLS policies to support email-based lookups

-- 1. Add new columns
ALTER TABLE project_guests
  ADD COLUMN IF NOT EXISTS invited_email TEXT,
  ADD COLUMN IF NOT EXISTS invited_name TEXT,
  ADD COLUMN IF NOT EXISTS guest_org_name TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked'));

-- 2. Make user_id nullable (guest may not have signed up yet)
ALTER TABLE project_guests ALTER COLUMN user_id DROP NOT NULL;

-- 3. Drop the old unique constraint and add a new one based on email + project
-- (safely handle if constraint doesn't exist)
DO $$
BEGIN
  ALTER TABLE project_guests DROP CONSTRAINT IF EXISTS project_guests_project_id_user_id_key;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Add unique constraint on project + email (one invitation per project per email)
ALTER TABLE project_guests
  ADD CONSTRAINT project_guests_project_email_unique UNIQUE (project_id, invited_email);

-- 4. Add index for email-based lookups (used when guest logs in to claim invitations)
CREATE INDEX IF NOT EXISTS idx_project_guests_email
  ON project_guests(invited_email);

-- 5. Update existing rows: set status = 'accepted' for any rows that already have a user_id
UPDATE project_guests
  SET status = 'accepted'
  WHERE user_id IS NOT NULL AND status = 'pending';

-- 6. Create a SECURITY DEFINER function to claim pending invitations by email.
-- This bypasses RLS so that a newly signed-up guest (who has no user_id in
-- project_guests yet) can still claim their invitation.
CREATE OR REPLACE FUNCTION claim_guest_invitations(p_user_id UUID, p_email TEXT)
RETURNS TABLE (
  id UUID,
  org_id UUID,
  project_id UUID,
  access_level TEXT,
  status TEXT
) AS $$
BEGIN
  -- First, claim any pending invitations for this email
  UPDATE project_guests pg
    SET user_id = p_user_id, status = 'accepted'
    WHERE pg.invited_email = p_email
      AND pg.user_id IS NULL
      AND pg.status = 'pending'
      AND pg.is_active = TRUE;

  -- Then return all active guest entries for this user
  RETURN QUERY
    SELECT pg.id, pg.org_id, pg.project_id, pg.access_level, pg.status
    FROM project_guests pg
    WHERE (pg.user_id = p_user_id OR pg.invited_email = p_email)
      AND pg.is_active = TRUE
      AND pg.status = 'accepted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Update RLS policies to support the new flow
-- NOTE: Email-based invitation matching is handled at the application level
-- (authStore.ts) because the authenticated role cannot SELECT from auth.users
-- in RLS policy subqueries. Once a guest logs in, authStore claims the
-- invitation by setting user_id, after which the user_id-based policies work.

-- Guest self-select (by user_id only — email matching done in app)
DROP POLICY IF EXISTS "guests_select_own" ON project_guests;
CREATE POLICY "guests_select_own"
  ON project_guests FOR SELECT
  USING (user_id = auth.uid());

-- Org members can see all guests in their org
DROP POLICY IF EXISTS "guests_select_org" ON project_guests;
CREATE POLICY "guests_select_org"
  ON project_guests FOR SELECT
  USING (org_id = auth_org_id());

-- Admins can manage all guests in their org
DROP POLICY IF EXISTS "guests_all_admin" ON project_guests;
CREATE POLICY "guests_all_admin"
  ON project_guests FOR ALL
  USING (org_id = auth_org_id() AND auth_role() = 'Admin');

-- Project managers can manage guests for projects in their org
DROP POLICY IF EXISTS "guests_manage_pm" ON project_guests;
CREATE POLICY "guests_manage_pm"
  ON project_guests FOR ALL
  USING (org_id = auth_org_id() AND auth_role() = 'Project Manager');

-- Guest project visibility (by user_id only)
DROP POLICY IF EXISTS "Guests can view assigned projects" ON projects;
DROP POLICY IF EXISTS "projects_select_guests" ON projects;
CREATE POLICY "projects_select_guests"
  ON projects FOR SELECT
  USING (
    id IN (
      SELECT project_id FROM project_guests
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );
