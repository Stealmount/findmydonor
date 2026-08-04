-- Migration 001: Add indexes for matching engine performance
-- Safe to run multiple times (IF NOT EXISTS)
-- Run in: Supabase Dashboard → SQL Editor

CREATE INDEX IF NOT EXISTS idx_matches_request_id ON matches(request_id);
CREATE INDEX IF NOT EXISTS idx_matches_donor_response ON matches(donor_response);
CREATE INDEX IF NOT EXISTS idx_matches_donor_id ON matches(donor_id);
CREATE INDEX IF NOT EXISTS idx_blood_requests_status ON blood_requests(status);
CREATE INDEX IF NOT EXISTS idx_blood_requests_expires_at ON blood_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_donor_profiles_pincode ON donor_profiles(pincode);
CREATE INDEX IF NOT EXISTS idx_donor_profiles_blood_group ON donor_profiles(blood_group);
CREATE INDEX IF NOT EXISTS idx_donor_profiles_is_available ON donor_profiles(is_available);
