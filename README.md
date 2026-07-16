# Lahu (RaktDaan) — Real-Time Blood Donation Network

Connects blood requesters with nearby verified donors. Donors receive SOS alerts via WhatsApp and email, and can accept or decline with a reply.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 6, Tailwind CSS 4, Leaflet maps |
| Backend | Express (`server.ts`, run with tsx), server-side matching engine |
| Database & Auth | Supabase (Postgres + Auth) |
| Cache | Redis via ioredis (falls back to in-memory LRU when unavailable) |
| WhatsApp | WAHA HTTP API (self-hosted, see `docker-compose.yml`) |
| Email | Resend |

## Local setup

**Prerequisites:** Node.js 20+, a Supabase project. Redis and WAHA are optional (the app degrades gracefully without them).

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in values. Critical:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only — never expose to the browser)
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (browser-safe)

   Optional: `REDIS_URL`, `WAHA_BASE_URL`/`WAHA_API_KEY`/`WAHA_DASHBOARD_PASSWORD`, `RESEND_API_KEY`.
3. Apply the database schema in the Supabase SQL editor: `supabase_schema.sql` (or `supabase_core_migration.sql` for the minimal core).
4. (Optional) Start WhatsApp gateway:
   ```
   docker compose up -d
   ```
5. Run the dev server (Express + Vite middleware on one port):
   ```
   npm run dev
   ```
   App: http://localhost:5000 — health check: http://localhost:5000/api/health

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server with Vite HMR |
| `npm run build` | Production build (client + bundled server) |
| `npm start` | Run the production bundle |
| `npm test` | Matching-engine test suite (no DB/network needed) |
| `npm run lint` | TypeScript typecheck |
| `npm run clean` | Remove build output |

## Utility scripts

- `scripts/clear_supabase.ts` — wipes all data tables in FK-safe order. **Destructive**; requires the service-role key in `.env`. Run with `npx tsx scripts/clear_supabase.ts`.
