-- GrantOS v2 — Email Notification Triggers
-- Uses Supabase's built-in pg_net extension to call Edge Functions
-- or can be adapted to use any webhook endpoint.
--
-- Run this in Supabase SQL Editor after deploying the Edge Function.
-- Replace YOUR_EDGE_FUNCTION_URL with the actual deployed URL.

-- ============================================================
-- 1. Enable pg_net for HTTP requests from Postgres
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- 2. Notification helper: sends a webhook when triggered
-- ============================================================
CREATE OR REPLACE FUNCTION notify_webhook()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  webhook_url TEXT := current_setting('app.settings.notification_webhook_url', true);
BEGIN
  IF webhook_url IS NULL OR webhook_url = '' THEN
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'event', TG_ARGV[0],
    'table', TG_TABLE_NAME,
    'record', to_jsonb(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    'timestamp', now()
  );

  PERFORM net.http_post(
    url := webhook_url,
    body := payload::TEXT,
    headers := jsonb_build_object('Content-Type', 'application/json')
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. Timesheet status change notifications
-- ============================================================
CREATE OR REPLACE FUNCTION notify_timesheet_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when status actually changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Insert a notification record (lightweight, app polls or uses realtime)
    INSERT INTO audit_logs (org_id, user_id, entity_type, action, entity_id, details)
    VALUES (
      NEW.org_id,
      NEW.confirmed_by,
      'timesheet',
      'status_change',
      NEW.id::TEXT,
      format('Timesheet status changed from %s to %s for person %s, %s/%s',
        OLD.status, NEW.status, NEW.person_id, NEW.year, NEW.month)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_timesheet_status_change ON timesheet_entries;
CREATE TRIGGER trg_timesheet_status_change
  AFTER UPDATE ON timesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION notify_timesheet_status_change();

-- ============================================================
-- 4. Period lock notifications
-- ============================================================
CREATE OR REPLACE FUNCTION notify_period_locked()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (org_id, user_id, entity_type, action, entity_id, details)
  VALUES (
    NEW.org_id,
    NEW.locked_by,
    'period_lock',
    'locked',
    NEW.id::TEXT,
    format('Period locked: %s/%s', NEW.year, NEW.month)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_period_locked ON period_locks;
CREATE TRIGGER trg_period_locked
  AFTER INSERT ON period_locks
  FOR EACH ROW
  EXECUTE FUNCTION notify_period_locked();

-- ============================================================
-- 5. Guest access granted notification
-- ============================================================
CREATE OR REPLACE FUNCTION notify_guest_added()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (org_id, user_id, entity_type, action, entity_id, details)
  VALUES (
    NEW.org_id,
    NEW.invited_by,
    'guest_access',
    'granted',
    NEW.id::TEXT,
    format('Guest %s granted %s access to project %s', NEW.user_id, NEW.access_level, NEW.project_id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_guest_added ON project_guests;
CREATE TRIGGER trg_guest_added
  AFTER INSERT ON project_guests
  FOR EACH ROW
  EXECUTE FUNCTION notify_guest_added();
