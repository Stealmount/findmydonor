// Onboarding routes — Phase 3 (auth redesign, Rev 3 §10).
//
// Three-step onboarding, server-driven: AUTH (Screen 1) → BASIC PROFILE (Screen 2)
// → INTENT (Screen 3). Each step persists to profiles and advances onboarding_step.
// Single-select intent; can_request stays true for everyone. Donor/institution
// details are captured inline on Screen 3 — no 4th screen. Welcome is enqueued
// exactly once when the user completes onboarding.
import express, { Router } from "express";
import { getAuthenticatedUser, getLinkedProfile } from "../middleware/auth";
import { getServerSupabase } from "../src/lib/serverDb";
import { cacheInvalidatePrefix } from "../src/lib/redisCache";
import rateLimitMiddleware from "../middleware/rateLimiter";
import { validate } from "../validation/index";
import {
  onboardingBasicSchema,
  onboardingIntentSchema,
} from "../validation/onboarding";
import { enqueueWelcome } from "../services/notificationService";
import { resolvePincode } from "./pincode";
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

/** Rev 3 flow is only reachable for new unified-auth profiles. */
function isRev3Profile(p: any): boolean {
  return !!p && (p.auth_method === "google" || p.auth_method === "email");
}

// ─── POST /api/onboarding/basic — Screen 2: basic profile ────────────────────
// Persists shared profile location + WhatsApp + communication preference,
// then advances onboarding_step → 'intent'. Verify Later is always allowed and
// never blocks this step. Pincode auto-resolves City/District/State when omitted.
router.post(
  "/onboarding/basic",
  rateLimitMiddleware(10, 60_000),
  validate(onboardingBasicSchema),
  wrap(async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });
    const linked = await getLinkedProfile(authUser.id);
    if (!linked) return res.status(404).json({ error: "Profile not found." });
    if (!isRev3Profile(linked.profile)) {
      return res.status(409).json({ error: "Onboarding is not available for legacy profiles." });
    }

    const {
      fullName, whatsappPhone, pincode, city, district, state, area,
      notificationChannel, verifyLater,
    } = req.body;

    // Auto-resolve location from PIN when free-text location is omitted.
    let resolved = null;
    if (pincode) {
      resolved = await resolvePincode(pincode);
    }

    const update: Record<string, unknown> = {
      onboarding_step: "intent",
      updated_at: nowISO(),
    };
    if (fullName !== undefined) update.full_name = fullName;
    if (whatsappPhone !== undefined) {
      update.whatsapp_phone = whatsappPhone;
      // Changing the number resets verification (Rule: changing number resets verification).
      update.whatsapp_verified = false;
    }
    if (pincode !== undefined) update.pincode = pincode;
    if (city !== undefined) update.city = city;
    else if (resolved?.city) update.city = resolved.city;
    if (district !== undefined) update.district = district;
    else if (resolved?.district) update.district = resolved.district;
    if (state !== undefined) update.state = state;
    else if (resolved?.state) update.state = resolved.state;
    if (area !== undefined) update.area = area;
    else if (resolved?.area) update.area = resolved.area;
    if (notificationChannel !== undefined) update.notification_channel = notificationChannel;

    const { error } = await getServerSupabase()
      .from("profiles").update(update).eq("id", linked.profile.id);
    if (error) return res.status(500).json({ error: "Failed to save basic profile." });

    await cacheInvalidatePrefix(`me:${authUser.id}`);
    const refresh = await getLinkedProfile(authUser.id);
    const onboarding = (refresh?.profile as (Record<string, unknown> & { onboarding_step?: string }) | null | undefined)?.onboarding_step ?? "intent";
    return res.json({
      success: true,
      nextStep: "intent",
      verifyLater: !!verifyLater,
      onboarding,
    });
  })
);

// ─── POST /api/onboarding/intent — Screen 3: single-select intent ────────────
// Captures the single-select intent plus inline donor/institution details,
// sets onboarding_step → 'complete', and enqueues the welcome (idempotent).
router.post(
  "/onboarding/intent",
  rateLimitMiddleware(10, 60_000),
  validate(onboardingIntentSchema),
  wrap(async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });
    const linked = await getLinkedProfile(authUser.id);
    if (!linked) return res.status(404).json({ error: "Profile not found." });
    if (!isRev3Profile(linked.profile)) {
      return res.status(409).json({ error: "Onboarding is not available for legacy profiles." });
    }

    const {
      intent, bloodGroup, isAvailable, healthSelfDeclaration,
    } = req.body;

    const supabase = getServerSupabase();
    const profileId = linked.profile.id;

    if (intent === "donor") {
      if (!bloodGroup) return res.status(400).json({ error: "Blood group is required for donor onboarding." });
      if (healthSelfDeclaration !== true) return res.status(400).json({ error: "Health self-declaration is required for donor onboarding." });
      await supabase.from("donor_profiles").upsert({
        profile_id: profileId,
        blood_group: bloodGroup,
        is_available: !!isAvailable,
        profile_complete: true,
        updated_at: nowISO(),
      }, { onConflict: "profile_id" });
      await supabase.from("profiles").update({ can_donate: true, can_request: true }).eq("id", profileId);
      await cacheInvalidatePrefix("eligible_");
    }

    await supabase.from("profiles").update({
      intent,
      onboarding_step: "complete",
      updated_at: nowISO(),
    }).eq("id", profileId);

    await cacheInvalidatePrefix(`acct:${authUser.id}`);
    await cacheInvalidatePrefix(`me:${authUser.id}`);

    // Welcome: enforce via profiles.update intent completed — enqueue once.
    const welcome = await enqueueWelcome(profileId);

    return res.json({
      success: true,
      intent,
      onboarding_step: "complete",
      can_request: true,
      can_donate: linked.profile.can_donate,
      welcome: { enqueued: welcome.enqueued, channel: welcome.channel },
    });
  })
);

// ─── POST /api/onboarding/completion-wizard ──────────────────────────────────
// Client calls this at the end of onboarding to advance into the dashboard
// shell and (re)confirm onboarding_step is 'complete'. Non-destructive.
router.post(
  "/onboarding/completion-wizard",
  rateLimitMiddleware(10, 60_000),
  wrap(async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });
    const linked = await getLinkedProfile(authUser.id);
    if (!linked) return res.status(404).json({ error: "Profile not found." });

    await getServerSupabase().from("profiles")
      .update({ onboarding_step: "complete", updated_at: nowISO() })
      .eq("id", linked.profile.id);

    return res.json({
      success: true,
      onboarding_step: "complete",
      hasCompletedOnboarding: true,
    });
  })
);

export default router;
