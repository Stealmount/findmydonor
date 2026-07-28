# ⚙️ Backend Architecture & APIs (`/backend`)

The backend for **FindMyDonor™** is an Express.js Node.js server (`server.ts`) built with TypeScript, bundled with `esbuild`, and deployed under PM2 on the production VM.

---

## 🚀 Key Files & Entry Points

| File / Component | Purpose |
|---|---|
| [server.ts](file:///c:/project/lahu/server.ts) | Main Express API server (Auth, Blood Requests, Donor Matching, WAHA WhatsApp alerts) |
| [admin-server.ts](file:///c:/project/lahu/admin-server.ts) | Admin portal backend server |
| [src/lib/serverDb.ts](file:///c:/project/lahu/src/lib/serverDb.ts) | `@supabase/supabase-js` service role singleton client & database helper functions |
| [src/lib/matching.ts](file:///c:/project/lahu/src/lib/matching.ts) | Matching engine rules, eligibility checks, and donor ranking algorithms |
| [src/lib/waha.ts](file:///c:/project/lahu/src/lib/waha.ts) | WhatsApp WAHA HTTP integration and message templates |
| [src/lib/geo.ts](file:///c:/project/lahu/src/lib/geo.ts) | Haversine distance formula & Indian pincode geolocation engine |

---

## 🔄 Core Workflows & API Endpoints

### 1. Auth & Signups
- **`POST /api/auth/phone-signup`**: Phone number OTP verification + automatic `profiles` & `donor_profiles` creation.
- **`GET /api/auth/me`**: Returns currently logged-in user profile, donor status, and requester capabilities.

### 2. Blood Request Lifecycle
- **`POST /api/requests`**: Creates a blood request and triggers `matchAndNotifyRequest(request)`.
- **`POST /api/requests/:id/broadcast`**: Promotes a draft request to live broadcasting.
- **`GET /api/requester/requests`**: Fetches active requests, matches, and accepted donor details for Requester Dashboard.
- **`PATCH /api/requests/:code/fulfill`**: Marks a request as fulfilled and activates donor 90-day cooldowns.

### 3. Matching & SOS Dispatch
- **ABO/Rh Blood Compatibility**: Universal donor `O-` matches all, exact type preference + compatible fallback.
- **Distance Radius Expansion**: Pincode proximity search (Tier 1: <5km, Tier 2: 5-10km, Tier 3: 10-25km).
- **Emergency Lock**: Prevents double-booking donors across concurrent requests.
- **WAHA WhatsApp Dispatch**: Delivers rich WhatsApp SOS messages with Google Maps directions link & secure tracking URLs (`https://findmydonor.online/track/...`).

---

## 🛠️ Running Locally & Testing

```bash
# Start dev backend server
npm run dev

# Run matching unit tests (29 scenarios)
npm run test:matching
```
