-- Migration: Add project_expenses table for line-item expense tracking
-- Each expense is linked to a project and a budget category.
-- The sum of expenses per category replaces manual "actual" entry in financial_budgets.

CREATE TABLE IF NOT EXISTS project_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('travel', 'subcontracting', 'other', 'indirect')),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL,
  vendor TEXT,
  reference TEXT,
  person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_project_expenses_project ON project_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_project_expenses_org ON project_expenses(org_id);
CREATE INDEX IF NOT EXISTS idx_project_expenses_category ON project_expenses(project_id, category);
CREATE INDEX IF NOT EXISTS idx_project_expenses_date ON project_expenses(expense_date);

-- RLS policies
ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read project_expenses" ON project_expenses;
CREATE POLICY "Members can read project_expenses" ON project_expenses
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can insert project_expenses" ON project_expenses;
CREATE POLICY "Members can insert project_expenses" ON project_expenses
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can update project_expenses" ON project_expenses;
CREATE POLICY "Members can update project_expenses" ON project_expenses
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can delete project_expenses" ON project_expenses;
CREATE POLICY "Members can delete project_expenses" ON project_expenses
  FOR DELETE USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
        AND role IN ('Admin', 'Project Manager', 'Finance Officer')
    )
  );
