import './setup-env';
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';

const PORT = process.env.TEST_PORT || '5007';
const BASE = `http://127.0.0.1:${PORT}`;

describe('Blood Requests API Endpoints (/api/requests & /api/sos/requests)', () => {
  let child: ChildProcess | null = null;

  before(async () => {
    child = spawn('npx', ['tsx', 'server.ts'], {
      stdio: 'pipe',
      shell: true,
      env: {
        ...process.env,
        PORT,
        NODE_ENV: 'test',
        VITE_SUPABASE_URL: 'https://stub.supabase.co'
      }
    });

    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 250));
      const res = await fetch(`${BASE}/api/health`).catch(() => null);
      if (res && res.ok) break;
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

  test('POST /api/requests without sign-in returns 401 Unauthorized', async () => {
    const res = await fetch(`${BASE}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_name: 'Test Patient', units_required: 1 })
    });
    assert.equal(res.status, 401, 'Should return 401 when unauthenticated');
  });

  test('POST /api/sos/requests rejects request without verification token with 400', async () => {
    const res = await fetch(`${BASE}/api/sos/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_name: 'Test SOS Patient', units_required: 1 })
    });
    assert.equal(res.status, 400, 'Should return 400 when verification token is missing');
    const body = await res.json() as { error?: string };
    assert.equal(body.error, 'Provide a verified SOS ticket, your name, and your WhatsApp number.');
  });
});
