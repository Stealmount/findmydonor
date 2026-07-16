import { BloodRequest, User, Match, isBloodCompatible, BLOOD_COMPATIBILITY_MATRIX, BloodType } from '../types';
import { getCollection as getLocalOrFirestoreCollection, saveDoc as saveLocalOrFirestoreDoc } from './db';
import { sendRealEmail } from './email';
import { getDistanceBetweenPincodes } from './geo';
import { buildDonorSosMessage } from './waha';

/**
 * Pure (no I/O) eligibility check for a single donor against a request.
 * Used directly by the test suite to run matching logic over synthetic donor pools.
 */
export function isDonorEligible(donor: User, request: BloodRequest, todayStr: string): boolean {
  if (donor.account_status !== 'active') return false;
  if (!donor.whatsapp_verified) return false;
  if (donor.profile_complete === false) return false;
  if (donor.is_available === false) return false;
  if (donor.availability_status === 'unavailable') return false;
  if (donor.cooldown_until && donor.cooldown_until >= todayStr) return false;
  if (request.blood_type_needed !== 'ANY') {
    const donorType = (donor.blood_type || '').toUpperCase().trim() as BloodType;
    if (!isBloodCompatible(donorType, request.blood_type_needed as BloodType)) return false;
  }
  if (donor.emergency_only && request.urgency_level !== 'critical') return false;
  if (donor.phone === request.requester_phone) return false;
  if ((donor.email || '').toLowerCase().trim() === (request.requester_email || '').toLowerCase().trim()) return false;
  return true;
}

/**
 * Pure (no I/O) function: filters and ranks a supplied donor pool against a request.
 * Returns donors tagged with distance_km, match_rank, and is_exact_match.
 * Used by the test suite to drive the engine with synthetic data.
 */
export function findEligibleDonorsSync(
  allDonors: User[],
  request: BloodRequest,
  existingMatchedIds: Set<string> = new Set()
): (User & { distance_km: number; match_rank: number; is_exact_match: boolean })[] {
  const todayStr = new Date().toISOString().split('T')[0];
  const neededBlood = (request.blood_type_needed || '').toUpperCase().trim();
  const reqHospPin  = (request.hospital_pincode || '').replace(/\s+/g, '');
  const reqHospCity = (request.hospital_city || '').trim().toLowerCase();

  const eligible = allDonors.filter(d => {
    if (existingMatchedIds.has(d.id)) return false;
    return isDonorEligible(d, request, todayStr);
  });

  const withMeta = eligible.map(d => {
    const dist = getDistanceBetweenPincodes(d.pincode, reqHospPin);
    const is_exact_match = neededBlood === 'ANY'
      ? true
      : (d.blood_type || '').toUpperCase().trim() === neededBlood;
    return { ...d, distance_km: dist, match_rank: 4 as number, is_exact_match };
  });

  const sortTier = (
    a: typeof withMeta[0],
    b: typeof withMeta[0]
  ) => {
    if (a.is_exact_match !== b.is_exact_match) return a.is_exact_match ? -1 : 1;
    if (!a.cooldown_until && b.cooldown_until) return -1;
    if (a.cooldown_until && !b.cooldown_until) return 1;
    if (a.cooldown_until && b.cooldown_until) return a.cooldown_until.localeCompare(b.cooldown_until);
    return (a.updated_at || '').localeCompare(b.updated_at || '');
  };

  const isRare = ['O-', 'AB-'].includes(neededBlood);
  const result: (User & { distance_km: number; match_rank: number; is_exact_match: boolean })[] = [];
  const seen = new Set<string>();

  const addTier = (donors: typeof withMeta, rank: number) => {
    const sorted = [...donors].sort(sortTier);
    for (const d of sorted) {
      if (!seen.has(d.id)) { seen.add(d.id); result.push({ ...d, match_rank: rank }); }
    }
  };

  addTier(withMeta.filter(d => d.distance_km <= 3), 1);
  if (result.length < 3 || isRare) addTier(withMeta.filter(d => d.distance_km > 3  && d.distance_km <= 10), 2);
  if (result.length < 3 || isRare) addTier(withMeta.filter(d => d.distance_km > 10 && d.distance_km <= 25), 3);
  if (result.length < 3 || isRare) addTier(withMeta.filter(d => d.distance_km > 25), 4);
  if (result.length === 0)         addTier(withMeta, 5); // national fallback

  return result;
}

/**
 * Runs the matching engine for a newly created or updated blood request.
 * Implements 4-tier geographic expansion, smart donor fatigue prevention,
 * and robust self-match protection.
 * Returns the list of matched Donors and writes Match records.
 */
export async function runMatchingEngine(request: BloodRequest): Promise<User[]> {
  // 1. Fetch all registered donors & existing matches
  const allDonors = await getLocalOrFirestoreCollection<User>('users');
  const existingMatches = await getLocalOrFirestoreCollection<Match>('matches');
  const todayStr = new Date().toISOString().split('T')[0];

  // Already matched donors for this request (deduplication)
  const alreadyMatchedDonorIds = existingMatches
    .filter(m => m.request_id === request.id)
    .map(m => m.donor_id);

  // Normalizations for strict matching
  const neededBlood = (request.blood_type_needed || '').toUpperCase().trim();
  const reqHospPin = (request.hospital_pincode || '').replace(/\s+/g, '');
  const reqHospCity = (request.hospital_city || '').trim().toLowerCase();
  const reqHospState = (request.hospital_state || '').trim().toLowerCase();

  // 2. Filter eligible donors using all hard filters
  const eligibleDonors = allDonors.filter(donor => {
    // 2.0 Hard Filter: Prevent Self-Match (same phone or email as requester)
    if (donor.phone === request.requester_phone) return false;
    if ((donor.email || '').toLowerCase().trim() === (request.requester_email || '').toLowerCase().trim()) return false;

    // 2.05 Deduplication: Skip if already matched to this request
    if (alreadyMatchedDonorIds.includes(donor.id)) return false;

    // 2.1 Hard Filter: Account status must be ACTIVE
    if (donor.account_status !== 'active') return false;

    // 2.2 Hard Filters: verified, complete, and explicitly available
    if (!donor.whatsapp_verified) return false;
    if (donor.profile_complete === false) return false;
    if (donor.is_available === false) return false;
    if (donor.availability_status === 'unavailable') return false;

    // 2.3 Hard Filter: Cooldown check
    if (donor.cooldown_until) {
      if (donor.cooldown_until >= todayStr) return false;
    }

    // 2.4 Hard Filter: Blood compatibility
    const donorBlood = (donor.blood_type || '').toUpperCase().trim() as BloodType;
    const compatible = isBloodCompatible(donorBlood, neededBlood as BloodType);
    if (!compatible) return false;

    // 2.5 Optional Filter: Emergency-only donors excluded from non-critical requests
    if (donor.emergency_only && request.urgency_level !== 'critical') {
      return false;
    }

    return true;
  });

  // 3. Smart Donor Fatigue Prevention — Sort by rested-ness
  // Donors who haven't donated recently (older cooldown_until or no cooldown) get priority
  const sortedEligible = [...eligibleDonors].sort((a, b) => {
    // Prefer donors with no cooldown history (never donated = most rested)
    if (!a.cooldown_until && b.cooldown_until) return -1;
    if (a.cooldown_until && !b.cooldown_until) return 1;
    // If both have cooldown history, prefer the one who recovered longest ago (older date = earlier recovery)
    if (a.cooldown_until && b.cooldown_until) {
      return a.cooldown_until.localeCompare(b.cooldown_until);
    }
    return 0;
  });

  // 4. 4-Tier Geographic Expansion Matching
  let matchedDonors: { donor: User; rank: number }[] = [];
  const addedIds = new Set<string>();

  const addDonors = (donors: User[], rank: number) => {
    for (const d of donors) {
      if (!addedIds.has(d.id)) {
        matchedDonors.push({ donor: d, rank });
        addedIds.add(d.id);
      }
    }
  };

  // TIER 1: Exact Pincode match (highest priority — hyperlocal)
  const tier1 = sortedEligible.filter(d =>
    (d.pincode || '').replace(/\s+/g, '') === reqHospPin
  );
  addDonors(tier1, 1);

  // TIER 2: Adjacent Pincodes (±50 range to cover the whole district)
  if (matchedDonors.length < 5) {
    const hospPin = parseInt(reqHospPin, 10);
    if (!isNaN(hospPin)) {
      const tier2 = sortedEligible.filter(d => {
        const donorPin = parseInt((d.pincode || '').replace(/\s+/g, ''), 10);
        if (isNaN(donorPin)) return false;
        const diff = Math.abs(donorPin - hospPin);
        return diff > 0 && diff <= 50;
      });
      addDonors(tier2, 2);
    }
  }

  // TIER 3: City-wide match
  if (matchedDonors.length < 5 && reqHospCity) {
    const tier3 = sortedEligible.filter(d =>
      (d.city || '').trim().toLowerCase() === reqHospCity
    );
    addDonors(tier3, 3);
  }

  // TIER 4: State-wide match (critical for rare blood types like AB-, B-)
  if (matchedDonors.length < 5 && reqHospState) {
    const tier4 = sortedEligible.filter(d =>
      (d.state || '').trim().toLowerCase() === reqHospState
    );
    addDonors(tier4, 4);
  }

  // Fallback: If absolutely no donors found anywhere, add ALL eligible donors (national call)
  if (matchedDonors.length === 0) {
    addDonors(sortedEligible, 5);
  }

  // Sort by rank, then limit — critical requests get more donors notified (15), others get 10
  matchedDonors.sort((a, b) => a.rank - b.rank);
  const maxMatches = request.urgency_level === 'critical' ? 15 : 10;
  const finalMatches = matchedDonors.slice(0, maxMatches);

  // 5. Record matches in the database & send notifications
  const matchesToSave: Match[] = [];

  for (const item of finalMatches) {
    const matchId = crypto.randomUUID();
    const tierLabels = ['', 'Exact Pincode', 'Adjacent Area', 'City-wide', 'State-wide', 'National Call'];
    const newMatch: Match = {
      id: matchId,
      request_id: request.id,
      donor_id: item.donor.id,
      match_rank: item.rank,
      notification_channel: 'both',
      notification_sent_at: new Date().toISOString(),
      reminder_sent_at: null,
      donor_response: 'pending',
      donor_response_at: null,
      contact_shared_at: null,
      outcome: null,
      outcome_confirmed_at: null,
      created_at: new Date().toISOString(),
      distance_km: getDistanceBetweenPincodes(item.donor.pincode, request.hospital_pincode),
      // Tag as exact or compatible match for requester transparency
      is_exact_match: (item.donor.blood_type || '').toUpperCase().trim() === (request.blood_type_needed || '').toUpperCase().trim(),
    };

    await saveLocalOrFirestoreDoc('matches', matchId, newMatch);
    matchesToSave.push(newMatch);

    // WhatsApp notification (WAHA)
    const whatsappMsgId = crypto.randomUUID();
    const whatsappBody = buildDonorSosMessage(request, item.donor);

    await saveLocalOrFirestoreDoc('notifications', whatsappMsgId, {
      id: whatsappMsgId,
      type: 'whatsapp',
      recipient_type: 'donor',
      recipient_id: item.donor.id,
      trigger_event: 'match_found',
      message_body: whatsappBody,
      status: 'delivered',
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });

    // In-App notification
    const inAppMsgId = crypto.randomUUID();
    const inAppBody = `🩸 Urgent Match: ${request.blood_type_needed} needed at ${request.hospital_name}, ${request.hospital_city}. Urgency: ${request.urgency_level}. ${item.rank > 1 ? `(${tierLabels[item.rank]} search — your help can save a life!)` : ''}`;

    await saveLocalOrFirestoreDoc('notifications', inAppMsgId, {
      id: inAppMsgId,
      type: 'in_app',
      recipient_type: 'donor',
      recipient_id: item.donor.id,
      trigger_event: 'match_found',
      message_body: inAppBody,
      status: 'sent',
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });
  }

  // 6. Update blood request status & notify requester
  let requestStatus: 'matching' | 'open' = 'matching';
  if (finalMatches.length === 0) {
    requestStatus = 'open';

    // Admin alert when no donors found anywhere
    const adminNotifId = crypto.randomUUID();
    const adminMsg = `⚠️ ALERT: Blood Request ${request.tracking_code} for ${request.blood_type_needed} at ${request.hospital_name} (${request.hospital_city}) has 0 matching donors found even after 4-tier geographic expansion. Urgency: ${request.urgency_level.toUpperCase()}. Immediate manual intervention required.`;
    await saveLocalOrFirestoreDoc('notifications', adminNotifId, {
      id: adminNotifId,
      type: 'email',
      recipient_type: 'receiver',
      recipient_id: 'admin@raktdaan.org',
      trigger_event: 'no_match_found',
      message_body: adminMsg,
      status: 'sent',
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });
    await sendRealEmail('admin@raktdaan.org', `URGENT: No Donors Matched - Request ${request.tracking_code}`, adminMsg);

    // Requester email — no matches
    const recNotifId = crypto.randomUUID();
    const recNoMatchMsg = `Dear ${request.requester_name},\n\nYour blood request (${request.tracking_code}) has been successfully registered.\n\nCurrently, there are no immediate matching donors in your area or even state-wide. Our administrators have been alerted and are reaching out to extended networks manually.\n\nPlease track your request here: ${window.location.origin}/?view=tracking&code=${request.tracking_code}\n\nWe sincerely regret the urgency of your situation. — RaktDaan Team`;
    await saveLocalOrFirestoreDoc('notifications', recNotifId, {
      id: recNotifId,
      type: 'email',
      recipient_type: 'receiver',
      recipient_id: request.requester_email,
      trigger_event: 'no_match_found',
      message_body: recNoMatchMsg,
      status: 'sent',
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });
    await sendRealEmail(request.requester_email, `RaktDaan: Request Registered (Searching Extensively) - ${request.tracking_code}`, recNoMatchMsg);
  } else {
    // Requester email — matches found with tier breakdown
    const tier1Count = finalMatches.filter(m => m.rank === 1).length;
    const expandedCount = finalMatches.filter(m => m.rank > 1).length;
    let tierNote = '';
    if (expandedCount > 0) {
      tierNote = ` (including ${expandedCount} donor(s) found via expanded geographic search)`;
    }

    const recNotifId = crypto.randomUUID();
    const recMatchMsg = `Dear ${request.requester_name},\n\nYour blood request (${request.tracking_code}) has been registered successfully! 🩸\n\nWe found ${finalMatches.length} matching donor(s) nearby${tierNote} and sent them instant alerts.\n\nOnce a donor approves, their contact details will appear on your tracking page:\n${window.location.origin}/?view=tracking&code=${request.tracking_code}\n\nThank you for trusting RaktDaan. — RaktDaan Team`;
    await saveLocalOrFirestoreDoc('notifications', recNotifId, {
      id: recNotifId,
      type: 'email',
      recipient_type: 'receiver',
      recipient_id: request.requester_email,
      trigger_event: 'match_found',
      message_body: recMatchMsg,
      status: 'sent',
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });
    await sendRealEmail(request.requester_email, `RaktDaan: ${finalMatches.length} Donor(s) Matched for Your Request - ${request.tracking_code}`, recMatchMsg);
  }

  await saveLocalOrFirestoreDoc('blood_requests', request.id, {
    ...request,
    status: requestStatus,
    updated_at: new Date().toISOString()
  });

  return finalMatches.map(item => item.donor);
}
