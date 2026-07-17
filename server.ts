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
import { randomInt, randomUUID } from "node:crypto";
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
} from "./src/lib/waha";
import {
  buildDonorSosEmailHTML,
  buildRequesterConfirmEmailHTML,
  buildEmailOtpHTML,
} from "./src/lib/email";
import { isBloodCompatible, BLOOD_COMPATIBILITY_MATRIX } from "./src/types";
import type { BloodRequest, BloodType, DonationLog, Match, Requester, User, NotificationLog } from "./src/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizePhone(phone: string): string {
  return String(phone || "").replace(/\D/g, "");
}

function isValidIndianPhone(phone: string): boolean {
  return /^(?:91)?[6-9]\d{9}$/.test(normalizePhone(phone));
}

async function getAuthenticatedUser(req: express.Request) {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const { data, error } = await getServerSupabase().auth.getUser(token);
    return error ? null : data.user;
  } catch (error) {
    console.warn("[Auth] Supabase unavailable:", error);
    return null;
  }
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
  const { data: link, error: linkError } = await supabase
    .from("auth_profile_links").select("profile_id").eq("auth_user_id", authUserId).maybeSingle();
  if (linkError) throw linkError;
  if (!link) return null;
  const [{ data: profile, error: profileError }, { data: donorProfile, error: donorError }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", link.profile_id).single(),
    supabase.from("donor_profiles").select("*").eq("profile_id", link.profile_id).maybeSingle(),
  ]);
  if (profileError) throw profileError;
  if (donorError) throw donorError;
  return { profile: profile as LinkedProfile, donorProfile: donorProfile as LinkedDonorProfile | null };
}

function nextOnboardingStep(linked: Awaited<ReturnType<typeof getLinkedProfile>>): "contact" | "otp" | "donor-profile" | "complete" {
  if (!linked) return "contact";
  if (!linked.profile.whatsapp_verified) return "otp";
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

    if (d.emergency_only && request.urgency_level !== "critical") return false;

    // Self-match prevention
    if (normalizePhone(d.phone) === normalizePhone(request.requester_phone)) return false;
    if (d.whatsapp_number && normalizePhone(d.whatsapp_number) === normalizePhone(request.requester_phone)) return false;
    if (d.email.toLowerCase().trim() === request.requester_email.toLowerCase().trim()) return false;

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
    // Exact matches first within each tier
    if (a.is_exact_match !== b.is_exact_match) return a.is_exact_match ? -1 : 1;
    return sortDonorsByActivity(a, b);
  };

  const tier1 = donorsWithDistance.filter(d => d.distance_km <= 3).map(d => ({ ...d, match_rank: 1 }));
  tier1.sort(sortTier);
  finalDonors.push(...tier1);

  if (finalDonors.length < 3 || isRare) {
    const tier2 = donorsWithDistance.filter(d => d.distance_km > 3 && d.distance_km <= 10).map(d => ({ ...d, match_rank: 2 }));
    tier2.sort(sortTier);
    finalDonors.push(...tier2);
  }

  if (finalDonors.length < 3 || isRare) {
    const tier3 = donorsWithDistance.filter(d => d.distance_km > 10 && d.distance_km <= 25).map(d => ({ ...d, match_rank: 3 }));
    tier3.sort(sortTier);
    finalDonors.push(...tier3);
  }

  if (finalDonors.length < 3 || isRare) {
    const tier4 = donorsWithDistance.filter(d => d.distance_km > 25).map(d => ({ ...d, match_rank: 4 }));
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

// Helper sorting function: oldest last_donation_date first (null/never donated gets priority)
function sortDonorsByActivity(a: any, b: any) {
  if (!a.last_donation_date && b.last_donation_date) return -1;
  if (a.last_donation_date && !b.last_donation_date) return 1;
  if (a.last_donation_date && b.last_donation_date) {
    return a.last_donation_date.localeCompare(b.last_donation_date);
  }
  return (a.updated_at || '').localeCompare(b.updated_at || '');
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
  // cacheSet uses SET NX EX semantics — only sets if key doesn't exist
  const key = donorLockKey(donorId);
  const existing = await cacheGet<string>(key);
  if (existing) return false; // already locked by another request
  await cacheSet(key, requestId, DONOR_LOCK_TTL_S);
  return true;
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

  if (inserts.length > 0 && request.requester_phone) {
    const text = buildRequesterSystemAlertMessage(request, inserts.length);
    await sendWhatsApp(request.requester_phone, text).catch(e => console.error("[WAHA] Failed to alert requester:", e.message));
  }

  // "No donors found" alert — only on first attempt (no existing matches at all)
  if (inserts.length === 0 && alreadyOffered.size === 0 && request.requester_phone) {
    const noMatchText = buildNoDonorsFoundAlertMessage(request);
    await sendWhatsApp(request.requester_phone, noMatchText).catch(e => console.error("[WAHA] Failed to send no-match alert:", e.message));
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
  const sosMessage    = buildDonorSosMessage(request, donor);
  // Donor alerts are WhatsApp-only. A failed provider call must remain failed.
  const waOk = await sendWhatsApp(whatsappPhone, sosMessage);

  // Log notification
  const notifId = randomUUID();
  await saveLocalOrFirestoreDoc("notifications", notifId, {
    id:             notifId,
    type:           "whatsapp",
    recipient_type: "donor",
    recipient_id:   donor.id,
    trigger_event:  "match_found",
    message_body:   sosMessage.slice(0, 400),
    status:         waOk ? "sent" : "failed",
    sent_at:        waOk ? nowISO() : null,
    created_at:     nowISO(),
  } satisfies NotificationLog);

  // Update match notification timestamp
  await saveLocalOrFirestoreDoc("matches", match.id, {
    ...match,
    notification_sent_at: nowISO(),
    notification_channel: waOk ? "whatsapp" : "failed",
  });

  console.log(`[Notify] Donor ${donor.full_name} — WA:${waOk ? "sent" : "failed"}`);
  return { donorId: donor.id, whatsapp: waOk, email: false };
}

// ─── Resend email helper (server-side) ───────────────────────────────────────

async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.warn("[Email] RESEND_API_KEY not set — skipped."); return false; }
  try {
    const resend = new Resend(apiKey);
    const sender = process.env.RESEND_SENDER_EMAIL || "onboarding@resend.dev";
    const { error } = await resend.emails.send({
      from: `RaktDaan <${sender}>`,
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

function rateLimit(ip: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

function rateLimitMiddleware(max: number, windowMs = 60_000) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || "unknown";
    if (!rateLimit(ip, max, windowMs)) {
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

  const allowedOrigins = new Set([
    process.env.APP_URL,
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`,
    ...(process.env.CORS_ORIGINS || "").split(","),
  ].map((origin) => origin?.trim().replace(/\/$/, "")).filter((origin): origin is string => Boolean(origin)));

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'");
    if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

    if (!req.path.startsWith("/api")) return next();
    const origin = req.header("origin")?.replace(/\/$/, "");
    if (origin && !allowedOrigins.has(origin)) {
      return res.status(403).json({ error: "Origin not allowed." });
    }
    if (origin) {
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
        const { error } = await getServerSupabase().from("users").select("id").limit(1);
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
      const [donorLookup, requesterLookup] = await Promise.all([
        supabase.from("users").select("id").eq("email", recipient).limit(1),
        supabase.from("requesters").select("id").eq("email", recipient).limit(1),
      ]);
      if (donorLookup.error || requesterLookup.error) {
        return res.status(503).json({ error: "Unable to validate email recipient." });
      }
      recipientAllowed = Boolean(donorLookup.data?.length || requesterLookup.data?.length);
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
  app.post("/api/wa/send-otp", rateLimitMiddleware(5, 60_000), async (req, res) => {
    const { phone } = req.body || {};
    const rawPurpose = String(req.body?.purpose || "signup").toLowerCase();
    const purpose: "signup" | "sos" = rawPurpose === "sos" ? "sos" : "signup";
    if (!phone) return res.status(400).json({ error: "Phone number required" });
    const normalizedPhone = normalizePhone(phone);
    if (!isValidIndianPhone(normalizedPhone)) return res.status(400).json({ error: "Enter a valid Indian mobile number" });

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

    // Generate 6-digit random OTP
    const otp = randomInt(100000, 1_000_000).toString();
    const cacheKey = `wa_otp_${normalizedPhone}`;
    const attemptKey = `otp_attempts_${normalizedPhone}`;

    // Store OTP in redis for 5 minutes (300 seconds)
    await cacheSet(cacheKey, otp, 300);
    // Reset attempt counter on fresh send
    await cacheSet(attemptKey, '0', 300);

    const message = buildOtpMessage(otp);
    const sent = await sendWhatsApp(normalizedPhone, message);

    if (sent) {
      return res.json({ success: true, purpose, message: "OTP sent successfully" });
    } else {
      return res.status(500).json({ error: "Failed to send OTP via WhatsApp" });
    }
  });

  // ─── NEW: Email OTP Verification ────────────────────────────────────────
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
    return res.json({ success: true, message: "Email verified successfully" });
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

  app.post("/api/auth/complete-verification", rateLimitMiddleware(10, 60_000), async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });
    const { verificationToken, phone, whatsappPhone, fullName, intent, consentAccepted } = req.body || {};
    const whatsapp = whatsappPhone || phone;
    if (!verificationToken || !consentAccepted || !String(fullName || "").trim() ||
      !isValidIndianPhone(phone) || !isValidIndianPhone(whatsapp) || !["donor", "requester", "both"].includes(intent)) {
      return res.status(400).json({ error: "Complete contact, role, consent, and WhatsApp verification details." });
    }
    if (!await consumeOtpTicket(String(verificationToken), String(whatsapp), "signup")) {
      return res.status(400).json({ error: "WhatsApp verification expired. Request a new OTP." });
    }
    const consentAt = nowISO();
    const { data: profile, error } = await getServerSupabase().rpc("link_verified_auth_profile", {
      p_auth_user_id: authUser.id,
      p_phone: String(phone),
      p_whatsapp_phone: String(whatsapp),
      p_full_name: String(fullName).trim(),
      p_email: authUser.email || "",
      p_can_donate: intent === "donor" || intent === "both",
      p_can_request: intent === "requester" || intent === "both",
      p_consent_accepted_at: consentAt,
      p_provider: authUser.app_metadata?.provider || null,
    });
    if (error) {
      console.error("[Auth] Profile link failed:", error);
      return res.status(409).json({ error: "Unable to link this verified phone. Contact support if it belongs to you." });
    }
    const linked = await getLinkedProfile(authUser.id);
    return res.status(201).json({ profile, donorProfile: linked?.donorProfile || null, nextStep: nextOnboardingStep(linked) });
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
    return res.json({ donorProfile: data });
  });

  // Profiles are created by the API only after both Supabase Auth and WhatsApp OTP succeed.
  app.post("/api/profiles/donor", rateLimitMiddleware(10, 60_000), async (req, res) => {
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
        const openRequests = allRequests.filter(r =>
          ["open", "matching"].includes(r.status) &&
          (!r.expires_at || new Date(r.expires_at) > new Date())
        );
        if (openRequests.length === 0) return;
        console.log(`[DonorTrigger] New donor ${donor.full_name} registered. Checking ${openRequests.length} open request(s)...`);
        await cacheInvalidatePrefix("eligible_"); // bust cache so new donor is included
        for (const req of openRequests) {
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
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });

    // Try new profiles table first, fall back to legacy requesters collection
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
    } catch { /* profiles table may not exist yet — fall through */ }
    if (!requester) {
      requester = await getLocalOrFirestoreDoc<Requester>("requesters", authUser.id);
    }
    if (!requester) return res.status(403).json({ error: "Complete WhatsApp verification before creating a blood request." });

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
    } catch { /* fall through */ }
    if (!requester) {
      requester = await getLocalOrFirestoreDoc<Requester>("requesters", authUser.id);
    }
    if (!requester) return res.status(404).json({ error: "Requester profile not found." });
    const allRequests = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
    const requests = allRequests.filter((request) => request.requester_id === requester.id);
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
    try {
      const linked = await getLinkedProfile(authUser.id);
      if (linked?.profile?.id) donorId = linked.profile.id;
    } catch { /* fall through */ }

    const [allMatches, allRequests, allLogs] = await Promise.all([
      getLocalOrFirestoreCollection<Match>("matches"),
      getLocalOrFirestoreCollection<BloodRequest>("blood_requests"),
      getLocalOrFirestoreCollection<DonationLog>("donation_log"),
    ]);
    const matches = allMatches.filter((match) => match.donor_id === donorId || match.donor_id === authUser.id);
    const requestIds = new Set(matches.map((match) => match.request_id));
    const requests = allRequests.filter((request) => requestIds.has(request.id));
    const donationLogs = allLogs.filter((log) => log.donor_id === donorId || log.donor_id === authUser.id);
    return res.json({ matches, requests, donationLogs });
  });

  app.get("/api/requester/requests", async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });
    let requesterId = authUser.id;
    try {
      const linked = await getLinkedProfile(authUser.id);
      if (linked?.profile?.id) requesterId = linked.profile.id;
    } catch { /* fall through */ }

    const allRequests = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
    const requests = allRequests.filter((request) => request.requester_id === requesterId || request.requester_id === authUser.id);
    const requestIds = new Set(requests.map((request) => request.id));
    const allMatches = await getLocalOrFirestoreCollection<Match>("matches");
    const matches = allMatches.filter((match) => requestIds.has(match.request_id));
    const approvedDonorIds = new Set(matches.filter((match) => match.donor_response === "approved").map((match) => match.donor_id));
    const allDonors = await getLocalOrFirestoreCollection<User>("users");
    const donors = allDonors.filter((donor) => approvedDonorIds.has(donor.id));
    return res.json({ requests, matches, donors });
  });

  app.post("/api/matches/:matchId/respond", async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return res.status(401).json({ error: "Sign in is required." });
    const decision = req.body?.decision;
    if (!["approved", "declined"].includes(decision)) return res.status(400).json({ error: "Invalid response." });
    const match = await getLocalOrFirestoreDoc<Match>("matches", req.params.matchId);
    if (!match || match.donor_id !== authUser.id) return res.status(404).json({ error: "Match not found." });
    if (match.donor_response !== "pending") return res.status(409).json({ error: "This match has already been resolved." });
    const request = await getLocalOrFirestoreDoc<BloodRequest>("blood_requests", match.request_id);
    const donor = await getLocalOrFirestoreDoc<User>("users", authUser.id);
    if (!request || !donor) return res.status(404).json({ error: "Request or donor profile not found." });

    const now = nowISO();
    await saveLocalOrFirestoreDoc("matches", match.id, {
      ...match, donor_response: decision, donor_response_at: now, contact_shared_at: decision === "approved" ? now : null,
    });
    // Release reservation lock so other requests can consider this donor again on decline
    if (decision === "declined") {
      await releaseDonorLock(donor.id);
    }
    if (decision === "approved") {
      await saveLocalOrFirestoreDoc("blood_requests", request.id, { ...request, status: "partially_matched", updated_at: now });
      await sendWhatsApp(request.requester_phone, buildRequesterConfirmMessage(request, donor.full_name));
      await sendWhatsApp(donor.whatsapp_number || donor.phone, buildDonorConfirmedDetailsMessage(request, donor));
    } else {
      await createNextDonorMatch(request, match.id);
    }
    await cacheInvalidatePrefix("pending_matches_");
    await cacheInvalidatePrefix("req_status_");
    return res.json({ success: true });
  });

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

  // ─── WAHA Webhook: incoming WhatsApp reply (YES / NO) ──────────────────
  app.post("/api/waha/webhook", async (req, res) => {
    res.status(200).send("OK"); // Ack immediately

    try {
      const event = req.body;
      if (!event || event.event !== "message") return;

      const from: string = event.payload?.from || "";
      const body: string = (event.payload?.body || "").trim().toUpperCase();
      const phone = from.replace("@c.us", "").replace(/\D/g, "");

      if (!["YES", "NO"].includes(body)) return;

      console.log(`[WAHA Webhook] Reply from ${phone}: ${body}`);

      // Find donor by phone
      const allDonors = await getLocalOrFirestoreCollection<User>("users");
      const donor = allDonors.find(
        (d) =>
          normalizePhone(d.whatsapp_number || "") === phone ||
          normalizePhone(d.phone) === phone
      );
      if (!donor) return;

      // Find their pending match
      const allMatches = await getLocalOrFirestoreCollection<Match>("matches");
      const pendingMatch = allMatches.find(
        (m) => m.donor_id === donor.id && m.donor_response === "pending"
      );
      if (!pendingMatch) return;

      const request = await getLocalOrFirestoreDoc<BloodRequest>(
        "blood_requests",
        pendingMatch.request_id
      );
      if (!request) return;

      if (body === "YES") {
        // Approve match
        await saveLocalOrFirestoreDoc("matches", pendingMatch.id, {
          ...pendingMatch,
          donor_response:    "approved",
          donor_response_at: nowISO(),
          contact_shared_at: nowISO(),
        });

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
    const match = await getLocalOrFirestoreDoc<Match>("matches", req.params.matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });
    await saveLocalOrFirestoreDoc("matches", req.params.matchId, {
      ...match,
      notification_sent_at: nowISO(),
    });
    return res.json({ success: true });
  });

  // ─── Approve match ──────────────────────────────────────────────────────
  app.post("/api/matches/:matchId/approve", async (req, res) => {
    const match = await getLocalOrFirestoreDoc<Match>("matches", req.params.matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });
    if (match.donor_response !== "pending") return res.status(409).json({ error: "Already resolved" });

    const [request, donor] = await Promise.all([
      getLocalOrFirestoreDoc<BloodRequest>("blood_requests", match.request_id),
      getLocalOrFirestoreDoc<User>("users", match.donor_id),
    ]);
    if (!request || !donor) return res.status(404).json({ error: "Request or donor not found" });

    await saveLocalOrFirestoreDoc("matches", req.params.matchId, {
      ...match,
      donor_response:    "approved",
      donor_response_at: req.body?.responseTimestamp || nowISO(),
      contact_shared_at: nowISO(),
    });

    // Notify requester of approval
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

    return res.json({
      success:        true,
      requesterPhone: request.requester_phone,
      requesterName:  request.requester_name,
      donorPhone:     donor.whatsapp_number || donor.phone,
      donorName:      donor.full_name,
      hospitalName:   request.hospital_name,
      hospitalArea:   request.hospital_area,
    });
  });

  // ─── Decline match ──────────────────────────────────────────────────────
  app.post("/api/matches/:matchId/decline", async (req, res) => {
    const match = await getLocalOrFirestoreDoc<Match>("matches", req.params.matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });
    await saveLocalOrFirestoreDoc("matches", req.params.matchId, {
      ...match,
      donor_response:    "declined",
      donor_response_at: req.body?.responseTimestamp || nowISO(),
    });
    // Release reservation lock so this donor becomes available to other requests immediately
    await releaseDonorLock(match.donor_id);
    await cacheInvalidatePrefix("match_status_");
    await cacheInvalidatePrefix("pending_matches_");
    return res.json({ success: true });
  });


  // ─── Reminder sent ──────────────────────────────────────────────────────
  app.post("/api/matches/:matchId/reminder-sent", async (req, res) => {
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

    await cacheInvalidatePrefix("match_status_");
    await cacheInvalidatePrefix("pending_matches_");
    await cacheInvalidatePrefix("req_status_");
    await cacheInvalidatePrefix("eligible_");

    return res.json({ success: true });
  });

  // ─── Donation not completed ─────────────────────────────────────────────
  app.post("/api/matches/:matchId/donation-not-completed", async (req, res) => {
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

  app.get("/api/leaderboard", async (req, res) => {
    const [donors, logs] = await Promise.all([
      getLocalOrFirestoreCollection<User>("users"),
      getLocalOrFirestoreCollection<DonationLog>("donation_log")
    ]);
    const counts = logs.reduce((acc, l) => (l.donor_id && (acc[l.donor_id] = (acc[l.donor_id] || 0) + 1), acc), {} as Record<string, number>);
    const list = donors.map(d => {
      const donation_count = counts[d.id] || (d.id === "donor_rahul" ? 9 : d.id === "donor_priya" ? 4 : 0);
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

  app.get("/api/requests/:trackingCode", async (req, res) => {
    const all = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
    const request = all.find(r => r.tracking_code.toUpperCase() === req.params.trackingCode.toUpperCase().trim() || r.id === req.params.trackingCode);
    if (!request) return res.status(404).json({ error: "No active blood request found with this tracking code. Please verify the code and try again." });
    const allMatches = await getLocalOrFirestoreCollection<Match>("matches");
    const matches = allMatches.filter(m => m.request_id === request.id);
    const allDonors = await getLocalOrFirestoreCollection<User>("users");
    const donors = matches.map(m => {
      const d = allDonors.find(u => u.id === m.donor_id);
      return d ? (m.donor_response === "approved" ? d : { id: d.id, blood_type: d.blood_type, area: d.area, city: d.city } as User) : null;
    }).filter(Boolean);
    return res.json({ request, matches, donors });
  });

  app.patch("/api/requests/:trackingCode/cancel", async (req, res) => {
    const allRequests = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
    const request = allRequests.find(r => r.tracking_code === req.params.trackingCode || r.id === req.params.trackingCode);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (!await checkRequesterAuth(req, request)) return res.status(403).json({ error: "Unauthorized" });
    const updated = { ...request, status: "cancelled" as const, updated_at: nowISO() };
    await saveLocalOrFirestoreDoc("blood_requests", request.id, updated);
    await cacheInvalidatePrefix("req_status_");
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
    return res.json({ success: true, request: updated });
  });

  app.patch("/api/requests/:trackingCode/fulfill", async (req, res) => {
    const all = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
    const r = all.find(x => x.tracking_code === req.params.trackingCode || x.id === req.params.trackingCode);
    if (r) await saveLocalOrFirestoreDoc("blood_requests", r.id, { ...r, status: "fulfilled", fulfilled_at: nowISO() });
    return res.json({ success: true });
  });

  app.patch("/api/requests/:trackingCode/broadcast-toggle", async (req, res) => {
    const all = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
    const r = all.find(x => x.tracking_code === req.params.trackingCode || x.id === req.params.trackingCode);
    if (r) await saveLocalOrFirestoreDoc("blood_requests", r.id, { ...r, broadcast_to_simulator: !r.broadcast_to_simulator });
    return res.json({ success: true });
  });

  app.post("/api/notifications", async (req, res) => {
    if (req.body?.id) await saveLocalOrFirestoreDoc("notifications", req.body.id, { ...req.body, created_at: nowISO() });
    return res.json({ success: true });
  });

  // ─── Delete Notification(s) ─────────────────────────────────────────────
  app.delete("/api/notifications/:notifId", async (req, res) => {
    try {
      const supabase = getServerSupabase();
      if (req.params.notifId === "all") {
        await supabase.from("notifications").delete().neq("id", "dummy");
      } else {
        await supabase.from("notifications").delete().eq("id", req.params.notifId);
      }
    } catch { /* ignore fallback */ }
    return res.json({ success: true });
  });

  // ─── Admin Actions ──────────────────────────────────────────────────────
  const adminCheck = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authUser = await getAuthenticatedUser(req);
    const adminEmails = (process.env.ADMIN_EMAILS || "admin@raktdaan.org").split(",").map(e => e.trim().toLowerCase());
    if (!authUser || !authUser.email || !adminEmails.includes(authUser.email.toLowerCase())) {
      return res.status(403).json({ error: "Access denied." });
    }
    next();
  };

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
    const { matchId, payload } = req.body;
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] running on http://localhost:${PORT} in ${process.env.NODE_ENV || "development"} mode`);

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
  const lockVal = await cacheGet<string>(WORKER_LOCK_KEY);
  if (lockVal) {
    console.log("[Worker] Skipped — previous run still active.");
    return;
  }
  await cacheSet(WORKER_LOCK_KEY, "1", WORKER_LOCK_TTL_S);

  try {
    const now = new Date();
    const allRequests = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
    const activeRequests = allRequests.filter(r => ["open", "matching"].includes(r.status));

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
        if (request && ["open", "matching"].includes(request.status)) {
          try {
            await createNextDonorMatch(request, match.id);
          } catch (e: any) {
            console.error(`[Worker] Cascade failed for request ${match.request_id}:`, e.message);
          }
        }
      }
    }

    // ── Step 3: Re-run matching for all still-active requests ──
    const stillActive = allRequests.filter(
      r => ["open", "matching"].includes(r.status) &&
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
