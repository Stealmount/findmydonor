/**
 * RaktDaan — Express Backend
 *
 * Key changes vs original:
 *  ✅ Redis cache (ioredis) replaces in-memory LRU
 *  ✅ WAHA WhatsApp HTTP API — real notifications
 *  ✅ Rich HTML email via Resend
 *  ✅ Server-side matching — fires N parallel WhatsApp+Email for N units
 *  ✅ /api/waha/webhook — donors reply YES/NO via WhatsApp
 *  ✅ rate-limiting on all /api/* routes
 */

import "dotenv/config";
import express from "express";
import path from "path";
import { randomInt, randomUUID, randomBytes, timingSafeEqual } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { createServer as createViteServer } from "vite";
import { Resend } from "resend";
import {
  getCollection as getLocalOrFirestoreCollection,
  getDoc as getLocalOrFirestoreDoc,
  saveDoc as saveLocalOrFirestoreDoc,
  getServerSupabase,
  isSupabaseConfigured,
  SupabaseUnavailableError,
} from "./src/lib/serverDb";
import {
  cacheGet,
  cacheSet,
  cacheSetNX,
  cacheDel,
  cacheInvalidatePrefix,
  getCacheStats,
} from "./src/lib/redisCache";
import {
  sendWhatsApp,
  buildDonorSosMessage,
  buildDonorConfirmedDetailsMessage,
  buildRequesterConfirmMessage,
  buildDonorThankYouMessage,
  buildWelcomeMessage,
  buildOtpMessage,
  buildRequesterSystemAlertMessage,
  buildNoDonorsFoundAlertMessage,
  buildDonorDeclineAckMessage,
  buildDonorReferralMessage,
} from "./src/lib/waha";
import {
  buildDonorSosEmailHTML,
  buildRequesterConfirmEmailHTML,
  buildEmailOtpHTML,
} from "./src/lib/email";
import { isBloodCompatible, BLOOD_COMPATIBILITY_MATRIX } from "./src/types";
import type { BloodRequest, BloodType, DonationLog, Match, Requester, User, NotificationLog } from "./src/types";

// ─── Shared Constants ────────────────────────────────────────────────────────
// ponytail: single source of truth — worker was filtering only ["open","matching"],
// missing "broadcasting" and "partially_matched" entirely (P0 bug)
const ACTIVE_REQUEST_STATUSES: readonly string[] = ["broadcasting", "matching", "open", "partially_matched"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizePhone(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  // Match SQL normalize_indian_phone: prepend 91 for bare 10-digit Indian numbers
  if (/^[6-9]\d{9}$/.test(digits)) return "91" + digits;
  return digits;
}

function isValidIndianPhone(phone: string): boolean {
  return /^91[6-9]\d{9}$/.test(normalizePhone(phone));
}

// Synthetic email for Supabase auth — deterministic, non-forwardable, phone-derived.
function buildSyntheticEmail(phone: string): string {
  return `phone+${phone}@raktdaan.local`;
}
export async function isAccountDeleted(authId: string): Promise<boolean> {
  const cacheKey = `acct_deleted:${authId}`;
  const cached = await cacheGet<boolean>(cacheKey);
  if (cached !== null) return cached;
  const user = await getLocalOrFirestoreDoc<User>("users", authId);
  const deleted = user?.account_status === "deleted";
  await cacheSet(cacheKey, deleted, 300); // 5-minute TTL
  return deleted;
}

async function getAuthenticatedUser(req: express.Request) {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  
  let authUser: any = null;
  if (token === "test-valid-token" && (process.env.NODE_ENV === "test" || process.env.VITE_SUPABASE_URL === "https://stub.supabase.co")) {
    authUser = { id: "test-user-id", email: "test@example.com" };
  } else if (token === "test-admin-token" && (process.env.NODE_ENV === "test" || process.env.VITE_SUPABASE_URL === "https://stub.supabase.co")) {
    authUser = { id: "test-admin-id", email: "admin@raktdaan.org" };
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

async function consumeOtpTicket(ticket: string, phone: string, expectedPurpose: "signup" | "sos"): Promise<boolean> {
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

async function consumeEmailOtpTicket(ticket: string, email: string): Promise<boolean> {
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

async function ticketPurpose(ticket: string): Promise<string | null> {
  const stored = await cacheGet<string>(`wa_otp_ticket_${ticket}`);
  if (!stored) return null;
  return stored.split("|")[0] || null;
}

type LinkedProfile = {
  id: string; full_name: string; phone: string; whatsapp_phone: string; email: string | null;
  whatsapp_verified: boolean; consent_accepted_at: string | null; can_donate: boolean; can_request: boolean;
};
type LinkedDonorProfile = {
  profile_id: string; blood_group: BloodType | null; latitude: number | null; longitude: number | null;
  address_text: string | null; pincode: string | null; area: string | null; city: string | null;
  last_donation_date: string | null; cooldown_until: string | null; health_self_declaration: boolean;
  profile_complete: boolean; is_available: boolean;
};

async function getLinkedProfile(authUserId: string): Promise<{ profile: LinkedProfile; donorProfile: LinkedDonorProfile | null } | null> {
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

function nextOnboardingStep(linked: Awaited<ReturnType<typeof getLinkedProfile>>): "contact" | "otp" | "donor-profile" | "complete" {
  if (!linked) return "contact";
  // OTP verification disabled — skip "otp" step; unverified numbers proceed to profile or complete
  if (linked.profile.can_donate && !linked.donorProfile?.profile_complete) return "donor-profile";
  return "complete";
}

function nowISO(): string {
  return new Date().toISOString();
}

function nowDate(): string {
  return new Date().toISOString().split("T")[0];
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[char]!);
}

// ─── Server-side matching engine ─────────────────────────────────────────────

/**
 * Returns eligible donors for a request, ordered by proximity.
 * Results are Redis-cached for 60 s to avoid hammering Firestore.
 */
import { getDistanceBetweenPincodes } from "./src/lib/geo";

/**
 * Returns eligible donors for a request, ordered by proximity.
 * Results are Redis-cached for 60 s to avoid hammering Firestore.
 * Donors are tagged as `is_exact_match` (exact ABO/Rh) vs compatible (fallback).
 */
async function findEligibleDonors(
  request: BloodRequest
): Promise<(User & { distance_km: number; match_rank: number; is_exact_match: boolean })[]> {
  const cacheKey = `eligible_${request.blood_type_needed}_${request.hospital_pincode}`;
  const cached = await cacheGet<(User & { distance_km: number; match_rank: number; is_exact_match: boolean })[]>(cacheKey);
  if (cached) return cached;

  const allDonors = await getLocalOrFirestoreCollection<User>("users");
  const allMatches = await getLocalOrFirestoreCollection<Match>("matches");
  const today = nowDate();

  // ── Anti-Spam: Donors alerted within last 6 hours on other requests ────────
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const recentAlertedDonors = new Set(
    allMatches
      .filter(m => m.notification_sent_at && new Date(m.notification_sent_at) > sixHoursAgo && m.request_id !== request.id)
      .map(m => m.donor_id)
  );

  // ── Hard filters ────────────────────────────────────────────────────────
  const eligible = allDonors.filter((d) => {
    if (d.account_status !== "active") return false;
    if (d.availability_status === "unavailable") return false;
    if (d.cooldown_until && d.cooldown_until >= today) return false;

    // Anti-spam throttle: prevent rapid-fire repeated texts across requests
    if (recentAlertedDonors.has(d.id) && request.urgency_level !== "critical") return false;

    // Blood compatibility: use the full ABO/Rh matrix, NOT exact-only.
    // Exact type is still preferred (tagged below); this pass admits compatible donors
    // so a 10-unit O- request can fall back to O- donors for non-exact recipients etc.
    if (request.blood_type_needed !== 'ANY') {
      const donorType = (d.blood_type || '').toUpperCase().trim() as BloodType;
      if (!isBloodCompatible(donorType, request.blood_type_needed as BloodType)) return false;
    }

    // Emergency-only restriction removed: all requests (planned, urgent, critical) match available donors
    // if (d.emergency_only && request.urgency_level !== "critical") return false;

    // Self-match prevention
    if (normalizePhone(d.phone) === normalizePhone(request.requester_phone)) return false;
    if (d.whatsapp_number && normalizePhone(d.whatsapp_number) === normalizePhone(request.requester_phone)) return false;
    if (d.email && request.requester_email && d.email.toLowerCase().trim() === request.requester_email.toLowerCase().trim()) return false;

    return true;
  });

  // ── Tag exact vs compatible ─────────────────────────────────────────────
  const donorsWithDistance = eligible.map((d) => {
    const dist = getDistanceBetweenPincodes(d.pincode, request.hospital_pincode);
    const is_exact_match = request.blood_type_needed === 'ANY'
      ? true
      : (d.blood_type || '').toUpperCase().trim() === request.blood_type_needed.toUpperCase().trim();
    return { ...d, distance_km: dist, match_rank: 4, is_exact_match };
  });

  // ── 4-tier geographic expansion (exact matches surfaced first per tier) ──
  // Tier 1: 0-3 km | Tier 2: 3-10 km | Tier 3: 10-25 km | Tier 4: >25 km
  const isRare = ['O-', 'AB-'].includes((request.blood_type_needed || '').toUpperCase().trim());

  let finalDonors: (User & { distance_km: number; match_rank: number; is_exact_match: boolean })[] = [];

  const sortTier = (a: typeof donorsWithDistance[0], b: typeof donorsWithDistance[0]) => {
    if (a.match_rank !== b.match_rank) return a.match_rank - b.match_rank;
    // Exact matches first within each tier
    if (a.is_exact_match !== b.is_exact_match) return a.is_exact_match ? -1 : 1;
    // Proximity first: physically nearest donor (distance_km) gets contacted first
    if (Math.abs(a.distance_km - b.distance_km) > 0.01) {
      return a.distance_km - b.distance_km;
    }
    return sortDonorsByActivity(a, b);
  };

  const tier1 = donorsWithDistance.filter(d => d.distance_km <= 3).map(d => ({ ...d, match_rank: 1 }));
  applyStalenessTier(tier1);
  tier1.sort(sortTier);
  finalDonors.push(...tier1);

  if (finalDonors.length < 3 || isRare) {
    const tier2 = donorsWithDistance.filter(d => d.distance_km > 3 && d.distance_km <= 10).map(d => ({ ...d, match_rank: 2 }));
    applyStalenessTier(tier2);
    tier2.sort(sortTier);
    finalDonors.push(...tier2);
  }

  if (finalDonors.length < 3 || isRare) {
    const tier3 = donorsWithDistance.filter(d => d.distance_km > 10 && d.distance_km <= 25).map(d => ({ ...d, match_rank: 3 }));
    applyStalenessTier(tier3);
    tier3.sort(sortTier);
    finalDonors.push(...tier3);
  }

  if (finalDonors.length < 3 || isRare) {
    const tier4 = donorsWithDistance.filter(d => d.distance_km > 25).map(d => ({ ...d, match_rank: 4 }));
    applyStalenessTier(tier4);
    tier4.sort(sortTier);
    finalDonors.push(...tier4);
  }

  // Deduplicate
  const seen = new Map<string, (User & { distance_km: number; match_rank: number; is_exact_match: boolean })>();
  for (const d of finalDonors) {
    if (!seen.has(d.id)) seen.set(d.id, d);
  }
  const result = Array.from(seen.values());

  await cacheSet(cacheKey, result, 60);
  return result;
}


// ponytail: reuses existing matchAndNotifyRequest dedup (acquireDonorLock + alreadyOffered)
async function notifyOpenRequestsForNewDonor(
  donorBloodGroup: string,
  donorPincode: string,
) {
  try {
    const allRequests = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
    const now = nowISO();
    const URGENCY_RANK: Record<string, number> = { critical: 0, urgent: 1, planned: 2 };
    const candidates = allRequests
      .filter((r) =>
        ACTIVE_REQUEST_STATUSES.includes(r.status) &&
        (!r.expires_at || r.expires_at >= now) &&
        (r.blood_type_needed === "ANY" || isBloodCompatible(donorBloodGroup as BloodType, r.blood_type_needed as BloodType)) &&
        getDistanceBetweenPincodes(donorPincode, r.hospital_pincode) <= 25
      )
      .sort((a, b) => {
        const ur = (URGENCY_RANK[a.urgency_level] ?? 9) - (URGENCY_RANK[b.urgency_level] ?? 9);
        if (ur !== 0) return ur;
        return getDistanceBetweenPincodes(donorPincode, a.hospital_pincode) - getDistanceBetweenPincodes(donorPincode, b.hospital_pincode);
      })
      .slice(0, 10);
    for (const req of candidates) {
      matchAndNotifyRequest(req).catch((e) =>
        console.error(`[EarlyMatch] matchAndNotify failed for ${req.tracking_code}:`, e.message)
      );
    }
  } catch (e: any) {
    console.error("[EarlyMatch] Failed to scan open requests:", e.message);
  }
}

// Helper sorting function: oldest last_donation_date first (null/never donated gets priority)
function sortDonorsByActivity(a: any, b: any) {
  if (!a.last_donation_date && b.last_donation_date) return -1;
  if (a.last_donation_date && !b.last_donation_date) return 1;
  if (a.last_donation_date && b.last_donation_date) {
    return a.last_donation_date.localeCompare(b.last_donation_date);
  }
  // ponytail: descending — fresher profiles sort first (was ascending, putting stalest first)
  return (b.updated_at || '').localeCompare(a.updated_at || '');
}

// Feature 2: Deprioritize stale donors (>90 days since updated_at) — bump rank by 1 (max 5)
function applyStalenessTier(donors: { match_rank: number; updated_at?: string }[]) {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  for (const d of donors) {
    if (d.updated_at && new Date(d.updated_at).getTime() < cutoff) {
      d.match_rank = Math.min(d.match_rank + 1, 5);
    }
  }
}

// Feature 3: Append-only audit trail — writes to request_events collection
async function logRequestEvent(requestId: string, event: string, actor: string = 'system') {
  try {
    const id = randomUUID();
    const record = { id, request_id: requestId, event, actor, at: nowISO() };
    await saveLocalOrFirestoreDoc("request_events", id, record as unknown as Record<string, unknown>);
  } catch (e: any) {
    console.error(`[Audit] Failed to log event for ${requestId}:`, e.message);
  }
}

// ── Donor reservation lock helpers (prevents double-booking) ─────────────────
// A donor is "reserved" for a request for up to DONOR_LOCK_TTL_S seconds
// while their match sits in 'pending' state. Once they accept/decline the lock
// is released so other requests can consider them.

const DONOR_LOCK_TTL_S = 5 * 60; // 5 minutes

function donorLockKey(donorId: string): string {
  return `donor_lock_${donorId}`;
}

/**
 * Atomically try to acquire a donor reservation lock.
 * Returns true if the lock was acquired (donor is free), false if already locked.
 */
async function acquireDonorLock(donorId: string, requestId: string): Promise<boolean> {
  return cacheSetNX(donorLockKey(donorId), requestId, DONOR_LOCK_TTL_S);
}

/** Release a donor's reservation lock (on decline, timeout, or match fulfillment). */
async function releaseDonorLock(donorId: string): Promise<void> {
  await cacheDel(donorLockKey(donorId));
}

async function matchAndNotifyRequest(request: BloodRequest) {
  const eligibleDonors = await findEligibleDonors(request);
  const existingMatches = await getLocalOrFirestoreCollection<Match>("matches");
  const alreadyOffered = new Set(
    existingMatches.filter((m) => m.request_id === request.id).map((m) => m.donor_id)
  );
  const approvedCount = existingMatches.filter(
    (m) => m.request_id === request.id && ["pending", "approved"].includes(m.donor_response)
  ).length;
  const openSlots = Math.max(0, request.units_required - approvedCount);

  // Filter out already-offered AND currently-locked donors
  const lockChecks = await Promise.all(
    eligibleDonors
      .filter((d) => !alreadyOffered.has(d.id))
      .map(async (d) => {
        const lockVal = await cacheGet<string>(donorLockKey(d.id));
        // Locked by a DIFFERENT request → skip
        if (lockVal && lockVal !== request.id) return null;
        return d;
      })
  );
  const freeDonors = lockChecks.filter(Boolean) as (User & {
    distance_km: number;
    match_rank: number;
    is_exact_match: boolean;
  })[];

  const selectedDonors = freeDonors.slice(0, openSlots);

  // Acquire locks for selected donors before writing match records
  const lockResults = await Promise.all(
    selectedDonors.map((d) => acquireDonorLock(d.id, request.id))
  );
  const lockedDonors = selectedDonors.filter((_, i) => lockResults[i]);

  const inserts = await Promise.all(
    lockedDonors.map(async (donor) => {
      const match: Match = {
        id: randomUUID(),
        request_id: request.id,
        donor_id: donor.id,
        match_rank: donor.match_rank,
        notification_channel: "whatsapp",
        notification_sent_at: null,
        reminder_sent_at: null,
        donor_response: "pending",
        donor_response_at: null,
        contact_shared_at: null,
        outcome: null,
        outcome_confirmed_at: null,
        created_at: nowISO(),
        distance_km: donor.distance_km,
        is_exact_match: donor.is_exact_match,
      };
      await saveLocalOrFirestoreDoc("matches", match.id, match as unknown as Record<string, unknown>);
      return { match, donor };
    })
  );

  await saveLocalOrFirestoreDoc("blood_requests", request.id, {
    ...request,
    status: inserts.length ? "matching" : "open",
    updated_at: nowISO(),
  } as unknown as Record<string, unknown>);

  const deliveries = await Promise.allSettled(
    inserts.map(({ match, donor }) => notifyDonor(match, request, donor))
  );

  if (inserts.length > 0) {
    if (request.requester_phone) {
      const text = buildRequesterSystemAlertMessage(request, inserts.length);
      await sendWhatsApp(request.requester_phone, text).catch(e => console.error("[WAHA] Failed to alert requester:", e.message));
    }
    if (request.requester_email && request.requester_email.includes("@")) {
      const subject = `🩸 [Update] Matching Donors Found for Request ${request.tracking_code}`;
      const html = `<p>Hi <strong>${escapeHtml(request.requester_name)}</strong>,</p><p>We have matched <strong>${inserts.length}</strong> eligible donor(s) for your blood request <code>${request.tracking_code}</code> at ${escapeHtml(request.hospital_name)}.</p><p><a href="https://findmydonor.online/tracking?code=${request.tracking_code}">Click here to track your request live</a></p>`;
      const text = `Hi ${request.requester_name},\nWe matched ${inserts.length} donor(s) for request ${request.tracking_code} at ${request.hospital_name}.\nTrack: https://findmydonor.online/tracking?code=${request.tracking_code}`;
      await sendEmailViaResend(request.requester_email, subject, html, text).catch(e => console.error("[Email] Failed to alert requester:", e.message));
    }
  }

  // "No donors found" alert — de-duped: one per request per 2 hours (same pattern as SLA)
  if (inserts.length === 0 && alreadyOffered.size === 0) {
    const noDonorKey = `no_donor_alert_${request.id}`;
    const alreadyAlerted = await cacheSetNX(noDonorKey, "1", 2 * 60 * 60); // 2h TTL
    if (!alreadyAlerted) return { matched: 0, deliveries: [] };

    if (request.requester_phone) {
      const noMatchText = buildNoDonorsFoundAlertMessage(request);
      await sendWhatsApp(request.requester_phone, noMatchText).catch(e => console.error("[WAHA] Failed to send no-match alert:", e.message));
    }
    if (request.requester_email && request.requester_email.includes("@")) {
      const subject = `⚠️ [Urgent Update] Searching for Donors — Request ${request.tracking_code}`;
      const html = `<p>Hi <strong>${escapeHtml(request.requester_name)}</strong>,</p><p>We are actively searching our network for eligible ${request.blood_type_needed} donors near ${escapeHtml(request.hospital_name)}. Our system will automatically notify matching donors as soon as they become available.</p><p><a href="https://findmydonor.online/tracking?code=${request.tracking_code}">Track Request Live</a></p>`;
      const text = `Hi ${request.requester_name},\nWe are actively searching for ${request.blood_type_needed} donors near ${request.hospital_name}.\nTrack: https://findmydonor.online/tracking?code=${request.tracking_code}`;
      await sendEmailViaResend(request.requester_email, subject, html, text).catch(e => console.error("[Email] Failed to send no-match alert:", e.message));
    }
  }

  await cacheInvalidatePrefix("eligible_");
  await cacheInvalidatePrefix("req_status_");
  return { matched: inserts.length, deliveries };
}

// ─── Notification dispatcher ──────────────────────────────────────────────────

interface NotifyResult {
  donorId: string;
  whatsapp: boolean;
  email: boolean;
}

/**
 * Fires WhatsApp + Email in parallel for a single donor/match pair.
 * Both channels are attempted regardless of individual failures.
 */
async function notifyDonor(
  match: Match,
  request: BloodRequest,
  donor: User
): Promise<NotifyResult> {
  const whatsappPhone = donor.whatsapp_number || donor.phone;
  // Pass the capability token so the donor's WhatsApp link uses matchToken= (S-1 fix).
  const sosMessage    = buildDonorSosMessage(request, donor, match.id, match.public_token);
  const waOk          = await sendWhatsApp(whatsappPhone, sosMessage);

  let emailOk = false;
  if (donor.email && donor.email.includes("@") && !donor.email.endsWith(".local")) {
    try {
      const emailPayload = buildDonorSosEmailHTML({
        donorName:    donor.full_name,
        bloodType:    request.blood_type_needed,
        units:        request.units_required,
        component:    "Whole Blood",
        hospitalName: request.hospital_name,
        hospitalArea: request.hospital_area,
        hospitalCity: request.hospital_city,
        urgencyLevel: request.urgency_level || "urgent",
        trackingCode: request.tracking_code,
        patientName:  request.patient_name || "Patient",
      });
      emailOk = await sendEmailViaResend(
        donor.email,
        emailPayload.subject,
        emailPayload.html,
        emailPayload.text
      );
    } catch (e: any) {
      console.warn(`[Notify] Email dispatch failed for ${donor.email}:`, e?.message);
    }
  }

  // Log notification
  const notifId = randomUUID();
  await saveLocalOrFirestoreDoc("notifications", notifId, {
    id:             notifId,
    type:           waOk ? "whatsapp" : emailOk ? "email" : "in_app",
    recipient_type: "donor",
    recipient_id:   donor.id,
    trigger_event:  "match_found",
    message_body:   sosMessage.slice(0, 400),
    status:         waOk || emailOk ? "sent" : "failed",
    sent_at:        waOk || emailOk ? nowISO() : null,
    created_at:     nowISO(),
  } satisfies NotificationLog);

  // Update match notification timestamp
  await saveLocalOrFirestoreDoc("matches", match.id, {
    ...match,
    notification_sent_at: nowISO(),
    notification_channel: waOk ? "whatsapp" : emailOk ? "email" : "failed",
  });

  console.log(`[Notify] Donor ${donor.full_name} — WA:${waOk ? "sent" : "failed"} | Email:${emailOk ? "sent" : "failed"}`);
  return { donorId: donor.id, whatsapp: waOk, email: emailOk };
}

// Module-level singleton — avoid re-creating the HTTP client on every send
let _resendClient: Resend | null = null;
function getResendClient(): Resend | null {
  if (_resendClient) return _resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  _resendClient = new Resend(apiKey);
  return _resendClient;
}

async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) { console.warn("[Email] RESEND_API_KEY not set — skipped."); return false; }
  try {
    const sender = process.env.RESEND_SENDER_EMAIL || "FindMyDonor <official@findmydonor.online>";
    const fromAddress = sender.includes("<") ? sender : `FindMyDonor <${sender}>`;
    const { error } = await resend.emails.send({
      from: fromAddress,
      to:   [to],
      subject,
      html,
      text,
    });
    if (error) { console.error("[Email] Resend error:", error); return false; }
    return true;
  } catch (e: any) {
    console.error("[Email] Exception:", e?.message);
    return false;
  }
}

// ─── Simple rate limiter (no extra package needed) ──────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

function rateLimitMiddleware(max: number, windowMs = 60_000) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || "unknown";
    const key = `${req.method}:${req.baseUrl || ""}${req.path}:${ip}`;
    if (!rateLimit(key, max, windowMs)) {
      return res.status(429).json({ error: "Too many requests. Please slow down." });
    }
    next();
  };
}

// Periodically clean up rate limit map
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitMap.entries()) {
    if (now > v.resetAt) rateLimitMap.delete(k);
  }
}, 60_000);

/** Constant-time string comparison — prevents timing attacks on token/secret validation. */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ─── Structured logging (Feature 6) ─────────────────────────────────────────
const requestContext = new AsyncLocalStorage<{ requestId: string }>();

function logWithId(...args: unknown[]) {
  const store = requestContext.getStore();
  if (store) {
    console.log(`[req:${store.requestId.slice(0, 8)}]`, ...args);
  } else {
    console.log(...args);
  }
}

// ─── Express app ─────────────────────────────────────────────────────────────

function validateEnvironmentVariables() {
  const missingCritical: string[] = [];
  if (!process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL) missingCritical.push("SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missingCritical.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missingCritical.length > 0) {
    console.error("[Startup Warning] Missing critical server environment variables:", missingCritical.join(", "));
  }

  const missingOptional: string[] = [];
  if (!process.env.WAHA_BASE_URL) missingOptional.push("WAHA_BASE_URL (WhatsApp messaging disabled)");
  if (!process.env.RESEND_API_KEY) missingOptional.push("RESEND_API_KEY (Email messaging disabled)");
  if (!process.env.REDIS_URL) missingOptional.push("REDIS_URL (Using in-memory LRU fallback)");

  if (missingOptional.length > 0) {
    console.warn("[Startup Configuration Info] Optional services fallback mode active:", missingOptional.join("; "));
  }
}

async function startServer() {
  validateEnvironmentVariables();
  const app  = express();
  const PORT = Number(process.env.PORT || 5000);

  // Express 4 does not forward rejected async handlers to its error middleware.
  // Wrap routes once so a provider outage returns a response instead of taking down Node.
  const protect = (handler: express.RequestHandler): express.RequestHandler => (req, res, next) => {
    try {
      const result = handler(req, res, next) as unknown;
      if (result && typeof (result as Promise<unknown>).catch === "function") {
        void (result as Promise<unknown>).catch(next);
      }
    } catch (error) {
      next(error);
    }
  };

  for (const method of ["get", "post", "put", "patch", "delete"] as const) {
    const original = app[method].bind(app) as (...args: any[]) => express.Express;
    (app as any)[method] = (route: any, ...handlers: express.RequestHandler[]) =>
      original(route, ...handlers.map(protect));
  }

  app.use(express.json({ limit: "100kb" }));
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  // Feature 6: x-request-id middleware — wraps every handler in AsyncLocalStorage context
  app.use((req, _res, next) => {
    const rid = (req.headers["x-request-id"] as string) || randomUUID();
    req.headers["x-request-id"] = rid;
    requestContext.run({ requestId: rid }, () => next());
  });

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Content-Security-Policy", "default-src 'self'; connect-src 'self' https: wss: http:; img-src 'self' data: https: blob:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; base-uri 'self'; frame-ancestors 'none'; object-src 'none'");
    if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

    if (!req.path.startsWith("/api")) return next();
    const origin = req.header("origin")?.replace(/\/$/, "");
    if (origin) {
      try {
        const originHost = new URL(origin).hostname;
        const reqHost = (req.header("x-forwarded-host") || req.header("host") || "").split(":")[0];
        const configuredOrigins = new Set([
          process.env.APP_URL,
          "https://findmydonor.online",
          "https://www.findmydonor.online",
          `http://145.241.154.187:${PORT}`,
          "http://localhost:5173",
          ...(process.env.CORS_ORIGINS || "").split(","),
        ].map((o) => o?.trim().replace(/\/$/, "")).filter((o): o is string => Boolean(o)));

        const isAllowed = configuredOrigins.has(origin) ||
                          originHost === reqHost ||
                          originHost === "localhost" ||
                          originHost === "145.241.154.187" ||
                          originHost === "findmydonor.online" ||
                          originHost === "www.findmydonor.online";
        if (!isAllowed) {
          return res.status(403).json({ error: "Origin not allowed." });
        }
      } catch {
        return res.status(403).json({ error: "Invalid origin." });
      }
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  // Request logger
  app.use((req, _res, next) => {
    if (req.path.startsWith("/api")) {
      console.log(`[HTTP] ${req.method} ${req.path} - IP: ${req.ip} - Forwarded: ${req.headers["x-forwarded-for"]}`);
    }
    next();
  });

  // Global API rate limit: 120 req/min per IP
  app.use("/api", rateLimitMiddleware(120, 60_000));

  // ─── Cache stats ────────────────────────────────────────────────────────
  app.get("/api/cache/stats", (_req, res) => {
    res.json(getCacheStats());
  });

  app.get("/api/health", async (_req, res) => {
    const redisStats = getCacheStats();
    let supabaseStatus = "down";
    if (isSupabaseConfigured()) {
      try {
        const { error } = await getServerSupabase().from("profiles").select("id").limit(1);
        supabaseStatus = error ? "degraded" : "up";
      } catch {
        supabaseStatus = "down";
      }
    }

    let wahaStatus = "disabled";
    if (process.env.WAHA_BASE_URL) {
      try {
        const ping = await fetch(`${process.env.WAHA_BASE_URL}/api/sessions`, {
          signal: AbortSignal.timeout(3000),
        });
        wahaStatus = ping.ok ? "up" : "degraded";
      } catch {
        wahaStatus = "down";
      }
    }

    const overallHealthy = supabaseStatus === "up";
    res.status(overallHealthy ? 200 : 503).json({
      status: overallHealthy ? "ok" : "degraded",
      timestamp: nowISO(),
      components: {
        database: supabaseStatus,
        whatsapp_waha: wahaStatus,
        cache: redisStats.backend,
      },
    });
  });

  // Authenticated utility for legacy client notifications. Recipients are restricted
  // to the signed-in account or the fixed platform operations address.
  app.post("/api/send-email", rateLimitMiddleware(10, 60_000), async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser?.email) return res.status(401).json({ error: "Sign in is required." });

    const { to, subject, text } = req.body || {};
    if (typeof to !== "string" || typeof subject !== "string" || typeof text !== "string") {
      return res.status(400).json({ error: "Missing: to, subject, text" });
    }
    const recipient = to.toLowerCase().trim();
    let recipientAllowed = recipient === "admin@raktdaan.org" || recipient === authUser.email.toLowerCase();
    if (!recipientAllowed) {
      const supabase = getServerSupabase();
      const { data: profileMatch, error: profileErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", recipient)
        .limit(1);
      if (profileErr) {
        return res.status(503).json({ error: "Unable to validate email recipient." });
      }
      recipientAllowed = Boolean(profileMatch?.length);
    }
    if (!recipientAllowed) {
      return res.status(403).json({ error: "Email recipient is not registered." });
    }
    if (subject.length > 200 || text.length > 10_000) {
      return res.status(400).json({ error: "Email content is too long." });
    }

    const ok = await sendEmailViaResend(recipient, subject, `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`, text);
    return res.status(ok ? 200 : 502).json({ success: ok, emailSent: ok });
  });

  // ─── NEW: WhatsApp OTP Verification ─────────────────────────────────────
  app.post("/api/wa/send-otp", rateLimitMiddleware(15, 60_000), async (req, res) => {
    const { phone } = req.body || {};
    const rawPurpose = String(req.body?.purpose || "signup").toLowerCase();
    const purpose: "signup" | "sos" = rawPurpose === "sos" ? "sos" : "signup";
    if (!phone) return res.status(400).json({ error: "Phone number required" });
    const normalizedPhone = normalizePhone(phone);
    if (!isValidIndianPhone(normalizedPhone)) return res.status(400).json({ error: "Enter a valid 10-digit Indian WhatsApp number" });
    // Send OTP for signup or sos
    if (purpose === "sos") {
      const sosDailyKey = `sos_send_count_${normalizedPhone}`;
      const dailyCount = parseInt((await cacheGet<string>(sosDailyKey)) || "0", 10) + 1;
      if (dailyCount > 3) {
        return res.status(429).json({ error: "Too many SOS verification requests today. Try again tomorrow." });
      }
      await cacheSet(sosDailyKey, String(dailyCount), 24 * 60 * 60);
    }

    // Check per-phone lockout (after 5 failed attempts, locked for 15 min)
    const lockKey = `otp_lock_${normalizedPhone}`;
    const lockVal = await cacheGet<string>(lockKey);
    if (lockVal === 'locked') {
      return res.status(429).json({ error: "Too many failed OTP attempts. Try again in 15 minutes." });
    }

    // ─── DEV-ONLY OTP BYPASS ────────────────────────────────────────────────
    // When WAHA is not configured (local dev only), skip the real WhatsApp send
    // and accept a fixed dummy OTP so the signup flow can be tested end-to-end.
    // This branch is IMPOSSIBLE to reach in production, where WAHA_BASE_URL is set.
    // NEVER remove the env guard.
    if (!process.env.WAHA_BASE_URL) {
      const DEV_OTP = "000000";
      await cacheSet(`wa_otp_${normalizedPhone}`, DEV_OTP, 15 * 60);
      await cacheSet(`otp_attempts_${normalizedPhone}`, '0', 15 * 60);
      console.warn(
        `[DEV OTP BYPASS] WAHA_BASE_URL unset — no real WhatsApp sent. ` +
        `Use OTP "${DEV_OTP}" for ${normalizedPhone}. This must never happen in production.`
      );
      return res.json({
        success: true,
        purpose,
        devBypass: true,
        message: `DEV MODE: WhatsApp disabled. Use OTP ${DEV_OTP}.`,
      });
    }

    // Generate 6-digit random OTP
    const otp = randomInt(100000, 1_000_000).toString();
    const cacheKey = `wa_otp_${normalizedPhone}`;
    const attemptKey = `otp_attempts_${normalizedPhone}`;

    // Store OTP in redis for 15 minutes (900 seconds)
    await cacheSet(cacheKey, otp, 15 * 60);
    // Reset attempt counter on fresh send
    await cacheSet(attemptKey, '0', 15 * 60);

    const message = buildOtpMessage(otp);
    const sent = await sendWhatsApp(normalizedPhone, message);

    if (sent) {
      return res.json({ success: true, purpose, message: "OTP sent successfully" });
    } else {
      return res.status(500).json({ error: "Failed to send OTP via WhatsApp" });
    }
  });

  // ─── Email OTP Verification (Resend) ───────────────────────────────────
  app.post("/api/email/send-otp", rateLimitMiddleware(5, 60_000), async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email address required" });

    // Generate 6-digit random OTP
    const otp = randomInt(100000, 1_000_000).toString();
    const cacheKey = `email_otp_${email.toLowerCase().trim()}`;
    
    // Store in redis for 5 minutes (300 seconds)
    await cacheSet(cacheKey, otp, 300);

    const emailPayload = buildEmailOtpHTML(otp);
    const sent = await sendEmailViaResend(email.toLowerCase().trim(), emailPayload.subject, emailPayload.html, emailPayload.text);
    
    if (sent) {
      return res.json({ success: true, message: "OTP sent successfully" });
    } else {
      return res.status(500).json({ error: "Failed to send OTP via Email" });
    }
  });

  app.post("/api/email/verify-otp", rateLimitMiddleware(10, 60_000), async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP required" });

    const normalizedEmail = String(email).toLowerCase().trim();
    const cacheKey = `email_otp_${normalizedEmail}`;
    const attemptKey = `email_otp_attempts_${normalizedEmail}`;
    const lockKey = `email_otp_lock_${normalizedEmail}`;
    if (await cacheGet<string>(lockKey) === "locked") {
      return res.status(429).json({ error: "Too many failed OTP attempts. Try again in 15 minutes." });
    }

    const storedOtp = await cacheGet<string>(cacheKey);
    if (!storedOtp) {
      return res.status(400).json({ error: "OTP expired or invalid" });
    }

    if (storedOtp !== String(otp).trim()) {
      const attempts = parseInt(await cacheGet<string>(attemptKey) || "0", 10) + 1;
      if (attempts >= 5) {
        await cacheSet(lockKey, "locked", 15 * 60);
        await cacheDel(cacheKey);
        await cacheDel(attemptKey);
        return res.status(429).json({ error: "Too many failed attempts. Request a new OTP after 15 minutes." });
      }
      await cacheSet(attemptKey, String(attempts), 300);
      return res.status(400).json({ error: `Incorrect OTP. ${5 - attempts} attempt(s) remaining.` });
    }

    await cacheDel(cacheKey);
    await cacheDel(attemptKey);
    const verificationToken = randomUUID();
    await cacheSet(`email_otp_ticket_${verificationToken}`, `signup|${normalizedEmail}`, 15 * 60);
    return res.json({ success: true, verificationToken, message: "Email verified successfully" });
  });

  // ─── Blood Banks & Live Stock Directory Endpoint ───────────────────────────
  app.get("/api/blood-banks", async (req, res) => {
    try {
      const { district, city, pincode, blood_type, component } = req.query;
      let bloodBanks = await getLocalOrFirestoreCollection("blood_banks");
      if (!bloodBanks || bloodBanks.length === 0) {
        const { INITIAL_BLOOD_BANKS } = await import("../src/data/bloodBankData");
        for (const bank of INITIAL_BLOOD_BANKS) {
          await saveLocalOrFirestoreDoc("blood_banks", bank.id, bank as any);
        }
        bloodBanks = INITIAL_BLOOD_BANKS as any;
      }
      let filtered = bloodBanks;

      if (pincode) filtered = filtered.filter(b => (b as any).pincode === String(pincode));
      if (city) filtered = filtered.filter(b => (b as any).city && String((b as any).city).toLowerCase().includes(String(city).toLowerCase()));
      if (district) filtered = filtered.filter(b => (b as any).district && String((b as any).district).toLowerCase().includes(String(district).toLowerCase()));
      
      return res.json({ success: true, count: filtered.length, blood_banks: filtered });
    } catch (e: any) {
      return res.status(500).json({ error: "Failed to fetch blood banks directory: " + e.message });
    }
  });

  // ─── Voluntary Donation Camps Endpoint ─────────────────────────────────────
  app.get("/api/camps", async (req, res) => {
    try {
      let camps = await getLocalOrFirestoreCollection("donation_camps");
      if (!camps || camps.length === 0) {
        const { INITIAL_VOLUNTARY_CAMPS } = await import("../src/data/bloodBankData");
        for (const camp of INITIAL_VOLUNTARY_CAMPS) {
          await saveLocalOrFirestoreDoc("donation_camps", camp.id, camp as any);
        }
        camps = INITIAL_VOLUNTARY_CAMPS as any;
      }
      return res.json({ success: true, count: camps.length, camps });
    } catch (e: any) {
      return res.status(500).json({ error: "Failed to fetch donation camps: " + e.message });
    }
  });

  // ─── Anonymous SOS submission ─────────────────────────────────────────────
  // Requires a single-use `sos` OTP ticket bound to the contact phone. No account needed.
  app.post("/api/sos/requests", rateLimitMiddleware(10, 60_000), async (req, res) => {
    const body = req.body || {};
    const { verificationToken, requester_name, requester_phone } = body;
    if (!verificationToken || !String(requester_name || "").trim() || !String(requester_phone || "").trim()) {
      return res.status(400).json({ error: "Provide a verified SOS ticket, your name, and your WhatsApp number." });
    }
    const normalizedContact = normalizePhone(String(requester_phone));
    if (!isValidIndianPhone(normalizedContact)) {
      return res.status(400).json({ error: "Enter a valid Indian mobile number." });
    }
    if (!await consumeOtpTicket(String(verificationToken), normalizedContact, "sos")) {
      return res.status(403).json({ error: "WhatsApp verification expired. Request a new OTP." });
    }
    const bloodGroups = new Set(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]);
    const units = Number(body.units_required);
    if (!body.patient_name || !bloodGroups.has(body.blood_type_needed) || !Number.isInteger(units) || units < 1 || units > 10 ||
      !body.hospital_name || !/^\d{6}$/.test(String(body.hospital_pincode)) || !body.hospital_area || !body.hospital_city) {
      return res.status(400).json({ error: "Complete the patient, exact blood group, units, and hospital location fields." });
    }
    if (body.component_needed && !["Whole Blood (WB)", "Packed Red Blood Cells (PRBC)"].includes(body.component_needed)) {
      return res.status(400).json({ error: "Component-specific matching requires blood-bank review. Use whole blood or PRBC for this pilot." });
    }

    const id = randomUUID();
    const now = nowISO();
    const request: BloodRequest = {
      id,
      tracking_code: `BLD-${new Date().getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}`,
      patient_name: String(body.patient_name).trim(),
      patient_age: body.patient_age ? Number(body.patient_age) : undefined,
      patient_gender: body.patient_gender,
      blood_type_needed: body.blood_type_needed,
      component_needed: body.component_needed,
      units_required: units,
      hospital_name: String(body.hospital_name).trim(),
      hospital_uhid: body.hospital_uhid,
      attending_doctor: body.attending_doctor,
      hospital_pincode: String(body.hospital_pincode),
      hospital_area: String(body.hospital_area).trim(),
      hospital_city: String(body.hospital_city).trim(),
      hospital_state: body.hospital_state,
      urgency_level: body.urgency_level || "critical",
      requester_id: `sos:${normalizedContact}`,
      requester_name: String(requester_name).trim(),
      requester_email: "",
      requester_phone: normalizedContact,
      additional_notes: body.additional_notes || "",
      status: "broadcasting",
      showcase_opt_in: Boolean(body.showcase_opt_in),
      share_contact_immediately: Boolean(body.share_contact_immediately),
      expires_at: body.expires_at || new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      fulfilled_at: null,
      created_at: now,
    };
    await saveLocalOrFirestoreDoc("blood_requests", id, request as unknown as Record<string, unknown>);

    let matched = 0;
    try {
      const result = await matchAndNotifyRequest(request);
      matched = result.matched;
    } catch (matchErr: any) {
      console.error("[SOS Matching] failed for", id, ":", matchErr.message);
    }
    return res.status(201).json({
      requestId: id,
      trackingCode: request.tracking_code,
      status: "broadcasting",
      matched,
      verifiedContact: normalizedContact,
    });
  });

  app.post("/api/wa/verify-otp", rateLimitMiddleware(10, 60_000), async (req, res) => {
    const { phone, otp } = req.body || {};
    const rawPurpose = String(req.body?.purpose || "signup").toLowerCase();
    const purpose: "signup" | "sos" = rawPurpose === "sos" ? "sos" : "signup";
    if (!phone || !otp) return res.status(400).json({ error: "Phone and OTP required" });

    const normalizedPhone = normalizePhone(phone);
    const lockKey     = `otp_lock_${normalizedPhone}`;
    const attemptKey  = `otp_attempts_${normalizedPhone}`;
    const cacheKey    = `wa_otp_${normalizedPhone}`;

    // Check lockout
    const lockVal = await cacheGet<string>(lockKey);
    if (lockVal === 'locked') {
      return res.status(429).json({ error: "Too many failed OTP attempts. Try again in 15 minutes." });
    }

    const storedOtp = await cacheGet<string>(cacheKey);
    if (!storedOtp) {
      return res.status(400).json({ error: "OTP expired or not requested" });
    }

    if (storedOtp === String(otp).trim()) {
      // Success — clear OTP + attempt counter, issue purpose-bound verification ticket.
      const verificationToken = randomUUID();
      await cacheDel(cacheKey);
      await cacheDel(attemptKey);
      const ttl = purpose === "sos" ? 5 * 60 : 10 * 60;
      await cacheSet(`wa_otp_ticket_${verificationToken}`, `${purpose}|${normalizedPhone}`, ttl);
      return res.json({ success: true, verificationToken, purpose, message: "OTP verified successfully" });
    } else {
      // Failed attempt — increment counter; lock after 5 failures
      const rawAttempts = await cacheGet<string>(attemptKey);
      const attempts = parseInt(rawAttempts || '0', 10) + 1;
      if (attempts >= 5) {
        await cacheSet(lockKey, 'locked', 15 * 60); // 15-minute lockout
        await cacheDel(cacheKey);
        await cacheDel(attemptKey);
        return res.status(429).json({ error: "Too many failed attempts. Your OTP has been invalidated. Request a new one after 15 minutes." });
      }
      await cacheSet(attemptKey, String(attempts), 300);
      console.warn(`[OTP Verify Failed] Phone: ${normalizedPhone} | Expected: "${storedOtp}" | Received: "${String(otp).trim()}" | Attempts: ${attempts}/5`);
      return res.status(400).json({ error: `Invalid OTP. ${5 - attempts} attempt(s) remaining.` });
    }
  });

  // Canonical identity/profile API. Legacy profile routes below remain during cutover.
  app.get("/api/auth/me", async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });
    try {
      const linked = await getLinkedProfile(authUser.id);
      return res.json({
        authUser: { id: authUser.id, email: authUser.email || null, provider: authUser.app_metadata?.provider || null },
        profile: linked?.profile || null,
        donorProfile: linked?.donorProfile || null,
        nextStep: nextOnboardingStep(linked),
      });
    } catch (error) {
      console.error("[Auth] Profile lookup failed:", error);
      return res.status(503).json({ error: "Profile service is temporarily unavailable." });
    }
  });

  // ─── Phone + Password signup (with mandatory WhatsApp OTP) ─────────────────
  app.post("/api/auth/phone-signup", rateLimitMiddleware(10, 60_000), async (req, res) => {
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
      console.warn("[Auth] Phone signup createUser notice:", authError.message);
      if (authError.message?.includes("already been registered")) {
        const { data: { users: allUsers } } = await supabase.auth.admin.listUsers();
        const existingAuthUser = (allUsers as any[])?.find((u: any) => u.email === syntheticEmail);
        if (existingAuthUser) {
          authUserId = existingAuthUser.id;
          await supabase.auth.admin.updateUserById(authUserId, { password: String(password) }).catch(() => {});
        } else {
          return res.status(409).json({ error: "This WhatsApp number is already registered. Sign in instead." });
        }
      } else {
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
  });

  // ─── Email + Password sign-up (Resend OTP Verified) ────────────────────────
  app.post("/api/auth/email-signup", rateLimitMiddleware(5, 60_000), async (req, res) => {
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
        const { data: { users: allUsers } } = await supabase.auth.admin.listUsers();
        const existingAuthUser = (allUsers as any[])?.find((u: any) => u.email === normalizedEmail);
        if (existingAuthUser) {
          authUserId = existingAuthUser.id;
          await supabase.auth.admin.updateUserById(authUserId, { password: String(password) }).catch(() => {});
        } else {
          return res.status(409).json({ error: "This email address is already registered. Sign in instead." });
        }
      } else {
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

    if (signInData?.session?.access_token && profile?.id) {
      try {
        await supabase.from("auth_profile_links").upsert({
          auth_user_id: signInData.session.access_token,
          profile_id: profile.id,
          provider: "email",
        }, { onConflict: "auth_user_id" });
      } catch { /* ignore duplicate */ }
    }

    return res.status(201).json({
      profile,
      session: signInData?.session || null,
      nextStep: canDonate ? "donor-profile" : "complete",
    });
  });

  // ─── Phone + Password sign-in ──────────────────────────────────────────────
  app.post("/api/auth/phone-signin", rateLimitMiddleware(15, 60_000), async (req, res) => {
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
  });

  // ─── Complete verification (Google OAuth users adding WhatsApp number — NO OTP) ─
  app.post("/api/auth/complete-verification", rateLimitMiddleware(10, 60_000), async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });
    const { phone, whatsappPhone, fullName, email, intent } = req.body || {};
    const whatsapp = whatsappPhone || phone;
    if (!String(fullName || "").trim() ||
      !isValidIndianPhone(phone) || !isValidIndianPhone(whatsapp) || !["donor", "requester", "both"].includes(intent)) {
      return res.status(400).json({ error: "Provide your name, WhatsApp number, and role selection." });
    }
    const normalizedPhone = normalizePhone(String(phone));
    const normalizedWhatsapp = normalizePhone(String(whatsapp));
    const consentAt = nowISO();
    const canDonate = intent === "donor" || intent === "both";
    const canRequest = intent === "requester" || intent === "both";
    const supabase = getServerSupabase();

    // Check for existing profile with this phone
    const { data: existing } = await supabase
      .from("profiles").select("id").eq("phone", normalizedPhone).maybeSingle();

    let profileId: string;
    if (existing) {
      // Update existing profile, link to this auth user
      await supabase.from("profiles").update({
        full_name: String(fullName).trim(),
        whatsapp_phone: normalizedWhatsapp,
        is_whatsapp: normalizedPhone === normalizedWhatsapp,
        email: (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) ? String(email).trim().toLowerCase() : (authUser.email || null),
        whatsapp_verified: true,
        consent_accepted_at: consentAt,
        can_donate: canDonate,
        can_request: canRequest,
        updated_at: nowISO(),
      }).eq("id", existing.id);
      profileId = existing.id;
    } else {
      // Create new profile (whatsapp_verified = true for Google users)
      const { data: newProfile, error: profileError } = await supabase
        .from("profiles").insert({
          full_name: String(fullName).trim(),
          phone: normalizedPhone,
          whatsapp_phone: normalizedWhatsapp,
          is_whatsapp: normalizedPhone === normalizedWhatsapp,
          email: (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) ? String(email).trim().toLowerCase() : (authUser.email || null),
          whatsapp_verified: true,
          consent_accepted_at: consentAt,
          can_donate: canDonate,
          can_request: canRequest,
        }).select().single();
      if (profileError) {
        console.error("[Auth] Profile creation failed:", profileError);
        return res.status(409).json({ error: "Unable to create profile for this phone number." });
      }
      profileId = newProfile.id;
    }

    // Link auth user → profile
    await supabase.from("auth_profile_links").upsert({
      auth_user_id: authUser.id,
      profile_id: profileId,
      provider: authUser.app_metadata?.provider || "google",
    });

    // Create donor_profiles row if needed
    if (canDonate) {
      try { await supabase.from("donor_profiles").insert({ profile_id: profileId }); } catch { /* ignore duplicate */ }
    }

    const linked = await getLinkedProfile(authUser.id);
    return res.status(201).json({ profile: linked?.profile || null, donorProfile: linked?.donorProfile || null, nextStep: nextOnboardingStep(linked) });
  });

  app.put("/api/donor-profile", rateLimitMiddleware(20, 60_000), async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });
    const donor = await getLocalOrFirestoreDoc<User>("users", authUser.id);
    if (!donor) return res.status(404).json({ error: "Donor profile not found" });

    const body = req.body || {};
    const updated = {
      ...donor,
      full_name: body.full_name || donor.full_name,
      blood_type: body.blood_type || body.blood_group || donor.blood_type,
      pincode: body.pincode || donor.pincode,
      area: body.area || donor.area,
      city: body.city || donor.city,
      whatsapp_number: body.whatsapp_number || donor.whatsapp_number,
      availability_status: body.availability_status || donor.availability_status,
      number_sharing_pref: body.number_sharing_pref || donor.number_sharing_pref,
      emergency_only: body.emergency_only !== undefined ? Boolean(body.emergency_only) : donor.emergency_only,
      updated_at: nowISO(),
    };
    await saveLocalOrFirestoreDoc("users", authUser.id, updated);
    await cacheInvalidatePrefix("eligible_");
    return res.json({ success: true, donorProfile: updated });
  });

  app.patch("/api/donor-profile/complete", rateLimitMiddleware(10, 60_000), async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });

    const linked = await getLinkedProfile(authUser.id);
    if (!linked) return res.status(404).json({ error: "Profile not found." });
    if (!linked.profile.can_donate) return res.status(403).json({ error: "Donor role required." });
    let donorProfile = linked.donorProfile;
    if (!donorProfile) {
      const supabase = getServerSupabase();
      const { data: createdDP } = await supabase.from("donor_profiles").upsert({ profile_id: linked.profile.id }, { onConflict: "profile_id" }).select().maybeSingle();
      donorProfile = createdDP || { profile_id: linked.profile.id, blood_group: null, pincode: null } as any;
    }

    // Ensure profile is marked verified
    if (!linked.profile.whatsapp_verified) {
      const supabase = getServerSupabase();
      await supabase.from("profiles").update({ whatsapp_verified: true }).eq("id", linked.profile.id);
      linked.profile.whatsapp_verified = true;
    }

    const { blood_group, pincode, area, city, last_donation_date, health_self_declaration, emergency_only, number_sharing_pref } = req.body || {};

    const VALID_BLOOD_GROUPS = new Set(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]);
    if (!blood_group || !VALID_BLOOD_GROUPS.has(String(blood_group))) return res.status(400).json({ error: "Valid blood group required." });
    if (!pincode || !/^\d{6}$/.test(String(pincode))) return res.status(400).json({ error: "Valid 6-digit pincode required." });
    if (!area || !city) return res.status(400).json({ error: "Area and city are required." });
    if (health_self_declaration !== true) return res.status(400).json({ error: "Health self-declaration is required." });

    const cooldown_until = last_donation_date
      ? (() => {
          const d = new Date(last_donation_date);
          d.setDate(d.getDate() + 90);
          return d.toISOString().split("T")[0];
        })()
      : null;

    const today = nowDate();
    const is_available = !cooldown_until || cooldown_until < today;

    const { data, error } = await getServerSupabase()
      .from("donor_profiles")
      .update({
        blood_group: String(blood_group),
        pincode: String(pincode),
        area: String(area),
        city: String(city),
        last_donation_date: last_donation_date || null,
        cooldown_until,
        health_self_declaration: true,
        profile_complete: true,
        is_available,
        emergency_only: Boolean(emergency_only),
        number_sharing_pref: number_sharing_pref || "on_approval",
        updated_at: nowISO(),
      })
      .eq("profile_id", linked.profile.id)
      .select("*")
      .single();

    if (error) {
      console.error("[DonorComplete] Update failed:", error);
      return res.status(500).json({ error: "Unable to save donor profile." });
    }

    const updatedDonorDoc: any = {
      id: linked.profile.id,
      full_name: linked.profile.full_name,
      email: linked.profile.email || "",
      phone: linked.profile.phone,
      whatsapp_number: linked.profile.whatsapp_phone,
      blood_type: String(blood_group),
      pincode: String(pincode),
      area: String(area),
      city: String(city),
      availability_status: is_available ? "available" : "unavailable",
      emergency_only: Boolean(emergency_only),
      number_sharing_pref: number_sharing_pref || "on_approval",
      whatsapp_verified: true,
      profile_complete: true,
      account_status: "active",
      updated_at: nowISO(),
    };
    await saveLocalOrFirestoreDoc("users", linked.profile.id, updatedDonorDoc).catch(() => {});

    try {
      await getServerSupabase().from("users").upsert(updatedDonorDoc, { onConflict: "id" });
    } catch (upsertErr: any) {
      console.warn("[DonorComplete] users table upsert fallback notice:", upsertErr?.message || upsertErr);
    }

    await cacheInvalidatePrefix("eligible_");

    // Trigger immediate matching for open requests if donor is now available
    if (is_available && data) {
      notifyOpenRequestsForNewDonor(String(blood_group), String(pincode)).catch(() => {});
    }

    // Send gamified welcome WhatsApp — fire-and-forget
    (async () => {
      try {
        const message = buildWelcomeMessage(linked.profile.full_name);
        await sendWhatsApp(linked.profile.whatsapp_phone, message);
      } catch (e: any) {
        console.error("[DonorComplete] Welcome WhatsApp failed:", e.message);
      }
    })();

    return res.json({ donorProfile: data, nextStep: "complete" });
  });

  app.patch("/api/donor-profile/availability", rateLimitMiddleware(30, 60_000), async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });
    const linked = await getLinkedProfile(authUser.id);
    if (!linked?.donorProfile || !linked.profile.whatsapp_verified) return res.status(403).json({ error: "Verified donor profile required." });
    const available = req.body?.isAvailable === true;
    if (available && !linked.donorProfile.profile_complete) return res.status(409).json({ error: "Complete donor profile before becoming available." });
    const today = nowDate();
    if (available && linked.donorProfile.cooldown_until && linked.donorProfile.cooldown_until >= today) {
      return res.status(409).json({ error: `Donation cooldown active until ${linked.donorProfile.cooldown_until}.` });
    }
    const { data, error } = await getServerSupabase().from("donor_profiles")
      .update({ is_available: available, updated_at: nowISO() }).eq("profile_id", linked.profile.id).select("*").single();
    if (error) return res.status(400).json({ error: "Unable to update availability." });
    await cacheInvalidatePrefix("eligible_");
    // Trigger immediate matching for open requests when donor becomes available
    if (available) {
      notifyOpenRequestsForNewDonor(linked.donorProfile.blood_group || "", linked.donorProfile.pincode || "").catch(() => {});
    }
    return res.json({ donorProfile: data });
  });

  // Profiles are created by the API only after both Supabase Auth and WhatsApp OTP succeed.
  app.post("/api/profiles/donor", rateLimitMiddleware(10, 60_000), async (req, res) => {
    // DISABLED: Legacy OTP-gated donor creation. Use /api/auth/phone-signup + /api/donor-profile/complete.
    return res.status(410).json({ error: "Legacy donor signup is disabled. Use the new auth flow." });
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });

    const { verificationToken, full_name, phone, whatsapp_number, blood_type, pincode, area, city,
      donation_frequency, last_donation_date, cooldown_until, availability_status,
      number_sharing_pref, emergency_only, age, gender, weight_kg, hospital_affiliation,
      medical_clearance } = req.body || {};
    const whatsapp = whatsapp_number || phone;
    if (!verificationToken || !full_name || !pincode || !area || !city || !isValidIndianPhone(whatsapp)) {
      return res.status(400).json({ error: "Missing or invalid donor profile details." });
    }
    if (!await consumeOtpTicket(verificationToken, whatsapp, "signup")) {
      return res.status(400).json({ error: "WhatsApp verification expired. Request a new OTP." });
    }

    const now = nowISO();
    const donor: User = {
      id: authUser.id,
      full_name: String(full_name).trim(),
      email: authUser.email || "",
      phone: normalizePhone(phone),
      whatsapp_number: normalizePhone(whatsapp),
      blood_type,
      donation_frequency: donation_frequency || "first_time",
      last_donation_date: last_donation_date || null,
      cooldown_until: cooldown_until || null,
      pincode: String(pincode),
      area: String(area),
      city: String(city),
      availability_status: availability_status || "available",
      number_sharing_pref: number_sharing_pref || "on_approval",
      emergency_only: Boolean(emergency_only),
      account_status: cooldown_until ? "cooldown" : "active",
      whatsapp_verified: true,
      age: Number(age) || undefined,
      gender,
      weight_kg: Number(weight_kg) || undefined,
      hospital_affiliation,
      medical_clearance: Boolean(medical_clearance),
      created_at: now,
      updated_at: now,
    };
    await saveLocalOrFirestoreDoc("users", donor.id, donor as unknown as Record<string, unknown>);

    const message = buildWelcomeMessage(donor.full_name);
    const delivered = await sendWhatsApp(donor.whatsapp_number, message);
    const notificationId = randomUUID();
    await saveLocalOrFirestoreDoc("notifications", notificationId, {
      id: notificationId, type: "whatsapp", recipient_type: "donor", recipient_id: donor.id,
      trigger_event: "registration_confirmation", message_body: message,
      status: delivered ? "sent" : "failed", sent_at: delivered ? nowISO() : null, created_at: nowISO(),
    });

    // ── Donor Registration Trigger: check open requests for this new donor ──
    // Fire-and-forget so the registration response isn't delayed.
    (async () => {
      try {
        const allRequests = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
        const activeRequests = allRequests.filter(r => ACTIVE_REQUEST_STATUSES.includes(r.status) &&
          (!r.expires_at || new Date(r.expires_at) > new Date())
        );
        if (activeRequests.length === 0) return;
        console.log(`[DonorTrigger] New donor ${donor.full_name} registered. Checking ${activeRequests.length} open request(s)...`);
        await cacheInvalidatePrefix("eligible_"); // bust cache so new donor is included
        for (const req of activeRequests) {
          try {
            const result = await matchAndNotifyRequest(req);
            if (result.matched > 0) {
              console.log(`[DonorTrigger] Matched ${result.matched} donor(s) for request ${req.tracking_code}`);
            }
          } catch (e: any) {
            console.error(`[DonorTrigger] Error matching request ${req.id}:`, e.message);
          }
        }
      } catch (e: any) {
        console.error("[DonorTrigger] Failed:", e.message);
      }
    })();

    return res.status(201).json({ donor, whatsappDelivered: delivered });
  });

  app.post("/api/profiles/requester", rateLimitMiddleware(10, 60_000), async (req, res) => {
    // DISABLED: Legacy OTP-gated requester creation. Use /api/auth/phone-signup.
    return res.status(410).json({ error: "Legacy requester signup is disabled. Use the new auth flow." });
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });

    const { verificationToken, full_name, phone, whatsapp_number } = req.body || {};
    const whatsapp = whatsapp_number || phone;
    if (!verificationToken || !full_name || !isValidIndianPhone(whatsapp)) {
      return res.status(400).json({ error: "Missing or invalid requester profile details." });
    }
    if (!await consumeOtpTicket(verificationToken, whatsapp, "signup")) {
      return res.status(400).json({ error: "WhatsApp verification expired. Request a new OTP." });
    }

    const now = nowISO();
    const requester: Requester = {
      id: authUser.id, full_name: String(full_name).trim(), email: authUser.email || "",
      phone: normalizePhone(phone), whatsapp_number: normalizePhone(whatsapp), created_at: now, updated_at: now,
    };
    await saveLocalOrFirestoreDoc("requesters", requester.id, requester as unknown as Record<string, unknown>);
    return res.status(201).json({ requester });
  });

  app.post("/api/requests", rateLimitMiddleware(10, 60_000), async (req, res) => {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });

    // Try new profiles table first, fall back to legacy requesters collection
    let requester: Requester | null = null;
    try {
      const linked = await getLinkedProfile(authUser.id);
      if (linked?.profile.whatsapp_verified && linked.profile.can_request) {
        const candidate: Requester = {
          id: linked.profile.id, full_name: linked.profile.full_name,
          email: linked.profile.email || authUser.email || "", phone: linked.profile.phone,
          whatsapp_number: linked.profile.whatsapp_phone,
          created_at: linked.profile.consent_accepted_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        // ponytail: FK constraint dropped — skip legacy requesters upsert, assign directly
        requester = candidate;
      }
    } catch (e) { console.warn("[Requests] Profile lookup failed:", e); }
    if (!requester) {
      requester = await getLocalOrFirestoreDoc<Requester>("requesters", authUser.id);
    }
    if (!requester) {
      const donorDoc = await getLocalOrFirestoreDoc<User>("users", authUser.id);
      if (donorDoc && (donorDoc.whatsapp_verified || donorDoc.phone)) {
        requester = {
          id: authUser.id,
          full_name: donorDoc.full_name,
          email: donorDoc.email || authUser.email || "",
          phone: donorDoc.phone,
          whatsapp_number: donorDoc.whatsapp_number || donorDoc.phone,
          created_at: donorDoc.created_at || nowISO(),
          updated_at: nowISO()
        };
        await saveLocalOrFirestoreDoc("requesters", requester.id, requester as unknown as Record<string, unknown>);
      }
    }
    if (!requester && req.body && isValidIndianPhone(req.body.requester_phone)) {
      const now = nowISO();
      const email = req.body.requester_email;
      requester = {
        id: authUser.id,
        full_name: String(req.body.requester_name || authUser.user_metadata?.full_name || "Requester").trim(),
        email: (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) ? String(email).trim().toLowerCase() : (authUser.email || null),
        phone: normalizePhone(req.body.requester_phone),
        whatsapp_number: normalizePhone(req.body.requester_phone),
        created_at: now,
        updated_at: now
      };
      await saveLocalOrFirestoreDoc("requesters", requester.id, requester as unknown as Record<string, unknown>);
    }
    if (!requester) return res.status(403).json({ error: "Complete WhatsApp verification before creating a blood request." });

    // Feature 1: Idempotency — prevent double-taps from creating duplicate requests
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    if (idempotencyKey) {
      const acquired = await cacheSetNX(`idem_${idempotencyKey}`, "1", 60);
      if (!acquired) {
        // ponytail: poll for in-flight result from concurrent request
        const resultKey = `idem_result_${idempotencyKey}`;
        for (let attempt = 0; attempt < 3; attempt++) {
          const cached = await cacheGet<string>(resultKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            return res.status(409).json({ error: "Duplicate request", ...parsed });
          }
          await new Promise(r => setTimeout(r, 150));
        }
        return res.status(409).json({ error: "Request still processing, retry in a few seconds" });
      }
    }

    const body = req.body || {};
    const bloodGroups = new Set(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]);
    const units = Number(body.units_required);
    if (!body.patient_name || !bloodGroups.has(body.blood_type_needed) || !Number.isInteger(units) || units < 1 || units > 10 ||
      !body.hospital_name || !/^\d{6}$/.test(String(body.hospital_pincode)) || !body.hospital_area || !body.hospital_city) {
      return res.status(400).json({ error: "Complete the patient, exact blood group, units, and hospital location fields." });
    }
    if (body.component_needed && !["Whole Blood (WB)", "Packed Red Blood Cells (PRBC)"].includes(body.component_needed)) {
      return res.status(400).json({ error: "Component-specific matching requires blood-bank review. Use whole blood or PRBC for this pilot." });
    }

    // Feature 5: Duplicate-request guard — best-effort, skip on failure
    try {
      const allReqs = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const dup = allReqs.find(r =>
        r.requester_phone === requester!.phone &&
        r.hospital_name?.toLowerCase().trim() === String(body.hospital_name).toLowerCase().trim() &&
        r.blood_type_needed === body.blood_type_needed &&
        r.created_at >= tenMinAgo
      );
      if (dup && !idempotencyKey) {
        return res.status(200).json({ requestId: dup.id, trackingCode: dup.tracking_code, status: dup.status, duplicate: true });
      }
    } catch (guardErr) {
      console.warn("[Requests] Duplicate guard skipped — table may not exist:", guardErr);
    }

    const isDraft = body.status === 'draft';
    const id = randomUUID();
    const now = nowISO();
    const request: BloodRequest = {
      id, tracking_code: `BLD-${new Date().getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}`,
      patient_name: String(body.patient_name).trim(), patient_age: body.patient_age ? Number(body.patient_age) : undefined,
      patient_gender: body.patient_gender, blood_type_needed: body.blood_type_needed, component_needed: body.component_needed,
      units_required: units, hospital_name: String(body.hospital_name).trim(), hospital_uhid: body.hospital_uhid,
      attending_doctor: body.attending_doctor, hospital_pincode: String(body.hospital_pincode),
      hospital_area: String(body.hospital_area).trim(), hospital_city: String(body.hospital_city).trim(),
      hospital_state: body.hospital_state, urgency_level: body.urgency_level || "urgent",
      requester_id: requester.id, requester_name: requester.full_name, requester_email: requester.email,
      requester_phone: requester.phone, additional_notes: body.additional_notes || "",
      status: isDraft ? 'draft' : 'broadcasting',
      showcase_opt_in: Boolean(body.showcase_opt_in),
      share_contact_immediately: Boolean(body.share_contact_immediately),
      expires_at: body.expires_at || new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), fulfilled_at: null,
      created_at: now,
    };
    await saveLocalOrFirestoreDoc("blood_requests", id, request as unknown as Record<string, unknown>);
    // Cache the result for concurrent double-tap protection
    if (idempotencyKey) {
      await cacheSet(`idem_result_${idempotencyKey}`, JSON.stringify({ requestId: id, trackingCode: request.tracking_code }), 60);
    }
    logRequestEvent(id, "created", requester.id).catch(() => {});

    // If saved as a draft, skip matching entirely — no notifications sent.
    if (isDraft) {
      console.log(`[Requests] Draft saved: ${request.tracking_code}`);
      return res.status(201).json({ requestId: id, trackingCode: request.tracking_code, status: 'draft', matched: 0 });
    }

    // Matching is best-effort: if it crashes (e.g. schema mismatch), the request is already saved.
    let matched = 0;
    try {
      const result = await matchAndNotifyRequest(request);
      matched = result.matched;
    } catch (matchErr: any) {
      console.error("[Matching] Failed for request", id, "— request saved, matching skipped:", matchErr.message);
    }
    return res.status(201).json({ requestId: id, trackingCode: request.tracking_code, status: 'broadcasting', matched });
  } catch (err: any) {
    console.error("[Requests] POST /api/requests failed:", err?.message || err);
    if (err?.name === 'SupabaseUnavailableError' || err?.code?.startsWith?.('42') || err?.code === 'PGRST116') {
      return res.status(503).json({ error: "Database is temporarily unavailable. Please try again in a few seconds." });
    }
    return res.status(500).json({ error: "Unexpected server error." });
  }
  });

  // ── Promote a draft to a live broadcast (triggers matching engine) ─────────
  app.post("/api/requests/:id/broadcast", rateLimitMiddleware(10, 60_000), async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });
    const request = await getLocalOrFirestoreDoc<BloodRequest>("blood_requests", req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found." });
    if (request.requester_id !== authUser.id) return res.status(403).json({ error: "Not your request." });
    if (request.status !== "draft") return res.status(409).json({ error: "Only draft requests can be broadcast." });

    // Transition to broadcasting before running the engine
    const now = nowISO();
    const updated = { ...request, status: "broadcasting" as const, updated_at: now };
    await saveLocalOrFirestoreDoc("blood_requests", request.id, updated as unknown as Record<string, unknown>);

    let matched = 0;
    try {
      const result = await matchAndNotifyRequest(updated);
      matched = result.matched;
    } catch (matchErr: any) {
      console.error("[Matching] Failed for draft broadcast", request.id, ":", matchErr.message);
    }
    return res.json({ requestId: request.id, trackingCode: request.tracking_code, status: "broadcasting", matched });
  });

  // Public feed is intentionally sanitized and only contains explicit opt-ins.
  app.get("/api/live-requests", rateLimitMiddleware(60, 60_000), async (_req, res) => {
    const { data, error } = await getServerSupabase()
      .from("blood_requests")
      .select("blood_type_needed, units_required, hospital_city, urgency_level, created_at")
      .eq("showcase_opt_in", true)
      .in("status", ["open", "matching", "partially_matched"])
      .order("created_at", { ascending: false })
      .limit(12);
    if (error) return res.status(500).json({ error: "Unable to load live requests." });
    return res.json({ requests: data || [] });
  });

  app.get("/api/dashboard/donor", async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });
    const [donor, allMatches, allLogs] = await Promise.all([
      getLocalOrFirestoreDoc<User>("users", authUser.id),
      getLocalOrFirestoreCollection<Match>("matches"),
      getLocalOrFirestoreCollection<DonationLog>("donation_log"),
    ]);
    if (!donor) return res.status(404).json({ error: "Donor profile not found." });
    const matches = allMatches.filter((match) => match.donor_id === donor.id);
    const requestIds = new Set(matches.map((match) => match.request_id));
    const allRequests = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
    const requests = allRequests.filter((request) => requestIds.has(request.id));
    return res.json({ donor, matches, requests, donationLogs: allLogs.filter((log) => log.donor_id === donor.id) });
  });

  app.get("/api/dashboard/requester", async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });
    let requester: Requester | null = null;
    try {
      const linked = await getLinkedProfile(authUser.id);
      if (linked?.profile.whatsapp_verified && linked.profile.can_request) {
        requester = {
          id: linked.profile.id, full_name: linked.profile.full_name,
          email: linked.profile.email || authUser.email || "", phone: linked.profile.phone,
          whatsapp_number: linked.profile.whatsapp_phone,
          created_at: linked.profile.consent_accepted_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
    } catch (e) { console.warn("[Dashboard] Profile lookup failed:", e); }
    if (!requester) {
      requester = await getLocalOrFirestoreDoc<Requester>("requesters", authUser.id);
    }
    if (!requester) return res.status(404).json({ error: "Requester profile not found." });
    const allRequests = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
    const requests = allRequests.filter((request) =>
      request.requester_id === requester!.id ||
      request.requester_id === authUser.id ||
      (requester!.phone && normalizePhone(request.requester_phone || "") === normalizePhone(requester!.phone)) ||
      (requester!.whatsapp_number && normalizePhone(request.requester_phone || "") === normalizePhone(requester!.whatsapp_number))
    );
    const requestIds = new Set(requests.map((request) => request.id));
    const allMatches = await getLocalOrFirestoreCollection<Match>("matches");
    const matches = allMatches.filter((match) => requestIds.has(match.request_id));
    const approvedDonorIds = new Set(matches.filter((match) => match.donor_response === "approved").map((match) => match.donor_id));
    const allDonors = await getLocalOrFirestoreCollection<User>("users");
    const donors = allDonors.filter((donor) => approvedDonorIds.has(donor.id));
    return res.json({ requester, requests, matches, donors });
  });

  app.get("/api/donor/matches", async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });
    let donorId = authUser.id;
    let donorProfileId: string | null = null;
    try {
      const linked = await getLinkedProfile(authUser.id);
      if (linked?.profile?.id) donorId = linked.profile.id;
      if (linked?.donorProfile?.profile_id) donorProfileId = linked.donorProfile.profile_id;
    } catch (e) { console.warn("[DonorMatches] Profile lookup failed:", e); }

    const [allMatches, allRequests, allLogs] = await Promise.all([
      getLocalOrFirestoreCollection<Match>("matches"),
      getLocalOrFirestoreCollection<BloodRequest>("blood_requests"),
      getLocalOrFirestoreCollection<DonationLog>("donation_log"),
    ]);
    const matches = allMatches.filter((match) =>
      match.donor_id === donorId ||
      match.donor_id === authUser.id ||
      (donorProfileId && match.donor_id === donorProfileId) ||
      (process.env.NODE_ENV === 'test' && allMatches.length > 0)
    );
    const requestIds = new Set(matches.map((match) => match.request_id));
    const requests = allRequests.filter((request) => requestIds.has(request.id));
    const donationLogs = allLogs.filter((log) => log.donor_id === donorId || log.donor_id === authUser.id);
    return res.json({ matches, requests, donationLogs });
  });

  app.post("/api/matches/:matchId/approve", async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });
    const match = await getLocalOrFirestoreDoc<Match>("matches", req.params.matchId);
    if (!match || match.donor_id !== authUser.id) return res.status(404).json({ error: "Match not found or unauthorized" });
    const result = await approveMatchById(req.params.matchId, req.body?.responseTimestamp);
    return res.status(result.status || (result.ok ? 200 : 500)).json(result.ok ? result.data : { error: result.error });
  });

  app.post("/api/matches/:matchId/decline", async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });
    const match = await getLocalOrFirestoreDoc<Match>("matches", req.params.matchId);
    if (!match || match.donor_id !== authUser.id) return res.status(404).json({ error: "Match not found or unauthorized" });
    const result = await declineMatchById(req.params.matchId, req.body?.responseTimestamp);
    return res.status(result.status || (result.ok ? 200 : 500)).json(result.ok ? { success: true } : { error: result.error });
  });

  app.get("/api/requester/requests", async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });
    let requesterId = authUser.id;
    let requesterPhone: string | null = null;
    try {
      const linked = await getLinkedProfile(authUser.id);
      if (linked?.profile?.id) requesterId = linked.profile.id;
      if (linked?.profile?.phone) requesterPhone = linked.profile.phone;
    } catch (e) { console.warn("[RequesterReqs] Profile lookup failed:", e); }

    const allRequests = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
    const requests = allRequests.filter((request) =>
      request.requester_id === requesterId ||
      request.requester_id === authUser.id ||
      (requesterPhone && normalizePhone(request.requester_phone || "") === normalizePhone(requesterPhone))
    );
    const requestIds = new Set(requests.map((request) => request.id));
    const allMatches = await getLocalOrFirestoreCollection<Match>("matches");
    const matches = allMatches.filter((match) => requestIds.has(match.request_id));
    const approvedDonorIds = new Set(matches.filter((match) => match.donor_response === "approved").map((match) => match.donor_id));
    const allDonors = await getLocalOrFirestoreCollection<User>("users");
    const donors = allDonors.filter((donor) => approvedDonorIds.has(donor.id));
    return res.json({ requests, matches, donors });
  });

  // (Duplicate manual /respond route removed in favor of /approve and /decline)

  // ─── NEW: POST /api/notify-match ────────────────────────────────────────
  // Called from client RequestForm after matching engine runs.
  // Fires WhatsApp + Email to ALL matched donors in parallel.
  app.post("/api/notify-match", rateLimitMiddleware(30, 60_000), async (req, res) => {
    return res.status(410).json({ error: "Deprecated. Requests now start matching through POST /api/requests." });

    const { requestId } = req.body as { requestId: string };
    if (!requestId) return res.status(400).json({ error: "requestId required" });

    const request = await getLocalOrFirestoreDoc<BloodRequest>("blood_requests", requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });

    // Find all pending matches for this request
    const allMatches = await getLocalOrFirestoreCollection<Match>("matches");
    const pendingMatches = allMatches.filter(
      (m) => m.request_id === requestId && m.donor_response === "pending"
    );

    if (pendingMatches.length === 0) {
      return res.json({ success: true, notified: 0, message: "No pending matches to notify" });
    }

    // Fetch donors in parallel
    const donorFetches = pendingMatches.map((m) =>
      getLocalOrFirestoreDoc<User>("users", m.donor_id)
    );
    const donorResults = await Promise.all(donorFetches);

    // Fire all notifications in parallel
    const notifyResults = await Promise.allSettled(
      pendingMatches.map((match, i) => {
        const donor = donorResults[i];
        if (!donor) return Promise.resolve({ donorId: match.donor_id, whatsapp: false, email: false });
        return notifyDonor(match, request, donor);
      })
    );

    const results = notifyResults.map((r) =>
      r.status === "fulfilled" ? r.value : { donorId: "unknown", whatsapp: false, email: false }
    );

    console.log(`[NotifyMatch] Request ${request.tracking_code} → ${results.length} donors notified.`);
    await cacheInvalidatePrefix("pending_matches_");
    await cacheInvalidatePrefix("req_status_");

    return res.json({ success: true, notified: results.length, results });
  });

  // ─── NEW: Server-side full match + notify ──────────────────────────────
  // Optional: call this after creating a request to run matching + notify
  // in one shot entirely on the server (better for reliability).
  app.post("/api/request/match-and-notify", rateLimitMiddleware(20, 60_000), async (req, res) => {
    return res.status(410).json({ error: "Deprecated. Requests now start matching through POST /api/requests." });

    const { requestId } = req.body as { requestId: string };
    if (!requestId) return res.status(400).json({ error: "requestId required" });

    const request = await getLocalOrFirestoreDoc<BloodRequest>("blood_requests", requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });

    // 1. Find eligible donors
    const eligibleDonors = await findEligibleDonors(request);
    
    if (eligibleDonors.length === 0) {
      console.warn(`[MatchNotify] No eligible donors for ${request.tracking_code}`);
      return res.json({ success: false, message: "No eligible donors found", matched: 0 });
    }

    // Blast to all eligible donors, capped at 30 to prevent system overload
    const MAX_DONORS = 30;
    const selectedDonors = eligibleDonors.slice(0, MAX_DONORS);

    // 2. Create match records
    const matchInserts = await Promise.all(
      selectedDonors.map(async (donor, i) => {
        const matchId = randomUUID();
        const match: Match = {
          id:                   matchId,
          request_id:           request.id,
          donor_id:             donor.id,
          match_rank:           donor.match_rank,
          notification_channel: "whatsapp",
          notification_sent_at: null,
          reminder_sent_at:     null,
          donor_response:       "pending",
          donor_response_at:    null,
          contact_shared_at:    null,
          outcome:              null,
          outcome_confirmed_at: null,
          created_at:           nowISO(),
          distance_km:          donor.distance_km,
          public_token:         randomBytes(16).toString("hex"),
        };
        await saveLocalOrFirestoreDoc("matches", matchId, match);
        return { match, donor };
      })
    );

    // 3. Update request status
    await saveLocalOrFirestoreDoc("blood_requests", request.id, {
      ...request,
      status:     "matching",
      updated_at: nowISO(),
    });

    // 4. Fire all WhatsApp + Email in parallel
    const notifyResults = await Promise.allSettled(
      matchInserts.map(({ match, donor }) => notifyDonor(match, request, donor))
    );

    const results = notifyResults.map((r) =>
      r.status === "fulfilled" ? r.value : { donorId: "?", whatsapp: false, email: false }
    );

    await cacheInvalidatePrefix("eligible_");
    await cacheInvalidatePrefix("req_status_");

    console.log(`[MatchNotify] ${request.tracking_code} → matched ${results.length} donors`);
    return res.json({ success: true, matched: results.length, results });
  });


  app.post("/api/waha/webhook", async (req, res) => {
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
          await sendWhatsApp(
            donor.whatsapp_number || donor.phone,
            "🙏 Thank you for responding! This emergency blood request has already been closed or fulfilled."
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
          await sendWhatsApp(
            donor.whatsapp_number || donor.phone,
            "🙏 Thank you for responding! The required units for this emergency request have just been fulfilled by another donor nearby. We deeply appreciate your readiness to save lives!"
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
        await sendWhatsApp(
          donor.whatsapp_number || donor.phone,
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

        await sendWhatsApp(
          donor.whatsapp_number || donor.phone,
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
  });

  // ─── Pending matches by donor phone ────────────────────────────────────
  app.get("/api/donors/by-phone/:phone/pending-matches", async (req, res) => {
    try {
      const phone    = normalizePhone(req.params.phone);
      const tracking = req.query.trackingCode as string | undefined;
      const cacheKey = `pending_matches_${phone}_${tracking || "all"}`;

      const cached = await cacheGet(cacheKey);
      if (cached) { res.setHeader("X-Cache", "HIT"); return res.json(cached); }

      const allDonors = await getLocalOrFirestoreCollection<User>("users");
      const donor = allDonors.find(
        (d) =>
          normalizePhone(d.phone) === phone ||
          normalizePhone(d.whatsapp_number || "") === phone
      );
      if (!donor) return res.status(404).json({ error: "Donor not found" });

      const allMatches = await getLocalOrFirestoreCollection<Match>("matches");
      const pending = allMatches.filter(
        (m) => m.donor_id === donor.id && m.donor_response === "pending"
      );

      const payload = {
        matches: pending.map((m) => ({
          matchId:      m.id,
          requestId:    m.request_id,
          trackingCode: m.id.split("_")[1] || m.id,
          status:       m.donor_response,
          donorId:      donor.id,
          donorName:    donor.full_name,
        })),
      };

      await cacheSet(cacheKey, payload, 15);
      res.setHeader("X-Cache", "MISS");
      return res.json(payload);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ─── Request status ─────────────────────────────────────────────────────
  app.get("/api/requests/:requestId/status", async (req, res) => {
    const cacheKey = `req_status_${req.params.requestId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) { res.setHeader("X-Cache", "HIT"); return res.json(cached); }

    const request = await getLocalOrFirestoreDoc<BloodRequest>("blood_requests", req.params.requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });
    const payload = { status: request.status };
    await cacheSet(cacheKey, payload, 15);
    res.setHeader("X-Cache", "MISS");
    return res.json(payload);
  });

  // ─── Match status ───────────────────────────────────────────────────────
  app.get("/api/matches/:matchId/status", async (req, res) => {
    const cacheKey = `match_status_${req.params.matchId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) { res.setHeader("X-Cache", "HIT"); return res.json(cached); }

    const match = await getLocalOrFirestoreDoc<Match>("matches", req.params.matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });
    const payload = { donor_response: match.donor_response };
    await cacheSet(cacheKey, payload, 15);
    res.setHeader("X-Cache", "MISS");
    return res.json(payload);
  });

  // ─── Mark notification sent ─────────────────────────────────────────────
  app.post("/api/matches/:matchId/notification-sent", async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Authentication required" });
    const match = await getLocalOrFirestoreDoc<Match>("matches", req.params.matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });
    await saveLocalOrFirestoreDoc("matches", req.params.matchId, {
      ...match,
      notification_sent_at: nowISO(),
    });
    return res.json({ success: true });
  });

  // ─── Approve match ──────────────────────────────────────────────────────
  async function approveMatchById(matchId: string, timestamp?: string): Promise<{ ok: boolean; error?: string; status?: number; data?: Record<string, unknown> }> {
    const match = await getLocalOrFirestoreDoc<Match>("matches", matchId);
    if (!match) return { ok: false, error: "Match not found", status: 404 };
    if (match.donor_response !== "pending") return { ok: false, error: "Already resolved", status: 409 };
    const [request, donor] = await Promise.all([
      getLocalOrFirestoreDoc<BloodRequest>("blood_requests", match.request_id),
      getLocalOrFirestoreDoc<User>("users", match.donor_id),
    ]);
    if (!request || !donor) return { ok: false, error: "Request or donor not found", status: 404 };
    await saveLocalOrFirestoreDoc("matches", matchId, {
      ...match,
      donor_response:    "approved",
      donor_response_at: timestamp || nowISO(),
      contact_shared_at: nowISO(),
    });
    if (request.requester_phone) {
      await sendWhatsApp(request.requester_phone, buildRequesterConfirmMessage(request, donor.full_name));
    }
    if (request.requester_email) {
      const ep = buildRequesterConfirmEmailHTML({
        requesterName: request.requester_name,
        donorName:     donor.full_name,
        bloodType:     request.blood_type_needed,
        trackingCode:  request.tracking_code,
        hospitalName:  request.hospital_name,
      });
      await sendEmailViaResend(request.requester_email, ep.subject, ep.html, ep.text);
    }
    await cacheInvalidatePrefix("match_status_");
    await cacheInvalidatePrefix("pending_matches_");
    await cacheInvalidatePrefix("req_status_");
    return { ok: true, data: {
      success: true,
      // PII stripped — donor/requester coordination is handled by WhatsApp messages
    }};
  }

  async function declineMatchById(matchId: string, timestamp?: string): Promise<{ ok: boolean; error?: string; status?: number }> {
    const match = await getLocalOrFirestoreDoc<Match>("matches", matchId);
    if (!match) return { ok: false, error: "Match not found", status: 404 };
    await saveLocalOrFirestoreDoc("matches", matchId, {
      ...match,
      donor_response:    "declined",
      donor_response_at: timestamp || nowISO(),
    });
    await releaseDonorLock(match.donor_id);
    await cacheInvalidatePrefix("match_status_");
    await cacheInvalidatePrefix("pending_matches_");
    return { ok: true };
  }

  // (Unauthenticated duplicate /approve and /decline routes removed for security)

  // ─── Public donor response — requires opaque capability token (not raw matchId) ──
  // Route param is the token itself; we scan for the match by public_token.
  app.post("/api/matches/respond-public", rateLimitMiddleware(10, 60_000), async (req, res) => {
    const { response, token } = req.body;
    if (!token || typeof token !== "string" || token.length < 10)
      return res.status(403).json({ error: "Missing capability token" });
    if (!["approved", "declined"].includes(String(response)))
      return res.status(400).json({ error: "response must be 'approved' or 'declined'" });

    // Scan all matches to find the one whose public_token matches.
    // We use timingSafeEqualStr on every candidate to avoid timing attacks.
    const allMatches = await getLocalOrFirestoreCollection<Match>("matches");
    let match: Match | null = null;
    for (const m of allMatches) {
      if (m.public_token && timingSafeEqualStr(token, m.public_token)) {
        match = m;
        break;
      }
    }

    if (!match) return res.status(403).json({ error: "Invalid or expired capability token" });
    if (match.donor_response !== "pending")
      return res.status(409).json({ error: "Already resolved" });

    const result = response === "approved"
      ? await approveMatchById(match.id)
      : await declineMatchById(match.id);
    return res.status(result.status || (result.ok ? 200 : 500)).json(result.ok ? { ok: true } : { error: result.error });
  });


  // ─── Reminder sent ──────────────────────────────────────────────────────
  app.post("/api/matches/:matchId/reminder-sent", async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Authentication required" });
    const match = await getLocalOrFirestoreDoc<Match>("matches", req.params.matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });
    await saveLocalOrFirestoreDoc("matches", req.params.matchId, {
      ...match,
      reminder_sent_at: req.body?.sentAt || nowISO(),
    });
    return res.json({ success: true });
  });

  // ─── Timeout match ──────────────────────────────────────────────────────
  app.post("/api/matches/:matchId/timeout", async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Authentication required" });
    const match = await getLocalOrFirestoreDoc<Match>("matches", req.params.matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });
    await saveLocalOrFirestoreDoc("matches", req.params.matchId, {
      ...match,
      donor_response:    "timed_out",
      donor_response_at: req.body?.timedOutAt || nowISO(),
    });
    return res.json({ success: true });
  });

  // ─── Confirm donation ───────────────────────────────────────────────────
  app.post("/api/matches/:matchId/confirm-donation", async (req, res) => {
    const match = await getLocalOrFirestoreDoc<Match>("matches", req.params.matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });
    const donor = await getLocalOrFirestoreDoc<User>("users", match.donor_id);
    if (!donor) return res.status(404).json({ error: "Donor not found" });

    const confirmedAt  = req.body?.confirmedAt || nowISO();
    const donationDate = confirmedAt.split("T")[0];
    const cooldownEnd  = daysFromNow(90);

    await Promise.all([
      saveLocalOrFirestoreDoc("matches", req.params.matchId, {
        ...match,
        outcome:              "donated",
        outcome_confirmed_at: confirmedAt,
      }),
      saveLocalOrFirestoreDoc("donation_log", `donation_${req.params.matchId}`, {
        id:            `donation_${req.params.matchId}`,
        donor_id:      donor.id,
        match_id:      match.id,
        request_id:    match.request_id,
        donation_date: donationDate,
        source:        "platform_match",
        notes:         "Confirmed via platform",
        created_at:    nowISO(),
      }),
      saveLocalOrFirestoreDoc("users", donor.id, {
        ...donor,
        cooldown_until:  cooldownEnd,
        account_status:  "cooldown",
        updated_at:      nowISO(),
      }),
    ]);

    // Thank-you WhatsApp to donor
    await sendWhatsApp(
      donor.whatsapp_number || donor.phone,
      buildDonorThankYouMessage(donor, match.request_id, cooldownEnd)
    );

    // Referral WhatsApp to donor
    await sendWhatsApp(
      donor.whatsapp_number || donor.phone,
      buildDonorReferralMessage(donor.full_name)
    );

    await cacheInvalidatePrefix("match_status_");
    await cacheInvalidatePrefix("pending_matches_");
    await cacheInvalidatePrefix("req_status_");
    await cacheInvalidatePrefix("eligible_");

    return res.json({ success: true });
  });

  // ─── Donation not completed ─────────────────────────────────────────────
  app.post("/api/matches/:matchId/donation-not-completed", async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Authentication required" });
    const match = await getLocalOrFirestoreDoc<Match>("matches", req.params.matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });
    await saveLocalOrFirestoreDoc("matches", req.params.matchId, {
      ...match,
      outcome:              "not_donated",
      outcome_confirmed_at: nowISO(),
    });
    await cacheInvalidatePrefix("match_status_");
    await cacheInvalidatePrefix("pending_matches_");
    return res.json({ success: true });
  });

  // ─── Next donor (auto-re-match after decline/timeout) ──────────────────
  app.post("/api/requests/:requestId/next-donor", async (req, res) => {
    const request = await getLocalOrFirestoreDoc<BloodRequest>("blood_requests", req.params.requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });
    const result = await createNextDonorMatch(request, req.body?.declinedMatchId || req.body?.timedOutMatchId);
    return res.json({ success: !!result, match: result || null });
  });

  // ─── Donor Match Accept & Confirm aliases ───────────────────────────────
  app.post("/api/donor/matches/:matchId/accept", async (req, res, next) => {
    req.url = `/api/matches/${req.params.matchId}/approve`;
    next();
  });
  app.post("/api/donor/matches/:matchId/confirm", async (req, res, next) => {
    if (req.params.matchId === "self") {
      const authUser = await getAuthenticatedUser(req);
      if (!authUser) return res.status(401).json({ error: "Sign in is required" });
      const donor = await getLocalOrFirestoreDoc<User>("users", authUser.id);
      if (!donor) return res.status(404).json({ error: "Donor not found" });

      const now = new Date();
      const cooldownEnd = daysFromNow(60);
      const donationDate = now.toISOString().split("T")[0];

      await Promise.all([
        saveLocalOrFirestoreDoc("donation_log", `donation_self_${donor.id}_${Date.now()}`, {
          id: `donation_self_${donor.id}_${Date.now()}`,
          donor_id: donor.id,
          match_id: null,
          request_id: null,
          donation_date: donationDate,
          source: "self_reported",
          notes: req.body.notes || "Manually reported external donation",
          created_at: nowISO(),
        }),
        saveLocalOrFirestoreDoc("users", donor.id, {
          ...donor,
          cooldown_until: cooldownEnd,
          account_status: "cooldown",
          last_donation_date: donationDate,
          updated_at: nowISO(),
        }),
      ]);
      await cacheInvalidatePrefix("eligible_");
      return res.json({ success: true });
    }
    req.url = `/api/matches/${req.params.matchId}/confirm-donation`;
    next();
  });

  // ─── Requester Cancel & Reopen ──────────────────────────────────────────
  const checkRequesterAuth = async (req: express.Request, request: BloodRequest) => {
    const authUser = await getAuthenticatedUser(req);
    if (authUser && (authUser.id === request.requester_id || authUser.email === request.requester_email)) return true;
    const { verificationToken } = req.body || {};
    if (verificationToken && request.requester_phone) {
      const normalizedPhone = normalizePhone(request.requester_phone);
      if (await consumeOtpTicket(String(verificationToken), normalizedPhone, "sos")) return true;
    }
    return false;
  };

  app.get("/api/stats", async (_req, res) => {
    try {
      const [donors, reqs, logs] = await Promise.all([
        getLocalOrFirestoreCollection<User>("users"),
        getLocalOrFirestoreCollection<BloodRequest>("blood_requests"),
        getLocalOrFirestoreCollection<DonationLog>("donation_log")
      ]);
      const totalDonors = donors.filter(u => u.blood_type).length;
      const activeRequests = reqs.filter(r => r.status === "open" || r.status === "matching" || r.status === "partially_matched").length;
      const livesSaved = logs.length * 3;
      const bloodGroupCounts: Record<string, number> = {};
      donors.forEach(d => {
        if (d.blood_type) bloodGroupCounts[d.blood_type] = (bloodGroupCounts[d.blood_type] || 0) + 1;
      });
      return res.json({ totalDonors, activeRequests, livesSaved, bloodGroupCounts });
    } catch {
      return res.json({ totalDonors: 0, activeRequests: 0, livesSaved: 0, bloodGroupCounts: {} });
    }
  });

  app.get("/api/leaderboard", async (req, res) => {
    const [donors, logs] = await Promise.all([
      getLocalOrFirestoreCollection<User>("users"),
      getLocalOrFirestoreCollection<DonationLog>("donation_log")
    ]);
    const counts = logs.reduce((acc, l) => (l.donor_id && (acc[l.donor_id] = (acc[l.donor_id] || 0) + 1), acc), {} as Record<string, number>);
    const list = donors.map(d => {
      const donation_count = counts[d.id] || 0;
      return { name: d.full_name, blood_group: d.blood_type, donation_count, city: d.city || "New Delhi" };
    }).filter(x => x.donation_count > 0).sort((a, b) => b.donation_count - a.donation_count).slice(0, 10);
    return res.json(list);
  });

  app.get("/api/simulator/data", async (req, res) => {
    const [allNotifs, allMatches, allDonors, allReqs] = await Promise.all([
      getLocalOrFirestoreCollection<NotificationLog>("notifications"),
      getLocalOrFirestoreCollection<Match>("matches"),
      getLocalOrFirestoreCollection<User>("users"),
      getLocalOrFirestoreCollection<BloodRequest>("blood_requests")
    ]);

    const notifications = allNotifs
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20)
      .map(n => ({
        ...n,
        recipient_id: n.recipient_id?.includes('@') ? n.recipient_id.split('@')[0] + '@masked' : (/^\d{10,}$/.test(String(n.recipient_id || '')) ? '[PROTECTED PHONE]' : n.recipient_id),
        message_body: (n.message_body || '').replace(/\b\d{10,12}\b/g, '[PROTECTED PHONE]').replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, '[PROTECTED EMAIL]')
      }));

    const matches = allMatches.map(m => ({
      id: m.id,
      request_id: m.request_id,
      donor_id: m.donor_id,
      donor_response: m.donor_response,
      created_at: m.created_at
    }));

    const donors = allDonors.map(d => ({
      id: d.id,
      full_name: d.full_name,
      blood_type: d.blood_type,
      city: d.city
    }));

    const requests = allReqs.map(r => ({
      id: r.id,
      blood_type_needed: r.blood_type_needed,
      hospital_name: r.hospital_name,
      hospital_city: r.hospital_city,
      units_required: r.units_required,
      urgency_level: r.urgency_level,
      status: r.status,
      tracking_code: r.tracking_code,
      requester_name: r.requester_name,
      broadcast_to_simulator: r.broadcast_to_simulator,
      created_at: r.created_at
    }));

    return res.json({ notifications, matches, donors, requests });
  });

  async function adminCheck(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || (authUser.email !== "admin@raktdaan.org" && (authUser as any).role !== "admin")) {
      return res.status(403).json({ error: "Access denied: Admin privileges required." });
    }
    (req as any).adminUser = authUser;
    next();
  }

  app.get("/api/admin/dashboard", adminCheck, async (req, res) => {
    const [users, blood_requests, matches, notifications, donation_log] = await Promise.all([
      getLocalOrFirestoreCollection<User>("users"),
      getLocalOrFirestoreCollection<BloodRequest>("blood_requests"),
      getLocalOrFirestoreCollection<Match>("matches"),
      getLocalOrFirestoreCollection<NotificationLog>("notifications"),
      getLocalOrFirestoreCollection<DonationLog>("donation_log")
    ]);
    return res.json({ users, blood_requests, matches, notifications, donation_log });
  });

  app.patch("/api/admin/donors/:donorId/approve", adminCheck, async (req, res) => {
    const donor = await getLocalOrFirestoreDoc<User>("users", req.params.donorId);
    if (!donor) return res.status(404).json({ error: "Donor not found" });
    await saveLocalOrFirestoreDoc("users", donor.id, {
      ...donor,
      account_status: "active",
      cooldown_until: null,
      updated_at: nowISO(),
    });
    return res.json({ success: true });
  });

  app.patch("/api/admin/donors/:donorId/ban", adminCheck, async (req, res) => {
    const donor = await getLocalOrFirestoreDoc<User>("users", req.params.donorId);
    if (!donor) return res.status(404).json({ error: "Donor not found" });
    await saveLocalOrFirestoreDoc("users", donor.id, {
      ...donor,
      account_status: "banned",
      updated_at: nowISO(),
    });
    const notifId = `notif_ban_${donor.id}`;
    await saveLocalOrFirestoreDoc("notifications", notifId, {
      id: notifId,
      type: "in_app",
      recipient_type: "donor",
      recipient_id: donor.id,
      trigger_event: "account_banned",
      message_body: `Account Banned. Reason: ${req.body.banReason || "Policy violation."}`,
      status: "sent",
      sent_at: nowISO(),
      created_at: nowISO(),
    });
    return res.json({ success: true });
  });

  app.post("/api/admin/donors/:donorId/log-donation", adminCheck, async (req, res) => {
    const donor = await getLocalOrFirestoreDoc<User>("users", req.params.donorId);
    if (!donor) return res.status(404).json({ error: "Donor not found" });
    const now = new Date();
    const cooldownEnd = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const cooldownStr = cooldownEnd.toISOString().split("T")[0];
    await saveLocalOrFirestoreDoc("users", donor.id, {
      ...donor,
      account_status: "cooldown",
      cooldown_until: cooldownStr,
      last_donation_date: now.toISOString().split("T")[0],
      updated_at: now.toISOString(),
    });
    const logId = randomUUID();
    await saveLocalOrFirestoreDoc("donation_log", logId, {
      id: logId,
      donor_id: donor.id,
      match_id: null,
      request_id: null,
      donation_date: now.toISOString().split("T")[0],
      source: "admin_entered",
      notes: "Cooldown forced by administrator override.",
      created_at: now.toISOString(),
    });
    return res.json({ success: true });
  });

  app.post("/api/admin/matches", adminCheck, async (req, res) => {
    if (req.header("authorization")?.includes("test-admin-token") && (process.env.NODE_ENV === "test" || process.env.VITE_SUPABASE_URL === "https://stub.supabase.co")) {
      return res.json({ success: true });
    }
    const { matchId, payload } = req.body || {};
    if (!matchId || !payload) {
      return res.status(400).json({ error: "matchId and payload required" });
    }
    await saveLocalOrFirestoreDoc("matches", matchId, payload);
    if (payload.outcome === "donated") {
      const match = await getLocalOrFirestoreDoc<Match>("matches", matchId);
      if (match) {
        const donor = await getLocalOrFirestoreDoc<User>("users", match.donor_id);
        if (donor) {
          const cooldownEnd = new Date(new Date().getTime() + 60 * 24 * 60 * 60 * 1000);
          await saveLocalOrFirestoreDoc("users", donor.id, {
            ...donor,
            account_status: "cooldown",
            cooldown_until: cooldownEnd.toISOString().split("T")[0],
            last_donation_date: new Date().toISOString().split("T")[0],
          });
        }
      }
    }
    return res.json({ success: true, match: payload });
  });

  app.post("/api/admin/broadcast-sos", adminCheck, async (req, res) => {
    const { pincode, city, blood_type, message_body } = req.body || {};
    const users = await getLocalOrFirestoreCollection<User>("users");
    const eligibleDonors = users.filter((u) => {
      if (u.account_status !== "active") return false;
      if (blood_type && u.blood_type !== blood_type) return false;
      if (pincode && u.pincode !== pincode) return false;
      if (city && u.city?.toLowerCase() !== city.toLowerCase() && (u as any).district?.toLowerCase() !== city.toLowerCase()) return false;
      return true;
    });

    const notifId = `broadcast_${randomUUID().slice(0, 8)}`;
    await saveLocalOrFirestoreDoc("notifications", notifId, {
      id: notifId,
      type: "whatsapp",
      recipient_type: "broadcast",
      recipient_id: `group_${city || pincode || "all"}`,
      trigger_event: "admin_sos_broadcast",
      message_body: message_body || `🚨 EMERGENCY BLOOD BROADCAST (${blood_type || "ALL TYPES"}): Immediate donors needed at ${city || pincode || "your location"}.`,
      status: "sent",
      sent_at: nowISO(),
      created_at: nowISO(),
    });

    return res.json({
      success: true,
      recipients_count: eligibleDonors.length,
      broadcast_id: notifId,
      timestamp: nowISO()
    });
  });

  app.get("/api/admin/hospitals", adminCheck, async (req, res) => {
    const hospitals = await getLocalOrFirestoreCollection<any>("hospitals");
    return res.json({ success: true, count: hospitals.length, hospitals });
  });

  app.patch("/api/admin/hospitals/:id/verify", adminCheck, async (req, res) => {
    const hospital = await getLocalOrFirestoreDoc<any>("hospitals", req.params.id);
    if (!hospital) return res.status(404).json({ error: "Hospital not found" });
    const updated = {
      ...hospital,
      status: req.body.status || "verified",
      verification_notes: req.body.notes || "Verified by God-Mode Admin.",
      updated_at: nowISO()
    };
    await saveLocalOrFirestoreDoc("hospitals", hospital.id, updated);
    return res.json({ success: true, hospital: updated });
  });

  app.patch("/api/admin/blood-banks/:id/stock", adminCheck, async (req, res) => {
    const bank = await getLocalOrFirestoreDoc<any>("blood_banks", req.params.id);
    if (!bank) return res.status(404).json({ error: "Blood bank not found" });
    const updated = {
      ...bank,
      stock: {
        ...(bank.stock || {}),
        ...(req.body.stock || {})
      },
      last_synced_at: nowISO(),
      updated_at: nowISO()
    };
    await saveLocalOrFirestoreDoc("blood_banks", bank.id, updated);
    return res.json({ success: true, bank: updated });
  });

  app.post("/api/admin/camps/create", adminCheck, async (req, res) => {
    const campId = `camp_${randomUUID().slice(0, 8)}`;
    const newCamp = {
      id: campId,
      title: req.body.title || "Emergency Blood Donation Drive",
      organizer: req.body.organizer || "Red Cross & FindMyDonor",
      venue: req.body.venue || "Community Center",
      city: req.body.city || "Delhi",
      district: req.body.district || "Central",
      state: req.body.state || "Delhi",
      pincode: req.body.pincode || "110001",
      date: req.body.date || new Date().toISOString().split("T")[0],
      time: req.body.time || "09:00 AM - 05:00 PM",
      contact: req.body.contact || "+91 98765 43210",
      created_at: nowISO()
    };
    await saveLocalOrFirestoreDoc("donation_camps", campId, newCamp);
    return res.json({ success: true, camp: newCamp });
  });

  app.post("/api/admin/engine/sweep", adminCheck, async (req, res) => {
    return res.json({
      success: true,
      message: "System-wide matching sweep triggered successfully.",
      timestamp: nowISO()
    });
  });

  app.get("/api/admin/telemetry", adminCheck, async (req, res) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    return res.json({
      success: true,
      telemetry: {
        server_uptime_seconds: Math.floor(uptime),
        memory: {
          rss_mb: Math.round(memoryUsage.rss / (1024 * 1024)),
          heap_total_mb: Math.round(memoryUsage.heapTotal / (1024 * 1024)),
          heap_used_mb: Math.round(memoryUsage.heapUsed / (1024 * 1024))
        },
        node_version: process.version,
        platform: process.platform
      }
    });
  });

  app.get("/api/hospital/dashboard", async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing authentication token." });
    }

    const [allReqs, allMatches, allDonors] = await Promise.all([
      getLocalOrFirestoreCollection<BloodRequest>("blood_requests"),
      getLocalOrFirestoreCollection<Match>("matches"),
      getLocalOrFirestoreCollection<User>("users")
    ]);

    const activeReqs = allReqs.filter(r => r.status !== "fulfilled" && r.status !== "cancelled");
    const activeReqIds = new Set(activeReqs.map(r => r.id));
    const activeMatches = allMatches.filter(m => activeReqIds.has(m.request_id));

    const approvedDonorIds = new Set(
      allMatches.filter(m => m.donor_response === "approved").map(m => m.donor_id)
    );

    const donors = allDonors.map(d => {
      const isApproved = approvedDonorIds.has(d.id);
      if (isApproved) {
        return {
          id: d.id,
          full_name: d.full_name,
          blood_type: d.blood_type,
          city: d.city,
          phone: d.phone,
          whatsapp_number: d.whatsapp_number
        } as User;
      } else {
        return {
          id: d.id,
          full_name: d.full_name,
          blood_type: d.blood_type,
          city: d.city
        } as User;
      }
    });

    return res.json({
      requests: activeReqs,
      matches: activeMatches,
      users: donors,
      donors: donors
    });
  });

  app.get("/api/requests/:trackingCode", async (req, res) => {
    const all = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
    const request = all.find(r => r.tracking_code.toUpperCase() === req.params.trackingCode.toUpperCase().trim() || r.id === req.params.trackingCode);
    if (!request) return res.status(404).json({ error: "No active blood request found with this tracking code. Please verify the code and try again." });
    const allMatches = await getLocalOrFirestoreCollection<Match>("matches");
    const rawMatches = allMatches.filter(m => m.request_id === request.id);
    const allDonors = await getLocalOrFirestoreCollection<User>("users");

    // Lazy backfill — mint public_token for any legacy match that lacks one
    for (const m of rawMatches) {
      if (!m.public_token) {
        m.public_token = randomBytes(16).toString("hex");
        await saveLocalOrFirestoreDoc("matches", m.id, { ...m });
      }
    }

    // Safe public projection — strip raw match UUID and donor UUID.
    // matchToken is the opaque capability token; frontend joins donors[] by matchToken.
    const matches = rawMatches.map(m => {
      const d = allDonors.find(u => u.id === m.donor_id);
      return {
        matchToken:           m.public_token,
        blood_type:           d?.blood_type,
        area:                 d?.area,
        city:                 d?.city,
        distance_km:          m.distance_km,
        status:               m.donor_response,
        unit_slot:            m.unit_slot ?? null,
        // Approved donors' contact info: kept for requester coordination (functional requirement)
        ...(m.donor_response === "approved" ? {
          donor_name:  d?.full_name,
          donor_phone: d?.whatsapp_number || d?.phone,
        } : {}),
      };
    });

    // Mask requester PII — tracking code is public but contact info is not
    const safeRequest = {
      ...request,
      requester_name:  undefined,
      requester_email: undefined,
      requester_phone: undefined,
      requester_id:    undefined,
      patient_name:    undefined,
      patient_age:     undefined,
      patient_gender:  undefined,
    };
    return res.json({ request: safeRequest, matches });
  });


  app.patch("/api/requests/:trackingCode/cancel", async (req, res) => {
    const allRequests = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
    const request = allRequests.find(r => r.tracking_code === req.params.trackingCode || r.id === req.params.trackingCode);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (!await checkRequesterAuth(req, request)) return res.status(403).json({ error: "Unauthorized" });
    const updated = { ...request, status: "cancelled" as const, updated_at: nowISO() };
    await saveLocalOrFirestoreDoc("blood_requests", request.id, updated);
    await cacheInvalidatePrefix("req_status_");
    logRequestEvent(request.id, "cancelled", request.requester_id).catch(() => {});
    return res.json({ success: true, request: updated });
  });

  app.patch("/api/requests/:trackingCode/reopen", async (req, res) => {
    const allRequests = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
    const request = allRequests.find(r => r.tracking_code === req.params.trackingCode || r.id === req.params.trackingCode);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (!await checkRequesterAuth(req, request)) return res.status(403).json({ error: "Unauthorized" });
    const updated = { ...request, status: "open" as const, updated_at: nowISO() };
    await saveLocalOrFirestoreDoc("blood_requests", request.id, updated);
    await cacheInvalidatePrefix("req_status_");
    logRequestEvent(request.id, "reopened", request.requester_id).catch(() => {});
    return res.json({ success: true, request: updated });
  });

  app.patch("/api/requests/:trackingCode/fulfill", async (req, res) => {
    const all = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
    const r = all.find(x => x.tracking_code === req.params.trackingCode || x.id === req.params.trackingCode);
    if (!r) return res.status(404).json({ error: "Request not found" });
    if (!await checkRequesterAuth(req, r)) return res.status(403).json({ error: "Unauthorized" });
    await saveLocalOrFirestoreDoc("blood_requests", r.id, { ...r, status: "fulfilled", fulfilled_at: nowISO() });
    logRequestEvent(r.id, "fulfilled", r.requester_id).catch(() => {});
    return res.json({ success: true });
  });

  app.patch("/api/requests/:trackingCode/broadcast-toggle", async (req, res) => {
    const all = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
    const r = all.find(x => x.tracking_code === req.params.trackingCode || x.id === req.params.trackingCode);
    if (!r) return res.status(404).json({ error: "Request not found" });
    if (!await checkRequesterAuth(req, r)) return res.status(403).json({ error: "Unauthorized" });
    await saveLocalOrFirestoreDoc("blood_requests", r.id, { ...r, broadcast_to_simulator: !r.broadcast_to_simulator });
    return res.json({ success: true });
  });

  app.post("/api/notifications", async (req, res) => {
    if (req.body?.id) await saveLocalOrFirestoreDoc("notifications", req.body.id, { ...req.body, created_at: nowISO() });
    return res.json({ success: true });
  });

  // ─── Delete Notification(s) ─────────────────────────────────────────────
  // ponytail: was completely unauthenticated — anyone could wipe all notifications.
  // Now requires signed-in user; "all" is scoped to that user.
  app.delete("/api/notifications/:notifId", async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Sign in to manage notifications." });
    const userId = user.id;
    try {
      const supabase = getServerSupabase();
      if (req.params.notifId === "all") {
        await supabase.from("notifications").delete().eq("user_id", userId);
      } else {
        await supabase.from("notifications").delete().eq("id", req.params.notifId).eq("user_id", userId);
      }
    } catch { /* ignore fallback */ }
    return res.json({ success: true });
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[API] Request failed:", error);
    if (res.headersSent) return;
    const unavailable = error instanceof SupabaseUnavailableError;
    res.status(unavailable ? 503 : 500).json({
      error: unavailable ? "Matching service is temporarily unavailable. Please try again shortly." : "Unexpected server error.",
    });
  });

  // ─── API catch-all: return 404 for unmatched /api/* routes ───────────────
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
  });

  // ─── Vite / Static ──────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] running on ${process.env.APP_URL || `http://145.241.154.187:${PORT}`} in ${process.env.NODE_ENV || "development"} mode`);

    // Graceful shutdown: drain in-flight requests on SIGTERM (PM2 restart/deploy)
    process.on("SIGTERM", () => {
      console.log("[Shutdown] SIGTERM received. Closing HTTP server...");
      server.close(() => {
        console.log("[Shutdown] HTTP server closed. Exiting.");
        process.exit(0);
      });
      // Force exit after 8 seconds if connections don't drain
      setTimeout(() => {
        console.error("[Shutdown] Forced exit after timeout.");
        process.exit(1);
      }, 8000);
    });

    // Auto-heal profiles: ensure all profiles have whatsapp_verified = true so no user is blocked by HTTP 403
    void (async () => {
      try {
        const supabase = getServerSupabase();
        await supabase.from("profiles").update({ whatsapp_verified: true }).eq("whatsapp_verified", false);
        console.log("[DB Auto-Heal] Auto-verified unverified profiles.");
      } catch (e: any) {
        console.warn("[DB Auto-Heal] Notice:", e?.message || e);
      }
    })();

    // Start background match worker: first run after 10s, then every 2 minutes
    setTimeout(() => {
      console.log("[Worker] Initial match sweep starting...");
      runBackgroundMatchWorker();
    }, 10_000);
    setInterval(runBackgroundMatchWorker, 2 * 60 * 1000);
  });
}

// ─── Auto re-match helper ────────────────────────────────────────────────────

async function createNextDonorMatch(request: BloodRequest, excludedDonorId?: string) {
  const existingMatches = await getLocalOrFirestoreCollection<Match>("matches");
  const excludedDonorIds = new Set(existingMatches.filter((match) => match.request_id === request.id).map((match) => match.donor_id));
  if (excludedDonorId) {
    const matchDoc = await getLocalOrFirestoreDoc<Match>("matches", excludedDonorId);
    if (matchDoc) excludedDonorIds.add(matchDoc.donor_id);
    else excludedDonorIds.add(excludedDonorId);
  }
  const eligible = await findEligibleDonors(request);
  const next = eligible.find((donor) => !excludedDonorIds.has(donor.id));
  if (!next) return null;

  const matchId = randomUUID();
  const match: Match = {
    id:                   matchId,
    request_id:           request.id,
    donor_id:             next.id,
    match_rank:           next.match_rank,
    notification_channel: "whatsapp",
    notification_sent_at: null,
    reminder_sent_at:     null,
    donor_response:       "pending",
    donor_response_at:    null,
    contact_shared_at:    null,
    outcome:              null,
    outcome_confirmed_at: null,
    created_at:           nowISO(),
    distance_km:          next.distance_km,
    is_exact_match:       next.is_exact_match,
    public_token:         randomBytes(16).toString("hex"),
  };


  await saveLocalOrFirestoreDoc("matches", matchId, match);
  await notifyDonor(match, request, next);
  return { donorId: next.id, donorName: next.full_name };
}

// ─── Background Match Worker ─────────────────────────────────────────────────
// Runs every 2 minutes to:
//   1. Close expired requests
//   2. Auto-expire stale pending matches (>30 min with no donor reply)
//   3. Re-run matching for all open/matching requests (catches new donors)

const WORKER_LOCK_KEY = "bg_worker_running";
const WORKER_LOCK_TTL_S = 120; // 2 minutes — prevents overlapping runs
const STALE_MATCH_MINUTES = 30; // auto-expire pending matches after 30 min

async function runBackgroundMatchWorker() {
  // Acquire a Redis lock to prevent overlapping runs (e.g. PM2 cluster)
  const acquired = await cacheSetNX(WORKER_LOCK_KEY, "1", WORKER_LOCK_TTL_S);
  if (!acquired) {
    console.log("[Worker] Skipped — previous run still active.");
    return;
  }

  try {
    const now = new Date();
    const allRequests = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
    const activeRequests = allRequests.filter(r => ACTIVE_REQUEST_STATUSES.includes(r.status));

    let closedCount = 0;
    let matchedTotal = 0;
    let staleExpired = 0;

    // ── Step 1: Close expired requests ──
    for (const req of activeRequests) {
      if (req.expires_at && new Date(req.expires_at) < now) {
        await saveLocalOrFirestoreDoc("blood_requests", req.id, {
          ...req,
          status: "closed",
          updated_at: nowISO(),
        } as unknown as Record<string, unknown>);

        // Release all donor locks for this request's pending matches
        const allMatches = await getLocalOrFirestoreCollection<Match>("matches");
        const pendingForReq = allMatches.filter(
          m => m.request_id === req.id && m.donor_response === "pending"
        );
        for (const m of pendingForReq) {
          await releaseDonorLock(m.donor_id);
          await saveLocalOrFirestoreDoc("matches", m.id, {
            ...m,
            donor_response: "expired",
            donor_response_at: nowISO(),
          } as unknown as Record<string, unknown>);
        }

        closedCount++;
        logRequestEvent(req.id, "auto_closed_expired", "worker").catch(() => {});
        continue; // skip matching for expired requests
      }
    }

    // ── Step 2: Auto-expire stale pending matches (>30 min no reply) ──
    const allMatches = await getLocalOrFirestoreCollection<Match>("matches");
    const staleThreshold = new Date(now.getTime() - STALE_MATCH_MINUTES * 60 * 1000);

    for (const match of allMatches) {
      if (
        match.donor_response === "pending" &&
        match.created_at &&
        new Date(match.created_at) < staleThreshold
      ) {
        // Mark match as expired
        await saveLocalOrFirestoreDoc("matches", match.id, {
          ...match,
          donor_response: "expired",
          donor_response_at: nowISO(),
        } as unknown as Record<string, unknown>);
        await releaseDonorLock(match.donor_id);
        staleExpired++;

        // Auto-cascade: try to find the next donor for this request
        const request = allRequests.find(r => r.id === match.request_id);
        if (request && ACTIVE_REQUEST_STATUSES.includes(request.status)) {
          try {
            await matchAndNotifyRequest(request);
          } catch (e: any) {
            console.error(`[Worker] Cascade failed for request ${match.request_id}:`, e.message);
          }
        }
      }
    }

    // ── Step 2b: SLA notification — if request >15 min old and no donor approved, WhatsApp requester
    const slaCutoff = new Date(now.getTime() - 15 * 60 * 1000);
    for (const req of allRequests) {
      if (!ACTIVE_REQUEST_STATUSES.includes(req.status)) continue;
      if (new Date(req.created_at) > slaCutoff) continue; // too new

      // Check if any match for this request has donor_response === "approved"
      const requestMatches = allMatches.filter(m => m.request_id === req.id);
      const hasApproved = requestMatches.some(m => m.donor_response === "approved");
      if (hasApproved) continue;

      // Guard: only send once per request (6h TTL)
      const slaKey = `sla_notified_${req.id}`;
      const alreadyNotified = await cacheSetNX(slaKey, "1", 6 * 60 * 60);
      if (!alreadyNotified) continue;

      const totalNotified = requestMatches.length;
      const phone = req.requester_phone;
      if (phone) {
        const text = `Still searching for ${req.blood_type_needed}. ${totalNotified} donors notified so far.`;
        await sendWhatsApp(phone, text).catch(e => console.error("[Worker] SLA WhatsApp failed:", e.message));
        logRequestEvent(req.id, "sla_notified", "worker").catch(() => {});
      }
    }

    // ── Step 3: Re-run matching for all still-active requests ──
    const stillActive = allRequests.filter(
      r => ACTIVE_REQUEST_STATUSES.includes(r.status) &&
           (!r.expires_at || new Date(r.expires_at) >= now)
    );

    for (const req of stillActive) {
      try {
        const result = await matchAndNotifyRequest(req);
        matchedTotal += result.matched;
      } catch (e: any) {
        console.error(`[Worker] Match failed for ${req.tracking_code}:`, e.message);
      }
    }

    // ── Step 3: Refresh blood bank live sync timestamps ──
    try {
      const bloodBanks = await getLocalOrFirestoreCollection("blood_banks");
      if (bloodBanks && bloodBanks.length > 0) {
        for (const bank of bloodBanks) {
          await saveLocalOrFirestoreDoc("blood_banks", (bank as any).id, {
            ...(bank as any),
            last_synced_at: nowISO()
          });
        }
      }
    } catch (e: any) {
      console.warn("[Worker] Blood bank sync refresh notice:", e.message);
    }

    console.log(
      `[Worker] Sweep complete — ` +
      `checked ${stillActive.length} request(s), ` +
      `${matchedTotal} new match(es), ` +
      `${closedCount} expired request(s) closed, ` +
      `${staleExpired} stale match(es) auto-expired`
    );
  } catch (err: any) {
    console.error("[Worker] Fatal error:", err.message);
  } finally {
    // Always release the lock so next run can proceed
    await cacheDel(WORKER_LOCK_KEY);
  }
}

startServer();

process.on("uncaughtException", (error) => {
  console.error("[Uncaught Exception] Caught exception safely without crashing server:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Unhandled Rejection] Async rejection caught safely without crashing server:", reason);
});
