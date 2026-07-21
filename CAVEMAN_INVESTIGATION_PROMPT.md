# CAVEMAN INVESTIGATION PROMPT — 3 BUGS

## BUG 1: DONOR DASHBOARD BOTTOM CUT OFF, BUTTONS DEAD

**File**: `src/components/DonorDashboard.tsx` (900 lines)

**Symptoms**:
- Bottom portion not rendering (scroll cutoff? flex overflow?)
- Buttons "Accept"/"Decline" on match cards don't fire
- `handleMatchDecision` calls `/api/donor/matches/:id/accept` and `/api/matches/:id/decline` — verify endpoints exist in `server.ts`
- Check `loadingMatchId` state — if stuck, buttons disabled forever
- Check `onStateChange` callback — does parent re-render?

**Investigate**:
1. CSS: `.md:col-span-2` + `space-y-8` grid — does right column (`md:col-span-1`) push content down? Check `max-h-screen` / `overflow` ancestors
2. `handleMatchDecision` → `authenticatedApi` call → server route exists? Check `server.ts` lines for `/api/donor/matches/:id/accept` and `/api/matches/:id/decline`
3. `loadingMatchId` race: multiple clicks? `setLoadingMatchId(null)` always runs in `finally`?
4. `onStateChange` passed from `App.tsx` line 316 — does it trigger `loadDashboardData` refetch?
5. Console errors? Network tab shows 404/500 on accept/decline?

**Files**: `DonorDashboard.tsx`, `server.ts` (search `donor/matches`), `App.tsx` (line 313-323)

---

## BUG 2: REQUEST FORM UNWANTED DEFAULTS

**File**: `src/components/RequestForm.tsx` (1000 lines)

**Observed defaults** (lines 27-48):
```ts
patient_name: '',
patient_age: 35,           // ← hardcoded
patient_gender: 'Male',    // ← hardcoded
blood_type_needed: 'O+',   // ← hardcoded
component_needed: BLOOD_COMPONENTS[0],
units_required: 1,         // ← hardcoded
hospital_name: HOSPITAL_NETWORKS[0],  // ← "AIIMS New Delhi"
```

**But user sees**: "sonu"/"Rohan", age 35, Male, O+, 1 unit, AIIMS

**Investigate**:
1. `useEffect` lines 103-113 — merges `loggedInRequester`/`loggedInDonor` into `requester_name/email/phone` ONLY — does NOT touch patient fields
2. Check if `formData` gets hydrated from URL params, localStorage, or parent prop
3. Search `RequestForm` usage in `App.tsx` line 282-289 — any `initialValues` prop? No, only `loggedInRequester`, `loggedInDoner`
4. Check browser autofill — `autocomplete="off"` missing on patient fields?
5. React DevTools: inspect `formData` initial state — where do "sonu"/"Rohan" come from?

**Fix**: Make all patient/hospital fields empty strings by default. Keep `patient_age: ''` not `35`. `blood_type_needed: ''` not `'O+'`. `units_required: ''` not `1`. `hospital_name: ''` not `HOSPITAL_NETWORKS[0]`.

**Files**: `RequestForm.tsx`, `App.tsx` (line 282-289)

---

## BUG 3: SUBMITTED REQUEST NOT IN DASHBOARD

**Flow**: `RequestForm.handleBroadcast` → `POST /api/requests` → `RequesterPortal` calls `GET /api/dashboard/requester`

**Investigate server.ts**:
1. `/api/requests` (line 1192) creates request with `requester_id: requester.id`
2. `requester` resolution (lines 1197-1239): tries `profiles` table first → falls back to legacy `requesters` collection → falls back to donor doc → falls back to creating new from body
3. **Critical**: `requester.id` source differs by path:
   - `profiles` path: `linked.profile.id` (new schema)
   - `requesters` path: `authUser.id` (legacy)
   - Donor fallback: `authUser.id`
   - Body fallback: `authUser.id`
4. `/api/dashboard/requester` (search for it) — what `requester_id` does it query?
5. **Mismatch hypothesis**: Request saved with `requester_id` from one path, dashboard queries with different ID

**Search server.ts for**:
- `/api/dashboard/requester` handler
- How it gets `requester_id` for query
- Compare with `/api/requests` requester resolution logic

**Also check**: `RequesterPortal.tsx` — what endpoint does it call? Line 300 in `App.tsx` passes `currentRequester` — where does that come from?

**Files**: `server.ts` (lines 1192-1270 + dashboard endpoint), `RequesterPortal.tsx`, `App.tsx` (line 300-310)

---

## INVESTIGATION ORDER (PONYTAIL)

1. **RequestForm defaults** — smallest fix, 5 lines change in initial state
2. **Dashboard buttons** — check network tab first, then server route existence
3. **Request not showing** — trace requester_id mismatch in server.ts (biggest impact)

**Each fix**: 
- Read file → find exact lines → minimal diff → verify against fresh zip → commit hash + diff stat
- No refactoring. No "while I'm here." One bug = one commit.

---

## REFERENCE FILES (from uploads)

- `auth_error_analysis.md` — 7 auth bugs, phone normalization root cause
- `implementation_plan.md` — fixes for auth bugs (server.ts normalizePhone, .env WAHA, AuthHub.tsx)
- `caveman.skill` — terse mode rules

**Current commit**: `f87ecfc` (Phase 1 dev OTP bypass done)

---

## TOKEN BUDGET

Use `/caveman` mode. One investigation = one focused prompt. No essays.