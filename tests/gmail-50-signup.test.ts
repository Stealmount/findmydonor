import 'dotenv/config';
import './setup-env';
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';

const PORT = process.env.TEST_PORT || '5009';
const BASE = `http://127.0.0.1:${PORT}`;

describe('50+ Synthetic Gmail / Email Sign Up Stress Test (No Phone Number)', () => {
  let child: ChildProcess | null = null;

  before(async () => {
    child = spawn('npx', ['tsx', 'server.ts'], {
      stdio: 'pipe',
      shell: true,
      env: {
        ...process.env,
        PORT,
        NODE_ENV: 'test',
        VITE_SUPABASE_URL: 'https://stub.supabase.co',
        WAHA_BASE_URL: ''
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

  // Run 55 consecutive synthetic Gmail signups without needing any phone number
  const TOTAL_TEST_ACCOUNTS = 55;

  test(`Batch create ${TOTAL_TEST_ACCOUNTS} synthetic Gmail accounts without phone numbers`, async () => {
    let successCount = 0;
    const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

    for (let i = 1; i <= TOTAL_TEST_ACCOUNTS; i++) {
      const email = `synthetic.gmail.user.${i}.${Date.now()}@gmail.com`;
      const password = `StrongPass${i}!2026`;
      const fullName = `Synthetic Gmail User ${i}`;
      const bloodGroup = bloodGroups[(i - 1) % bloodGroups.length];

      // 1. Direct Email / Gmail Signup (No Phone, No OTP required)
      const signupRes = await fetch(`${BASE}/api/auth/email-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          intent: 'donor'
        })
      });

      assert.equal(signupRes.status, 201, `Signup failed for ${email} with status ${signupRes.status}`);
      const signupData = await signupRes.json() as any;
      assert.ok(signupData.session?.access_token, `Missing access_token for ${email}`);
      assert.ok(signupData.profile?.id, `Missing profile ID for ${email}`);
      assert.equal(signupData.profile.whatsapp_verified, true, `whatsapp_verified should be auto-true for ${email}`);

      const token = signupData.session.access_token;

      // 2. Fetch /api/auth/me using token
      const meRes = await fetch(`${BASE}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      assert.equal(meRes.status, 200, `me endpoint failed for ${email}`);
      const meData = await meRes.json() as any;
      assert.equal(meData.profile.full_name, fullName, `Name mismatch for ${email}`);

      // 3. Complete Donor Profile (Blood Group & Pincode) without being blocked by phone number
      const profileRes = await fetch(`${BASE}/api/donor-profile/complete`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          blood_group: bloodGroup,
          pincode: '110001',
          area: 'Connaught Place',
          city: 'New Delhi',
          health_self_declaration: true
        })
      });

      assert.equal(profileRes.status, 200, `Profile completion failed for ${email} with status ${profileRes.status}`);
      const profileData = await profileRes.json() as any;
      assert.equal(profileData.donorProfile.blood_group, bloodGroup, `Blood group mismatch for ${email}`);

      successCount++;
    }

    assert.equal(successCount, TOTAL_TEST_ACCOUNTS, `All ${TOTAL_TEST_ACCOUNTS} synthetic Gmail signups should complete cleanly`);
  });
});
