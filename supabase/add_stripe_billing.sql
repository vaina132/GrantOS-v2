-- Migration: Rename Paddle billing columns to Stripe
-- Run this if you already have paddle_customer_id / paddle_subscription_id columns.
-- If starting fresh, just ensure the organisations table has these columns.

-- Rename paddle columns → stripe columns (safe: does nothing if column doesn't exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organisations' AND column_name = 'paddle_customer_id'
  ) THEN
    ALTER TABLE organisations RENAME COLUMN paddle_customer_id TO stripe_customer_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organisations' AND column_name = 'paddle_subscription_id'
  ) THEN
    ALTER TABLE organisations RENAME COLUMN paddle_subscription_id TO stripe_subscription_id;
  END IF;
END $$;

-- Ensure columns exist (for fresh installs)
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS subscription_status TEXT;

-- Index for fast customer lookups from webhooks
CREATE INDEX IF NOT EXISTS idx_organisations_stripe_customer
  ON organisations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Drop old plan check constraint
ALTER TABLE organisations DROP CONSTRAINT IF EXISTS organisations_plan_check;

-- Migrate legacy plan values BEFORE adding the new constraint
UPDATE organisations
SET plan = 'pro'
WHERE plan IN ('starter', 'growth', 'enterprise');

-- Add new check constraint (trial | pro only)
ALTER TABLE organisations ADD CONSTRAINT organisations_plan_check
  CHECK (plan IN ('trial', 'pro'));
