-- ============================================================
-- Blood Connect — Supabase Row Level Security (RLS) Policies
-- Run this in: Supabase Dashboard → SQL Editor
--
-- NOTE: The backend Node server (`server.ts`) connects using 
-- `SUPABASE_SERVICE_ROLE_KEY`, which automatically bypasses RLS.
-- These policies secure direct frontend queries (`supabaseAnonKey`).
-- ============================================================

-- ─────────────────────────────────────────────────────
-- 1. USERS (Donors)
-- ─────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Donors can view their own profile" ON users;
CREATE POLICY "Donors can view their own profile"
  ON users FOR SELECT
  USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "Public can read donor availability fields for matching" ON users;
CREATE POLICY "Public can read donor availability fields for matching"
  ON users FOR SELECT
  USING (account_status = 'active' AND availability_status = 'available');

DROP POLICY IF EXISTS "Donors can update their own profile" ON users;
CREATE POLICY "Donors can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

DROP POLICY IF EXISTS "Users can insert their own profile during signup" ON users;
CREATE POLICY "Users can insert their own profile during signup"
  ON users FOR INSERT
  WITH CHECK (auth.uid()::text = id OR auth.uid() IS NULL);

-- ─────────────────────────────────────────────────────
-- 2. REQUESTERS
-- ─────────────────────────────────────────────────────
ALTER TABLE requesters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Requesters can view their own profile" ON requesters;
CREATE POLICY "Requesters can view their own profile"
  ON requesters FOR SELECT
  USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "Requesters can update their own profile" ON requesters;
CREATE POLICY "Requesters can update their own profile"
  ON requesters FOR UPDATE
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

DROP POLICY IF EXISTS "Users can insert their requester profile during signup" ON requesters;
CREATE POLICY "Users can insert their requester profile during signup"
  ON requesters FOR INSERT
  WITH CHECK (auth.uid()::text = id OR auth.uid() IS NULL);

-- ─────────────────────────────────────────────────────
-- 3. BLOOD REQUESTS
-- ─────────────────────────────────────────────────────
ALTER TABLE blood_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view open blood requests or their own requests" ON blood_requests;
CREATE POLICY "Anyone can view open blood requests or their own requests"
  ON blood_requests FOR SELECT
  USING (status = 'open' OR requester_id = auth.uid()::text);

DROP POLICY IF EXISTS "Requesters can insert blood requests" ON blood_requests;
CREATE POLICY "Requesters can insert blood requests"
  ON blood_requests FOR INSERT
  WITH CHECK (requester_id = auth.uid()::text OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Requesters can update their own blood requests" ON blood_requests;
CREATE POLICY "Requesters can update their own blood requests"
  ON blood_requests FOR UPDATE
  USING (requester_id = auth.uid()::text)
  WITH CHECK (requester_id = auth.uid()::text);

-- ─────────────────────────────────────────────────────
-- 4. MATCHES
-- ─────────────────────────────────────────────────────
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Donors can view their assigned matches" ON matches;
CREATE POLICY "Donors can view their assigned matches"
  ON matches FOR SELECT
  USING (donor_id = auth.uid()::text);

DROP POLICY IF EXISTS "Requesters can view matches for their blood requests" ON matches;
CREATE POLICY "Requesters can view matches for their blood requests"
  ON matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM blood_requests br
      WHERE br.id = matches.request_id AND br.requester_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Donors can update their response on assigned matches" ON matches;
CREATE POLICY "Donors can update their response on assigned matches"
  ON matches FOR UPDATE
  USING (donor_id = auth.uid()::text)
  WITH CHECK (donor_id = auth.uid()::text);

-- ─────────────────────────────────────────────────────
-- 5. NOTIFICATIONS LOG
-- ─────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (recipient_id = auth.uid()::text);

-- ─────────────────────────────────────────────────────
-- 6. DONATION LOG
-- ─────────────────────────────────────────────────────
ALTER TABLE donation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Donors can view their own donation log" ON donation_log;
CREATE POLICY "Donors can view their own donation log"
  ON donation_log FOR SELECT
  USING (donor_id = auth.uid()::text);

DROP POLICY IF EXISTS "Donors can insert their own donation entries" ON donation_log;
CREATE POLICY "Donors can insert their own donation entries"
  ON donation_log FOR INSERT
  WITH CHECK (donor_id = auth.uid()::text);

-- ─────────────────────────────────────────────────────
-- 7. FORUM POSTS
-- ─────────────────────────────────────────────────────
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active forum posts" ON forum_posts;
CREATE POLICY "Anyone can view active forum posts"
  ON forum_posts FOR SELECT
  USING (is_flagged = FALSE OR is_flagged IS NULL);

DROP POLICY IF EXISTS "Authenticated users can insert forum posts" ON forum_posts;
CREATE POLICY "Authenticated users can insert forum posts"
  ON forum_posts FOR INSERT
  WITH CHECK (author_id = auth.uid()::text OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Authors can update their own forum posts" ON forum_posts;
CREATE POLICY "Authors can update their own forum posts"
  ON forum_posts FOR UPDATE
  USING (author_id = auth.uid()::text)
  WITH CHECK (author_id = auth.uid()::text);
