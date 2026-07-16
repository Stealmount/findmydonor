-- RaktDaan additive identity/profile migration.
-- Safe for live use: creates new tables, backfills copies, never drops legacy data.
BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION normalize_indian_phone(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT CASE
    WHEN regexp_replace(value, '\D', '', 'g') ~ '^91[6-9][0-9]{9}$'
      THEN regexp_replace(value, '\D', '', 'g')
    WHEN regexp_replace(value, '\D', '', 'g') ~ '^[6-9][0-9]{9}$'
      THEN '91' || regexp_replace(value, '\D', '', 'g')
    ELSE regexp_replace(value, '\D', '', 'g')
  END
$$;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  legacy_user_id TEXT UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp_phone TEXT NOT NULL,
  is_whatsapp BOOLEAN NOT NULL DEFAULT TRUE,
  email TEXT,
  whatsapp_verified BOOLEAN NOT NULL DEFAULT FALSE,
  consent_accepted_at TIMESTAMPTZ,
  can_donate BOOLEAN NOT NULL DEFAULT FALSE,
  can_request BOOLEAN NOT NULL DEFAULT FALSE,
  trust_report_count INTEGER NOT NULL DEFAULT 0 CHECK (trust_report_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profiles_has_role CHECK (can_donate OR can_request),
  CONSTRAINT profiles_phone_format CHECK (phone ~ '^91[6-9][0-9]{9}$'),
  CONSTRAINT profiles_whatsapp_format CHECK (whatsapp_phone ~ '^91[6-9][0-9]{9}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique ON profiles(phone);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(lower(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_profile_links (
  auth_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS auth_profile_links_profile_idx ON auth_profile_links(profile_id);

CREATE TABLE IF NOT EXISTS donor_profiles (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  blood_group TEXT CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-')),
  latitude DOUBLE PRECISION CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION CHECK (longitude BETWEEN -180 AND 180),
  address_text TEXT,
  pincode TEXT,
  area TEXT,
  city TEXT,
  state TEXT,
  last_donation_date DATE,
  cooldown_until DATE,
  health_self_declaration BOOLEAN NOT NULL DEFAULT FALSE,
  is_available BOOLEAN NOT NULL DEFAULT FALSE,
  profile_complete BOOLEAN NOT NULL DEFAULT FALSE,
  emergency_only BOOLEAN NOT NULL DEFAULT FALSE,
  number_sharing_pref TEXT NOT NULL DEFAULT 'on_approval',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT available_profile_must_be_complete CHECK (NOT is_available OR profile_complete)
);
CREATE INDEX IF NOT EXISTS donor_matching_pool_idx
  ON donor_profiles(blood_group, is_available, cooldown_until)
  WHERE profile_complete = TRUE AND is_available = TRUE;

ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS requester_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS requester_phone_verified_at TIMESTAMPTZ;
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS requester_consent_accepted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS request_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES blood_requests(id) ON DELETE CASCADE,
  reporter_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requester_phone TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, reporter_profile_id)
);
CREATE INDEX IF NOT EXISTS request_reports_phone_idx ON request_reports(requester_phone);

-- Conservative donor backfill. Invalid or duplicate phones are left in legacy tables for audit.
INSERT INTO profiles (
  legacy_user_id, full_name, phone, whatsapp_phone, is_whatsapp, email,
  whatsapp_verified, consent_accepted_at, can_donate, can_request, created_at, updated_at
)
SELECT
  u.id,
  u.full_name,
  normalize_indian_phone(u.phone),
  normalize_indian_phone(COALESCE(NULLIF(u.whatsapp_number, ''), u.phone)),
  COALESCE(NULLIF(u.whatsapp_number, ''), u.phone) = u.phone,
  NULLIF(u.email, ''),
  COALESCE(u.whatsapp_verified, FALSE),
  CASE WHEN COALESCE(u.whatsapp_verified, FALSE) THEN COALESCE(u.created_at, NOW()) ELSE NULL END,
  TRUE,
  FALSE,
  COALESCE(u.created_at, NOW()),
  COALESCE(u.updated_at, NOW())
FROM users u
WHERE normalize_indian_phone(u.phone) ~ '^91[6-9][0-9]{9}$'
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.phone = normalize_indian_phone(u.phone))
ON CONFLICT DO NOTHING;

INSERT INTO donor_profiles (
  profile_id, blood_group, pincode, area, city, last_donation_date, cooldown_until,
  health_self_declaration, is_available, profile_complete, emergency_only,
  number_sharing_pref, created_at, updated_at
)
SELECT
  p.id,
  CASE WHEN u.blood_type IN ('A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-') THEN u.blood_type END,
  u.pincode, u.area, u.city, u.last_donation_date, u.cooldown_until,
  COALESCE(u.medical_clearance, FALSE),
  FALSE,
  FALSE,
  COALESCE(u.emergency_only, FALSE),
  COALESCE(u.number_sharing_pref, 'on_approval'),
  COALESCE(u.created_at, NOW()), COALESCE(u.updated_at, NOW())
FROM users u
JOIN profiles p ON p.legacy_user_id = u.id
ON CONFLICT (profile_id) DO NOTHING;

-- Link legacy rows whose IDs are real Supabase UUIDs.
INSERT INTO auth_profile_links (auth_user_id, profile_id, provider)
SELECT u.id::uuid, p.id, 'legacy'
FROM users u
JOIN profiles p ON p.legacy_user_id = u.id
WHERE u.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id::uuid)
ON CONFLICT (auth_user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION link_verified_auth_profile(
  p_auth_user_id UUID,
  p_phone TEXT,
  p_whatsapp_phone TEXT,
  p_full_name TEXT,
  p_email TEXT,
  p_can_donate BOOLEAN,
  p_can_request BOOLEAN,
  p_consent_accepted_at TIMESTAMPTZ,
  p_provider TEXT DEFAULT NULL
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_phone TEXT := normalize_indian_phone(p_phone);
  normalized_whatsapp TEXT := normalize_indian_phone(p_whatsapp_phone);
  result profiles;
BEGIN
  IF normalized_phone !~ '^91[6-9][0-9]{9}$' OR normalized_whatsapp !~ '^91[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'Invalid Indian phone number';
  END IF;
  IF p_consent_accepted_at IS NULL THEN
    RAISE EXCEPTION 'Consent is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(normalized_phone, 0));

  SELECT * INTO result FROM profiles WHERE phone = normalized_phone FOR UPDATE;
  IF FOUND THEN
    IF NOT result.whatsapp_verified THEN
      UPDATE profiles SET
        full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
        email = COALESCE(NULLIF(lower(trim(p_email)), ''), email),
        whatsapp_phone = normalized_whatsapp,
        is_whatsapp = normalized_phone = normalized_whatsapp,
        whatsapp_verified = TRUE,
        consent_accepted_at = p_consent_accepted_at,
        can_donate = can_donate OR p_can_donate,
        can_request = can_request OR p_can_request,
        updated_at = NOW()
      WHERE id = result.id RETURNING * INTO result;
    END IF;
  ELSE
    INSERT INTO profiles (
      full_name, phone, whatsapp_phone, is_whatsapp, email, whatsapp_verified,
      consent_accepted_at, can_donate, can_request
    ) VALUES (
      trim(p_full_name), normalized_phone, normalized_whatsapp,
      normalized_phone = normalized_whatsapp, NULLIF(lower(trim(p_email)), ''), TRUE,
      p_consent_accepted_at, p_can_donate, p_can_request
    ) RETURNING * INTO result;
  END IF;

  INSERT INTO auth_profile_links(auth_user_id, profile_id, provider)
  VALUES (p_auth_user_id, result.id, p_provider)
  ON CONFLICT (auth_user_id) DO UPDATE SET profile_id = EXCLUDED.profile_id, provider = EXCLUDED.provider;

  IF p_can_donate THEN
    INSERT INTO donor_profiles(profile_id) VALUES (result.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION link_verified_auth_profile(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION link_verified_auth_profile(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TIMESTAMPTZ, TEXT) TO service_role;

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

-- Audit after migration. Rows returned need manual review; no data was removed.
SELECT id, full_name, phone FROM users
WHERE normalize_indian_phone(phone) !~ '^91[6-9][0-9]{9}$';
SELECT normalize_indian_phone(phone) AS normalized_phone, count(*)
FROM users
WHERE normalize_indian_phone(phone) ~ '^91[6-9][0-9]{9}$'
GROUP BY 1 HAVING count(*) > 1;
SELECT dp.profile_id FROM donor_profiles dp
JOIN profiles p ON p.id = dp.profile_id
WHERE dp.is_available AND (NOT dp.profile_complete OR NOT p.whatsapp_verified);
