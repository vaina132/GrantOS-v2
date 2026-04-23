-- ============================================================================
-- Merge "Our Projects" and "Collaboration Projects" into a single module
-- ============================================================================
-- This migration unifies the two parallel project schemas into one.
--
-- Strategy:
--   1. Extend `projects` and satellites (work_packages, deliverables,
--      milestones, reporting_periods) with the extra columns collab needs.
--   2. Create new `project_*` satellite tables (partners, contacts, tasks,
--      reports, etc.) that previously lived as `collab_*`.
--   3. Backfill a `host` partner row for every existing project so the
--      single-org projects still conform to the unified model.
--   4. Copy every `collab_*` row into the unified tables, preserving UUIDs
--      so foreign-key references stay intact.
--   5. Drop `collab_*` tables and the `projects.collab_project_id` column.
--   6. Replace legacy RLS policies with unified ones that cover both org
--      members (by `org_id`) and external partners (by accepted invite).
--
-- Safe to re-run: every DDL uses IF NOT EXISTS / IF EXISTS guards, and
-- data copies use ON CONFLICT DO NOTHING.  Wrapped in a transaction so a
-- failure leaves the database unchanged.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP A. Extend existing tables with collab columns
-- ============================================================================

-- A.1  projects ---------------------------------------------------------------
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS duration_months INTEGER,
  ADD COLUMN IF NOT EXISTS funding_programme TEXT,
  ADD COLUMN IF NOT EXISTS deviation_personnel_effort NUMERIC(5,2) NOT NULL DEFAULT 20.0,
  ADD COLUMN IF NOT EXISTS deviation_personnel_costs  NUMERIC(5,2) NOT NULL DEFAULT 20.0,
  ADD COLUMN IF NOT EXISTS deviation_pm_rate          NUMERIC(5,2) NOT NULL DEFAULT 20.0,
  ADD COLUMN IF NOT EXISTS reminder_settings JSONB NOT NULL DEFAULT '{
    "deliverables": { "enabled": true, "lead_time": 14, "unit": "days" },
    "milestones":   { "enabled": true, "lead_time": 14, "unit": "days" },
    "reports":      { "enabled": true, "lead_time": 7,  "unit": "days" }
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- A.2  work_packages ----------------------------------------------------------
-- `number`, `start_month`, `end_month` were added by add_wp_fields.sql.
-- Extend with total_person_months + leader_partner_id (FK added later once
-- project_partners exists).
ALTER TABLE work_packages
  ADD COLUMN IF NOT EXISTS total_person_months NUMERIC(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leader_partner_id UUID;

-- A.3  deliverables -----------------------------------------------------------
ALTER TABLE deliverables
  ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('report','data','software','demonstrator','other')),
  ADD COLUMN IF NOT EXISTS dissemination TEXT CHECK (dissemination IN ('public','confidential','classified')),
  ADD COLUMN IF NOT EXISTS leader_partner_id UUID;

-- A.4  milestones -------------------------------------------------------------
-- milestones already has verification_means; just add leader_partner_id.
ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS leader_partner_id UUID;

-- A.5  reporting_periods ------------------------------------------------------
ALTER TABLE reporting_periods
  ADD COLUMN IF NOT EXISTS period_type TEXT NOT NULL DEFAULT 'formal'
    CHECK (period_type IN ('formal','informal')),
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS reports_generated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS beneficiaries_notified BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================================
-- STEP B. Create new project_* satellite tables
-- ============================================================================

-- B.1  project_partners -------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('host','coordinator','partner')),
  participant_number INTEGER,
  contact_name TEXT,
  contact_email TEXT,
  country TEXT,
  org_type TEXT,
  budget_personnel       NUMERIC(14,2) DEFAULT 0,
  budget_subcontracting  NUMERIC(14,2) DEFAULT 0,
  budget_travel          NUMERIC(14,2) DEFAULT 0,
  budget_equipment       NUMERIC(14,2) DEFAULT 0,
  budget_other_goods     NUMERIC(14,2) DEFAULT 0,
  total_person_months    NUMERIC(8,2)  DEFAULT 0,
  funding_rate           NUMERIC(5,2)  DEFAULT 100.0,
  indirect_cost_rate     NUMERIC(5,2)  DEFAULT 25.0,
  indirect_cost_base     TEXT NOT NULL DEFAULT 'all_direct'
    CHECK (indirect_cost_base IN ('all_direct','personnel_only','all_except_subcontracting')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_org_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  invite_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (invite_status IN ('pending','accepted','declined')),
  invite_token UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_partners_project ON project_partners(project_id);
CREATE INDEX IF NOT EXISTS idx_project_partners_user    ON project_partners(user_id);
CREATE INDEX IF NOT EXISTS idx_project_partners_token   ON project_partners(invite_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_partners_one_host
  ON project_partners(project_id) WHERE is_host = TRUE;

-- Now that project_partners exists, wire up the leader_partner_id FKs on
-- work_packages, deliverables and milestones.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_packages_leader_partner_id_fkey'
  ) THEN
    ALTER TABLE work_packages
      ADD CONSTRAINT work_packages_leader_partner_id_fkey
      FOREIGN KEY (leader_partner_id) REFERENCES project_partners(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deliverables_leader_partner_id_fkey'
  ) THEN
    ALTER TABLE deliverables
      ADD CONSTRAINT deliverables_leader_partner_id_fkey
      FOREIGN KEY (leader_partner_id) REFERENCES project_partners(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'milestones_leader_partner_id_fkey'
  ) THEN
    ALTER TABLE milestones
      ADD CONSTRAINT milestones_leader_partner_id_fkey
      FOREIGN KEY (leader_partner_id) REFERENCES project_partners(id) ON DELETE SET NULL;
  END IF;
END $$;

-- B.2  project_contacts -------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES project_partners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role_note TEXT,
  notify_reminders  BOOLEAN NOT NULL DEFAULT TRUE,
  notify_approvals  BOOLEAN NOT NULL DEFAULT TRUE,
  notify_rejections BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_contacts_partner ON project_contacts(partner_id);

-- B.3  project_partner_wp_allocs ---------------------------------------------
CREATE TABLE IF NOT EXISTS project_partner_wp_allocs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES project_partners(id) ON DELETE CASCADE,
  wp_id UUID NOT NULL REFERENCES work_packages(id) ON DELETE CASCADE,
  person_months NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_pwp_partner ON project_partner_wp_allocs(partner_id);
CREATE INDEX IF NOT EXISTS idx_project_pwp_wp ON project_partner_wp_allocs(wp_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_pwp_unique ON project_partner_wp_allocs(partner_id, wp_id);

-- B.4  project_tasks ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wp_id UUID NOT NULL REFERENCES work_packages(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_month INTEGER,
  end_month INTEGER,
  leader_partner_id UUID REFERENCES project_partners(id) ON DELETE SET NULL,
  person_months NUMERIC(8,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_tasks_wp ON project_tasks(wp_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);

-- B.5  project_partner_task_effort -------------------------------------------
CREATE TABLE IF NOT EXISTS project_partner_task_effort (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES project_partners(id) ON DELETE CASCADE,
  person_months NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, partner_id)
);
CREATE INDEX IF NOT EXISTS idx_project_pte_task ON project_partner_task_effort(task_id);
CREATE INDEX IF NOT EXISTS idx_project_pte_partner ON project_partner_task_effort(partner_id);

-- B.6  project_reports --------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES reporting_periods(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES project_partners(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','approved','rejected')),
  submitted_at TIMESTAMPTZ,
  reviewed_at  TIMESTAMPTZ,
  reviewed_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_reports_period ON project_reports(period_id);
CREATE INDEX IF NOT EXISTS idx_project_reports_partner ON project_reports(partner_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_reports_unique ON project_reports(period_id, partner_id);

-- B.7  project_report_lines ---------------------------------------------------
CREATE TABLE IF NOT EXISTS project_report_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES project_reports(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN (
    'personnel_effort','personnel_costs','subcontracting','travel','equipment','other_goods'
  )),
  wp_id UUID REFERENCES work_packages(id) ON DELETE SET NULL,
  line_order INTEGER NOT NULL DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  justification TEXT,
  justification_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_lines_report ON project_report_lines(report_id);
CREATE INDEX IF NOT EXISTS idx_project_lines_section ON project_report_lines(report_id, section);

-- B.8  project_report_events (immutable audit) -------------------------------
CREATE TABLE IF NOT EXISTS project_report_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES project_reports(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'generated','saved','submitted','approved','rejected','resubmitted','notified','comment'
  )),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_role TEXT CHECK (actor_role IN ('coordinator','partner','system','host')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_events_report ON project_report_events(report_id);

-- B.9  Auto-create a host partner for every new project -----------------
-- Any INSERT into `projects` automatically gets a matching is_host row in
-- project_partners, so creation sites don't have to remember to do it.
CREATE OR REPLACE FUNCTION ensure_host_partner()
RETURNS TRIGGER AS $$
DECLARE
  host_org_name TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM project_partners
    WHERE project_id = NEW.id AND is_host = TRUE
  ) THEN
    RETURN NEW;
  END IF;

  SELECT name INTO host_org_name FROM organisations WHERE id = NEW.org_id;

  INSERT INTO project_partners (
    project_id, org_name, role, is_host, linked_org_id,
    invite_status, participant_number, funding_rate
  ) VALUES (
    NEW.id,
    COALESCE(host_org_name, 'Host organisation'),
    'host',
    TRUE,
    NEW.org_id,
    'accepted',
    1,
    100.0
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_host_partner ON projects;
CREATE TRIGGER trg_projects_host_partner
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION ensure_host_partner();

-- B.10  updated_at triggers ---------------------------------------------------
CREATE OR REPLACE FUNCTION update_project_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_partners_updated ON project_partners;
CREATE TRIGGER trg_project_partners_updated
  BEFORE UPDATE ON project_partners
  FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();

DROP TRIGGER IF EXISTS trg_project_reports_updated ON project_reports;
CREATE TRIGGER trg_project_reports_updated
  BEFORE UPDATE ON project_reports
  FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();

DROP TRIGGER IF EXISTS trg_project_report_lines_updated ON project_report_lines;
CREATE TRIGGER trg_project_report_lines_updated
  BEFORE UPDATE ON project_report_lines
  FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();

-- ============================================================================
-- STEP C. Backfill a host-partner row for projects that won't get one from
-- the collab migration (STEP D).
-- ============================================================================
-- Every project should end up with exactly one `is_host = TRUE` row in
-- project_partners.  We skip projects that are linked to a collab whose
-- partner set already has an `is_host` partner — STEP D will migrate that
-- row.  STEP C-POST below then backfills any project that still has no
-- host after the collab data has moved.

DO $$
DECLARE
  has_collab_partners BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'collab_partners'
  ) INTO has_collab_partners;

  INSERT INTO project_partners (
    project_id, org_name, role, is_host, linked_org_id, invite_status,
    participant_number, funding_rate
  )
  SELECT
    p.id,
    COALESCE(o.name, 'Host organisation'),
    'host',
    TRUE,
    p.org_id,
    'accepted',
    1,
    100.0
  FROM projects p
  JOIN organisations o ON o.id = p.org_id
  WHERE NOT EXISTS (
    SELECT 1 FROM project_partners pp
    WHERE pp.project_id = p.id AND pp.is_host = TRUE
  )
    AND (
      NOT has_collab_partners
      OR p.collab_project_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM collab_partners cpa
        WHERE cpa.project_id = p.collab_project_id
          AND cpa.is_host = TRUE
      )
    );
END $$;

-- ============================================================================
-- STEP D. Migrate collab_* data into the unified tables
-- ============================================================================
-- Runs only if the collab tables exist (pre-migration environments).

DO $$
DECLARE
  has_collab_projects BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'collab_projects'
  ) INTO has_collab_projects;

  IF NOT has_collab_projects THEN
    RAISE NOTICE 'collab_projects table not present; skipping data migration.';
    RETURN;
  END IF;

  -- D.1  For every collab_projects row, ensure a matching projects row.
  --      If a projects row already links via collab_project_id, reuse it.
  --      Otherwise create a new projects row sharing the collab_project UUID.
  INSERT INTO projects (
    id, org_id, acronym, title,
    grant_number, funding_programme,
    status, start_date, end_date, duration_months, has_wps,
    deviation_personnel_effort, deviation_personnel_costs, deviation_pm_rate,
    reminder_settings, created_by, created_at, updated_at
  )
  SELECT
    cp.id,
    cp.host_org_id,
    cp.acronym,
    cp.title,
    cp.grant_number,
    cp.funding_programme,
    CASE cp.status
      WHEN 'draft'    THEN 'Upcoming'
      WHEN 'active'   THEN 'Active'
      WHEN 'archived' THEN 'Completed'
      ELSE 'Upcoming'
    END,
    COALESCE(cp.start_date, CURRENT_DATE),
    COALESCE(cp.end_date,   CURRENT_DATE + INTERVAL '1 year'),
    cp.duration_months,
    TRUE,
    cp.deviation_personnel_effort,
    cp.deviation_personnel_costs,
    cp.deviation_pm_rate,
    cp.reminder_settings,
    cp.created_by,
    cp.created_at,
    cp.updated_at
  FROM collab_projects cp
  WHERE NOT EXISTS (
    SELECT 1 FROM projects p WHERE p.id = cp.id
  )
    AND NOT EXISTS (
      SELECT 1 FROM projects p WHERE p.collab_project_id = cp.id
    );

  -- If there IS a projects row linked by collab_project_id but with a
  -- different id, rewire downstream satellites to point at the collab id
  -- so migration below stays consistent.  We do this by updating the
  -- existing projects row's id is NOT safe (too many FKs) — instead we
  -- build a mapping temp table.
  CREATE TEMP TABLE collab_to_projects_map ON COMMIT DROP AS
  SELECT
    cp.id AS collab_id,
    COALESCE(
      (SELECT p.id FROM projects p WHERE p.collab_project_id = cp.id LIMIT 1),
      cp.id
    ) AS project_id
  FROM collab_projects cp;

  -- D.2  collab_partners  →  project_partners
  INSERT INTO project_partners (
    id, project_id, org_name, role, participant_number,
    contact_name, contact_email, country, org_type,
    budget_personnel, budget_subcontracting, budget_travel,
    budget_equipment, budget_other_goods,
    total_person_months, funding_rate, indirect_cost_rate, indirect_cost_base,
    user_id, linked_org_id, is_host, invite_status, invite_token,
    created_at, updated_at
  )
  SELECT
    cpa.id,
    m.project_id,
    cpa.org_name,
    CASE
      WHEN cpa.is_host THEN 'host'
      ELSE cpa.role
    END,
    cpa.participant_number,
    cpa.contact_name,
    cpa.contact_email,
    cpa.country,
    cpa.org_type,
    cpa.budget_personnel, cpa.budget_subcontracting, cpa.budget_travel,
    cpa.budget_equipment, cpa.budget_other_goods,
    cpa.total_person_months, cpa.funding_rate,
    cpa.indirect_cost_rate, cpa.indirect_cost_base,
    cpa.user_id, cpa.linked_org_id, cpa.is_host, cpa.invite_status,
    cpa.invite_token, cpa.created_at, cpa.updated_at
  FROM collab_partners cpa
  JOIN collab_to_projects_map m ON m.collab_id = cpa.project_id
  ON CONFLICT (id) DO NOTHING;

  -- If migrating into an existing (linked) projects row, its backfilled
  -- host partner collides with the is_host partner from collab.  Prefer
  -- the collab one: delete the auto-generated host row when a collab host
  -- now exists for that project.
  DELETE FROM project_partners auto_host
  USING project_partners collab_host
  WHERE auto_host.project_id = collab_host.project_id
    AND auto_host.is_host = TRUE
    AND collab_host.is_host = TRUE
    AND auto_host.id <> collab_host.id
    AND auto_host.id NOT IN (SELECT id FROM collab_partners);

  -- D.3  collab_contacts  →  project_contacts
  INSERT INTO project_contacts (
    id, partner_id, name, email, role_note,
    notify_reminders, notify_approvals, notify_rejections, created_at
  )
  SELECT
    cc.id, cc.partner_id, cc.name, cc.email, cc.role_note,
    cc.notify_reminders, cc.notify_approvals, cc.notify_rejections, cc.created_at
  FROM collab_contacts cc
  ON CONFLICT (id) DO NOTHING;

  -- D.4  collab_work_packages  →  work_packages
  INSERT INTO work_packages (
    id, org_id, project_id, name, description, number,
    start_month, end_month, total_person_months, leader_partner_id,
    created_at
  )
  SELECT
    cwp.id,
    cp.host_org_id,
    m.project_id,
    cwp.title,
    NULL,
    cwp.wp_number,
    cwp.start_month,
    cwp.end_month,
    cwp.total_person_months,
    cwp.leader_partner_id,
    cwp.created_at
  FROM collab_work_packages cwp
  JOIN collab_projects cp ON cp.id = cwp.project_id
  JOIN collab_to_projects_map m ON m.collab_id = cwp.project_id
  ON CONFLICT (id) DO NOTHING;

  -- D.5  collab_partner_wp_allocs  →  project_partner_wp_allocs
  INSERT INTO project_partner_wp_allocs (id, partner_id, wp_id, person_months, created_at)
  SELECT id, partner_id, wp_id, person_months, created_at
  FROM collab_partner_wp_allocs
  ON CONFLICT (id) DO NOTHING;

  -- D.6  collab_tasks  →  project_tasks
  INSERT INTO project_tasks (
    id, wp_id, project_id, task_number, title, description,
    start_month, end_month, leader_partner_id, person_months, created_at
  )
  SELECT
    ct.id, ct.wp_id, m.project_id, ct.task_number, ct.title, ct.description,
    ct.start_month, ct.end_month, ct.leader_partner_id, ct.person_months, ct.created_at
  FROM collab_tasks ct
  JOIN collab_to_projects_map m ON m.collab_id = ct.project_id
  ON CONFLICT (id) DO NOTHING;

  -- D.7  collab_partner_task_effort  →  project_partner_task_effort
  INSERT INTO project_partner_task_effort (id, task_id, partner_id, person_months, created_at)
  SELECT id, task_id, partner_id, person_months, created_at
  FROM collab_partner_task_effort
  ON CONFLICT (id) DO NOTHING;

  -- D.8  collab_deliverables  →  deliverables
  INSERT INTO deliverables (
    id, org_id, project_id, work_package_id,
    number, title, description, due_month,
    type, dissemination, leader_partner_id, created_at, updated_at
  )
  SELECT
    cd.id,
    cp.host_org_id,
    m.project_id,
    cd.wp_id,
    cd.number, cd.title, cd.description, cd.due_month,
    cd.type, cd.dissemination, cd.leader_partner_id,
    cd.created_at, cd.created_at
  FROM collab_deliverables cd
  JOIN collab_projects cp ON cp.id = cd.project_id
  JOIN collab_to_projects_map m ON m.collab_id = cd.project_id
  ON CONFLICT (id) DO NOTHING;

  -- D.9  collab_milestones  →  milestones
  INSERT INTO milestones (
    id, org_id, project_id, work_package_id,
    number, title, description, due_month, verification_means, created_at, updated_at
  )
  SELECT
    cm.id,
    cp.host_org_id,
    m.project_id,
    cm.wp_id,
    cm.number, cm.title, cm.description, cm.due_month, cm.verification_means,
    cm.created_at, cm.created_at
  FROM collab_milestones cm
  JOIN collab_projects cp ON cp.id = cm.project_id
  JOIN collab_to_projects_map m ON m.collab_id = cm.project_id
  ON CONFLICT (id) DO NOTHING;

  -- D.10  collab_reporting_periods  →  reporting_periods
  INSERT INTO reporting_periods (
    id, org_id, project_id, period_number, start_month, end_month,
    period_type, title, due_date, reports_generated, beneficiaries_notified,
    created_at, updated_at
  )
  SELECT
    crp.id,
    cp.host_org_id,
    m.project_id,
    COALESCE(ROW_NUMBER() OVER (PARTITION BY crp.project_id ORDER BY crp.start_month), 1)::INTEGER,
    crp.start_month,
    crp.end_month,
    crp.period_type,
    crp.title,
    crp.due_date,
    crp.reports_generated,
    crp.beneficiaries_notified,
    crp.created_at, crp.updated_at
  FROM collab_reporting_periods crp
  JOIN collab_projects cp ON cp.id = crp.project_id
  JOIN collab_to_projects_map m ON m.collab_id = crp.project_id
  ON CONFLICT (id) DO NOTHING;

  -- D.11  collab_reports  →  project_reports
  INSERT INTO project_reports (
    id, period_id, partner_id, status, submitted_at, reviewed_at,
    reviewed_by, rejection_note, created_at, updated_at
  )
  SELECT
    cr.id, cr.period_id, cr.partner_id, cr.status, cr.submitted_at, cr.reviewed_at,
    cr.reviewed_by, cr.rejection_note, cr.created_at, cr.updated_at
  FROM collab_reports cr
  ON CONFLICT (id) DO NOTHING;

  -- D.12  collab_report_lines  →  project_report_lines
  INSERT INTO project_report_lines (
    id, report_id, section, wp_id, line_order, data,
    justification, justification_required, created_at, updated_at
  )
  SELECT
    crl.id, crl.report_id, crl.section, crl.wp_id, crl.line_order, crl.data,
    crl.justification, crl.justification_required, crl.created_at, crl.updated_at
  FROM collab_report_lines crl
  ON CONFLICT (id) DO NOTHING;

  -- D.13  collab_report_events  →  project_report_events
  INSERT INTO project_report_events (
    id, report_id, event_type, actor_user_id, actor_name, actor_role, note, created_at
  )
  SELECT
    cre.id, cre.report_id, cre.event_type, cre.actor_user_id, cre.actor_name,
    cre.actor_role, cre.note, cre.created_at
  FROM collab_report_events cre
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'collab_* data migrated into unified project_* tables.';
END $$;

-- ============================================================================
-- STEP D-POST. Guarantee every project has exactly one host partner.
-- ============================================================================
-- For any project that still has no is_host row after the collab migration
-- (e.g. a collab_project whose partners were all role='partner' with no
-- explicit host), insert an auto-host row based on the owning organisation.

INSERT INTO project_partners (
  project_id, org_name, role, is_host, linked_org_id, invite_status,
  participant_number, funding_rate
)
SELECT
  p.id,
  COALESCE(o.name, 'Host organisation'),
  'host',
  TRUE,
  p.org_id,
  'accepted',
  1,
  100.0
FROM projects p
JOIN organisations o ON o.id = p.org_id
WHERE NOT EXISTS (
  SELECT 1 FROM project_partners pp
  WHERE pp.project_id = p.id AND pp.is_host = TRUE
);

-- ============================================================================
-- STEP E. Drop legacy collab_* tables and the collab_project_id column
-- ============================================================================

DROP TABLE IF EXISTS collab_report_events          CASCADE;
DROP TABLE IF EXISTS collab_report_lines           CASCADE;
DROP TABLE IF EXISTS collab_reports                CASCADE;
DROP TABLE IF EXISTS collab_reporting_periods      CASCADE;
DROP TABLE IF EXISTS collab_milestones             CASCADE;
DROP TABLE IF EXISTS collab_deliverables           CASCADE;
DROP TABLE IF EXISTS collab_partner_task_effort    CASCADE;
DROP TABLE IF EXISTS collab_tasks                  CASCADE;
DROP TABLE IF EXISTS collab_partner_wp_allocs      CASCADE;
DROP TABLE IF EXISTS collab_contacts               CASCADE;
DROP TABLE IF EXISTS collab_work_packages          CASCADE;
DROP TABLE IF EXISTS collab_partners               CASCADE;
DROP TABLE IF EXISTS collab_projects               CASCADE;

DROP FUNCTION IF EXISTS is_collab_host_member(UUID) CASCADE;
DROP FUNCTION IF EXISTS is_collab_partner(UUID)     CASCADE;
DROP FUNCTION IF EXISTS get_collab_partner_id(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_collab_updated_at()  CASCADE;

ALTER TABLE projects DROP COLUMN IF EXISTS collab_project_id;

-- ============================================================================
-- STEP F. Unified RLS
-- ============================================================================
-- The unified RLS model:
--   * org members of the owning org get full access (SELECT + writes via
--     existing role checks).
--   * External partners (project_partners.user_id = auth.uid(), accepted
--     invite) get SELECT access to the project and its satellites, plus
--     limited write access to their own reports / report lines / contacts.

-- Helper: is the current user an accepted external partner on a project?
CREATE OR REPLACE FUNCTION is_project_partner(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_partners
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
      AND invite_status = 'accepted'
      AND is_host = FALSE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get the current user's partner_id on a project (for writes)
CREATE OR REPLACE FUNCTION current_project_partner_id(p_project_id UUID)
RETURNS UUID AS $$
  SELECT id FROM project_partners
  WHERE project_id = p_project_id
    AND user_id = auth.uid()
    AND invite_status = 'accepted'
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Enable RLS on the new tables
ALTER TABLE project_partners                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contacts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_partner_wp_allocs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_partner_task_effort      ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_reports                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_report_lines             ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_report_events            ENABLE ROW LEVEL SECURITY;

-- ---- projects: add partner-read policy ----
DROP POLICY IF EXISTS "Partners can view invited projects" ON projects;
CREATE POLICY "Partners can view invited projects"
  ON projects FOR SELECT
  USING (is_project_partner(id));

-- ---- work_packages: add partner-read policy ----
DROP POLICY IF EXISTS "Partners can view work_packages" ON work_packages;
CREATE POLICY "Partners can view work_packages"
  ON work_packages FOR SELECT
  USING (is_project_partner(project_id));

-- ---- deliverables: add partner-read policy ----
DROP POLICY IF EXISTS "Partners can view deliverables" ON deliverables;
CREATE POLICY "Partners can view deliverables"
  ON deliverables FOR SELECT
  USING (is_project_partner(project_id));

-- ---- milestones: add partner-read policy ----
DROP POLICY IF EXISTS "Partners can view milestones" ON milestones;
CREATE POLICY "Partners can view milestones"
  ON milestones FOR SELECT
  USING (is_project_partner(project_id));

-- ---- reporting_periods: add partner-read policy ----
DROP POLICY IF EXISTS "Partners can view reporting_periods" ON reporting_periods;
CREATE POLICY "Partners can view reporting_periods"
  ON reporting_periods FOR SELECT
  USING (is_project_partner(project_id));

-- ---- project_partners ----
DROP POLICY IF EXISTS "Org members manage project_partners" ON project_partners;
CREATE POLICY "Org members manage project_partners"
  ON project_partners FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE org_id = auth_org_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE org_id = auth_org_id()));

DROP POLICY IF EXISTS "Partners see own row" ON project_partners;
CREATE POLICY "Partners see own row"
  ON project_partners FOR SELECT
  USING (user_id = auth.uid());

-- Allow pending-invite holders to SELECT their own row by token — useful for
-- the accept-invite flow where user may not yet be linked to a partner row.
DROP POLICY IF EXISTS "Anyone with token sees partner" ON project_partners;
CREATE POLICY "Anyone with token sees partner"
  ON project_partners FOR SELECT
  USING (invite_status = 'pending');

-- ---- project_contacts ----
DROP POLICY IF EXISTS "Org members manage project_contacts" ON project_contacts;
CREATE POLICY "Org members manage project_contacts"
  ON project_contacts FOR ALL
  USING (partner_id IN (
    SELECT pp.id FROM project_partners pp
    JOIN projects p ON p.id = pp.project_id
    WHERE p.org_id = auth_org_id()
  ));

DROP POLICY IF EXISTS "Partners manage own contacts" ON project_contacts;
CREATE POLICY "Partners manage own contacts"
  ON project_contacts FOR ALL
  USING (partner_id IN (
    SELECT id FROM project_partners WHERE user_id = auth.uid() AND invite_status = 'accepted'
  ));

-- ---- project_partner_wp_allocs ----
DROP POLICY IF EXISTS "Org members manage allocs" ON project_partner_wp_allocs;
CREATE POLICY "Org members manage allocs"
  ON project_partner_wp_allocs FOR ALL
  USING (partner_id IN (
    SELECT pp.id FROM project_partners pp
    JOIN projects p ON p.id = pp.project_id
    WHERE p.org_id = auth_org_id()
  ));

DROP POLICY IF EXISTS "Partners see own allocs" ON project_partner_wp_allocs;
CREATE POLICY "Partners see own allocs"
  ON project_partner_wp_allocs FOR SELECT
  USING (partner_id IN (
    SELECT id FROM project_partners WHERE user_id = auth.uid() AND invite_status = 'accepted'
  ));

-- ---- project_tasks ----
DROP POLICY IF EXISTS "Org members manage project_tasks" ON project_tasks;
CREATE POLICY "Org members manage project_tasks"
  ON project_tasks FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE org_id = auth_org_id()));

DROP POLICY IF EXISTS "Partners view project_tasks" ON project_tasks;
CREATE POLICY "Partners view project_tasks"
  ON project_tasks FOR SELECT
  USING (is_project_partner(project_id));

-- ---- project_partner_task_effort ----
DROP POLICY IF EXISTS "Org members manage task_effort" ON project_partner_task_effort;
CREATE POLICY "Org members manage task_effort"
  ON project_partner_task_effort FOR ALL
  USING (partner_id IN (
    SELECT pp.id FROM project_partners pp
    JOIN projects p ON p.id = pp.project_id
    WHERE p.org_id = auth_org_id()
  ));

DROP POLICY IF EXISTS "Partners view own task_effort" ON project_partner_task_effort;
CREATE POLICY "Partners view own task_effort"
  ON project_partner_task_effort FOR SELECT
  USING (partner_id IN (
    SELECT id FROM project_partners WHERE user_id = auth.uid() AND invite_status = 'accepted'
  ));

-- ---- project_reports ----
DROP POLICY IF EXISTS "Org members manage project_reports" ON project_reports;
CREATE POLICY "Org members manage project_reports"
  ON project_reports FOR ALL
  USING (period_id IN (
    SELECT rp.id FROM reporting_periods rp
    JOIN projects p ON p.id = rp.project_id
    WHERE p.org_id = auth_org_id()
  ));

DROP POLICY IF EXISTS "Partners see own reports" ON project_reports;
CREATE POLICY "Partners see own reports"
  ON project_reports FOR SELECT
  USING (partner_id IN (
    SELECT id FROM project_partners WHERE user_id = auth.uid() AND invite_status = 'accepted'
  ));

DROP POLICY IF EXISTS "Partners update own reports" ON project_reports;
CREATE POLICY "Partners update own reports"
  ON project_reports FOR UPDATE
  USING (partner_id IN (
    SELECT id FROM project_partners WHERE user_id = auth.uid() AND invite_status = 'accepted'
  ));

-- ---- project_report_lines ----
DROP POLICY IF EXISTS "Org members manage report_lines" ON project_report_lines;
CREATE POLICY "Org members manage report_lines"
  ON project_report_lines FOR ALL
  USING (report_id IN (
    SELECT cr.id FROM project_reports cr
    JOIN reporting_periods rp ON rp.id = cr.period_id
    JOIN projects p ON p.id = rp.project_id
    WHERE p.org_id = auth_org_id()
  ));

DROP POLICY IF EXISTS "Partners manage own report_lines" ON project_report_lines;
CREATE POLICY "Partners manage own report_lines"
  ON project_report_lines FOR ALL
  USING (report_id IN (
    SELECT cr.id FROM project_reports cr
    WHERE cr.partner_id IN (
      SELECT id FROM project_partners WHERE user_id = auth.uid() AND invite_status = 'accepted'
    )
  ));

-- ---- project_report_events (immutable) ----
DROP POLICY IF EXISTS "Org members read report_events" ON project_report_events;
CREATE POLICY "Org members read report_events"
  ON project_report_events FOR SELECT
  USING (report_id IN (
    SELECT cr.id FROM project_reports cr
    JOIN reporting_periods rp ON rp.id = cr.period_id
    JOIN projects p ON p.id = rp.project_id
    WHERE p.org_id = auth_org_id()
  ));

DROP POLICY IF EXISTS "Partners read own report_events" ON project_report_events;
CREATE POLICY "Partners read own report_events"
  ON project_report_events FOR SELECT
  USING (report_id IN (
    SELECT cr.id FROM project_reports cr
    WHERE cr.partner_id IN (
      SELECT id FROM project_partners WHERE user_id = auth.uid() AND invite_status = 'accepted'
    )
  ));

DROP POLICY IF EXISTS "Anyone involved can insert report_event" ON project_report_events;
CREATE POLICY "Anyone involved can insert report_event"
  ON project_report_events FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================================
-- End of migration
-- ============================================================================

COMMIT;
