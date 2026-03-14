-- ============================================================================
-- External Project Collaboration Module — Database Schema
-- ============================================================================
-- Creates tables for multi-organisation collaboration on EU-funded projects.
-- Supports: project setup, partner management, work packages, reporting
-- periods, financial reports, line items, audit trail, and multi-contacts.
-- ============================================================================

-- 1. collab_projects — the collaboration project itself
CREATE TABLE IF NOT EXISTS collab_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  acronym TEXT NOT NULL,
  grant_number TEXT,
  funding_programme TEXT,
  funding_scheme TEXT,
  start_date DATE,
  end_date DATE,
  duration_months INTEGER,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  -- Deviation thresholds (coordinator configurable, defaults 20%)
  deviation_personnel_effort NUMERIC(5,2) NOT NULL DEFAULT 20.0,
  deviation_personnel_costs NUMERIC(5,2) NOT NULL DEFAULT 20.0,
  deviation_pm_rate NUMERIC(5,2) NOT NULL DEFAULT 20.0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collab_projects_host_org ON collab_projects(host_org_id);

-- 2. collab_partners — organisations participating in the project
CREATE TABLE IF NOT EXISTS collab_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES collab_projects(id) ON DELETE CASCADE,
  org_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('coordinator', 'partner')),
  participant_number INTEGER,
  contact_name TEXT,
  contact_email TEXT,
  -- Budget allocations from Grant Agreement
  budget_personnel NUMERIC(14,2) DEFAULT 0,
  budget_subcontracting NUMERIC(14,2) DEFAULT 0,
  budget_travel NUMERIC(14,2) DEFAULT 0,
  budget_equipment NUMERIC(14,2) DEFAULT 0,
  budget_other_goods NUMERIC(14,2) DEFAULT 0,
  total_person_months NUMERIC(8,2) DEFAULT 0,
  funding_rate NUMERIC(5,2) DEFAULT 100.0,
  indirect_cost_rate NUMERIC(5,2) DEFAULT 25.0,
  indirect_cost_base TEXT NOT NULL DEFAULT 'all_direct' CHECK (indirect_cost_base IN ('all_direct', 'personnel_only', 'all_except_subcontracting')),
  -- Linking to GrantLume accounts
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_org_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  invite_status TEXT NOT NULL DEFAULT 'pending' CHECK (invite_status IN ('pending', 'accepted', 'declined')),
  invite_token UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collab_partners_project ON collab_partners(project_id);
CREATE INDEX IF NOT EXISTS idx_collab_partners_user ON collab_partners(user_id);
CREATE INDEX IF NOT EXISTS idx_collab_partners_invite_token ON collab_partners(invite_token);

-- 3. collab_work_packages — WP structure for the project
CREATE TABLE IF NOT EXISTS collab_work_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES collab_projects(id) ON DELETE CASCADE,
  wp_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  total_person_months NUMERIC(8,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collab_wps_project ON collab_work_packages(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_collab_wps_unique ON collab_work_packages(project_id, wp_number);

-- 4. collab_partner_wp_allocs — PM allocation per partner per WP
CREATE TABLE IF NOT EXISTS collab_partner_wp_allocs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES collab_partners(id) ON DELETE CASCADE,
  wp_id UUID NOT NULL REFERENCES collab_work_packages(id) ON DELETE CASCADE,
  person_months NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collab_pwp_partner ON collab_partner_wp_allocs(partner_id);
CREATE INDEX IF NOT EXISTS idx_collab_pwp_wp ON collab_partner_wp_allocs(wp_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_collab_pwp_unique ON collab_partner_wp_allocs(partner_id, wp_id);

-- 5. collab_contacts — multiple contacts per partner for notifications
CREATE TABLE IF NOT EXISTS collab_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES collab_partners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role_note TEXT,
  notify_reminders BOOLEAN NOT NULL DEFAULT true,
  notify_approvals BOOLEAN NOT NULL DEFAULT true,
  notify_rejections BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collab_contacts_partner ON collab_contacts(partner_id);

-- 6. collab_reporting_periods — formal and informal reporting periods
CREATE TABLE IF NOT EXISTS collab_reporting_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES collab_projects(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('formal', 'informal')),
  title TEXT NOT NULL,
  start_month INTEGER NOT NULL,
  end_month INTEGER NOT NULL,
  due_date DATE,
  reports_generated BOOLEAN NOT NULL DEFAULT false,
  beneficiaries_notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collab_periods_project ON collab_reporting_periods(project_id);

-- 7. collab_reports — one per partner per informal period
CREATE TABLE IF NOT EXISTS collab_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES collab_reporting_periods(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES collab_partners(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collab_reports_period ON collab_reports(period_id);
CREATE INDEX IF NOT EXISTS idx_collab_reports_partner ON collab_reports(partner_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_collab_reports_unique ON collab_reports(period_id, partner_id);

-- 8. collab_report_lines — line items within each report section
CREATE TABLE IF NOT EXISTS collab_report_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES collab_reports(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN (
    'personnel_effort', 'personnel_costs',
    'subcontracting', 'travel', 'equipment', 'other_goods'
  )),
  wp_id UUID REFERENCES collab_work_packages(id) ON DELETE SET NULL,
  line_order INTEGER NOT NULL DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}',
  justification TEXT,
  justification_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collab_lines_report ON collab_report_lines(report_id);
CREATE INDEX IF NOT EXISTS idx_collab_lines_section ON collab_report_lines(report_id, section);

-- 9. collab_report_events — immutable audit trail per report
CREATE TABLE IF NOT EXISTS collab_report_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES collab_reports(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'generated', 'saved', 'submitted', 'approved', 'rejected',
    'resubmitted', 'notified', 'comment'
  )),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_role TEXT CHECK (actor_role IN ('coordinator', 'partner', 'system')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collab_events_report ON collab_report_events(report_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE collab_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_work_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_partner_wp_allocs ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_reporting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_report_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_report_events ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is a member of the host org for a project
CREATE OR REPLACE FUNCTION is_collab_host_member(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members om
    JOIN collab_projects cp ON cp.host_org_id = om.org_id
    WHERE cp.id = p_project_id AND om.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if user is a linked partner on a project
CREATE OR REPLACE FUNCTION is_collab_partner(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM collab_partners
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
      AND invite_status = 'accepted'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get the partner_id for the current user on a project
CREATE OR REPLACE FUNCTION get_collab_partner_id(p_project_id UUID)
RETURNS UUID AS $$
  SELECT id FROM collab_partners
  WHERE project_id = p_project_id
    AND user_id = auth.uid()
    AND invite_status = 'accepted'
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- === collab_projects ===
-- Host org members: full access
CREATE POLICY collab_projects_host_select ON collab_projects
  FOR SELECT USING (is_collab_host_member(id));
CREATE POLICY collab_projects_host_insert ON collab_projects
  FOR INSERT WITH CHECK (host_org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
CREATE POLICY collab_projects_host_update ON collab_projects
  FOR UPDATE USING (is_collab_host_member(id));
CREATE POLICY collab_projects_host_delete ON collab_projects
  FOR DELETE USING (is_collab_host_member(id));
-- External partners: read-only on projects they're part of
CREATE POLICY collab_projects_partner_select ON collab_projects
  FOR SELECT USING (is_collab_partner(id));

-- === collab_partners ===
CREATE POLICY collab_partners_host_all ON collab_partners
  FOR ALL USING (is_collab_host_member(project_id));
CREATE POLICY collab_partners_self_select ON collab_partners
  FOR SELECT USING (user_id = auth.uid());

-- === collab_work_packages ===
CREATE POLICY collab_wps_host_all ON collab_work_packages
  FOR ALL USING (is_collab_host_member(project_id));
CREATE POLICY collab_wps_partner_select ON collab_work_packages
  FOR SELECT USING (is_collab_partner(project_id));

-- === collab_partner_wp_allocs ===
CREATE POLICY collab_pwp_host_all ON collab_partner_wp_allocs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM collab_partners cp
      WHERE cp.id = collab_partner_wp_allocs.partner_id
        AND is_collab_host_member(cp.project_id)
    )
  );
CREATE POLICY collab_pwp_partner_select ON collab_partner_wp_allocs
  FOR SELECT USING (
    partner_id IN (
      SELECT id FROM collab_partners WHERE user_id = auth.uid() AND invite_status = 'accepted'
    )
  );

-- === collab_contacts ===
CREATE POLICY collab_contacts_host_all ON collab_contacts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM collab_partners cp
      WHERE cp.id = collab_contacts.partner_id
        AND is_collab_host_member(cp.project_id)
    )
  );
CREATE POLICY collab_contacts_partner_manage ON collab_contacts
  FOR ALL USING (
    partner_id IN (
      SELECT id FROM collab_partners WHERE user_id = auth.uid() AND invite_status = 'accepted'
    )
  );

-- === collab_reporting_periods ===
CREATE POLICY collab_periods_host_all ON collab_reporting_periods
  FOR ALL USING (is_collab_host_member(project_id));
CREATE POLICY collab_periods_partner_select ON collab_reporting_periods
  FOR SELECT USING (is_collab_partner(project_id));

-- === collab_reports ===
-- Host org: full access
CREATE POLICY collab_reports_host_all ON collab_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM collab_reporting_periods rp
      WHERE rp.id = collab_reports.period_id
        AND is_collab_host_member(rp.project_id)
    )
  );
-- Partners: read/update own reports only
CREATE POLICY collab_reports_partner_select ON collab_reports
  FOR SELECT USING (
    partner_id IN (
      SELECT id FROM collab_partners WHERE user_id = auth.uid() AND invite_status = 'accepted'
    )
  );
CREATE POLICY collab_reports_partner_update ON collab_reports
  FOR UPDATE USING (
    partner_id IN (
      SELECT id FROM collab_partners WHERE user_id = auth.uid() AND invite_status = 'accepted'
    )
  );

-- === collab_report_lines ===
CREATE POLICY collab_lines_host_all ON collab_report_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM collab_reports cr
      JOIN collab_reporting_periods rp ON rp.id = cr.period_id
      WHERE cr.id = collab_report_lines.report_id
        AND is_collab_host_member(rp.project_id)
    )
  );
CREATE POLICY collab_lines_partner_all ON collab_report_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM collab_reports cr
      WHERE cr.id = collab_report_lines.report_id
        AND cr.partner_id IN (
          SELECT id FROM collab_partners WHERE user_id = auth.uid() AND invite_status = 'accepted'
        )
    )
  );

-- === collab_report_events ===
-- Everyone involved can read events; only insert allowed (immutable)
CREATE POLICY collab_events_host_select ON collab_report_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM collab_reports cr
      JOIN collab_reporting_periods rp ON rp.id = cr.period_id
      WHERE cr.id = collab_report_events.report_id
        AND is_collab_host_member(rp.project_id)
    )
  );
CREATE POLICY collab_events_partner_select ON collab_report_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM collab_reports cr
      WHERE cr.id = collab_report_events.report_id
        AND cr.partner_id IN (
          SELECT id FROM collab_partners WHERE user_id = auth.uid() AND invite_status = 'accepted'
        )
    )
  );
CREATE POLICY collab_events_insert ON collab_report_events
  FOR INSERT WITH CHECK (true);
-- No UPDATE or DELETE policies — events are immutable

-- ============================================================================
-- Updated-at triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION update_collab_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_collab_projects_updated
  BEFORE UPDATE ON collab_projects
  FOR EACH ROW EXECUTE FUNCTION update_collab_updated_at();

CREATE TRIGGER trg_collab_partners_updated
  BEFORE UPDATE ON collab_partners
  FOR EACH ROW EXECUTE FUNCTION update_collab_updated_at();

CREATE TRIGGER trg_collab_periods_updated
  BEFORE UPDATE ON collab_reporting_periods
  FOR EACH ROW EXECUTE FUNCTION update_collab_updated_at();

CREATE TRIGGER trg_collab_reports_updated
  BEFORE UPDATE ON collab_reports
  FOR EACH ROW EXECUTE FUNCTION update_collab_updated_at();

CREATE TRIGGER trg_collab_lines_updated
  BEFORE UPDATE ON collab_report_lines
  FOR EACH ROW EXECUTE FUNCTION update_collab_updated_at();
