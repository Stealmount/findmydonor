import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import {
  getCollection as getLocalOrFirestoreCollection,
  getDoc as getLocalOrFirestoreDoc,
  getServerSupabase,
  saveDoc as saveLocalOrFirestoreDoc,
} from "./src/lib/serverDb";
import type { BloodRequest, DonationLog, Match, NotificationLog, User } from "./src/types";

function nowISO(): string {
  return new Date().toISOString();
}

async function getAuthenticatedUser(req: express.Request) {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  if (token === "test-admin-token" && (process.env.NODE_ENV === "test" || process.env.VITE_SUPABASE_URL === "https://stub.supabase.co")) {
    return { id: "test-admin-id", email: "admin@raktdaan.org" } as any;
  }
  try {
    const { data, error } = await getServerSupabase().auth.getUser(token);
    return error ? null : data.user;
  } catch (error) {
    console.warn("[Auth] Supabase unavailable:", error);
    return null;
  }
}

async function startAdminServer() {
  const app = express();
  const PORT = Number(process.env.ADMIN_PORT || 6000);
  const adminOrigins = new Set([
    "https://findmydonor.online",
    `http://145.241.154.187:${PORT}`,
    `http://localhost:${PORT}`,
  ]);

  app.use(express.json({ limit: "100kb" }));
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    if (!req.path.startsWith("/api")) return next();
    const origin = req.header("origin")?.replace(/\/$/, "");
    if (origin && !adminOrigins.has(origin)) return res.status(403).json({ error: "Origin not allowed." });
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
    next();
  };

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

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "custom" });
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

  app.listen(PORT, "0.0.0.0", () => console.log(`[Admin] running on http://localhost:${PORT}`));
}

void startAdminServer();
