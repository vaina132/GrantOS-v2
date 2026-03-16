-- ============================================================================
-- Subscription / Paddle Billing Columns
-- Adds Paddle integration fields to the organisations table
-- ============================================================================

-- Add Paddle billing columns (idempotent)
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none';
-- subscription_status: 'none' | 'active' | 'past_due' | 'paused' | 'cancelled'

-- Index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_org_paddle_customer ON organisations(paddle_customer_id) WHERE paddle_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_paddle_subscription ON organisations(paddle_subscription_id) WHERE paddle_subscription_id IS NOT NULL;
