-- Link persons ↔ auth.users: Staff invitation flow
-- Run in Supabase SQL Editor
-- SAFE TO RE-RUN (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- ============================================================
-- 1. Add user_id to persons (nullable FK to auth.users)
--    When a person has a linked account, this is set.
-- ============================================================
ALTER TABLE persons ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT NULL;

-- ============================================================
-- 2. Invitation tracking columns
--    invite_status: null (not invited), 'pending', 'accepted'
--    invite_role: the OrgRole they'll get when they accept
-- ============================================================
ALTER TABLE persons ADD COLUMN IF NOT EXISTS invite_status TEXT DEFAULT NULL
  CHECK (invite_status IS NULL OR invite_status IN ('pending', 'accepted'));
ALTER TABLE persons ADD COLUMN IF NOT EXISTS invite_role TEXT DEFAULT NULL;

-- ============================================================
-- 3. Index for quick lookup by user_id and email
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_persons_user_id ON persons(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_persons_email ON persons(email) WHERE email IS NOT NULL;

-- ============================================================
-- 4. RPC: link_person_on_login
--    Called during login to auto-link a person record to the
--    authenticated user by matching email + org_id.
--    Also claims any pending invitation (sets invite_status='accepted').
-- ============================================================
CREATE OR REPLACE FUNCTION link_person_on_login(p_user_id UUID, p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Link any unlinked person records that match this email
  UPDATE persons
  SET user_id = p_user_id,
      invite_status = CASE 
        WHEN invite_status = 'pending' THEN 'accepted'
        ELSE invite_status
      END,
      updated_at = now()
  WHERE email = lower(p_email)
    AND user_id IS NULL;
END;
$$;

-- ============================================================
-- 5. Verify
-- ============================================================
SELECT 'persons.user_id' as change,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='persons' AND column_name='user_id') as ok
UNION ALL
SELECT 'persons.invite_status',
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='persons' AND column_name='invite_status')
UNION ALL
SELECT 'persons.invite_role',
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='persons' AND column_name='invite_role')
UNION ALL
SELECT 'link_person_on_login function',
  EXISTS(SELECT 1 FROM pg_proc WHERE proname='link_person_on_login');
