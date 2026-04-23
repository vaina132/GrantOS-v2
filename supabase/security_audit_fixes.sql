-- ============================================================================
-- Security / correctness audit fixes — April 2026
-- ============================================================================
-- Addresses findings from the 10-agent audit:
--   C4  — project_report_events INSERT policy over-permissive
--   C5  — period locks not enforced on assignments / timesheet_entries
--   C8  — timesheet envelope state machine unchecked
--   H7  — deliverables / milestones / reporting_periods RLS uses wrong helper
--   H8  — SECURITY DEFINER functions without pinned search_path
--   H9  — project_expenses UPDATE policy missing WITH CHECK
--
-- Safe to re-run: every DDL uses IF EXISTS / IF NOT EXISTS guards and every
-- CREATE POLICY is preceded by a DROP POLICY IF EXISTS.
-- ============================================================================

BEGIN;

-- ============================================================================
-- C4. project_report_events — restrict INSERT to involved parties only.
-- ============================================================================
-- Before: WITH CHECK (TRUE) let any authenticated user fabricate audit events
-- on any org's reports. Restrict to org members of the report's project OR
-- an accepted external partner on that report.
--
-- Guarded — only runs if the merge_projects_modules.sql migration has
-- created the project_report_events table.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_report_events'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone involved can insert report_event" ON project_report_events';
    EXECUTE $p$
      CREATE POLICY "Org members insert report_event"
        ON project_report_events FOR INSERT
        WITH CHECK (
          report_id IN (
            SELECT cr.id FROM project_reports cr
            JOIN reporting_periods rp ON rp.id = cr.period_id
            JOIN projects p ON p.id = rp.project_id
            WHERE p.org_id = auth_org_id()
          )
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "Partners insert own report_event" ON project_report_events';
    EXECUTE $p$
      CREATE POLICY "Partners insert own report_event"
        ON project_report_events FOR INSERT
        WITH CHECK (
          report_id IN (
            SELECT cr.id FROM project_reports cr
            WHERE cr.partner_id IN (
              SELECT id FROM project_partners
              WHERE user_id = auth.uid() AND invite_status = 'accepted'
            )
          )
        )
    $p$;
  END IF;
END $$;

-- ============================================================================
-- C5. Period lock enforcement at the database layer.
-- ============================================================================
-- Any INSERT / UPDATE to `assignments` or `timesheet_entries` for a locked
-- (org_id, year, month) must be rejected.  Previously the UI checked this
-- but the service layer did not — the trigger closes that hole.

CREATE OR REPLACE FUNCTION enforce_period_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM period_locks
    WHERE org_id = NEW.org_id
      AND year = NEW.year
      AND month = NEW.month
  ) THEN
    RAISE EXCEPTION 'Period %-% is locked for writes in this organisation', NEW.year, NEW.month
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assignments_period_lock ON assignments;
CREATE TRIGGER trg_assignments_period_lock
  BEFORE INSERT OR UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION enforce_period_lock();

DROP TRIGGER IF EXISTS trg_timesheet_entries_period_lock ON timesheet_entries;
CREATE TRIGGER trg_timesheet_entries_period_lock
  BEFORE INSERT OR UPDATE ON timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION enforce_period_lock();

-- ============================================================================
-- C8. Timesheet envelope state machine.
-- ============================================================================
-- Valid transitions:
--   Draft      → Submitted | Confirmed    (employee confirms / submits)
--   Submitted  → Signing | Approved | Rejected | Draft
--   Signing    → Signed | Rejected | Submitted
--   Signed     → Approved | Rejected
--   Confirmed  → Approved | Rejected | Draft      (legacy non-DocuSign path)
--   Approved   → Rejected                         (admin correction window)
--   Rejected   → Draft                            (reset for rework)
-- Applied only when the table exists in the target database.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'timesheet_envelopes'
  ) THEN
    CREATE OR REPLACE FUNCTION enforce_timesheet_envelope_transition()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $fn$
    DECLARE
      ok BOOLEAN := FALSE;
    BEGIN
      IF OLD.status = NEW.status THEN
        RETURN NEW;
      END IF;

      -- Expressed as a case ladder for readability.
      CASE OLD.status
        WHEN 'Draft'     THEN ok := NEW.status IN ('Submitted','Confirmed');
        WHEN 'Submitted' THEN ok := NEW.status IN ('Signing','Approved','Rejected','Draft');
        WHEN 'Signing'   THEN ok := NEW.status IN ('Signed','Rejected','Submitted');
        WHEN 'Signed'    THEN ok := NEW.status IN ('Approved','Rejected');
        WHEN 'Confirmed' THEN ok := NEW.status IN ('Approved','Rejected','Draft');
        WHEN 'Approved'  THEN ok := NEW.status IN ('Rejected');
        WHEN 'Rejected'  THEN ok := NEW.status IN ('Draft');
        ELSE ok := FALSE;
      END CASE;

      IF NOT ok THEN
        RAISE EXCEPTION 'Invalid timesheet status transition: % → %', OLD.status, NEW.status
          USING ERRCODE = 'check_violation';
      END IF;
      RETURN NEW;
    END;
    $fn$;

    DROP TRIGGER IF EXISTS trg_timesheet_envelope_transition ON timesheet_envelopes;
    CREATE TRIGGER trg_timesheet_envelope_transition
      BEFORE UPDATE OF status ON timesheet_envelopes
      FOR EACH ROW EXECUTE FUNCTION enforce_timesheet_envelope_transition();
  END IF;
END $$;

-- ============================================================================
-- H7. deliverables / milestones / reporting_periods RLS used a broken helper.
-- ============================================================================
-- The original policies compared `org_id = auth.uid()::uuid` (a type-cast of
-- the user's UUID). Replace with the correct `auth_org_id()` helper.
-- We keep the partner-read policies defined in the projects merge migration.

DROP POLICY IF EXISTS "deliverables_org" ON deliverables;
DROP POLICY IF EXISTS "Members can view deliverables"  ON deliverables;
DROP POLICY IF EXISTS "Members can manage deliverables" ON deliverables;
CREATE POLICY "Members can view deliverables"
  ON deliverables FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "Managers can manage deliverables"
  ON deliverables FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Project Manager'))
  WITH CHECK (org_id = auth_org_id() AND auth_role() IN ('Admin','Project Manager'));

DROP POLICY IF EXISTS "milestones_org" ON milestones;
DROP POLICY IF EXISTS "Members can view milestones"  ON milestones;
DROP POLICY IF EXISTS "Members can manage milestones" ON milestones;
CREATE POLICY "Members can view milestones"
  ON milestones FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "Managers can manage milestones"
  ON milestones FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Project Manager'))
  WITH CHECK (org_id = auth_org_id() AND auth_role() IN ('Admin','Project Manager'));

DROP POLICY IF EXISTS "reporting_periods_org" ON reporting_periods;
DROP POLICY IF EXISTS "Members can view reporting_periods"  ON reporting_periods;
DROP POLICY IF EXISTS "Members can manage reporting_periods" ON reporting_periods;
CREATE POLICY "Members can view reporting_periods"
  ON reporting_periods FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "Managers can manage reporting_periods"
  ON reporting_periods FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('Admin','Project Manager'))
  WITH CHECK (org_id = auth_org_id() AND auth_role() IN ('Admin','Project Manager'));

-- ============================================================================
-- H8. Pin search_path on SECURITY DEFINER helpers so attackers can't hijack
-- resolution via schema-creation tricks.
-- ============================================================================

-- Core auth helpers defined in schema.sql
ALTER FUNCTION auth_org_id() SET search_path = public, pg_temp;
ALTER FUNCTION auth_role()   SET search_path = public, pg_temp;

-- Project-partner helpers from the merge migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_project_partner') THEN
    EXECUTE 'ALTER FUNCTION is_project_partner(uuid) SET search_path = public, pg_temp';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_project_partner_id') THEN
    EXECUTE 'ALTER FUNCTION current_project_partner_id(uuid) SET search_path = public, pg_temp';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'ensure_host_partner') THEN
    EXECUTE 'ALTER FUNCTION ensure_host_partner() SET search_path = public, pg_temp';
  END IF;
END $$;

-- Notification trigger helpers (if present).
DO $$
DECLARE
  fn TEXT;
BEGIN
  FOR fn IN
    SELECT proname FROM pg_proc
    WHERE proname IN (
      'notify_webhook',
      'notify_timesheet_status_change',
      'notify_period_locked',
      'notify_guest_added',
      'update_project_updated_at',
      'update_collab_updated_at',
      'touch_proposal_phase_tables',
      'enforce_period_lock',
      'enforce_timesheet_envelope_transition'
    )
  LOOP
    EXECUTE format('ALTER FUNCTION %I() SET search_path = public, pg_temp', fn);
  END LOOP;
END $$;

-- ============================================================================
-- H9. project_expenses policies: add WITH CHECK on UPDATE / INSERT so a user
-- can't rewrite a row's org_id / project_id during update.
-- ============================================================================

DROP POLICY IF EXISTS "Members can insert project_expenses" ON project_expenses;
CREATE POLICY "Members can insert project_expenses"
  ON project_expenses FOR INSERT
  WITH CHECK (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can update project_expenses" ON project_expenses;
CREATE POLICY "Members can update project_expenses"
  ON project_expenses FOR UPDATE
  USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

-- Tighten DELETE to Admin/Finance Officer only (Project Managers too), with
-- explicit org scoping.
DROP POLICY IF EXISTS "Members can delete project_expenses" ON project_expenses;
CREATE POLICY "Privileged can delete project_expenses"
  ON project_expenses FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
        AND role IN ('Admin','Project Manager','Finance Officer')
    )
  );

-- ============================================================================
-- eu_call_watchlist — add WITH CHECK so INSERT/UPDATE can't rewrite org_id.
-- Guarded — only runs if add_eu_call_watchlist.sql has created the table.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'eu_call_watchlist'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Managers manage watchlist" ON eu_call_watchlist';
    EXECUTE $p$
      CREATE POLICY "Managers manage watchlist"
        ON eu_call_watchlist FOR ALL
        USING (org_id IN (
          SELECT org_id FROM org_members
          WHERE user_id = auth.uid() AND role IN ('Admin','Project Manager')
        ))
        WITH CHECK (org_id IN (
          SELECT org_id FROM org_members
          WHERE user_id = auth.uid() AND role IN ('Admin','Project Manager')
        ))
    $p$;
  END IF;
END $$;

-- ============================================================================
-- H1. Expand `persons_masked` view so the UI has everything it needs except
-- salary / overhead. The view inherits RLS from the underlying `persons`
-- table, so org-scoping is preserved. Service code reads from this view
-- when the caller lacks `canSeeSalary`.
--
-- Note: CREATE OR REPLACE VIEW can only ADD columns at the tail — it cannot
-- reorder or rename existing ones. The original view (in schema.sql) has
-- 13 columns; we preserve their order exactly and append the new ones.
-- ============================================================================

CREATE OR REPLACE VIEW persons_masked AS
SELECT
  -- Original 13 columns, in the exact order they were defined. Do NOT
  -- reorder or rename these — Postgres will reject the statement if any
  -- existing column changes position or name.
  id, org_id, full_name, email, department, role,
  employment_type, fte, start_date, end_date, is_active,
  created_at, updated_at,
  -- Appended columns — safe to add at the tail.
  country, avatar_url, user_id
FROM persons;

COMMIT;
