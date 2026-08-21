// Requester routes — extracted from server.ts (Phase 3 decomposition, 3.6.4)
import express, { Router } from "express";
import { randomUUID } from "node:crypto";
import {
  getCollection as getLocalOrFirestoreCollection,
  getDoc as getLocalOrFirestoreDoc,
  saveDoc as saveLocalOrFirestoreDoc,
} from "../src/lib/serverDb";
import { db } from "../src/lib/firebase";
import { cacheSetNX, cacheGet, cacheSet } from "../src/lib/redisCache";
import { getAuthenticatedUser, getLinkedProfile, consumeOtpTicket } from "../middleware/auth";
import rateLimitMiddleware from "../middleware/rateLimiter";
import { normalizePhone, isValidIndianPhone } from "../helpers/phone";
import { nowISO } from "../helpers/time";
import { matchAndNotifyRequest } from "../services/matchingEngine";
import { validate } from "../validation";
import { bloodRequestSchema } from "../validation/requests";
import { sendErrorResponse, UnauthorizedError, NotFoundError, ForbiddenError, ValidationError, AppError, ServiceUnavailableError } from "../helpers/errors";
import type { BloodRequest, Match, Requester, User } from "../src/types";


const router = Router();

// Express 4 does not forward rejected async handlers to its error middleware.
// Wrap routes once so a provider outage returns a response instead of taking down Node.
const wrap = (handler: express.RequestHandler): express.RequestHandler => (req, res, next) => {
  try {
    const result = handler(req, res, next) as unknown;
    if (result && typeof (result as Promise<unknown>).catch === "function") {
      void (result as Promise<unknown>).catch(next);
    }
  } catch (error) {
    next(error);
  }
};

// ─── Helper: log a request lifecycle event ────────────────────────────────────
async function logRequestEvent(requestId: string, event: string, actor: string = "system") {
  try {
    const id = randomUUID();
    const record = { id, request_id: requestId, event, actor, at: nowISO() };
    await saveLocalOrFirestoreDoc("request_events", id, record as unknown as Record<string, unknown>);
  } catch (e: any) {
    console.error(`[Audit] Failed to log event for ${requestId}:`, e.message);
  }
}

// ─── Helper: resolve requester identity from auth + profile/legacy tables ─────
async function resolveRequester(
  authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
  body?: Record<string, unknown>
): Promise<Requester | null> {
  // 1. Try new profiles table
  try {
    const linked = await getLinkedProfile(authUser.id);
    if (linked?.profile.whatsapp_verified && linked.profile.can_request) {
      return {
        id: linked.profile.id,
        full_name: linked.profile.full_name,
        email: linked.profile.email || authUser.email || "",
        phone: linked.profile.phone,
        whatsapp_number: linked.profile.whatsapp_phone,
        created_at: linked.profile.consent_accepted_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  } catch (e) {
    console.warn("[Requester] Profile lookup failed:", e);
  }

  // 2. Fall back to legacy requesters collection
  const fromLegacy = await getLocalOrFirestoreDoc<Requester>("requesters", authUser.id);
  if (fromLegacy) return fromLegacy;

  // 3. Fall back to donor doc
  const donorDoc = await getLocalOrFirestoreDoc<User>("users", authUser.id);
  if (donorDoc && (donorDoc.whatsapp_verified || donorDoc.phone)) {
    const req: Requester = {
      id: authUser.id,
      full_name: donorDoc.full_name,
      email: donorDoc.email || authUser.email || "",
      phone: donorDoc.phone,
      whatsapp_number: donorDoc.whatsapp_number || donorDoc.phone,
      created_at: donorDoc.created_at || nowISO(),
      updated_at: nowISO(),
    };
    await saveLocalOrFirestoreDoc("requesters", req.id, req as unknown as Record<string, unknown>);
    return req;
  }

  // 4. Fall back to inline body phone (no session required)
  if (body && isValidIndianPhone(normalizePhone(String(body.requester_phone || "")))) {
    const now = nowISO();
    const email = body.requester_email as string | undefined;
    const req: Requester = {
      id: authUser.id,
      full_name: String(body.requester_name || (authUser.user_metadata?.full_name as string) || "Requester").trim(),
      email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
        ? String(email).trim().toLowerCase()
        : authUser.email || "",
      phone: normalizePhone(String(body.requester_phone)),
      whatsapp_number: normalizePhone(String(body.requester_phone)),
      created_at: now,
      updated_at: now,
    };
    await saveLocalOrFirestoreDoc("requesters", req.id, req as unknown as Record<string, unknown>);
    return req;
  }

  return null;
}

// ─── Legacy requester creation (disabled) ─────────────────────────────────────
// Profiles are created by the API only after both Auth and WhatsApp OTP succeed.
router.post("/api/profiles/requester", rateLimitMiddleware(10, 60_000), wrap(async (_req, res) => {
  // DISABLED: Legacy OTP-gated requester creation. Use /api/auth/phone-signup.
  return res.status(410).json({ error: "Legacy requester signup is disabled. Use the new auth flow." });
}));

// ─── Create blood request ──────────────────────────────────────────────────────
router.post("/api/requests", rateLimitMiddleware(10, 60_000), validate(bloodRequestSchema), wrap(async (req, res) => {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });

    const requester = await resolveRequester(authUser, req.body || {});
    if (!requester) return res.status(403).json({ error: "Complete WhatsApp verification before creating a blood request." });

    // Feature 1: Idempotency — prevent double-taps from creating duplicate requests
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    if (idempotencyKey) {
      const acquired = await cacheSetNX(`idem_${idempotencyKey}`, "1", 60);
      if (!acquired) {
        // ponytail: poll for in-flight result from concurrent request
        const resultKey = `idem_result_${idempotencyKey}`;
        for (let attempt = 0; attempt < 3; attempt++) {
          const cached = await cacheGet<string>(resultKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            return res.status(409).json({ error: "Duplicate request", ...parsed });
          }
          await new Promise(r => setTimeout(r, 150));
        }
        return res.status(409).json({ error: "Request still processing, retry in a few seconds" });
      }
    }

    const body = req.body || {};
    const units = Number(body.units_required);

    // Feature 5: Duplicate-request guard — best-effort, skip on failure
    try {
      const allReqs = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const dup = allReqs.find(r =>
        r.requester_phone === requester!.phone &&
        r.hospital_name?.toLowerCase().trim() === String(body.hospital_name).toLowerCase().trim() &&
        r.blood_type_needed === body.blood_type_needed &&
        r.created_at >= tenMinAgo
      );
      if (dup && !idempotencyKey) {
        return res.status(200).json({ requestId: dup.id, trackingCode: dup.tracking_code, status: dup.status, duplicate: true });
      }
    } catch (guardErr) {
      console.warn("[Requests] Duplicate guard skipped — table may not exist:", guardErr);
    }

    const isDraft = body.status === "draft";
    const id = randomUUID();
    const now = nowISO();
    const request: BloodRequest = {
      id,
      tracking_code: `BLD-${new Date().getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}`,
      patient_name: String(body.patient_name).trim(),
      patient_age: body.patient_age ? Number(body.patient_age) : undefined,
      patient_gender: body.patient_gender,
      blood_type_needed: body.blood_type_needed,
      component_needed: body.component_needed,
      units_required: units,
      hospital_name: String(body.hospital_name).trim(),
      hospital_uhid: body.hospital_uhid,
      attending_doctor: body.attending_doctor,
      hospital_pincode: String(body.hospital_pincode),
      hospital_area: String(body.hospital_area).trim(),
      hospital_city: String(body.hospital_city).trim(),
      hospital_state: body.hospital_state,
      urgency_level: body.urgency_level || "urgent",
      requester_id: requester.id,
      requester_name: requester.full_name,
      requester_email: requester.email,
      requester_phone: requester.phone,
      additional_notes: body.additional_notes || "",
      status: isDraft ? "draft" : "broadcasting",
      showcase_opt_in: Boolean(body.showcase_opt_in),
      share_contact_immediately: Boolean(body.share_contact_immediately),
      expires_at: body.expires_at || new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      fulfilled_at: null,
      created_at: now,
    };
    await saveLocalOrFirestoreDoc("blood_requests", id, request as unknown as Record<string, unknown>);

    // Cache the result for concurrent double-tap protection
    if (idempotencyKey) {
      await cacheSet(
        `idem_result_${idempotencyKey}`,
        JSON.stringify({ requestId: id, trackingCode: request.tracking_code }),
        60
      );
    }
    logRequestEvent(id, "created", requester.id).catch(() => {});

    // If saved as a draft, skip matching entirely — no notifications sent.
    if (isDraft) {
      console.log(`[Requests] Draft saved: ${request.tracking_code}`);
      return res.status(201).json({ requestId: id, trackingCode: request.tracking_code, status: "draft", matched: 0 });
    }

    // Matching is best-effort: if it crashes (e.g. schema mismatch), the request is already saved.
    let matched = 0;
    try {
      const result = await matchAndNotifyRequest(request);
      matched = result.matched;
    } catch (matchErr: any) {
      console.error("[Matching] Failed for request", id, "— request saved, matching skipped:", matchErr.message);
    }
    return res.status(201).json({ requestId: id, trackingCode: request.tracking_code, status: "broadcasting", matched });
  } catch (err: any) {
    if (err?.name === "FirebaseUnavailableError" || err?.code?.startsWith?.("42") || err?.code === "PGRST116") {
      return sendErrorResponse(res, err, "Database is temporarily unavailable. Please try again in a few seconds.", 503, "SERVICE_UNAVAILABLE");
    }
    return sendErrorResponse(res, err, "A failure occurred while saving your blood request. Please try again.");
  }
}));

// ── Promote a draft to a live broadcast (triggers matching engine) ─────────────
router.post("/api/requests/:id/broadcast", rateLimitMiddleware(10, 60_000), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const request = await getLocalOrFirestoreDoc<BloodRequest>("blood_requests", req.params.id);
  if (!request) return sendErrorResponse(res, new NotFoundError("Request not found."));
  if (request.requester_id !== authUser.id) return sendErrorResponse(res, new ForbiddenError("Not your request."));
  if (request.status !== "draft") return sendErrorResponse(res, new AppError("Only draft requests can be broadcast.", 409, "INVALID_STATUS"));

  // Transition to broadcasting before running the engine
  const now = nowISO();
  const updated = { ...request, status: "broadcasting" as const, updated_at: now };
  await saveLocalOrFirestoreDoc("blood_requests", request.id, updated as unknown as Record<string, unknown>);

  let matched = 0;
  try {
    const result = await matchAndNotifyRequest(updated);
    matched = result.matched;
  } catch (matchErr: any) {
    console.error("[Matching] Failed for draft broadcast", request.id, ":", matchErr.message);
  }
  return res.json({ requestId: request.id, trackingCode: request.tracking_code, status: "broadcasting", matched });
}));

// ─── Public feed of opt-in live requests ──────────────────────────────────────
router.get("/api/live-requests", rateLimitMiddleware(60, 60_000), wrap(async (_req, res) => {
  try {
    let requestsData: any[] = [];
    try {
      const snap = await db.collection("blood_requests").limit(50).get();
      requestsData = snap.docs.map(d => d.data());
    } catch {
      requestsData = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
    }
    const activeStatuses = new Set(["open", "matching", "partially_matched", "broadcasting"]);
    const filtered = requestsData
      .filter((r: any) => r && r.showcase_opt_in && activeStatuses.has(r.status))
      .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 12)
      .map((r: any) => ({
        blood_type_needed: r.blood_type_needed,
        units_required: r.units_required,
        hospital_city: r.hospital_city,
        urgency_level: r.urgency_level,
        created_at: r.created_at,
      }));
    return res.json({ requests: filtered });
  } catch (error) {
    console.warn("[live-requests] error:", (error as Error)?.message || error);
    return res.json({ requests: [] });
  }
}));

// ─── Requester dashboard ───────────────────────────────────────────────────────
router.get("/api/dashboard/requester", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));

  const requester = await resolveRequester(authUser);
  if (!requester) return sendErrorResponse(res, new NotFoundError("Requester profile not found."));

  const allRequests = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
  const requests = allRequests.filter(request =>
    request.requester_id === requester!.id ||
    request.requester_id === authUser.id ||
    (requester!.phone && normalizePhone(request.requester_phone || "") === normalizePhone(requester!.phone)) ||
    (requester!.whatsapp_number && normalizePhone(request.requester_phone || "") === normalizePhone(requester!.whatsapp_number))
  );
  const requestIds = new Set(requests.map(r => r.id));
  const allMatches = await getLocalOrFirestoreCollection<Match>("matches");
  const matches = allMatches.filter(match => requestIds.has(match.request_id));
  const approvedDonorIds = new Set(
    matches.filter(match => match.donor_response === "approved").map(match => match.donor_id)
  );
  const allDonors = await getLocalOrFirestoreCollection<User>("users");
  const donors = allDonors.filter(donor => approvedDonorIds.has(donor.id));
  return res.json({ requester, requests, matches, donors });
}));

// ─── Requester's request list ─────────────────────────────────────────────────
router.get("/api/requester/requests", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  let requesterId = authUser.id;
  let requesterPhone: string | null = null;
  try {
    const linked = await getLinkedProfile(authUser.id);
    if (linked?.profile?.id) requesterId = linked.profile.id;
    if (linked?.profile?.phone) requesterPhone = linked.profile.phone;
  } catch (e) {
    console.warn("[RequesterReqs] Profile lookup failed:", e);
  }

  const allRequests = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
  const requests = allRequests.filter(request =>
    request.requester_id === requesterId ||
    request.requester_id === authUser.id ||
    (requesterPhone && normalizePhone(request.requester_phone || "") === normalizePhone(requesterPhone))
  );
  const requestIds = new Set(requests.map(r => r.id));
  const allMatches = await getLocalOrFirestoreCollection<Match>("matches");
  const matches = allMatches.filter(match => requestIds.has(match.request_id));
  const approvedDonorIds = new Set(
    matches.filter(match => match.donor_response === "approved").map(match => match.donor_id)
  );
  const allDonors = await getLocalOrFirestoreCollection<User>("users");
  const donors = allDonors.filter(donor => approvedDonorIds.has(donor.id));
  return res.json({ requests, matches, donors });
}));

export default router;
