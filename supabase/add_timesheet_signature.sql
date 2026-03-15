-- Add e-signature columns to timesheet_entries
-- Supports DocuSign integration for monthly timesheet signing
-- Run this in the Supabase SQL Editor

ALTER TABLE timesheet_entries
  ADD COLUMN IF NOT EXISTS signature_status TEXT CHECK (signature_status IN ('pending', 'sent', 'signed', 'declined', 'voided')),
  ADD COLUMN IF NOT EXISTS signature_envelope_id TEXT,
  ADD COLUMN IF NOT EXISTS signature_url TEXT,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_document_url TEXT;

-- Index for webhook lookups by envelope ID
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_envelope
  ON timesheet_entries(signature_envelope_id)
  WHERE signature_envelope_id IS NOT NULL;
