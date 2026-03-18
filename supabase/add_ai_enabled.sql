-- Add AI integration toggle to organisations
-- When disabled, all AI features (document parsing, grant agreement import, AI extraction)
-- are hidden from the UI. This is useful for organisations with data privacy/sovereignty
-- concerns that prevent sharing documents with external AI services.
-- Run this in your Supabase SQL Editor.

alter table organisations
  add column if not exists ai_enabled boolean not null default true;
