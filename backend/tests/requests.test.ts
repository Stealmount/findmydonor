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

  describe('Idempotency key race protection', () => {
    test('concurrent POST /api/requests with same idempotency-key returns 201 once and 409 with duplicate info', async () => {
      // ponytail: server.ts L82 — test-valid-token bypasses Supabase in NODE_ENV=test
      const authHeader = 'Bearer test-valid-token';
      const idempotencyKey = `test-idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const body = {
        patient_name: 'Race Test Patient',
        blood_type_needed: 'O+',
        units_required: 1,
        hospital_name: 'Race Test Hospital',
        hospital_pincode: '110001',
        hospital_area: 'Test Area',
        hospital_city: 'Delhi',
        hospital_state: 'Delhi',
        urgency_level: 'urgent',
        requester_name: 'Race Tester',
        requester_phone: '9876543210'
      };

      // Fire two requests concurrently with same idempotency key
      const [res1, res2] = await Promise.all([
        fetch(`${BASE}/api/requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'idempotency-key': idempotencyKey },
          body: JSON.stringify(body)
        }),
        fetch(`${BASE}/api/requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'idempotency-key': idempotencyKey },
          body: JSON.stringify(body)
        })
      ]);

      // One must be 201 (created), the other 409 (duplicate)
      const statuses = [res1.status, res2.status].sort();
      assert.deepEqual(statuses, [201, 409], 'one request should succeed (201), one should be duplicate (409)');

      const json1 = await res1.json() as { requestId?: string; trackingCode?: string; error?: string };
      const json2 = await res2.json() as { requestId?: string; trackingCode?: string; error?: string };

      // The 409 response should reference the 201's requestId
      const created = res1.status === 201 ? json1 : json2;
      const duplicate = res1.status === 409 ? json1 : json2;

      assert.ok(created.requestId, '201 response should include requestId');
      assert.ok(created.trackingCode, '201 response should include trackingCode');
      assert.equal(duplicate.error, 'Duplicate request', '409 response should have "Duplicate request" error');
      assert.equal(duplicate.requestId, created.requestId, '409 should reference the created requestId');
      assert.equal(duplicate.trackingCode, created.trackingCode, '409 should reference the created trackingCode');
    });
  });
});
