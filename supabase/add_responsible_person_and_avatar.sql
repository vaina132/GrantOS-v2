-- Migration: Add responsible_person_id to proposals and projects, avatar_url to persons

-- 1. Proposals: responsible person
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS responsible_person_id UUID REFERENCES persons(id) ON DELETE SET NULL;

-- 2. Projects: responsible person (project leader on our side)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS responsible_person_id UUID REFERENCES persons(id) ON DELETE SET NULL;

-- 3. Persons: optional avatar/photo URL
ALTER TABLE persons
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
