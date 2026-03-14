-- ============================================================================
-- Enhance Collaboration Module — Additional Schema
-- ============================================================================
-- Adds: org_type on partners, start/end months + leader on WPs,
-- tasks, deliverables, milestones tables.
-- ============================================================================

-- 1. Add org_type to collab_partners
ALTER TABLE collab_partners
  ADD COLUMN IF NOT EXISTS org_type TEXT;

-- 2. Add start/end month and leader to collab_work_packages
ALTER TABLE collab_work_packages
  ADD COLUMN IF NOT EXISTS start_month INTEGER,
  ADD COLUMN IF NOT EXISTS end_month INTEGER,
  ADD COLUMN IF NOT EXISTS leader_partner_id UUID REFERENCES collab_partners(id) ON DELETE SET NULL;

-- 3. collab_tasks — tasks under work packages
CREATE TABLE IF NOT EXISTS collab_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wp_id UUID NOT NULL REFERENCES collab_work_packages(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES collab_projects(id) ON DELETE CASCADE,
  task_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_month INTEGER,
  end_month INTEGER,
  leader_partner_id UUID REFERENCES collab_partners(id) ON DELETE SET NULL,
  person_months NUMERIC(8,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collab_tasks_wp ON collab_tasks(wp_id);
CREATE INDEX IF NOT EXISTS idx_collab_tasks_project ON collab_tasks(project_id);

-- 4. collab_deliverables — project deliverables
CREATE TABLE IF NOT EXISTS collab_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES collab_projects(id) ON DELETE CASCADE,
  wp_id UUID REFERENCES collab_work_packages(id) ON DELETE SET NULL,
  number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('report', 'data', 'software', 'demonstrator', 'other')),
  dissemination TEXT CHECK (dissemination IN ('public', 'confidential', 'classified')),
  due_month INTEGER NOT NULL,
  leader_partner_id UUID REFERENCES collab_partners(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collab_deliverables_project ON collab_deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_collab_deliverables_wp ON collab_deliverables(wp_id);

-- 5. collab_milestones — project milestones
CREATE TABLE IF NOT EXISTS collab_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES collab_projects(id) ON DELETE CASCADE,
  wp_id UUID REFERENCES collab_work_packages(id) ON DELETE SET NULL,
  number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_month INTEGER NOT NULL,
  verification_means TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collab_milestones_project ON collab_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_collab_milestones_wp ON collab_milestones(wp_id);

-- 6. RLS policies for new tables
ALTER TABLE collab_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_milestones ENABLE ROW LEVEL SECURITY;

-- collab_tasks RLS
DROP POLICY IF EXISTS collab_tasks_host_read ON collab_tasks;
CREATE POLICY collab_tasks_host_read ON collab_tasks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM collab_projects cp
    JOIN org_members om ON om.org_id = cp.host_org_id AND om.user_id = auth.uid()
    WHERE cp.id = collab_tasks.project_id
  ));

DROP POLICY IF EXISTS collab_tasks_host_write ON collab_tasks;
CREATE POLICY collab_tasks_host_write ON collab_tasks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM collab_projects cp
    JOIN org_members om ON om.org_id = cp.host_org_id AND om.user_id = auth.uid()
    WHERE cp.id = collab_tasks.project_id
  ));

-- collab_deliverables RLS
DROP POLICY IF EXISTS collab_deliverables_host_read ON collab_deliverables;
CREATE POLICY collab_deliverables_host_read ON collab_deliverables FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM collab_projects cp
    JOIN org_members om ON om.org_id = cp.host_org_id AND om.user_id = auth.uid()
    WHERE cp.id = collab_deliverables.project_id
  ));

DROP POLICY IF EXISTS collab_deliverables_host_write ON collab_deliverables;
CREATE POLICY collab_deliverables_host_write ON collab_deliverables FOR ALL
  USING (EXISTS (
    SELECT 1 FROM collab_projects cp
    JOIN org_members om ON om.org_id = cp.host_org_id AND om.user_id = auth.uid()
    WHERE cp.id = collab_deliverables.project_id
  ));

-- collab_milestones RLS
DROP POLICY IF EXISTS collab_milestones_host_read ON collab_milestones;
CREATE POLICY collab_milestones_host_read ON collab_milestones FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM collab_projects cp
    JOIN org_members om ON om.org_id = cp.host_org_id AND om.user_id = auth.uid()
    WHERE cp.id = collab_milestones.project_id
  ));

DROP POLICY IF EXISTS collab_milestones_host_write ON collab_milestones;
CREATE POLICY collab_milestones_host_write ON collab_milestones FOR ALL
  USING (EXISTS (
    SELECT 1 FROM collab_projects cp
    JOIN org_members om ON om.org_id = cp.host_org_id AND om.user_id = auth.uid()
    WHERE cp.id = collab_milestones.project_id
  ));
