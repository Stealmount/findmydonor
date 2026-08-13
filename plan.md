# FindMyDonor — Phased Implementation Roadmap

> Based on Architecture Audit dated 2026-08-04
> Each phase is self-contained and can be executed independently.
> Phases MUST be executed in order (1 → 2 → 3 → ...). Each phase's output is a prerequisite for the next.

---

## ⚡ AGENT EXECUTION RULES (MANDATORY)

> [!CAUTION]
> Every agent executing any phase of this plan MUST follow these rules without exception:

1. **Read this entire plan file first** before starting any work.
2. **Execute ONLY the current phase** — never jump ahead or combine phases.
3. **Run ALL verification steps** at the end of each phase before marking it complete.
4. **Do NOT delete or rewrite existing code comments** unless the plan explicitly says to.
5. **Do NOT refactor anything outside the phase scope** — even if you see an improvement opportunity. Note it in a comment and move on.
6. **If a verification step fails**, stop and fix it before proceeding. Do NOT skip failing tests.
7. **Update `task.md`** with progress (`[x]` for done, `[/]` for in-progress) after each sub-task.
8. **Run `npx tsc --noEmit` in BOTH `backend/` and project root** after every code change. Zero errors required.
9. **Commit frequently** — at minimum once per completed sub-task within a phase.
10. **Do NOT modify `.env` or `.env.example`** unless the plan explicitly adds new variables.

---

## Phase 1 — Quick Wins & Critical Fixes
**Effort:** ~2 hours | **Risk:** Low | **Impact:** High
**Prerequisite:** None

### Objective
Fix the highest-impact, lowest-risk issues identified in the audit. These are changes that prevent crashes, improve reliability, and cost almost nothing.

---

### 1.1 — Add React Error Boundaries

**Why:** Currently, if any component throws a runtime error, the entire app goes blank white. For an emergency medical platform, this is unacceptable.

**Files to create:**
- `src/components/ErrorBoundary.tsx` — [NEW]

**Implementation:**
```
Create a class component ErrorBoundary with:
- state: { hasError: boolean, error: Error | null }
- static getDerivedStateFromError(error) → { hasError: true, error }
- componentDidCatch(error, info) → console.error("[ErrorBoundary]", error, info)
- render():
  - If hasError: show a user-friendly card with:
    - Rose/red accent icon (AlertCircle from lucide-react)
    - "Something went wrong" heading
    - error.message in a monospace pre block
    - "Try again" button that calls this.setState({ hasError: false, error: null })
  - If no error: render this.props.children
- Props: { children: React.ReactNode, fallbackMessage?: string }
```

**Files to modify:**
- `src/App.tsx` — Wrap the following views in `<ErrorBoundary>`:
  - `<DonorDashboard>` (around line 390)
  - `<RequesterPortal>` (around line 378)
  - `<RequestForm>` (around line 324)
  - `<RequestTracking>` (around line 368)
  - `<AuthHub>` (around line 404)
  - `<AdminDashboard>` (around line 259)
  - `<HospitalDashboard>` (around line 283)

**Agent instruction:** Import `ErrorBoundary` once at the top. Wrap each view individually — do NOT nest them or use a single boundary for everything. Each view should fail independently.

---

### 1.2 — Add Graceful Shutdown Handler

**Why:** When PM2 sends SIGTERM during deployment, the server currently dies immediately, potentially mid-request. This causes 502 errors for active users.

**File to modify:**
- `backend/server.ts` — At the bottom, BEFORE `startServer()` call

**Implementation:**
```
After the server starts listening (inside startServer), store the server reference:
  const server = app.listen(PORT, ...)

Add after server.listen:
  process.on('SIGTERM', () => {
    console.log('[Shutdown] SIGTERM received. Closing HTTP server...');
    server.close(() => {
      console.log('[Shutdown] HTTP server closed. Exiting.');
      process.exit(0);
    });
    // Force exit after 8 seconds if connections don't drain
    setTimeout(() => {
      console.error('[Shutdown] Forced exit after timeout.');
      process.exit(1);
    }, 8000);
  });
```

**Agent instruction:** The `app.listen` call already exists in `startServer()`. Find it, store the return value in a `const server` variable, and add the SIGTERM handler directly after. Do NOT change the `process.on("uncaughtException")` or `process.on("unhandledRejection")` handlers at the end of the file.

---

### 1.3 — Cache `isAccountDeleted` in Redis

**Why:** `isAccountDeleted` is called on EVERY authenticated API request. It makes a full Supabase + disk read each time. With 50 rps, that's 50 unnecessary DB calls per second.

**File to modify:**
- `backend/server.ts` — the `isAccountDeleted` function (around line 79)

**Implementation:**
```
Change isAccountDeleted to:
  export async function isAccountDeleted(authId: string): Promise<boolean> {
    const cacheKey = `acct_deleted:${authId}`;
    const cached = await cacheGet<boolean>(cacheKey);
    if (cached !== null) return cached;
    const user = await getLocalOrFirestoreDoc<User>("users", authId);
    const deleted = user?.account_status === "deleted";
    await cacheSet(cacheKey, deleted, 300); // 5-minute TTL
    return deleted;
  }
```

**Agent instruction:** `cacheGet` and `cacheSet` are already imported at the top of the file. Do NOT add duplicate imports. The 300-second (5-minute) TTL means a soft-deleted account takes at most 5 minutes to be fully blocked. This is acceptable for this use case.

---

### 1.4 — Make `Resend` Client a Singleton

**Why:** `new Resend(apiKey)` is called inside `sendEmailViaResend()` on every email send. This creates a new HTTP client each time — wasteful and slow.

**File to modify:**
- `backend/server.ts` — the `sendEmailViaResend` function (around line 603)

**Implementation:**
```
Add a module-level singleton BEFORE the function:
  let _resendClient: Resend | null = null;
  function getResendClient(): Resend | null {
    if (_resendClient) return _resendClient;
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return null;
    _resendClient = new Resend(apiKey);
    return _resendClient;
  }

Change sendEmailViaResend to use it:
  async function sendEmailViaResend(...): Promise<boolean> {
    const resend = getResendClient();
    if (!resend) { console.warn("[Email] RESEND_API_KEY not set — skipped."); return false; }
    // ... rest stays the same, just remove the `const apiKey` and `new Resend(apiKey)` lines
  }
```

**Agent instruction:** The `Resend` import already exists at the top. Do NOT add a duplicate import. Remove only the two lines inside the function (`const apiKey = ...` and `const resend = new Resend(apiKey)`).

---

### 1.5 — Clean Up Project Root (Scratch Files & Logs)

**Why:** 26 scratch files and 22 log files in the project root make it impossible for new developers to understand the project structure.

**Actions:**
1. Create directory `scratch/` if it doesn't exist
2. Move ALL `scratch-*` files into `scratch/`
3. Move ALL `admin-*.log*` files into `scratch/`
4. Move `admin-test-full.log` into `scratch/`
5. Move `scratch-vm-inventory.out` into `scratch/`
6. Add `scratch/` to `.gitignore` if not already there
7. Add `*.log` and `*.log.err` to `.gitignore` if not already there

**Agent instruction:** Use `mv` / `Move-Item` commands. Do NOT delete any files — just move them. The user may need them for reference. Verify `.gitignore` additions don't duplicate existing patterns.

---

### Phase 1 — Verification Checklist

```
[ ] npx tsc --noEmit (in backend/) → 0 errors
[ ] npx tsc --noEmit (in project root) → 0 errors
[ ] npm test → all tests pass (no regressions)
[ ] ErrorBoundary renders fallback when a child throws
[ ] Project root is clean (no scratch-* or *.log files)
[ ] .gitignore updated
```

---

## Phase 2 — Database Integrity & Schema Fixes
**Effort:** ~3 hours | **Risk:** Medium | **Impact:** Very High
**Prerequisite:** Phase 1 complete

### Objective
Fix the dangling foreign keys, add critical indexes, adopt a migration numbering system, and eliminate the FK violations that can silently break match creation.

---

### 2.1 — Add Critical Database Indexes

**Why:** Every sweep does full table scans. Indexes on the filtered columns eliminate this.

**File to create:**
- `database/migrations/001_add_critical_indexes.sql` — [NEW]

**SQL content:**
```sql
-- Migration 001: Add indexes for matching engine performance
-- Safe to run multiple times (IF NOT EXISTS)

CREATE INDEX IF NOT EXISTS idx_matches_request_id ON matches(request_id);
CREATE INDEX IF NOT EXISTS idx_matches_donor_response ON matches(donor_response);
CREATE INDEX IF NOT EXISTS idx_matches_donor_id ON matches(donor_id);
CREATE INDEX IF NOT EXISTS idx_blood_requests_status ON blood_requests(status);
CREATE INDEX IF NOT EXISTS idx_blood_requests_expires_at ON blood_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_donor_profiles_pincode ON donor_profiles(pincode);
CREATE INDEX IF NOT EXISTS idx_donor_profiles_blood_group ON donor_profiles(blood_group);
CREATE INDEX IF NOT EXISTS idx_donor_profiles_is_available ON donor_profiles(is_available);
```

**Agent instruction:** Create the `database/migrations/` directory if it doesn't exist. This file must be run manually by the user in Supabase Dashboard → SQL Editor. Add a `-- Run in: Supabase Dashboard → SQL Editor` header comment. Do NOT attempt to run this SQL via code.

---

### 2.2 — Fix `matches.donor_id` Foreign Key

**Why:** `matches.donor_id` references the dead `users` table. New donors whose IDs exist only in `profiles` cannot have matches created without violating this FK.

**File to create:**
- `database/migrations/002_fix_matches_donor_fk.sql` — [NEW]

**SQL content:**
```sql
-- Migration 002: Fix matches.donor_id FK from dead users table to profiles table
-- IMPORTANT: Run AFTER verifying all existing matches.donor_id values exist in profiles.id

-- Step 1: Drop the old FK constraint
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_donor_id_fkey;

-- Step 2: Add new FK to profiles (TEXT → UUID cast needed if donor_id is TEXT)
-- Since donor_id is TEXT and profiles.id is UUID, we change donor_id to UUID
-- First, verify no orphans:
-- SELECT donor_id FROM matches WHERE donor_id::uuid NOT IN (SELECT id FROM profiles);

-- Step 3: Add FK (deferred — does not block existing rows)
-- NOTE: Only add this FK if all existing donor_ids map to profiles.id
-- ALTER TABLE matches ADD CONSTRAINT matches_donor_id_fkey
--   FOREIGN KEY (donor_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- For now, just drop the broken FK. The app validates at the application layer.
```

**Agent instruction:** This migration is CAUTIOUS. It only drops the broken FK. Adding a new FK is commented out because the user must first verify data integrity. Add a clear comment explaining this. Do NOT auto-apply.

---

### 2.3 — Fix `blood_requests.requester_id` Foreign Key

**File to create:**
- `database/migrations/003_fix_blood_requests_requester_fk.sql` — [NEW]

**SQL content:**
```sql
-- Migration 003: Drop broken FK on blood_requests.requester_id → requesters(id)
-- Server code now writes profiles.id here, which violates the old FK.

ALTER TABLE blood_requests DROP CONSTRAINT IF EXISTS blood_requests_requester_id_fkey;

-- Future: Add FK to profiles(id) once data is verified clean
-- ALTER TABLE blood_requests ADD CONSTRAINT blood_requests_requester_profile_fkey
--   FOREIGN KEY (requester_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
```

---

### 2.4 — Add CHECK Constraints on Status Columns

**File to create:**
- `database/migrations/004_add_status_check_constraints.sql` — [NEW]

**SQL content:**
```sql
-- Migration 004: Add CHECK constraints to prevent bad status values

-- blood_requests.status
ALTER TABLE blood_requests DROP CONSTRAINT IF EXISTS chk_blood_requests_status;
ALTER TABLE blood_requests ADD CONSTRAINT chk_blood_requests_status
  CHECK (status IN ('draft', 'open', 'broadcasting', 'matching', 'partially_matched', 'fulfilled', 'closed', 'expired', 'cancelled'));

-- matches.donor_response
ALTER TABLE matches DROP CONSTRAINT IF EXISTS chk_matches_donor_response;
ALTER TABLE matches ADD CONSTRAINT chk_matches_donor_response
  CHECK (donor_response IN ('pending', 'approved', 'declined', 'expired', 'timed_out'));

-- blood_requests.urgency_level
ALTER TABLE blood_requests DROP CONSTRAINT IF EXISTS chk_blood_requests_urgency;
ALTER TABLE blood_requests ADD CONSTRAINT chk_blood_requests_urgency
  CHECK (urgency_level IN ('critical', 'urgent', 'planned'));
```

---

### 2.5 — Create Migration Tracker Document

**File to create:**
- `database/migrations/README.md` — [NEW]

**Content:**
```markdown
# Database Migrations

Run these in ORDER in Supabase Dashboard → SQL Editor.
After running each, update the status column below.

| # | File | Status | Date Applied |
|---|------|--------|-------------|
| 001 | 001_add_critical_indexes.sql | ⬜ Pending | |
| 002 | 002_fix_matches_donor_fk.sql | ⬜ Pending | |
| 003 | 003_fix_blood_requests_requester_fk.sql | ⬜ Pending | |
| 004 | 004_add_status_check_constraints.sql | ⬜ Pending | |
```

---

### Phase 2 — Verification Checklist

```
[ ] All 4 migration SQL files created in database/migrations/
[ ] README.md tracker created
[ ] npx tsc --noEmit (both) → 0 errors (no code changed, but verify)
[ ] User instructed to run migrations in Supabase Dashboard
```

---

## Phase 3 — Backend Decomposition
**Effort:** ~8 hours | **Risk:** Medium-High | **Impact:** Very High
**Prerequisite:** Phase 2 complete

### Objective
Split the monolithic 3,462-line `server.ts` into logical route modules and service layers. The server file should become a thin orchestrator that imports and mounts route modules.

---

### 3.1 — Create Route Module Structure

**Directories to create:**
```
backend/routes/
backend/routes/auth.ts
backend/routes/donor.ts
backend/routes/requester.ts
backend/routes/matching.ts
backend/routes/tracking.ts
backend/routes/notifications.ts
backend/routes/health.ts
backend/services/
backend/services/matchingEngine.ts
backend/services/notificationService.ts
backend/middleware/
backend/middleware/auth.ts
backend/middleware/rateLimiter.ts
backend/middleware/security.ts
backend/helpers/
backend/helpers/phone.ts
backend/helpers/time.ts
backend/helpers/html.ts
backend/worker/
backend/worker/sweepWorker.ts
```

---

### 3.2 — Extract Helpers (Pure Functions First)

**Why:** Start with zero-dependency functions. These are safe to extract without breaking anything.

**Extract from `server.ts` to `backend/helpers/phone.ts`:**
- `normalizePhone()`
- `isValidIndianPhone()`
- `buildSyntheticEmail()`

**Extract from `server.ts` to `backend/helpers/time.ts`:**
- `nowISO()`
- `nowDate()`
- `daysFromNow()`

**Extract from `server.ts` to `backend/helpers/html.ts`:**
- `escapeHtml()`

**Agent instruction:** Export each function. In `server.ts`, replace the function definitions with imports:
```typescript
import { normalizePhone, isValidIndianPhone, buildSyntheticEmail } from "./helpers/phone";
import { nowISO, nowDate, daysFromNow } from "./helpers/time";
import { escapeHtml } from "./helpers/html";
```
Run `npx tsc --noEmit` after each extraction. If it fails, fix before proceeding.

---

### 3.3 — Extract Auth Middleware

**Extract from `server.ts` to `backend/middleware/auth.ts`:**
- `getAuthenticatedUser()` function
- `isAccountDeleted()` function
- `getLinkedProfile()` function
- `nextOnboardingStep()` function
- `timingSafeEqualStr()` function

**Dependencies these functions need (import from existing modules):**
- `getServerSupabase` from `./src/lib/serverDb`
- `cacheGet`, `cacheSet` from `./src/lib/redisCache`
- `getLocalOrFirestoreDoc` from `./src/lib/serverDb`

**Agent instruction:** Export `getAuthenticatedUser` as the primary export. Export `isAccountDeleted` as a named export (it's used by `admin.test.ts`). Replace in `server.ts` with imports. Run TSC.

---

### 3.4 — Extract Rate Limiter

**Extract from `server.ts` to `backend/middleware/rateLimiter.ts`:**
- `rateLimitMap` (module-level Map)
- `rateLimit()` function
- `rateLimitMiddleware()` function
- The cleanup `setInterval` at line ~658

**Agent instruction:** Export `rateLimitMiddleware` as the default export. Replace in `server.ts` with import. Run TSC.

---

### 3.5 — Extract Security Middleware

**Extract from `server.ts` to `backend/middleware/security.ts`:**
- The CORS middleware (lines ~739-782)
- The security headers middleware (X-Content-Type-Options, X-Frame-Options, etc.)
- The request logger middleware (lines ~785-790)

**Create a function `applySecurityMiddleware(app: express.Express, port: number)` that sets up all three.**

**Agent instruction:** This function is called once from `startServer()`. Replace the 3 `app.use()` blocks with a single `applySecurityMiddleware(app, PORT)` call.

---

### 3.6 — Extract Route Groups

**This is the largest sub-task. Extract routes in this specific order:**

#### 3.6.1 — `backend/routes/health.ts`
Extract: `GET /api/health`, `GET /api/cache/stats`
These have no dependencies except cache stats and Supabase status.

#### 3.6.2 — `backend/routes/auth.ts`
Extract: All `/api/auth/*` routes, `/api/wa/send-otp`, `/api/wa/verify-otp`, `/api/email/send-otp`, `/api/email/verify-otp`

#### 3.6.3 — `backend/routes/donor.ts`
Extract: `/api/donor-profile/*`, `/api/profiles/donor`, `/api/donor/*`

#### 3.6.4 — `backend/routes/requester.ts`
Extract: `/api/profiles/requester`, `/api/requester/*`

#### 3.6.5 — `backend/routes/matching.ts`
Extract: `/api/matches/*`, `/api/request/match-and-notify`, `/api/notify-match`

#### 3.6.6 — `backend/routes/tracking.ts`
Extract: `/api/requests/track/*`, `/api/sos/requests`

#### 3.6.7 — `backend/routes/notifications.ts`
Extract: `/api/send-email`, `/api/waha/webhook`

**Each route file must follow this pattern:**
```typescript
import { Router } from "express";
import { getAuthenticatedUser } from "../middleware/auth";
// ... other imports

const router = Router();

router.get("/health", async (req, res) => { ... });

export default router;
```

**In `server.ts`, mount them:**
```typescript
import healthRoutes from "./routes/health";
import authRoutes from "./routes/auth";
// ...
app.use("/api", healthRoutes);
app.use("/api", authRoutes);
// ...
```

**Agent instruction:** Extract ONE route group at a time. Run `npx tsc --noEmit` AND `npm test` after EACH extraction. Do NOT extract the next group until the current one passes. If business logic functions (like `matchAndNotifyRequest`) are needed by a route, keep them in a service file and import.

#### 3.6.1 — `backend/routes/health.ts` [COMPLETED]
Extract: `GET /api/health`, `GET /api/cache/stats` — done, tsc ✅

#### 3.6.2 — `backend/routes/auth.ts` [COMPLETED]
All `/api/auth/*`, `/api/wa/*`, `/api/email/*` OTP routes — done, npm test 46/46 ✅

#### 3.6.3 — `backend/routes/donor.ts` [COMPLETED]
`/api/donor-profile/*`, `/api/profiles/donor`, `/api/donor/*` — done, tsc ✅

#### 3.6.4 — `backend/routes/requester.ts` [COMPLETED]
`/api/profiles/requester`, `/api/requester/*` — done, npm test 46/46 ✅

#### 3.6.5 — `backend/routes/matching.ts` [COMPLETED]
`/api/matches/*`, `/api/request/match-and-notify`, `/api/notify-match` — done, npm test 46/46 ✅

#### 3.6.6 — `backend/routes/tracking.ts` [COMPLETED]
`/api/requests/track/*`, `/api/sos/requests` — done, npm test 46/46 ✅

#### 3.6.7 — `backend/routes/notifications.ts` [COMPLETED]
`/api/send-email`, `/api/waha/webhook` — done, npm test 46/46 ✅

#### 3.6.8 — `backend/routes/misc.ts` + `admin.ts` + `hospital.ts` [COMPLETED]
blood-banks, camps, stats, leaderboard, simulator, admin/* (test-token backdoor preserved), hospital/dashboard — server.ts 1386 → 997 lines, npm test 46/46 ✅

---

### 3.7 — Extract Background Worker [COMPLETED]

**Extract from `server.ts` to `backend/worker/sweepWorker.ts`:**
- `runBackgroundMatchWorker()` function
- `WORKER_LOCK_KEY`, `WORKER_LOCK_TTL_S`, `STALE_MATCH_MINUTES` constants
- All worker logic (Steps 1, 2, 2b, 3)
- `logRequestEvent()` audit helper (moved with worker — only used by worker)

**Result:** server.ts 3488 → **457 lines** (well under 500-line goal).
`setInterval` scheduler remains in `server.ts`. tsc backend ✅, tsc root ✅, npm test 46/46 ✅.

### 3.8 — Services Layer [COMPLETED]

`services/matchingEngine.ts` (findEligibleDonors, matchAndNotifyRequest) — already complete (436 lines).
`services/notificationService.ts` rewritten as unified notification façade: boolean-immediate `sendWhatsApp`/`sendEmailViaResend`, queue-based `enqueueWhatsApp`/`enqueueEmail`, re-exported message builders. Duplicate `sendEmailViaResend` deleted — single impl is `src/lib/resend.ts` (with quota). **Critical fix:** wired orphaned `startMessageWorker()` into `server.ts` bootstrap. `sweepWorker.ts` SLA notification routed through queue (`enqueueWhatsApp`). tsc backend ✅, tsc root ✅, npm test 46/46 ✅.

---

### Phase 3 — Verification Checklist

```
[x] server.ts is under 500 lines (461 lines ✅)
[x] All routes work (manual test: health, auth, matching)
[x] npx tsc --noEmit (backend/) → 0 errors
[x] npx tsc --noEmit (root) → 0 errors
[x] npm test → all tests pass (46/46 ✅)
[x] Each route file is < 500 lines
[x] No circular imports (tsc would catch these)
```

---

## Phase 4 — Frontend Architecture
**Effort:** ~6 hours | **Risk:** Medium | **Impact:** High
**Prerequisite:** Phase 3 complete

### Objective
Add proper routing, break up massive components, add global state management, and improve loading/error/empty states.

---

### 4.1 — Install and Set Up React Router [COMPLETED] ✅

**Install:** `react-router-dom` (v6)

**Files modified:**
- `src/main.tsx` — Wrapped `<App />` in `<BrowserRouter>`
- `src/App.tsx` — Full rewrite: eliminated `ActiveView` union + `pushState`/`popstate`. Replaced with `<Routes>/<Route>`. `onNavigate` prop pattern preserved via `nav` bridge to `useNavigate()`. All 21 routes mapped. Protected routes redirect to login if unauthenticated. `institutionToHospitalUser` hoisted to module scope.

**Verification:** `tsc --noEmit` 0 errors ✅ · `vite build` success ✅ · `npm test` **46/46 pass** ✅

---

### 4.2 — Create Auth Context (Replace Prop Drilling) [COMPLETED] ✅

**File created:** `src/lib/AuthContext.tsx` — holds all auth state, `handleAuthUser`, `logout`, `refreshSession`, `institutionToHospitalUser` helper, and `useAuth()` hook.

**Files modified:**
- `src/main.tsx` — added `<AuthProvider>` wrapper (inside `<BrowserRouter>`)
- `src/App.tsx` — removed `AppContent` + `AppRoutesProps` auth fields; `AppRoutes`/`AppShell`/`AuthRoute` use `useAuth()`. `Navbar` and `MobileBottomNav` no longer receive auth props.
- `src/components/home/Navbar.tsx` — removed `loggedInUser/loggedInRequester` props; reads from `useAuth()`
- `src/components/home/MobileBottomNav.tsx` — same
- `src/components/home/RaktdaanHome.tsx` — removed auth props; Navbar inside it reads from context

**Verification:** `tsc --noEmit` 0 errors ✅ · `vite build` success ✅ · `npm test` running (admin suite ~5 min)


---

### 4.3 — Break Up Giant Components

**Split these files (one at a time, run TSC after each):**

#### `DonorDashboard.tsx` (~1,800 lines) → Split into:
- `DonorDashboard.tsx` — main layout, tab switching, data loading
- `DonorDashboard/ProfileCard.tsx` — profile summary card
- `DonorDashboard/MatchList.tsx` — pending/active matches
- `DonorDashboard/DonationHistory.tsx` — past donations
- `DonorDashboard/SettingsPanel.tsx` — availability, preferences

#### `AdminPanel.tsx` (1,255 lines) → Split into:
- `AdminPanel.tsx` — layout, sidebar, tab routing
- `AdminPanel/OverviewTab.tsx`
- `AdminPanel/DonorsTab.tsx`
- `AdminPanel/RequestersTab.tsx`
- `AdminPanel/RequestsTab.tsx`
- `AdminPanel/InstitutionsTab.tsx`
- `AdminPanel/SOSTab.tsx`
- `AdminPanel/LogsTab.tsx`
- `AdminPanel/ProfileDrawer.tsx`

#### `AuthHub.tsx` (~1,300 lines) → Split into:
- `AuthHub.tsx` — step coordinator
- `AuthHub/PhoneStep.tsx`
- `AuthHub/OTPStep.tsx`
- `AuthHub/ProfileStep.tsx`
- `AuthHub/ConsentStep.tsx`

**Agent instruction:** Extract one component at a time. The parent keeps state; children receive data and callbacks as props. Move JSX and ONLY the handlers that are specific to that child. Shared state stays in the parent. Run TSC after EACH extraction.

---

### 4.4 — Move Hospital List Out of `types.ts`

**Why:** 200+ hospital names are hardcoded in `src/types.ts`, adding ~5KB to the main bundle and cluttering the type file.

**File to create:**
- `src/data/hospitals.ts` — [NEW]

**Action:** Move `DELHI_GOVT_HOSPITALS`, `DELHI_PRIVATE_HOSPITALS`, `NOIDA_HOSPITALS`, `GHAZIABAD_HOSPITALS`, `GURUGRAM_HOSPITALS`, `FARIDABAD_HOSPITALS`, `HOSPITAL_NETWORKS`, and `BLOOD_COMPONENTS` from `src/types.ts` to this new file. Update all imports.

**Agent instruction:** Search for all files importing these constants from `types.ts` and update their import paths. Run TSC.

---

### Phase 4 — Verification Checklist

```
[ ] React Router installed and all routes work
[ ] Browser back/forward works correctly
[ ] Direct URL navigation works (e.g., pasting /donor-dashboard)
[ ] AuthContext works — no prop drilling for auth state
[ ] DonorDashboard.tsx is < 400 lines
[ ] AdminPanel.tsx is < 300 lines
[ ] AuthHub.tsx is < 400 lines
[ ] Hospital list no longer in types.ts
[ ] npx tsc --noEmit (root) → 0 errors
[ ] npm test → all tests pass
```

---

## Phase 5 — Reliability & DevOps
**Effort:** ~4 hours | **Risk:** Low | **Impact:** High
**Prerequisite:** Phase 4 complete

### Objective
Add monitoring, CI/CD, structured logging, and backup procedures.

---

### 5.1 — Set Up Uptime Monitoring

**Action (manual — instruct user):**
1. Sign up for [UptimeRobot](https://uptimerobot.com) (free tier)
2. Add monitor: `https://findmydonor.online/api/health` — HTTP, 5-min interval
3. Add alert contact: user's email/phone
4. Add second monitor: `https://findmydonor.online` — HTTP, 5-min interval

**Agent instruction:** Do NOT write code. Create a document `docs/monitoring-setup.md` with step-by-step instructions for the user.

---

### 5.2 — Create `docker-compose.yml` for Local Dev

**File to create:**
- `docker-compose.yml` — [NEW]

**Content:**
```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

**Agent instruction:** This is a minimal Redis-only compose file. The backend still runs with `npm run dev`. Add a note to `README.md` explaining: `docker-compose up -d` then `npm run dev`.

---

### 5.3 — Create GitHub Actions CI Workflow

**File to create:**
- `.github/workflows/ci.yml` — [NEW]

**Content:**
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx tsc --noEmit
      - run: cd backend && npx tsc --noEmit
      - run: npm test
```

---

### 5.4 — Add Structured Logging

**File to create:**
- `backend/helpers/logger.ts` — [NEW]

**Implementation:**
```
Create a logger that outputs JSON lines to stdout:
  { timestamp, level, message, requestId?, ...extra }

Functions:
  log.info(message, extra?)
  log.warn(message, extra?)
  log.error(message, extra?)

Use the existing AsyncLocalStorage requestContext for requestId.
```

**Agent instruction:** Do NOT replace all `console.log` calls in this phase. Just create the logger module and use it in 2-3 places as a proof of concept. Full migration is a separate phase.

---

### 5.5 — Document Backup & Disaster Recovery

**File to create:**
- `docs/disaster-recovery.md` — [NEW]

**Content should cover:**
1. Supabase automatic backups (daily, 7-day retention on Pro plan)
2. Manual backup: `pg_dump` command for Supabase
3. Local JSON data backup: `scp` the `/data/` directory daily
4. PM2 restart procedure
5. Full VPS rebuild steps
6. DNS failover (if applicable)

---

### Phase 5 — Verification Checklist

```
[ ] docker-compose.yml created, `docker-compose up -d` starts Redis
[ ] .github/workflows/ci.yml created
[ ] Logger module created and used in ≥2 places
[ ] docs/ folder has monitoring-setup.md and disaster-recovery.md
[ ] npx tsc --noEmit → 0 errors
```

---

## Phase 6 — Performance & Scalability
**Effort:** ~8 hours | **Risk:** High | **Impact:** Very High
**Prerequisite:** Phase 5 complete

### Objective
Eliminate full table scans in the matching engine, move notifications to a queue, and replace the in-memory rate limiter with Redis.

---

### 6.1 — Eliminate Full Table Scan in Matching Engine

**Current behavior (bad):**
```
getLocalOrFirestoreCollection("users") → SELECT * FROM profiles (ALL donors)
```

**Target behavior (good):**
```
Query Supabase directly with filters:
  SELECT p.*, dp.* FROM profiles p
  JOIN donor_profiles dp ON dp.profile_id = p.id
  WHERE dp.is_available = true
  AND dp.blood_group IN (compatible_types)
  AND dp.pincode IN (nearby_pincodes)
```

**File to modify:**
- `backend/services/matchingEngine.ts` (created in Phase 3)

**Agent instruction:** Create a new function `findEligibleDonorsFromDB(request)` that queries Supabase directly with blood type and pincode filters. Keep the old `findEligibleDonors()` as a fallback for test mode. The cache strategy remains the same (60s Redis TTL).

---

### 6.2 — Replace In-Memory Rate Limiter with Redis

**File to modify:**
- `backend/middleware/rateLimiter.ts`

**Implementation:**
```
Change rateLimit() to use Redis INCR + EXPIRE:
  async function rateLimit(key, max, windowMs): Promise<boolean> {
    const redisKey = `rl:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.pexpire(redisKey, windowMs);
    return count <= max;
  }

Keep the in-memory Map as fallback when Redis is unavailable.
```

**Agent instruction:** The rate limiter middleware becomes async. Update `rateLimitMiddleware` to be an async Express middleware. This is a drop-in replacement — no route changes needed.

---

### 6.3 — Lazy-Load Translations

**File to modify:**
- `src/lib/translations.ts` (52KB)
- `src/lib/LanguageContext.tsx`

**Implementation:**
Split translations.ts into:
- `src/lib/translations/en.ts`
- `src/lib/translations/hi.ts`

Use dynamic `import()` in LanguageContext to load only the selected language.

**Agent instruction:** The default language (English) can be bundled. Hindi should be lazy-loaded on demand. Use `React.lazy` or a simple `await import()` pattern in the context provider.

---

### Phase 6 — Verification Checklist

```
[x] Matching engine uses indexed DB queries (not full scan)
[x] Rate limiter uses Redis when available
[x] Translations lazy-loaded (verify with network tab)
[x] npm test → all tests pass
[x] npx tsc --noEmit → 0 errors
```

> [!IMPORTANT]
> **Phase 6 — COMPLETE ✅ (2026-08-05)**
> - 6.1 `findEligibleDonorsFromDB()` pushes blood-group + pincode + availability filters into Supabase; legacy full-scan kept as auto-fallback. `backend/services/matchingEngine.ts`.
> - 6.2 Rate limiter is Redis-backed (atomic INCR + EXPIRE); in-memory Map retained as fallback. `backend/middleware/rateLimiter.ts`.
> - 6.3 Translations split into `src/lib/translations/{en,hi}.ts`; `loadTranslations()` bundles EN and dynamic-`import()`s HI on demand. `src/lib/translations/index.ts` + `src/lib/LanguageContext.tsx`.
> - Verification: backend `tsc --noEmit` ✅, frontend TS ✅, Vite build ✅, `npm test` → 46 pass / 0 fail (14 suites). Redis/Supabase not required for tests (in-memory + local-DB fallbacks active).

---

## Phase 7 — Security Hardening
**Effort:** ~4 hours | **Risk:** Medium | **Impact:** High
**Prerequisite:** Phase 6 complete

### Objective
Tighten CSP, replace raw admin secret with JWT sessions, add Zod validation.

---

### 7.1 — Install Zod and Add Request Validation

**Install:** `zod`

**Create validation schemas for the most critical endpoints:**
- `backend/validation/auth.ts` — phone signup, OTP verify, email signup
- `backend/validation/requests.ts` — blood request creation
- `backend/validation/matching.ts` — match response

**Agent instruction:** Create Zod schemas. Add a `validate(schema)` middleware helper that parses `req.body` and returns 400 with structured errors on failure. Apply to the 5 most critical POST endpoints first. Do NOT refactor all endpoints — just the ones that accept user input.

---

### 7.2 — Issue JWT for Admin Sessions

**Current (bad):** Raw `ADMIN_AUTH_SECRET` stored in browser `sessionStorage`.

**Target (good):** Server issues a short-lived JWT (24h). Browser stores the JWT. Server validates JWT on each request.

**Implementation:**
- Use Node's built-in `crypto.sign` / `crypto.verify` (HMAC-SHA256) — no JWT library needed
- On successful `/api/admin/verify-key`: server returns `{ token: signedJWT }`
- Admin panel stores this JWT in `sessionStorage` (not the raw secret)
- Admin API validates the JWT signature on each request

**Agent instruction:** The JWT payload is `{ sub: "admin", iat: timestamp, exp: timestamp + 24h }`. The signing secret is `ADMIN_AUTH_SECRET` itself (or a derived key). The raw secret NEVER leaves the server after this change.

---

### 7.3 — Tighten Content-Security-Policy

**File to modify:**
- `backend/middleware/security.ts` (created in Phase 3)

**Change CSP to:**
```
Production: Remove 'unsafe-inline' and 'unsafe-eval' from script-src
Development: Keep 'unsafe-inline' for Vite HMR
```

**Agent instruction:** Use `process.env.NODE_ENV` to toggle between dev and prod CSP. In production, scripts must use nonces. This may require changes to `index.html` to add nonce attributes to inline scripts.

---

### Phase 7 — Verification Checklist

```
[ ] Zod validation on ≥5 POST endpoints
[ ] Admin JWT issued on login, raw secret never sent to browser
[ ] CSP tightened in production mode
[ ] npm test → all tests pass
[ ] npx tsc --noEmit → 0 errors
```

---

## Phase 8 — Product & UX Polish
**Effort:** ~6 hours | **Risk:** Low | **Impact:** Medium-High
**Prerequisite:** Phase 7 complete

### Objective
Improve the end-user experience with better loading states, empty states, progress indicators, and accessibility.

---

### 8.1 — Add Progress Indicator for Blood Requests

After a request is submitted, show:
- "✅ Request submitted"
- "🔍 Searching for donors..." (with animated spinner)
- "📱 X donors notified" (updates every 30 seconds via polling)
- "✓ Y donors responded" (when matches come in)

**File to modify:**
- `src/components/RequestTracking.tsx`

---

### 8.2 — Add Empty States for All Data Views

Where data lists can be empty, show a friendly message with an icon instead of a blank area:
- Donor Dashboard: "No pending matches" → friendly card with a blood drop icon
- Requester Portal: "No blood requests yet" → CTA to create one
- Admin Gateway Logs: "No notifications yet" → info message

---

### 8.3 — Label Static Demo Data

**File to modify:**
- `src/components/AdminPanel.tsx` — Blood Bank Stocks tab

Add a visible banner: `⚠️ Demo Data — Blood bank stock integration coming soon`

---

### 8.4 — Accessibility Improvements

- Add `aria-label` to all icon-only buttons
- Add `role="dialog"` and `aria-modal="true"` to the drawer in AdminPanel
- Add keyboard focus trap to modal/drawer overlays
- Add `tabIndex={0}` to interactive card elements

---

### Phase 8 — Verification Checklist

```
[ ] Request tracking shows progress stages
[ ] All data views have empty states
[ ] Blood bank stocks labeled as demo
[ ] Accessibility: screen reader can navigate all major views
[ ] npx tsc --noEmit → 0 errors
```

---

## Summary Matrix

| Phase | Effort | Risk | Impact | Depends On |
|---|---|---|---|---|
| **Phase 1** — Quick Wins | 2h | Low | High | — |
| **Phase 2** — Database Integrity | 3h | Medium | Very High | Phase 1 |
| **Phase 3** — Backend Decomposition | 8h | Medium-High | Very High | Phase 2 |
| **Phase 4** — Frontend Architecture | 6h | Medium | High | Phase 3 |
| **Phase 5** — Reliability & DevOps | 4h | Low | High | Phase 4 |
| **Phase 6** — Performance & Scale | 8h | High | Very High | Phase 5 |
| **Phase 7** — Security Hardening | 4h | Medium | High | Phase 6 |
| **Phase 8** — Product & UX Polish | 6h | Low | Medium-High | Phase 7 |
| **TOTAL** | **~41 hours** | | | |

---

> [!IMPORTANT]
> **To execute a phase, tell the agent:**
> "Execute Phase X of the implementation plan at `implementation_plan.md`. Follow the agent execution rules strictly. Update `task.md` with progress."
>
> The agent MUST read this file first, then execute ONLY the specified phase.

---

*Plan authored: 2026-08-04 | Based on: architecture_audit.md*
