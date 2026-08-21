import 'dotenv/config';
import './setup-env';
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/lib/firebase';
import { saveDoc as saveLocalOrFirestoreDoc, getDoc as getLocalOrFirestoreDoc } from '../src/lib/serverDb';
import { cacheInvalidatePrefix } from '../src/lib/redisCache';
import { matchAndNotifyRequest, releaseDonorLock } from '../services/matchingEngine';
import { normalizePhone } from '../helpers/phone';
import { nowISO } from '../helpers/time';
import type { BloodRequest, User } from '../src/types';

describe('Custom Numbers E2E Test (Donor: 8076971891, Requester: 9354944588)', () => {
  const DONOR_PHONE_RAW = '8076971891';
  const REQUESTER_PHONE_RAW = '9354944588';

  const DONOR_PHONE = normalizePhone(DONOR_PHONE_RAW); // 918076971891
  const REQUESTER_PHONE = normalizePhone(REQUESTER_PHONE_RAW); // 919354944588

  const DONOR_ID = `donor-${DONOR_PHONE}`;
  const REQUESTER_ID = `requester-${REQUESTER_PHONE}`;
  const REQUEST_ID = `req-${Date.now()}`;

  test('1. Setup Donor Profile (8076971891 - O+ Available Donor in Delhi 110001)', async () => {
    assert.equal(DONOR_PHONE, '918076971891');

    const profileData = {
      id: DONOR_ID,
      full_name: 'Volunteer Donor (Rohit)',
      email: 'donor.rohit@example.com',
      phone: DONOR_PHONE,
      whatsapp_phone: DONOR_PHONE,
      whatsapp_verified: true,
      auth_method: 'google',
      can_donate: true,
      can_request: true,
      onboarding_step: 'complete',
      created_at: nowISO(),
      updated_at: nowISO(),
    };

    const donorProfileData = {
      profile_id: DONOR_ID,
      blood_group: 'O+',
      pincode: '110001',
      area: 'Connaught Place',
      city: 'Delhi',
      district: 'Central Delhi',
      state: 'Delhi',
      is_available: true,
      profile_complete: true,
      health_self_declaration: true,
      updated_at: nowISO(),
    };

    const legacyUserData: User = {
      id: DONOR_ID,
      full_name: 'Volunteer Donor (Rohit)',
      email: 'donor.rohit@example.com',
      phone: DONOR_PHONE,
      whatsapp_number: DONOR_PHONE,
      blood_type: 'O+',
      donation_frequency: 'first_time',
      last_donation_date: null,
      cooldown_until: null,
      pincode: '110001',
      area: 'Connaught Place',
      city: 'Delhi',
      availability_status: 'available',
      number_sharing_pref: 'on_approval',
      emergency_only: false,
      account_status: 'active',
      whatsapp_verified: true,
      profile_complete: true,
      is_available: true,
      created_at: nowISO(),
      updated_at: nowISO(),
    };

    await saveLocalOrFirestoreDoc('profiles', DONOR_ID, profileData);
    await saveLocalOrFirestoreDoc('donor_profiles', DONOR_ID, donorProfileData);
    await saveLocalOrFirestoreDoc('users', DONOR_ID, legacyUserData as any);

    console.log(`[E2E Test] Donor profile created for ${DONOR_PHONE} (O+ in Delhi 110001)`);
    assert.ok(true);
  });

  test('2. Setup Requester & Submit Blood Request (9354944588 needing O+)', async () => {
    assert.equal(REQUESTER_PHONE, '919354944588');

    const requesterProfile = {
      id: REQUESTER_ID,
      full_name: 'Requester (Priya)',
      email: 'priya.requester@example.com',
      phone: REQUESTER_PHONE,
      whatsapp_phone: REQUESTER_PHONE,
      whatsapp_verified: true,
      auth_method: 'google',
      can_donate: false,
      can_request: true,
      onboarding_step: 'complete',
      created_at: nowISO(),
      updated_at: nowISO(),
    };

    await saveLocalOrFirestoreDoc('profiles', REQUESTER_ID, requesterProfile);

    const bloodRequest: BloodRequest = {
      id: REQUEST_ID,
      tracking_code: `BLD-2026-TEST-${REQUEST_ID.slice(-6)}`,
      patient_name: 'Patient Verification Test',
      patient_age: 35,
      patient_gender: 'Female',
      blood_type_needed: 'O+',
      units_required: 1,
      hospital_name: 'AIIMS New Delhi',
      hospital_pincode: '110001',
      hospital_area: 'Ansari Nagar',
      hospital_city: 'Delhi',
      hospital_state: 'Delhi',
      urgency_level: 'critical',
      requester_id: REQUESTER_ID,
      requester_name: 'Priya Verma',
      requester_email: 'priya.requester@example.com',
      requester_phone: REQUESTER_PHONE,
      additional_notes: 'Urgent requirement for surgery',
      status: 'broadcasting',
      showcase_opt_in: true,
      share_contact_immediately: true,
      expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      fulfilled_at: null,
      created_at: nowISO(),
    };

    await saveLocalOrFirestoreDoc('blood_requests', REQUEST_ID, bloodRequest as any);
    console.log(`[E2E Test] Blood Request created for ${REQUESTER_PHONE} (Needing O+ at AIIMS 110001)`);
    assert.ok(true);
  });

  test('3. Execute Matching Engine & Verify Match Creation', async () => {
    const bloodRequest = await getLocalOrFirestoreDoc<BloodRequest>('blood_requests', REQUEST_ID);
    assert.ok(bloodRequest, 'Blood request must exist');
    await cacheInvalidatePrefix('eligible_');
    await releaseDonorLock(DONOR_ID);
    let matchedCount = 0;
    try {
      const result = await matchAndNotifyRequest(bloodRequest!);
      matchedCount = result.matched;
      console.log(`[E2E Test] Matching Engine execution result:`, JSON.stringify(result));
      assert.ok(result.matched >= 1, `Matching engine should find at least 1 match for donor ${DONOR_PHONE}`);
    } catch (err: any) {
      console.error(`[E2E Test Error] matchAndNotifyRequest error:`, err?.message || err, err?.stack);
      throw err;
    }

    const matches = await db.collection('matches').where('request_id', '==', REQUEST_ID).get().catch(() => null);
    if (matches && !matches.empty) {
      const matchDoc = matches.docs[0].data();
      console.log(`[E2E Test] Created Match ID: ${matches.docs[0].id}, Donor ID: ${matchDoc.donor_id}, Status: ${matchDoc.status}`);
      assert.equal(matchDoc.donor_id, DONOR_ID);
    } else {
      console.log(`[E2E Test] Match recorded in local store, verified matched count = ${matchedCount}`);
    }
  });
});
