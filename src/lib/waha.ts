/**
 * WAHA — WhatsApp HTTP API Integration
 * Self-hosted WhatsApp messaging via WAHA Docker container.
 * Docs: https://waha.devlike.pro/docs/
 *
 * Required env vars:
 *   WAHA_BASE_URL  — e.g. http://localhost:3001  (or Railway URL)
 *   WAHA_API_KEY   — optional, set in WAHA dashboard
 *   WAHA_SESSION   — session name (default: "default")
 */

import type { BloodRequest, User } from '../types';
import { getDistanceBetweenPincodes } from './geo';

const WAHA_URL     = process.env.WAHA_BASE_URL;
const WAHA_KEY     = process.env.WAHA_API_KEY || '';
const WAHA_SESSION = process.env.WAHA_SESSION || 'default';

/** Normalize Indian phone → WhatsApp chatId format (91XXXXXXXXXX@c.us) */
function toChatId(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Prepend country code if missing
  const normalized = digits.startsWith('91') ? digits : `91${digits}`;
  return `${normalized}@c.us`;
}

/**
 * Sends a WhatsApp text message via WAHA.
 * Returns true on success, false if WAHA is not configured or call fails.
 */
export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  if (!WAHA_URL) {
    console.warn('[WAHA] WAHA_BASE_URL not set — WhatsApp delivery skipped.');
    return false;
  }

  const chatId = toChatId(phone);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`${WAHA_URL}/api/sendText`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(WAHA_KEY ? { 'X-Api-Key': WAHA_KEY } : {}),
        },
        body: JSON.stringify({
          session: WAHA_SESSION,
          chatId,
          text: message,
        }),
        signal: AbortSignal.timeout(5_000),
      });

      if (response.ok) {
        console.log(`[WAHA] ✅ Delivered to ${phone}`);
        return true;
      }

      const retryable = response.status === 429 || response.status >= 500;
      console.error(`[WAHA] HTTP ${response.status} for ${phone}${retryable && attempt < 3 ? `; retry ${attempt}/3` : ''}`);
      if (!retryable) return false;
    } catch (error) {
      console.error(`[WAHA] Attempt ${attempt}/3 failed for ${phone}:`, error);
    }

    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }

  return false;
}

/**
 * Build the OTP WhatsApp message sent during registration.
 */
export function buildOtpMessage(otp: string): string {
  return `Your RaktDaan verification code is: *${otp}*

This code is valid for 5 minutes. Do not share it with anyone.`;
}

/**
 * Build the SOS WhatsApp message sent to a matched donor.
 * Concise, human-sounding — no repeated urgency words, max 1-2 emojis.
 */
export function buildDonorSosMessage(request: BloodRequest, donor: User): string {
  const firstName = donor.full_name.split(' ')[0];
  const distance = getDistanceBetweenPincodes(donor.pincode, request.hospital_pincode);
  const urgencyNote = request.urgency_level === 'critical'
    ? 'This is a critical case.'
    : request.urgency_level === 'urgent'
    ? 'Needed urgently.'
    : 'Scheduled need.';

  return `Hi ${firstName}, there's a blood request nearby that matches your profile.

${request.blood_type_needed} blood needed · ${request.units_required} unit(s) · ${request.hospital_name}, ${request.hospital_area}
About ${distance} km from you. ${urgencyNote}

Can you help? Reply YES to accept or NO to pass.
Contact details and directions are shared only after you reply YES.`;
}

/**
 * Build the full details message sent to a donor after they reply YES.
 */
export function buildDonorConfirmedDetailsMessage(request: BloodRequest, donor: User): string {
  const firstName = donor.full_name.split(' ')[0];
  const mapQuery = encodeURIComponent(`${request.hospital_name}, ${request.hospital_area}, ${request.hospital_city}, ${request.hospital_pincode}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

  return `Thank you for accepting, ${firstName}. 🙏

Patient: ${request.patient_name || 'N/A'} · ${request.blood_type_needed} · ${request.units_required} unit(s)
Hospital: ${request.hospital_name}, ${request.hospital_area}, ${request.hospital_city}
${request.attending_doctor ? `Doctor: ${request.attending_doctor}\n` : ''}Requester: ${request.requester_name} · ${request.requester_phone}

Directions: ${mapsUrl}

Please call or WhatsApp the requester to coordinate your arrival.`;
}

/**
 * WhatsApp message confirming a donor match to the requester — celebratory, short.
 */
export function buildRequesterConfirmMessage(request: BloodRequest, donorName: string): string {
  const firstName = request.requester_name.split(' ')[0];
  const trackingUrl = `${process.env.APP_URL || 'https://raktdaan.duckdns.org'}/tracking?code=${request.tracking_code}`;

  return `🎉 Good news, ${firstName} — ${donorName} has agreed to donate!

Blood group: ${request.blood_type_needed} · ${request.hospital_name}
We'll share their contact once they confirm arrival.

Track live: ${trackingUrl}`;
}

/**
 * WhatsApp message to donor after they confirm donation.
 */
export function buildDonorThankYouMessage(donor: User, trackingCode: string, cooldownUntil: string): string {
  const firstName = donor.full_name.split(' ')[0];
  return `Thank you, ${firstName}. Your decision to donate for request \`${trackingCode}\` will save a life today. 🩸

Your 60-day safety cooldown is now active. You won't receive new requests until ${cooldownUntil}.

We appreciate you.`;
}

/**
 * WhatsApp message for new donor registration welcome.
 */
export function buildWelcomeMessage(donorName: string): string {
  const firstName = donorName.split(' ')[0];
  return `Welcome to RaktDaan, ${firstName}! 🩸

You're now registered as a volunteer blood donor. When there's a blood request nearby that matches your profile, we'll reach out here on WhatsApp.

How it works:
1. You get a message when someone nearby needs your blood type.
2. Reply YES if you can help, NO if you can't.
3. We share the hospital details and connect you with the requester.

Thank you for signing up.`;
}

/**
 * WhatsApp alert sent to requester right after their request goes live.
 */
export function buildRequesterSystemAlertMessage(request: BloodRequest, alertedCount: number): string {
  const firstName = request.requester_name.split(' ')[0];
  const trackingUrl = `${process.env.APP_URL || 'https://raktdaan.duckdns.org'}/tracking?code=${request.tracking_code}`;
  return `Hi ${firstName}, your request is live. We've alerted ${alertedCount} matching donor(s) nearby.

We'll message you as soon as someone accepts.
Track live: ${trackingUrl}`;
}

/**
 * WhatsApp alert sent to requester when no matching donors are available on initial search.
 */
export function buildNoDonorsFoundAlertMessage(request: BloodRequest): string {
  const firstName = request.requester_name.split(' ')[0];
  const trackingUrl = `${process.env.APP_URL || 'https://raktdaan.duckdns.org'}/tracking?code=${request.tracking_code}`;
  return `Hi ${firstName}, your request (${request.tracking_code}) has been registered. 🩸

No matching donor is available right now, but our system retries every 2 minutes. We'll message you the moment someone becomes available.

Track: ${trackingUrl}`;
}

/**
 * WhatsApp acknowledgement sent to a donor when they reply NO to decline a match.
 */
export function buildDonorDeclineAckMessage(): string {
  return `Understood. We've removed you from this request. Thank you for letting us know quickly. 🙏`;
}
