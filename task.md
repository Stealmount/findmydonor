# FindMyDonor — Supabase → Firebase Migration Execution Plan

> **Goal**: Replace Supabase (Auth + PostgreSQL) with Firebase (Auth + Firestore) as the sole backend data/auth layer. Regular users sign in with Google only (no phone OTP, no email OTP). Admin panel uses email+password login via Firebase Auth (single admin account). Remove the local JSON fallback (`serverDb.ts` offline mode). Keep Redis caching.

---

## Executive Summary

This plan migrates FindMyDonor from Supabase to Firebase with zero downtime (full cutover). It covers:

1. **Firestore schema design** — Map every Supabase table to a Firestore collection
2. **Firebase Auth setup** — Replace Supabase Auth with Firebase Authentication:
   - **Regular users:** Google sign-in only (no phone OTP, no email OTP)
   - **Admin:** Email+password (single admin account)
3. **Backend refactoring** — Replace `@supabase/supabase-js` with `firebase-admin` SDK; rewrite `serverDb.ts`, `auth.ts` middleware, all routes
4. **Frontend refactoring** — Replace Supabase client with Firebase JS SDK; rewrite `AuthContext.tsx`, `rev3Auth.ts`, `api.ts`, `db.ts`
5. **Admin panel** — Simple email+password login via Firebase Auth; access restricted to one admin email
6. **Data migration** — Export from Supabase, import to Firestore
7. **Security rules** — Firestore security rules replacing Supabase RLS
8. **Testing & verification** — Ensure all 18 test suites pass
9. **Deployment** — Updated VM config, new env vars

---

## Current Architecture (What We're Replacing)

### Supabase Usage Map

| File | Supabase Dependency | What It Does |
|---|---|---|
| `backend/src/lib/serverDb.ts` | `createClient(SUPABASE_URL, SERVICE_ROLE_KEY)` | Server-side DB queries (service role, bypasses RLS) |
| `backend/middleware/auth.ts` | `supabase.auth.getUser(token)` | Verifies Supabase JWT, resolves profile |
| `backend/routes/auth.ts` | `supabase.auth.admin.*`, `supabase.from()` | OTP creation, signup, profile queries → Will become Google-only + /me |
| `backend/routes/donor.ts` | `supabase.from()` | Donor CRUD |
| `backend/routes/requester.ts` | `supabase.from()` | Requester data |
| `backend/routes/requests.ts` | `supabase.from()` | Blood request CRUD |
| `backend/routes/matching.ts` | `supabase.from()` | Match responses |
| `backend/routes/tracking.ts` | `supabase.from()` | Public tracking |
| `backend/routes/notifications.ts` | `supabase.from()` | Notification log |
| `backend/routes/admin.ts` | `supabase.from()` | Admin panel queries |
| `backend/routes/hospital.ts` | `supabase.from()` | Hospital registration |
| `backend/routes/account.ts` | `supabase.auth.admin.deleteUser()`, `supabase.from()` | Account deletion |
| `backend/routes/onboarding.ts` | `supabase.from()` | Onboarding CRUD |
| `backend/routes/accountSettings.ts` | `supabase.from()` | Settings updates |
| `backend/routes/institutions.ts` | `supabase.from()` | Institution CRUD |
| `backend/services/matchingEngine.ts` | `supabase.from()` | Matching queries |
| `backend/services/notificationService.ts` | `supabase.from()` | Message queue |
| `backend/services/eraktkoshSyncService.ts` | `supabase.from()` | e-RaktKosh sync |
| `backend/worker/sweepWorker.ts` | `supabase.from()` | Background sweep |
| `src/lib/supabase.ts` | `createClient(url, anonKey)` | Frontend Supabase client |
| `src/lib/AuthContext.tsx` | `supabase.auth.onAuthStateChange()` | Auth state listener |
| `src/lib/rev3Auth.ts` | `supabase.auth.*`, `supabase.from()` | Rev3 auth flows (OTP + Google) → Will become Google-only |
| `src/lib/api.ts` | `supabase.auth.getSession()` | API call auth headers |
| `src/lib/db.ts` | `supabase.from()` | Client-side queries |
| `src/lib/serverDb.ts` | Duplicate of backend serverDb | Server-side queries (imported by frontend server code) |

### Supabase Tables → Firestore Collections

| Supabase Table | Firestore Collection | Key Changes |
|---|---|---|
| `auth.users` | Firebase Auth Users | Handled by Firebase Auth, not Firestore |
| `profiles` | `profiles` | Document ID = Firebase Auth UID |
| `auth_profile_links` | **Eliminated** | Firebase Auth UID = profile document ID directly |
| `donor_profiles` | `donor_profiles` | Document ID = Firebase Auth UID (1:1 with profiles) |
| `blood_requests` | `blood_requests` | Auto-generated document ID |
| `matches` | `matches` | Auto-generated document ID |
| `notifications` | `notifications` | Auto-generated document ID |
| `institutions` | `institutions` | Auto-generated document ID |
| `institution_profile_links` | **Eliminated** | Profile document has `institution_id` field directly |
| `message_queue` | `message_queue` | Auto-generated document ID |
| `request_events` | `request_events` | Auto-generated document ID |
| `request_reports` | `request_reports` | Auto-generated document ID |
| `blood_banks` | `blood_banks` | Auto-generated document ID |
| `donation_camps` | `donation_camps` | Auto-generated document ID |
| `eraktkosh_sync_logs` | `eraktkosh_sync_logs` | Auto-generated document ID |
| `users` (legacy) | **Eliminated** | FK references updated to use `profiles` |
| `requesters` (legacy) | **Eliminated** | FK references updated to use `profiles` |

---

## Phase 0: Prerequisites & Setup

### 0.1 Create Firebase Project
1. Go to https://console.firebase.google.com
2. Create project `findmydonor`
3. Enable **Authentication** → Sign-in methods:
   - Google (for regular users — the only sign-in method for donors/requesters)
   - Email/Password (for admin panel login only)
4. Enable **Cloud Firestore** → Start in production mode
5. Note down Firebase config values

### 0.2 Required New Environment Variables

**Remove:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Add (Backend `.env`):**
- `FIREBASE_PROJECT_ID` — Firebase project ID
- `FIREBASE_CLIENT_EMAIL` — Service account client email
- `FIREBASE_PRIVATE_KEY` — Service account private key (escaped newlines)
- `FIREBASE_STORAGE_BUCKET` — Firebase storage bucket
- `ADMIN_EMAIL` — Single admin email for panel access (e.g., `admin@findmydonor.online`)
- `ADMIN_PASSWORD` — Admin panel password

**Add (Frontend `.env` / Vite env):**
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

**Keep:**
- `ADMIN_AUTH_SECRET` — Still used for API-level admin auth (dual protection)
- `ADMIN_EMAILS` — List of admin emails for secondary check
- Redis, Resend, APP_URL, CORS_ORIGINS vars
- WAHA vars (keep for now, can remove later if WhatsApp notifications not needed)

### 0.3 Packages to Install

**Backend (`backend/`):**
- `firebase-admin` — Server-side Firebase SDK (Auth + Firestore)

**Frontend (`src/`):**
- `firebase` — Client-side Firebase SDK (Auth + Firestore)

**Remove after migration complete:**
- `@supabase/supabase-js` (both root and backend)

---

## Phase 1: Database Schema Migration (Firestore)

### 1.1 Firestore Collection Schemas

#### `profiles` collection
```typescript
// Document ID: Firebase Auth UID
{
  id: string;              // = Auth UID
  phone: string | null;    // normalized "91XXXXXXXXXX"
  email: string | null;
  name: string;
  can_donate: boolean;
  can_request: boolean;
  onboarding_complete: boolean;
  onboarding_step: number; // 0, 1, 2, 3
  whatsapp_verified: boolean;
  account_status: string;  // "active", "suspended"
  pincode: string | null;
  city: string | null;
  state: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

#### `donor_profiles` collection
```typescript
// Document ID: Firebase Auth UID (same as profiles)
{
  id: string;              // = Auth UID
  blood_group: string;     // "A+", "B-", etc.
  pincode: string;
  is_available: boolean;
  available_from: Timestamp | null;
  cooldown_until: Timestamp | null;
  last_donation_date: Timestamp | null;
  total_donations: number;
  weight_kg: number | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

#### `blood_requests` collection
```typescript
// Document ID: auto-generated
{
  id: string;              // auto-generated document ID
  code: string;            // unique human-readable code (e.g., "BLD-XXXX")
  requester_id: string;    // Firebase Auth UID
  patient_name: string;
  blood_group: string;
  units_needed: number;
  units_fulfilled: number;
  hospital_name: string;
  hospital_address: string;
  hospital_pincode: string;
  hospital_city: string;
  urgency: string;         // "emergency", "urgent", "planned"
  status: string;          // "open", "matched", "fulfilled", "expired", "cancelled"
  public_token: string;    // opaque tracking token
  notes: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  expires_at: Timestamp;
}
```

#### `matches` collection
```typescript
// Document ID: auto-generated
{
  id: string;
  request_id: string;      // references blood_requests.id
  donor_id: string;        // Firebase Auth UID
  status: string;          // "pending", "approved", "declined", "expired"
  distance_km: number;
  unit_slot: number | null;
  donor_locked_until: Timestamp | null;
  response_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

#### `notifications` collection
```typescript
{
  id: string;
  user_id: string;
  type: string;
  channel: string;         // "whatsapp", "email"
  status: string;          // "sent", "failed", "pending"
  payload: object;
  created_at: Timestamp;
}
```

#### `institutions` collection
```typescript
{
  id: string;
  name: string;
  type: string;            // "hospital", "blood_bank", "ngo"
  address: string;
  pincode: string;
  city: string;
  status: string;          // "pending", "verified", "rejected"
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

#### `institution_profile_links` → **Eliminated**
Instead, `profiles` documents will have an optional `institution_id` field.

#### `message_queue` collection
```typescript
{
  id: string;
  recipient_id: string;
  channel: string;
  type: string;
  payload: object;
  status: string;          // "pending", "sent", "failed"
  attempts: number;
  created_at: Timestamp;
  sent_at: Timestamp | null;
}
```

#### `request_events` collection
```typescript
{
  id: string;
  request_id: string;
  event_type: string;
  actor_id: string | null;
  details: object;
  created_at: Timestamp;
}
```

#### `request_reports` collection
```typescript
{
  id: string;
  request_id: string;
  reporter_id: string;
  reason: string;
  status: string;          // "pending", "reviewed", "dismissed"
  created_at: Timestamp;
}
```

#### `blood_banks` collection
```typescript
{
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  blood_groups_available: string[];
  last_synced_at: Timestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

#### `donation_camps` collection
```typescript
{
  id: string;
  name: string;
  organizer: string;
  address: string;
  city: string;
  state: string;
  date: Timestamp;
  blood_groups_needed: string[];
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

#### `eraktkosh_sync_logs` collection
```typescript
{
  id: string;
  sync_type: string;
  status: string;
  records_synced: number;
  error: string | null;
  created_at: Timestamp;
}
```

### 1.2 Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper: check if user is authenticated
    function isAuth() {
      return request.auth != null;
    }

    // Helper: check if user is admin
    function isAdmin() {
      return isAuth() && request.auth.token.email == 'ADMIN_EMAIL_PLACEHOLDER';
    }

    // Helper: check if user owns the document
    function isOwner(userId) {
      return isAuth() && request.auth.uid == userId;
    }

    // --- profiles ---
    match /profiles/{userId} {
      // Public read for any authenticated user (needed for donor directories)
      allow read: if isAuth();
      // Only owner can write their own profile
      allow create: if isOwner(userId);
      allow update: if isOwner(userId) || isAdmin();
      allow delete: if isAdmin();
    }

    // --- donor_profiles ---
    match /donor_profiles/{userId} {
      allow read: if isAuth();
      allow create: if isOwner(userId);
      allow update: if isOwner(userId) || isAdmin();
      allow delete: if isAdmin();
    }

    // --- blood_requests ---
    match /blood_requests/{docId} {
      // Public read for open requests (needed for tracking page)
      allow read: if true;
      // Authenticated users can create requests
      allow create: if isAuth();
      // Only requester or admin can update
      allow update: if isAuth() &&
        (resource.data.requester_id == request.auth.uid || isAdmin());
      allow delete: if isAdmin();
    }

    // --- matches ---
    match /matches/{docId} {
      allow read: if isAuth();
      allow create: if isAuth();
      // Donor can update their own match response; admin can update any
      allow update: if isAuth() &&
        (resource.data.donor_id == request.auth.uid || isAdmin());
      allow delete: if isAdmin();
    }

    // --- notifications ---
    match /notifications/{docId} {
      allow read: if isAuth() && resource.data.user_id == request.auth.uid;
      allow create: if isAdmin();
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }

    // --- institutions ---
    match /institutions/{docId} {
      allow read: if true;
      allow create: if isAuth();
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }

    // --- message_queue ---
    match /message_queue/{docId} {
      allow read, write: if isAdmin();
    }

    // --- request_events ---
    match /request_events/{docId} {
      allow read: if isAuth();
      allow create: if isAuth();
      allow update, delete: if isAdmin();
    }

    // --- request_reports ---
    match /request_reports/{docId} {
      allow read: if isAdmin();
      allow create: if isAuth();
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }

    // --- blood_banks ---
    match /blood_banks/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // --- donation_camps ---
    match /donation_camps/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // --- eraktkosh_sync_logs ---
    match /eraktkosh_sync_logs/{docId} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }
  }
}
```

**Note:** The `ADMIN_EMAIL_PLACEHOLDER` must be replaced with the actual admin email before deploying rules.

### 1.3 Firestore Indexes

Create composite indexes for common queries:
- `blood_requests`: `(status, created_at)`, `(hospital_pincode, status, blood_group)`
- `matches`: `(request_id, status)`, `(donor_id, status)`
- `donor_profiles`: `(blood_group, pincode, is_available)`
- `notifications`: `(user_id, created_at)`
- `message_queue`: `(status, created_at)`

These will be auto-created by Firestore when queries are first run, or can be pre-created in Firebase Console.

---

## Phase 2: Authentication Migration

### 2.1 Firebase Auth Setup

**Google Sign-in (regular users — ONLY sign-in method):**
- Firebase Auth natively supports Google sign-in
- Use `signInWithPopup(auth, googleProvider)` on frontend
- Replace `supabase.auth.signInWithOAuth({ provider: 'google' })`
- After sign-in:
  - Check if profile exists in Firestore `profiles` collection (by UID)
  - If exists → redirect to dashboard
  - If not → redirect to onboarding (name, blood group, pincode, intent)
- REMOVE all phone OTP and email OTP flows entirely
- REMOVE all OTP-related components (PhoneStep, OTPStep, etc.)

**Admin Login (email+password — separate from regular users):**
- Create a single Firebase Auth user with email+password
- Admin panel login calls `signInWithEmailAndPassword(auth, email, password)`
- Backend checks `user.email === ADMIN_EMAIL` for admin route protection

### 2.2 Frontend Auth Files to Change

#### `src/lib/supabase.ts` → `src/lib/firebase.ts`
- **Current:** Creates Supabase client with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- **New:** Creates Firebase app, auth, and Firestore instances with Firebase config
- **Exports:** `app`, `auth`, `db` (Firestore), `googleProvider`
- **Remove:** All phone OTP, email OTP related exports

#### `src/lib/AuthContext.tsx`
- **Current:** Uses `supabase.auth.onAuthStateChange()` to track session
- **New:** Use `onAuthStateChanged(auth, callback)` to track user
- **Change:** `User` type from Supabase `User` to Firebase `User`
- **Change:** Remove `session` state (Firebase uses `getIdToken()` for API calls)
- **Change:** Remove any OTP-related state/methods
- **Keep:** All user type resolution logic (donor, requester, etc.)

#### `src/lib/rev3Auth.ts`
- **Current:** Uses `supabase.auth.signInWithOtp()`, `supabase.auth.verifyOtp()`, etc.
- **New:** 
  - Google only: Use `signInWithPopup(auth, googleProvider)`
  - Remove ALL phone OTP and email OTP flows entirely
  - After Google sign-in, check if profile exists in Firestore
  - If profile exists → redirect to dashboard
  - If profile doesn't exist → redirect to onboarding
- **Change:** Remove all `supabase.from()` calls; use Firestore queries instead

#### `src/lib/api.ts`
- **Current:** Gets Supabase session token via `supabase.auth.getSession()`
- **New:** Gets Firebase ID token via `auth.currentUser.getIdToken()`
- **Change:** Header from `Authorization: Bearer <supabase_token>` to `Authorization: Bearer <firebase_id_token>`

#### `src/lib/db.ts`
- **Current:** Uses `supabase.from('table').select()` etc.
- **New:** Use Firestore `collection()`, `doc()`, `getDocs()`, `addDoc()`, etc.
- **Change:** All queries need to be rewritten for Firestore API

#### `src/lib/serverDb.ts`
- **Current:** Supabase service-role client + local JSON fallback
- **New:** Firebase Admin Firestore client
- **Change:** Remove local JSON fallback entirely

### 2.3 Backend Auth Files to Change

#### `backend/middleware/auth.ts`
- **Current:** `supabase.auth.getUser(token)` to verify Supabase JWT
- **New:** `admin.auth().verifyIdToken(token)` to verify Firebase ID token
- **Change:** After verification, look up profile in `profiles` collection using `admin.firestore().collection('profiles').doc(uid).get()`
- **Keep:** Profile resolution logic, linked account handling

#### `backend/routes/auth.ts`
- **Current:** `supabase.auth.admin.generateOtp()`, `supabase.auth.admin.verifyOtp()`, etc.
- **New:** 
  - Google sign-in: Verify Firebase ID token from frontend, create/link profile in Firestore
  - `/me` endpoint: Verify Firebase token, return profile from Firestore
  - REMOVE all phone OTP endpoints (`/auth/phone/signup`, `/auth/phone/verify`, etc.)
  - REMOVE all email OTP endpoints (`/auth/email/signup`, `/auth/email/verify`, etc.)
  - Keep only: Google auth + `/me` + admin auth endpoints
- **Change:** Remove all `supabase.auth.admin.*` calls

#### `backend/middleware/jwt.ts`
- **Current:** Custom HMAC-SHA256 JWT for admin auth
- **New:** Keep as-is (dual protection: Firebase Auth + admin secret)
- **Change:** Add Firebase ID token verification as additional layer

---

## Phase 3: Backend API Migration

### 3.1 Core DB Layer

#### `backend/src/lib/serverDb.ts` — Complete Rewrite
- **Current:** Supabase client with service role + local JSON fallback
- **New:** Firebase Admin Firestore client
- **Pattern change:** 
  - Supabase: `supabase.from('table').select('*').eq('id', id)`
  - Firestore: `db.collection('table').doc(id).get()` or `db.collection('table').where('field', '==', value).get()`
- **Helper functions:** Create Firestore query helpers to minimize code changes:
  - `getById(collection, id)` → returns document data or null
  - `getWhere(collection, field, op, value)` → returns array of documents
  - `createDoc(collection, data)` → adds document, returns ID
  - `updateDoc(collection, id, data)` → updates document
  - `deleteDoc(collection, id)` → deletes document
  - `queryDocs(collection, conditions[], orderBy?, limit?)` → complex queries

### 3.2 Route Changes

Every route file needs these changes:
1. Replace `supabase.from()` calls with Firestore helper functions
2. Replace `supabase.auth.admin.*` calls with Firebase Admin SDK calls
3. Update query patterns from SQL-like to Firestore document/collection

#### Specific Route Changes:

**`backend/routes/donor.ts`:**
- `supabase.from('donor_profiles').select('*')` → `getWhere('donor_profiles', 'id', '==', uid)`
- `supabase.from('donor_profiles').upsert({...})` → `setDoc('donor_profiles', uid, {...})`
- Add: Use `admin.firestore()` for all queries

**`backend/routes/requester.ts`:**
- Similar pattern as donor routes
- Replace all `supabase.from()` with Firestore helpers

**`backend/routes/requests.ts`:**
- `supabase.from('blood_requests').select('*').eq('id', id)` → `getById('blood_requests', id)`
- `supabase.from('blood_requests').insert({...})` → `createDoc('blood_requests', {...})`
- `supabase.from('blood_requests').update({...}).eq('id', id)` → `updateDoc('blood_requests', id, {...})`

**`backend/routes/matching.ts`:**
- Replace all `supabase.from('matches')` with Firestore helpers
- Update nested queries (join blood_requests + donor_profiles)

**`backend/routes/tracking.ts`:**
- Public tracking uses `public_token` → query `blood_requests` collection where `public_token == token`
- Replace `supabase.from('blood_requests').select('*').eq('public_token', token)`

**`backend/routes/notifications.ts`:**
- Replace `supabase.from('notifications')` with Firestore helpers

**`backend/routes/admin.ts`:**
- Replace all `supabase.from()` with Firestore helpers
- Admin auth: Verify Firebase ID token + check email in `ADMIN_EMAILS`

**`backend/routes/hospital.ts`:**
- Replace all `supabase.from('institutions')` with Firestore helpers

**`backend/routes/account.ts`:**
- `supabase.auth.admin.deleteUser(uid)` → `admin.auth().deleteUser(uid)`
- Delete profile, donor_profile, etc. from Firestore collections

**`backend/routes/onboarding.ts`:**
- Replace all `supabase.from('profiles')` with Firestore helpers

**`backend/routes/accountSettings.ts`:**
- Replace all `supabase.from()` with Firestore helpers

**`backend/routes/institutions.ts`:**
- Replace all `supabase.from('institutions')` with Firestore helpers

### 3.3 Service Layer Changes

**`backend/services/matchingEngine.ts`:**
- Replace all `supabase.from()` with Firestore helpers
- Update query patterns for matching algorithm

**`backend/services/notificationService.ts`:**
- Replace `supabase.from('message_queue')` with Firestore helpers

**`backend/services/eraktkoshSyncService.ts`:**
- Replace all `supabase.from()` with Firestore helpers

**`backend/worker/sweepWorker.ts`:**
- Replace all `supabase.from()` with Firestore helpers
- Update background sweep queries

### 3.4 Type Changes

**`backend/src/types.ts`:**
- Remove Supabase-specific types
- Add Firestore-specific types if needed
- Update `User`, `Profile`, `DonorProfile` types to match Firestore document structure

---

## Phase 4: Frontend Migration

### 4.1 Component Changes

**Every component using Supabase needs updating:**

**`src/components/home/RaktdaanHome.tsx`:**
- Remove `supabase` imports if any
- Update API calls if they directly use Supabase

**`src/components/AuthHub/`:**
- REMOVE PhoneStep component entirely
- REMOVE OTPStep component entirely
- REMOVE ProfileStep component (merge into onboarding)
- REPLACE with single "Sign in with Google" button
- Use `signInWithPopup(auth, googleProvider)`
- After sign-in, redirect to onboarding if profile doesn't exist

**`src/components/rev3/`:**
- Replace all `supabase` calls with Firebase Auth/Firestore
- Update onboarding wizard to use Firestore
- Remove any phone/email OTP UI components
- Simplify: Google sign-in → onboarding (name, blood group, pincode) → dashboard

**`src/components/DonorDashboard/`:**
- Replace `supabase.from()` calls with Firestore queries
- Update real-time subscriptions if any (Firestore has `onSnapshot()`)

**`src/components/RequesterPortal.tsx`:**
- Replace `supabase.from()` calls with Firestore queries

**`src/components/RequestForm.tsx`:**
- Replace `supabase.from()` calls with Firestore queries
- Update form submission logic

**`src/components/RequestTracking.tsx`:**
- Replace `supabase.from()` calls with Firestore queries
- Update public tracking logic

**`src/components/AdminPanel/`:**
- Replace all `supabase` calls with Firestore/Firebase Auth
- Update admin login to use `signInWithEmailAndPassword()`

**`src/components/admin/`:**
- Same as above

**`src/components/hospital/`:**
- Replace all `supabase` calls with Firestore

**Other components:**
- `src/components/BloodBankDirectory.tsx`
- `src/components/BloodCompatibilityPage.tsx`
- `src/components/CityDonorDirectory.tsx`
- All other component files

### 4.2 Hook Changes

**`src/hooks/useFocusTrap.ts`:**
- No change needed (pure UI hook)

### 4.3 Data Files

**No changes needed:**
- `src/data/pincodes.ts` — Static data
- `src/data/pincode_coords.ts` — Static data
- `src/data/hospitals.ts` — Static data
- `src/data/bloodBankData.ts` — Static data
- `src/data/allIndiaBloodBankSeed.ts` — Static data

---

## Phase 5: Admin Panel Migration

### 5.1 Admin Auth Flow

**Current:**
- `ADMIN_AUTH_SECRET` env var
- Custom HMAC-SHA256 JWT
- Supabase session email check

**New:**
- Single Firebase Auth user with `ADMIN_EMAIL` + `ADMIN_PASSWORD`
- Firebase `signInWithEmailAndPassword()` on frontend
- Backend verifies Firebase ID token AND checks `user.email === ADMIN_EMAIL`
- Keep `ADMIN_AUTH_SECRET` as secondary protection for API routes

### 5.2 Admin Login Component

**`src/components/AdminLogin.tsx`** or **`src/components/admin/AdminLogin.tsx`:**
- **Current:** Secret input form
- **New:** Simple email + password form using Firebase Auth
- **Logic:**
  ```typescript
  // Pseudo-code — simple and clean
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  if (userCredential.user.email !== ADMIN_EMAIL) {
    await signOut(auth);
    throw new Error('Unauthorized');
  }
  // Store admin state, redirect to dashboard
  ```

### 5.3 Admin Route Protection

**Frontend (`App.tsx`):**
- **Current:** Checks `loggedInAdmin` state
- **New:** Check `auth.currentUser` AND `auth.currentUser.email === ADMIN_EMAIL`
- **Logic:** If not admin, redirect to `/admin/login`

**Backend (`backend/middleware/jwt.ts`):**
- **Current:** Verify admin secret or Supabase session email
- **New:** Verify Firebase ID token AND check `decodedToken.email === ADMIN_EMAIL`
- **Keep:** `ADMIN_AUTH_SECRET` check as secondary protection

### 5.4 Admin Panel Data Access

- All admin queries go through Firestore with `isAdmin()` security rules
- Admin can read/write all collections
- Non-admin users cannot access admin endpoints

---

## Phase 6: Data Migration Script

### 6.1 Export from Supabase

Create a one-time migration script (`scripts/migrate-supabase-to-firestore.ts`):

1. Connect to Supabase using service role key
2. Export all tables to JSON
3. Transform data to match Firestore document structure
4. Upload to Firestore using Firebase Admin SDK

### 6.2 Data Transformation Rules

**Profiles:**
- Remove `id` field (use Firebase Auth UID)
- Remove `auth_profile_links` join (not needed)
- Add `institution_id` field if user has institution

**Blood Requests:**
- Convert `requester_id` from Supabase UUID to Firebase Auth UID
- Ensure `public_token` is preserved

**Matches:**
- Convert `donor_id` and `request_id` references

**Institutions:**
- Remove `institution_profile_links` table
- Add `institution_id` to related profiles

### 6.3 Auth User Migration

1. Export all Supabase auth users
2. Since regular users will use Google sign-in (not email/password), we don't need to create Firebase Auth users for them
3. Only create the admin Firebase Auth user with email+password
4. Existing Supabase users will sign in with Google on their first visit after migration

---

## Phase 7: Testing & Verification

### 7.1 Test File Changes

All 18 test files in `backend/tests/` need updates:

**`backend/tests/setup-env.ts`:**
- Remove Supabase env vars
- Add Firebase env vars (use Firebase Emulator for testing)

**All test files:**
- Replace `supabase.from()` mocks with Firestore mocks
- Update auth token generation (use Firebase Auth emulator)
- Verify all scenarios pass

### 7.2 Firebase Emulator Setup

For local testing, use Firebase Emulator Suite:
- Auth Emulator (port 9099)
- Firestore Emulator (port 8080)

Update test setup to connect to emulators instead of production.

### 7.3 Test Commands

```bash
# Start Firebase Emulators
firebase emulators:start

# Run all tests
npm run test:matching
npm run test  # or whatever the full test command is

# Verify auth flows
# 1. Test Google sign-in (mock in emulator)
# 2. Test admin email+password login
# 3. Test admin routes
```

---

## Phase 8: Deployment

### 8.1 Firebase Project Setup

1. Create Firebase project (if not done in Phase 0)
2. Enable Authentication (Google for users, Email/Password for admin only)
3. Enable Cloud Firestore
4. Generate service account key
5. Update Firebase config in frontend

### 8.2 VM Deployment Changes

**`vm/ecosystem.config.cjs`:**
- Update env vars to include Firebase config
- Remove Supabase env vars

**`vm/deploy.sh`:**
- Add Firebase CLI installation
- Add Firestore security rules deployment
- Add Firestore indexes deployment

### 8.3 Production Env Vars

Update `.env.example` and production `.env`:

```bash
# Firebase (Backend)
FIREBASE_PROJECT_ID=findmydonor
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@findmydonor.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=findmydonor.appspot.com

# Firebase (Frontend)
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=findmydonor.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=findmydonor
VITE_FIREBASE_STORAGE_BUCKET=findmydonor.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Admin
ADMIN_EMAIL=admin@findmydonor.online
ADMIN_PASSWORD=secure_password_here

# Keep these
ADMIN_AUTH_SECRET=existing_secret
ADMIN_EMAILS=admin@findmydonor.online,other@admin.com
```

### 8.4 Deployment Steps

```bash
# 1. Run data migration script
npm run migrate:supabase-to-firestore

# 2. Create admin user in Firebase (email+password)
firebase auth:create-user --email admin@findmydonor.online --password secure_password

# 3. Deploy Firestore rules and indexes
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes

# 4. Build and deploy
npm run build
# Deploy to VM using existing SCP/SSH workflow

# 5. Verify
# - Test Google sign-in (regular users) — should redirect to onboarding or dashboard
# - Test admin email+password login — should access admin panel
# - Test donor/requester dashboards
# - Test admin panel
# - Test matching engine
# - Run full test suite
```

---

## Phase 9: Cleanup

### 9.1 Remove Supabase Dependencies

- Remove `@supabase/supabase-js` from `package.json`
- Remove all `supabase` imports from codebase
- Remove Supabase env vars from `.env.example`
- Remove Supabase client initialization code
- Remove all OTP-related code (phone OTP, email OTP)

### 9.2 Remove Local JSON Fallback

- Remove `data/db_*.json` files
- Remove local JSON read/write logic from `serverDb.ts`
- Remove `TEST_MODE` env var (not needed without Supabase)
- Remove all OTP-related components and routes

### 9.3 Update Documentation

- Update `README.md` to reflect Firebase stack
- Update `docs/disaster-recovery.md` (replace Supabase backup with Firestore backup)
- Update `docs/monitoring-setup.md` if needed
- Update any other docs referencing Supabase

### 9.4 Update CI/CD

- Update `.github/workflows/ci.yml` to use Firebase emulators
- Remove Supabase-specific CI steps

---

## Risk Mitigation

### 1. Data Loss Prevention
- **Before migration:** Export complete Supabase database
- **During migration:** Run migration script in dry-run mode first
- **After migration:** Verify all data is present in Firestore

### 2. Auth Disruption
- **Strategy:** Regular users will use Google sign-in (no account migration needed)
- **Admin:** Create admin Firebase Auth user with email+password before migration
- **Communication:** Notify users they'll need to sign in with Google after migration (no password needed)
- **Existing data:** All profiles, donor_profiles, blood_requests etc. are preserved in Firestore (UIDs stay the same)
- **Simplified flow:** Google sign-in → onboarding (if new user) → dashboard

### 3. Downtime
- **Approach:** Full cutover (per user preference)
- **Estimated downtime:** 30-60 minutes for data migration + deployment
- **Communication:** Schedule maintenance window, show maintenance page

### 4. Testing
- **Before migration:** Run full test suite against Firebase Emulator
- **During migration:** Test critical paths (auth, request creation, matching)
- **After migration:** Monitor error rates, user reports

---

## Success Criteria

1. ✅ All 18 test suites pass
2. ✅ Google sign-in works via Firebase Auth (regular users)
3. ✅ Admin email+password login works
4. ✅ Admin panel accessible only by admin email
7. ✅ Donor dashboard loads and functions
8. ✅ Requester portal loads and functions
9. ✅ Blood request creation works
10. ✅ Matching engine works
11. ✅ Public tracking works
12. ✅ Hospital registration works
13. ✅ Institution management works
14. ✅ Account deletion works
15. ✅ Onboarding flow works
16. ✅ All CRUD operations work
17. ✅ Background sweep worker works
18. ✅ Message queue works
19. ✅ Redis caching works
20. ✅ Production deployment successful

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|---|---|---|
| Phase 0: Prerequisites | 1-2 hours | Firebase project setup |
| Phase 1: DB Schema | 2-3 hours | Phase 0 |
| Phase 2: Auth Migration | 3-4 hours (simplified — Google only) | Phase 0 |
| Phase 3: Backend API | 6-8 hours | Phase 1, 2 |
| Phase 4: Frontend | 5-7 hours (simplified — no OTP) | Phase 2 |
| Phase 5: Admin Panel | 2-3 hours | Phase 2, 3, 4 |
| Phase 6: Data Migration | 2-3 hours | Phase 1, 3 |
| Phase 7: Testing | 3-4 hours | All phases |
| Phase 8: Deployment | 1-2 hours | Phase 7 |
| Phase 9: Cleanup | 1-2 hours | Phase 8 |
| **Total** | **26-38 hours** | — |

---

## Next Steps

1. **Review this plan** — Confirm all requirements are captured
2. **Create Firebase project** — Enable Google auth + email/password (admin only) + Firestore
3. **Start Phase 0** — Install packages, update env vars
4. **Begin implementation** — Follow phases in order

**Key simplification:** Regular users only sign in with Google (no phone OTP, no email OTP). Admin uses email+password. This reduces auth complexity significantly — no OTP state machines, no phone verification, no email verification.

**Ready to proceed?**
