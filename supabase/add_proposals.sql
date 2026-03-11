-- Migration: Add proposals table for tracking grant proposal applications
-- Proposals are pre-project entries that can be converted to projects once granted.

CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  call_identifier TEXT NOT NULL DEFAULT '',
  funding_scheme TEXT NOT NULL DEFAULT '',
  submission_deadline DATE,
  expected_decision DATE,
  our_pms NUMERIC(10,2) NOT NULL DEFAULT 0,
  personnel_budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  travel_budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  subcontracting_budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  other_budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'In Preparation'
    CHECK (status IN ('In Preparation', 'Submitted', 'Rejected', 'Granted')),
  converted_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposals_org ON proposals(org_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);

-- RLS policies
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read proposals" ON proposals;
CREATE POLICY "Org members can read proposals" ON proposals
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Org members can insert proposals" ON proposals;
CREATE POLICY "Org members can insert proposals" ON proposals
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Org members can update proposals" ON proposals;
CREATE POLICY "Org members can update proposals" ON proposals
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Org members can delete proposals" ON proposals;
CREATE POLICY "Org members can delete proposals" ON proposals
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
