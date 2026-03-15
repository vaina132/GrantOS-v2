-- ============================================================
-- Add DocuSign integration settings to organisations
-- ============================================================
-- Stores per-org DocuSign credentials so each org can configure
-- their own DocuSign account for timesheet signing.

DO $$ BEGIN
  ALTER TABLE organisations ADD COLUMN docusign_integration_key TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE organisations ADD COLUMN docusign_user_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE organisations ADD COLUMN docusign_account_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE organisations ADD COLUMN docusign_rsa_private_key TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE organisations ADD COLUMN docusign_base_url TEXT DEFAULT 'https://demo.docusign.net/restapi';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE organisations ADD COLUMN docusign_oauth_base_url TEXT DEFAULT 'https://account-d.docusign.com';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
