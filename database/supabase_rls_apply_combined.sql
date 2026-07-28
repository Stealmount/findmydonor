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

-- ═══════════════════════════════════════════════════════════
-- PART 2: Auth/Profile migration RLS (from supabase_auth_profile_migration.sql lines 213-246)
-- ═══════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_profile_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE donor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profile owner read" ON profiles;
CREATE POLICY "Profile owner read" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM auth_profile_links l WHERE l.profile_id = profiles.id AND l.auth_user_id = auth.uid())
);
DROP POLICY IF EXISTS "Profile owner update" ON profiles;
CREATE POLICY "Profile owner update" ON profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM auth_profile_links l WHERE l.profile_id = profiles.id AND l.auth_user_id = auth.uid())
);
DROP POLICY IF EXISTS "Owner read auth links" ON auth_profile_links;
CREATE POLICY "Owner read auth links" ON auth_profile_links FOR SELECT USING (auth_user_id = auth.uid());
DROP POLICY IF EXISTS "Donor owner read" ON donor_profiles;
CREATE POLICY "Donor owner read" ON donor_profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM auth_profile_links l WHERE l.profile_id = donor_profiles.profile_id AND l.auth_user_id = auth.uid())
);
DROP POLICY IF EXISTS "Donor owner update" ON donor_profiles;
CREATE POLICY "Donor owner update" ON donor_profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM auth_profile_links l WHERE l.profile_id = donor_profiles.profile_id AND l.auth_user_id = auth.uid())
);
DROP POLICY IF EXISTS "Reporter read own reports" ON request_reports;
CREATE POLICY "Reporter read own reports" ON request_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM auth_profile_links l WHERE l.profile_id = request_reports.reporter_profile_id AND l.auth_user_id = auth.uid())
);

DROP TRIGGER IF EXISTS set_updated_at_profiles ON profiles;
CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS set_updated_at_donor_profiles ON donor_profiles;
CREATE TRIGGER set_updated_at_donor_profiles BEFORE UPDATE ON donor_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
