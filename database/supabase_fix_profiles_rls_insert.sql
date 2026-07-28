-- ============================================================
-- Migration #10: Allow INSERT policies for profiles & donor tables
-- Date: 2026-07-27
-- ============================================================
-- Unblocks phone signup when PostgREST evaluates requests
-- under default or anon policy boundaries.

BEGIN;

-- 1. PROFILES INSERT POLICY
DROP POLICY IF EXISTS "Allow public insert on profiles" ON profiles;
CREATE POLICY "Allow public insert on profiles" ON profiles FOR INSERT WITH CHECK (true);

-- 2. DONOR_PROFILES INSERT POLICY
DROP POLICY IF EXISTS "Allow public insert on donor_profiles" ON donor_profiles;
CREATE POLICY "Allow public insert on donor_profiles" ON donor_profiles FOR INSERT WITH CHECK (true);

-- 3. AUTH_PROFILE_LINKS INSERT POLICY
DROP POLICY IF EXISTS "Allow public insert on auth_profile_links" ON auth_profile_links;
CREATE POLICY "Allow public insert on auth_profile_links" ON auth_profile_links FOR INSERT WITH CHECK (true);

-- 4. USERS LEGACY TABLE INSERT/UPDATE POLICIES
DROP POLICY IF EXISTS "Allow public insert on users" ON users;
CREATE POLICY "Allow public insert on users" ON users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on users" ON users;
CREATE POLICY "Allow public update on users" ON users FOR UPDATE USING (true);

COMMIT;
