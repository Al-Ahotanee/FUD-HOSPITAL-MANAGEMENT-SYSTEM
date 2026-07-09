-- ============================================================================
-- MIGRATION: Mock Payment Workflow (unpaid -> processing -> paid)
-- Run this ONLY if your database already has data from the previous schema
-- version. If you're setting up fresh, just run schema.sql instead — this
-- file is redundant (and harmless) in that case.
--
-- Usage:
--   psql "postgresql://<user>:<password>@<neon-host>/<db>?sslmode=require" -f migration_mock_payments.sql
-- ============================================================================

-- 1. Widen the status column and add the new payment-tracking columns
ALTER TABLE billing_invoices
  ALTER COLUMN status TYPE VARCHAR(15);

ALTER TABLE billing_invoices
  ADD COLUMN IF NOT EXISTS payment_method    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(60),
  ADD COLUMN IF NOT EXISTS initiated_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by      INTEGER REFERENCES users(id);

-- 2. Replace the old 2-state CHECK constraint with the new 3-state one.
--    (Constraint name may differ if you renamed it; adjust if this fails.)
ALTER TABLE billing_invoices
  DROP CONSTRAINT IF EXISTS billing_invoices_status_check;

ALTER TABLE billing_invoices
  ADD CONSTRAINT billing_invoices_status_check
  CHECK (status IN ('unpaid', 'processing', 'paid'));

-- 3. Backfill payment_method for existing paid invoices so historical
--    records aren't left blank (assumes prior payments were in-person/cash).
UPDATE billing_invoices
SET payment_method = 'cash'
WHERE status = 'paid' AND payment_method IS NULL;

-- ============================================================================
-- MIGRATION: Patient Portal Linking
-- Only needed if your `patients` table predates the linked_user_id column.
-- ============================================================================
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS linked_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- Verify: nothing else changes shape — vitals.nurse_id and
-- immunizations.nurse_id keep their existing names/values. The Nurse role
-- is unaffected by this migration; Receptionist accounts were already
-- authorized for these actions at the API layer as of this update.
-- ============================================================================
