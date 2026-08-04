-- Migration 003: Drop broken FK on blood_requests.requester_id → requesters(id)
-- Run in: Supabase Dashboard → SQL Editor
--
-- Context: Server code now writes profiles.id into blood_requests.requester_id,
-- which violates the old FK pointing at the dead requesters table. This silently
-- breaks request creation. Drop the dead constraint.

ALTER TABLE blood_requests DROP CONSTRAINT IF EXISTS blood_requests_requester_id_fkey;

-- Future: Add FK to profiles(id) once data is verified clean
-- ALTER TABLE blood_requests ADD CONSTRAINT blood_requests_requester_profile_fkey
--   FOREIGN KEY (requester_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
