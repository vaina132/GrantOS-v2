-- Migration: Per-partner-per-task effort allocation
-- Replaces the single person_months column on collab_tasks with a proper
-- many-to-many allocation table: each partner can have PMs allocated to each task.

-- 1. New table: collab_partner_task_effort
CREATE TABLE IF NOT EXISTS collab_partner_task_effort (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES collab_tasks(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES collab_partners(id) ON DELETE CASCADE,
  person_months NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, partner_id)
);

CREATE INDEX IF NOT EXISTS idx_collab_pte_task ON collab_partner_task_effort(task_id);
CREATE INDEX IF NOT EXISTS idx_collab_pte_partner ON collab_partner_task_effort(partner_id);

-- 2. RLS
ALTER TABLE collab_partner_task_effort ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS collab_pte_host_read ON collab_partner_task_effort;
CREATE POLICY collab_pte_host_read ON collab_partner_task_effort FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM collab_tasks ct
    JOIN collab_projects cp ON cp.id = ct.project_id
    JOIN org_members om ON om.org_id = cp.host_org_id AND om.user_id = auth.uid()
    WHERE ct.id = collab_partner_task_effort.task_id
  ));

DROP POLICY IF EXISTS collab_pte_host_write ON collab_partner_task_effort;
CREATE POLICY collab_pte_host_write ON collab_partner_task_effort FOR ALL
  USING (EXISTS (
    SELECT 1 FROM collab_tasks ct
    JOIN collab_projects cp ON cp.id = ct.project_id
    JOIN org_members om ON om.org_id = cp.host_org_id AND om.user_id = auth.uid()
    WHERE ct.id = collab_partner_task_effort.task_id
  ));

-- 3. Add is_host flag to collab_partners to identify the host org's own partner record
ALTER TABLE collab_partners ADD COLUMN IF NOT EXISTS is_host BOOLEAN NOT NULL DEFAULT false;
