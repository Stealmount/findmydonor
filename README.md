# FindMyDonor — National Live Blood Matching & SOS Network

Emergency volunteer blood donation platform connecting patients in urgent need of blood with compatible, nearby volunteer donors via real-time matching and WhatsApp alerts.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with Firebase project credentials, Redis URL, WAHA keys

# 3. Start Redis (required for caching and background workers)
docker-compose up -d

# 4. Start development server (frontend :5173, backend :5000)
npm run dev
```

Open http://localhost:5173 in your browser.

---

## Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Starts frontend (Vite :5173) + backend API (Express :5000) |
| `npm run dev:admin` | Starts admin panel dev server |
| `npm run build` | Production build: frontend, admin, backend bundles |
| `npm run start` | Runs production backend server |
| `npm run lint` | TypeScript type-check (tsc --noEmit) |
| `npm run test` | Core test suite |
| `npm run test:all` | Run every test file |
| `npm run test:matching` | Matching engine tests only |
| `npm run test:auth` | Auth flow tests only |
| `npm run test:security` | Security tests only |
| `docker-compose up -d` | Start local Redis 7 (port 6379) |
| `docker-compose down` | Stop local Redis |

---

## Architecture

```
findmydonor/
├── src/                    Frontend (React 19 + Vite 6 + TailwindCSS v4)
│   ├── components/         React components (home, dashboards, admin, hospital, auth)
│   ├── lib/                Auth context, API client, Firebase client, i18n
│   ├── data/               Static data (pincodes, blood banks, hospitals)
│   ├── hooks/              Custom React hooks
│   ├── App.tsx             Route definitions
│   └── main.tsx            Client entry point
│
├── backend/                Express API server (TypeScript, esbuild)
│   ├── server.ts           Main API server (:5000)
│   ├── admin-server.ts     Admin server (:5001)
│   ├── routes/             15 API route modules
│   ├── middleware/          Auth, JWT, rate limiter, security
│   ├── services/           Matching engine, notifications, e-RaktKosh sync
│   ├── helpers/            Errors, logging, phone validation, time utils
│   ├── validation/         Zod schemas for all inputs
│   ├── src/lib/            Firebase Admin, Firestore helpers, Redis cache, email
│   ├── tests/              20 test files
│   └── worker/             Background sweep worker
│
├── scripts/                Data import/utility scripts
├── docs/                   Disaster recovery, monitoring setup
├── vm/                     Production VM config (PM2, Docker, deploy)
├── skills/                 Agent skills and project rules
└── public/                 Static assets (favicons, PWA, sitemap)
```

**Stack:**
- **Frontend:** React 19, TypeScript, Vite 6, TailwindCSS v4, Framer Motion, Recharts, Leaflet
- **Backend:** Node.js 20+, Express, TypeScript, esbuild (CJS bundle)
- **Auth:** Firebase Authentication — Google sign-in (users), email+password (admin)
- **Database:** Cloud Firestore (profiles, donor_profiles, blood_requests, matches, notifications, institutions)
- **Cache:** Redis 7 (caching, worker locks, OTP tickets)
- **Notifications:** WhatsApp via WAHA API, Email via Resend
- **Validation:** Zod v4 (client and server)
- **Testing:** Node test runner (tsx --test)
- **Process Manager:** PM2 (production)
- **CI:** GitHub Actions (tsc + full test suite on push/PR to main)

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

**Firebase (required):**
```
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

**Admin:**
```
ADMIN_EMAIL=admin@findmydonor.online
ADMIN_PASSWORD=
ADMIN_AUTH_SECRET=
ADMIN_EMAILS=admin@findmydonor.online
```

**Redis:** `REDIS_URL=redis://localhost:6379`
**WhatsApp:** `WAHA_BASE_URL`, `WAHA_API_KEY`, `WAHA_SESSION`
**Email:** `RESEND_API_KEY`, `RESEND_SENDER_EMAIL`
**App:** `APP_URL`, `CORS_ORIGINS`

See `.env.example` for the full list with descriptions.

---

## Firestore Collections

| Collection | Document ID | Purpose |
|-----------|-------------|---------|
| `profiles` | Firebase Auth UID | User profile (name, phone, intent, onboarding) |
| `donor_profiles` | Firebase Auth UID | Donor details (blood group, pincode, availability) |
| `blood_requests` | Auto-generated | Blood request (patient, hospital, urgency, status) |
| `matches` | Auto-generated | Donor-request match (status, distance, response) |
| `notifications` | Auto-generated | Notification log (channel, status, payload) |
| `institutions` | Auto-generated | Hospitals, blood banks, NGOs |
| `message_queue` | Auto-generated | Outbound message queue |
| `request_events` | Auto-generated | Request state audit trail |

---

## Testing

```bash
npm run test          # Core tests
npm run test:all      # All tests
npm run test:auth     # Auth only
npm run test:matching # Matching only
npm run test:security # Security only
```

---

## Deployment

**Production:** https://findmydonor.online

- **VM:** Oracle Cloud Ubuntu 22.04
- **Process Manager:** PM2 (backend :5000, admin :5001)
- **Reverse Proxy:** Nginx + Let's Encrypt TLS
- **Cache:** Redis 7 (Docker)

```bash
npm run build
scp dist/ dist-admin/ ecosystem.config.cjs ubuntu@VM:/home/ubuntu/findmydonor/
ssh ubuntu@VM "cd /home/ubuntu/findmydonor && pm2 restart all"
```

See `vm/deploy.sh` for the full deploy script and `docs/disaster-recovery.md` for recovery procedures.

---

## Reliability

- **CI:** `.github/workflows/ci.yml` — tsc + full test suite on push/PR to main
- **Monitoring:** UptimeRobot on `/api/health` and site homepage
- **Logging:** `backend/helpers/logger.ts` — structured JSON-lines logger
