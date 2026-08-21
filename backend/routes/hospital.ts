// Hospital routes — extracted from server.ts (Phase 3 decomposition, 3.6.8)
// Owns: /api/hospital/dashboard (active requests, matches, donors with PII gating)
import express, { Router } from "express";
import {
  getCollection as getLocalOrFirestoreCollection,
} from "../src/lib/serverDb";
import { getAuthenticatedUser } from "../middleware/auth";
import { sendErrorResponse, UnauthorizedError } from "../helpers/errors";
import type { BloodRequest, Match, User } from "../src/types";

const router = Router();

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

router.get("/api/hospital/dashboard", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return sendErrorResponse(res, new UnauthorizedError("Unauthorized: Invalid or missing authentication token."));
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
}));

// ─── POST /api/hospital/register — submit institution for admin verification ──
router.post("/register", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return sendErrorResponse(res, new UnauthorizedError("Sign in is required to register an institution."));
  }

  const body = req.body;
  const institutionName = String(body.institution_name || "").trim();
  const institutionType = String(body.institution_type || "hospital");
  const pincode = String(body.pincode || "").trim();
  const city = String(body.city || "").trim();
  const contactPerson = String(body.contact_person || "").trim();
  const contactPhone = String(body.contact_phone || "").trim();
  const email = String(body.email || "").toLowerCase().trim();

  if (!institutionName || !pincode || !city || !contactPerson || !contactPhone || !email) {
    return sendErrorResponse(res, new Error("All fields are required."));
  }

  const createData = {
    institution_name: institutionName,
    institution_type: institutionType,
    pincode,
    city,
    contact_person: contactPerson,
    phone: contactPhone,
    email,
    status: "pending_verification",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const createdRef = await getLocalOrFirestoreCollection<Record<string, unknown>>("institutions").then(() => {
      return null;
    }).catch(() => null);

    // Use Firestore directly for create
    const { db } = await import("../src/lib/firebase");
    const docRef = await db.collection("institutions").add(createData);

    return res.status(201).json({
      success: true,
      institution: { id: docRef.id, ...createData },
      message: "Registration submitted. Your institution will be verified by our admin team.",
    });
  } catch (error) {
    return sendErrorResponse(res, error as Error, "Failed to register institution.");
  }
}));

export default router;
