/**
 * RaktDaan — Express Backend (Modularized — Phase 3 complete)
 *
 * Phase 3 decomposition:
 *  ✅ helpers/  → phone.ts, time.ts, html.ts
 *  ✅ middleware/ → auth.ts, rateLimiter.ts, security.ts
 *  ✅ routes/   → health, auth, donor, requester, matching, tracking,
 *                  notifications, misc, admin, hospital
 *  ✅ services/ → matchingEngine.ts, notificationService.ts
 *  ✅ worker/   → sweepWorker.ts (Task 3.7)
 *
 * What stays here:
 *  - OTP routes (wa/send-otp, wa/verify-otp, email/send-otp, email/verify-otp)
 *  - Anonymous SOS submission route (/api/sos/requests)
 *  - Express bootstrap, middleware wiring, Vite/static serving
 *  - Worker scheduler (setTimeout/setInterval — logic is in sweepWorker.ts)
 *  - Error middleware, API catch-all, graceful shutdown
 */

import "dotenv/config";
import express from "express";
import path from "path";
import { randomInt, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { AsyncLocalStorage } from "node:async_hooks";
import { createServer as createViteServer } from "vite";

// ─── DB / Cache ──────────────────────────────────────────────────────────────
import {
  getCollection as getLocalOrFirestoreCollection,
  saveDoc as saveLocalOrFirestoreDoc,
  getServerSupabase,
  SupabaseUnavailableError,
} from "./src/lib/serverDb";
import {
  cacheGet,
  cacheSet,
  cacheSetNX,
  cacheDel,
  getCacheStats,
} from "./src/lib/redisCache";
import { sendWhatsApp, buildOtpMessage, buildEmailOtpHTML } from "./services/notificationService";

// ─── Types ───────────────────────────────────────────────────────────────────
import type { BloodRequest } from "./src/types";

// ─── Extracted modules ───────────────────────────────────────────────────────
import { normalizePhone, isValidIndianPhone } from "./helpers/phone";
import { nowISO } from "./helpers/time";
import { escapeHtml } from "./helpers/html";
import {
  getAuthenticatedUser,
  consumeOtpTicket,
  consumeEmailOtpTicket,
  isAccountDeleted,
} from "./middleware/auth";
import rateLimitMiddleware from "./middleware/rateLimiter";
import { applySecurityMiddleware } from "./middleware/security";
import { sendEmailViaResend } from "./services/notificationService";
import { matchAndNotifyRequest } from "./services/matchingEngine";
import { startMessageWorker } from "./src/lib/messageWorker";
import { runBackgroundMatchWorker } from "./worker/sweepWorker";

// ─── Route modules ───────────────────────────────────────────────────────────
import healthRoutes from "./routes/health";
import authRoutes from "./routes/auth";
import donorRoutes from "./routes/donor";
import requesterRoutes from "./routes/requester";
import matchingRoutes from "./routes/matching";
import trackingRoutes from "./routes/tracking";
import notificationsRoutes from "./routes/notifications";
import miscRoutes from "./routes/misc";
import accountRoutes from "./routes/account";
import adminRoutes from "./routes/admin";
import hospitalRoutes from "./routes/hospital";
import pincodeRoutes from "./routes/pincode";
import onboardingRoutes from "./routes/onboarding";
import accountSettingsRoutes from "./routes/accountSettings";
import institutionRoutes from "./routes/institutions";

// Re-export for admin.test.ts (imports serverModule.isAccountDeleted)
export { isAccountDeleted };

// ─── Structured logging ──────────────────────────────────────────────────────
const requestContext = new AsyncLocalStorage<{ requestId: string }>();

// ─── Server bootstrap ─────────────────────────────────────────────────────────

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

  // x-request-id middleware — wraps every handler in AsyncLocalStorage context
  app.use((req, _res, next) => {
    const rid = (req.headers["x-request-id"] as string) || randomUUID();
    req.headers["x-request-id"] = rid;
    requestContext.run({ requestId: rid }, () => next());
  });

  // Security headers + CORS + request logger
  applySecurityMiddleware(app, PORT);

  // Global API rate limit: 120 req/min per IP
  app.use("/api", rateLimitMiddleware(120, 60_000));

  // ─── Extracted route modules ──────────────────────────────────────────────
  app.use("/api", healthRoutes);
  app.use("/api", authRoutes);
  app.use(donorRoutes);
  app.use(requesterRoutes);
  app.use(matchingRoutes);
  app.use(trackingRoutes);
  app.use(notificationsRoutes);
  app.use(miscRoutes);
  app.use(adminRoutes);
  app.use(hospitalRoutes);
  app.use(accountRoutes);
  app.use(pincodeRoutes);
  app.use("/api", onboardingRoutes);
  app.use("/api", accountSettingsRoutes);
  app.use("/api", institutionRoutes);

  // ─── WhatsApp OTP send ────────────────────────────────────────────────────
  app.post("/api/wa/send-otp", rateLimitMiddleware(15, 60_000), async (req, res) => {
    const { phone } = req.body || {};
    const rawPurpose = String(req.body?.purpose || "signup").toLowerCase();
    const purpose: "signup" | "sos" | "verify" =
      rawPurpose === "sos" ? "sos" : rawPurpose === "verify" ? "verify" : "signup";
    if (!phone) return res.status(400).json({ error: "Phone number required" });
    const normalizedPhone = normalizePhone(phone);
    if (!isValidIndianPhone(normalizedPhone)) return res.status(400).json({ error: "Enter a valid 10-digit Indian WhatsApp number" });

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
    if (lockVal === "locked") {
      return res.status(429).json({ error: "Too many failed OTP attempts. Try again in 15 minutes." });
    }

    // DEV-ONLY OTP BYPASS — impossible in production where WAHA_BASE_URL is set
    if (!process.env.WAHA_BASE_URL) {
      const DEV_OTP = "000000";
      await cacheSet(`wa_otp_${normalizedPhone}`, DEV_OTP, 15 * 60);
      await cacheSet(`otp_attempts_${normalizedPhone}`, "0", 15 * 60);
      console.warn(
        `[DEV OTP BYPASS] WAHA_BASE_URL unset — no real WhatsApp sent. ` +
        `Use OTP "${DEV_OTP}" for ${normalizedPhone}. This must never happen in production.`
      );
      return res.json({ success: true, purpose, devBypass: true, message: `DEV MODE: WhatsApp disabled. Use OTP ${DEV_OTP}.` });
    }

    const otp = randomInt(100000, 1_000_000).toString();
    const cacheKey = `wa_otp_${normalizedPhone}`;
    const attemptKey = `otp_attempts_${normalizedPhone}`;
    await cacheSet(cacheKey, otp, 15 * 60);
    await cacheSet(attemptKey, "0", 15 * 60);

    const message = buildOtpMessage(otp);
    const sent = await sendWhatsApp(normalizedPhone, message);
    if (sent) {
      return res.json({ success: true, purpose, message: "OTP sent successfully" });
    } else {
      return res.status(500).json({ error: "Failed to send OTP via WhatsApp" });
    }
  });

  // ─── WhatsApp OTP verify ──────────────────────────────────────────────────
  app.post("/api/wa/verify-otp", rateLimitMiddleware(10, 60_000), async (req, res) => {
    const { phone, otp } = req.body || {};
    const rawPurpose = String(req.body?.purpose || "signup").toLowerCase();
    const purpose: "signup" | "sos" | "verify" =
      rawPurpose === "sos" ? "sos" : rawPurpose === "verify" ? "verify" : "signup";
    if (!phone || !otp) return res.status(400).json({ error: "Phone and OTP required" });

    const normalizedPhone = normalizePhone(phone);
    const lockKey    = `otp_lock_${normalizedPhone}`;
    const attemptKey = `otp_attempts_${normalizedPhone}`;
    const cacheKey   = `wa_otp_${normalizedPhone}`;

    const lockVal = await cacheGet<string>(lockKey);
    if (lockVal === "locked") {
      return res.status(429).json({ error: "Too many failed OTP attempts. Try again in 15 minutes." });
    }

    const storedOtp = await cacheGet<string>(cacheKey);
    if (!storedOtp) {
      return res.status(400).json({ error: "OTP expired or not requested" });
    }

    if (storedOtp === String(otp).trim()) {
      const verificationToken = randomUUID();
      await cacheDel(cacheKey);
      await cacheDel(attemptKey);
      const ttl = purpose === "sos" ? 5 * 60 : 10 * 60;
      await cacheSet(`wa_otp_ticket_${verificationToken}`, `${purpose}|${normalizedPhone}`, ttl);
      return res.json({ success: true, verificationToken, purpose, message: "OTP verified successfully" });
    } else {
      const rawAttempts = await cacheGet<string>(attemptKey);
      const attempts = parseInt(rawAttempts || "0", 10) + 1;
      if (attempts >= 5) {
        await cacheSet(lockKey, "locked", 15 * 60);
        await cacheDel(cacheKey);
        await cacheDel(attemptKey);
        return res.status(429).json({ error: "Too many failed attempts. Your OTP has been invalidated. Request a new one after 15 minutes." });
      }
      await cacheSet(attemptKey, String(attempts), 300);
      console.warn(`[OTP Verify Failed] Phone: ${normalizedPhone} | Attempts: ${attempts}/5`);
      return res.status(400).json({ error: `Invalid OTP. ${5 - attempts} attempt(s) remaining.` });
    }
  });

  // ─── Email OTP send ───────────────────────────────────────────────────────
  app.post("/api/email/send-otp", rateLimitMiddleware(5, 60_000), async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email address required" });

    const otp = randomInt(100000, 1_000_000).toString();
    const cacheKey = `email_otp_${email.toLowerCase().trim()}`;
    await cacheSet(cacheKey, otp, 300);

    const emailPayload = buildEmailOtpHTML(otp);
    const sent = await sendEmailViaResend(email.toLowerCase().trim(), emailPayload.subject, emailPayload.html, emailPayload.text);
    if (sent) {
      return res.json({ success: true, message: "OTP sent successfully" });
    } else {
      return res.status(500).json({ error: "Failed to send OTP via Email" });
    }
  });

  // ─── Email OTP verify ─────────────────────────────────────────────────────
  app.post("/api/email/verify-otp", rateLimitMiddleware(10, 60_000), async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP required" });

    const normalizedEmail = String(email).toLowerCase().trim();
    const cacheKey   = `email_otp_${normalizedEmail}`;
    const attemptKey = `email_otp_attempts_${normalizedEmail}`;
    const lockKey    = `email_otp_lock_${normalizedEmail}`;

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

  // ─── Anonymous SOS submission ──────────────────────────────────────────────
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

  // ─── Error middleware ──────────────────────────────────────────────────────
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[API] Request failed:", error);
    if (res.headersSent) return;
    const unavailable = error instanceof SupabaseUnavailableError;
    res.status(unavailable ? 503 : 500).json({
      error: unavailable ? "Matching service is temporarily unavailable. Please try again shortly." : "Unexpected server error.",
    });
  });

  // ─── API catch-all: return 404 for unmatched /api/* routes ────────────────
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
  });

  // ─── Vite / Static ────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", async (_req, res) => {
      // Phase 7.3: inject the per-request CSP nonce into the inline-script
      // placeholders before serving. res.locals.cspNonce is set by the
      // security middleware; fall back to a fresh nonce if missing.
      let html = await readFile(path.join(distPath, "index.html"), "utf8");
      const nonce = (res.locals.cspNonce as string) || randomUUID().replace(/-/g, "");
      html = html.replace(/__CSP_NONCE__/g, nonce);
      res.type("html").send(html);
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
    // Logic lives in worker/sweepWorker.ts (Phase 3.7)
    setTimeout(() => {
      console.log("[Worker] Initial match sweep starting...");
      runBackgroundMatchWorker();
    }, 10_000);
    setInterval(runBackgroundMatchWorker, 2 * 60 * 1000);

    // Start message queue worker: drains src/lib/messaging.ts queue.
    // (Phase 3.8 — previously orphaned: the queue was written but never drained.)
    startMessageWorker();
  });
}

// createNextDonorMatch -> moved to services/matchingEngine.ts
// Background Match Worker (runBackgroundMatchWorker) -> moved to worker/sweepWorker.ts (Phase 3.7)

startServer();

process.on("uncaughtException", (error) => {
  console.error("[Uncaught Exception] Caught exception safely without crashing server:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Unhandled Rejection] Async rejection caught safely without crashing server:", reason);
});
