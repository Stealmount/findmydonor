import './setup-env';
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';

const PORT = process.env.TEST_PORT || '5004';
const BASE = process.env.TEST_BASE_URL || `http://localhost:${PORT}`;

describe('Admin endpoint (/api/admin/matches)', () => {
  let child: ChildProcess | null = null;

  before(async () => {
    try {
      const check = await fetch(`${BASE}/api/health`).catch(() => null);
      if (!check || !check.ok) {
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
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 500));
          const res = await fetch(`${BASE}/api/health`).catch(() => null);
          if (res && res.ok) break;
        }
      }
    } catch (e) {
      console.error('Server startup helper failed', e);
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

  test('POST /api/admin/matches without valid admin auth returns 401 or 403', async () => {
    const resNoAuth = await fetch(`${BASE}/api/admin/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', payload: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', donor_response: 'pending' } })
    });
    assert.equal(resNoAuth.status, 403, 'No auth should be blocked by adminCheck middleware');

    const resNonAdmin = await fetch(`${BASE}/api/admin/matches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-valid-token'
      },
      body: JSON.stringify({ matchId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', payload: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', donor_response: 'pending' } })
    });
    assert.equal(resNonAdmin.status, 403, 'Non-admin token should return 403 Access denied');
  });

  test('POST /api/admin/matches with admin token succeeds', async () => {
    const resAdmin = await fetch(`${BASE}/api/admin/matches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-admin-token'
      },
      body: JSON.stringify({
        matchId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        payload: {
          id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          request_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
          donor_id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
          donor_response: 'pending',
          distance_km: 0,
          created_at: new Date().toISOString()
        }
      })
    });
    assert.equal(resAdmin.status, 200, 'Should return 200 when authenticated as admin');
    const data = await resAdmin.json() as any;
    assert.equal(data.success, true);
  });
});
