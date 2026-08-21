import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:5000';

describe('Manual Auth & Profile Verification E2E Test', () => {
  test('Complete verification and resolve linked profile for Gmail user', async () => {
    // 1. Call complete-verification with stub token
    const verifyRes = await fetch(`${BASE}/api/auth/complete-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-valid-token',
      },
      body: JSON.stringify({
        email: 'user.test.2026@gmail.com',
        fullName: 'Test Gmail User',
      }),
    });

    assert.equal(verifyRes.status, 201, 'Complete verification should return 201 Created');
    const verifyData = await verifyRes.json();
    console.log('[Auth Test] complete-verification response:', JSON.stringify(verifyData));

    assert.ok(verifyData.profile, 'Profile must not be null');
    assert.equal(verifyData.profile.email, 'user.test.2026@gmail.com');

    // 2. Fetch /api/auth/me to verify session resolution
    const meRes = await fetch(`${BASE}/api/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-valid-token',
      },
    });

    assert.equal(meRes.status, 200, '/api/auth/me should return 200 OK');
    const meData = await meRes.json();
    console.log('[Auth Test] /api/auth/me response:', JSON.stringify(meData));

    assert.ok(meData.authUser, 'authUser must exist');
    assert.ok(meData.profile, 'profile must exist and not be null');
    assert.ok(meData.nextStep, 'nextStep must exist');

    // 3. Complete role intent selection
    const intentRes = await fetch(`${BASE}/api/auth/complete-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-valid-token',
      },
      body: JSON.stringify({
        intent: 'both',
        phone: '9876543210',
      }),
    });

    assert.equal(intentRes.status, 201, 'Intent selection should return 201 Created');
    const intentData = await intentRes.json();
    console.log('[Auth Test] Intent selection response:', JSON.stringify(intentData));
    assert.equal(intentData.profile.intent, 'both');
  });
});
