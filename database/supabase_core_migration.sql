-- RaktDaan core workflow migration. Run after supabase_schema.sql in Supabase SQL Editor.
-- Browser clients no longer create requests, matches, notifications, or profiles directly.

ALTER TABLE blood_requests
  ADD COLUMN IF NOT EXISTS showcase_opt_in BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_matches_request_donor ON matches(request_id, donor_id);
CREATE INDEX IF NOT EXISTS idx_requests_showcase ON blood_requests(showcase_opt_in, status, created_at DESC);

-- Remove broad PII access from the initial prototype schema.
DROP POLICY IF EXISTS "Public read active donors" ON users;
DROP POLICY IF EXISTS "Anyone can read requests" ON blood_requests;
DROP POLICY IF EXISTS "Auth users can create requests" ON blood_requests;

-- A user can only see and maintain their own profile. The API uses the service role.
DROP POLICY IF EXISTS "Owner can read own donor profile" ON users;
CREATE POLICY "Owner can read own donor profile" ON users FOR SELECT USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "Owner can read own requester profile" ON requesters;
CREATE POLICY "Owner can read own requester profile" ON requesters FOR SELECT USING (auth.uid()::text = id);
DROP POLICY IF EXISTS "Owner insert own requester profile" ON requesters;
CREATE POLICY "Owner insert own requester profile" ON requesters FOR INSERT WITH CHECK (auth.uid()::text = id);
DROP POLICY IF EXISTS "Owner update own requester profile" ON requesters;
CREATE POLICY "Owner update own requester profile" ON requesters FOR UPDATE USING (auth.uid()::text = id);

-- Private dashboard reads only. No browser policy grants write access to these records.
DROP POLICY IF EXISTS "Requester can read own requests" ON blood_requests;
CREATE POLICY "Requester can read own requests" ON blood_requests FOR SELECT USING (auth.uid()::text = requester_id);

DROP POLICY IF EXISTS "Participant can read own matches" ON matches;
CREATE POLICY "Participant can read own matches" ON matches FOR SELECT USING (
  auth.uid()::text = donor_id OR EXISTS (
    SELECT 1 FROM blood_requests r WHERE r.id = matches.request_id AND r.requester_id = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "Recipient can read own notifications" ON notifications;
CREATE POLICY "Recipient can read own notifications" ON notifications FOR SELECT USING (auth.uid()::text = recipient_id);
