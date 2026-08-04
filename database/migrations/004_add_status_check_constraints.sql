-- Migration 004: Add CHECK constraints to prevent bad status values
-- Run in: Supabase Dashboard → SQL Editor

-- blood_requests.status
ALTER TABLE blood_requests DROP CONSTRAINT IF EXISTS chk_blood_requests_status;
ALTER TABLE blood_requests ADD CONSTRAINT chk_blood_requests_status
  CHECK (status IN ('draft', 'open', 'broadcasting', 'matching', 'partially_matched', 'fulfilled', 'closed', 'expired', 'cancelled'));

-- matches.donor_response
ALTER TABLE matches DROP CONSTRAINT IF EXISTS chk_matches_donor_response;
ALTER TABLE matches ADD CONSTRAINT chk_matches_donor_response
  CHECK (donor_response IN ('pending', 'approved', 'declined', 'expired', 'timed_out'));

-- blood_requests.urgency_level
ALTER TABLE blood_requests DROP CONSTRAINT IF EXISTS chk_blood_requests_urgency;
ALTER TABLE blood_requests ADD CONSTRAINT chk_blood_requests_urgency
  CHECK (urgency_level IN ('critical', 'urgent', 'planned'));
