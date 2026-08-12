// Account routes — self-service account deletion (Section 9)
import express, { Router } from "express";
import { getServerSupabase } from "../src/lib/serverDb";
import { cacheInvalidatePrefix } from "../src/lib/redisCache";
import { getAuthenticatedUser } from "../middleware/auth";
import rateLimitMiddleware from "../middleware/rateLimiter";

const router = Router();

// Express 4 does not forward rejected async handlers to its error middleware.
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

// ─── POST /api/account/delete — permanently delete own account ───────────────
// Hard-deletes the Supabase auth user; FK cascades remove auth_profile_links,
// profiles, donor_profiles, request_reports, and nulls blood_requests links.
// Requires a valid signed-in user token (not admin-only).
router.post("/api/account/delete", rateLimitMiddleware(5, 60_000), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  // Admin identities (real admin JWT/legacy secret → admin-id, test backdoor →
  // test-admin-id) cannot self-delete; they manage accounts via the admin console.
  if (!authUser?.id || authUser.role === "admin" || authUser.id === "admin-id" || authUser.id === "test-admin-id") {
    return res.status(401).json({ error: "Sign in is required." });
  }

  const supabase = getServerSupabase();
  const authUserId = authUser.id;

  // Look up the linked auth user id so we hard-delete the right auth account.
  // getAuthenticatedUser may return a profile-based auth user (Supabase JWT) —
  // its `id` IS the auth.users id in the modern flow.
  const { data: link } = await supabase
    .from("auth_profile_links")
    .select("auth_user_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  // Legacy accounts (no auth_profile_links row) fall back to a soft-delete on
  // the legacy users/requesters tables so nothing breaks.
  if (!link) {
    await supabase.from("users").update({ account_status: "deleted" }).eq("id", authUserId);
    await supabase.from("requesters").update({ account_status: "deleted" }).eq("id", authUserId);
    await cacheInvalidatePrefix(`acct_deleted:${authUserId}`);
    return res.json({ ok: true, mode: "soft" });
  }

  // Modern flow — hard delete the auth user. auth_profile_links -> profiles ->
  // donor_profiles / request_reports all cascade ON DELETE CASCADE.
  const { error } = await supabase.auth.admin.deleteUser(link.auth_user_id);
  if (error) {
    return res.status(500).json({ error: "Failed to delete account. Please try again later." });
  }

  await cacheInvalidatePrefix(`acct_deleted:${authUserId}`);
  return res.json({ ok: true, mode: "hard" });
}));

export default router;
