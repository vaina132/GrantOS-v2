-- ============================================================================
-- Proposals workflow redesign — April 2026
-- ============================================================================
-- Replaces the phase/task tracker with a consortium-document workflow:
--   * Coordinator invites external partners (reuses invite-token model)
--   * Per-proposal required-document checklist (configurable from templates)
--   * Per-partner structured submissions: Part A, Budget, uploads
--   * Versioned file uploads kept in proposal-submissions storage bucket
--   * Atomic convert-to-project via RPC (Model D: coordinator-only post-convert)
--
-- Changes applied in this migration:
--   * DROP proposal_phases, proposal_tasks (+ triggers + policies)
--   * ALTER proposals: call_template_id, converted_at
--   * NEW  proposal_call_templates (presets seeded: Horizon Europe, Generic)
--   * NEW  proposal_partners
--   * NEW  proposal_work_packages
--   * NEW  proposal_documents (per-proposal checklist)
--   * NEW  proposal_submissions (state machine per partner × document)
--   * NEW  proposal_submission_versions (immutable upload history)
--   * NEW  proposal_part_a (structured Part A form data)
--   * NEW  proposal_budgets (partner × WP × PM commitment)
--   * NEW  proposal_audit_events (status change log)
--   * NEW  rpc_convert_proposal_to_project(uuid) — atomic conversion
--   * NEW  trg_proposals_lock_on_convert — blocks writes once converted
--
-- Safe to re-run: every DDL uses IF EXISTS / IF NOT EXISTS, every policy is
-- preceded by DROP POLICY IF EXISTS. Wrapped in a transaction.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP A. Tear out the old phase/task tracker.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_proposal_phases_updated ON proposal_phases;
DROP TRIGGER IF EXISTS trg_proposal_tasks_updated  ON proposal_tasks;
DROP FUNCTION IF EXISTS touch_proposal_phase_tables() CASCADE;

DROP TABLE IF EXISTS proposal_tasks  CASCADE;
DROP TABLE IF EXISTS proposal_phases CASCADE;

-- ============================================================================
-- STEP B. Extend the `proposals` table.
-- ============================================================================

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS call_template_id UUID,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

-- ============================================================================
-- STEP C. proposal_call_templates — per-funding-scheme required-doc presets.
-- ============================================================================
-- Seeded by the service layer on first use. `org_id IS NULL` = global preset.
-- Per-org rows let Admin users customise a preset; not exposed in v1 UI.

CREATE TABLE IF NOT EXISTS proposal_call_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organisations(id) ON DELETE CASCADE,  -- NULL = global
  name TEXT NOT NULL,
  description TEXT,
  -- Array of document-type specs:
  --   { type, label, handler: 'form'|'upload'|'upload_with_template',
  --     required: bool, template_url: string|null, description: string|null }
  default_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_call_templates_org ON proposal_call_templates(org_id);

-- Wire the FK now that the table exists (avoid ordering issues on fresh DBs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposals_call_template_id_fkey'
  ) THEN
    ALTER TABLE proposals
      ADD CONSTRAINT proposals_call_template_id_fkey
      FOREIGN KEY (call_template_id) REFERENCES proposal_call_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP D. proposal_partners — external orgs invited to contribute.
-- ============================================================================
-- Mirrors the project_partners shape but scoped to proposals. Same invite
-- token mechanism; the api/members.ts endpoints will be updated to lookup
-- BOTH tables by token.

CREATE TABLE IF NOT EXISTS proposal_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  org_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'partner'
    CHECK (role IN ('host', 'coordinator', 'partner')),
  participant_number INTEGER,
  contact_name TEXT,
  contact_email TEXT,
  country TEXT,
  org_type TEXT,  -- Academic / Industrial / RTO / Public / SME / Other
  pic TEXT,       -- PIC (Participant Identification Code)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_org_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  invite_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (invite_status IN ('pending','accepted','declined')),
  invite_token UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_partners_proposal ON proposal_partners(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_partners_user     ON proposal_partners(user_id);
CREATE INDEX IF NOT EXISTS idx_proposal_partners_token    ON proposal_partners(invite_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_partners_one_host
  ON proposal_partners(proposal_id) WHERE is_host = TRUE;

-- Auto-create the host partner when a proposal is inserted (same invariant
-- as projects — every proposal has exactly one host partner).
CREATE OR REPLACE FUNCTION ensure_proposal_host_partner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  host_org_name TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM proposal_partners
    WHERE proposal_id = NEW.id AND is_host = TRUE
  ) THEN
    RETURN NEW;
  END IF;

  SELECT name INTO host_org_name FROM organisations WHERE id = NEW.org_id;

  INSERT INTO proposal_partners (
    proposal_id, org_name, role, is_host, linked_org_id,
    invite_status, participant_number
  ) VALUES (
    NEW.id,
    COALESCE(host_org_name, 'Host organisation'),
    'host',
    TRUE,
    NEW.org_id,
    'accepted',
    1
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proposals_host_partner ON proposals;
CREATE TRIGGER trg_proposals_host_partner
  AFTER INSERT ON proposals
  FOR EACH ROW EXECUTE FUNCTION ensure_proposal_host_partner();

-- ============================================================================
-- STEP E. proposal_work_packages — minimal WP skeleton (number + title).
-- ============================================================================

CREATE TABLE IF NOT EXISTS proposal_work_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  wp_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  leader_partner_id UUID REFERENCES proposal_partners(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_wp_proposal ON proposal_work_packages(proposal_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_wp_unique
  ON proposal_work_packages(proposal_id, wp_number);

-- ============================================================================
-- STEP F. proposal_documents — per-proposal checklist of required docs.
-- ============================================================================
-- Seeded from the selected call template on proposal creation; editable
-- thereafter via coordinator UI.

CREATE TABLE IF NOT EXISTS proposal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,   -- 'part_a' | 'budget' | 'ownership_control' | 'cv' | …
  label TEXT NOT NULL,
  description TEXT,
  handler TEXT NOT NULL CHECK (handler IN ('form','upload','upload_with_template')),
  -- If handler = 'upload_with_template', template_url is the EC Portal link.
  template_url TEXT,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_documents_proposal ON proposal_documents(proposal_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_documents_unique
  ON proposal_documents(proposal_id, document_type);

-- ============================================================================
-- STEP G. proposal_submissions — state per (partner × document).
-- ============================================================================
-- Created on-demand when a partner starts a submission OR the coordinator
-- requests one. Holds current status + pointer to latest upload (if upload
-- handler) + link to Part A / Budget rows (if form handler).

CREATE TABLE IF NOT EXISTS proposal_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES proposal_partners(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES proposal_documents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','in_progress','submitted','approved','needs_revision')),
  -- Form-handler submissions point at structured rows; upload handlers at versions.
  part_a_id UUID,      -- FK filled once proposal_part_a created
  budget_id UUID,      -- FK filled once proposal_budgets rows exist
  current_version_id UUID,  -- FK → proposal_submission_versions
  -- Review metadata
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,    -- coordinator's feedback or approval comment
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_submissions_proposal ON proposal_submissions(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_submissions_partner  ON proposal_submissions(partner_id);
CREATE INDEX IF NOT EXISTS idx_proposal_submissions_document ON proposal_submissions(document_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_submissions_unique
  ON proposal_submissions(proposal_id, partner_id, document_id);

-- ============================================================================
-- STEP H. proposal_submission_versions — immutable upload history.
-- ============================================================================

CREATE TABLE IF NOT EXISTS proposal_submission_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES proposal_submissions(id) ON DELETE CASCADE,
  storage_bucket TEXT NOT NULL DEFAULT 'proposal-submissions',
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,           -- sanitised
  original_file_name TEXT NOT NULL,  -- as uploaded
  mime_type TEXT,
  file_size_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT  -- e.g. "resubmitted after revision"
);

CREATE INDEX IF NOT EXISTS idx_proposal_submission_versions_submission
  ON proposal_submission_versions(submission_id);
CREATE INDEX IF NOT EXISTS idx_proposal_submission_versions_date
  ON proposal_submission_versions(uploaded_at DESC);

-- Now wire the FK on proposal_submissions.current_version_id (chicken-and-egg
-- resolved by adding it after the versions table exists).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposal_submissions_current_version_fkey'
  ) THEN
    ALTER TABLE proposal_submissions
      ADD CONSTRAINT proposal_submissions_current_version_fkey
      FOREIGN KEY (current_version_id)
      REFERENCES proposal_submission_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP I. proposal_part_a — structured Part A form data per partner.
-- ============================================================================
-- Hybrid: scalars as columns (for reporting + validation), repeating sections
-- as JSONB (contacts, researchers, publications, previous projects,
-- infrastructure, roles, standards bodies, R&I assets, dissemination).

CREATE TABLE IF NOT EXISTS proposal_part_a (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES proposal_partners(id) ON DELETE CASCADE,

  -- Section 1.1 org data
  legal_name TEXT,
  acronym TEXT,
  city TEXT,
  country TEXT,
  website TEXT,
  is_non_profit BOOLEAN,
  pic TEXT,
  org_type TEXT CHECK (org_type IN (
    'academic','industrial','rto','public','sme','other'
  )),
  org_type_other TEXT,

  -- Section 1.2 UBOs
  ubo_location TEXT CHECK (ubo_location IN ('eu','outside_eu','unknown')),
  ubo_country TEXT,
  ubo_notes TEXT,

  -- Section 1.3 contacts (JSONB array of contact rows)
  main_contact JSONB,   -- single object
  other_contacts JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Section 1.4 departments (array of strings)
  departments JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Section 1.5 researchers (array of { title, first_name, last_name, gender,
  --   nationality, email, career_stage, role, orcid })
  researchers JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Section 1.6 roles (array of role-key strings selected from enum list)
  roles JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Section 1.7 publications/products (array of { type, description })
  achievements JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Section 1.8 previous projects (array of { name, description })
  previous_projects JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Section 1.9 infrastructure (array of { name, description })
  infrastructure JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Section 1.10 Gender Equality Plan
  has_gep BOOLEAN,
  gep_notes TEXT,

  -- Section 2 budget-related scalars
  pm_rate_currency TEXT DEFAULT 'EUR',
  pm_rate_amount NUMERIC(12,2),
  other_direct_costs JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ label, amount, justification }]

  -- Section 3.1 standards bodies (array of body-key strings)
  standards_bodies JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Section 3.2 R&I assets + 3.3 links to other projects
  ri_assets JSONB NOT NULL DEFAULT '[]'::jsonb,
  similar_projects JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Section 4 dissemination + exploitation plans
  dissemination_plan TEXT,
  exploitation_plan TEXT,
  planned_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  planned_publications TEXT,
  dissemination_bodies TEXT,
  standardisation_involvement TEXT,
  patents_planned TEXT,

  -- Section 5.1 profile + role descriptions
  short_profile TEXT,
  role_description TEXT,

  -- Section 6 affiliated entities
  affiliated_entities JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_part_a_unique
  ON proposal_part_a(proposal_id, partner_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposal_submissions_part_a_fkey'
  ) THEN
    ALTER TABLE proposal_submissions
      ADD CONSTRAINT proposal_submissions_part_a_fkey
      FOREIGN KEY (part_a_id) REFERENCES proposal_part_a(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP J. proposal_budgets — partner × WP commitment, plus scalar overhead.
-- ============================================================================
-- Header row: one per (proposal, partner) with PM rate + other direct costs.
-- Line rows: one per (budget, wp) with PMs and role.

CREATE TABLE IF NOT EXISTS proposal_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES proposal_partners(id) ON DELETE CASCADE,
  pm_rate_currency TEXT DEFAULT 'EUR',
  pm_rate_amount NUMERIC(12,2),
  budget_travel NUMERIC(14,2) DEFAULT 0,
  budget_subcontracting NUMERIC(14,2) DEFAULT 0,
  budget_equipment NUMERIC(14,2) DEFAULT 0,
  budget_other_goods NUMERIC(14,2) DEFAULT 0,
  funding_rate NUMERIC(5,2) DEFAULT 100.0,
  indirect_cost_rate NUMERIC(5,2) DEFAULT 25.0,
  indirect_cost_base TEXT DEFAULT 'all_direct'
    CHECK (indirect_cost_base IN ('all_direct','personnel_only','all_except_subcontracting')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_budgets_unique
  ON proposal_budgets(proposal_id, partner_id);

CREATE TABLE IF NOT EXISTS proposal_budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES proposal_budgets(id) ON DELETE CASCADE,
  wp_id UUID NOT NULL REFERENCES proposal_work_packages(id) ON DELETE CASCADE,
  person_months NUMERIC(8,2) NOT NULL DEFAULT 0,
  partner_role TEXT CHECK (partner_role IN ('lead','partner','contributor')) DEFAULT 'partner',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_budget_lines_unique
  ON proposal_budget_lines(budget_id, wp_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposal_submissions_budget_fkey'
  ) THEN
    ALTER TABLE proposal_submissions
      ADD CONSTRAINT proposal_submissions_budget_fkey
      FOREIGN KEY (budget_id) REFERENCES proposal_budgets(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP K. proposal_audit_events — activity log.
-- ============================================================================

CREATE TABLE IF NOT EXISTS proposal_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_role TEXT CHECK (actor_role IN ('coordinator','partner','system')),
  event_type TEXT NOT NULL,
  -- 'partner_invited','partner_accepted','partner_declined','document_added',
  -- 'document_removed','submission_started','submission_updated',
  -- 'submission_submitted','submission_approved','submission_rejected',
  -- 'proposal_status_changed','proposal_converted'
  target_partner_id UUID REFERENCES proposal_partners(id) ON DELETE SET NULL,
  target_document_id UUID REFERENCES proposal_documents(id) ON DELETE SET NULL,
  target_submission_id UUID REFERENCES proposal_submissions(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_audit_proposal ON proposal_audit_events(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_audit_created  ON proposal_audit_events(created_at DESC);

-- ============================================================================
-- STEP L. Lock-on-convert trigger.
-- ============================================================================
-- Once proposals.converted_project_id IS NOT NULL, the proposal data becomes
-- read-only. Block UPDATEs/INSERTs/DELETEs on downstream tables.

CREATE OR REPLACE FUNCTION enforce_proposal_not_converted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  proposal_id_to_check UUID;
  is_converted BOOLEAN;
BEGIN
  -- Derive the proposal_id from whichever row is being modified.
  IF TG_TABLE_NAME = 'proposal_partners'          THEN proposal_id_to_check := COALESCE(NEW.proposal_id, OLD.proposal_id);
  ELSIF TG_TABLE_NAME = 'proposal_documents'      THEN proposal_id_to_check := COALESCE(NEW.proposal_id, OLD.proposal_id);
  ELSIF TG_TABLE_NAME = 'proposal_work_packages'  THEN proposal_id_to_check := COALESCE(NEW.proposal_id, OLD.proposal_id);
  ELSIF TG_TABLE_NAME = 'proposal_submissions'    THEN proposal_id_to_check := COALESCE(NEW.proposal_id, OLD.proposal_id);
  ELSIF TG_TABLE_NAME = 'proposal_part_a'         THEN proposal_id_to_check := COALESCE(NEW.proposal_id, OLD.proposal_id);
  ELSIF TG_TABLE_NAME = 'proposal_budgets'        THEN proposal_id_to_check := COALESCE(NEW.proposal_id, OLD.proposal_id);
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT converted_project_id IS NOT NULL INTO is_converted
  FROM proposals WHERE id = proposal_id_to_check;

  IF is_converted THEN
    RAISE EXCEPTION 'Proposal % has been converted to a project and is now read-only', proposal_id_to_check
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN VALUES
    ('proposal_partners'),
    ('proposal_documents'),
    ('proposal_work_packages'),
    ('proposal_submissions'),
    ('proposal_part_a'),
    ('proposal_budgets')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_not_converted ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_not_converted
         BEFORE INSERT OR UPDATE OR DELETE ON %I
         FOR EACH ROW EXECUTE FUNCTION enforce_proposal_not_converted()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ============================================================================
-- STEP M. updated_at auto-touch for proposal_* tables.
-- ============================================================================

CREATE OR REPLACE FUNCTION touch_proposal_tables()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN VALUES
    ('proposal_partners'),
    ('proposal_documents'),
    ('proposal_work_packages'),
    ('proposal_submissions'),
    ('proposal_part_a'),
    ('proposal_budgets'),
    ('proposal_call_templates')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION touch_proposal_tables()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ============================================================================
-- STEP N. RLS policies.
-- ============================================================================

ALTER TABLE proposal_call_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_partners              ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_work_packages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_documents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_submissions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_submission_versions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_part_a                ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_budgets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_budget_lines          ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_audit_events          ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an accepted external partner on a proposal?
CREATE OR REPLACE FUNCTION is_proposal_partner(p_proposal_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM proposal_partners
    WHERE proposal_id = p_proposal_id
      AND user_id = auth.uid()
      AND invite_status = 'accepted'
      AND is_host = FALSE
  );
$$;

-- ── proposals: let accepted external partners read the proposal row
-- they've been invited to. Without this, every partner UI query fails RLS.
-- Org members already have SELECT via the policy in schema.sql.
DROP POLICY IF EXISTS "Partners read invited proposal" ON proposals;
CREATE POLICY "Partners read invited proposal"
  ON proposals FOR SELECT
  USING (is_proposal_partner(id));

-- ── proposal_call_templates: everyone in the app can read global + own-org rows.
DROP POLICY IF EXISTS "Templates readable" ON proposal_call_templates;
CREATE POLICY "Templates readable"
  ON proposal_call_templates FOR SELECT
  USING (org_id IS NULL OR org_id = auth_org_id());

DROP POLICY IF EXISTS "Admins manage templates" ON proposal_call_templates;
CREATE POLICY "Admins manage templates"
  ON proposal_call_templates FOR ALL
  USING (org_id = auth_org_id() AND auth_role() = 'Admin')
  WITH CHECK (org_id = auth_org_id() AND auth_role() = 'Admin');

-- ── proposal_partners
DROP POLICY IF EXISTS "Org members manage proposal_partners" ON proposal_partners;
CREATE POLICY "Org members manage proposal_partners"
  ON proposal_partners FOR ALL
  USING (proposal_id IN (SELECT id FROM proposals WHERE org_id = auth_org_id()))
  WITH CHECK (proposal_id IN (SELECT id FROM proposals WHERE org_id = auth_org_id()));

DROP POLICY IF EXISTS "Partners see own row" ON proposal_partners;
CREATE POLICY "Partners see own row"
  ON proposal_partners FOR SELECT
  USING (user_id = auth.uid());

-- NOTE: we intentionally do NOT add a "pending invitee can see row" SELECT
-- policy. The invite-accept flow (api/members.ts) uses the service-role key
-- server-side — it bypasses RLS. Exposing pending invites via RLS would let
-- any authenticated user enumerate every pending invite across every org.

-- Clean up the same leaky policy on project_partners if it still exists
-- from the projects merge migration.
DROP POLICY IF EXISTS "Anyone with token sees partner" ON project_partners;

-- ── proposal_work_packages
DROP POLICY IF EXISTS "Org members manage proposal_work_packages" ON proposal_work_packages;
CREATE POLICY "Org members manage proposal_work_packages"
  ON proposal_work_packages FOR ALL
  USING (proposal_id IN (SELECT id FROM proposals WHERE org_id = auth_org_id()))
  WITH CHECK (proposal_id IN (SELECT id FROM proposals WHERE org_id = auth_org_id()));

DROP POLICY IF EXISTS "Partners view proposal_work_packages" ON proposal_work_packages;
CREATE POLICY "Partners view proposal_work_packages"
  ON proposal_work_packages FOR SELECT
  USING (is_proposal_partner(proposal_id));

-- ── proposal_documents
DROP POLICY IF EXISTS "Org members manage proposal_documents" ON proposal_documents;
CREATE POLICY "Org members manage proposal_documents"
  ON proposal_documents FOR ALL
  USING (proposal_id IN (SELECT id FROM proposals WHERE org_id = auth_org_id()))
  WITH CHECK (proposal_id IN (SELECT id FROM proposals WHERE org_id = auth_org_id()));

DROP POLICY IF EXISTS "Partners view proposal_documents" ON proposal_documents;
CREATE POLICY "Partners view proposal_documents"
  ON proposal_documents FOR SELECT
  USING (is_proposal_partner(proposal_id));

-- ── proposal_submissions: org members full; partners only own row.
DROP POLICY IF EXISTS "Org members manage proposal_submissions" ON proposal_submissions;
CREATE POLICY "Org members manage proposal_submissions"
  ON proposal_submissions FOR ALL
  USING (proposal_id IN (SELECT id FROM proposals WHERE org_id = auth_org_id()))
  WITH CHECK (proposal_id IN (SELECT id FROM proposals WHERE org_id = auth_org_id()));

DROP POLICY IF EXISTS "Partners manage own submissions" ON proposal_submissions;
CREATE POLICY "Partners manage own submissions"
  ON proposal_submissions FOR ALL
  USING (
    partner_id IN (
      SELECT id FROM proposal_partners
      WHERE user_id = auth.uid() AND invite_status = 'accepted'
    )
  )
  WITH CHECK (
    partner_id IN (
      SELECT id FROM proposal_partners
      WHERE user_id = auth.uid() AND invite_status = 'accepted'
    )
  );

-- ── proposal_submission_versions (read for both; insert matches submission access)
DROP POLICY IF EXISTS "Org members read submission_versions" ON proposal_submission_versions;
CREATE POLICY "Org members read submission_versions"
  ON proposal_submission_versions FOR SELECT
  USING (submission_id IN (
    SELECT id FROM proposal_submissions
    WHERE proposal_id IN (SELECT id FROM proposals WHERE org_id = auth_org_id())
  ));

DROP POLICY IF EXISTS "Partners read own submission_versions" ON proposal_submission_versions;
CREATE POLICY "Partners read own submission_versions"
  ON proposal_submission_versions FOR SELECT
  USING (submission_id IN (
    SELECT id FROM proposal_submissions
    WHERE partner_id IN (
      SELECT id FROM proposal_partners
      WHERE user_id = auth.uid() AND invite_status = 'accepted'
    )
  ));

DROP POLICY IF EXISTS "Involved can insert submission_versions" ON proposal_submission_versions;
CREATE POLICY "Involved can insert submission_versions"
  ON proposal_submission_versions FOR INSERT
  WITH CHECK (submission_id IN (
    SELECT id FROM proposal_submissions
    WHERE proposal_id IN (SELECT id FROM proposals WHERE org_id = auth_org_id())
       OR partner_id IN (
         SELECT id FROM proposal_partners
         WHERE user_id = auth.uid() AND invite_status = 'accepted'
       )
  ));

-- ── proposal_part_a
DROP POLICY IF EXISTS "Org members manage proposal_part_a" ON proposal_part_a;
CREATE POLICY "Org members manage proposal_part_a"
  ON proposal_part_a FOR ALL
  USING (proposal_id IN (SELECT id FROM proposals WHERE org_id = auth_org_id()))
  WITH CHECK (proposal_id IN (SELECT id FROM proposals WHERE org_id = auth_org_id()));

DROP POLICY IF EXISTS "Partners manage own proposal_part_a" ON proposal_part_a;
CREATE POLICY "Partners manage own proposal_part_a"
  ON proposal_part_a FOR ALL
  USING (partner_id IN (
    SELECT id FROM proposal_partners
    WHERE user_id = auth.uid() AND invite_status = 'accepted'
  ))
  WITH CHECK (partner_id IN (
    SELECT id FROM proposal_partners
    WHERE user_id = auth.uid() AND invite_status = 'accepted'
  ));

-- ── proposal_budgets + proposal_budget_lines (same pattern)
DROP POLICY IF EXISTS "Org members manage proposal_budgets" ON proposal_budgets;
CREATE POLICY "Org members manage proposal_budgets"
  ON proposal_budgets FOR ALL
  USING (proposal_id IN (SELECT id FROM proposals WHERE org_id = auth_org_id()))
  WITH CHECK (proposal_id IN (SELECT id FROM proposals WHERE org_id = auth_org_id()));

DROP POLICY IF EXISTS "Partners manage own proposal_budgets" ON proposal_budgets;
CREATE POLICY "Partners manage own proposal_budgets"
  ON proposal_budgets FOR ALL
  USING (partner_id IN (
    SELECT id FROM proposal_partners
    WHERE user_id = auth.uid() AND invite_status = 'accepted'
  ))
  WITH CHECK (partner_id IN (
    SELECT id FROM proposal_partners
    WHERE user_id = auth.uid() AND invite_status = 'accepted'
  ));

DROP POLICY IF EXISTS "Org members manage proposal_budget_lines" ON proposal_budget_lines;
CREATE POLICY "Org members manage proposal_budget_lines"
  ON proposal_budget_lines FOR ALL
  USING (budget_id IN (
    SELECT pb.id FROM proposal_budgets pb
    WHERE pb.proposal_id IN (SELECT id FROM proposals WHERE org_id = auth_org_id())
  ))
  WITH CHECK (budget_id IN (
    SELECT pb.id FROM proposal_budgets pb
    WHERE pb.proposal_id IN (SELECT id FROM proposals WHERE org_id = auth_org_id())
  ));

DROP POLICY IF EXISTS "Partners manage own proposal_budget_lines" ON proposal_budget_lines;
CREATE POLICY "Partners manage own proposal_budget_lines"
  ON proposal_budget_lines FOR ALL
  USING (budget_id IN (
    SELECT pb.id FROM proposal_budgets pb
    WHERE pb.partner_id IN (
      SELECT id FROM proposal_partners
      WHERE user_id = auth.uid() AND invite_status = 'accepted'
    )
  ))
  WITH CHECK (budget_id IN (
    SELECT pb.id FROM proposal_budgets pb
    WHERE pb.partner_id IN (
      SELECT id FROM proposal_partners
      WHERE user_id = auth.uid() AND invite_status = 'accepted'
    )
  ));

-- ── proposal_audit_events: read-visible to everyone involved; inserts allowed
DROP POLICY IF EXISTS "Org members read proposal_audit" ON proposal_audit_events;
CREATE POLICY "Org members read proposal_audit"
  ON proposal_audit_events FOR SELECT
  USING (proposal_id IN (SELECT id FROM proposals WHERE org_id = auth_org_id()));

DROP POLICY IF EXISTS "Partners read own proposal_audit" ON proposal_audit_events;
CREATE POLICY "Partners read own proposal_audit"
  ON proposal_audit_events FOR SELECT
  USING (is_proposal_partner(proposal_id));

DROP POLICY IF EXISTS "Involved insert proposal_audit" ON proposal_audit_events;
CREATE POLICY "Involved insert proposal_audit"
  ON proposal_audit_events FOR INSERT
  WITH CHECK (
    proposal_id IN (SELECT id FROM proposals WHERE org_id = auth_org_id())
    OR is_proposal_partner(proposal_id)
  );

-- ============================================================================
-- STEP O. Seed built-in call templates (global rows, org_id IS NULL).
-- ============================================================================

INSERT INTO proposal_call_templates (org_id, name, description, is_builtin, default_documents)
SELECT NULL, 'Horizon Europe', 'Default Horizon Europe consortium proposal template.', TRUE, '[
  { "type": "part_a",             "label": "Part A — Partner Profile",           "handler": "form",                  "required": true,  "template_url": null, "description": "Administrative & profile information for each partner org." },
  { "type": "budget",             "label": "Budget commitment",                  "handler": "form",                  "required": true,  "template_url": null, "description": "Person-months per work package, PM rate, other direct costs." },
  { "type": "ownership_control",  "label": "Ownership Control Declaration",      "handler": "upload_with_template",  "required": true,  "template_url": "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/how-to-participate/reference-documents", "description": "Signed PDF declaring ownership and control. Download the EC template, fill it in, sign, and upload." },
  { "type": "cv",                 "label": "CVs of key researchers",             "handler": "upload",                "required": true,  "template_url": null, "description": "PDFs of CVs for each key researcher listed in Part A." },
  { "type": "commitment_letter",  "label": "Letter of Commitment",               "handler": "upload",                "required": true,  "template_url": null, "description": "Signed letter committing the partner to the project." },
  { "type": "ethics_assessment",  "label": "Ethics Self-Assessment",             "handler": "upload_with_template",  "required": true,  "template_url": "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/how-to-participate/reference-documents", "description": "Horizon Europe ethics checklist — section 4 of Part A." }
]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM proposal_call_templates WHERE name = 'Horizon Europe' AND org_id IS NULL AND is_builtin = TRUE
);

INSERT INTO proposal_call_templates (org_id, name, description, is_builtin, default_documents)
SELECT NULL, 'Generic call', 'Minimal template — just Part A, Budget, and Letter of Commitment. Use as a starting point for any call.', TRUE, '[
  { "type": "part_a",             "label": "Part A — Partner Profile",   "handler": "form",     "required": true, "template_url": null, "description": "Administrative & profile info." },
  { "type": "budget",             "label": "Budget commitment",          "handler": "form",     "required": true, "template_url": null, "description": "Per-WP person-months and direct costs." },
  { "type": "commitment_letter",  "label": "Letter of Commitment",       "handler": "upload",   "required": true, "template_url": null, "description": "Signed partner commitment letter." }
]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM proposal_call_templates WHERE name = 'Generic call' AND org_id IS NULL AND is_builtin = TRUE
);

INSERT INTO proposal_call_templates (org_id, name, description, is_builtin, default_documents)
SELECT NULL, 'Erasmus+', 'Template for Erasmus+ programme proposals.', TRUE, '[
  { "type": "part_a",             "label": "Part A — Partner Profile",   "handler": "form",     "required": true, "template_url": null, "description": "Administrative & profile info." },
  { "type": "budget",             "label": "Budget commitment",          "handler": "form",     "required": true, "template_url": null, "description": "Per-WP person-months and direct costs." },
  { "type": "commitment_letter",  "label": "Mandate letter",             "handler": "upload",   "required": true, "template_url": null, "description": "Signed mandate giving the coordinator authority." }
]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM proposal_call_templates WHERE name = 'Erasmus+' AND org_id IS NULL AND is_builtin = TRUE
);

INSERT INTO proposal_call_templates (org_id, name, description, is_builtin, default_documents)
SELECT NULL, 'LIFE Programme', 'Template for LIFE (environment & climate action) proposals.', TRUE, '[
  { "type": "part_a",             "label": "Part A — Partner Profile",   "handler": "form",     "required": true, "template_url": null, "description": "Administrative & profile info." },
  { "type": "budget",             "label": "Budget commitment",          "handler": "form",     "required": true, "template_url": null, "description": "Per-WP person-months and direct costs." },
  { "type": "ownership_control",  "label": "Ownership Control Declaration", "handler": "upload_with_template", "required": true, "template_url": "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/how-to-participate/reference-documents", "description": "Signed PDF declaring ownership and control." },
  { "type": "commitment_letter",  "label": "Letter of Commitment",       "handler": "upload",   "required": true, "template_url": null, "description": "Signed partner commitment letter." }
]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM proposal_call_templates WHERE name = 'LIFE Programme' AND org_id IS NULL AND is_builtin = TRUE
);

COMMIT;

-- ============================================================================
-- STEP P. RPC — atomic convert-to-project.
-- ============================================================================
-- Runs AFTER the main transaction committed so that the CREATE FUNCTION sees
-- the freshly created proposal_* tables. This one is self-contained.

BEGIN;

CREATE OR REPLACE FUNCTION rpc_convert_proposal_to_project(p_proposal_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proposal RECORD;
  v_new_project_id UUID;
  v_host_partner_id UUID;
  v_total_personnel NUMERIC := 0;
  v_total_travel NUMERIC := 0;
  v_total_subcontracting NUMERIC := 0;
  v_total_other NUMERIC := 0;
  v_total_equipment NUMERIC := 0;
  v_wp_map JSONB := '{}'::jsonb;
  v_proposal_wp RECORD;
  v_new_wp_id UUID;
  v_budget_line RECORD;
BEGIN
  -- Lock the proposal row to prevent races.
  SELECT * INTO v_proposal FROM proposals WHERE id = p_proposal_id FOR UPDATE;
  IF v_proposal.id IS NULL THEN
    RAISE EXCEPTION 'Proposal % not found', p_proposal_id USING ERRCODE = 'no_data_found';
  END IF;

  -- SECURITY DEFINER bypasses RLS, so we must explicitly verify the caller is
  -- a member of the proposal's org with write privileges. Otherwise any
  -- authenticated user could convert any proposal.
  IF NOT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = v_proposal.org_id
      AND user_id = auth.uid()
      AND role IN ('Admin', 'Project Manager')
  ) THEN
    RAISE EXCEPTION 'User is not authorised to convert proposals for this organisation'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_proposal.converted_project_id IS NOT NULL THEN
    RAISE EXCEPTION 'Proposal % already converted to project %', p_proposal_id, v_proposal.converted_project_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Aggregate partner budgets for the project-level totals.
  SELECT
    COALESCE(SUM(COALESCE(pb.pm_rate_amount, 0) * COALESCE(lines.total_pms, 0)), 0),
    COALESCE(SUM(pb.budget_travel), 0),
    COALESCE(SUM(pb.budget_subcontracting), 0),
    COALESCE(SUM(pb.budget_equipment + pb.budget_other_goods), 0),
    COALESCE(SUM(pb.budget_equipment), 0)
  INTO v_total_personnel, v_total_travel, v_total_subcontracting, v_total_other, v_total_equipment
  FROM proposal_budgets pb
  LEFT JOIN (
    SELECT budget_id, SUM(person_months) AS total_pms
    FROM proposal_budget_lines GROUP BY budget_id
  ) lines ON lines.budget_id = pb.id
  WHERE pb.proposal_id = p_proposal_id;

  -- Create the project row. The existing trg_projects_host_partner trigger
  -- will auto-create its host partner.
  INSERT INTO projects (
    org_id, acronym, title,
    grant_number, funding_programme, funding_scheme_id,
    status, start_date, end_date,
    has_wps, created_by, responsible_person_id,
    total_budget, budget_personnel, budget_travel, budget_subcontracting, budget_other
  ) VALUES (
    v_proposal.org_id,
    -- Fall back to 'PROJ' when the project name strips to an empty string
    -- (projects.acronym is NOT NULL).
    COALESCE(
      NULLIF(UPPER(LEFT(regexp_replace(COALESCE(v_proposal.project_name, 'NEW'), '[^A-Za-z0-9]+', '', 'g'), 10)), ''),
      'PROJ'
    ),
    v_proposal.project_name,
    NULL,
    v_proposal.call_identifier,
    NULL,
    'Upcoming',
    COALESCE(v_proposal.submission_deadline, CURRENT_DATE),
    COALESCE(v_proposal.expected_decision, CURRENT_DATE + INTERVAL '3 years'),
    TRUE,
    auth.uid(),
    v_proposal.responsible_person_id,
    v_total_personnel + v_total_travel + v_total_subcontracting + v_total_other,
    v_total_personnel, v_total_travel, v_total_subcontracting, v_total_other
  )
  RETURNING id INTO v_new_project_id;

  -- The auto-created host partner of the new project:
  SELECT id INTO v_host_partner_id
  FROM project_partners
  WHERE project_id = v_new_project_id AND is_host = TRUE
  LIMIT 1;

  -- Copy work packages. Build an old-WP-id → new-WP-id map as we go so we
  -- can translate budget line references.
  FOR v_proposal_wp IN
    SELECT id, wp_number, title, description
    FROM proposal_work_packages
    WHERE proposal_id = p_proposal_id
    ORDER BY wp_number
  LOOP
    INSERT INTO work_packages (
      org_id, project_id, number, name, description, total_person_months, leader_partner_id
    ) VALUES (
      v_proposal.org_id,
      v_new_project_id,
      v_proposal_wp.wp_number,
      v_proposal_wp.title,
      v_proposal_wp.description,
      0,
      NULL
    )
    RETURNING id INTO v_new_wp_id;
    v_wp_map := v_wp_map || jsonb_build_object(v_proposal_wp.id::text, v_new_wp_id::text);
  END LOOP;

  -- Roll budget-line PMs forward onto the host partner (consortium commits).
  -- Model D: external partners are NOT copied to project_partners here.
  FOR v_budget_line IN
    SELECT bl.wp_id, SUM(bl.person_months) AS total_pms
    FROM proposal_budget_lines bl
    JOIN proposal_budgets pb ON pb.id = bl.budget_id
    WHERE pb.proposal_id = p_proposal_id
    GROUP BY bl.wp_id
  LOOP
    IF v_wp_map ? v_budget_line.wp_id::text AND v_host_partner_id IS NOT NULL THEN
      INSERT INTO project_partner_wp_allocs (partner_id, wp_id, person_months)
      VALUES (
        v_host_partner_id,
        (v_wp_map->>v_budget_line.wp_id::text)::UUID,
        v_budget_line.total_pms
      )
      ON CONFLICT (partner_id, wp_id) DO UPDATE
        SET person_months = EXCLUDED.person_months;
    END IF;
  END LOOP;

  -- Seal the proposal.
  UPDATE proposals
  SET converted_project_id = v_new_project_id,
      converted_at = now(),
      status = 'Granted',
      updated_at = now()
  WHERE id = p_proposal_id;

  -- Audit.
  INSERT INTO proposal_audit_events (
    proposal_id, actor_user_id, actor_role, event_type, note
  ) VALUES (
    p_proposal_id, auth.uid(), 'coordinator', 'proposal_converted',
    format('Converted to project %s', v_new_project_id)
  );

  RETURN v_new_project_id;
END;
$$;

-- Allow authenticated users to call the RPC (RLS inside still enforces
-- that they're an Admin/Project Manager on the proposal's org).
GRANT EXECUTE ON FUNCTION rpc_convert_proposal_to_project(UUID) TO authenticated;

COMMIT;
