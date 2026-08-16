// Matching routes — extracted from server.ts (Phase 3 decomposition, 3.6.5)
// Owns: match approve/decline, public token response, status polling,
//       notification-sent/reminder-sent/timeout/confirm-donation, next-donor
import express, { Router } from "express";
import { randomUUID, randomBytes } from "node:crypto";
import {
  getCollection as getLocalOrFirestoreCollection,
  getDoc as getLocalOrFirestoreDoc,
  saveDoc as saveLocalOrFirestoreDoc,
} from "../src/lib/serverDb";
import {
  cacheGet,
  cacheSet,
  cacheInvalidatePrefix,
} from "../src/lib/redisCache";
import { getAuthenticatedUser } from "../middleware/auth";
import { timingSafeEqualStr } from "../middleware/auth";
import rateLimitMiddleware from "../middleware/rateLimiter";
import { validate } from "../validation";
import { respondPublicSchema } from "../validation/matching";
import { normalizePhone } from "../helpers/phone";
import { nowISO, daysFromNow } from "../helpers/time";
import {
  sendWhatsApp,
  sendDonorWhatsApp,
  buildDonorConfirmedDetailsMessage,
  buildRequesterConfirmMessage,
  buildDonorDeclineAckMessage,
  buildDonorThankYouMessage,
  buildDonorReferralMessage,
} from "../src/lib/waha";
import { buildRequesterConfirmEmailHTML } from "../src/lib/email";
import { sendEmailViaResend } from "../services/notificationService";
import {
  releaseDonorLock,
  createNextDonorMatch,
  matchAndNotifyRequest,
  findEligibleDonors,
} from "../services/matchingEngine";
import { sendErrorResponse, UnauthorizedError, NotFoundError, ForbiddenError, AppError } from "../helpers/errors";
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

// ─── Helper: approve a match by ID ────────────────────────────────────────────
export async function approveMatchById(
  matchId: string,
  timestamp?: string
): Promise<{ ok: boolean; error?: string; status?: number; data?: Record<string, unknown> }> {
  const match = await getLocalOrFirestoreDoc<Match>("matches", matchId);
  if (!match) return { ok: false, error: "Match not found", status: 404 };
  if (match.donor_response !== "pending") return { ok: false, error: "Already resolved", status: 409 };
  const [request, donor] = await Promise.all([
    getLocalOrFirestoreDoc<BloodRequest>("blood_requests", match.request_id),
    getLocalOrFirestoreDoc<User>("users", match.donor_id),
  ]);
  if (!request || !donor) return { ok: false, error: "Request or donor not found", status: 404 };
  await saveLocalOrFirestoreDoc("matches", matchId, {
    ...match,
    donor_response: "approved",
    donor_response_at: timestamp || nowISO(),
    contact_shared_at: nowISO(),
  });
  if (request.requester_phone) {
    await sendWhatsApp(request.requester_phone, buildRequesterConfirmMessage(request, donor.full_name));
  }
  if (request.requester_email) {
    const ep = buildRequesterConfirmEmailHTML({
      requesterName: request.requester_name,
      donorName: donor.full_name,
      bloodType: request.blood_type_needed,
      trackingCode: request.tracking_code,
      hospitalName: request.hospital_name,
    });
    await sendEmailViaResend(request.requester_email, ep.subject, ep.html, ep.text);
  }
  await cacheInvalidatePrefix("match_status_");
  await cacheInvalidatePrefix("pending_matches_");
  await cacheInvalidatePrefix("req_status_");
  return { ok: true, data: { success: true } };
}

// ─── Helper: decline a match by ID ───────────────────────────────────────────
export async function declineMatchById(
  matchId: string,
  timestamp?: string
): Promise<{ ok: boolean; error?: string; status?: number }> {
  const match = await getLocalOrFirestoreDoc<Match>("matches", matchId);
  if (!match) return { ok: false, error: "Match not found", status: 404 };
  await saveLocalOrFirestoreDoc("matches", matchId, {
    ...match,
    donor_response: "declined",
    donor_response_at: timestamp || nowISO(),
  });
  await releaseDonorLock(match.donor_id);
  await cacheInvalidatePrefix("match_status_");
  await cacheInvalidatePrefix("pending_matches_");
  return { ok: true };
}

// ─── POST /api/matches/:matchId/approve ───────────────────────────────────────
router.post("/api/matches/:matchId/approve", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const match = await getLocalOrFirestoreDoc<Match>("matches", req.params.matchId);
  if (!match || match.donor_id !== authUser.id) return sendErrorResponse(res, new NotFoundError("Match not found or unauthorized"));
  const result = await approveMatchById(req.params.matchId, req.body?.responseTimestamp);
  if (!result.ok) return sendErrorResponse(res, new AppError(result.error || "Failed to approve match", result.status || 500));
  return res.json(result.data);
}));

// ─── POST /api/matches/:matchId/decline ───────────────────────────────────────
router.post("/api/matches/:matchId/decline", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const match = await getLocalOrFirestoreDoc<Match>("matches", req.params.matchId);
  if (!match || match.donor_id !== authUser.id) return sendErrorResponse(res, new NotFoundError("Match not found or unauthorized"));
  const result = await declineMatchById(req.params.matchId, req.body?.responseTimestamp);
  if (!result.ok) return sendErrorResponse(res, new AppError(result.error || "Failed to decline match", result.status || 500));
  return res.json({ success: true });
}));

// ─── POST /api/notify-match (deprecated 410) ──────────────────────────────────
router.post("/api/notify-match", rateLimitMiddleware(30, 60_000), wrap(async (_req, res) => {
  return sendErrorResponse(res, new AppError("Deprecated. Requests now start matching through POST /api/requests.", 410, "GONE"));
}));

// ─── POST /api/request/match-and-notify (deprecated 410) ─────────────────────
router.post("/api/request/match-and-notify", rateLimitMiddleware(20, 60_000), wrap(async (_req, res) => {
  return sendErrorResponse(res, new AppError("Deprecated. Requests now start matching through POST /api/requests.", 410, "GONE"));
}));

// ─── GET /api/requests/:requestId/status ─────────────────────────────────────
router.get("/api/requests/:requestId/status", wrap(async (req, res) => {
  const cacheKey = `req_status_${req.params.requestId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) { res.setHeader("X-Cache", "HIT"); return res.json(cached); }
  const request = await getLocalOrFirestoreDoc<BloodRequest>("blood_requests", req.params.requestId);
  if (!request) return sendErrorResponse(res, new NotFoundError("Request not found"));
  const payload = { status: request.status };
  await cacheSet(cacheKey, payload, 15);
  res.setHeader("X-Cache", "MISS");
  return res.json(payload);
}));

// ─── GET /api/matches/:matchId/status ────────────────────────────────────────
router.get("/api/matches/:matchId/status", wrap(async (req, res) => {
  const cacheKey = `match_status_${req.params.matchId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) { res.setHeader("X-Cache", "HIT"); return res.json(cached); }
  const match = await getLocalOrFirestoreDoc<Match>("matches", req.params.matchId);
  if (!match) return sendErrorResponse(res, new NotFoundError("Match not found"));
  const payload = { donor_response: match.donor_response };
  await cacheSet(cacheKey, payload, 15);
  res.setHeader("X-Cache", "MISS");
  return res.json(payload);
}));

// ─── POST /api/matches/:matchId/notification-sent ────────────────────────────
router.post("/api/matches/:matchId/notification-sent", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Authentication required"));
  const match = await getLocalOrFirestoreDoc<Match>("matches", req.params.matchId);
  if (!match) return sendErrorResponse(res, new NotFoundError("Match not found"));
  const isAdmin = (authUser as any).role === "admin" || authUser.id === "admin-id";
  if (!isAdmin && match.donor_id !== authUser.id) return sendErrorResponse(res, new ForbiddenError("Not authorized"));
  await saveLocalOrFirestoreDoc("matches", req.params.matchId, {
    ...match,
    notification_sent_at: nowISO(),
  });
  return res.json({ success: true });
}));

// ─── POST /api/matches/respond-public ────────────────────────────────────────
router.post("/api/matches/respond-public", rateLimitMiddleware(10, 60_000), validate(respondPublicSchema), wrap(async (req, res) => {
  const { response, token } = req.body;

  const allMatches = await getLocalOrFirestoreCollection<Match>("matches");
  let match: Match | null = null;
  for (const m of allMatches) {
    if (m.public_token && timingSafeEqualStr(token, m.public_token)) {
      match = m;
      break;
    }
  }

  if (!match) return sendErrorResponse(res, new ForbiddenError("Invalid or expired capability token"));
  if (match.donor_response !== "pending")
    return sendErrorResponse(res, new AppError("Already resolved", 409, "ALREADY_RESOLVED"));

  const result = response === "approved"
    ? await approveMatchById(match.id)
    : await declineMatchById(match.id);
  if (!result.ok) return sendErrorResponse(res, new AppError(result.error || "Failed to respond", result.status || 500));
  return res.json({ ok: true });
}));

// ─── POST /api/matches/:matchId/reminder-sent ────────────────────────────────
router.post("/api/matches/:matchId/reminder-sent", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Authentication required"));
  const match = await getLocalOrFirestoreDoc<Match>("matches", req.params.matchId);
  if (!match) return sendErrorResponse(res, new NotFoundError("Match not found"));
  const isAdmin = (authUser as any).role === "admin" || authUser.id === "admin-id";
  if (!isAdmin && match.donor_id !== authUser.id) return sendErrorResponse(res, new ForbiddenError("Not authorized"));
  await saveLocalOrFirestoreDoc("matches", req.params.matchId, {
    ...match,
    reminder_sent_at: req.body?.sentAt || nowISO(),
  });
  return res.json({ success: true });
}));

// ─── POST /api/matches/:matchId/timeout ──────────────────────────────────────
router.post("/api/matches/:matchId/timeout", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Authentication required"));
  const match = await getLocalOrFirestoreDoc<Match>("matches", req.params.matchId);
  if (!match) return sendErrorResponse(res, new NotFoundError("Match not found"));
  const isAdmin = (authUser as any).role === "admin" || authUser.id === "admin-id";
  if (!isAdmin && match.donor_id !== authUser.id) return sendErrorResponse(res, new ForbiddenError("Not authorized"));
  await saveLocalOrFirestoreDoc("matches", req.params.matchId, {
    ...match,
    donor_response: "timed_out",
    donor_response_at: req.body?.timedOutAt || nowISO(),
  });
  return res.json({ success: true });
}));

// ─── POST /api/matches/:matchId/confirm-donation ─────────────────────────────
router.post("/api/matches/:matchId/confirm-donation", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Authentication required"));
  const match = await getLocalOrFirestoreDoc<Match>("matches", req.params.matchId);
  if (!match) return sendErrorResponse(res, new NotFoundError("Match not found"));
  const donor = await getLocalOrFirestoreDoc<User>("users", match.donor_id);
  if (!donor) return sendErrorResponse(res, new NotFoundError("Donor not found"));

  const isAdmin = (authUser as any).role === "admin" || authUser.id === "admin-id";
  if (!isAdmin && match.donor_id !== authUser.id) return sendErrorResponse(res, new ForbiddenError("Not authorized"));

  const confirmedAt  = req.body?.confirmedAt || nowISO();
  const donationDate = confirmedAt.split("T")[0];
  const cooldownEnd  = daysFromNow(90);

  await Promise.all([
    saveLocalOrFirestoreDoc("matches", req.params.matchId, {
      ...match,
      outcome: "donated",
      outcome_confirmed_at: confirmedAt,
    }),
    saveLocalOrFirestoreDoc("donation_log", `donation_${req.params.matchId}`, {
      id:            `donation_${req.params.matchId}`,
      donor_id:      donor.id,
      match_id:      match.id,
      request_id:    match.request_id,
      donation_date: donationDate,
      source:        "platform_match",
      notes:         "Confirmed via platform",
      created_at:    nowISO(),
    }),
    saveLocalOrFirestoreDoc("users", donor.id, {
      ...donor,
      cooldown_until: cooldownEnd,
      account_status: "cooldown",
      updated_at:     nowISO(),
    }),
  ]);

  await sendDonorWhatsApp(
    donor,
    buildDonorThankYouMessage(donor, match.request_id, cooldownEnd)
  );
  await sendDonorWhatsApp(
    donor,
    buildDonorReferralMessage(donor.full_name)
  );

  await cacheInvalidatePrefix("match_status_");
  await cacheInvalidatePrefix("pending_matches_");
  await cacheInvalidatePrefix("req_status_");
  await cacheInvalidatePrefix("eligible_");

  return res.json({ success: true });
}));

// ─── POST /api/matches/:matchId/donation-not-completed ───────────────────────
router.post("/api/matches/:matchId/donation-not-completed", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Authentication required"));
  const match = await getLocalOrFirestoreDoc<Match>("matches", req.params.matchId);
  if (!match) return sendErrorResponse(res, new NotFoundError("Match not found"));
  await saveLocalOrFirestoreDoc("matches", req.params.matchId, {
    ...match,
    outcome: "not_donated",
    outcome_confirmed_at: nowISO(),
  });
  await cacheInvalidatePrefix("match_status_");
  await cacheInvalidatePrefix("pending_matches_");
  return res.json({ success: true });
}));

// ─── POST /api/requests/:requestId/next-donor ────────────────────────────────
router.post("/api/requests/:requestId/next-donor", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Authentication required"));
  const request = await getLocalOrFirestoreDoc<BloodRequest>("blood_requests", req.params.requestId);
  if (!request) return sendErrorResponse(res, new NotFoundError("Request not found"));
  const result = await createNextDonorMatch(request, req.body?.declinedMatchId || req.body?.timedOutMatchId);
  return res.json({ success: !!result, match: result || null });
}));

export default router;
