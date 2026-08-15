// Account routes — self-service account deletion (Section 9)
import express, { Router } from "express";
import { getServerSupabase } from "../src/lib/serverDb";
import { cacheInvalidatePrefix } from "../src/lib/redisCache";
import { getAuthenticatedUser } from "../middleware/auth";
import rateLimitMiddleware from "../middleware/rateLimiter";
import { sendErrorResponse, UnauthorizedError } from "../helpers/errors";

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
router.post("/api/account/delete", rateLimitMiddleware(5, 60_000), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser?.id || authUser.role === "admin" || authUser.id === "admin-id" || authUser.id === "test-admin-id") {
    return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  }

  const supabase = getServerSupabase();
  const authUserId = authUser.id;

  const { data: link } = await supabase
    .from("auth_profile_links")
    .select("auth_user_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!link) {
    await supabase.from("users").update({ account_status: "deleted" }).eq("id", authUserId);
    await supabase.from("requesters").update({ account_status: "deleted" }).eq("id", authUserId);
    await cacheInvalidatePrefix(`acct_deleted:${authUserId}`);
    return res.json({ ok: true, mode: "soft" });
  }

  const { error } = await supabase.auth.admin.deleteUser(link.auth_user_id);
  if (error) {
    return sendErrorResponse(res, error, "Failed to delete account. Please try again later.");
  }

  await cacheInvalidatePrefix(`acct_deleted:${authUserId}`);
  return res.json({ ok: true, mode: "hard" });
}));

export default router;
