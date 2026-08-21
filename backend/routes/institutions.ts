// Institution routes — Phase 4 (Rev 3 §11).
//
// Institutional accounts follow the SAME unified auth as donor/requester:
//   auth.users → auth_profile_links → profiles → institution_profile_links → institutions
// No parallel auth system. Every institution starts at verification_status
// 'pending' and requires explicit admin approval — there is NO auto-active path
// for institutions (enforced in the DB schema and here).
import express, { Router } from "express";
import { getAuthenticatedUser, getLinkedProfile } from "../middleware/auth";
import { db } from "../src/lib/firebase";
import { cacheInvalidatePrefix } from "../src/lib/redisCache";
import rateLimitMiddleware from "../middleware/rateLimiter";
import { validate } from "../validation/index";
import { institutionRegisterSchema } from "../validation/account";
import { normalizePhone, isValidIndianPhone } from "../helpers/phone";
import { nowISO } from "../helpers/time";
import { sendErrorResponse, UnauthorizedError, NotFoundError, ValidationError, AppError } from "../helpers/errors";


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

// Require a Rev 3 unified-auth profile (email/Google), same guard as onboarding.
function isRev3Profile(p: any): boolean {
  return !!p && (p.auth_method === "google" || p.auth_method === "email");
}

// ─── GET /api/institutions/me — my institution(s) + verification status ──────
router.get("/institutions/me", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const linked = await getLinkedProfile(authUser.id);
  if (!linked) return sendErrorResponse(res, new NotFoundError("Profile not found."));

  try {
    const linksSnap = await db.collection("institution_profile_links")
      .where("profile_id", "==", linked.profile.id).get();

    const institutions: unknown[] = [];
    for (const linkDoc of linksSnap.docs) {
      const link = linkDoc.data();
      const instSnap = await db.collection("institutions").doc(link.institution_id).get();
      if (instSnap.exists) {
        institutions.push({ id: instSnap.id, ...instSnap.data(), role: link.role });
      }
    }

    return res.json({ institutions, count: institutions.length });
  } catch (error) {
    return sendErrorResponse(res, error, "Failed to load your institution.");
  }
}));

// ─── POST /api/institutions/register — submit institution for approval ───────
router.post(
  "/institutions/register",
  rateLimitMiddleware(5, 60_000),
  validate(institutionRegisterSchema),
  wrap(async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
    const linked = await getLinkedProfile(authUser.id);
    if (!linked) return sendErrorResponse(res, new NotFoundError("Profile not found."));
    if (!isRev3Profile(linked.profile)) {
      return sendErrorResponse(res, new AppError("Institution registration is not available for legacy profiles.", 409, "LEGACY_PROFILE"));
    }

    const body = req.body;
    const normalizedPhone = normalizePhone(String(body.phone || ""));
    if (!isValidIndianPhone(normalizedPhone)) {
      return sendErrorResponse(res, new ValidationError("Enter a valid Indian phone number (e.g. 91XXXXXXXXXX)."));
    }

    const normalizedEmail = String(body.email || "").toLowerCase().trim();
    const profileId = linked.profile.id;

    const existingSnap = await db.collection("institutions").where("phone", "==", normalizedPhone).limit(1).get();
    const existingDoc = existingSnap.empty ? null : existingSnap.docs[0];

    let institution: any;
    if (existingDoc) {
      const updateData = {
        type: body.type,
        org_name: body.orgName,
        registration_number: body.registrationNumber,
        contact_person: body.contactPerson,
        email: normalizedEmail,
        address: body.address || null,
        city: body.city,
        pincode: body.pincode,
        verification_status: "pending",
        rejection_reason: null,
        updated_at: nowISO(),
      };
      await existingDoc.ref.update(updateData);
      institution = { id: existingDoc.id, ...existingDoc.data(), ...updateData };
    } else {
      const createData = {
        type: body.type,
        org_name: body.orgName,
        registration_number: body.registrationNumber,
        contact_person: body.contactPerson,
        phone: normalizedPhone,
        email: normalizedEmail,
        address: body.address || null,
        city: body.city,
        pincode: body.pincode,
        verification_status: "pending",
      };
      const createdRef = await db.collection("institutions").add(createData);
      institution = { id: createdRef.id, ...createData };
    }

    await db.collection("institution_profile_links").doc(profileId).set({
      profile_id: profileId,
      institution_id: institution.id,
      role: "admin",
    }, { merge: true });

    await cacheInvalidatePrefix(`me:${authUser.id}`);

    return res.status(201).json({
      success: true,
      institution: {
        id: institution.id,
        type: institution.type,
        org_name: institution.org_name,
        verification_status: "pending",
      },
      message: "Registration submitted. An administrator will review and verify your institution.",
    });
  })
);

export default router;
