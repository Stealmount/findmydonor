// Security middleware — extracted from server.ts (Phase 3 decomposition)
import express from "express";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

// ─── Structured logging (Feature 6) ─────────────────────────────────────────
export const requestContext = new AsyncLocalStorage<{ requestId: string }>();

export function logWithId(...args: unknown[]) {
  const store = requestContext.getStore();
  if (store) {
    console.log(`[req:${store.requestId.slice(0, 8)}]`, ...args);
  } else {
    console.log(...args);
  }
}

export function applySecurityMiddleware(app: express.Express, port: number) {
  // Feature 6: x-request-id middleware — wraps every handler in AsyncLocalStorage context
  app.use((req, _res, next) => {
    const rid = (req.headers["x-request-id"] as string) || randomUUID();
    req.headers["x-request-id"] = rid;
    requestContext.run({ requestId: rid }, () => next());
  });

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");

    const isProd = process.env.NODE_ENV === "production";
    if (isProd) {
      // Phase 7.3: generate a per-request nonce, expose it for the static HTML
      // transformer, and drop unsafe-inline/unsafe-eval from script-src.
      const nonce = randomUUID().replace(/-/g, "");
      res.locals.cspNonce = nonce;
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; connect-src 'self' https: wss: http:; img-src 'self' data: https: blob:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'nonce-" + nonce + "' https:; base-uri 'self'; frame-ancestors 'none'; object-src 'none'"
      );
    } else {
      // Dev: keep unsafe-inline/unsafe-eval for Vite HMR + dev tooling.
      res.setHeader("Content-Security-Policy", "default-src 'self'; connect-src 'self' https: wss: http:; img-src 'self' data: https: blob:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; base-uri 'self'; frame-ancestors 'none'; object-src 'none'");
    }
    if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

    if (!req.path.startsWith("/api")) return next();
    const origin = req.header("origin")?.replace(/\/$/, "");
    if (origin) {
      try {
        const originHost = new URL(origin).hostname;
        const reqHost = (req.header("x-forwarded-host") || req.header("host") || "").split(":")[0];
        const configuredOrigins = new Set([
          process.env.APP_URL,
          "https://findmydonor.online",
          "https://www.findmydonor.online",
          `http://145.241.154.187:${port}`,
          "http://localhost:5173",
          ...(process.env.CORS_ORIGINS || "").split(","),
        ].map((o) => o?.trim().replace(/\/$/, "")).filter((o): o is string => Boolean(o)));

        const isAllowed = configuredOrigins.has(origin) ||
                          originHost === reqHost ||
                          originHost === "localhost" ||
                          originHost === "145.241.154.187" ||
                          originHost === "findmydonor.online" ||
                          originHost === "www.findmydonor.online";
        if (!isAllowed) {
          return res.status(403).json({ error: "Origin not allowed." });
        }
      } catch {
        return res.status(403).json({ error: "Invalid origin." });
      }
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
}
