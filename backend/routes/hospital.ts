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

export default router;
