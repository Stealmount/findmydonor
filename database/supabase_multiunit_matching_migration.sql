-- ============================================================
-- FindMyDonor — Multi-Unit Matching & Email Quota Migration
-- Run in: Supabase Dashboard → SQL Editor
-- Safe: All changes are additive (ADD COLUMN IF NOT EXISTS)
-- ============================================================
BEGIN;

-- ─────────────────────────────────────────────────────
-- 1. blood_requests: track unit fulfillment progress
-- ─────────────────────────────────────────────────────

-- How many units have been confirmed by donors saying YES
ALTER TABLE blood_requests
  ADD COLUMN IF NOT EXISTS units_confirmed INTEGER NOT NULL DEFAULT 0;

-- Tracks whether requester email was verified (OTP or Gmail fast-track)
ALTER TABLE blood_requests
  ADD COLUMN IF NOT EXISTS requester_email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- ─────────────────────────────────────────────────────
-- 2. matches: track which unit slot this donor fills
-- ─────────────────────────────────────────────────────

-- Which unit number (1-based) this donor is assigned to
-- e.g., unit_slot=3 means this donor fills Unit #3 of 6
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS unit_slot INTEGER;

-- ─────────────────────────────────────────────────────
-- 3. profiles: Gmail fast-track flags
-- ─────────────────────────────────────────────────────

-- TRUE if user's email was verified (via OTP or Gmail instant)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- TRUE if this is a Gmail account (for skipping OTP)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_gmail BOOLEAN NOT NULL DEFAULT FALSE;

-- ─────────────────────────────────────────────────────
-- 4. Indexes for faster multi-unit match queries
-- ─────────────────────────────────────────────────────

-- Find all matches for a request, sorted by response status
CREATE INDEX IF NOT EXISTS idx_matches_request_response
  ON matches(request_id, donor_response);

-- Find open requests that still need more units
CREATE INDEX IF NOT EXISTS idx_requests_open_unfulfilled
  ON blood_requests(status, units_confirmed, units_required)
  WHERE status = 'open';

COMMIT;
