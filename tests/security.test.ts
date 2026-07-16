/**
 * Security baseline tests — CORS allowlist & security headers.
 *
 * These tests make real HTTP requests to the running dev server.
 * Start the server first:  npm run dev
 * Then run:                npx tsx --test tests/security.test.ts
 *
 * Uses Node's built-in node:test + node:assert — zero extra dependencies.
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5000';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchAPI(path: string, opts: RequestInit = {}) {
  return fetch(`${BASE}${path}`, { ...opts, redirect: 'manual' });
}

// ─── Security Headers ───────────────────────────────────────────────────────

describe('Security headers', () => {
  test('API responses include X-Content-Type-Options: nosniff', async () => {
    const res = await fetchAPI('/api/health');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });

  test('API responses include X-Frame-Options: DENY', async () => {
    const res = await fetchAPI('/api/health');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
  });

  test('API responses include Referrer-Policy', async () => {
    const res = await fetchAPI('/api/health');
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  });

  test('API responses include Cross-Origin-Opener-Policy', async () => {
    const res = await fetchAPI('/api/health');
    assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin');
  });

  test('API responses include Content-Security-Policy', async () => {
    const res = await fetchAPI('/api/health');
    const csp = res.headers.get('content-security-policy');
    assert.ok(csp, 'CSP header should be present');
    assert.ok(csp!.includes("default-src 'self'"), 'CSP should restrict default-src');
    assert.ok(csp!.includes("frame-ancestors 'none'"), 'CSP should block framing');
  });

  test('API responses include Permissions-Policy', async () => {
    const res = await fetchAPI('/api/health');
    const pp = res.headers.get('permissions-policy');
    assert.ok(pp, 'Permissions-Policy header should be present');
    assert.ok(pp!.includes('camera=()'), 'Camera should be disabled');
    assert.ok(pp!.includes('microphone=()'), 'Microphone should be disabled');
  });
});

// ─── CORS Allowlist ─────────────────────────────────────────────────────────

describe('CORS allowlist', () => {
  test('Same-origin requests (no Origin header) are allowed', async () => {
    const res = await fetchAPI('/api/health');
    assert.equal(res.status, 200, 'Should return 200 for same-origin');
  });

  test('Approved origin receives Access-Control-Allow-Origin', async () => {
    const res = await fetchAPI('/api/health', {
      headers: { 'Origin': `http://localhost:5000` },
    });
    assert.equal(res.status, 200);
    assert.equal(
      res.headers.get('access-control-allow-origin'),
      'http://localhost:5000',
      'Should echo approved origin',
    );
    assert.equal(res.headers.get('vary'), 'Origin', 'Should set Vary: Origin');
  });

  test('Unapproved origin is rejected with 403', async () => {
    const res = await fetchAPI('/api/health', {
      headers: { 'Origin': 'https://evil.example.com' },
    });
    assert.equal(res.status, 403, 'Unapproved origin should be blocked');
    const body = await res.json() as { error?: string };
    assert.ok(body.error, 'Response should include error message');
  });

  test('Preflight OPTIONS for approved origin returns 204', async () => {
    const res = await fetchAPI('/api/health', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization,Content-Type',
      },
    });
    assert.equal(res.status, 204, 'Preflight should return 204');
    assert.equal(
      res.headers.get('access-control-allow-origin'),
      'http://localhost:5000',
    );
    assert.ok(
      res.headers.get('access-control-allow-methods')?.includes('POST'),
      'Should allow POST',
    );
  });

  test('Preflight OPTIONS for unapproved origin is rejected', async () => {
    const res = await fetchAPI('/api/health', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://evil.example.com',
        'Access-Control-Request-Method': 'POST',
      },
    });
    assert.equal(res.status, 403, 'Unapproved preflight should be rejected');
  });
});

// ─── Auth guards on /api/send-email ─────────────────────────────────────────

describe('/api/send-email auth guard', () => {
  test('Unauthenticated request returns 401', async () => {
    const res = await fetchAPI('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'test@test.com', subject: 'Test', text: 'hi' }),
    });
    assert.equal(res.status, 401, 'Should reject unauthenticated request');
  });
});
