-- Deliverables table
CREATE TABLE IF NOT EXISTS deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_package_id uuid REFERENCES work_packages(id) ON DELETE SET NULL,
  number text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  description text,
  lead_person_id uuid REFERENCES persons(id) ON DELETE SET NULL,
  due_month integer,
  status text NOT NULL DEFAULT 'Not Started',
  submitted_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deliverables_org" ON deliverables
  USING (org_id = auth.uid()::uuid OR org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
  ));

-- Milestones table
CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_package_id uuid REFERENCES work_packages(id) ON DELETE SET NULL,
  number text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  description text,
  due_month integer,
  verification_means text,
  status text NOT NULL DEFAULT 'Not Started',
  achieved_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milestones_org" ON milestones
  USING (org_id = auth.uid()::uuid OR org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
  ));

-- Reporting periods table
CREATE TABLE IF NOT EXISTS reporting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  period_number integer NOT NULL DEFAULT 1,
  start_month integer NOT NULL DEFAULT 1,
  end_month integer NOT NULL DEFAULT 18,
  technical_report_due date,
  financial_report_due date,
  status text NOT NULL DEFAULT 'Upcoming',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reporting_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reporting_periods_org" ON reporting_periods
  USING (org_id = auth.uid()::uuid OR org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
  ));
