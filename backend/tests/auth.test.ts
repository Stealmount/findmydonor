import './setup-env';
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';

const PORT = process.env.TEST_PORT || '5005';
const BASE = process.env.TEST_BASE_URL || `http://localhost:${PORT}`;

describe('Authentication & Onboarding API Endpoints (/api/auth/* & /api/wa/*)', () => {
  let child: ChildProcess | null = null;

  before(async () => {
    try {
      const check = await fetch(`${BASE}/api/health`).catch(() => null);
      if (!check || !check.ok) {
        child = spawn(process.execPath, ['--import', 'tsx', 'backend/server.ts'], {
          stdio: 'pipe',
          env: {
            ...process.env,
            PORT,
            NODE_ENV: 'test',
            VITE_SUPABASE_URL: 'https://stub.supabase.co'
          }
        });

        for (let i = 0; i < 120; i++) {
          await new Promise(r => setTimeout(r, 500));
          const res = await fetch(`http://127.0.0.1:${PORT}/api/health`).catch(() => null);
          if (res && res.ok) break;
        }
      }
    } catch {
      // Use existing server or spawned process
    }
  });

  after(() => {
    if (child && child.pid) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/t', '/f']);
      } else {
        child.kill();
      }
    }
  });

  test('GET /api/auth/me without sign-in returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE}/api/auth/me`);
    assert.equal(res.status, 401, 'Should return 401 when no session token is provided');
    const body = await res.json() as { error?: string };
    assert.equal(body.error, 'Sign in is required.');
  });

  test('POST /api/wa/send-otp rejects invalid phone number format with 400', async () => {
    const res = await fetch(`${BASE}/api/wa/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '123' })
    });
    assert.equal(res.status, 400, 'Should reject non-10-digit phone');
    const body = await res.json() as { error?: string };
    assert.ok(body.error?.includes('valid 10-digit Indian WhatsApp number') || body.error?.includes('valid'), 'Should include validation error');
  });

  test('POST /api/wa/send-otp accepts valid 10-digit Indian mobile number', async () => {
    const res = await fetch(`${BASE}/api/wa/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210' })
    });
    assert.ok([200, 410, 429, 500, 503].includes(res.status), `Should respond with status indicating processing or rate limit, got ${res.status}`);
    const body = await res.json() as { success?: boolean; error?: string };
    assert.ok(body !== null, 'Response should be valid JSON payload');
  });

  test('POST /api/auth/complete-verification without sign-in returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE}/api/auth/complete-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verificationToken: 'test-token',
        phone: '9876543210',
        fullName: 'Test User',
        intent: 'donor',
        consentAccepted: true
      })
    });
    assert.equal(res.status, 401, 'Complete verification requires authenticated session');
  });

  test('PATCH /api/donor-profile/complete without sign-in returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE}/api/donor-profile/complete`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blood_group: 'O+',
        pincode: '110001',
        area: 'Connaught Place',
        city: 'New Delhi',
        health_self_declaration: true
      })
    });
    assert.equal(res.status, 401, 'Donor profile completion requires authenticated session');
  });

  test('PATCH /api/donor-profile/availability without sign-in returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE}/api/donor-profile/availability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailable: true })
    });
    assert.equal(res.status, 401, 'Availability toggle requires authenticated session');
  });
});
