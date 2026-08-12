// Account Settings routes — Phase 4 (Rev 3 §12).
//
// Self-service account settings. All routes require a signed-in unified-auth
// user and operate on the current profile. Additive + reversible; no existing
// route is modified.
//
// Endpoints:
//   POST /account/wa-verify        complete WhatsApp verification (purpose=verify)
//   POST /account/change-whatsapp  change WhatsApp number (new OTP ticket)
//   POST /account/change-email     change email (email OTP ticket)
//   POST /account/link-google      link a Google identity to this profile
//   POST /account/unlink-google    unlink the Google identity
//   POST /account/export           export my regulated data (JSON)
//   POST /account/logout           client-side session clear (no-op backend)
import express, { Router } from "express";
import { getAuthenticatedUser, getLinkedProfile, consumeOtpTicket, consumeEmailOtpTicket } from "../middleware/auth";
import { getServerSupabase } from "../src/lib/serverDb";
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
// Consumes the Phase 3 `verify` WhatsApp OTP ticket and marks the current
// WhatsApp number as verified. Changing a number resets it; this confirms it.
router.post("/account/wa-verify", rateLimitMiddleware(10, 60_000), validate(whatsappVerifySchema), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return res.status(401).json({ error: "Sign in is required." });
  const linked = await getLinkedProfile(authUser.id);
  if (!linked) return res.status(404).json({ error: "Profile not found." });

  const { verificationToken, phone } = req.body;
  const normalized = normalizePhone(String(phone || ""));
  if (!isValidIndianPhone(normalized)) {
    return res.status(400).json({ error: "Enter a valid Indian WhatsApp number." });
  }

  const ok = await consumeOtpTicket(String(verificationToken), normalized, "verify");
  if (!ok) return res.status(403).json({ error: "WhatsApp verification expired. Request a new OTP." });

  const supabase = getServerSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({ whatsapp_phone: normalized, whatsapp_verified: true, updated_at: nowISO() })
    .eq("id", linked.profile.id);
  if (error) return res.status(500).json({ error: "Failed to verify your WhatsApp number." });

  await cacheInvalidatePrefix(`me:${authUser.id}`);
  return res.json({ success: true, whatsapp_phone: normalized, whatsapp_verified: true });
}));

// ─── POST /api/account/change-whatsapp — change WhatsApp number ─────────────
// Requires a NEW `verify` OTP for the new number, then binds it. The old number
// is kept on profiles.phone (unchanged); only whatsapp_phone is updated.
router.post("/account/change-whatsapp", rateLimitMiddleware(5, 60_000), validate(changeWhatsappSchema), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return res.status(401).json({ error: "Sign in is required." });
  const linked = await getLinkedProfile(authUser.id);
  if (!linked) return res.status(404).json({ error: "Profile not found." });

  const { verificationToken, newPhone } = req.body;
  const normalized = normalizePhone(String(newPhone || ""));
  if (!isValidIndianPhone(normalized)) {
    return res.status(400).json({ error: "Enter a valid Indian WhatsApp number." });
  }

  // Rule: changing the number requires proving ownership of the NEW number.
  const ok = await consumeOtpTicket(String(verificationToken), normalized, "verify");
  if (!ok) return res.status(403).json({ error: "WhatsApp verification expired. Request a new OTP for the new number." });

  const supabase = getServerSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({ whatsapp_phone: normalized, whatsapp_verified: true, updated_at: nowISO() })
    .eq("id", linked.profile.id);
  if (error) return res.status(500).json({ error: "Failed to update your WhatsApp number." });

  await cacheInvalidatePrefix(`me:${authUser.id}`);
  return res.json({ success: true, whatsapp_phone: normalized, whatsapp_verified: true });
}));

// ─── POST /api/account/change-email — change the profile email ──────────────
// Requires an email OTP ticket for the new address (issued via email/verify-otp).
// Updates profiles.email after proving ownership of the new inbox.
router.post("/account/change-email", rateLimitMiddleware(5, 60_000), validate(changeEmailSchema), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return res.status(401).json({ error: "Sign in is required." });
  const linked = await getLinkedProfile(authUser.id);
  if (!linked) return res.status(404).json({ error: "Profile not found." });

  const { verificationToken, newEmail } = req.body;
  const normalized = String(newEmail || "").toLowerCase().trim();

  // The email/verify-otp flow issues a 'signup' ticket; reuse it to prove the
  // new inbox is owned. Additive purpose reuse is safe here (single-consumption).
  const ok = await consumeEmailOtpTicket(String(verificationToken), normalized);
  if (!ok) return res.status(403).json({ error: "Email verification expired. Request a new OTP." });

  // Duplicate-prevention: never link to a profile already using this email.
  const supabase = getServerSupabase();
  const { data: existing } = await supabase
    .from("profiles").select("id").eq("email", normalized).maybeSingle();
  if (existing && existing.id !== linked.profile.id) {
    return res.status(409).json({ error: "This email is already in use by another account." });
  }

  // Update the auth identity email (keeps sign-in working) + the profile.
  try {
    await supabase.auth.admin.updateUserById(authUser.id, { email: normalized });
  } catch (err: any) {
    console.warn("[Account] auth email update note:", err?.message || err);
  }
  const { error } = await supabase
    .from("profiles")
    .update({ email: normalized, updated_at: nowISO() })
    .eq("id", linked.profile.id);
  if (error) return res.status(500).json({ error: "Failed to update your email." });

  await cacheInvalidatePrefix(`me:${authUser.id}`);
  return res.json({ success: true, email: normalized });
}));

// ─── POST /api/account/link-google — link a Google identity to this profile ─
// Requirements: the current profile is email-based; the Google email must match
// the profile email (auto-link) — otherwise it is rejected here, because the
// frozen architecture forbids auto-merge of different-email identities without
// the user later linking them from Account Settings. The client passes the
// Google identity it just authenticated; the server records the link.
router.post("/account/link-google", rateLimitMiddleware(5, 60_000), validate(linkGoogleSchema), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return res.status(401).json({ error: "Sign in is required." });
  const linked = await getLinkedProfile(authUser.id);
  if (!linked) return res.status(404).json({ error: "Profile not found." });

  const { email } = req.body;
  const googleEmail = String(email || "").toLowerCase().trim();

  // Account linking rule: only link when Google email already equals the profile
  // email. Different email = separate identity → reject (no auto-merge).
  const profileEmail = linked.profile.email ? String(linked.profile.email).toLowerCase().trim() : null;
  if (!profileEmail || profileEmail !== googleEmail) {
    return res.status(409).json({ error: "The Google account email does not match this profile. Linking requires a matching verified identity." });
  }

  // Look for the existing Google auth identity by email; if present, link it.
  const supabase = getServerSupabase();
  let googleAuthId: string | null = null;
  try {
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const googleUser = (users as any[])?.find((u: any) => u.email === googleEmail && u.app_metadata?.provider === "google");
    if (googleUser) googleAuthId = googleUser.id;
  } catch (err: any) {
    console.warn("[Account] google identity lookup note:", err?.message || err);
  }

  if (!googleAuthId) {
    // No pre-existing Google identity — client must supply the OAuth session.
    // We cannot mint a Google auth user without the upstream OAuth token here.
    return res.status(400).json({ error: "Could not find a matching Google identity. Please sign in with Google first, then retry." });
  }

  try {
    await supabase.from("auth_profile_links").upsert({
      auth_user_id: googleAuthId,
      profile_id: linked.profile.id,
      provider: "google",
    }, { onConflict: "auth_user_id" });
  } catch { /* duplicate link ignored */ }

  await cacheInvalidatePrefix(`me:${authUser.id}`);
  return res.json({ success: true, linked: true, provider: "google" });
}));

// ─── POST /api/account/unlink-google — detach the Google identity ───────────
// Removes the auth_profile_links row whose provider is 'google' and points at
// this profile. Safe: only affects the link, never deletes data. The Google
// auth identity itself is left intact for Supabase.
//
// Production-safety guard (user-mandated): never remove the LAST linked auth
// provider — doing so locks the user out of their account. Count first, reject
// with 409 when this would be the final sign-in method.
router.post("/account/unlink-google", rateLimitMiddleware(5, 60_000), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return res.status(401).json({ error: "Sign in is required." });
  const linked = await getLinkedProfile(authUser.id);
  if (!linked) return res.status(404).json({ error: "Profile not found." });

  const supabase = getServerSupabase();

  // 1. Count all auth providers currently linked to this profile.
  const { count, error: countError } = await supabase
    .from("auth_profile_links")
    .select("auth_user_id", { count: "exact", head: true })
    .eq("profile_id", linked.profile.id);
  if (countError) return res.status(500).json({ error: "Failed to verify your linked sign-in methods." });

  // 2. This is the last provider → reject (would lock the user out).
  if ((count ?? 0) <= 1) {
    return res.status(409).json({
      success: false,
      code: "LAST_AUTH_PROVIDER",
      message: "At least one sign-in method must remain linked to your account.",
    });
  }

  // 3. Other providers remain → continue unlink normally.
  const { error } = await supabase
    .from("auth_profile_links")
    .delete()
    .eq("profile_id", linked.profile.id)
    .eq("provider", "google");
  if (error) return res.status(500).json({ error: "Failed to unlink Google." });

  await cacheInvalidatePrefix(`me:${authUser.id}`);
  return res.json({ success: true, linked: false });
}));

// ─── GET /api/account/export — export my data (JSON) ───────────────────────────
// Returns a GDPR-style snapshot of everything owned by this profile. Approved
// scope in Phase 4; profile + donor + institution are all included. No PII is
// logged by the server.
router.get("/account/export", rateLimitMiddleware(10, 60_000), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return res.status(401).json({ error: "Sign in is required." });
  const linked = await getLinkedProfile(authUser.id);
  if (!linked) return res.status(404).json({ error: "Profile not found." });

  try {
    const supabase = getServerSupabase();
    const { data: donorProfile } = await supabase
      .from("donor_profiles").select("*").eq("profile_id", linked.profile.id).maybeSingle();
    const { data: links } = await supabase
      .from("institution_profile_links").select("*").eq("profile_id", linked.profile.id);

    // Avoid leaking the internal Profile GUID — export a copy shaped for the user.
    const profileCopy = { ...linked.profile };
    delete (profileCopy as Record<string, unknown>).id;

    return res.json({
      requested_at: nowISO(),
      profile: profileCopy,
      donorProfile,
      institutionLinks: links?.map((l) => l.institution_id) || [],
    });
  } catch (error) {
    console.error("[Account] export failed:", error);
    return res.status(500).json({ error: "Failed to export your data." });
  }
}));

// ─── POST /api/account/logout — frontend-initiated session clear ──────────────
// With pure Supabase passwordless/Google + a server JWT, the backend keeps no
// session state to destroy. The real work (revoking the token / clearing the
// client storage) is client-side. This endpoint exists as the canonical logout
// contract so the frontend always has a stable target; it invalidates the auth
// serverSide: we just ack and let the client drop its tokens.
router.post("/account/logout", rateLimitMiddleware(30, 60_000), wrap(async (_req, res) => {
  // No server-side state to tear down. Return success; client clears Supabase session.
  return res.json({ success: true, logged_out: true });
}));

export default router;
