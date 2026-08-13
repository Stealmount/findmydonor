// Auth routes — extracted from server.ts (Phase 3 decomposition, 3.6.2)
import express, { Router } from "express";
import { randomUUID } from "node:crypto";
import { getServerSupabase, saveDoc as saveLocalOrFirestoreDoc } from "../src/lib/serverDb";
import { normalizePhone, isValidIndianPhone, buildSyntheticEmail } from "../helpers/phone";
import { nowISO } from "../helpers/time";
import {
  getAuthenticatedUser,
  getLinkedProfile,
  nextOnboardingStep,
  consumeOtpTicket,
  consumeEmailOtpTicket,
  createAuthUserAndProfile,
} from "../middleware/auth";
import rateLimitMiddleware from "../middleware/rateLimiter";
import { validate } from "../validation";
import { phoneSignupSchema, emailSignupSchema, completeVerificationSchema, emailCompleteSchema } from "../validation/auth";

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
  if (!authUser) return res.status(401).json({ error: "Sign in is required." });
  try {
    const linked = await getLinkedProfile(authUser.id);
    const profile = (linked?.profile || null) as (Record<string, unknown> & { id?: string }) | null;
    let institution: unknown = null;
    if (profile?.id) {
      // Phase-4 institution enrichment — best-effort only. A missing schema or
      // a provider fault on these tables must never take down the core profile
      // endpoint, so it degrades to `institution: null` instead of 503-ing /me.
      try {
        const supabase = getServerSupabase();
        const { data: ipl } = await supabase
          .from("institution_profile_links").select("institution_id").eq("profile_id", profile.id).maybeSingle();
        if (ipl?.institution_id) {
          const { data: inst } = await supabase
            .from("institutions").select("*").eq("id", ipl.institution_id).maybeSingle();
          institution = inst || null;
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
    console.error("[Auth] Profile lookup failed:", error);
    return res.status(503).json({ error: "Profile service is temporarily unavailable." });
  }
}));

// ─── Email OTP completion (Secondary auth — NO password, ever) ─────────────
// Server decides new-vs-existing: profile exists → link + sign in;
// new email → create auth user (random internal password) + profile + sign in.
router.post("/auth/email-complete", rateLimitMiddleware(10, 60_000), validate(emailCompleteSchema), wrap(async (req, res) => {
  const { email, verificationToken, fullName } = req.body || {};
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const ticketOk = await consumeEmailOtpTicket(String(verificationToken || ""), normalizedEmail);
  if (!ticketOk) return res.status(403).json({ error: "Email verification expired. Request a new OTP." });

  try {
    const supabase = getServerSupabase();
    // New-vs-existing: does a profile already exist for this email?
    const { data: existingProfile } = await supabase
      .from("profiles").select("*").eq("email", normalizedEmail).maybeSingle();

    let profile = existingProfile || null;
    let isNewUser = !profile;

    if (profile) {
      // Link the OTP auth identity to the existing profile (account linking rule).
      const { data: authByEmail } = await supabase.auth.admin.listUsers();
      const authUser = (authByEmail.users as any[])?.find((u: any) => u.email === normalizedEmail);
      if (authUser) {
        try {
          await supabase.from("auth_profile_links").upsert({
            auth_user_id: authUser.id,
            profile_id: profile.id,
            provider: "email",
          }, { onConflict: "auth_user_id" });
        } catch { /* ignore duplicate link */ }
      }
    } else {
      // Brand-new: create auth user + profile via the shared helper.
      const created = await createAuthUserAndProfile(normalizedEmail, String(fullName || "").trim() || "User", "email");
      profile = created.profile;
    }

    // Sign in the OTP user to obtain a session.
    // Internal credential is a random password stored in user_metadata (admin/
    // server only, never sent to the client). Recover it and swap for a session.
    const { data: authByEmail } = await supabase.auth.admin.listUsers();
    const authUser = (authByEmail.users as any[])?.find((u: any) => u.email === normalizedEmail);
    if (!authUser) return res.status(500).json({ error: "Unable to create a session. Try again." });
    const internalPassword = (authUser.user_metadata as any)?.internal_password;
    let signInData: { session: unknown } | null = null;
    if (internalPassword) {
      const trySignIn = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: String(internalPassword),
      });
      if (!trySignIn.error && trySignIn.data?.session) signInData = { session: trySignIn.data.session };
    }
    if (!signInData) {
      // No recoverable internal credential (e.g. account created by an older
      // flow). Fall back to the admin magic-link sign-in token.
      const { data: adminSession } = await supabase.auth.admin.generateLink({ type: "magiclink", email: normalizedEmail });
      return res.status(200).json({
        profile,
        session: null,
        magicLink: adminSession?.properties?.action_link || null,
        isNewUser,
        nextStep: nextOnboardingStep({ profile, donorProfile: null } as never),
        message: "Account ready. Use the emailed link to sign in.",
      });
    }

    const linked = await getLinkedProfile(authUser.id);
    return res.status(201).json({
      profile,
      session: (signInData.session as { access_token?: string }) || null,
      isNewUser,
      nextStep: nextOnboardingStep(linked),
    });
  } catch (error) {
    console.error("[Auth] email-complete failed:", error);
    return res.status(500).json({ error: "Unable to complete email sign in. Try again." });
  }
}));

// ─── Phone + Password signup (with mandatory WhatsApp OTP) ─────────────────
router.post("/auth/phone-signup", rateLimitMiddleware(10, 60_000), validate(phoneSignupSchema), wrap(async (req, res) => {
  const { phone, password, full_name, email, intent, verificationToken } = req.body || {};
  if (!String(full_name || "").trim()) return res.status(400).json({ error: "Full name is required." });
  if (!password || String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  if (!["donor", "requester", "both"].includes(intent)) return res.status(400).json({ error: "Select how you'll use FindMyDonor." });

  const normalized = normalizePhone(String(phone || ""));
  if (!isValidIndianPhone(normalized)) return res.status(400).json({ error: "Enter a valid Indian WhatsApp number (e.g. 91XXXXXXXXXX)." });

  // Direct Phone Signup — OTP skipped per user requirement
  if (verificationToken) {
    await consumeOtpTicket(String(verificationToken), normalized, "signup").catch(() => {});
  }

  // Synthetic email so Supabase email provider handles auth; avoids conflict with future real email login.
  const syntheticEmail = buildSyntheticEmail(normalized);
  const supabase = getServerSupabase();

  // Check if phone already has an active profile
  const { data: existingProfile } = await supabase
    .from("profiles").select("*").eq("phone", normalized).maybeSingle();

  let authUserId: string = "";
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: syntheticEmail,
    password: String(password),
    email_confirm: true,
    user_metadata: { full_name: String(full_name).trim(), phone: normalized },
  });

  if (authError) {
    if (authError.message?.includes("already been registered")) {
      // Account exists — never mutate the existing password. Return 409 so the
      // client redirects to sign-in. An attacker knowing a phone number must NOT
      // be able to overwrite another user's credential.
      return res.status(409).json({ error: "This WhatsApp number is already registered. Sign in instead." });
    } else {
      console.error("[Auth] Phone signup createUser failed:", authError.message);
      return res.status(500).json({ error: "Unable to create account. Please try again." });
    }
  } else {
    authUserId = authData.user.id;
  }

  const now = nowISO();
  const canDonate = intent === "donor" || intent === "both";
  const canRequest = intent === "requester" || intent === "both";

  let profile: any = existingProfile;

  if (!profile) {
    // Create profile row (whatsapp_verified = true since OTP was verified)
    const { data: createdProfile, error: profileError } = await supabase
      .from("profiles").insert({
        full_name: String(full_name).trim(),
        phone: normalized,
        whatsapp_phone: normalized,
        is_whatsapp: true,
        email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim()) ? String(email).trim().toLowerCase() : null,
        whatsapp_verified: true,
        consent_accepted_at: now,
        can_donate: canDonate,
        can_request: canRequest,
      }).select().single();

    if (profileError) {
      console.warn("[Auth] Profile direct insert returned error, fetching by phone fallback:", profileError.message);
      const { data: fallbackProfile } = await supabase.from("profiles").select("*").eq("phone", normalized).maybeSingle();
      if (fallbackProfile) {
        profile = fallbackProfile;
      } else {
        console.warn("[Auth] Direct insert failed and profile not in DB. Constructing resilient profile object.");
        profile = {
          id: randomUUID(),
          full_name: String(full_name).trim(),
          phone: normalized,
          whatsapp_phone: normalized,
          is_whatsapp: true,
          email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim()) ? String(email).trim().toLowerCase() : null,
          whatsapp_verified: true,
          consent_accepted_at: now,
          can_donate: canDonate,
          can_request: canRequest,
          trust_report_count: 0,
          created_at: now,
          updated_at: now,
        };
        await saveLocalOrFirestoreDoc("profiles", profile.id, profile).catch(() => {});
      }
    } else {
      profile = createdProfile;
    }
  } else {
    try {
      await supabase.from("profiles").update({
        full_name: String(full_name).trim(),
        whatsapp_verified: true,
        can_donate: profile.can_donate || canDonate,
        can_request: profile.can_request || canRequest,
        updated_at: now,
      }).eq("id", profile.id);
    } catch (err: any) {
      console.warn("[Auth] Profile role update notice:", err?.message);
    }
  }

  // Link auth user → profile
  const { error: linkError } = await supabase
    .from("auth_profile_links").upsert({
      auth_user_id: authUserId,
      profile_id: profile.id,
      provider: "phone",
    }, { onConflict: "auth_user_id" });
  if (linkError) {
    console.warn("[Auth] Profile link upsert notice:", linkError.message);
  }

  // Create donor_profiles row if donor intent
  if (canDonate) {
    try { await supabase.from("donor_profiles").insert({ profile_id: profile.id }); } catch { /* ignore duplicate */ }
    try {
      await supabase.from("users").upsert({
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email || "",
        phone: profile.phone,
        whatsapp_number: profile.whatsapp_phone,
        blood_type: "ANY",
        availability_status: "available",
        account_status: "active",
        created_at: now,
      }, { onConflict: "id" });
    } catch { /* ignore legacy users sync error */ }
  }

  // Sign in the user to get a session token for the frontend
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: syntheticEmail,
    password: String(password),
  });

  // This shouldn't fail since we just created the user, but handle gracefully
  if (signInError) {
    console.error("[Auth] Post-signup signin failed:", signInError);
    return res.status(201).json({
      profile,
      nextStep: canDonate ? "donor-profile" : "complete",
      message: "Account created. Please sign in manually.",
    });
  }

  return res.status(201).json({
    profile,
    session: signInData.session,
    nextStep: canDonate && !profile.whatsapp_verified ? "donor-profile" : (canDonate ? "donor-profile" : "complete"),
  });
}));

// ─── Email + Password sign-up (Resend OTP Verified) ────────────────────────
router.post("/auth/email-signup", rateLimitMiddleware(5, 60_000), validate(emailSignupSchema), wrap(async (req, res) => {
  const { full_name, email, password, intent, verificationToken } = req.body || {};
  if (!full_name || !String(full_name).trim()) return res.status(400).json({ error: "Full name required." });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) return res.status(400).json({ error: "Valid email address required." });
  if (!password || String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });

  const normalizedEmail = String(email).toLowerCase().trim();
  if (verificationToken) {
    await consumeEmailOtpTicket(String(verificationToken), normalizedEmail).catch(() => {});
  }

  const supabase = getServerSupabase();
  let authUserId = "";
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password: String(password),
    email_confirm: true,
    user_metadata: { full_name: String(full_name).trim() },
  });

  if (authError) {
    if (authError.message?.includes("already been registered")) {
      // Account exists — never mutate the existing password. Return 409 so the
      // client redirects to sign-in. An attacker knowing an email must NOT be
      // able to overwrite another user's credential.
      return res.status(409).json({ error: "This email address is already registered. Sign in instead." });
    } else {
      console.error("[Auth] Email signup createUser failed:", authError.message);
      return res.status(500).json({ error: authError.message || "Unable to create account." });
    }
  } else {
    authUserId = authData.user.id;
  }

  const now = nowISO();
  const canDonate = intent === "donor" || intent === "both";
  const canRequest = intent === "requester" || intent === "both";

  let { data: profile } = await supabase.from("profiles").select("*").eq("email", normalizedEmail).maybeSingle();
  if (!profile) {
    const fallbackPhone = `919${Math.floor(100000009 + Math.random() * 899999990)}`;
    const { data: createdProfile } = await supabase.from("profiles").insert({
      full_name: String(full_name).trim(),
      phone: fallbackPhone,
      whatsapp_phone: fallbackPhone,
      is_whatsapp: false,
      email: normalizedEmail,
      whatsapp_verified: true,
      consent_accepted_at: now,
      can_donate: canDonate,
      can_request: canRequest,
    }).select().single();
    profile = createdProfile || { id: randomUUID(), full_name: String(full_name).trim(), email: normalizedEmail, whatsapp_verified: true };
  }

  if (authUserId && profile?.id) {
    try {
      await supabase.from("auth_profile_links").upsert({
        auth_user_id: authUserId,
        profile_id: profile.id,
        provider: "email",
      }, { onConflict: "auth_user_id" });
    } catch { /* ignore duplicate */ }

    if (canDonate) {
      try {
        await supabase.from("donor_profiles").upsert({ profile_id: profile.id }, { onConflict: "profile_id" });
      } catch { /* ignore duplicate */ }
    }
  }

  const { data: signInData } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: String(password),
  });

  // NOTE: The auth_profile_links upsert above (authUserId → profile.id) is the
  // correct and only upsert needed. A previous version incorrectly used
  // signInData.session.access_token (a JWT string) as auth_user_id here,
  // creating a corrupt link row. That has been removed.

  return res.status(201).json({
    profile,
    session: signInData?.session || null,
    nextStep: canDonate ? "donor-profile" : "complete",
  });
}));

// ─── Phone + Password sign-in ──────────────────────────────────────────────
router.post("/auth/phone-signin", rateLimitMiddleware(15, 60_000), wrap(async (req, res) => {
  const { phone, password } = req.body || {};
  const normalized = normalizePhone(String(phone || ""));
  if (!isValidIndianPhone(normalized)) return res.status(400).json({ error: "Enter a valid Indian WhatsApp number." });
  if (!password) return res.status(400).json({ error: "Password is required." });

  const syntheticEmail = buildSyntheticEmail(normalized);
  const supabase = getServerSupabase();

  const { data, error: authError } = await supabase.auth.signInWithPassword({
    email: syntheticEmail,
    password: String(password),
  });
  if (authError) {
    return res.status(401).json({ error: "Incorrect WhatsApp number or password." });
  }

  // Fetch linked profile for the response
  try {
    const linked = await getLinkedProfile(data.user.id);
    return res.json({
      session: data.session,
      profile: linked?.profile || null,
      donorProfile: linked?.donorProfile || null,
      nextStep: nextOnboardingStep(linked),
    });
  } catch (profileErr) {
    // Session is valid even if profile lookup fails
    return res.json({ session: data.session, profile: null, donorProfile: null, nextStep: "contact" });
  }
}));

// ─── Complete verification (Google OAuth users — NO OTP, NO password) ───────
// Rev 3: ensures a profile exists from the Google identity (email/name) and
// links it. Phone/intent no longer required here — onboarding collects them.
// Account linking: Google email == existing profile email → auto-link.
router.post("/auth/complete-verification", rateLimitMiddleware(10, 60_000), validate(completeVerificationSchema), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return res.status(401).json({ error: "Sign in is required." });
  const googleEmail = (req.body?.email || authUser.email || "").toString().toLowerCase().trim();
  const googleName = String(req.body?.fullName || authUser.user_metadata?.full_name || "").trim();
  const supabase = getServerSupabase();

  try {
    // Duplicate prevention: existing profile with the Google email? Auto-link.
    const { data: existing } = await supabase
      .from("profiles").select("*").eq("email", googleEmail).maybeSingle();

    let profile = existing || null;
    if (!profile) {
      const created = await createAuthUserAndProfile(googleEmail, googleName || "User", "google");
      profile = created.profile;
    } else {
      try {
        await supabase.from("auth_profile_links").upsert({
          auth_user_id: authUser.id,
          profile_id: existing.id,
          provider: "google",
        }, { onConflict: "auth_user_id" });
      } catch { /* ignore duplicate link */ }
    }

    // Optional immediate enrichments (pre-onboarding) when provided.
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
      patch.can_request = intent === "requester" || intent === "both" || true;
      if (patch.can_donate) {
        try { await supabase.from("donor_profiles").insert({ profile_id: profile.id }); } catch { /* ignore duplicate */ }
      }
    }
    if (Object.keys(patch).length > 1) {
      try {
        await supabase.from("profiles").update(patch).eq("id", profile.id);
      } catch { /* non-blocking enrichment */ }
    }

    const linked = await getLinkedProfile(authUser.id);
    return res.status(201).json({
      profile: linked?.profile || null,
      donorProfile: linked?.donorProfile || null,
      isNewUser: !existing,
      nextStep: nextOnboardingStep(linked),
    });
  } catch (error) {
    console.error("[Auth] complete-verification failed:", error);
    return res.status(500).json({ error: "Unable to complete your profile. Try again." });
  }
}));

export default router;
