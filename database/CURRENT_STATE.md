# FindMyDonor — Live Database Current State
> Source of truth as of 2026-07-28. Generated from live Supabase introspection, not SQL files.

---

## Tables (Public Schema)

### Core Identity Tables (Active)

#### `profiles`
Master user identity table. All signups write here.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid_generate_v4() | PK |
| legacy_user_id | TEXT | YES | | Backfill reference to old `users.id` |
| full_name | TEXT | NO | | |
| phone | TEXT | NO | | Unique index, format `91XXXXXXXXXX` |
| whatsapp_phone | TEXT | NO | | Format `91XXXXXXXXXX` |
| is_whatsapp | BOOLEAN | NO | true | |
| email | TEXT | YES | | |
| whatsapp_verified | BOOLEAN | NO | false | |
| consent_accepted_at | TIMESTAMPTZ | YES | | |
| can_donate | BOOLEAN | NO | false | |
| can_request | BOOLEAN | NO | false | |
| trust_report_count | INTEGER | NO | 0 | |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | now() | |

**Constraints (live):**
- `profiles_phone_format`: `phone ~ '^91[6-9][0-9]{9}$'`
- `profiles_whatsapp_format`: `whatsapp_phone ~ '^91[6-9][0-9]{9}$'`
- `profiles_has_role`: **DROPPED** (was `can_donate OR can_request`)
- `role` column: **DROPPED**

#### `auth_profile_links`
Links Supabase Auth users to profiles (1:1).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| auth_user_id | UUID | NO | | PK, FK → auth.users(id) ON DELETE CASCADE |
| profile_id | UUID | NO | | FK → profiles(id) ON DELETE CASCADE |
| provider | TEXT | YES | | e.g. "phone", "google", "legacy" |
| created_at | TIMESTAMPTZ | NO | now() | |

#### `donor_profiles`
Donor-specific data, extends profiles.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| profile_id | UUID | NO | | PK, FK → profiles(id) ON DELETE CASCADE |
| blood_group | TEXT | YES | | CHECK: valid blood types |
| latitude | DOUBLE | YES | | |
| longitude | DOUBLE | YES | | |
| address_text | TEXT | YES | | |
| pincode | TEXT | YES | | |
| area | TEXT | YES | | |
| city | TEXT | YES | | |
| state | TEXT | YES | | |
| last_donation_date | DATE | YES | | |
| cooldown_until | DATE | YES | | |
| health_self_declaration | BOOLEAN | NO | false | |
| is_available | BOOLEAN | NO | false | |
| profile_complete | BOOLEAN | NO | false | |
| emergency_only | BOOLEAN | NO | false | |
| number_sharing_pref | TEXT | NO | 'on_approval' | |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | now() | |

---

### Workflow Tables (Active)

#### `blood_requests`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid_generate_v4() | PK |
| tracking_code | TEXT | NO | | UNIQUE |
| patient_name | TEXT | NO | | |
| patient_age | INTEGER | YES | | |
| patient_gender | TEXT | YES | | |
| blood_type_needed | TEXT | NO | | |
| component_needed | TEXT | YES | | |
| units_required | INTEGER | NO | 1 | |
| hospital_name | TEXT | NO | | |
| hospital_uhid | TEXT | YES | | |
| attending_doctor | TEXT | YES | | |
| hospital_pincode | TEXT | NO | | |
| hospital_area | TEXT | YES | | |
| hospital_city | TEXT | YES | | |
| hospital_state | TEXT | YES | | |
| hospital_district | TEXT | YES | | |
| urgency_level | TEXT | NO | 'urgent' | |
| requester_id | TEXT | YES | | FK → requesters(id) ⚠️ |
| requester_name | TEXT | NO | | |
| requester_email | TEXT | NO | | |
| requester_phone | TEXT | NO | | |
| additional_notes | TEXT | YES | | |
| status | TEXT | YES | 'open' | |
| showcase_opt_in | BOOLEAN | NO | false | Added by core_migration |
| share_contact_immediately | BOOLEAN | YES | false | |
| requester_profile_id | UUID | YES | | FK → profiles(id), added by auth_profile_migration |
| requester_phone_verified_at | TIMESTAMPTZ | YES | | |
| requester_consent_accepted_at | TIMESTAMPTZ | YES | | |
| expires_at | TIMESTAMPTZ | YES | | |
| fulfilled_at | TIMESTAMPTZ | YES | | |
| created_at | TIMESTAMPTZ | YES | now() | |
| updated_at | TIMESTAMPTZ | YES | now() | |

> ⚠️ `requester_id` has FK → `requesters(id)`. Server code writes `profiles.id` here. FK may be violated unless constraint was dropped outside tracked SQL files.

#### `matches`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| request_id | UUID | FK → blood_requests(id) ON DELETE CASCADE |
| donor_id | TEXT | FK → users(id) |
| match_rank | INTEGER | default 1 |
| notification_channel | TEXT | default 'dashboard' |
| donor_response | TEXT | default 'pending' |
| distance_km | NUMERIC | |
| is_exact_match | BOOLEAN | default true |
| + timestamp columns | | |

#### `notifications`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| type | TEXT | required |
| recipient_type | TEXT | required |
| recipient_id | TEXT | required |
| trigger_event | TEXT | required |
| message_body | TEXT | required |
| status | TEXT | default 'queued' |
| + timestamp columns | | |

#### `request_events`
Audit trail for blood request lifecycle.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK, gen_random_uuid() |
| request_id | TEXT | |
| event | TEXT | e.g. 'created', 'broadcasting' |
| actor | TEXT | default 'system' |
| meta | JSONB | |
| at | TIMESTAMPTZ | default now() |

#### `request_reports`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| request_id | UUID | FK → blood_requests(id) ON DELETE CASCADE |
| reporter_profile_id | UUID | FK → profiles(id) ON DELETE CASCADE |
| requester_phone | TEXT | required |
| reason | TEXT | 3-500 chars |
| created_at | TIMESTAMPTZ | |

---

### Legacy Tables (Dead — kept for FK compatibility)

#### `users`
Original donor table. Still referenced by `matches.donor_id` FK. Server syncs new donors here.

#### `requesters`
Original requester table. Still referenced by `blood_requests.requester_id` FK. **Dead — no code writes here for new signups.**

#### `donation_log`, `forum_posts`, `forum_comments`
Legacy tables, no active writes.

---

## RLS Policies (Live Behavior — Empirically Tested)

| Table | Anon SELECT | Anon INSERT | Notes |
|-------|-------------|-------------|-------|
| profiles | Returns 0 (owner-only) | **BLOCKED** | Correct — service_role writes |
| donor_profiles | Returns 0 (owner-only) | Not tested | |
| auth_profile_links | Returns 0 (owner-only) | Not tested | |
| blood_requests | Returns matching rows | Not tested | SELECT allows `status='open'` |
| matches | Returns 0 | Not tested | |
| notifications | Returns 0 | Not tested | |
| users | Returns 0 | Not tested | |
| requesters | Returns 0 | Not tested | |
| request_events | Returns 0 | Not tested | |
| request_reports | Returns 0 | Not tested | |

---

## Functions (Live)

- `normalize_indian_phone(TEXT)` → strips to `91XXXXXXXXXX`
- `link_verified_auth_profile(...)` → SECURITY DEFINER, service_role only
- `update_updated_at_column()` → trigger function for `updated_at`

## Triggers (Live)

- `set_updated_at_profiles` on `profiles`
- `set_updated_at_donor_profiles` on `donor_profiles`
- `set_updated_at_users` on `users`
- `set_updated_at_requesters` on `requesters`
- `set_updated_at_requests` on `blood_requests`
- `set_updated_at_forum` on `forum_posts`
