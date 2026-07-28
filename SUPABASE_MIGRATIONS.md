# Supabase Migrations — Status & Verification Tracker

> **Last updated:** 2026-07-26
> **Purpose:** Every `.sql` file in this repo, in one place, with its applied status.  
> **Why:** Bugs like "column doesn't exist" or "RLS disabled" should be caught in 5 minutes, not multiple days.
>
> **⚠️ Dashboard-created policies exist outside version control.** If new mystery policies appear in `pg_policies` that aren't in any `.sql` file here, they were created via Supabase Dashboard UI. Check **Dashboard → SQL Editor → Recent Queries** or **Project Settings → Audit Logs** (if available on your plan) to find when/who created them before assuming any file in this repo created them.

---

## Known Remaining Warnings (Non-Critical, Reviewed, Not Blocking)

These are the current Supabase Security Advisor warnings. None are critical errors. Reviewed 2026-07-25.

| # | Warning | Table/Function | Verdict |
|---|---------|----------------|---------|
| 1 | Function Search Path Mutable | `update_updated_at_column()` | Low-priority hardening. Add `SET search_path = public` when convenient. |
| 2 | Function Search Path Mutable | `normalize_indian_phone()` | Low-priority hardening. Same fix as above. |
| 3 | RLS Policy Always True | `blood_requests` | **Intentional.** Signup-time anon insert policy; `auth.uid() IS NULL` clause allows unauthenticated request creation. Correct by design. |
| 4 | RLS Policy Always True | `notifications` | **Intentional.** Service-role insert for broadcast; anon can't actually reach it. Harmless. |
| 5 | RLS Policy Always True | `requesters` | **Intentional.** Signup-time anon insert policy (same pattern as #3). |
| 6 | RLS Policy Always True | `users` | **Intentional.** Signup-time anon insert policy (same pattern as #3). |
| 7 | Multiple Permissive Policies | `blood_requests` | **Resolved by cleanup** — superseded policies from `core_migration.sql` dropped by `supabase_rls_cleanup.sql` (2026-07-25). Original verdict was WRONG. |
| 8 | Multiple Permissive Policies | `notifications` | **Resolved by cleanup** — superseded policy from `core_migration.sql` dropped by `supabase_rls_cleanup.sql` (2026-07-25). Original verdict was WRONG. |
| 9 | Multiple Permissive Policies | `requesters` | **Resolved by cleanup** — superseded policies from `core_migration.sql` dropped by `supabase_rls_cleanup.sql` (2026-07-25). Original verdict was WRONG. |
| 10 | Multiple Permissive Policies | `users` | **Resolved by cleanup** — superseded policies from `schema.sql` and `core_migration.sql` dropped by `supabase_rls_cleanup.sql` (2026-07-25). Original verdict was WRONG. |
| 11 | SECURITY DEFINER callable without proper revoke | `link_verified_auth_profile()` | Worth double-checking that the REVOKE/GRANT statements actually landed in production. Verify: `SELECT proname, proconfig FROM pg_proc WHERE proname = 'link_verified_auth_profile';` |
| 12 | Leaked Password Protection Disabled | Supabase Auth dashboard toggle | **Not a SQL fix.** Toggle in Authentication → Settings in Supabase Dashboard. Flag separately for manual action. |

> **IMPORTANT (CORRECTED 2026-07-25):** The original verdict on warnings #7-10 was "Intentional, correct by design". **That was WRONG.** Cross-referencing all three migration files (schema.sql, core_migration.sql, rls_policies.sql) confirmed genuine leftover duplication — each file created policies with different names but overlapping logic, and rls_policies.sql only dropped policies matching its own names. See `supabase_rls_cleanup.sql` for the fix. Do NOT re-apply the old incorrect verdict.

---

## Migration Files

### 1. `supabase_schema.sql`

- **Purpose:** Foundation schema — creates all core tables (`users`, `requesters`, `blood_requests`, `matches`, `notifications`, `donation_log`, `forum_posts`, `forum_comments`), indexes, triggers, and the `update_updated_at_column()` function.
- **Status:** `UNKNOWN — needs verification`
- **Verify:** `SELECT to_regclass('public.users');` (should return `users`; repeat for each table)
- **Note:** Line 4 header marks `users` and `requesters` as superseded by `profiles` + `donor_profiles` from the auth migration below. Tables still exist for legacy data; do NOT add new queries against them.

### 2. `supabase_core_migration.sql`

- **Purpose:** Adds `showcase_opt_in` column to `blood_requests`, creates unique index on matches, drops overly-broad prototype RLS policies, AND creates its own owner-only SELECT policies on `users` ("Owner can read own donor profile"), `requesters` ("Owner can read/write own requester profile"), `blood_requests` ("Requester can read own requests"), `matches` ("Participant can read own matches"), `notifications` ("Recipient can read own notifications"). This is a **third source of policies** on these tables, alongside `supabase_rls_policies.sql` — both define policies with different names but overlapping logic. See Warning #7-10 below.
- **Status:** `UNKNOWN — needs verification`
- **Verify (column):** `SELECT column_name FROM information_schema.columns WHERE table_name='blood_requests' AND column_name='showcase_opt_in';` (should return 1 row)
- **Verify (indexes):** `SELECT indexname FROM pg_indexes WHERE indexname IN ('uq_matches_request_donor', 'idx_requests_showcase');` (should return 2 rows)
- **Verify (policy overlap):** `SELECT policyname FROM pg_policies WHERE tablename = 'users';` (if you see BOTH "Owner can read own donor profile" AND "Donors can view their own profile" coexisting, that confirms duplicate/overlapping policies from two different migration files)

### 3. `supabase_auth_profile_migration.sql`

- **Purpose:** Additive identity/profile migration — creates `profiles`, `auth_profile_links`, `donor_profiles`, `request_reports` tables, `normalize_indian_phone()` function, backfill logic, and RLS policies. Wrapped in `BEGIN`/`COMMIT`.
- **Status:** `UNKNOWN — needs verification`
- **Verify:** `SELECT to_regclass('public.profiles');` (should return `profiles`)
- **Verify (RLS):** `SELECT relrowsecurity FROM pg_class WHERE relname = 'profiles';` (should return `t`)
- **Verify (function):** `SELECT proname FROM pg_proc WHERE proname = 'normalize_indian_phone';` (should return 1 row)

### 4. `supabase_rls_policies.sql`

- **Purpose:** Comprehensive RLS policies for all 7 legacy tables: `users`, `requesters`, `blood_requests`, `matches`, `notifications`, `donation_log`, `forum_posts`. Covers SELECT, INSERT, UPDATE with owner-based access. `forum_posts` uses `is_flagged` (not `status`).
- **Status:** `UNKNOWN — needs verification`
- **Verify:** `SELECT relrowsecurity FROM pg_class WHERE relname = 'forum_posts';` (should return `t`)
- **Verify (policy exists):** `SELECT policyname FROM pg_policies WHERE tablename = 'forum_posts';` (should return at least 3 rows)

### 5. `supabase_request_events_migration.sql`

- **Purpose:** Creates the `request_events` append-only audit trail table (id, request_id, event, actor, meta, at), its index, enables RLS, and creates service-role + authenticated user policies.
- **Status:** `UNKNOWN — needs verification`
- **Note:** WARNING: This file starts with `DROP TABLE IF EXISTS request_events;` — running the full file will **wipe all existing audit log data**. Only the RLS section (lines 19-36) should be run on production. The RLS-only fix was delivered separately.
- **Verify:** `SELECT to_regclass('public.request_events');` (should return `request_events`)
- **Verify (RLS):** `SELECT relrowsecurity FROM pg_class WHERE relname = 'request_events';` (should return `t`)
- **Verify (data preserved):** `SELECT count(*) FROM request_events;` (should be > 0)

### 6. `supabase_rls_apply_combined.sql`

- **Purpose:** Combined reference file — Part 1 is the corrected `supabase_rls_policies.sql` (149 lines, `forum_posts` uses `is_flagged`) + Part 2 is the auth/profile migration RLS section (lines 213-246 from `supabase_auth_profile_migration.sql`) wrapped in `BEGIN`/`COMMIT`. This is exactly what was run in Supabase SQL Editor.
- **Status:** `Applied — confirmed 2026-07-25 via Security Advisor showing 0 critical errors`
- **Verify:** `SELECT count(*) FROM pg_policies WHERE schemaname = 'public';` (should show the combined policy count)
- **Note:** This is a reference-only copy. Do NOT re-run it — it contains `DROP POLICY IF EXISTS` + `CREATE POLICY` which will replace existing policies (safe but redundant if already applied).

### 7. `supabase_rls_cleanup.sql`

- **Purpose:** Targeted cleanup to resolve duplicates. Drops legacy prototype/overlapping policies on `users`, `requesters`, `blood_requests`, and `notifications` that were erroneously left behind by previous migrations.
- **Status:** `Applied — confirmed via Security Advisor (2026-07-25), later re-confirmed 2026-07-26 after mystery-policy cleanup`
- **Verify:** `SELECT policyname FROM pg_policies WHERE tablename IN ('users', 'requesters', 'blood_requests', 'notifications');` (should NOT show old policy names like "Owner can read own...")

### 8. `supabase_rls_mystery_cleanup.sql`

- **Purpose:** Drops 9 orphan policies created via Supabase Dashboard UI outside version control. All had unconditional `USING(true)` and were either superseded by tracked policies in `supabase_rls_policies.sql` or served no legitimate purpose (backend uses `service_role` which bypasses RLS). Includes per-policy comments explaining why each was safe to drop.
- **Status:** `Applied — confirmed via Security Advisor screenshot, warnings dropped 12→5, RLS Policy Always True fully resolved (2026-07-26)`
- **Policies dropped:** "Public insert donors" (users), "Public insert/read/update requesters" (requesters), "Public insert/update requests" (blood_requests), "Public insert/read/update notifications" (notifications)
- **Verify:** `SELECT policyname FROM pg_policies WHERE policyname LIKE 'Public %';` (should return 0 rows)

---

## Before / After Instructions

> **CAUTION:** Before writing ANY new `.sql` migration file, check this document first. Understand what exists, what's applied, and what the current policy state is.

> **IMPORTANT:** After running any `.sql` file in Supabase SQL Editor, come back and update its status here immediately — don't let this file go stale again.
