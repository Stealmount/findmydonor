import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDonorSosInteractivePayload, sendWhatsAppButtons } from '../src/lib/waha';
import type { BloodRequest, User } from '../src/types';

describe('WAHA WhatsApp Interactive Buttons Test Suite', () => {
  const dummyRequest: BloodRequest = {
    id: 'req-test-123',
    tracking_code: 'BLD-2026-TEST1234',
    patient_name: 'Rahul Sharma',
    blood_type_needed: 'O+',
    units_required: 1,
    hospital_name: 'AIIMS Trauma Centre',
    hospital_pincode: '110029',
    hospital_area: 'Ansari Nagar',
    hospital_city: 'New Delhi',
    urgency_level: 'critical',
    requester_id: 'req-user-1',
    requester_name: 'Anjali Sharma',
    requester_phone: '919999988888',
    requester_email: 'anjali@example.com',
    additional_notes: null,
    status: 'broadcasting',
    expires_at: null,
    fulfilled_at: null,
    created_at: new Date().toISOString(),
  };

  const dummyDonor: User = {
    id: 'donor-user-1',
    full_name: 'Vikram Singh',
    email: 'vikram@example.com',
    blood_type: 'O+',
    donation_frequency: 'regular',
    last_donation_date: null,
    cooldown_until: null,
    pincode: '110029',
    city: 'New Delhi',
    area: 'Ansari Nagar',
    phone: '919876543210',
    whatsapp_number: '919876543210',
    availability_status: 'available',
    number_sharing_pref: 'on_approval',
    emergency_only: false,
    account_status: 'active',
    whatsapp_verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  test('buildDonorSosInteractivePayload generates correct title, body and 1-tap buttons', () => {
    const matchId = 'match-uuid-999';
    const payload = buildDonorSosInteractivePayload(dummyRequest, dummyDonor, matchId);

    assert.ok(payload.title.includes('CRITICAL EMERGENCY'));
    assert.ok(payload.text.includes('Vikram'));
    assert.ok(payload.text.includes('AIIMS Trauma Centre'));
    assert.ok(payload.text.includes('BLD-2026-TEST1234'));
    assert.equal(payload.buttons.length, 2);

    assert.equal(payload.buttons[0].id, `ACCEPT_${matchId}`);
    assert.ok(payload.buttons[0].text.includes('YES'));

    assert.equal(payload.buttons[1].id, `DECLINE_${matchId}`);
    assert.ok(payload.buttons[1].text.includes('NOT AVAILABLE'));
  });

  test('sendWhatsAppButtons falls back to sendWhatsApp text gracefully when WAHA_BASE_URL is not set', async () => {
    delete process.env.WAHA_BASE_URL;
    const ok = await sendWhatsAppButtons(
      '919876543210',
      'CRITICAL MATCH',
      'Patient needs O+ blood',
      'FindMyDonor SOS',
      [
        { id: 'ACCEPT_123', text: 'YES' },
        { id: 'DECLINE_123', text: 'NO' }
      ]
    );
    // When WAHA_BASE_URL is not set, fallback returns false without throwing error
    assert.equal(ok, false);
  });
});
