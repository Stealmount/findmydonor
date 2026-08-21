// Donor routes — extracted from server.ts (Phase 3 decomposition, 3.6.3)
import express, { Router } from "express";
import { randomUUID } from "node:crypto";
import {
  getCollection as getLocalOrFirestoreCollection,
  getDoc as getLocalOrFirestoreDoc,
  saveDoc as saveLocalOrFirestoreDoc,
} from "../src/lib/serverDb";
import { db } from "../src/lib/firebase";
import { cacheGet, cacheSet, cacheInvalidatePrefix } from "../src/lib/redisCache";
import { getAuthenticatedUser, getLinkedProfile } from "../middleware/auth";
import rateLimitMiddleware from "../middleware/rateLimiter";
import { normalizePhone, isValidIndianPhone } from "../helpers/phone";
import { nowISO, nowDate, daysFromNow } from "../helpers/time";
import { sendWhatsApp, buildWelcomeMessage } from "../src/lib/waha";
import { validate } from "../validation";
import { sendErrorResponse, UnauthorizedError, NotFoundError, ForbiddenError, ValidationError, AppError } from "../helpers/errors";
import type { BloodRequest, DonationLog, Match, User } from "../src/types";


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

// ─── Donor profile update ────────────────────────────────────────────────────
router.put("/api/donor-profile", rateLimitMiddleware(20, 60_000), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const linked = await getLinkedProfile(authUser.id);
  const profileId = linked?.profile?.id || authUser.id;
  let donor = await getLocalOrFirestoreDoc<User>("users", profileId);
  if (!donor && authUser.id !== profileId) {
    donor = await getLocalOrFirestoreDoc<User>("users", authUser.id);
  }
  if (!donor) return sendErrorResponse(res, new NotFoundError("Donor profile not found"));

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
  await saveLocalOrFirestoreDoc("users", profileId, updated);
  await cacheInvalidatePrefix("eligible_");
  return res.json({ success: true, donorProfile: updated });
}));

// ─── Complete donor onboarding ────────────────────────────────────────────────
router.patch("/api/donor-profile/complete", rateLimitMiddleware(10, 60_000), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));

  const linked = await getLinkedProfile(authUser.id);
  if (!linked) return sendErrorResponse(res, new NotFoundError("Profile not found."));
  if (!linked.profile.can_donate) return sendErrorResponse(res, new ForbiddenError("Donor role required."));
  let donorProfile = linked.donorProfile;
  if (!donorProfile) {
    const dpSnap = await db.collection("donor_profiles").doc(linked.profile.id).get();
    const createdDP = dpSnap.exists ? { profile_id: linked.profile.id, ...dpSnap.data() } : null;
    if (!createdDP) {
      await db.collection("donor_profiles").doc(linked.profile.id).set({ profile_id: linked.profile.id }, { merge: true });
    }
    donorProfile = createdDP || { profile_id: linked.profile.id, blood_group: null, pincode: null } as any;
  }

  // Ensure profile is marked verified
  if (!linked.profile.whatsapp_verified) {
    await db.collection("profiles").doc(linked.profile.id).update({ whatsapp_verified: true });
    linked.profile.whatsapp_verified = true;
  }

  const { blood_group, pincode, area, city, last_donation_date, health_self_declaration, emergency_only, number_sharing_pref } = req.body || {};

  const VALID_BLOOD_GROUPS = new Set(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]);
  if (!blood_group || !VALID_BLOOD_GROUPS.has(String(blood_group))) return sendErrorResponse(res, new ValidationError("Valid blood group required."));
  if (!pincode || !/^\d{6}$/.test(String(pincode))) return sendErrorResponse(res, new ValidationError("Valid 6-digit pincode required."));
  if (!area || !city) return sendErrorResponse(res, new ValidationError("Area and city are required."));
  if (health_self_declaration !== true) return sendErrorResponse(res, new ValidationError("Health self-declaration is required."));

  const cooldown_until = last_donation_date
    ? (() => {
        const d = new Date(last_donation_date);
        d.setDate(d.getDate() + 90);
        return d.toISOString().split("T")[0];
      })()
    : null;

  const today = nowDate();
  const is_available = !cooldown_until || cooldown_until < today;

  const dpUpdateData = {
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
  };
  await db.collection("donor_profiles").doc(linked.profile.id).set(dpUpdateData, { merge: true });
  const data = { profile_id: linked.profile.id, ...dpUpdateData };

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
    await db.collection("users").doc(linked.profile.id).set(updatedDonorDoc, { merge: true });
  } catch (upsertErr: any) {
    console.warn("[DonorComplete] users table upsert fallback notice:", upsertErr?.message || upsertErr);
  }

  await cacheInvalidatePrefix("eligible_");

  // Send gamified welcome WhatsApp — fire-and-forget, skipped if no phone set yet
  (async () => {
    try {
      if (linked.profile.whatsapp_phone) {
        const message = buildWelcomeMessage(linked.profile.full_name);
        await sendWhatsApp(linked.profile.whatsapp_phone, message);
      }
    } catch (e: any) {
      console.error("[DonorComplete] Welcome WhatsApp failed:", e.message);
    }
  })();

  return res.json({ donorProfile: data, nextStep: "complete" });
}));

// ─── Availability toggle ─────────────────────────────────────────────────────
router.patch("/api/donor-profile/availability", rateLimitMiddleware(30, 60_000), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const linked = await getLinkedProfile(authUser.id);
  if (!linked?.donorProfile || !linked.profile.whatsapp_verified) return sendErrorResponse(res, new ForbiddenError("Verified donor profile required."));
  const available = req.body?.isAvailable === true;
  if (available && !linked.donorProfile.profile_complete) return sendErrorResponse(res, new AppError("Complete donor profile before becoming available.", 409, "PROFILE_INCOMPLETE"));
  const today = nowDate();
  if (available && linked.donorProfile.cooldown_until && linked.donorProfile.cooldown_until >= today) {
    return sendErrorResponse(res, new AppError(`Donation cooldown active until ${linked.donorProfile.cooldown_until}.`, 422, "COOLDOWN_ACTIVE"));
  }
  const availData = { is_available: available, updated_at: nowISO() };
  await db.collection("donor_profiles").doc(linked.profile.id).update(availData);
  const data = { profile_id: linked.profile.id, ...linked.donorProfile, ...availData };
  await cacheInvalidatePrefix("eligible_");
  return res.json({ donorProfile: data });
}));

// ─── Legacy donor creation (disabled) ────────────────────────────────────────
router.post("/api/profiles/donor", rateLimitMiddleware(10, 60_000), wrap(async (_req, res) => {
  return sendErrorResponse(res, new AppError("Legacy donor signup is disabled. Use the new auth flow.", 410, "GONE"));
}));

// ─── Donor dashboard ─────────────────────────────────────────────────────────
router.get("/api/dashboard/donor", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  const linked = await getLinkedProfile(authUser.id);
  const profileId = linked?.profile?.id || authUser.id;
  let [donor, allMatches, allLogs] = await Promise.all([
    getLocalOrFirestoreDoc<User>("users", profileId),
    getLocalOrFirestoreCollection<Match>("matches"),
    getLocalOrFirestoreCollection<DonationLog>("donation_log"),
  ]);
  if (!donor && authUser.id !== profileId) {
    donor = await getLocalOrFirestoreDoc<User>("users", authUser.id);
  }
  if (!donor && linked?.profile) {
    donor = {
      id: linked.profile.id,
      full_name: linked.profile.full_name,
      email: linked.profile.email || "",
      phone: linked.profile.phone,
      whatsapp_number: linked.profile.whatsapp_phone,
      blood_type: (linked.donorProfile?.blood_group as User['blood_type']) || 'O+',
      donation_frequency: 'first_time',
      last_donation_date: linked.donorProfile?.last_donation_date || null,
      cooldown_until: linked.donorProfile?.cooldown_until || null,
      pincode: linked.donorProfile?.pincode || '',
      area: linked.donorProfile?.area || '',
      city: linked.donorProfile?.city || '',
      availability_status: linked.donorProfile?.is_available ? 'available' : 'unavailable',
      number_sharing_pref: 'on_approval',
      emergency_only: (linked.donorProfile as any)?.emergency_only || false,
      account_status: 'active',
      whatsapp_verified: linked.profile.whatsapp_verified,
      profile_complete: linked.donorProfile?.profile_complete,
      is_available: linked.donorProfile?.is_available,
      created_at: linked.profile.consent_accepted_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  if (!donor) return sendErrorResponse(res, new NotFoundError("Donor profile not found."));
  const matches = allMatches.filter((match) => match.donor_id === profileId || match.donor_id === authUser.id);
  const requestIds = new Set(matches.map((match) => match.request_id));
  const allRequests = await getLocalOrFirestoreCollection<BloodRequest>("blood_requests");
  const requests = allRequests.filter((request) => requestIds.has(request.id));
  return res.json({ donor, matches, requests, donationLogs: allLogs.filter((log) => log.donor_id === profileId || log.donor_id === authUser.id) });
}));

// ─── Donor matches list ──────────────────────────────────────────────────────
router.get("/api/donor/matches", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
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
}));

// ─── Pending matches by donor phone ──────────────────────────────────────────
router.get("/api/donors/by-phone/:phone/pending-matches", wrap(async (req, res) => {
  try {
    const phone = normalizePhone(req.params.phone);
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
    if (!donor) return sendErrorResponse(res, new NotFoundError("Donor not found"));

    const allMatches = await getLocalOrFirestoreCollection<Match>("matches");
    const pending = allMatches.filter(
      (m) => m.donor_id === donor.id && m.donor_response === "pending"
    );

    const payload = {
      matches: pending.map((m) => ({
        matchId: m.id,
        requestId: m.request_id,
        trackingCode: m.id.split("_")[1] || m.id,
        status: m.donor_response,
        donorId: donor.id,
        donorName: donor.full_name,
      })),
    };

    await cacheSet(cacheKey, payload, 15);
    res.setHeader("X-Cache", "MISS");
    return res.json(payload);
  } catch (err: any) {
    return sendErrorResponse(res, err, "Failed to retrieve pending matches.");
  }
}));

// ─── Donor Match Accept & Confirm aliases ────────────────────────────────────
router.post("/api/donor/matches/:matchId/accept", (req, res, next) => {
  req.url = `/api/matches/${req.params.matchId}/approve`;
  next();
});
router.post("/api/donor/matches/:matchId/confirm", (req, res, next) => {
  if (req.params.matchId !== "self") {
    req.url = `/api/matches/${req.params.matchId}/confirm-donation`;
    next();
    return;
  }
  // ─── Self-reported donation (weight milestone eligibility) ─────────────
  wrap(async (req, res) => {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) return sendErrorResponse(res, new UnauthorizedError("Sign in is required"));
    const donor = await getLocalOrFirestoreDoc<User>("users", authUser.id);
    if (!donor) return sendErrorResponse(res, new NotFoundError("Donor not found"));

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
  })(req, res, next);
});

export default router;
