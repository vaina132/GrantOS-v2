-- ============================================================================
-- Proposal phase tracker — checklist of phases + tasks per proposal
-- ============================================================================
-- Generic template that fits most grant calls. Users can edit any phase/task
-- after it's seeded, and phases/tasks are soft-generic (not gated to a
-- specific funding scheme).
-- ============================================================================

BEGIN;

-- 1. Phases -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proposal_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo','in_progress','done','blocked','skipped')),
  due_date DATE,
  owner_person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proposal_phases_proposal ON proposal_phases(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_phases_org ON proposal_phases(org_id);

-- 2. Tasks --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proposal_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  phase_id UUID NOT NULL REFERENCES proposal_phases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo','in_progress','done','blocked')),
  owner_person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proposal_tasks_proposal ON proposal_tasks(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_tasks_phase ON proposal_tasks(phase_id);

-- 3. updated_at trigger -------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_proposal_phase_tables()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proposal_phases_updated ON proposal_phases;
CREATE TRIGGER trg_proposal_phases_updated
  BEFORE UPDATE ON proposal_phases
  FOR EACH ROW EXECUTE FUNCTION touch_proposal_phase_tables();

DROP TRIGGER IF EXISTS trg_proposal_tasks_updated ON proposal_tasks;
CREATE TRIGGER trg_proposal_tasks_updated
  BEFORE UPDATE ON proposal_tasks
  FOR EACH ROW EXECUTE FUNCTION touch_proposal_phase_tables();

-- 4. RLS ----------------------------------------------------------------------
ALTER TABLE proposal_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_tasks  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read proposal_phases" ON proposal_phases;
CREATE POLICY "Members can read proposal_phases"
  ON proposal_phases FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Members can manage proposal_phases" ON proposal_phases;
CREATE POLICY "Members can manage proposal_phases"
  ON proposal_phases FOR ALL
  USING (org_id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid() AND role IN ('Admin','Project Manager')
  ));

DROP POLICY IF EXISTS "Members can read proposal_tasks" ON proposal_tasks;
CREATE POLICY "Members can read proposal_tasks"
  ON proposal_tasks FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Members can manage proposal_tasks" ON proposal_tasks;
CREATE POLICY "Members can manage proposal_tasks"
  ON proposal_tasks FOR ALL
  USING (org_id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid() AND role IN ('Admin','Project Manager')
  ));

-- 5. Seed existing proposals with the default template ----------------------
-- Only seeds proposals that currently have zero phases.
WITH targets AS (
  SELECT p.id AS proposal_id, p.org_id
  FROM proposals p
  WHERE NOT EXISTS (
    SELECT 1 FROM proposal_phases ph WHERE ph.proposal_id = p.id
  )
),
template(name, description, sort_order) AS (
  VALUES
    ('Concept & outline',
     'Decide on the scope, target call, lead investigators, and the high-level pitch.',
     1),
    ('Partner confirmation',
     'Identify and formally invite the external partners that will be part of the consortium.',
     2),
    ('Part A — Administrative forms',
     'Complete the administrative forms on the Funding & Tenders portal: participants, budgets table, contact info.',
     3),
    ('Part B — Technical proposal',
     'Draft Excellence / Impact / Implementation sections, work packages, Gantt, risk register.',
     4),
    ('Budget collection from partners',
     'Collect effort and cost breakdowns from every partner. Reconcile against the overall call ceiling.',
     5),
    ('Internal review & polish',
     'Peer review, proof-reading, format compliance check, final version locked.',
     6),
    ('Submission',
     'Submit on the F&T portal and archive the submission receipt.',
     7)
)
INSERT INTO proposal_phases (org_id, proposal_id, name, description, sort_order)
SELECT t.org_id, t.proposal_id, tpl.name, tpl.description, tpl.sort_order
FROM targets t
CROSS JOIN template tpl;

COMMIT;
