-- ============================================================
-- Blood Connect — Dashboard-Created Policy Cleanup
-- Drops 9 orphan policies created via Supabase Dashboard UI
-- outside version control. None exist in any .sql file in repo.
--
-- Superseded by (or redundant with) tracked policies in
-- supabase_rls_policies.sql which enforce proper identity-based
-- access. The backend uses service_role (bypasses RLS) so all
-- these unconditional USING(true) policies serve no purpose.
--
-- Run in: Supabase Dashboard → SQL Editor
-- SAFE: Uses DROP POLICY IF EXISTS only. No data loss.
-- ============================================================

-- ── users ──────────────────────────────────────────────
-- "Public insert donors" — allows ANY anonymous user to insert
-- arbitrary rows into users. Superseded by "Users can insert their
-- own profile during signup" (WITH CHECK auth.uid()::text = id OR
-- auth.uid() IS NULL) in supabase_rls_policies.sql line 31-34.
DROP POLICY IF EXISTS "Public insert donors" ON users;

-- ── requesters ─────────────────────────────────────────
-- "Public insert requesters" — same issue as above. Superseded by
-- "Users can insert their requester profile during signup" in
-- supabase_rls_policies.sql line 52-55.
DROP POLICY IF EXISTS "Public insert requesters" ON requesters;

-- "Public read requesters" — allows ANY anonymous user to read ALL
-- requester profiles. Our tracked policy is owner-only
-- ("Requesters can view their own profile" line 41-44).
-- No legitimate cross-user read path exists.
DROP POLICY IF EXISTS "Public read requesters" ON requesters;

-- "Public update requesters" — allows ANY anonymous user to modify
-- ANY requester's profile. Our tracked policy is owner-only
-- ("Requesters can update their own profile" line 46-50).
DROP POLICY IF EXISTS "Public update requesters" ON requesters;

-- ── blood_requests ─────────────────────────────────────
-- "Public insert requests" — same anon-insert pattern. Superseded
-- by "Requesters can insert blood requests" (line 67-70).
DROP POLICY IF EXISTS "Public insert requests" ON blood_requests;

-- "Public update requests" — allows ANY anonymous user to modify
-- ANY blood request (status, blood type, urgency). Our tracked
-- policy is requester-owner-only ("Requesters can update their own
-- blood requests" line 72-76). Extremely dangerous to leave.
DROP POLICY IF EXISTS "Public update requests" ON blood_requests;

-- ── notifications ──────────────────────────────────────
-- "Public insert notifications" — allows anon inserts but NO
-- frontend code uses anon key for notifications (db.ts verified
-- zero callers). Backend handles all notification writes via
-- service_role (bypasses RLS). No tracked INSERT policy needed.
DROP POLICY IF EXISTS "Public insert notifications" ON notifications;

-- "Public read notifications" — allows ANY anonymous user to read
-- ALL notifications (private match alerts, etc). Our tracked policy
-- is recipient-only ("Users can view their own notifications"
-- line 109-112).
DROP POLICY IF EXISTS "Public read notifications" ON notifications;

-- "Public update notifications" — allows anon modification of any
-- notification. Backend handles all state changes via service_role.
DROP POLICY IF EXISTS "Public update notifications" ON notifications;
