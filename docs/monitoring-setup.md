# Monitoring Setup — FindMyDonor (Phase 5.1)

UptimeRobot (free tier) monitors the production endpoints and alerts by email/phone when the service is unreachable.

## Step 1 — Create an UptimeRobot account

1. Go to <https://uptimerobot.com> and sign up (free tier allows 50 monitors).
2. Confirm your email address.

## Step 2 — Add alert contact

1. From the dashboard, go to **My Settings → Alert Contacts → Add alert contact**.
2. Choose **Email** (or SMS/phone — free tier includes limited SMS).
3. Enter your address and verify the confirmation email.

## Step 3 — Add the API health monitor

1. Click **+ New monitor**.
2. Fill in:
   - Monitor type: **HTTP(s)**
   - Friendly name: `FindMyDonor API Health`
   - URL: `https://findmydonor.online/api/health`
   - Monitoring interval: **5 minutes**
   - Timeout: 30 s
3. Optional advanced: **Alert when HTTP status is not 2xx** (the health endpoint returns 503 when degraded).
4. Under **Alert contacts**, select the contact from Step 2.
5. Save. UptimeRobot should show **Operational** within a minute.

## Step 4 — Add the frontend monitor

1. **+ New monitor** again.
2. Fill in:
   - Monitor type: **HTTP(s)**
   - Friendly name: `FindMyDonor Website`
   - URL: `https://findmydonor.online`
   - Monitoring interval: **5 minutes**
   - Timeout: 30 s
3. Attach the same alert contact. Save.

## What the health endpoint reports

`GET /api/health` returns:

```json
{
  "status": "ok" | "degraded",
  "components": {
    "database": "up" | "degraded" | "down",
    "whatsapp_waha": "up" | "degraded" | "down" | "disabled",
    "cache": "up" | "down"
  }
}
```

- `status: ok` → HTTP 200
- `status: degraded` (Supabase unreachable) → HTTP 503, which trips the UptimeRobot alert.

## Verify

- Open the monitor URL in a browser: `https://findmydonor.online/api/health` → expect `{"status":"ok",...}`.
- Confirm the dashboard shows **Operational** for both monitors.
- Optional test: temporarily stop the backend (`pm2 stop findmydonor-backend` on the VM), confirm an alert fires, then restart.
