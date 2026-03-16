-- ============================================================================
-- AI Usage Tracking & Quota System
-- Tracks token usage per org per calendar month, enforces plan limits
-- ============================================================================

-- 1. Usage tracking table
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  month TEXT NOT NULL,  -- 'YYYY-MM' format for the calendar month
  tokens_in INTEGER NOT NULL DEFAULT 0,    -- input tokens consumed
  tokens_out INTEGER NOT NULL DEFAULT 0,   -- output tokens consumed
  request_count INTEGER NOT NULL DEFAULT 0, -- number of AI requests
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, month)
);

-- 2. Per-request log for auditing (optional but valuable)
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,        -- 'parse-grant', 'parse-collab-grant', 'parse-import'
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. RLS
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Org members can read their own org's usage
CREATE POLICY ai_usage_select ON ai_usage
  FOR SELECT USING (
    org_id IN (SELECT om.org_id FROM org_members om WHERE om.user_id = auth.uid())
  );

-- Only service role can insert/update (server-side only)
-- No INSERT/UPDATE policy for authenticated users

-- Log: org members can read their own org's log
CREATE POLICY ai_usage_log_select ON ai_usage_log
  FOR SELECT USING (
    org_id IN (SELECT om.org_id FROM org_members om WHERE om.user_id = auth.uid())
  );

-- 4. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_usage_org_month ON ai_usage(org_id, month);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_org ON ai_usage_log(org_id, created_at DESC);
