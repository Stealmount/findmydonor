# 🩸 FindMyDonor™ (RaktDaan) — National Live Blood Matching & SOS Network

**FindMyDonor™** is an emergency volunteer blood donation platform that connects patients in urgent need of blood with compatible, nearby volunteer donors via real-time pincode matching and WhatsApp SOS alerts.

---

## 📂 Project Directory Structure Overview

To make the codebase easy to understand for any developer or reviewer, the project is organized into 5 core architectural modules:

```text
c:\project\lahu\
├── 🎨 frontend/      → UI components, React views, TailwindCSS, Framer Motion
├── ⚙️ backend/       → Express API server (server.ts), matching engine, WAHA integration
├── 🗄️ database/      → Supabase PostgreSQL schemas, RLS policies, SQL migration scripts
├── 💻 vm/            → Production VM (Ubuntu 22.04), PM2 configuration, Nginx, SSH commands
└── 🧠 skills/        → Project rules (AGENTS.md), agent skills, data protection safety
```

---

## 🗺️ Module Navigation & Guides

### 1. [🎨 Frontend Architecture (`/frontend`)](file:///c:/project/lahu/frontend/README.md)
* **Stack**: React, TypeScript, Vite, TailwindCSS, Framer Motion.
* **Key Components**: `RequestForm.tsx`, `RequestTracking.tsx`, `DonorDashboard.tsx`, `RequesterPortal.tsx`.
* **Design System**: Glassmorphic dark/light UI, custom color tokens, smooth micro-animations.

### 2. [⚙️ Backend Architecture (`/backend`)](file:///c:/project/lahu/backend/README.md)
* **Stack**: Node.js, Express, `@supabase/supabase-js`, `esbuild`, PM2.
* **Core Services**: Phone signup OTP auth, blood request lifecycle, matching engine (`matching.ts`), WAHA WhatsApp integration (`waha.ts`), pincode Haversine distance engine (`geo.ts`).

### 3. [🗄️ Database Architecture (`/database`)](file:///c:/project/lahu/database/README.md)
* **Engine**: Supabase PostgreSQL with Row Level Security (RLS).
* **Core Tables**: `profiles`, `donor_profiles`, `blood_requests`, `matches`, `notifications`, `users`.
* **SQL Migrations**: Schema, auth profile migration, RLS policies, cleanup scripts.

### 4. [💻 Production VM & Deployment (`/vm`)](file:///c:/project/lahu/vm/README.md)
* **Domain**: [findmydonor.online](https://findmydonor.online)
* **Host**: Oracle Cloud Ubuntu Server (`145.241.154.187`).
* **Process Manager**: PM2 running `findmydonor-backend` (Port 5000) & `findmydonor-admin` (Port 5001).

### 5. [🧠 Agent Skills & Rules (`/skills`)](file:///c:/project/lahu/skills/README.md)
* **Custom Rules**: `.agents/AGENTS.md` (Visual parity, TypeScript rigor, community non-commercial stance).
* **Data Loss Prevention**: `accidental-data-loss-prevention` requiring explicit user authorization for database mutations.

---

## ⚡ Quick Start & Development

```bash
# 1. Install dependencies
npm install

# 2. Start development server (Frontend + Backend)
npm run dev

# 3. Run matching engine unit tests (29 scenarios)
npm run test:matching

# 4. Build production bundle
npm run build
```

### 🐳 Docker (optional — local Redis)

The backend uses Redis for caching and worker locks. To run a local Redis instance:

```bash
docker-compose up -d
```

Then start the app normally:

```bash
npm run dev
```

To stop Redis: `docker-compose down`. (The backend also falls back gracefully when Redis is unavailable.)

---

## 🛡️ Reliability & Monitoring

- **CI**: [.github/workflows/ci.yml](.github/workflows/ci.yml) — tsc (root + backend) + full test suite on push/PR to `main`.
- **Uptime monitoring**: see [docs/monitoring-setup.md](docs/monitoring-setup.md) (UptimeRobot setup for `/api/health` and the site).
- **Disaster recovery**: see [docs/disaster-recovery.md](docs/disaster-recovery.md) (Supabase backups, pg_dump, local data backups, VPS rebuild, DNS failover).
- **Structured logging**: `backend/helpers/logger.ts` — JSON-lines logger with `requestId` (proof of concept, used in the background worker).
