-- FindMyDonor — Supabase RLS INSERT/DELETE Policy Fix
-- Run in Supabase Dashboard → SQL Editor
-- Fixes: auth user creation fails on profile insert (error 42501)

-- ── INSERT policies (service_role only) ──────────────────────────────────────
DROP POLICY IF EXISTS "Service role insert profiles" ON profiles;
CREATE POLICY "Service role insert profiles" ON profiles
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service role insert auth links" ON auth_profile_links;
CREATE POLICY "Service role insert auth links" ON auth_profile_links
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service role insert donor profiles" ON donor_profiles;
CREATE POLICY "Service role insert donor profiles" ON donor_profiles
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service role insert reports" ON request_reports;
CREATE POLICY "Service role insert reports" ON request_reports
  FOR INSERT TO service_role WITH CHECK (true);

-- ── DELETE policies (needed for rollback/cleanup) ────────────────────────────
DROP POLICY IF EXISTS "Service role delete profiles" ON profiles;
CREATE POLICY "Service role delete profiles" ON profiles
  FOR DELETE TO service_role USING (true);

DROP POLICY IF EXISTS "Service role delete auth links" ON auth_profile_links;
CREATE POLICY "Service role delete auth links" ON auth_profile_links
  FOR DELETE TO service_role USING (true);

DROP POLICY IF EXISTS "Service role delete donor profiles" ON donor_profiles;
CREATE POLICY "Service role delete donor profiles" ON donor_profiles
  FOR DELETE TO service_role USING (true);

DROP POLICY IF EXISTS "Service role delete reports" ON request_reports;
CREATE POLICY "Service role delete reports" ON request_reports
  FOR DELETE TO service_role USING (true);

-- NOTE: Do NOT run ALTER ROLE service_role BYPASSBRLS
-- Supabase reserved roles cannot be altered by non-superusers.
-- service_role already has bypass by default; these policies are the real fix.
