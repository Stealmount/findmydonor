// Account Settings routes — Phase 4 (Rev 3 §12).
//
// Self-service account settings. All routes require a signed-in unified-auth
// user and operate on the current profile. Additive + reversible; no existing
// route is modified.
//
// Endpoints:
//   PATCH /profile/contact          add/update phone + whatsapp_phone (no OTP for first add; OTP for change)
//   POST /account/wa-verify         complete WhatsApp verification (purpose=verify)
//   POST /account/change-whatsapp   change WhatsApp number (new OTP ticket)
//   POST /account/change-email      change email (email OTP ticket)
//   POST /account/link-google       link a Google identity to this profile
//   POST /account/unlink-google     unlink the Google identity
//   POST /account/export            export my regulated data (JSON)
//   POST /account/logout            client-side session clear (no-op backend)
import express, { Router } from "express";
import { getAuthenticatedUser, getLinkedProfile, consumeOtpTicket, consumeEmailOtpTicket } from "../middleware/auth";
import { db, auth as firebaseAuth } from "../src/lib/firebase";
import { cacheInvalidatePrefix } from "../src/lib/redisCache";
import rateLimitMiddleware from "../middleware/rateLimiter";
import { validate } from "../validation/index";
import {
  whatsappVerifySchema,
  changeWhatsappSchema,
  changeEmailSchema,
  linkGoogleSchema,
} from "../validation/account";
import { normalizePhone, isValidIndianPhone } from "../helpers/phone";
import { nowISO } from "../helpers/time";
import { sendErrorResponse, UnauthorizedError, NotFoundError, ForbiddenError, ValidationError, AppError } from "../helpers/errors";


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

// ─── POST /api/account/wa-verify — WhatsApp number verification completion ──
router.post("/account/wa-verify", rateLimitMiddleware(10, 60_000), validate(whatsappVerifySchema), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const linked = await getLinkedProfile(authUser.id);
  if (!linked) return sendErrorResponse(res, new NotFoundError("Profile not found."));

  const { verificationToken, phone } = req.body;
  const normalized = normalizePhone(String(phone || ""));
  if (!isValidIndianPhone(normalized)) {
    return sendErrorResponse(res, new ValidationError("Enter a valid Indian WhatsApp number."));
  }

  const ok = await consumeOtpTicket(String(verificationToken), normalized, "verify");
  if (!ok) return sendErrorResponse(res, new ForbiddenError("WhatsApp verification expired. Request a new OTP."));

  await db.collection("profiles").doc(linked.profile.id).update({
    whatsapp_phone: normalized,
    whatsapp_verified: true,
    updated_at: nowISO(),
  });

  await cacheInvalidatePrefix(`me:${authUser.id}`);
  return res.json({ success: true, whatsapp_phone: normalized, whatsapp_verified: true });
}));

// ─── POST /api/account/change-whatsapp — change WhatsApp number ─────────────
router.post("/account/change-whatsapp", rateLimitMiddleware(5, 60_000), validate(changeWhatsappSchema), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const linked = await getLinkedProfile(authUser.id);
  if (!linked) return sendErrorResponse(res, new NotFoundError("Profile not found."));

  const { verificationToken, newPhone } = req.body;
  const normalized = normalizePhone(String(newPhone || ""));
  if (!isValidIndianPhone(normalized)) {
    return sendErrorResponse(res, new ValidationError("Enter a valid Indian WhatsApp number."));
  }

  const ok = await consumeOtpTicket(String(verificationToken), normalized, "verify");
  if (!ok) return sendErrorResponse(res, new ForbiddenError("WhatsApp verification expired. Request a new OTP for the new number."));

  await db.collection("profiles").doc(linked.profile.id).update({
    whatsapp_phone: normalized,
    whatsapp_verified: true,
    updated_at: nowISO(),
  });

  await cacheInvalidatePrefix(`me:${authUser.id}`);
  return res.json({ success: true, whatsapp_phone: normalized, whatsapp_verified: true });
}));

// ─── POST /api/account/change-email — change the profile email ──────────────
router.post("/account/change-email", rateLimitMiddleware(5, 60_000), validate(changeEmailSchema), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const linked = await getLinkedProfile(authUser.id);
  if (!linked) return sendErrorResponse(res, new NotFoundError("Profile not found."));

  const { verificationToken, newEmail } = req.body;
  const normalized = String(newEmail || "").toLowerCase().trim();

  const ok = await consumeEmailOtpTicket(String(verificationToken), normalized);
  if (!ok) return sendErrorResponse(res, new ForbiddenError("Email verification expired. Request a new OTP."));

  const existingSnap = await db.collection("profiles").where("email", "==", normalized).limit(1).get();
  const existing = existingSnap.empty ? null : existingSnap.docs[0];
  if (existing && existing.id !== linked.profile.id) {
    return sendErrorResponse(res, new AppError("This email is already in use by another account.", 409, "ACCOUNT_EXISTS"));
  }

  try {
    await firebaseAuth.updateUser(authUser.id, { email: normalized });
  } catch (err: any) {
    console.warn("[Account] auth email update note:", err?.message || err);
  }

  await db.collection("profiles").doc(linked.profile.id).update({
    email: normalized,
    updated_at: nowISO(),
  });

  await cacheInvalidatePrefix(`me:${authUser.id}`);
  return res.json({ success: true, email: normalized });
}));

// ─── POST /api/account/link-google — link a Google identity to this profile ─
router.post("/account/link-google", rateLimitMiddleware(5, 60_000), validate(linkGoogleSchema), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const linked = await getLinkedProfile(authUser.id);
  if (!linked) return sendErrorResponse(res, new NotFoundError("Profile not found."));

  const { email } = req.body;
  const googleEmail = String(email || "").toLowerCase().trim();

  const profileEmail = linked.profile.email ? String(linked.profile.email).toLowerCase().trim() : null;
  if (!profileEmail || profileEmail !== googleEmail) {
    return sendErrorResponse(res, new AppError("The Google account email does not match this profile. Linking requires a matching verified identity.", 409, "IDENTITY_MISMATCH"));
  }

  let googleAuthId: string | null = null;
  try {
    const listResult = await firebaseAuth.listUsers(1000);
    const googleUser = listResult.users.find(
      (u: any) => u.email === googleEmail && u.providerData?.some((p: any) => p.providerId === "google.com")
    );
    if (googleUser) googleAuthId = googleUser.uid;
  } catch (err: any) {
    console.warn("[Account] google identity lookup note:", err?.message || err);
  }

  if (!googleAuthId) {
    return sendErrorResponse(res, new ValidationError("Could not find a matching Google identity. Please sign in with Google first, then retry."));
  }

  try {
    await db.collection("auth_profile_links").doc(googleAuthId).set({
      auth_user_id: googleAuthId,
      profile_id: linked.profile.id,
      provider: "google",
    }, { merge: true });
  } catch { /* duplicate link ignored */ }

  await cacheInvalidatePrefix(`me:${authUser.id}`);
  return res.json({ success: true, linked: true, provider: "google" });
}));

// ─── POST /api/account/unlink-google — detach the Google identity ───────────
router.post("/account/unlink-google", rateLimitMiddleware(5, 60_000), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const linked = await getLinkedProfile(authUser.id);
  if (!linked) return sendErrorResponse(res, new NotFoundError("Profile not found."));

  const linksSnap = await db.collection("auth_profile_links")
    .where("profile_id", "==", linked.profile.id).get();
  const count = linksSnap.size;

  if (count <= 1) {
    return sendErrorResponse(res, new AppError("At least one sign-in method must remain linked to your account.", 409, "LAST_AUTH_PROVIDER"));
  }

  const googleLink = linksSnap.docs.find(d => d.data().provider === "google");
  if (googleLink) {
    await googleLink.ref.delete();
  }

  await cacheInvalidatePrefix(`me:${authUser.id}`);
  return res.json({ success: true, linked: false });
}));

// ─── GET /api/account/export — export my data (JSON) ───────────────────────────
router.get("/account/export", rateLimitMiddleware(10, 60_000), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const linked = await getLinkedProfile(authUser.id);
  if (!linked) return sendErrorResponse(res, new NotFoundError("Profile not found."));

  try {
    const dpSnap = await db.collection("donor_profiles").where("profile_id", "==", linked.profile.id).limit(1).get();
    const donorProfile = dpSnap.empty ? null : { id: dpSnap.docs[0].id, ...dpSnap.docs[0].data() };

    const linksSnap = await db.collection("institution_profile_links").where("profile_id", "==", linked.profile.id).get();
    const links = linksSnap.docs.map(d => d.data());

    const profileCopy = { ...linked.profile };
    delete (profileCopy as Record<string, unknown>).id;

    return res.json({
      requested_at: nowISO(),
      profile: profileCopy,
      donorProfile,
      institutionLinks: links?.map((l) => l.institution_id) || [],
    });
  } catch (error) {
    return sendErrorResponse(res, error, "Failed to export your data.");
  }
}));

// ─── POST /api/account/logout — frontend-initiated session clear ──────────────
router.post("/account/logout", rateLimitMiddleware(30, 60_000), wrap(async (_req, res) => {
  return res.json({ success: true, logged_out: true });
}));

// ─── PATCH /api/profile/contact — add/update phone + WhatsApp number ──────────
router.patch("/profile/contact", rateLimitMiddleware(20, 60_000), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const linked = await getLinkedProfile(authUser.id);
  if (!linked) return sendErrorResponse(res, new NotFoundError("Profile not found."));

  const rawPhone = req.body?.phone !== undefined ? String(req.body.phone || "").trim() : undefined;
  const rawWaPhone = req.body?.whatsappPhone !== undefined ? String(req.body.whatsappPhone || "").trim() : undefined;
  const verificationToken = req.body?.verificationToken ? String(req.body.verificationToken).trim() : undefined;

  if (rawPhone === undefined && rawWaPhone === undefined) {
    return sendErrorResponse(res, new ValidationError("Provide at least one of phone or whatsappPhone."));
  }

  const patch: Record<string, unknown> = { updated_at: nowISO() };

  if (rawPhone !== undefined) {
    if (rawPhone === "") {
      patch.phone = null;
    } else {
      const normalized = normalizePhone(rawPhone);
      if (!isValidIndianPhone(normalized)) {
        return sendErrorResponse(res, new ValidationError("Enter a valid Indian mobile number (10 digits, starting with 6-9)."));
      }
      const existingPhone = linked.profile.phone ? normalizePhone(linked.profile.phone) : null;
      if (existingPhone && existingPhone !== normalized) {
        if (!verificationToken) {
          return sendErrorResponse(res, new ForbiddenError("OTP verification token required to change existing phone number."));
        }
        let ok = await consumeOtpTicket(verificationToken, normalized, "verify");
        if (!ok) ok = await consumeOtpTicket(verificationToken, normalized, "signup");
        if (!ok) ok = await consumeOtpTicket(verificationToken, normalized, "sos");
        if (!ok) {
          return sendErrorResponse(res, new ForbiddenError("Phone OTP verification expired or invalid. Request a new OTP."));
        }
      }
      patch.phone = normalized;
    }
  }

  if (rawWaPhone !== undefined) {
    if (rawWaPhone === "") {
      patch.whatsapp_phone = null;
      patch.whatsapp_verified = false;
    } else {
      const normalized = normalizePhone(rawWaPhone);
      if (!isValidIndianPhone(normalized)) {
        return sendErrorResponse(res, new ValidationError("Enter a valid Indian WhatsApp number (10 digits, starting with 6-9)."));
      }
      const existingWaPhone = linked.profile.whatsapp_phone ? normalizePhone(linked.profile.whatsapp_phone) : null;
      if (existingWaPhone && existingWaPhone !== normalized) {
        if (!verificationToken) {
          return sendErrorResponse(res, new ForbiddenError("OTP verification token required to change existing WhatsApp number."));
        }
        let ok = await consumeOtpTicket(verificationToken, normalized, "verify");
        if (!ok) ok = await consumeOtpTicket(verificationToken, normalized, "signup");
        if (!ok) ok = await consumeOtpTicket(verificationToken, normalized, "sos");
        if (!ok) {
          return sendErrorResponse(res, new ForbiddenError("WhatsApp OTP verification expired or invalid. Request a new OTP."));
        }
        patch.whatsapp_verified = true;
      }
      patch.whatsapp_phone = normalized;
    }
  }

  await db.collection("profiles").doc(linked.profile.id).update(patch);

  await cacheInvalidatePrefix(`me:${authUser.id}`);
  return res.json({
    success: true,
    phone: patch.phone !== undefined ? patch.phone : (linked.profile.phone ?? null),
    whatsapp_phone: patch.whatsapp_phone !== undefined ? patch.whatsapp_phone : (linked.profile.whatsapp_phone ?? null),
  });
}));

export default router;
