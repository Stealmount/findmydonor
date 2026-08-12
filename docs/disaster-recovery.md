# Disaster Recovery — FindMyDonor (Phase 5.5)

Recovery runbooks for the production system (Oracle VM + Supabase + Redis). See [DEPLOY.md](../DEPLOY.md) for the normal deploy/rollback flow.

## Data Inventory

| Asset | Where it lives | Recoverability |
|---|---|---|
| PostgreSQL (Supabase) | Supabase cloud | Automatic daily backups (Pro plan, 7-day retention) |
| Local JSON data | `/home/ubuntu/findmydonor/data/` on VM | Manual `scp` copy |
| Redis cache | In-memory on VM (ephemeral) | Rebuilds itself; no restore needed |
| `.env` secrets | `/home/ubuntu/findmydonor/.env` on VM only | Must be recreated manually |
| Code | Git (local) → built → SCP to VM | Rebuild + SCP |

## 1. Supabase — Automatic Backups

- Enabled on the **Pro plan**: automatic daily backups, **7-day retention**.
- Restore via Supabase dashboard: **Database → Backups → Restore**. This creates a new database — point your `.env` `SUPABASE_URL` at it, or contact Supabase for an in-place restore.

## 2. Supabase — Manual `pg_dump`

```bash
# Connection string from Supabase dashboard → Settings → Database
pg_dump "postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres" \
  --no-owner --no-privileges -Fc -f supabase-backup-$(date +%F).dump

# Restore (into a fresh database)
pg_restore --no-owner --no-privileges -d postgresql://... supabase-backup.dump
```

- Also restore RLS policies from `database/migrations/` if the schema was rebuilt from scratch.

## 3. Local JSON Data — Daily Copy

The backend falls back to local JSON files in `data/`. Back them up daily:

```bash
scp -i .ssh-key/ssh-key-2026-07-11.key -r ubuntu@145.241.154.187:/home/ubuntu/findmydonor/data/ ./backup-data/
```

Suggested: cron on the VM (`crontab -e`):

```cron
0 2 * * * rsync -a /home/ubuntu/findmydonor/data/ /home/ubuntu/findmydonor/backups/data-$(date +\%F)/ 
```

## 4. PM2 Restart Procedure

```bash
ssh -i .ssh-key/ssh-key-2026-07-11.key ubuntu@145.241.154.187
pm2 list                                   # check both processes
pm2 restart findmydonor-backend            # restart API
pm2 restart findmydonor-admin              # restart admin dashboard
pm2 logs findmydonor-backend --lines 100   # inspect startup
curl -s https://findmydonor.online/api/health
```

## 5. Full VPS Rebuild

1. Provision a fresh Ubuntu 22.04 instance (Oracle Cloud).
2. Install Node 20+, PM2, Nginx, Redis.
3. Build locally: `npm run build`.
4. SCP `dist/`, `dist-admin/`, `ecosystem.config.cjs` to the VM (see DEPLOY.md).
5. Recreate `/home/ubuntu/findmydonor/.env` (ask the owner for the secret values).
6. `pm2 start ecosystem.config.cjs` → `pm2 save`.
7. Restore Supabase (Section 1/2) and local `data/` (Section 3).
8. Point Nginx to ports 3001/5000/6000 and re-issue the TLS cert (certbot).

## 6. DNS Failover

- Current DNS: `findmydonor.online` → Oracle VM `145.241.154.187`.
- If the VM is lost: spin up a new instance, complete Section 5, then update the DNS A record at the registrar to the new IP.
- TTL should be low (e.g. 300 s) so failover propagates quickly. While DNS propagates, the UptimeRobot monitors will alert — expected.

## Verification Checklist

- [ ] Supabase dashboard shows recent automatic backups
- [ ] `pg_dump` runs without errors
- [ ] `data/` rsync produces a non-empty dated folder
- [ ] PM2 restart → health endpoint returns `status: ok`
- [ ] Rebuild-from-scratch steps documented and feasible in < 2 hours
