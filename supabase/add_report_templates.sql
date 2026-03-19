-- Migration: Add report_templates table for the Report Builder module
-- Allows users to create, save, and share custom report configurations

CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  data_source TEXT NOT NULL,           -- 'projects' | 'staff' | 'effort' | 'timesheets' | 'financials' | 'absences' | 'travel' | 'proposals' | 'project_health' | 'expenses'
  config JSONB NOT NULL DEFAULT '{}',  -- { columns, filters, group_by, sort_by, chart_type }
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_by_name TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast org lookups
CREATE INDEX IF NOT EXISTS idx_report_templates_org ON report_templates(org_id);

-- Index for finding user's own reports
CREATE INDEX IF NOT EXISTS idx_report_templates_created_by ON report_templates(created_by);

-- RLS
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;

-- Members can see their own reports + shared reports in their org
CREATE POLICY report_templates_select ON report_templates
  FOR SELECT USING (
    org_id = auth_org_id()
    AND (created_by = auth.uid() OR is_shared = TRUE)
  );

-- Members can insert their own reports
CREATE POLICY report_templates_insert ON report_templates
  FOR INSERT WITH CHECK (
    org_id = auth_org_id()
    AND created_by = auth.uid()
  );

-- Only the creator (or admin) can update
CREATE POLICY report_templates_update ON report_templates
  FOR UPDATE USING (
    org_id = auth_org_id()
    AND (created_by = auth.uid() OR auth_role() = 'Admin')
  );

-- Only the creator (or admin) can delete
CREATE POLICY report_templates_delete ON report_templates
  FOR DELETE USING (
    org_id = auth_org_id()
    AND (created_by = auth.uid() OR auth_role() = 'Admin')
  );
