/**
 * Resend email provider adapter.
 *
 * Provider adapter — call ONLY via the Messaging Service queue
 * (src/lib/messaging.ts). No route/caller imports this directly.
 */

import { Resend } from "resend";

// ─── Daily Email Quota Counter (Resend free tier = 100/day) ────────────────
let dailyEmailSentCount = 0;
let dailyEmailResetDate = new Date().toDateString();
const DAILY_EMAIL_LIMIT = 90; // 10 buffer below Resend's 100/day

export function canSendEmail(): boolean {
  const today = new Date().toDateString();
  if (today !== dailyEmailResetDate) {
    dailyEmailSentCount = 0;
    dailyEmailResetDate = today;
    console.log("[EmailQuota] Daily counter reset.");
  }
  if (dailyEmailSentCount >= DAILY_EMAIL_LIMIT) {
    console.warn(`[EmailQuota] ⚠️ Daily limit reached (${dailyEmailSentCount}/${DAILY_EMAIL_LIMIT}). Email blocked.`);
    return false;
  }
  return true;
}

function trackEmailSent() {
  dailyEmailSentCount++;
  if (dailyEmailSentCount >= 80) {
    console.warn(`[EmailQuota] ⚠️ Approaching limit: ${dailyEmailSentCount}/${DAILY_EMAIL_LIMIT}`);
  }
}

/** Helper: detect Gmail addresses (skip OTP for these) */
export function isGmailAddress(email: string): boolean {
  return email.trim().toLowerCase().endsWith('@gmail.com');
}

export async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  // Check daily quota before sending
  if (!canSendEmail()) {
    console.warn(`[Email] Daily quota exhausted — skipping email to ${to}`);
    return false;
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY not set — skipped.");
    throw new Error("Email service not configured (RESEND_API_KEY missing).");
  }
  const resend = new Resend(apiKey);
  const sender = process.env.RESEND_SENDER_EMAIL || "FindMyDonor <official@findmydonor.online>";
  const fromAddress = sender.includes("<") ? sender : `FindMyDonor <${sender}>`;
  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to: [to],
    subject,
    html,
    text,
  });
  if (error) {
    const detail = (error as any).message || JSON.stringify(error);
    console.error(`[Email] Resend error sending to ${to}:`, error);
    throw new Error(`Resend API error: ${detail}`);
  }
  trackEmailSent();
  console.log(`[Email] Sent OK → ${to} (id: ${(data as any)?.id ?? 'n/a'}) [${dailyEmailSentCount}/${DAILY_EMAIL_LIMIT} today]`);
  return true;
}
