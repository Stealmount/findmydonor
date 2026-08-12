// Tracking routes — extracted from server.ts (Phase 3 decomposition, 3.6.6)
// Owns: SOS request creation, public tracking lookup, requester cancel/reopen/fulfill/broadcast-toggle
import express, { Router } from "express";
import { randomUUID, randomBytes } from "node:crypto";
import {
  getCollection as getLocalOrFirestoreCollection,
  getDoc as getLocalOrFirestoreDoc,
  saveDoc as saveLocalOrFirestoreDoc,
} from "../src/lib/serverDb";
import { cacheInvalidatePrefix } from "../src/lib/redisCache";
import { getAuthenticatedUser, consumeOtpTicket } from "../middleware/auth";
import rateLimitMiddleware from "../middleware/rateLimiter";
import { normalizePhone, isValidIndianPhone } from "../helpers/phone";
import { nowISO } from "../helpers/time";
import { matchAndNotifyRequest } from "../services/matchingEngine";
import type { BloodRequest, Match, User } from "../src/types";

const router = Router();

// Express 4 does not forward rejected async handlers to its error middleware.
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

// ─── Helper: verify requester via auth session or SOS OTP ticket ─────────────
const checkRequesterAuth = async (req: express.Request, request: BloodRequest) => {
  const authUser = await getAuthenticatedUser(req);
  if (authUser && (authUser.id === request.requester_id || authUser.email === request.requester_email)) return true;
  const { verificationToken } = req.body || {};
  if (verificationToken && request.requester_phone) {
    const normalizedPhone = normalizePhone(request.requester_phone);
    if (await consumeOtpTicket(String(verificationToken), normalizedPhone, "sos")) return true;
  }
  return false;
};

// ─── POST /api/sos/requests — unauthenticated SOS flow ─────────────────────────
router.post("/api/sos/requests", rateLimitMiddleware(10, 60_000), wrap(async (req, res) => {
  const body = req.body || {};
  const { verificationToken, requester_name, requester_phone } = body;
  if (!verificationToken || !String(requester_name || "").trim() || !String(requester_phone || "").trim()) {
    return res.status(400).json({ error: "Provide a verified SOS ticket, your name, and your WhatsApp number." });
  }
  const normalizedContact = normalizePhone(String(requester_phone));
  if (!isValidIndianPhone(normalizedContact)) {
    return res.status(400).json({ error: "Enter a valid Indian mobile number." });
  }
  if (!await consumeOtpTicket(String(verificationToken), normalizedContact, "sos")) {
    return res.status(403).json({ error: "WhatsApp verification expired. Request a new OTP." });
  }
  const bloodGroups = new Set(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]);
  const units = Number(body.units_required);
  if (!body.patient_name || !bloodGroups.has(body.blood_type_needed) || !Number.isInteger(units) || units < 1 || units > 10 ||
    !body.hospital_name || !/^\d{6}$/.test(String(body.hospital_pincode)) || !body.hospital_area || !body.hospital_city) {
    return res.status(400).json({ error: "Complete the patient, exact blood group, units, and hospital location fields." });
  }
  if (body.component_needed && !["Whole Blood (WB)", "Packed Red Blood Cells (PRBC)"].includes(body.component_needed)) {
    return res.status(400).json({ error: "Component-specific matching requires blood-bank review. Use whole blood or PRBC for this pilot." });
  }

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
    urgency_level: body.urgency_level || "critical",
    requester_id: `sos:${normalizedContact}`,
    requester_name: String(requester_name).trim(),
    requester_email: "",
    requester_phone: normalizedContact,
    additional_notes: body.additional_notes || "",
    status: "broadcasting",
    showcase_opt_in: Boolean(body.showcase_opt_in),
    share_contact_immediately: Boolean(body.share_contact_immediately),
    expires_at: body.expires_at || new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    fulfilled_at: null,
    created_at: now,
  };
  await saveLocalOrFirestoreDoc("blood_requests", id, request as unknown as Record<string, unknown>);

  let matched = 0;
  try {
    const result = await matchAndNotifyRequest(request);
    matched = result.matched;
  } catch (matchErr: any) {
    console.error("[SOS Matching] failed for", id, ":", matchErr.message);
  }
  return res.status(201).json({
    requestId: id,
    trackingCode: request.tracking_code,
    status: "broadcasting",
    matched,
    verifiedContact: normalizedContact,
  });
}));

// ─── GET /api/requests/:trackingCode — public tracking lookup ────────────────
router.get("/api/requests/:trackingCode", wrap(async (req, res) => {
  const all = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
  const request = all.find(r => r.tracking_code.toUpperCase() === req.params.trackingCode.toUpperCase().trim() || r.id === req.params.trackingCode);
  if (!request) return res.status(404).json({ error: "No active blood request found with this tracking code. Please verify the code and try again." });
  const allMatches = await getLocalOrFirestoreCollection<Match>("matches");
  const rawMatches = allMatches.filter(m => m.request_id === request.id);
  const allDonors = await getLocalOrFirestoreCollection<User>("users");

  // Lazy backfill — mint public_token for any legacy match that lacks one
  for (const m of rawMatches) {
    if (!m.public_token) {
      m.public_token = randomBytes(16).toString("hex");
      await saveLocalOrFirestoreDoc("matches", m.id, { ...m });
    }
  }

  // Safe public projection — strip raw match UUID and donor UUID.
  // matchToken is the opaque capability token; frontend joins donors[] by matchToken.
  const matches = rawMatches.map(m => {
    const d = allDonors.find(u => u.id === m.donor_id);
    return {
      matchToken:           m.public_token,
      blood_type:           d?.blood_type,
      area:                 d?.area,
      city:                 d?.city,
      distance_km:          m.distance_km,
      status:               m.donor_response,
      unit_slot:            m.unit_slot ?? null,
      // Approved donors' contact info: kept for requester coordination (functional requirement)
      ...(m.donor_response === "approved" ? {
        donor_name:  d?.full_name,
        donor_phone: d?.whatsapp_number || d?.phone,
      } : {}),
    };
  });

  // Mask requester PII — tracking code is public but contact info is not
  const safeRequest = {
    ...request,
    requester_name:  undefined,
    requester_email: undefined,
    requester_phone: undefined,
    requester_id:    undefined,
    patient_name:    undefined,
    patient_age:     undefined,
    patient_gender:  undefined,
  };
  return res.json({ request: safeRequest, matches });
}));

// ─── PATCH /api/requests/:trackingCode/cancel ────────────────────────────────
router.patch("/api/requests/:trackingCode/cancel", wrap(async (req, res) => {
  const allRequests = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
  const request = allRequests.find(r => r.tracking_code === req.params.trackingCode || r.id === req.params.trackingCode);
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (!await checkRequesterAuth(req, request)) return res.status(403).json({ error: "Unauthorized" });
  const updated = { ...request, status: "cancelled" as const, updated_at: nowISO() };
  await saveLocalOrFirestoreDoc("blood_requests", request.id, updated);
  await cacheInvalidatePrefix("req_status_");
  logRequestEvent(request.id, "cancelled", request.requester_id).catch(() => {});
  return res.json({ success: true, request: updated });
}));

// ─── PATCH /api/requests/:trackingCode/reopen ────────────────────────────────
router.patch("/api/requests/:trackingCode/reopen", wrap(async (req, res) => {
  const allRequests = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
  const request = allRequests.find(r => r.tracking_code === req.params.trackingCode || r.id === req.params.trackingCode);
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (!await checkRequesterAuth(req, request)) return res.status(403).json({ error: "Unauthorized" });
  const updated = { ...request, status: "open" as const, updated_at: nowISO() };
  await saveLocalOrFirestoreDoc("blood_requests", request.id, updated);
  await cacheInvalidatePrefix("req_status_");
  logRequestEvent(request.id, "reopened", request.requester_id).catch(() => {});
  return res.json({ success: true, request: updated });
}));

// ─── PATCH /api/requests/:trackingCode/fulfill ───────────────────────────────
router.patch("/api/requests/:trackingCode/fulfill", wrap(async (req, res) => {
  const all = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
  const r = all.find(x => x.tracking_code === req.params.trackingCode || x.id === req.params.trackingCode);
  if (!r) return res.status(404).json({ error: "Request not found" });
  if (!await checkRequesterAuth(req, r)) return res.status(403).json({ error: "Unauthorized" });
  await saveLocalOrFirestoreDoc("blood_requests", r.id, { ...r, status: "fulfilled", fulfilled_at: nowISO() });
  logRequestEvent(r.id, "fulfilled", r.requester_id).catch(() => {});
  return res.json({ success: true });
}));

// ─── PATCH /api/requests/:trackingCode/broadcast-toggle ──────────────────────
router.patch("/api/requests/:trackingCode/broadcast-toggle", wrap(async (req, res) => {
  const all = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
  const r = all.find(x => x.tracking_code === req.params.trackingCode || x.id === req.params.trackingCode);
  if (!r) return res.status(404).json({ error: "Request not found" });
  if (!await checkRequesterAuth(req, r)) return res.status(403).json({ error: "Unauthorized" });
  await saveLocalOrFirestoreDoc("blood_requests", r.id, { ...r, broadcast_to_simulator: !r.broadcast_to_simulator });
  return res.json({ success: true });
}));

export default router;
