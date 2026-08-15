-- Phase 0 migration: Apply auth redesign + fix NOT NULL + fix CHECK constraints
-- Safe to re-run (all statements are idempotent).

-- ─── Step 1: New columns from supabase_auth_redesign_migration.sql ────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_method text;
COMMENT ON COLUMN profiles.auth_method IS 'google | email | NULL (legacy phone)';

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS intent text;
COMMENT ON COLUMN profiles.intent IS 'donor | requester | institution — onboarding preference only';

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_step text;
COMMENT ON COLUMN profiles.onboarding_step IS 'basic | intent | complete (+ legacy contact/otp/donor-profile)';

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_channel text;
COMMENT ON COLUMN profiles.notification_channel IS 'whatsapp | email | both';

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS welcome_sent_at timestamptz;
COMMENT ON COLUMN profiles.welcome_sent_at IS 'Set when the welcome message is enqueued; guards against duplicates';

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pincode text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS district text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS area text;

-- ─── Step 2: Drop NOT NULL constraints on phone and whatsapp_phone ────────────
ALTER TABLE profiles ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE profiles ALTER COLUMN whatsapp_phone DROP NOT NULL;

-- ─── Step 3: Fix CHECK constraints to allow NULL values ───────────────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_phone_format;
ALTER TABLE profiles ADD CONSTRAINT profiles_phone_format
  CHECK (phone IS NULL OR phone ~ '^91[6-9][0-9]{9}$');

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_whatsapp_format;
ALTER TABLE profiles ADD CONSTRAINT profiles_whatsapp_format
  CHECK (whatsapp_phone IS NULL OR whatsapp_phone ~ '^91[6-9][0-9]{9}$');

-- ─── Step 4: Indexes for new columns ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_auth_method ON profiles (auth_method);
CREATE INDEX IF NOT EXISTS idx_profiles_pincode ON profiles (pincode);

-- Verify the result
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('phone', 'whatsapp_phone', 'onboarding_step', 'auth_method', 'intent', 'notification_channel', 'pincode', 'welcome_sent_at')
ORDER BY column_name;
