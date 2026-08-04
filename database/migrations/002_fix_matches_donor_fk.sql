-- Migration 002: Fix matches.donor_id FK from dead users table to profiles table
-- Run in: Supabase Dashboard → SQL Editor
--
-- IMPORTANT: Run AFTER verifying all existing matches.donor_id values exist in profiles.id
--
-- Context: matches.donor_id previously referenced the users table, which is no longer
-- the source of truth for donors. Donors now live in profiles (and donor_profiles).
-- New donors whose IDs exist only in profiles cannot have matches created without
-- violating this dead FK — match creation silently fails.
--
-- This migration is CAUTIOUS by design:
--   Step 1 drops the broken FK so match creation stops failing.
--   Adding a replacement FK to profiles(id) is COMMENTED OUT because the user must
--   first verify data integrity (see the verification query below).

-- Step 1: Drop the old FK constraint
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_donor_id_fkey;

-- Step 2: Verify no orphans before enabling the new FK.
-- Run this first; it must return 0 rows:
-- SELECT donor_id FROM matches WHERE donor_id::uuid NOT IN (SELECT id FROM profiles);

-- Step 3: Add FK (deferred — only enable once Step 2 returns 0 rows).
-- NOTE: Only add this FK if all existing donor_ids map to profiles.id
-- ALTER TABLE matches ADD CONSTRAINT matches_donor_id_fkey
--   FOREIGN KEY (donor_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- For now, just drop the broken FK. The app validates at the application layer.
