-- ============================================================
-- Blood Connect — Supabase PostgreSQL Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ⚠️  SUPERSEDED: users & requesters tables below are DEAD. All signups now write to profiles + donor_profiles (see supabase_auth_profile_migration.sql). Do NOT add new queries against users/requesters.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────
-- USERS (Donors)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                    TEXT PRIMARY KEY,
  full_name             TEXT NOT NULL,
  email                 TEXT UNIQUE NOT NULL,
  phone                 TEXT,
  whatsapp_number       TEXT,
  blood_type            TEXT NOT NULL,
  donation_frequency    TEXT DEFAULT 'first_time',
  last_donation_date    DATE,
  cooldown_until        DATE,
  pincode               TEXT,
  area                  TEXT,
  city                  TEXT,
  district              TEXT,
  availability_status   TEXT DEFAULT 'available',
  number_sharing_pref   TEXT DEFAULT 'on_approval',
  emergency_only        BOOLEAN DEFAULT FALSE,
  account_status        TEXT DEFAULT 'active',
  whatsapp_verified     BOOLEAN DEFAULT FALSE,
  age                   INT,
  gender                TEXT,
  weight_kg             NUMERIC(5,1),
  hospital_affiliation  TEXT,
  medical_clearance     BOOLEAN DEFAULT FALSE,
  fcm_token             TEXT,
  push_enabled          BOOLEAN DEFAULT TRUE,
  digilocker_verified   BOOLEAN DEFAULT FALSE,
  digilocker_name       TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- REQUESTERS
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS requesters (
  id                TEXT PRIMARY KEY,
  full_name         TEXT NOT NULL,
  email             TEXT UNIQUE NOT NULL,
  phone             TEXT,
  whatsapp_number   TEXT,
  pincode           TEXT,
  area              TEXT,
  city              TEXT,
  district          TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- BLOOD REQUESTS
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blood_requests (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_code       TEXT UNIQUE NOT NULL,
  patient_name        TEXT NOT NULL,
  patient_age         INT,
  patient_gender      TEXT,
  blood_type_needed   TEXT NOT NULL,
  component_needed    TEXT,
  units_required      INT NOT NULL DEFAULT 1,
  hospital_name       TEXT NOT NULL,
  hospital_uhid       TEXT,
  attending_doctor    TEXT,
  hospital_pincode    TEXT NOT NULL,
  hospital_area       TEXT,
  hospital_city       TEXT,
  hospital_state      TEXT,
  hospital_district   TEXT,
  urgency_level       TEXT NOT NULL DEFAULT 'urgent',
  requester_id        TEXT REFERENCES requesters(id),
  requester_name      TEXT NOT NULL,
  requester_email     TEXT NOT NULL,
  requester_phone     TEXT NOT NULL,
  additional_notes    TEXT,
  status              TEXT DEFAULT 'open',
  share_contact_immediately BOOLEAN DEFAULT FALSE,
  expires_at          TIMESTAMPTZ,
  fulfilled_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- MATCHES
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id            UUID NOT NULL REFERENCES blood_requests(id) ON DELETE CASCADE,
  donor_id              TEXT NOT NULL REFERENCES users(id),
  match_rank            INT DEFAULT 1,
  notification_channel  TEXT DEFAULT 'dashboard',
  notification_sent_at  TIMESTAMPTZ,
  reminder_sent_at      TIMESTAMPTZ,
  donor_response        TEXT DEFAULT 'pending',
  donor_response_at     TIMESTAMPTZ,
  contact_shared_at     TIMESTAMPTZ,
  outcome               TEXT,
  outcome_confirmed_at  TIMESTAMPTZ,
  distance_km           NUMERIC(6,2),              -- haversine distance donor → hospital
  is_exact_match        BOOLEAN DEFAULT TRUE,       -- true = exact ABO/Rh; false = compatible but not exact
  created_at            TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────
-- NOTIFICATIONS LOG
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type            TEXT NOT NULL,
  recipient_type  TEXT NOT NULL,
  recipient_id    TEXT NOT NULL,
  trigger_event   TEXT NOT NULL,
  message_body    TEXT NOT NULL,
  status          TEXT DEFAULT 'queued',
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- DONATION LOG
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS donation_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  donor_id        TEXT NOT NULL REFERENCES users(id),
  match_id        UUID REFERENCES matches(id),
  request_id      UUID REFERENCES blood_requests(id),
  donation_date   DATE NOT NULL,
  source          TEXT DEFAULT 'platform_match',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- COMMUNITY FORUM POSTS
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forum_posts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_name  TEXT NOT NULL,
  blood_type   TEXT,
  content      TEXT NOT NULL,
  post_type    TEXT DEFAULT 'story',
  likes        INT DEFAULT 0,
  is_pinned    BOOLEAN DEFAULT FALSE,
  is_flagged   BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- COMMUNITY FORUM COMMENTS
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forum_comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id     UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  author_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_blood_type        ON users(blood_type);
CREATE INDEX IF NOT EXISTS idx_users_pincode           ON users(pincode);
CREATE INDEX IF NOT EXISTS idx_users_district          ON users(district);
CREATE INDEX IF NOT EXISTS idx_users_availability      ON users(availability_status);
CREATE INDEX IF NOT EXISTS idx_users_account_status    ON users(account_status);
CREATE INDEX IF NOT EXISTS idx_requests_status         ON blood_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_blood_type     ON blood_requests(blood_type_needed);
CREATE INDEX IF NOT EXISTS idx_requests_pincode        ON blood_requests(hospital_pincode);
CREATE INDEX IF NOT EXISTS idx_matches_request_id      ON matches(request_id);
CREATE INDEX IF NOT EXISTS idx_matches_donor_id        ON matches(donor_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_created     ON forum_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_comments_post_id  ON forum_comments(post_id);

-- ─────────────────────────────────────────────────────
-- ENABLE REALTIME
-- Run after table creation in Supabase Dashboard → Database → Replication
-- ─────────────────────────────────────────────────────
-- ALTER PUBLICATION supabase_realtime ADD TABLE forum_posts;
-- ALTER PUBLICATION supabase_realtime ADD TABLE forum_comments;
-- ALTER PUBLICATION supabase_realtime ADD TABLE matches;

-- ─────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE requesters     ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE donation_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_comments ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Public read active donors"      ON users FOR SELECT USING (account_status IN ('active', 'cooldown'));
CREATE POLICY "Owner insert own profile"       ON users FOR INSERT WITH CHECK (auth.uid()::text = id);
CREATE POLICY "Owner update own profile"       ON users FOR UPDATE USING (auth.uid()::text = id);

-- Blood request policies
CREATE POLICY "Anyone can read requests"       ON blood_requests FOR SELECT USING (true);
CREATE POLICY "Auth users can create requests" ON blood_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Forum policies
CREATE POLICY "Public read forum posts"        ON forum_posts FOR SELECT USING (is_flagged = FALSE);
CREATE POLICY "Auth users can post"            ON forum_posts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Author can update post"         ON forum_posts FOR UPDATE USING (auth.uid()::text = author_id);
CREATE POLICY "Public read comments"           ON forum_comments FOR SELECT USING (true);
CREATE POLICY "Auth users can comment"         ON forum_comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────
-- AUTO updated_at TRIGGER
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_updated_at_users      BEFORE UPDATE ON users         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_requesters BEFORE UPDATE ON requesters    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_requests   BEFORE UPDATE ON blood_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_forum      BEFORE UPDATE ON forum_posts   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
