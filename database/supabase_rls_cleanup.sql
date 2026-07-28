-- ============================================================
-- Blood Connect — RLS Policy Cleanup
-- Resolves Multiple Permissive Policies warnings (#7-10)
--
-- These policies are superseded by supabase_rls_policies.sql
-- which defines better, more granular replacements.
-- Run in: Supabase Dashboard → SQL Editor
--
-- SAFE: Uses DROP POLICY IF EXISTS only. No data loss.
-- ============================================================

-- 1. USERS: Drop superseded policies from core_migration.sql and schema.sql
DROP POLICY IF EXISTS "Owner can read own donor profile" ON users;
DROP POLICY IF EXISTS "Owner insert own profile" ON users;
DROP POLICY IF EXISTS "Owner update own profile" ON users;

-- 2. REQUESTERS: Drop superseded policies from core_migration.sql
DROP POLICY IF EXISTS "Owner can read own requester profile" ON requesters;
DROP POLICY IF EXISTS "Owner insert own requester profile" ON requesters;
DROP POLICY IF EXISTS "Owner update own requester profile" ON requesters;

-- 3. BLOOD_REQUESTS: Drop superseded policy from core_migration.sql
DROP POLICY IF EXISTS "Requester can read own requests" ON blood_requests;

-- 4. MATCHES: Drop superseded policy from core_migration.sql
DROP POLICY IF EXISTS "Participant can read own matches" ON matches;

-- 5. NOTIFICATIONS: Drop superseded policy from core_migration.sql
DROP POLICY IF EXISTS "Recipient can read own notifications" ON notifications;

-- 6. FORUM_POSTS: Drop superseded policies from schema.sql
DROP POLICY IF EXISTS "Public read forum posts" ON forum_posts;
DROP POLICY IF EXISTS "Auth users can post" ON forum_posts;
DROP POLICY IF EXISTS "Author can update post" ON forum_posts;
