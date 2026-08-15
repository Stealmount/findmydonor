// Institution routes — Phase 4 (Rev 3 §11).
//
// Institutional accounts follow the SAME unified auth as donor/requester:
//   auth.users → auth_profile_links → profiles → institution_profile_links → institutions
// No parallel auth system. Every institution starts at verification_status
// 'pending' and requires explicit admin approval — there is NO auto-active path
// for institutions (enforced in the DB schema and here).
import express, { Router } from "express";
import { getAuthenticatedUser, getLinkedProfile } from "../middleware/auth";
import { getServerSupabase } from "../src/lib/serverDb";
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
    const supabase = getServerSupabase();
    const { data: links } = await supabase
      .from("institution_profile_links")
      .select("institution_id, role")
      .eq("profile_id", linked.profile.id);

    const institutions: unknown[] = [];
    for (const link of links || []) {
      const { data: inst } = await supabase
        .from("institutions")
        .select("*")
        .eq("id", link.institution_id)
        .maybeSingle();
      if (inst) institutions.push({ ...inst, role: link.role });
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

    const supabase = getServerSupabase();
    const normalizedEmail = String(body.email || "").toLowerCase().trim();
    const profileId = linked.profile.id;

    const { data: existing } = await supabase
      .from("institutions")
      .select("*")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    let institution = existing;
    if (existing) {
      const { data: updated, error: updateErr } = await supabase
        .from("institutions")
        .update({
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
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (updateErr || !updated) return sendErrorResponse(res, updateErr, "Failed to update your institution registration.");
      institution = updated;
    } else {
      const { data: created, error: createErr } = await supabase
        .from("institutions")
        .insert({
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
        })
        .select()
        .single();
      if (createErr || !created) return sendErrorResponse(res, createErr, "Failed to create your institution registration.");
      institution = created;
    }

    await supabase
      .from("institution_profile_links")
      .upsert({ profile_id: profileId, institution_id: institution.id, role: "admin" }, { onConflict: "profile_id" });

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
