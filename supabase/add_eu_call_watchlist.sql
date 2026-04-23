-- ============================================================================
-- EU Funding & Tenders call watchlist
-- ============================================================================
-- Stores the topic identifiers that a given org has starred. We do not cache
-- the full topic data server-side — the /api/ai?action=eu-calls endpoint
-- proxies the F&T portal directly on demand.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS eu_call_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  topic_identifier TEXT NOT NULL,
  title TEXT,
  programme TEXT,
  call_identifier TEXT,
  deadline_date DATE,
  status TEXT,
  notes TEXT,
  starred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  starred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, topic_identifier)
);

CREATE INDEX IF NOT EXISTS idx_eu_call_watchlist_org ON eu_call_watchlist(org_id);
CREATE INDEX IF NOT EXISTS idx_eu_call_watchlist_deadline ON eu_call_watchlist(deadline_date);

ALTER TABLE eu_call_watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read watchlist" ON eu_call_watchlist;
CREATE POLICY "Members read watchlist"
  ON eu_call_watchlist FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Managers manage watchlist" ON eu_call_watchlist;
CREATE POLICY "Managers manage watchlist"
  ON eu_call_watchlist FOR ALL
  USING (org_id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid() AND role IN ('Admin','Project Manager')
  ));

COMMIT;
