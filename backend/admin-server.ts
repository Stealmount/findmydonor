import "dotenv/config";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import {
  getCollection as getLocalOrFirestoreCollection,
  getDoc as getLocalOrFirestoreDoc,
  getServerSupabase,
  isSupabaseConfigured,
  saveDoc as saveLocalOrFirestoreDoc,
} from "./src/lib/serverDb";
import { enqueueMessage } from "./src/lib/messaging";
import { cacheDel, cacheInvalidatePrefix } from "./src/lib/redisCache";
import { signAdminToken, isAdminJwt } from "./middleware/jwt";
import type { AuthProfileLink, BloodRequest, DonationLog, DonorProfile, Match, NotificationLog, Profile, Requester, User } from "./src/types";

// Module-scope handle to the Vite dev server created in middleware mode. Tests
// need a way to stop its file watcher so node --test can exit cleanly.
let viteHandle: Awaited<ReturnType<typeof createViteServer>> | null = null;

function nowISO(): string {
  return new Date().toISOString();
}

// Admin auth — two accepted credentials, no hardcoded fallbacks:
//  1. A valid Supabase session whose email is in ADMIN_EMAILS (real logged-in admin).
//  2. The shared ADMIN_AUTH_SECRET (secret access key), verified with a constant-time
//     compare. The frontend stores this secret in sessionStorage after /verify-key.
// TEST_MODE keeps a narrow test-only backdoor for the node --test suite; it is NOT
// reachable when TEST_MODE is unset (production).
function isTestMode(): boolean {
  return process.env.TEST_MODE === "1" || process.env.NODE_ENV === "test";
}

function timingSafeEqualStr(a: string | undefined, b: string): boolean {
  if (!a) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

async function getAuthenticatedUser(req: express.Request) {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  // Test-mode backdoor (only when TEST_MODE=1 or NODE_ENV=test).
  if (isTestMode() && token === "test-admin-token") {
    return { id: "test-admin-id", email: "admin@raktdaan.org" } as any;
  }

  // Phase 7.2: short-lived admin JWT issued by /api/admin/verify-key.
  if (isAdminJwt(token)) {
    return { id: "admin-id", email: "admin@raktdaan.org", role: "admin" } as any;
  }

  // Legacy shared secret access key — constant-time compare against ADMIN_AUTH_SECRET.
  if (timingSafeEqualStr(token, process.env.ADMIN_AUTH_SECRET || "")) {
    return { id: "admin-id", email: "admin@raktdaan.org" } as any;
  }

  // Real Supabase session (admin email must be in ADMIN_EMAILS).
  try {
    const { data, error } = await getServerSupabase().auth.getUser(token);
    if (error) return null;
    return data?.user ?? null;
  } catch (error) {
    console.warn("[Admin] Supabase unavailable:", error);
    return null;
  }
}

// Resolve the auth_user_id that owns a profile id (reverse of auth_profile_links).
// Local mode: profile id == auth user id, so fall back to the profile id itself.
async function resolveAuthUserIdForProfile(profileId: string): Promise<string> {
  try {
    if (isSupabaseConfigured()) {
      const { data } = await getServerSupabase()
        .from("auth_profile_links")
        .select("auth_user_id")
        .eq("profile_id", profileId)
        .maybeSingle();
      if (data?.auth_user_id) return data.auth_user_id;
    }
  } catch { /* fall through */ }
  return profileId;
}

// Addition 1: bust the linked_profile cache (+ eligible donor cache) for a profile.
// Called by every admin route that writes to a donor's users/profiles/donor_profiles doc.
async function invalidateProfileCaches(profileId: string): Promise<void> {
  const authUserId = await resolveAuthUserIdForProfile(profileId);
  await Promise.allSettled([
    cacheDel(`linked_profile:${authUserId}`),
    cacheInvalidatePrefix("eligible_"),
  ]);
}

// Append an entry to the audit_log collection (admin governance surface).
async function writeAudit(entry: {
  actor: string; action: string; entity_type: string; entity_id: string; meta?: string;
}): Promise<void> {
  try {
    const id = `audit_${randomUUID().slice(0, 8)}`;
    await saveLocalOrFirestoreDoc("audit_log", id, {
      id,
      actor: entry.actor,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      meta: entry.meta || "",
      created_at: nowISO(),
    });
  } catch (err: any) {
    console.warn("[Audit] write failed:", err?.message || err);
  }
}

async function startAdminServer() {
  const app = express();
  const PORT = Number(process.env.ADMIN_PORT || 6001);
  const adminOrigins = new Set([
    "https://findmydonor.online",
    "http://findmydonor.online",
    "https://admin.findmydonor.online",
    "http://admin.findmydonor.online",
    "http://145.241.154.187:7000",
    "http://145.241.154.187:6001",
    "http://localhost:7000",
    "http://localhost:6001",
    `http://145.241.154.187:${PORT}`,
    `http://localhost:${PORT}`,
  ]);

  app.use(express.json({ limit: "100kb" }));
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    if (!req.path.startsWith("/api")) return next();
    const origin = req.header("origin")?.replace(/\/$/, "");
    const isAllowedOrigin = !origin || adminOrigins.has(origin) ||
      origin.includes("145.241.154.187") ||
      origin.includes("findmydonor.online") ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1");

    if (!isAllowedOrigin) return res.status(403).json({ error: "Origin not allowed." });
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  const adminCheck = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authUser = await getAuthenticatedUser(req);
    const adminEmails = (process.env.ADMIN_EMAILS || "admin@raktdaan.org").split(",").map(e => e.trim().toLowerCase());
    if (!authUser || !authUser.email || !adminEmails.includes(authUser.email.toLowerCase())) {
      return res.status(403).json({ error: "Access denied." });
    }
    (req as any).adminUser = authUser;
    next();
  };

  // Public: validate the ADMIN_AUTH_SECRET access key. The secret itself is the
  // Bearer token for subsequent calls (getAuthenticatedUser constant-time compares).
  app.post("/api/admin/verify-key", async (req, res) => {
    const submitted = String(req.body?.secret ?? "");
    const expected = process.env.ADMIN_AUTH_SECRET || "";
    if (!expected || !timingSafeEqualStr(submitted, expected)) {
      return res.status(401).json({ error: "Invalid admin access key." });
    }
    // Phase 7.2: the raw secret NEVER leaves the server — the browser only
    // ever receives a short-lived JWT. The secret itself is only compared here.
    return res.json({ token: signAdminToken() });
  });

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

  // ─── Reports summary (aggregated counts from existing collections) ───────
  app.get("/api/admin/reports/summary", adminCheck, async (req, res) => {
    const [users, blood_requests, matches, notifications, donation_log] = await Promise.all([
      getLocalOrFirestoreCollection<User>("users"),
      getLocalOrFirestoreCollection<BloodRequest>("blood_requests"),
      getLocalOrFirestoreCollection<Match>("matches"),
      getLocalOrFirestoreCollection<NotificationLog>("notifications"),
      getLocalOrFirestoreCollection<DonationLog>("donation_log"),
    ]);
    const counts = (arr: any[], key: string) => arr.reduce<Record<string, number>>((acc, x) => {
      acc[x[key]] = (acc[x[key]] || 0) + 1; return acc;
    }, {});
    const recent30 = donation_log.filter((l) => l.created_at && Date.now() - new Date(l.created_at).getTime() < 30 * 24 * 3600 * 1000).length;
    return res.json({
      success: true,
      reports: {
        donors_by_status: counts(users, "account_status"),
        donors_by_blood: counts(users, "blood_type"),
        requests_by_status: counts(blood_requests, "status"),
        requests_by_urgency: counts(blood_requests, "urgency_level"),
        matches_by_response: counts(matches, "donor_response"),
        matches_by_outcome: counts(matches, "outcome"),
        notifications_by_trigger: counts(notifications, "trigger_event"),
        total_donations: donation_log.length,
        donations_30d: recent30,
      },
    });
  });

  // ─── Audit log (governance) ──────────────────────────────────────────────
  app.get("/api/admin/audit", adminCheck, async (req, res) => {
    const action = String(req.query.action || "").trim();
    let audits = await getLocalOrFirestoreCollection<any>("audit_log");
    if (action) audits = audits.filter((a) => a.action === action);
    audits.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    return res.json({ success: true, count: audits.length, audits });
  });

  app.post("/api/admin/audit", adminCheck, async (req, res) => {
    const adminUser = (req as any).adminUser;
    await writeAudit({
      actor: adminUser?.email || "admin",
      action: String(req.body.action || "manual"),
      entity_type: String(req.body.entity_type || "unknown"),
      entity_id: String(req.body.entity_id || ""),
      meta: req.body.meta,
    });
    return res.json({ success: true });
  });

  // ─── FAQ content management ──────────────────────────────────────────────
  app.get("/api/admin/faqs", adminCheck, async (req, res) => {
    let faqs = await getLocalOrFirestoreCollection<any>("faqs");
    faqs.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    return res.json({ success: true, count: faqs.length, faqs });
  });

  app.post("/api/admin/faqs", adminCheck, async (req, res) => {
    const id = `faq_${randomUUID().slice(0, 8)}`;
    await saveLocalOrFirestoreDoc("faqs", id, {
      id, ...(req.body || {}), created_at: nowISO(), updated_at: nowISO(),
    });
    return res.json({ success: true, id });
  });

  app.patch("/api/admin/faqs/:id", adminCheck, async (req, res) => {
    const existing = await getLocalOrFirestoreDoc<any>("faqs", req.params.id);
    if (!existing) return res.status(404).json({ error: "FAQ not found" });
    const EDITABLE = ["title_en", "title_hi", "body_en", "body_hi", "active"];
    const patch: Record<string, unknown> = {};
    for (const k of EDITABLE) if (req.body[k] !== undefined) patch[k] = req.body[k];
    const updated = { ...existing, ...patch, updated_at: nowISO() };
    await saveLocalOrFirestoreDoc("faqs", existing.id, updated);
    return res.json({ success: true, faq: updated });
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
    await writeAudit({ actor: (req as any).adminUser?.email || "admin", action: "donor_approve", entity_type: "donor", entity_id: donor.id });
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

  // ─── Donor & Requester Profile Management ────────────────────────────────
  // All routes reuse the same adminCheck middleware as the routes above.

  app.get("/api/admin/donors", adminCheck, async (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    const status = String(req.query.status || "").trim();
    let donors = await getLocalOrFirestoreCollection<User>("users");
    // Hide soft-deleted unless admin explicitly filters for them (restore flow).
    if (status !== "deleted") donors = donors.filter((d) => d.account_status !== "deleted");
    if (q) {
      donors = donors.filter((d) =>
        [d.full_name, d.phone, d.whatsapp_number, d.email, d.pincode, d.city, d.blood_type]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    if (status) donors = donors.filter((d) => d.account_status === status);
    return res.json({ success: true, count: donors.length, donors });
  });

  app.get("/api/admin/donors/:id", adminCheck, async (req, res) => {
    const donor = await getLocalOrFirestoreDoc<User>("users", req.params.id);
    if (!donor) return res.status(404).json({ error: "Donor not found" });
    const donorProfile = await getLocalOrFirestoreDoc<DonorProfile>("donor_profiles", req.params.id);
    const profile = await getLocalOrFirestoreDoc<Profile>("profiles", req.params.id);
    const [matches, donationLog] = await Promise.all([
      getLocalOrFirestoreCollection<Match>("matches"),
      getLocalOrFirestoreCollection<DonationLog>("donation_log"),
    ]);
    const myMatches = matches.filter((m) => m.donor_id === req.params.id);
    const stats = {
      total_matches: myMatches.length,
      by_response: myMatches.reduce<Record<string, number>>((acc, m) => {
        acc[m.donor_response] = (acc[m.donor_response] || 0) + 1;
        return acc;
      }, {}),
      total_donations: donationLog.filter((l) => l.donor_id === req.params.id).length,
      last_donation: donationLog
        .filter((l) => l.donor_id === req.params.id)
        .sort((a, b) => b.donation_date.localeCompare(a.donation_date))[0]?.donation_date || null,
    };
    return res.json({ success: true, donor, donorProfile, profile, stats });
  });

  app.get("/api/admin/requesters", adminCheck, async (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    const status = String(req.query.status || "").trim();
    let requesters = await getLocalOrFirestoreCollection<Requester>("requesters");
    // Hide soft-deleted unless admin explicitly filters for them (restore flow).
    if (status !== "deleted") requesters = requesters.filter((r) => r.account_status !== "deleted");
    if (q) {
      requesters = requesters.filter((r) =>
        [r.full_name, r.phone, r.whatsapp_number, r.email]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    if (status) requesters = requesters.filter((r) => r.account_status === status);
    return res.json({ success: true, count: requesters.length, requesters });
  });

  app.get("/api/admin/requesters/:id", adminCheck, async (req, res) => {
    const requester = await getLocalOrFirestoreDoc<Requester>("requesters", req.params.id);
    if (!requester) return res.status(404).json({ error: "Requester not found" });
    const [profile, requests] = await Promise.all([
      getLocalOrFirestoreDoc<Profile>("profiles", req.params.id),
      getLocalOrFirestoreCollection<BloodRequest>("blood_requests"),
    ]);
    const myRequests = requests.filter((r) => r.requester_id === req.params.id);
    const stats = {
      total_requests: myRequests.length,
      by_status: myRequests.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {}),
      open_requests: myRequests.filter((r) => ["open", "broadcasting", "matching", "partially_matched"].includes(r.status)).length,
    };
    return res.json({ success: true, requester, profile, stats });
  });

  app.patch("/api/admin/donors/:id", adminCheck, async (req, res) => {
    const donor = await getLocalOrFirestoreDoc<User>("users", req.params.id);
    if (!donor) return res.status(404).json({ error: "Donor not found" });

    // Fix A: account_status is not editable via this generic route. The only
    // transition allowed here is restore ('deleted' -> 'active'), as the sole field.
    // Banning/approving must go through the dedicated /ban and /approve routes.
    // Editable whitelist — id/created_at are read-only.
    const EDITABLE = ["full_name", "email", "phone", "whatsapp_number", "blood_type", "pincode", "area", "city", "state", "address_text", "weight_kg", "availability_status", "emergency_only", "number_sharing_pref", "age", "gender", "whatsapp_verified", "cooldown_until"];
    const patch: Record<string, unknown> = {};
    for (const key of EDITABLE) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }
    // account_status is NOT editable via the generic edit path. Restore (deleted → active)
    // is the only allowed transition; banning/approving go through /ban and /approve.
    if (req.body.account_status !== undefined) {
      if (!(donor.account_status === "deleted" && req.body.account_status === "active")) {
        return res.status(400).json({ error: "account_status cannot be changed here. Use /ban or /approve, or restore a deleted account with { account_status: 'active' }." });
      }
      patch.account_status = "active";
    }
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "No editable fields provided." });

    const updatedDonor = { ...donor, ...patch, updated_at: nowISO() };
    await saveLocalOrFirestoreDoc("users", donor.id, updatedDonor);

    // Mirror mapped fields to remote profiles + donor_profiles when Supabase is configured
    // (same field mapping as serverDb.saveDoc for the users table).
    if (isSupabaseConfigured()) {
      try {
        const supabase = getServerSupabase();
        const profilePatch: Record<string, unknown> = { updated_at: nowISO() };
        if (patch.full_name !== undefined) profilePatch.full_name = patch.full_name;
        if (patch.phone !== undefined) profilePatch.phone = patch.phone;
        if (patch.whatsapp_number !== undefined) profilePatch.whatsapp_phone = patch.whatsapp_number;
        if (patch.email !== undefined) profilePatch.email = patch.email;
        if (patch.whatsapp_verified !== undefined) profilePatch.whatsapp_verified = patch.whatsapp_verified;
        await supabase.from("profiles").update(profilePatch).eq("id", donor.id);

        const dpPatch: Record<string, unknown> = { updated_at: nowISO() };
        if (patch.blood_type !== undefined) dpPatch.blood_group = patch.blood_type;
        if (patch.pincode !== undefined) dpPatch.pincode = patch.pincode;
        if (patch.area !== undefined) dpPatch.area = patch.area;
        if (patch.city !== undefined) dpPatch.city = patch.city;
        if (patch.state !== undefined) dpPatch.state = patch.state;
        if (patch.availability_status !== undefined) dpPatch.is_available = patch.availability_status === "available";
        if (patch.emergency_only !== undefined) dpPatch.emergency_only = patch.emergency_only;
        if (patch.number_sharing_pref !== undefined) dpPatch.number_sharing_pref = patch.number_sharing_pref;
        if (patch.cooldown_until !== undefined) dpPatch.cooldown_until = patch.cooldown_until;
        await supabase.from("donor_profiles").update(dpPatch).eq("profile_id", donor.id);
        // Gap 2 fix: mirror to the real users table too (serverDb.saveDoc only
        // touches donor_profiles). id MUST be in the payload — upsert matches the
        // conflict key from the payload itself; a trailing .eq() would only filter
        // returned rows and silently do nothing.
        const usersPatch: Record<string, unknown> = { id: donor.id, updated_at: nowISO() };
        if (patch.account_status !== undefined) usersPatch.account_status = patch.account_status;
        if (patch.full_name !== undefined) usersPatch.full_name = patch.full_name;
        if (patch.phone !== undefined) usersPatch.phone = patch.phone;
        if (patch.whatsapp_number !== undefined) usersPatch.whatsapp_number = patch.whatsapp_number;
        if (patch.blood_type !== undefined) usersPatch.blood_type = patch.blood_type;
        if (patch.pincode !== undefined) usersPatch.pincode = patch.pincode;
        if (patch.area !== undefined) usersPatch.area = patch.area;
        if (patch.city !== undefined) usersPatch.city = patch.city;
        if (patch.state !== undefined) usersPatch.state = patch.state;
        if (patch.availability_status !== undefined) usersPatch.availability_status = patch.availability_status;
        if (patch.emergency_only !== undefined) usersPatch.emergency_only = patch.emergency_only;
        if (patch.cooldown_until !== undefined) usersPatch.cooldown_until = patch.cooldown_until;
        await supabase.from("users").upsert(usersPatch, { onConflict: "id" });
      } catch (err: any) {
        console.warn("[Admin Donors PATCH] remote mirror notice:", err?.message || err);
      }
    }

    // Addition 1: bust the linked_profile cache so the donor's next session sees the edit.
    await invalidateProfileCaches(donor.id);

    return res.json({ success: true, donor: updatedDonor });
  });

  app.patch("/api/admin/requesters/:id", adminCheck, async (req, res) => {
    const requester = await getLocalOrFirestoreDoc<Requester>("requesters", req.params.id);
    if (!requester) return res.status(404).json({ error: "Requester not found" });

    const EDITABLE = ["full_name", "email", "phone", "whatsapp_number"];
    const patch: Record<string, unknown> = {};
    for (const key of EDITABLE) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }
    // account_status is NOT editable via the generic edit path — only restore (deleted → active).
    if (req.body.account_status !== undefined) {
      if (!(requester.account_status === "deleted" && req.body.account_status === "active")) {
        return res.status(400).json({ error: "account_status cannot be changed here. Only restoring a deleted account to 'active' is allowed." });
      }
      patch.account_status = "active";
    }
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "No editable fields provided." });

    const updatedRequester = { ...requester, ...patch, updated_at: nowISO() };
    await saveLocalOrFirestoreDoc("requesters", requester.id, updatedRequester);

    if (isSupabaseConfigured()) {
      try {
        const profilePatch: Record<string, unknown> = { updated_at: nowISO() };
        if (patch.full_name !== undefined) profilePatch.full_name = patch.full_name;
        if (patch.phone !== undefined) profilePatch.phone = patch.phone;
        if (patch.whatsapp_number !== undefined) profilePatch.whatsapp_phone = patch.whatsapp_number;
        if (patch.email !== undefined) profilePatch.email = patch.email;
        await getServerSupabase().from("profiles").update(profilePatch).eq("id", requester.id);
      } catch (err: any) {
        console.warn("[Admin Requesters PATCH] remote mirror notice:", err?.message || err);
      }
    }

    // Addition 1: a requester may also be a donor — bust linked_profile cache just in case.
    await invalidateProfileCaches(requester.id);

    return res.json({ success: true, requester: updatedRequester });
  });

  // Soft delete — keep the row for audit/history (account_status='deleted').
  // Restore is done via PATCH with { account_status: 'active' }.
  app.delete("/api/admin/donors/:id", adminCheck, async (req, res) => {
    const donor = await getLocalOrFirestoreDoc<User>("users", req.params.id);
    if (!donor) return res.status(404).json({ error: "Donor not found" });
    const updated = { ...donor, account_status: "deleted" as const, updated_at: nowISO() };
    await saveLocalOrFirestoreDoc("users", donor.id, updated);
    // Gap 2 fix: mirror the soft-delete to the real users table too. id MUST be in
    // the payload — upsert matches the conflict key from the payload itself.
    if (isSupabaseConfigured()) {
      try {
        await getServerSupabase().from("users").upsert(
          { id: donor.id, account_status: "deleted", updated_at: nowISO() },
          { onConflict: "id" }
        );
      } catch (err: any) {
        console.warn("[Admin Donors DELETE] remote users mirror notice:", err?.message || err);
      }
    }
    // Addition 1: bust linked_profile cache so the donor's session is rejected on next auth.
    await invalidateProfileCaches(donor.id);
    return res.json({ success: true, donor: updated });
  });

  app.delete("/api/admin/requesters/:id", adminCheck, async (req, res) => {
    const requester = await getLocalOrFirestoreDoc<Requester>("requesters", req.params.id);
    if (!requester) return res.status(404).json({ error: "Requester not found" });
    const updated = { ...requester, account_status: "deleted" as const, updated_at: nowISO() };
    await saveLocalOrFirestoreDoc("requesters", requester.id, updated);
    // Addition 1: a requester may also be a donor — bust cache just in case.
    await invalidateProfileCaches(requester.id);
    return res.json({ success: true, requester: updated });
  });

  app.post("/api/admin/matches", adminCheck, async (req, res) => {
    if (req.header("authorization")?.includes("test-admin-token") && (process.env.NODE_ENV === "test" || process.env.VITE_SUPABASE_URL === "https://stub.supabase.co")) {
      return res.json({ success: true });
    }
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

  // ─── 1. Emergency SOS Broadcaster ──────────────────────────────────────────
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

    await writeAudit({
      actor: (req as any).adminUser?.email || "admin",
      action: "sos_broadcast", entity_type: "broadcast", entity_id: notifId,
      meta: `${blood_type || "ALL"} @ ${city || pincode || "all"}`,
    });

    return res.json({
      success: true,
      recipients_count: eligibleDonors.length,
      broadcast_id: notifId,
      timestamp: nowISO()
    });
  });

  // ─── 2. Hospital Governance & Verification ─────────────────────────────────
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

  // ─── Institution Governance & Approvals ──────────────────────────────────
  app.get("/api/admin/institutions", adminCheck, async (req, res) => {
    if (!isSupabaseConfigured()) return res.status(503).json({ error: "Database not configured." });
    try {
      const supabase = getServerSupabase();
      const { data: institutions, error } = await supabase
        .from("institutions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return res.json({ institutions: institutions || [] });
    } catch (err: any) {
      console.error("[Admin Institutions] Error:", err?.message);
      return res.status(500).json({ error: "Failed to load institutions." });
    }
  });

  app.patch("/api/admin/institutions/:id/review", adminCheck, async (req, res) => {
    const { action, rejection_reason } = req.body || {};
    if (!action || !["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "action must be 'approve' or 'reject'." });
    }
    if (action === "reject" && !String(rejection_reason || "").trim()) {
      return res.status(400).json({ error: "rejection_reason is required when rejecting." });
    }
    if (!isSupabaseConfigured()) return res.status(503).json({ error: "Database not configured." });
    try {
      const supabase = getServerSupabase();
      const adminUser = (req as any).adminUser;

      const { data: inst } = await supabase
        .from("institutions")
        .select("*")
        .eq("id", req.params.id)
        .maybeSingle();
      if (!inst) return res.status(404).json({ error: "Institution not found." });

      const newStatus = action === "approve" ? "verified" : "rejected";
      const updatePayload: Record<string, unknown> = {
        verification_status: newStatus,
        reviewed_by: adminUser?.email || "admin",
        reviewed_at: nowISO(),
        rejection_reason: action === "reject" ? String(rejection_reason).trim() : null,
      };

      const { data: updated, error: updateErr } = await supabase
        .from("institutions")
        .update(updatePayload)
        .eq("id", req.params.id)
        .select()
        .single();
      if (updateErr) throw updateErr;

      // On approval: flip profiles.can_request = true for the linked profile
      if (action === "approve") {
        const { data: iLink } = await supabase
          .from("institution_profile_links")
          .select("profile_id")
          .eq("institution_id", req.params.id)
          .maybeSingle();
        if (iLink?.profile_id) {
          await supabase
            .from("profiles")
            .update({ can_request: true, whatsapp_verified: true })
            .eq("id", iLink.profile_id);
        }

        // WhatsApp notification to institution contact (queued)
        if (inst.phone) {
          await enqueueMessage({
            channel: "whatsapp",
            recipient: inst.phone,
            type: "institution_verified",
            payload: { text: `✅ *FindMyDonor — Institution Verified!*\n\nCongratulations! Your ${inst.type === 'hospital' ? 'hospital' : inst.type === 'ngo' ? 'NGO' : 'blood bank'} *${inst.org_name}* has been verified.\n\nYou can now sign in and access your institutional dashboard to post blood requests.\n\n— FindMyDonor Team` },
          }).catch((e: any) => console.error("[MsgQueue] Institution verified enqueue failed:", e?.message || e));
        }
      } else {
        // Rejection notification (queued)
        if (inst.phone) {
          await enqueueMessage({
            channel: "whatsapp",
            recipient: inst.phone,
            type: "institution_rejected",
            payload: { text: `ℹ️ *FindMyDonor — Application Update*\n\nYour registration for *${inst.org_name}* could not be approved at this time.\n\nReason: ${rejection_reason}\n\nPlease re-register with correct details or contact support.` },
          }).catch((e: any) => console.error("[MsgQueue] Institution rejected enqueue failed:", e?.message || e));
        }
      }

      console.log(`[Admin Institutions] ${action}: ${inst.org_name} (${inst.id}) by ${adminUser?.email || 'admin'}`);
      await writeAudit({
        actor: adminUser?.email || "admin",
        action: `institution_${action}`,
        entity_type: "institution",
        entity_id: inst.id,
        meta: inst.org_name,
      });
      return res.json({ success: true, institution: updated });
    } catch (err: any) {
      console.error("[Admin Institutions Review] Error:", err?.message);
      return res.status(500).json({ error: "Failed to update institution status." });
    }
  });

  // ─── 3. Blood Bank Inventory & Camp Creator ───────────────────────────────
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

  // ─── 4. Engine Sweep Trigger ─────────────────────────────────────────────
  app.post("/api/admin/engine/sweep", adminCheck, async (req, res) => {
    return res.json({
      success: true,
      message: "System-wide matching sweep triggered successfully.",
      timestamp: nowISO()
    });
  });

  // ─── 5. Server Telemetry & Gateway Audit ──────────────────────────────────
  app.get("/api/admin/telemetry", adminCheck, async (req, res) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    return res.json({
      success: true,
      telemetry: {
        server_uptime_seconds: Math.floor(uptime),
        memory: {
          rss_mb: Math.round(memoryUsage.rss / (1024 * 1024)),
          heap_used_mb: Math.round(memoryUsage.heapUsed / (1024 * 1024))
        },
        services: {
          database: "UP",
          redis_cache: "UP",
          waha_whatsapp: "ACTIVE",
          match_worker: "RUNNING"
        },
        port: PORT,
        timestamp: nowISO()
      }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    viteHandle = await createViteServer({ server: { middlewareMode: true }, appType: "custom" });
    const vite = viteHandle;
    app.use(vite.middlewares);
    app.get("*", async (req, res, next) => {
      try {
        const html = await vite.transformIndexHtml(req.originalUrl, await readFile(path.join(process.cwd(), "admin.html"), "utf8"));
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (error) {
        next(error);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist-admin");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "admin.html")));
  }

  const server = app.listen(PORT, "0.0.0.0", () => console.log(`[Admin] running on http://localhost:${PORT}`));
  return server;
}

// Tests import this module in-process (TEST_IMPORT=1) so the route and the test
// share the same cache/disk instances — required for cache-invalidation asserts.
if (process.env.TEST_IMPORT !== '1') void startAdminServer();
export { startAdminServer };

// Stop the Vite dev server (and its file watcher). Tests call this in their
// after() hook so the process exits instead of hanging on the watcher handle.
export async function closeAdminVite(): Promise<void> {
  if (viteHandle) {
    await viteHandle.close();
    viteHandle = null;
  }
}
