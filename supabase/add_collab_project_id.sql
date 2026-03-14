-- Add collab_project_id column to projects table
-- Links a "My Projects" entry back to its source collaboration project
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS collab_project_id UUID REFERENCES collab_projects(id) ON DELETE SET NULL;

-- Index for fast lookup when syncing
CREATE INDEX IF NOT EXISTS idx_projects_collab_project_id ON projects(collab_project_id);
