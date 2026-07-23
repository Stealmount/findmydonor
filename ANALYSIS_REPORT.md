# Blood Connect (lahu) - Comprehensive Project Analysis

## Project Overview
**Stack**: React 19 + TypeScript + Vite (Frontend) | Express + TypeScript (Backend) | Supabase (Database) | Redis/ioredis (Cache) | WAHA (WhatsApp) | Resend (Email)
**Architecture**: Monorepo with shared `src/types.ts` + `server.ts` (2636 lines, monolithic Express server)
**Domain**: Blood donation platform for Delhi NCR - donor matching, request tracking, real-time notifications

---

## Architecture Deep Dive

### Backend (`server.ts` - 2636 lines)
**Monolithic Express server** handling:
- Auth (OTP via WAHA/Resend, Supabase Auth)
- Donor registration & dashboard
- Blood request creation & tracking
- Matching engine (geographic tiering + blood compatibility)
- Background worker (2-min interval)
- Notification system (WhatsApp via WAHA, Email via Resend, In-app)
- Legacy/deprecated routes (marked 410 Gone)

**Critical Paths**:
1. `POST /api/auth/otp/request` → OTP via WhatsApp/Email
2. `POST /api/auth/otp/verify` → Supabase session + profile creation
3. `POST /api/requests` → Create request → `matchAndNotifyRequest()` → tiered matching
4. `POST /api/matches/:id/respond` → Donor response → cascade to next donor
4. Background worker (2-min interval): expire requests, expire stale matches, re-match

### Matching Engine (`src/lib/matching.ts`)
**Algorithm**: Pure function `findEligibleDonorsSync(donors[], request, matchedIds)`
- **Eligibility**: Active, WhatsApp verified, profile complete, available, not in cooldown, blood compatible, not requester, not emergency-only for non-critical
- **Geographic Tiering**: 0-3km (Tier 1) → 3-10km (Tier 2) → 10-25km (Tier 3) → 25km+ (Tier 4) → National fallback (Tier 5)
- **Ranking within tier**: Exact match > No cooldown > Earliest cooldown expiry > Most recently updated
- **Rare blood boost** (O-, AB-): Expands tiers if < 3 matches found
- **Distance**: Haversine on pincode centroids with prefix fallback

### Cache Layer (`src/lib/redisCache.ts`)
- Redis (ioredis) with in-memory LRU fallback (500 entries)
- TTL-based expiry, prefix invalidation via SCAN
- Auto-reconnect with exponential backoff
- Stats endpoint for monitoring

### Geo (`src/lib/geo.ts`)
- Haversine formula on pincode centroids (130+ Delhi NCR pincodes)
- Prefix fallback: 5-digit match → clamp 2.5km, 4-digit match → clamp 6km
- Deterministic hash fallback for unknown pincodes

### Database (`supabase_schema.sql`)
Tables: `users` (donors), `profiles`, `donor_profiles`, `auth_profile_links`, `blood_requests`, `matches`, `notifications`, `donation_logs`, `hospital_users`, `admin_users`
Row Level Security policies defined

### Frontend (`src/`)
- **Views**: Landing, DonorRegister, DonorDashboard, RequestForm, RequesterPortal, Tracking, AdminDashboard
- **State**: React Context (AuthContext) + localStorage persistence
- **UI**: Glassmorphism CSS (`index.css`), Framer Motion, Lucide icons
- **Notifications**: Floating NotificationSimulator (bottom-right) for testing

---

## Critical Issues (Bugs & Risks)

### 🔴 CRITICAL - Data Integrity / Race Conditions

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| 1 | **Race condition in `createNextDonorMatch`** | `server.ts:2473-2508` | Duplicate matches, donor double-booking | Use Redis lock per request (`match:lock:{requestId}`) around read-modify-write |
| 2 | **Background worker lock is too weak** | `server.ts:2520-2527` | Overlapping workers in PM2 cluster mode | Use Redis `SET NX EX` atomic lock, not `cacheGet`/`cacheSet` |
| 3 | **No transaction on match creation + notify** | `server.ts:2505-2506` | Match saved but notify fails → donor never notified | Wrap in Supabase transaction or compensate with retry queue |
| 4 | **Donor lock release on request expiry has race** | `server.ts:2552-2558` | Lock released but match not updated | Atomic update: set match expired + release lock in same operation |

### 🔴 CRITICAL - Security / Auth

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| 5 | **No auth middleware on mutating endpoints** | `server.ts` (most PATCH/POST/DELETE) | Unauthorized mutations | Add `requireAuth` middleware using Supabase JWT verification |
| 6 | **OTP verification creates synthetic email** | `server.ts:1100-1150` | Account enumeration, email collision | Use phone-as-identifier in Supabase, or phone-password provider |
| 7 | **No rate limiting on OTP endpoints** | `server.ts:1050-1100` | SMS/Email abuse, cost explosion | Add Redis-backed rate limiter (5/min per phone/IP) |
| 8 | **WAHA session ID exposed in logs** | `server.ts:1800-1900` | Session hijacking if logs exposed | Redact session IDs in logs |

### 🟠 HIGH - Correctness / Logic

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| 9 | **Matching tier logic doesn't respect `units_required`** | `server.ts:1900-1950`, `matching.ts:75-79` | Requests for 5 units only match 1 donor | Match `min(units_required * 2, 10)` donors per request |
| 10 | **Tier expansion ignores `units_required`** | `matching.ts:76-78` | Rare blood gets more donors but not scaled to units | Scale tier expansion by units needed |
| 11 | **Donor lock not checked in `isDonorEligible`** | `matching.ts:8-23` | Locked donors can be re-matched | Check `donor_locked_until > now` |
| 12 | **Background worker re-matches already-matched requests** | `server.ts:2597-2610` | Duplicate notifications, donor fatigue | Track `matched_count` vs `units_required`, skip if satisfied |
| 13 | **Distance calculation uses pincode centroids only** | `geo.ts`, `pincode_coords.ts` | 2-5km error in dense areas | Add lat/lng to donor profile (optional GPS) |
| 14 | **`blood_type_needed` vs `blood_type` field mismatch** | `types.ts:137` vs `types.ts:35` | Type mismatch in matching | Align field names: `blood_type_needed` ↔ `blood_type` |

### 🟡 MEDIUM - Maintainability / Architecture

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| 15 | **Monolithic `server.ts` (2636 lines)** | `server.ts` | Hard to test, review, deploy | Split into routes: `authRoutes`, `requestRoutes`, `matchRoutes`, `donorRoutes`, `adminRoutes` |
| 16 | **Duplicate CRUD patterns** | `server.ts` (lines 2000-2430) | Bug surface area, inconsistent errors | Create `BaseRepository` or use Supabase client directly with helpers |
| 17 | **Legacy routes return 410 but remain in code** | `server.ts:1600-1800` | Dead code, confusion | Remove or move to `legacy/` folder |
| 18 | **No request validation (Zod/Valibot)** | All endpoints | Invalid data reaches DB | Add Zod schemas per route |
| 19 | **Inconsistent error handling** | `server.ts` | Some 500s leak stack traces | Central error handler with structured logging |
| 20 | **Supabase client created per-request in some paths** | `server.ts` | Connection overhead | Use singleton `getServerSupabase()` consistently |

### 🟡 MEDIUM - Performance / Scaling

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| 21 | **`getLocalOrFirestoreCollection` loads ALL records** | `server.ts:100-150` | O(N) memory, kills server at scale | Add pagination, indexes, Supabase query filters |
| 22 | **Background worker loads ALL requests + ALL matches** | `server.ts:2531, 2567` | O(N+M) every 2 min | Query only `status IN ('open','matching')` + `created_at > staleThreshold` |
| 23 | **No database indexes defined** | `supabase_schema.sql` | Full table scans | Add indexes on `blood_requests(status, expires_at)`, `matches(request_id, donor_response)`, `users(pincode, blood_type, account_status)` |
| 24 | **Redis SCAN in `cacheInvalidatePrefix` is O(N)** | `redisCache.ts:113-118` | Blocks Redis on large datasets | Use key naming convention + `UNLINK` async, or Redis keyspace notifications |

### 🟢 LOW - UX / Polish

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| 25 | **No tests for matching engine** | Missing `matching.test.ts` | Regression risk | Add Vitest suite with synthetic donor pools |
| 26 | **NotificationSimulator always visible** | `App.tsx` | UX noise in production | Gate behind `VITE_ENABLE_SIMULATOR` |
| 27 | **Hardcoded hospital list in types** | `types.ts:169-331` | Maintenance burden | Move to Supabase table + admin UI |
| 28 | **No OpenAPI/Swagger docs** | Missing | API discoverability | Add `swagger-jsdoc` + `swagger-ui-express` |
| 29 | **Supabase client throws on missing env** | `supabase.ts:12-14` | Crashes build in CI | Lazy init or graceful degradation |
| 30 | **Pincode coordinates hardcoded (130 entries)** | `pincode_coords.ts` | Incomplete coverage | Integrate India Post API or open dataset |

---

## Quick Wins (1-2 hour fixes)

1. **Add donor lock check** in `isDonorEligible` (Issue #11) - 5 lines
2. **Remove 410 Gone legacy routes** (Issue #17) - delete ~200 lines
3. **Add `donor_locked_until` check** in matching tier filter - prevents double-booking
4. **Gate NotificationSimulator** behind env flag (Issue #26) - 3 lines
5. **Fix field name mismatch** `blood_type_needed` ↔ `blood_type` (Issue #14) - search/replace
6. **Add Redis atomic lock** for background worker (Issue #2) - 10 lines using `SET NX EX`
7. **Add request validation** for `POST /api/requests` with Zod - prevents bad data

---

## Refactoring Roadmap (Priority Order)

### Phase 1: Stabilize (Week 1-2)
- [ ] Fix all 🔴 CRITICAL issues (race conditions, auth, security)
- [ ] Add Zod validation to all mutating endpoints
- [ ] Add database indexes
- [ ] Unit tests for `matching.ts` (100% coverage on pure functions)
- [ ] Integration tests for `/api/requests` → match → respond flow

### Phase 2: Modularize (Week 3-4)
- [ ] Split `server.ts` into route modules + service layer
- [ ] Extract `MatchingService`, `NotificationService`, `AuthService`
- [ ] Add structured logging (pino) with correlation IDs
- [ ] Add OpenAPI spec generation

### Phase 3: Scale (Week 5+)
- [ ] Migrate `getLocalOrFirestoreCollection` to paginated Supabase queries
- [ ] Add Redis-based rate limiting middleware
- [ ] Implement donor GPS coordinates (optional opt-in)
- [ ] Add background job queue (BullMQ) for notifications/matching
- [ ] Multi-region support (beyond Delhi NCR)

---

## Type System Improvements (`src/types.ts`)

```typescript
// Current issues:
// 1. `blood_type_needed` vs `blood_type` inconsistency
// 2. `User` and `DonorProfile` duplicate fields (pincode, blood_type, etc.)
// 3. `RequestStatus` has `broadcasting` and `matching` - unclear distinction
// 4. `MatchStatus` has `timed_out` but worker uses `expired`

// Recommended:
type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'O+' | 'O-' | 'AB+' | 'AB-';
type Component = 'WB' | 'PRBC' | 'SDP' | 'RDP' | 'FFP' | 'CRYO';

interface DonorProfile {
  id: string; // = user.id
  bloodType: BloodType;
  location: { lat: number; lng: number; pincode: string; city: string };
  availability: 'available' | 'notice' | 'unavailable';
  cooldownUntil: string | null;
  lockedUntil: string | null; // unified field
  preferences: { emergencyOnly: boolean; shareNumber: 'on_approval' | 'never' };
  verification: { whatsapp: boolean; aadhaar: boolean; medical: boolean };
  stats: { donations: number; lastDonation: string | null };
}

interface BloodRequest {
  id: string;
  trackingCode: string;
  patient: { name: string; age?: number; gender?: 'M'|'F'|'O'; bloodType: BloodType | 'ANY'; component: Component };
  hospital: { name: string; pincode: string; city: string; uhid?: string; doctor?: string };
  requester: { name: string; phone: string; email: string; userId?: string };
  urgency: 'critical' | 'urgent' | 'planned';
  unitsNeeded: number;
  unitsFulfilled: number;
  status: 'draft' | 'open' | 'matching' | 'partial' | 'fulfilled' | 'expired' | 'cancelled';
  expiresAt: string;
  broadcastToSimulator: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

## Database Indexes Needed

```sql
-- supabase_schema.sql additions
CREATE INDEX idx_blood_requests_status_expires ON blood_requests(status, expires_at);
CREATE INDEX idx_blood_requests_pincode_blood ON blood_requests(hospital_pincode, blood_type_needed);
CREATE INDEX idx_matches_request_status ON matches(request_id, donor_response);
CREATE INDEX idx_matches_donor_status ON matches(donor_id, donor_response);
CREATE INDEX idx_users_pincode_blood_status ON users(pincode, blood_type, account_status);
CREATE INDEX idx_users_locked_until ON users(donor_locked_until) WHERE donor_locked_until IS NOT NULL;
CREATE INDEX idx_notifications_recipient_read ON notifications(recipient_type, recipient_id, read_at);
```

---

## Testing Strategy

```typescript
// matching.test.ts - Critical pure function tests
describe('findEligibleDonorsSync', () => {
  it('excludes donors in cooldown', () => {});
  it('excludes donors with emergency_only for non-critical', () => {});
  it('ranks exact blood match higher than compatible', () => {});
  it('expands tiers for rare blood types (O-, AB-)', () => {});
  it('respects units_required by returning N*2 donors', () => {}); // NEW
  it('excludes donors locked by another match', () => {}); // NEW
  it('filters by geographic tiers correctly', () => {});
  it('falls back to national tier when no local donors', () => {});
});
```

---

## Environment Variables Checklist

```env
# Required
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=  # Server only
REDIS_URL=redis://...
WAHA_BASE_URL=
WAHA_API_KEY=
RESEND_API_KEY=
APP_URL=https://bloodconnect.org
NODE_ENV=production

# Optional
VITE_ENABLE_SIMULATOR=false
RATE_LIMIT_OTP_PER_MIN=5
MATCH_WORKER_INTERVAL_MS=120000
STALE_MATCH_MINUTES=30
```

---

## Summary

**Strengths**: Solid domain model, pure matching logic (testable), Redis cache with fallback, geographic tiering, rare-blood awareness, background worker with cascade re-matching, comprehensive type system.

**Critical Gaps**: Race conditions in matching cascade, no auth on mutations, no rate limiting, monolithic server, O(N) data loading, missing DB indexes, field name inconsistencies.

**Recommended First Action**: Fix race conditions (#1, #2, #3, #4) + add auth middleware (#5) + add donor lock check (#11) + unit tests for matching engine. These 4 changes eliminate the highest-risk production bugs.
