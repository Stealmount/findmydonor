-- RaktDaan self-service account deletion — additive migration (Section 9).
-- Adds service_role DELETE policies so the account-deletion endpoint can
-- hard-delete rows even if service_role's default BYPASSRLS is not effective
-- for newly RLS-enabled tables. Mirrors the existing INSERT policies.
-- Safe idempotent DDL — safe to re-run.

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
