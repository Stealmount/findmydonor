# DEPLOY.md — FindMyDonor Manual Deployment

Production runs on an **Oracle Cloud VM** (145.241.154.187) via PM2. No Git on the server — deployment is build-locally + SCP.

## Prerequisites

- Node.js 20+ installed locally
- SSH key at `.ssh-key/ssh-key-2026-07-11.key`
- Access to the project root (`c:\project\lahu`)

## Deploy Steps

### 1. Build

```bash
npm run build
```

Produces:
- `dist/` — Express backend (server.js + assets)
- `dist/` — Frontend SPA (index.html + JS/CSS)
- `dist-admin/` — Admin dashboard

### 2. SCP to VM

```bash
# Backend
scp -i .ssh-key/ssh-key-2026-07-11.key -r dist/* ubuntu@145.241.154.187:/home/ubuntu/findmydonor/dist/

# Admin dashboard
scp -i .ssh-key/ssh-key-2026-07-11.key -r dist-admin/* ubuntu@145.241.154.187:/home/ubuntu/findmydonor/dist-admin/

# Ecosystem config (if changed)
scp -i .ssh-key/ssh-key-2026-07-11.key ecosystem.config.cjs ubuntu@145.241.154.187:/home/ubuntu/findmydonor/
```

### 3. SSH & Restart

```bash
ssh -i .ssh-key/ssh-key-2026-07-11.key ubuntu@145.241.154.187
cd /home/ubuntu/findmydonor
pm2 restart findmydonor-backend
```

### 4. Verify

```bash
# Health check (local or remote)
curl -s --max-time 10 https://findmydonor.online/api/health
```

Expected: `{"status":"ok","components":{"database":"up",...}}`

## PM2 Cheat Sheet

| Command | What it does |
|---------|-------------|
| `pm2 list` | Show running processes |
| `pm2 logs findmydonor-backend --lines 50` | Tail last 50 log lines |
| `pm2 restart findmydonor-backend` | Restart the backend |
| `pm2 stop findmydonor-backend` | Stop the backend |
| `pm2 monit` | Live CPU/memory monitor |

## Ports

| Port | Service |
|------|---------|
| 3001 | Frontend (Nginx reverse-proxied → HTTPS) |
| 5000 | Express backend API |
| 6000 | Admin dashboard |

## Environment

The `.env` file lives at `/home/ubuntu/findmydonor/.env` on the VM. **Never SCP `.env`** — it contains secrets. Edit it directly on the VM:

```bash
ssh -i .ssh-key/ssh-key-2026-07-11.key ubuntu@145.241.154.187
nano /home/ubuntu/findmydonor/.env
```

## Rollback

If a deploy breaks things:

```bash
ssh -i .ssh-key/ssh-key-2026-07-11.key ubuntu@145.241.154.187
pm2 logs findmydonor-backend --lines 100  # check errors
pm2 restart findmydonor-backend           # restart to clear state
# If code is the issue, re-SCP the previous working build
```

## Important Rules

1. **Ask before deploying to prod.** Never push without user confirmation.
2. **Run `npm run build` locally first.** Verify no TypeScript errors before SCP.
3. **Never SCP `.env`.** Secrets stay on the VM.
4. **Health check after deploy.** Synchronous curl, no polling loops.
