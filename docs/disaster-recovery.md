# Disaster Recovery — FindMyDonor

Recovery runbooks for the production system (Oracle VM + Firebase Firestore + Redis).

## Data Inventory

| Asset | Where it lives | Recoverability |
|-------|----------------|----------------|
| Firestore | Firebase Cloud | Automatic daily backups (30-day retention) |
| Redis cache | In-memory on VM (ephemeral) | Rebuilds itself; no restore needed |
| `.env` secrets | `/home/ubuntu/findmydonor/.env` on VM | Must be recreated manually |
| Code | Git (local) -> built -> SCP to VM | Rebuild + SCP |

## 1. Firestore — Automatic Backups

Firebase automatically backs up Firestore data. Restore via Firebase Console:
- Go to Firebase Console -> Firestore -> Backups
- Select a backup and restore

## 2. Firestore — Manual Export

```bash
# Export all collections to Google Cloud Storage
gcloud firestore export gs://findmydonor-backups/$(date +%F)

# Export specific collection
gcloud firestore export gs://findmydonor-backups/$(date +%F) --collection-ids=profiles,donor_profiles,blood_requests
```

## 3. PM2 Restart Procedure

```bash
ssh ubuntu@145.241.154.187
pm2 list                                   # check processes
pm2 restart findmydonor-backend            # restart API
pm2 restart findmydonor-admin              # restart admin
pm2 logs findmydonor-backend --lines 100   # inspect startup
curl -s https://findmydonor.online/api/health
```

## 4. Full VPS Rebuild

1. Provision fresh Ubuntu 22.04 instance (Oracle Cloud)
2. Install Node 20+, PM2, Nginx, Redis (Docker)
3. Build locally: `npm run build`
4. SCP `dist/`, `dist-admin/`, `ecosystem.config.cjs` to VM
5. Recreate `/home/ubuntu/findmydonor/.env`
6. `pm2 start ecosystem.config.cjs` -> `pm2 save`
7. Point Nginx to ports 3001/5000/6000 and issue TLS cert

## 5. DNS Failover

- Current DNS: `findmydonor.online` -> Oracle VM `145.241.154.187`
- If VM lost: spin up new instance, complete Section 4, update DNS A record
- Keep TTL low (300s) for fast propagation

## Verification Checklist

- [ ] Firestore dashboard shows recent backups
- [ ] PM2 restart -> health endpoint returns status: ok
- [ ] Rebuild steps documented and feasible in < 2 hours
