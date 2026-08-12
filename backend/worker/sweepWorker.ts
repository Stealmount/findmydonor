/**
 * Background Match Worker — sweep loop logic (extracted from server.ts, Phase 3.7).
 *
 * Runs every 2 minutes (scheduled from server.ts) to:
 *   1. Close expired requests
 *   2. Auto-expire stale pending matches (>30 min with no donor reply)
 *   3. Re-run matching for all open/matching requests (catches new donors)
 *
 * The worker is still started from server.ts via setTimeout/setInterval —
 * this file only owns the sweep logic (no separate process; that is Phase 6).
 */

import { randomUUID } from "node:crypto";
import { cacheSetNX, cacheDel } from "../src/lib/redisCache";
import {
  getCollection as getLocalOrFirestoreCollection,
  saveDoc as saveLocalOrFirestoreDoc,
} from "../src/lib/serverDb";
import { nowISO } from "../helpers/time";
import { log } from "../helpers/logger";
import { enqueueWhatsApp } from "../services/notificationService";
import type { BloodRequest, Match } from "../src/types";
import {
  ACTIVE_REQUEST_STATUSES,
  matchAndNotifyRequest,
  releaseDonorLock,
} from "../services/matchingEngine";

// Append-only audit trail — writes to request_events collection
async function logRequestEvent(requestId: string, event: string, actor: string = "system") {
  try {
    const id = randomUUID();
    const record = { id, request_id: requestId, event, actor, at: nowISO() };
    await saveLocalOrFirestoreDoc("request_events", id, record as unknown as Record<string, unknown>);
  } catch (e: any) {
    log.error("Audit event write failed", { requestId, err: e?.message });
  }
}

const WORKER_LOCK_KEY = "bg_worker_running";
const WORKER_LOCK_TTL_S = 120; // 2 minutes — prevents overlapping runs
const STALE_MATCH_MINUTES = 30; // auto-expire pending matches after 30 min

export async function runBackgroundMatchWorker() {
  // Acquire a Redis lock to prevent overlapping runs (e.g. PM2 cluster)
  const acquired = await cacheSetNX(WORKER_LOCK_KEY, "1", WORKER_LOCK_TTL_S);
  if (!acquired) {
    log.info("Worker skipped — previous run still active", { lockKey: WORKER_LOCK_KEY });
    return;
  }

  try {
    const now = new Date();
    const allRequests = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
    const activeRequests = allRequests.filter(r => ACTIVE_REQUEST_STATUSES.includes(r.status));

    let closedCount = 0;
    let matchedTotal = 0;
    let staleExpired = 0;

    // ——— Step 1: Close expired requests ———
    for (const req of activeRequests) {
      if (req.expires_at && new Date(req.expires_at) < now) {
        await saveLocalOrFirestoreDoc("blood_requests", req.id, {
          ...req,
          status: "closed",
          updated_at: nowISO(),
        } as unknown as Record<string, unknown>);

        // Release all donor locks for this request's pending matches
        const allMatches = await getLocalOrFirestoreCollection<Match>("matches");
        const pendingForReq = allMatches.filter(
          m => m.request_id === req.id && m.donor_response === "pending"
        );
        for (const m of pendingForReq) {
          await releaseDonorLock(m.donor_id);
          await saveLocalOrFirestoreDoc("matches", m.id, {
            ...m,
            donor_response: "expired",
            donor_response_at: nowISO(),
          } as unknown as Record<string, unknown>);
        }

        closedCount++;
        logRequestEvent(req.id, "auto_closed_expired", "worker").catch(() => {});
        continue; // skip matching for expired requests
      }
    }

    // ——— Step 2: Auto-expire stale pending matches (>30 min no reply) ———
    const allMatches = await getLocalOrFirestoreCollection<Match>("matches");
    const staleThreshold = new Date(now.getTime() - STALE_MATCH_MINUTES * 60 * 1000);

    for (const match of allMatches) {
      if (
        match.donor_response === "pending" &&
        match.created_at &&
        new Date(match.created_at) < staleThreshold
      ) {
        // Mark match as expired
        await saveLocalOrFirestoreDoc("matches", match.id, {
          ...match,
          donor_response: "expired",
          donor_response_at: nowISO(),
        } as unknown as Record<string, unknown>);
        await releaseDonorLock(match.donor_id);
        staleExpired++;

        // Auto-cascade: try to find the next donor for this request
        const request = allRequests.find(r => r.id === match.request_id);
        if (request && ACTIVE_REQUEST_STATUSES.includes(request.status)) {
          try {
            await matchAndNotifyRequest(request);
          } catch (e: any) {
            console.error(`[Worker] Cascade failed for request ${match.request_id}:`, e.message);
          }
        }
      }
    }

    // ——— Step 2b: SLA notification — if request >15 min old and no donor approved, WhatsApp requester
    const slaCutoff = new Date(now.getTime() - 15 * 60 * 1000);
    for (const req of allRequests) {
      if (!ACTIVE_REQUEST_STATUSES.includes(req.status)) continue;
      if (new Date(req.created_at) > slaCutoff) continue; // too new

      // Check if any match for this request has donor_response === "approved"
      const requestMatches = allMatches.filter(m => m.request_id === req.id);
      const hasApproved = requestMatches.some(m => m.donor_response === "approved");
      if (hasApproved) continue;

      // Guard: only send once per request (6h TTL)
      const slaKey = `sla_notified_${req.id}`;
      const alreadyNotified = await cacheSetNX(slaKey, "1", 6 * 60 * 60);
      if (!alreadyNotified) continue;

      const totalNotified = requestMatches.length;
      const phone = req.requester_phone;
      if (phone) {
        const text = `Still searching for ${req.blood_type_needed}. ${totalNotified} donors notified so far.`;
        // Non-critical notification → async via the messaging queue (Phase 3.8).
        await enqueueWhatsApp(phone, text).catch(e => console.error("[Worker] SLA WhatsApp enqueue failed:", e.message));
        logRequestEvent(req.id, "sla_notified", "worker").catch(() => {});
      }
    }

    // ——— Step 3: Re-run matching for all still-active requests ———
    const stillActive = allRequests.filter(
      r => ACTIVE_REQUEST_STATUSES.includes(r.status) &&
           (!r.expires_at || new Date(r.expires_at) >= now)
    );

    for (const req of stillActive) {
      try {
        const result = await matchAndNotifyRequest(req);
        matchedTotal += result.matched;
      } catch (e: any) {
        console.error(`[Worker] Match failed for ${req.tracking_code}:`, e.message);
      }
    }

    // ——— Step 4: Trigger e-RaktKosh Blood Bank & Camps Sync ———
    try {
      const { syncBloodBanks, syncCamps } = await import("../services/eraktkoshSyncService");
      await syncBloodBanks().catch(e => console.warn("[Worker] Blood bank sync warning:", e.message));
      await syncCamps().catch(e => console.warn("[Worker] Camp sync warning:", e.message));
    } catch (e: any) {
      console.warn("[Worker] e-RaktKosh sync module notice:", e.message);
    }

    console.log(
      `[Worker] Sweep complete — ` +
      `checked ${stillActive.length} request(s), ` +
      `${matchedTotal} new match(es), ` +
      `${closedCount} expired request(s) closed, ` +
      `${staleExpired} stale match(es) auto-expired`
    );
  } catch (err: any) {
    log.error("Worker fatal error", { err: err.message });
  } finally {
    // Always release the lock so next run can proceed
    await cacheDel(WORKER_LOCK_KEY);
  }
}
