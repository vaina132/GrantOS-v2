-- ============================================================================
-- Fix collab_report_events INSERT policy
-- ============================================================================
-- The original INSERT policy was `WITH CHECK (true)` which allows ANY
-- authenticated user to insert events into ANY report. This restricts
-- inserts to host org members and the report's partner only.
-- ============================================================================

DROP POLICY IF EXISTS collab_events_insert ON collab_report_events;

CREATE POLICY collab_events_insert ON collab_report_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM collab_reports cr
      JOIN collab_reporting_periods rp ON rp.id = cr.period_id
      WHERE cr.id = collab_report_events.report_id
        AND (
          is_collab_host_member(rp.project_id)
          OR cr.partner_id IN (
            SELECT id FROM collab_partners
            WHERE user_id = auth.uid() AND invite_status = 'accepted'
          )
        )
    )
  );
