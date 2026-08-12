-- FindMyDonor authentication redesign — additive, reversible migration (Rev 3).
--
-- Expands `profiles` with identity/capability/onboarding/notification columns.
-- Every column is ADD COLUMN IF NOT EXISTS and can be dropped independently,
-- so the migration is fully reversible with no destructive changes.
-- Safe idempotent DDL — safe to re-run.
--
-- Rollback (if ever needed):
--   ALTER TABLE profiles DROP COLUMN IF EXISTS auth_method;
--   ALTER TABLE profiles DROP COLUMN IF EXISTS intent;
--   ALTER TABLE profiles DROP COLUMN IF EXISTS onboarding_step;
--   ALTER TABLE profiles DROP COLUMN IF EXISTS notification_channel;
--   ALTER TABLE profiles DROP COLUMN IF EXISTS welcome_sent_at;
--   ALTER TABLE profiles DROP COLUMN IF EXISTS pincode;
--   ALTER TABLE profiles DROP COLUMN IF EXISTS city;
--   ALTER TABLE profiles DROP COLUMN IF EXISTS district;
--   ALTER TABLE profiles DROP COLUMN IF EXISTS state;
--   ALTER TABLE profiles DROP COLUMN IF EXISTS area;
--   ALTER TABLE profiles ALTER COLUMN phone SET NOT NULL;

-- ─── Identity ──────────────────────────────────────────────────────────────
-- Which provider authenticated this account (NULL = legacy phone-OTP user).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_method text;
COMMENT ON COLUMN profiles.auth_method IS 'google | email | NULL (legacy phone)';

-- Onboarding preference (NOT an authorization role).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS intent text;
COMMENT ON COLUMN profiles.intent IS 'donor | requester | institution — onboarding preference only';

-- Resume point for onboarding / completion wizard (refresh-safe).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_step text;
COMMENT ON COLUMN profiles.onboarding_step IS 'basic | intent | complete (+ legacy contact/otp/donor-profile)';

-- ─── Notifications ─────────────────────────────────────────────────────────
-- Preferred channel for ALL notifications (welcome, donor alerts, request
-- updates, institution notifications, future broadcasts).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_channel text;
COMMENT ON COLUMN profiles.notification_channel IS 'whatsapp | email | both';

-- Idempotency guard for the welcome notification (set on enqueue).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS welcome_sent_at timestamptz;
COMMENT ON COLUMN profiles.welcome_sent_at IS 'Set when the welcome message is enqueued; guards against duplicates';

-- ─── Location (shared profile — currently donor-only) ─────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pincode text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS district text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS area text;

-- ─── Phone optional (Google-only users may have no phone) ─────────────────
ALTER TABLE profiles ALTER COLUMN phone DROP NOT NULL;

-- ─── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_auth_method ON profiles (auth_method);
CREATE INDEX IF NOT EXISTS idx_profiles_pincode ON profiles (pincode);

-- ─── Service-role access for the new columns (mirror existing INSERT policies) ─
-- Existing policies already cover profiles for service_role (INSERT/SELECT/
-- UPDATE/DELETE). No new policy needed unless RLS is re-enabled for a new
-- column — these are columns on an existing table, so existing policies apply.
