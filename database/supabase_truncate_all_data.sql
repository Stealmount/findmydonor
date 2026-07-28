-- ============================================================
-- TRUNCATE ALL DATA — Public tables only
-- Date: 2026-07-26
-- ============================================================
-- Preserves: Supabase Auth users, table structure, RLS policies
-- Drops: All rows from every public table
-- Order: child tables first (FK constraints)

BEGIN;

TRUNCATE TABLE report_submissions CASCADE;
TRUNCATE TABLE trust_reports CASCADE;
TRUNCATE TABLE notifications CASCADE;
TRUNCATE TABLE blood_requests CASCADE;
TRUNCATE TABLE donor_profiles CASCADE;
TRUNCATE TABLE auth_profile_links CASCADE;
TRUNCATE TABLE otp_tickets CASCADE;
TRUNCATE TABLE profiles CASCADE;

COMMIT;
