# 🗄️ Database Architecture & Migrations (`/database`)

FindMyDonor uses **Supabase PostgreSQL** as its primary relational database with Row Level Security (RLS) policies.

---

## 📊 Core Tables

| Table | Description | Primary Key | Key Relationships |
|---|---|---|---|
| **`profiles`** | Master user profiles (phone, email, full name, permissions) | `id` (UUID) | Links to `auth.users` via `auth_profile_links` |
| **`donor_profiles`** | Donor blood type, availability, emergency preference & cooldown | `profile_id` (UUID) | Foreign key `profile_id` → `profiles.id` |
| **`blood_requests`** | Emergency & scheduled blood requests with hospital details | `id` (UUID) | Belongs to `profiles.id` (`requester_id`) |
| **`matches`** | Pairings between blood requests and matched donors | `id` (UUID) | Foreign key `request_id` → `blood_requests.id`, `donor_id` → `users.id` |
| **`notifications`** | Log of WhatsApp & Email notifications sent | `id` (UUID) | Foreign key `recipient_id` → `profiles.id` |
| **`users`** | Legacy compatibility table for original match foreign keys | `id` (UUID) | Synced with `profiles.id` on donor signup |

---

## 📜 SQL Migration Files (`/database/*.sql`)

| File Name | Purpose | Status |
|---|---|---|
| `supabase_schema.sql` | Core schema tables (`users`, `requesters`, `blood_requests`, `matches`, `notifications`) | Applied |
| `supabase_auth_profile_migration.sql` | Migration to split profiles into `profiles` + `donor_profiles` | Applied |
| `supabase_core_migration.sql` | Workflow additions (`showcase_opt_in`, indexes, owner RLS policies) | Applied |
| `supabase_rls_policies.sql` | Identity-based RLS security policies | Applied |
| `supabase_rls_cleanup.sql` | Cleanup script dropping superseded prototype RLS policies | Applied |
| `supabase_rls_apply_combined.sql` | Master combined RLS application script | Applied |
| `supabase_request_events_migration.sql` | Audit logging table for request state events | Applied |
| `supabase_fix_signup_and_rls.sql` | Phone signup RLS bypass fix for `@supabase/supabase-js` service role | Applied |
| `supabase_truncate_all_data.sql` | Reset script for testing environments | Utility |

---

## 🛡️ Security & Row Level Security (RLS)

- **Service Role Bypass**: Server-side operations (`server.ts`) use `SUPABASE_SERVICE_ROLE_KEY` with `rolbypassrls = true` to perform trusted backend queries.
- **Client RLS**: Anonymous & authenticated client queries enforce `auth.uid() = id` policies.
