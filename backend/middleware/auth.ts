// Auth middleware — extracted from server.ts (Phase 3 decomposition)
import express from "express";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { getServerSupabase, getDoc as getLocalOrFirestoreDoc } from "../src/lib/serverDb";
import { cacheGet, cacheSet, cacheDel } from "../src/lib/redisCache";
import { isAdminJwt } from "./jwt";
import { normalizePhone } from "../helpers/phone";
import { nowISO } from "../helpers/time";
import type { BloodType, User } from "../src/types";

export type LinkedProfile = {
  id: string; full_name: string; phone: string; whatsapp_phone: string; email: string | null;
  whatsapp_verified: boolean; consent_accepted_at: string | null; can_donate: boolean; can_request: boolean;
};
export type LinkedDonorProfile = {
  profile_id: string; blood_group: BloodType | null; latitude: number | null; longitude: number | null;
  address_text: string | null; pincode: string | null; area: string | null; city: string | null;
  last_donation_date: string | null; cooldown_until: string | null; health_self_declaration: boolean;
  profile_complete: boolean; is_available: boolean;
};

export async function isAccountDeleted(authId: string): Promise<boolean> {
  const cacheKey = `acct_deleted:${authId}`;
  const cached = await cacheGet<boolean>(cacheKey);
  if (cached !== null) return cached;
  const user = await getLocalOrFirestoreDoc<User>("users", authId);
  const deleted = user?.account_status === "deleted";
  await cacheSet(cacheKey, deleted, 300); // 5-minute TTL
  return deleted;
}

export async function getAuthenticatedUser(req: express.Request) {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  let authUser: any = null;
  // Phase 7.2: short-lived admin JWT issued by /api/admin/verify-key.
  // The raw ADMIN_AUTH_SECRET is no longer the bearer token for new sessions,
  // but the legacy constant-time compare is kept for backward compatibility.
  if (isAdminJwt(token)) {
    authUser = { id: "admin-id", email: "admin@raktdaan.org", role: "admin" };
  } else if (token === "test-valid-token" && (process.env.NODE_ENV === "test" || process.env.VITE_SUPABASE_URL === "https://stub.supabase.co")) {
    authUser = { id: "test-user-id", email: "test@example.com" };
  } else if (token === "test-admin-token" && (process.env.NODE_ENV === "test" || process.env.VITE_SUPABASE_URL === "https://stub.supabase.co")) {
    authUser = { id: "test-admin-id", email: "admin@raktdaan.org" };
  } else if (timingSafeEqualStr(token, process.env.ADMIN_AUTH_SECRET || "")) {
    // Legacy: raw secret as bearer token (pre-7.2 sessions).
    authUser = { id: "admin-id", email: "admin@raktdaan.org", role: "admin" };
  } else {
    try {
      const { data, error } = await getServerSupabase().auth.getUser(token);
      if (!error && data.user) authUser = data.user;
    } catch (error) {
      console.warn("[Auth] Supabase unavailable:", error);
    }
  }

  if (!authUser) return null;
  if (await isAccountDeleted(authUser.id)) return null;

  return authUser;
}

export async function getLinkedProfile(authUserId: string): Promise<{ profile: LinkedProfile; donorProfile: LinkedDonorProfile | null } | null> {
  const supabase = getServerSupabase();
  let { data: link } = await supabase
    .from("auth_profile_links").select("profile_id").eq("auth_user_id", authUserId).maybeSingle();

  let profileId = link?.profile_id || authUserId;

  let [{ data: profile }, { data: donorProfile }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", profileId).maybeSingle(),
    supabase.from("donor_profiles").select("*").eq("profile_id", profileId).maybeSingle(),
  ]);

  if (!profile) {
    try {
      const { data: authUserData } = await supabase.auth.admin.getUserById(authUserId);
      if (authUserData?.user?.email) {
        const { data: profByEmail } = await supabase.from("profiles").select("*").eq("email", authUserData.user.email.toLowerCase().trim()).maybeSingle();
        if (profByEmail) {
          profile = profByEmail;
          const { data: dProf } = await supabase.from("donor_profiles").select("*").eq("profile_id", profByEmail.id).maybeSingle();
          donorProfile = dProf;
        }
      }
    } catch { /* ignore fallback error */ }
  }

  if (!profile) return null;
  return { profile: profile as LinkedProfile, donorProfile: donorProfile as LinkedDonorProfile | null };
}

export type OnboardingStep = "basic" | "intent" | "complete" | "contact" | "otp" | "donor-profile";

export function nextOnboardingStep(linked: Awaited<ReturnType<typeof getLinkedProfile>>): OnboardingStep {
  if (!linked) return "contact";
  // New (Rev 3) onboarding states take precedence when set explicitly.
  const stored = (linked.profile as unknown as { onboarding_step?: string }).onboarding_step;
  if (stored === "basic" || stored === "intent" || stored === "complete") return stored;
  // Legacy fallback: OTP verification disabled — skip "otp"; unverified numbers proceed.
  if (linked.profile.can_donate && !linked.donorProfile?.profile_complete) return "donor-profile";
  return "complete";
}

/**
 * Create (or reuse) an auth user + linked profile for email-based sign in.
 * Shared by /auth/email-complete and /auth/complete-verification (Google).
 * Supabase requires an internal credential — a random 32-char password generated
 * server-side, never returned/displayed/entered and not resettable.
 * Returns the auth user id and the linked profile (existing or created).
 */
export async function createAuthUserAndProfile(email: string, fullName: string, provider: "email" | "google") {
  const supabase = getServerSupabase();
  const normalizedEmail = String(email).toLowerCase().trim();
  const internalPassword = randomUUID() + randomUUID().replace(/-/g, ""); // 64-char, never exposed

  // Existing auth user by email? (e.g. OTP sign-in already created one)
  let authUserId: string;
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password: internalPassword,
    email_confirm: true,
    user_metadata: { full_name: String(fullName).trim() },
  });
  if (authError?.message?.includes("already been registered")) {
    const { data: { users: allUsers } } = await supabase.auth.admin.listUsers();
    const existing = (allUsers as any[])?.find((u: any) => u.email === normalizedEmail);
    if (!existing) throw new Error("auth-user-unavailable");
    authUserId = existing.id;
  } else if (authError) {
    throw new Error("auth-user-create-failed");
  } else {
    authUserId = authData.user.id;
  }

  // Existing profile by email? Link-or-create (duplicate prevention, email-first).
  let { data: profile } = await supabase.from("profiles").select("*").eq("email", normalizedEmail).maybeSingle();
  if (!profile) {
    const now = nowISO();
    const { data: created } = await supabase.from("profiles").insert({
      full_name: String(fullName).trim(),
      email: normalizedEmail,
      auth_method: provider === "google" ? "google" : "email",
      notification_channel: process.env.NOTIFICATION_DEFAULT_CHANNEL || "both",
      onboarding_step: "basic",
      consent_accepted_at: now,
      can_request: true,
    }).select().single();
    if (!created) throw new Error("profile-create-failed");
    profile = created;
  }

  try {
    await supabase.from("auth_profile_links").upsert({
      auth_user_id: authUserId,
      profile_id: profile.id,
      provider,
    }, { onConflict: "auth_user_id" });
  } catch { /* ignore duplicate link */ }

  return { authUserId, profile };
}

/** Constant-time string comparison — prevents timing attacks on token/secret validation. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ─── OTP verification tickets (single-use, purpose-bound) ───────────────────
// Moved here from server.ts so both auth routes and SOS/matching routes can
// consume tickets without importing server.ts (circular dependency).

export async function consumeOtpTicket(ticket: string, phone: string, expectedPurpose: "signup" | "sos" | "verify"): Promise<boolean> {
  const key = `wa_otp_ticket_${ticket}`;
  const stored = await cacheGet<string>(key);
  if (!stored) return false;
  const [purpose, verifiedPhone] = stored.split("|");
  if (purpose !== expectedPurpose || verifiedPhone !== normalizePhone(phone)) {
    return false;
  }
  await cacheDel(key);
  return true;
}

export async function consumeEmailOtpTicket(ticket: string, email: string): Promise<boolean> {
  const key = `email_otp_ticket_${ticket}`;
  const stored = await cacheGet<string>(key);
  if (!stored) return false;
  const [purpose, verifiedEmail] = stored.split("|");
  if (purpose !== "signup" || verifiedEmail !== String(email).toLowerCase().trim()) {
    return false;
  }
  await cacheDel(key);
  return true;
}

export async function ticketPurpose(ticket: string): Promise<string | null> {
  const stored = await cacheGet<string>(`wa_otp_ticket_${ticket}`);
  if (!stored) return null;
  return stored.split("|")[0] || null;
}
