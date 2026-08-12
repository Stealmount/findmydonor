-- ─────────────────────────────────────────────────────
-- REQUESTERS: add account_status column + index
-- Fixes Gap 1: admin ban/delete/restore + isAccountDeleted()
-- read requesters.account_status, but the column never
-- existed in the real DB (only in local JSON).
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────

ALTER TABLE requesters ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_requesters_account_status ON requesters(account_status);
