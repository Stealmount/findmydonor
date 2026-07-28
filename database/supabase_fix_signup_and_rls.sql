-- ============================================================
-- Migration #9: Fix signup + blood_requests RLS
-- Date: 2026-07-26
-- ============================================================
--
-- FIX 1 — Restore Signup
-- A dashboard-created `role` column and `profiles_has_role` CHECK
-- constraint block every profiles INSERT that omits `role`.
-- No code in the codebase reads or writes `.role` on profiles.
-- Drop both to unblock signup.
--
-- FIX 2 — Background Worker RLS
-- saveDoc('blood_requests', ...) in serverDb.ts uses the
-- service_role client. service_role has BYPASSRLS, so explicit
-- policies are technically redundant. We add them anyway because
-- some Supabase configurations evaluate policies before checking
-- BYPASSRLS (e.g. FORCE ROW LEVEL SECURITY). Idempotent — safe
-- to re-run.

BEGIN;

-- ─────────────────────────────────────────────────────
-- FIX 1: Drop unused role column + constraint
-- ─────────────────────────────────────────────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_has_role;
ALTER TABLE profiles DROP COLUMN IF EXISTS role;

-- ─────────────────────────────────────────────────────
-- FIX 2: service_role INSERT/UPDATE on blood_requests
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role insert blood_requests" ON blood_requests;
CREATE POLICY "Service role insert blood_requests" ON blood_requests
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service role update blood_requests" ON blood_requests;
CREATE POLICY "Service role update blood_requests" ON blood_requests
  FOR UPDATE TO service_role USING (true);

COMMIT;
