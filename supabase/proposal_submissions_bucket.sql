-- ============================================================================
-- Storage bucket for partner file uploads (proposals workflow).
-- Private bucket, 10 MB per-file limit, PDF / Office / image MIMEs only.
-- Path scheme: {org_id}/{proposal_id}/{partner_id}/{document_type}/{timestamp}_{safename}
-- ============================================================================

BEGIN;

-- Create the bucket (idempotent).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proposal-submissions',
  'proposal-submissions',
  FALSE,
  10485760,  -- 10 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: access is gated through the proposal + proposal_partners
-- relationships. Path scheme puts org_id as the first segment and
-- proposal_id as the second, so we can join back via path_tokens.
--   path_tokens[1] = org_id
--   path_tokens[2] = proposal_id
--   path_tokens[3] = partner_id

-- Coordinators (org members of the proposal's org) can do everything.
DROP POLICY IF EXISTS "Coordinators manage proposal files" ON storage.objects;
CREATE POLICY "Coordinators manage proposal files"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'proposal-submissions'
    AND EXISTS (
      SELECT 1 FROM proposals p
      JOIN org_members om ON om.org_id = p.org_id
      WHERE p.id::text = (storage.foldername(name))[2]
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'proposal-submissions'
    AND EXISTS (
      SELECT 1 FROM proposals p
      JOIN org_members om ON om.org_id = p.org_id
      WHERE p.id::text = (storage.foldername(name))[2]
        AND om.user_id = auth.uid()
    )
  );

-- External partners can read / write only within their own partner folder.
-- Partner id is segment 3 of the path.
DROP POLICY IF EXISTS "Partners manage own proposal files" ON storage.objects;
CREATE POLICY "Partners manage own proposal files"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'proposal-submissions'
    AND EXISTS (
      SELECT 1 FROM proposal_partners pp
      WHERE pp.id::text = (storage.foldername(name))[3]
        AND pp.user_id = auth.uid()
        AND pp.invite_status = 'accepted'
    )
  )
  WITH CHECK (
    bucket_id = 'proposal-submissions'
    AND EXISTS (
      SELECT 1 FROM proposal_partners pp
      WHERE pp.id::text = (storage.foldername(name))[3]
        AND pp.user_id = auth.uid()
        AND pp.invite_status = 'accepted'
    )
  );

COMMIT;
