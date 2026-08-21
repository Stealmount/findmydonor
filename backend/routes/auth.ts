// Auth routes — Firebase Auth + Firestore rewrite
import express, { Router } from "express";
import { db } from "../src/lib/firebase";

import { normalizePhone, isValidIndianPhone } from "../helpers/phone";
import { nowISO } from "../helpers/time";
import {
  getAuthenticatedUser,
  getLinkedProfile,
  nextOnboardingStep,
  createAuthUserAndProfile,
} from "../middleware/auth";
import rateLimitMiddleware from "../middleware/rateLimiter";
import { validate } from "../validation";
import { completeVerificationSchema } from "../validation/auth";
import { sendErrorResponse, UnauthorizedError, DatabaseError } from "../helpers/errors";

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

// ─── Me — current authenticated user profile ─────────────────────────────
router.get("/auth/me", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  try {
    const linked = await getLinkedProfile(authUser.id);
    const profile = (linked?.profile || null) as (Record<string, unknown> & { id?: string }) | null;
    let institution: unknown = null;
    if (profile?.id) {
      try {
        const iplSnap = await db.collection("institution_profile_links").where("profile_id", "==", profile.id).limit(1).get();
        const iplDoc = iplSnap.docs[0];
        if (iplDoc) {
          const institutionId = iplDoc.data().institution_id;
          if (institutionId) {
            const instSnap = await db.collection("institutions").doc(institutionId).get();
            institution = instSnap.exists ? instSnap.data() : null;
          }
        }
      } catch (error) {
        console.warn("[Auth] Institution enrichment unavailable (institution=null):", error);
      }
    }
    return res.json({
      authUser: { id: authUser.id, email: authUser.email || null, provider: authUser.app_metadata?.provider || null },
      profile,
      donorProfile: linked?.donorProfile || null,
      institution,
      nextStep: nextOnboardingStep(linked),
    });
  } catch (error) {
    return sendErrorResponse(res, error, "Profile service is temporarily unavailable.", 503, "SERVICE_UNAVAILABLE");
  }
}));

// ─── Complete verification (Google OAuth users — NO OTP, NO password) ───────
router.post("/auth/complete-verification", rateLimitMiddleware(10, 60_000), validate(completeVerificationSchema), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const googleEmail = (req.body?.email || authUser.email || "").toString().toLowerCase().trim();
  const googleName = String(req.body?.fullName || authUser.user_metadata?.full_name || "").trim();

  try {
    let existing: any = null;
    if (googleEmail) {
      const existingSnap = await db.collection("profiles").where("email", "==", googleEmail).limit(1).get();
      const existingDoc = existingSnap.docs[0];
      if (existingDoc) existing = { id: existingDoc.id, ...existingDoc.data() };
    }

    // Always ensure profile document exists under authUser.id
    let profileSnap = await db.collection("profiles").doc(authUser.id).get();
    let profileData: any = profileSnap.exists ? { id: profileSnap.id, ...profileSnap.data() } : null;

    if (!profileData) {
      profileData = existing ? { ...existing, id: authUser.id, updated_at: nowISO() } : {
        id: authUser.id,
        full_name: googleName || "User",
        email: googleEmail,
        can_donate: true,
        can_request: true,
        created_at: nowISO(),
        updated_at: nowISO(),
        auth_method: "google",
      };
      await db.collection("profiles").doc(authUser.id).set(profileData, { merge: true });
    }

    if (existing && existing.id !== authUser.id) {
      try {
        await db.collection("auth_profile_links").doc(authUser.id).set({
          auth_user_id: authUser.id,
          profile_id: existing.id,
          provider: "google",
        }, { merge: true });
      } catch { /* ignore */ }
    }

    const phone = req.body?.phone;
    const normalized = phone ? normalizePhone(String(phone)) : null;
    const patch: Record<string, unknown> = { updated_at: nowISO() };
    if (normalized && isValidIndianPhone(normalized)) {
      patch.phone = normalized;
      patch.whatsapp_phone = req.body?.whatsappPhone ? normalizePhone(String(req.body.whatsappPhone)) : normalized;
      patch.is_whatsapp = patch.whatsapp_phone === normalized;
      patch.whatsapp_verified = true;
    }
    const intent = req.body?.intent;
    if (intent) {
      patch.intent = intent;
      patch.can_donate = intent === "donor" || intent === "both";
      patch.can_request = intent === "requester" || intent === "both";
      if (patch.can_donate) {
        try { await db.collection("donor_profiles").doc(authUser.id).set({ profile_id: authUser.id }, { merge: true }); } catch { /* ignore */ }
        try {
          await db.collection("users").doc(authUser.id).set({
            id: authUser.id,
            full_name: profileData.full_name || googleName || "Donor",
            email: profileData.email || googleEmail || "",
            phone: profileData.phone || normalized || null,
            whatsapp_number: profileData.whatsapp_phone || normalized || null,
            blood_type: "ANY",
            availability_status: "available",
            account_status: "active",
            created_at: nowISO(),
          }, { merge: true });
        } catch { /* ignore */ }
      }
    }

    if (Object.keys(patch).length > 1) {
      try {
        await db.collection("profiles").doc(authUser.id).update(patch);
      } catch { /* non-blocking */ }
    }

    const linked = await getLinkedProfile(authUser.id);
    return res.status(201).json({
      profile: linked?.profile || profileData,
      donorProfile: linked?.donorProfile || null,
      isNewUser: !existing,
      nextStep: linked ? nextOnboardingStep(linked) : "basic",
    });
  } catch (error) {
    return sendErrorResponse(res, error, "Unable to complete your profile. Try again.");
  }
}));

export default router;
