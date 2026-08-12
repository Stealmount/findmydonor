-- ============================================================
-- FindMyDonor — Institutions Data Model Migration
-- Phase 1 of Institutional Account Feature
-- Run in: Supabase Dashboard → SQL Editor
-- Safe: Additive — creates new tables only, touches nothing existing.
-- ============================================================
-- Status: WRITTEN — NOT YET APPLIED
-- Apply discipline: run once, then move status to APPLIED + date in CURRENT_STATE.md
-- ============================================================
BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. institutions
--    Single table covering hospital, ngo, blood_bank, other.
--    verification_status gate: pending → verified (admin) → active.
--    Unlike donor/requester accounts, institutional accounts are
--    NEVER auto-active — every row starts at 'pending' and requires
--    explicit admin approval before the institution can operate.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS institutions (
  -- Identity
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  type                TEXT        NOT NULL
                        CHECK (type IN ('hospital', 'ngo', 'blood_bank', 'other')),
  org_name            TEXT        NOT NULL,
  registration_number TEXT        NOT NULL,   -- Clinical reg / Darpan ID / License No.
                                              -- NOT unique at DB level: same chain may have
                                              -- multiple branches; admin reviews manually.

  -- Contact
  contact_person      TEXT        NOT NULL,
  phone               TEXT        NOT NULL,   -- format: 91XXXXXXXXXX (normalized on write)
  email               TEXT        NOT NULL,

  -- Location
  address             TEXT,                   -- optional street address
  city                TEXT        NOT NULL,
  pincode             TEXT        NOT NULL
                        CHECK (pincode ~ '^[0-9]{6}$'),

  -- Admin approval workflow
  -- Starts 'pending'. Transitions:
  --   pending → verified  (admin approves; server also sets profiles.can_request = true)
  --   pending → rejected  (admin rejects; rejection_reason stored; email sent)
  -- No auto-active path exists for institutions.
  verification_status TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  reviewed_by         TEXT,                   -- admin username who last acted
  reviewed_at         TIMESTAMPTZ,
  rejection_reason    TEXT,                   -- set on rejection; cleared on re-approval

  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deduplication: one institution per contact phone number.
-- Mirrors profiles_phone_unique. Natural OTP dedup key.
CREATE UNIQUE INDEX IF NOT EXISTS institutions_phone_unique
  ON institutions(phone);

-- Query patterns: admin queue (verification_status), directory (type, pincode)
CREATE INDEX IF NOT EXISTS idx_institutions_verification_status
  ON institutions(verification_status);

CREATE INDEX IF NOT EXISTS idx_institutions_type
  ON institutions(type);

CREATE INDEX IF NOT EXISTS idx_institutions_pincode
  ON institutions(pincode)
  WHERE verification_status = 'verified';   -- only verified appear in directory queries

-- ─────────────────────────────────────────────────────────────
-- 2. institution_profile_links
--    Links a profiles row (and therefore an auth.users row) to
--    its institution. Mirrors the donor_profiles pattern:
--
--    auth.users
--      └── auth_profile_links → profiles
--                                   └── institution_profile_links → institutions
--
--    Institutions use the same Supabase Auth (phone OTP), the same
--    link_verified_auth_profile() SECURITY DEFINER function, and the
--    same getLinkedProfile() server helper. No parallel auth system.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS institution_profile_links (
  profile_id      UUID  PRIMARY KEY REFERENCES profiles(id)      ON DELETE CASCADE,
  institution_id  UUID  NOT NULL    REFERENCES institutions(id)  ON DELETE CASCADE,
  role            TEXT  NOT NULL DEFAULT 'admin',  -- 'admin' | 'staff' (staff reserved for future)
                        CHECK (role IN ('admin', 'staff')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_institution_profile_links_institution
  ON institution_profile_links(institution_id);

-- ─────────────────────────────────────────────────────────────
-- 3. Row Level Security
--    service_role (server) bypasses RLS for all writes.
--    Authenticated users may only read/update their own institution.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE institutions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_profile_links ENABLE ROW LEVEL SECURITY;

-- Institution owner: read own institution row
DROP POLICY IF EXISTS "Institution owner read" ON institutions;
CREATE POLICY "Institution owner read" ON institutions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM institution_profile_links ipl
      JOIN auth_profile_links apl ON apl.profile_id = ipl.profile_id
      WHERE ipl.institution_id = institutions.id
        AND apl.auth_user_id   = auth.uid()
    )
  );

-- Institution owner: update own institution row
-- (e.g., updating address/contact info while pending)
DROP POLICY IF EXISTS "Institution owner update" ON institutions;
CREATE POLICY "Institution owner update" ON institutions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM institution_profile_links ipl
      JOIN auth_profile_links apl ON apl.profile_id = ipl.profile_id
      WHERE ipl.institution_id = institutions.id
        AND apl.auth_user_id   = auth.uid()
    )
  );

-- Public read: verified institutions only (for BloodBankDirectory, public directory page)
DROP POLICY IF EXISTS "Public read verified institutions" ON institutions;
CREATE POLICY "Public read verified institutions" ON institutions
  FOR SELECT USING (verification_status = 'verified');

-- institution_profile_links: owner read only
DROP POLICY IF EXISTS "Owner read institution links" ON institution_profile_links;
CREATE POLICY "Owner read institution links" ON institution_profile_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth_profile_links apl
      WHERE apl.profile_id = institution_profile_links.profile_id
        AND apl.auth_user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 4. updated_at trigger (matches existing pattern on all tables)
-- ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_updated_at_institutions ON institutions;
CREATE TRIGGER set_updated_at_institutions
  BEFORE UPDATE ON institutions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- Post-apply audit queries (run after COMMIT to verify)
-- ─────────────────────────────────────────────────────────────
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'institutions'
--  ORDER BY ordinal_position;
--
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'institution_profile_links'
--  ORDER BY ordinal_position;
--
-- SELECT schemaname, tablename, policyname, cmd, qual
--   FROM pg_policies
--  WHERE tablename IN ('institutions', 'institution_profile_links');
