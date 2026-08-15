// Matching engine service — extracted from server.ts (Phase 3 decomposition, 3.8/3.6.3 prerequisite)
// Owns donor eligibility, match creation, notification dispatch, and the open-request
// re-match trigger used by donor route completion.
import { randomUUID, randomBytes } from "node:crypto";
import {
  getCollection as getLocalOrFirestoreCollection,
  getDoc as getLocalOrFirestoreDoc,
  saveDoc as saveLocalOrFirestoreDoc,
  getServerSupabase,
  isSupabaseConfigured,
} from "../src/lib/serverDb";
import {
  cacheGet,
  cacheSet,
  cacheSetNX,
  cacheDel,
  cacheInvalidatePrefix,
} from "../src/lib/redisCache";
import { normalizePhone } from "../helpers/phone";
import { nowISO, nowDate } from "../helpers/time";
import { escapeHtml } from "../helpers/html";
import {
  sendWhatsApp,
  buildDonorSosMessage,
  buildRequesterSystemAlertMessage,
  buildNoDonorsFoundAlertMessage,
} from "../src/lib/waha";
import { buildDonorSosEmailHTML } from "../src/lib/email";
import { sendEmailViaResend } from "./notificationService";
import { isBloodCompatible, BLOOD_COMPATIBILITY_MATRIX, type BloodType } from "../src/types";
import type { BloodRequest, DonationLog, Match, NotificationLog, User } from "../src/types";
import { mapProfile } from "../src/lib/serverDb";
import { getDistanceBetweenPincodes } from "../src/lib/geo";
import { PINCODE_COORDS } from "../src/data/pincode_coords";

// ─── Shared Constants ────────────────────────────────────────────────────────
// ponytail: single source of truth — worker was filtering only ["open","matching"],
// missing "broadcasting" and "partially_matched" entirely (P0 bug)
export const ACTIVE_REQUEST_STATUSES: readonly string[] = ["broadcasting", "matching", "open", "partially_matched"];

export const DONOR_LOCK_TTL_S = 5 * 60; // 5 minutes

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

// ── Donor reservation lock helpers (prevents double-booking) ─────────────────
function donorLockKey(donorId: string): string {
  return `donor_lock_${donorId}`;
}

/**
 * Atomically try to acquire a donor reservation lock.
 * Returns true if the lock was acquired (donor is free), false if already locked.
 */
export async function acquireDonorLock(donorId: string, requestId: string): Promise<boolean> {
  return cacheSetNX(donorLockKey(donorId), requestId, DONOR_LOCK_TTL_S);
}

/** Release a donor's reservation lock (on decline, timeout, or match fulfillment). */
export async function releaseDonorLock(donorId: string): Promise<void> {
  await cacheDel(donorLockKey(donorId));
}

/**
 * Returns eligible donors for a request, ordered by proximity.
 * Results are Redis-cached for 60 s to avoid hammering Firestore.
 * Donors are tagged as `is_exact_match` (exact ABO/Rh) vs compatible (fallback).
 */
export async function findEligibleDonors(
  request: BloodRequest
): Promise<(User & { distance_km: number; match_rank: number; is_exact_match: boolean })[]> {
  const cacheKey = `eligible_${request.blood_type_needed}_${request.hospital_pincode}`;
  const cached = await cacheGet<(User & { distance_km: number; match_rank: number; is_exact_match: boolean })[]>(cacheKey);
  if (cached) return cached;

  // Phase 6 (6.1): prefer Supabase pushdown (narrows candidate set in-DB) with
  // the legacy full Firestore scan as automatic fallback (un-configured / error).
  const dbCandidates = await findEligibleDonorsFromDB(request);
  const allDonors = dbCandidates !== null
    ? dbCandidates
    : await getLocalOrFirestoreCollection<User>('users');
  const allMatches = await getLocalOrFirestoreCollection<Match>('matches');
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
    if (request.blood_type_needed !== 'ANY') {
      const donorType = (d.blood_type || '').toUpperCase().trim() as BloodType;
      if (!isBloodCompatible(donorType, request.blood_type_needed as BloodType)) return false;
    }

    // Emergency-only restriction removed: all requests match available donors
    // if (d.emergency_only && request.urgency_level !== "critical") return false;

    // Self-match prevention.
    // normalizePhone(null|undefined) → "" (see helpers/phone.ts: String(phone || "")),
    // which will never equal a valid requester phone (91XXXXXXXXXX format).
    // Donors with phone=null are therefore NOT excluded from matching by this guard.
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

/**
 * Phase 6 (6.1): Supabase pushdown candidate fetch — replaces the full table
 * scan (getLocalOrFirestoreCollection("users") → SELECT * FROM profiles) with a
 * DB-side filtered query: donor_profiles.is_available = true AND blood_group IN
 * (compatible types) AND pincode IN (nearby pincodes clamped by PINCODE_COORDS).
 *
 * Returns a flat candidate list mapped to the same User shape mapProfile()
 * produces; findEligibleDonors applies the remaining filters + 4-tier geo
 * ranking. Returns null when Supabase is unavailable so callers fall back to
 * the full scan.
 */
export async function findEligibleDonorsFromDB(
  request: BloodRequest
): Promise<(User & { distance_km: number; match_rank: number; is_exact_match: boolean })[] | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = getServerSupabase();
    // Compatible donor blood types for this request (ANY → all).
    const compatibleTypes = request.blood_type_needed === 'ANY'
      ? Object.keys(BLOOD_COMPATIBILITY_MATRIX)
      : BLOOD_COMPATIBILITY_MATRIX[request.blood_type_needed as BloodType];

    // Nearby pincodes: exact + 5-digit-prefix neighbors from PINCODE_COORDS.
    const requestPin = String(request.hospital_pincode || '').replace(/\s+/g, '');
    const nearbyPincodes = new Set<string>();
    if (requestPin) {
      nearbyPincodes.add(requestPin);
      for (const code of Object.keys(PINCODE_COORDS)) {
        if (code.slice(0, 5) === requestPin.slice(0, 5) && code.length >= 5) {
          nearbyPincodes.add(code);
        }
      }
    }

    // Query donor_profiles as the primary table so the LIMIT applies to
    // already-filtered rows (is_available + blood_group + pincode).
    // Querying profiles with embedded donor_profiles filters via PostgREST
    // applies LIMIT to profiles BEFORE the embedded filter, potentially
    // excluding eligible donors beyond position 200 in the profiles table.
    let dpQuery = supabase
      .from('donor_profiles')
      .select('blood_group, pincode, is_available, emergency_only, cooldown_until, profiles(id, phone, whatsapp_phone, email, full_name, trust_report_count)')
      .eq('is_available', true);

    if (compatibleTypes.length > 0) {
      dpQuery = dpQuery.in('blood_group', compatibleTypes);
    }
    if (nearbyPincodes.size > 0) {
      dpQuery = dpQuery.in('pincode', Array.from(nearbyPincodes));
    }

    const { data: rawData, error } = await dpQuery.limit(200);
    // Reshape to match the profiles-with-donor_profiles structure mapProfile expects
    const data = rawData?.map((dp: any) => ({
      ...(dp.profiles || {}),
      donor_profiles: [{ blood_group: dp.blood_group, pincode: dp.pincode, is_available: dp.is_available, emergency_only: dp.emergency_only, cooldown_until: dp.cooldown_until }],
    }));
    if (error) throw error;
    if (!data || data.length === 0) return [];

    // Map to the same User shape mapProfile() produces. All filtering beyond
    // the DB-side availability/blood/pincode predicates (anti-spam, self-match,
    // cooldown, geo-tiering) is applied once in findEligibleDonors.
    return data.map(mapProfile) as (User & {
      distance_km: number;
      match_rank: number;
      is_exact_match: boolean;
    })[];
  } catch (err) {
    console.warn(`[Matching] findEligibleDonorsFromDB fallback to full scan:`, (err as any)?.message || err);
    return null;
  }
}

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
  const sosMessage = buildDonorSosMessage(request, donor, match.id, match.public_token);
  // Null-safety: donors who signed up via Google/email without adding a phone
  // will have no whatsapp_number/phone. Skip WhatsApp gracefully instead of
  // sending to an empty string (which WAHA would reject or silently drop).
  let waOk = false;
  if (whatsappPhone) {
    waOk = await sendWhatsApp(whatsappPhone, sosMessage);
  } else {
    console.warn(`[Notify] Donor ${donor.id} (${donor.full_name}) has no WhatsApp number — skipping WA notification.`);
  }

  let emailOk = false;
  if (donor.email && donor.email.includes("@") && !donor.email.endsWith(".local")) {
    try {
      const emailPayload = buildDonorSosEmailHTML({
        donorName: donor.full_name,
        bloodType: request.blood_type_needed,
        units: request.units_required,
        component: "Whole Blood",
        hospitalName: request.hospital_name,
        hospitalArea: request.hospital_area,
        hospitalCity: request.hospital_city,
        urgencyLevel: request.urgency_level || "urgent",
        trackingCode: request.tracking_code,
        patientName: request.patient_name || "Patient",
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
    id: notifId,
    type: waOk ? "whatsapp" : emailOk ? "email" : "in_app",
    recipient_type: "donor",
    recipient_id: donor.id,
    trigger_event: "match_found",
    message_body: sosMessage.slice(0, 400),
    status: waOk || emailOk ? "sent" : "failed",
    sent_at: waOk || emailOk ? nowISO() : null,
    created_at: nowISO(),
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

export async function matchAndNotifyRequest(request: BloodRequest) {
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

// ponytail: reuses existing matchAndNotifyRequest dedup (acquireDonorLock + alreadyOffered)
export async function notifyOpenRequestsForNewDonor(
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

export async function createNextDonorMatch(request: BloodRequest, excludedDonorId?: string) {
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
    id: matchId,
    request_id: request.id,
    donor_id: next.id,
    match_rank: next.match_rank,
    notification_channel: "whatsapp",
    notification_sent_at: null,
    reminder_sent_at: null,
    donor_response: "pending",
    donor_response_at: null,
    contact_shared_at: null,
    outcome: null,
    outcome_confirmed_at: null,
    created_at: nowISO(),
    distance_km: next.distance_km,
    is_exact_match: next.is_exact_match,
    public_token: randomBytes(16).toString("hex"),
  };

  await saveLocalOrFirestoreDoc("matches", matchId, match);
  await notifyDonor(match, request, next);
  return { donorId: next.id, donorName: next.full_name };
}
