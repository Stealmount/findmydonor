// Notification routes — extracted from server.ts (Phase 3 decomposition, 3.6.7)
// Owns: legacy send-email utility, WAHA WhatsApp webhook, notifications CRUD
import express, { Router } from "express";
import {
  getCollection as getLocalOrFirestoreCollection,
  getDoc as getLocalOrFirestoreDoc,
  saveDoc as saveLocalOrFirestoreDoc,
} from "../src/lib/serverDb";
import { db } from "../src/lib/firebase";
import { cacheInvalidatePrefix } from "../src/lib/redisCache";
import { getAuthenticatedUser } from "../middleware/auth";
import rateLimitMiddleware from "../middleware/rateLimiter";
import { normalizePhone } from "../helpers/phone";
import { nowISO } from "../helpers/time";
import { escapeHtml } from "../helpers/html";
import {
  sendWhatsApp,
  sendDonorWhatsApp,
  buildDonorConfirmedDetailsMessage,
  buildRequesterConfirmMessage,
  buildDonorDeclineAckMessage,
} from "../src/lib/waha";
import { buildRequesterConfirmEmailHTML } from "../src/lib/email";
import { sendEmailViaResend } from "../services/notificationService";
import { createNextDonorMatch } from "../services/matchingEngine";
import { sendErrorResponse, UnauthorizedError, ValidationError, ForbiddenError, ServiceUnavailableError } from "../helpers/errors";
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

// ─── POST /api/send-email — legacy client notification utility ───────────────
router.post("/api/send-email", rateLimitMiddleware(10, 60_000), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser?.email) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));

  const { to, subject, text } = req.body || {};
  if (typeof to !== "string" || typeof subject !== "string" || typeof text !== "string") {
    return sendErrorResponse(res, new ValidationError("Missing: to, subject, text"));
  }
  const recipient = to.toLowerCase().trim();
  let recipientAllowed = recipient === "admin@raktdaan.org" || recipient === authUser.email.toLowerCase();
  if (!recipientAllowed) {
    const profileSnap = await db.collection("profiles").where("email", "==", recipient).limit(1).get();
    recipientAllowed = !profileSnap.empty;
  }
  if (!recipientAllowed) {
    return sendErrorResponse(res, new ForbiddenError("Email recipient is not registered."));
  }
  if (subject.length > 200 || text.length > 10_000) {
    return sendErrorResponse(res, new ValidationError("Email content is too long."));
  }

  const ok = await sendEmailViaResend(recipient, subject, `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`, text);
  if (!ok) return sendErrorResponse(res, new ServiceUnavailableError("Failed to send email message."));
  return res.json({ success: true, emailSent: true });
}));

// ─── POST /api/waha/webhook — donor YES/NO WhatsApp replies ──────────────────
router.post("/api/waha/webhook", wrap(async (req, res) => {
  res.status(200).send("OK"); // Ack immediately

  try {
    const event = req.body;
    if (!event || event.event !== "message") return;

    const from: string = event.payload?.from || "";
    const rawBody: string = (event.payload?.body || "").trim();
    const selectedId: string = (event.payload?.selectedButtonId || event.payload?.id || rawBody).trim();
    const upperBody: string = rawBody.toUpperCase();
    const phone = from.replace("@c.us", "").replace(/\D/g, "");

    const isYes = selectedId.includes("ACCEPT_") || upperBody === "YES" || upperBody.includes("CAN DONATE") || upperBody.includes("ACCEPT") || upperBody.includes("YES");
    const isNo  = selectedId.includes("DECLINE_") || upperBody === "NO" || upperBody.includes("NOT AVAILABLE") || upperBody.includes("DECLINE") || upperBody.includes("NO");

    if (!isYes && !isNo) return;

    const body = isYes ? "YES" : "NO";
    console.log(`[WAHA Webhook] Reply/Button from ${phone}: ${body} (raw: "${rawBody}", buttonId: "${selectedId}")`);

    let specificMatchId: string | null = null;
    if (selectedId.includes("ACCEPT_")) {
      specificMatchId = selectedId.split("ACCEPT_")[1]?.trim() || null;
    } else if (selectedId.includes("DECLINE_")) {
      specificMatchId = selectedId.split("DECLINE_")[1]?.trim() || null;
    }

    // Find donor by phone
    const allDonors = await getLocalOrFirestoreCollection<User>("users");
    const donor = allDonors.find(
      (d) =>
        normalizePhone(d.whatsapp_number || "") === phone ||
        normalizePhone(d.phone) === phone
    );
    if (!donor) return;

    // Find their pending match (prefer specific match ID from button payload)
    const allMatches = await getLocalOrFirestoreCollection<Match>("matches");
    const pendingMatch = specificMatchId
      ? (allMatches.find((m) => m.id === specificMatchId && m.donor_response === "pending") ||
         allMatches.find((m) => m.donor_id === donor.id && m.donor_response === "pending"))
      : allMatches.find((m) => m.donor_id === donor.id && m.donor_response === "pending");

    if (!pendingMatch) return;

    const request = await getLocalOrFirestoreDoc<BloodRequest>(
      "blood_requests",
      pendingMatch.request_id
    );
    if (!request) return;

    if (body === "YES") {
      // Guard: Check if request is already fulfilled or closed
      if (request.status && request.status !== "open") {
        await saveLocalOrFirestoreDoc("matches", pendingMatch.id, {
          ...pendingMatch,
          donor_response: "declined",
          donor_response_at: nowISO(),
          outcome: "request_closed"
        });
        await sendDonorWhatsApp(
          donor,
          "Thank you for responding! This emergency blood request has already been closed or fulfilled."
        );
        return;
      }

      // Guard: Check if approved matches already fulfill units_required
      const approvedMatches = allMatches.filter(
        (m) => m.request_id === pendingMatch.request_id && m.donor_response === "approved"
      );
      const unitsRequired = request.units_required || 1;
      if (approvedMatches.length >= unitsRequired) {
        await saveLocalOrFirestoreDoc("matches", pendingMatch.id, {
          ...pendingMatch,
          donor_response: "declined",
          donor_response_at: nowISO(),
          outcome: "fulfilled_by_other"
        });
        await sendDonorWhatsApp(
          donor,
          "Thank you for responding! The required units for this emergency request have just been fulfilled by another donor nearby. We deeply appreciate your readiness to save lives!"
        );
        return;
      }

      // Approve match
      await saveLocalOrFirestoreDoc("matches", pendingMatch.id, {
        ...pendingMatch,
        donor_response:    "approved",
        donor_response_at: nowISO(),
        contact_shared_at: nowISO(),
      });

      // If this approval reaches required units, mark request fulfilled
      if (approvedMatches.length + 1 >= unitsRequired) {
        await saveLocalOrFirestoreDoc("blood_requests", request.id, {
          ...request,
          status: "fulfilled",
          fulfilled_at: nowISO(),
          updated_at: nowISO()
        });
      }

      // Notify donor confirmation with full requester details
      await sendDonorWhatsApp(
        donor,
        buildDonorConfirmedDetailsMessage(request, donor)
      );

      // Notify requester
      if (request.requester_phone) {
        const confirmMsg = buildRequesterConfirmMessage(request, donor.full_name);
        await sendWhatsApp(request.requester_phone, confirmMsg);
      }

      // Send confirmation email to requester
      if (request.requester_email) {
        const emailPayload = buildRequesterConfirmEmailHTML({
          requesterName: request.requester_name,
          donorName:     donor.full_name,
          bloodType:     request.blood_type_needed,
          trackingCode:  request.tracking_code,
          hospitalName:  request.hospital_name,
        });
        await sendEmailViaResend(
          request.requester_email,
          emailPayload.subject,
          emailPayload.html,
          emailPayload.text
        );
      }

      await cacheInvalidatePrefix("pending_matches_");
      await cacheInvalidatePrefix("req_status_");
      await cacheInvalidatePrefix("match_status_");

    } else {
      // Decline match
      await saveLocalOrFirestoreDoc("matches", pendingMatch.id, {
        ...pendingMatch,
        donor_response:    "declined",
        donor_response_at: nowISO(),
      });

      await sendDonorWhatsApp(
        donor,
        buildDonorDeclineAckMessage()
      );

      // Auto-find next donor
      await createNextDonorMatch(request, pendingMatch.id);

      await cacheInvalidatePrefix("pending_matches_");
      await cacheInvalidatePrefix("req_status_");
    }
  } catch (err: any) {
    console.error("[WAHA Webhook] Error:", err?.message);
  }
}));

// ─── POST /api/notifications — legacy upsert ─────────────────────────────────
router.post("/api/notifications", wrap(async (req, res) => {
  if (req.body?.id) await saveLocalOrFirestoreDoc("notifications", req.body.id, { ...req.body, created_at: nowISO() });
  return res.json({ success: true });
}));

// ─── DELETE /api/notifications/:notifId ──────────────────────────────────────
// ponytail: was completely unauthenticated — anyone could wipe all notifications.
// Now requires signed-in user; "all" is scoped to that user.
router.delete("/api/notifications/:notifId", wrap(async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return sendErrorResponse(res, new UnauthorizedError("Sign in to manage notifications."));
  const userId = user.id;
  try {
    if (req.params.notifId === "all") {
      const snap = await db.collection("notifications").where("user_id", "==", userId).get();
      const batch = db.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } else {
      const docSnap = await db.collection("notifications").doc(req.params.notifId).get();
      if (docSnap.exists && docSnap.data()?.user_id === userId) {
        await docSnap.ref.delete();
      }
    }
  } catch { /* ignore fallback */ }
  return res.json({ success: true });
}));

export default router;
