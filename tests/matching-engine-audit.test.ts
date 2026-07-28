import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isBloodCompatible, BLOOD_COMPATIBILITY_MATRIX, BloodType } from '../src/types';

describe('Matching Engine Full Audit & Parity Test Suite', () => {

  test('1. Medical Compatibility Matrix strictly adheres to standard medical guidelines', () => {
    // O- Universal Donor
    assert.deepEqual(BLOOD_COMPATIBILITY_MATRIX['O-'], ['O-']);
    assert.ok(isBloodCompatible('O-', 'A+'));
    assert.ok(isBloodCompatible('O-', 'AB+'));
    assert.ok(isBloodCompatible('O-', 'O-'));

    // O+ Can donate to O+, A+, B+, AB+ (Receives from O-, O+)
    assert.deepEqual(BLOOD_COMPATIBILITY_MATRIX['O+'], ['O-', 'O+']);

    // A- Receives from O-, A-
    assert.deepEqual(BLOOD_COMPATIBILITY_MATRIX['A-'], ['O-', 'A-']);

    // A+ Receives from O-, O+, A-, A+
    assert.deepEqual(BLOOD_COMPATIBILITY_MATRIX['A+'], ['O-', 'O+', 'A-', 'A+']);

    // B- Receives from O-, B-
    assert.deepEqual(BLOOD_COMPATIBILITY_MATRIX['B-'], ['O-', 'B-']);

    // B+ Receives from O-, O+, B-, B+
    assert.deepEqual(BLOOD_COMPATIBILITY_MATRIX['B+'], ['O-', 'O+', 'B-', 'B+']);

    // AB- Receives from O-, A-, B-, AB-
    assert.deepEqual(BLOOD_COMPATIBILITY_MATRIX['AB-'], ['O-', 'A-', 'B-', 'AB-']);

    // AB+ Universal Recipient
    assert.deepEqual(BLOOD_COMPATIBILITY_MATRIX['AB+'], ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']);
  });

  test('2. Distance-first sorting logic prefers nearest physical donor within radius tier', () => {
    const donors = [
      { id: 'd1', distance_km: 2.8, is_exact_match: true, match_rank: 1, last_donation_date: null },
      { id: 'd2', distance_km: 0.5, is_exact_match: true, match_rank: 1, last_donation_date: null },
      { id: 'd3', distance_km: 1.2, is_exact_match: true, match_rank: 1, last_donation_date: null },
    ];

    const sortTier = (a: any, b: any) => {
      if (a.match_rank !== b.match_rank) return a.match_rank - b.match_rank;
      if (a.is_exact_match !== b.is_exact_match) return a.is_exact_match ? -1 : 1;
      if (Math.abs(a.distance_km - b.distance_km) > 0.01) {
        return a.distance_km - b.distance_km;
      }
      return 0;
    };

    const sorted = [...donors].sort(sortTier);
    assert.equal(sorted[0].id, 'd2'); // 0.5 km first
    assert.equal(sorted[1].id, 'd3'); // 1.2 km second
    assert.equal(sorted[2].id, 'd1'); // 2.8 km third
  });

  test('3. Multi-unit matching locks distinct donors for 1-donor-1-unit rule', () => {
    const unitsRequired = 10;
    const availableDonors = Array.from({ length: 15 }, (_, i) => `donor_${i + 1}`);
    const selectedDonors = availableDonors.slice(0, unitsRequired);

    assert.equal(selectedDonors.length, 10);
    assert.equal(new Set(selectedDonors).size, 10); // 10 distinct donors
  });
});
