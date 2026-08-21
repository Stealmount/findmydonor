// Auth middleware — extracted from server.ts (Phase 3 decomposition)
// Firebase Admin SDK migration: replaced Supabase with Firestore + Firebase Auth
import express from "express";
import { timingSafeEqual } from "node:crypto";
import { db, auth } from "../src/lib/firebase";
import { getDoc as getLocalOrFirestoreDoc } from "../src/lib/serverDb";
import { cacheGet, cacheSet, cacheDel } from "../src/lib/redisCache";
import { isAdminJwt } from "./jwt";
import { normalizePhone } from "../helpers/phone";
import { nowISO } from "../helpers/time";
import type { BloodType, User } from "../src/types";

export type LinkedProfile = {
  id: string; full_name: string; phone: string | null; whatsapp_phone: string | null; email: string | null;
  whatsapp_verified: boolean; consent_accepted_at: string | null; can_donate: boolean; can_request: boolean;
  auth_method?: string | null; onboarding_step?: string | null; intent?: string | null;
  notification_channel?: string | null; welcome_sent_at?: string | null;
  pincode?: string | null; city?: string | null; district?: string | null; state?: string | null; area?: string | null;
};
export type LinkedDonorProfile = {
  profile_id: string; blood_group: BloodType | null; latitude: number | null; longitude: number | null;
  address_text: string | null; pincode: string | null; area: string | null; city?: string | null;
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
  if (isAdminJwt(token)) {
    authUser = { id: "admin-id", email: "admin@raktdaan.org", role: "admin" };
  } else if (token === "test-valid-token" && (process.env.NODE_ENV === "test" || process.env.TEST_MODE === "1")) {
    authUser = { id: "test-user-id", email: "test@example.com" };
  } else if (token === "test-admin-token" && (process.env.NODE_ENV === "test" || process.env.TEST_MODE === "1")) {
    authUser = { id: "test-admin-id", email: "admin@raktdaan.org" };
  } else if (timingSafeEqualStr(token, process.env.ADMIN_AUTH_SECRET || "")) {
    // Legacy: raw secret as bearer token (pre-7.2 sessions).
    authUser = { id: "admin-id", email: "admin@raktdaan.org", role: "admin" };
  } else {
    try {
      const decoded = await auth.verifyIdToken(token);
      authUser = { id: decoded.uid, email: decoded.email ?? null };
    } catch (error) {
      console.warn("[Auth] Firebase verifyIdToken failed:", error);
    }
  }

  if (!authUser) return null;
  if (await isAccountDeleted(authUser.id)) return null;

  return authUser;
}

export async function getLinkedProfile(authUserId: string): Promise<{ profile: LinkedProfile; donorProfile: LinkedDonorProfile | null } | null> {
  // Try legacy auth_profile_links first (backward compat), then fall back to direct doc lookup.
  let profileId = authUserId;
  try {
    const linkDoc = await db.collection("auth_profile_links").doc(authUserId).get();
    if (linkDoc.exists) {
      const linkData = linkDoc.data();
      if (linkData?.profile_id) profileId = linkData.profile_id;
    }
  } catch { /* ignore — collection may not exist */ }

  const [profileSnap, donorSnap] = await Promise.all([
    db.collection("profiles").doc(profileId).get(),
    db.collection("donor_profiles").doc(profileId).get(),
  ]);

  let profile: LinkedProfile | null = profileSnap.exists
    ? { id: profileSnap.id, ...profileSnap.data() } as LinkedProfile
    : null;

  let donorProfile: LinkedDonorProfile | null = donorSnap.exists
    ? { profile_id: donorSnap.id, ...donorSnap.data() } as LinkedDonorProfile
    : null;

  // Fallback: if no profile found by ID, try looking up the Firebase auth user by email.
  if (!profile) {
    try {
      const firebaseUser = await auth.getUser(authUserId);
      if (firebaseUser.email) {
        const emailLower = firebaseUser.email.toLowerCase().trim();
        const profilesQuery = await db.collection("profiles").where("email", "==", emailLower).limit(1).get();
        if (!profilesQuery.empty) {
          const profDoc = profilesQuery.docs[0];
          profile = { id: profDoc.id, ...profDoc.data() } as LinkedProfile;
          const dpSnap = await db.collection("donor_profiles").doc(profDoc.id).get();
          if (dpSnap.exists) {
            donorProfile = { profile_id: dpSnap.id, ...dpSnap.data() } as LinkedDonorProfile;
          }
        }
      }
    } catch { /* ignore fallback error */ }
  }

  if (!profile) return null;
  return { profile, donorProfile };
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
 * Firebase Auth creates users without passwords (passwordless / email-link / Google).
 * Returns the auth user id and the linked profile (existing or created).
 */
export async function createAuthUserAndProfile(email: string, fullName: string, provider: "email" | "google") {
  const normalizedEmail = String(email).toLowerCase().trim();

  // Try to create auth user; if email already exists, look it up instead.
  let authUserId: string;
  try {
    const created = await auth.createUser({
      email: normalizedEmail,
      displayName: String(fullName).trim(),
      emailVerified: true,
    });
    authUserId = created.uid;
  } catch (err: any) {
    // Firebase throws "auth/email-already-exists" if the email is taken.
    if (err?.code === "auth/email-already-exists" || err?.message?.includes("already")) {
      const listResult = await auth.listUsers(1000);
      const existing = listResult.users.find((u) => u.email === normalizedEmail);
      if (!existing) throw new Error("auth-user-unavailable");
      authUserId = existing.uid;
    } else {
      throw new Error("auth-user-create-failed");
    }
  }

  // Ensure the Firebase auth user has display name set (may have been pre-existing).
  try {
    const firebaseUser = await auth.getUser(authUserId);
    if (!firebaseUser.displayName && fullName) {
      await auth.updateUser(authUserId, { displayName: String(fullName).trim() });
    }
  } catch { /* best-effort */ }

  // Check for existing profile by email (duplicate prevention).
  let profileId: string | null = null;
  let profileData: Record<string, any> | null = null;
  const profilesQuery = await db.collection("profiles").where("email", "==", normalizedEmail).limit(1).get();
  if (!profilesQuery.empty) {
    const profDoc = profilesQuery.docs[0];
    profileId = profDoc.id;
    profileData = profDoc.data();
  }

  if (!profileId) {
    const now = nowISO();
    profileId = authUserId; // Use auth user ID as profile ID
    const newProfile = {
      full_name: String(fullName).trim(),
      email: normalizedEmail,
      auth_method: provider === "google" ? "google" : "email",
      notification_channel: process.env.NOTIFICATION_DEFAULT_CHANNEL || "both",
      onboarding_step: "basic",
      consent_accepted_at: now,
      can_request: true,
    };
    await db.collection("profiles").doc(profileId).set(newProfile);
    profileData = newProfile;
  }

  // Link auth user → profile (backward compat + useful for migrations).
  try {
    await db.collection("auth_profile_links").doc(authUserId).set({
      profile_id: profileId,
      provider,
    });
  } catch { /* ignore duplicate link */ }

  return { authUserId, profile: { id: profileId, ...profileData } as LinkedProfile };
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


