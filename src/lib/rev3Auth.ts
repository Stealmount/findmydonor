// Rev 3 frontend auth client — thin typed wrappers over the frozen backend contract.
// Slices 1–5 all talk through these helpers so the API surface stays in one place
// and the components stay declarative.
import { supabase } from './supabase';
import { ApiError } from './api';
import type { Profile, DonorProfile, Institution, User } from '../types';

export type Rev3NextStep = 'basic' | 'intent' | 'complete' | 'contact' | 'donor-profile';

export interface Rev3Me {
  authUser: { id: string; email: string | null; provider: string | null };
  profile: Profile | null;
  donorProfile: DonorProfile | null;
  institution: Institution | null;
  nextStep: Rev3NextStep;
}

// ── Raw fetch helpers ─────────────────────────────────────────────────────────
async function postJson(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = payload.error || payload.message || 'Request failed. Please try again.';
    throw new ApiError(message, res.status, payload.code, payload.details);
  }
  return payload as any;
}

async function getJson(path: string, token: string) {
  const res = await fetch(path, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = payload.error || payload.message || 'Request failed. Please try again.';
    throw new ApiError(message, res.status, payload.code, payload.details);
  }
  return payload as any;
}

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || '';
}

// ── Email OTP flow (Slice 1) ──────────────────────────────────────────────
export function sendEmailOtp(email: string) {
  return postJson('/api/email/send-otp', { email });
}
export function verifyEmailOtp(email: string, otp: string) {
  return postJson('/api/email/verify-otp', { email, otp });
}

/**
 * Complete an email sign-in: server decides new-vs-existing, creates/links the
 * profile, and returns a Supabase session (or a magic link when internal creds
 * are unrecoverable).
 */
export async function emailComplete(email: string, verificationToken: string, fullName: string, intent?: string) {
  const payload = await postJson('/api/auth/email-complete', { email, verificationToken, fullName, intent });
  if (payload.session?.access_token) {
    await supabase.auth.setSession(payload.session);
  }
  return payload as {
    profile?: Profile | null;
    session?: { access_token: string } | null;
    magicLink?: string | null;
    isNewUser?: boolean;
    nextStep?: Rev3NextStep;
  };
}

// ── Google flow (Slice 1) ────────────────────────────────────────────────
export async function googleSignIn(callbackPath: string = window.location.pathname || '/auth/signin') {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${callbackPath}` },
  });
  if (error) throw error;
}

/** Ensure a Google identity has a profile + link. Called after OAuth return. */
export async function completeGoogle(email: string, fullName: string) {
  const token = await getToken();
  return postJson('/api/auth/complete-verification', { email, fullName }, token) as Promise<{
    profile?: Profile | null;
    donorProfile?: DonorProfile | null;
    isNewUser?: boolean;
    nextStep?: Rev3NextStep;
  }>;
}

// ── Session / me (all slices) ─────────────────────────────────────────────
export async function fetchMe() {
  const token = await getToken();
  return getJson('/api/auth/me', token) as Promise<Rev3Me>;
}

// TODO(Phase6):
// Remove legacy compatibility layer after frontend cutover is complete.
/**
 * Map a Rev 3 /me payload onto the legacy dashboard shapes (User / Requester /
 * HospitalUser) so the existing donor/requester/hospital dashboards keep
 * working until the Phase 6 cleanup removes them.
 */
export function toLegacy(me: Rev3Me) {
  const { authUser, profile, donorProfile, institution } = me;
  if (institution) {
    return {
      institution,
      donor: null,
      requester: null,
    } as const;
  }
  if (profile?.can_donate) {
    return {
      institution: null,
      donor: {
        id: authUser.id,
        full_name: profile.full_name,
        email: profile.email || '',
        phone: profile.phone,
        whatsapp_number: profile.whatsapp_phone,
        blood_type: (donorProfile?.blood_group as User['blood_type']) || 'O+',
        donation_frequency: 'first_time',
        last_donation_date: donorProfile?.last_donation_date || null,
        cooldown_until: donorProfile?.cooldown_until || null,
        pincode: donorProfile?.pincode || '',
        area: donorProfile?.area || '',
        city: donorProfile?.city || '',
        availability_status: donorProfile?.is_available ? 'available' : 'unavailable',
        number_sharing_pref: 'on_approval',
        emergency_only: donorProfile?.emergency_only || false,
        account_status: 'active',
        whatsapp_verified: profile.whatsapp_verified,
        profile_complete: donorProfile?.profile_complete,
        is_available: donorProfile?.is_available,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      },
      requester: null,
    } as const;
  }
  return {
    institution: null,
    donor: null,
    requester: {
      id: authUser.id,
      full_name: profile?.full_name || '',
      email: profile?.email || '',
      phone: profile?.phone || '',
      created_at: profile?.created_at || '',
      updated_at: profile?.updated_at || '',
    },
  } as const;
}

export async function rev3Logout() {
  try {
    const token = await getToken();
    void fetch('/api/account/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch { /* non-blocking */ }
  await supabase.auth.signOut();
}

// ── Onboarding (Slice 2) ──────────────────────────────────────────────────
export function submitBasic(payload: {
  fullName?: string;
  whatsappPhone?: string;
  pincode?: string;
  city?: string;
  district?: string;
  state?: string;
  area?: string;
  notificationChannel?: 'whatsapp' | 'email' | 'both';
  verifyLater?: boolean;
}) {
  return postAuth('/api/onboarding/basic', payload);
}
export function submitIntent(payload: {
  intent: 'donor' | 'requester' | 'institution';
  bloodGroup?: string;
  isAvailable?: boolean;
  healthSelfDeclaration?: boolean;
}) {
  return postAuth('/api/onboarding/intent', payload);
}
export function completionWizard() {
  return postAuth('/api/onboarding/completion-wizard', {});
}

// ── Account settings (Slice 4) ─────────────────────────────────────────────
export function waSendOtp(phone: string) {
  return postJson('/api/wa/send-otp', { phone, purpose: 'verify' });
}
export function waVerify(phone: string, otp: string) {
  return postJson('/api/wa/verify-otp', { phone, otp, purpose: 'verify' });
}
export function changeWhatsApp(verificationToken: string, newPhone: string) {
  return postAuth('/api/account/change-whatsapp', { verificationToken, newPhone });
}
export function changeEmail(verificationToken: string, newEmail: string) {
  return postAuth('/api/account/change-email', { verificationToken, newEmail });
}
export function linkGoogle(email: string) {
  return postAuth('/api/account/link-google', { email });
}
export function unlinkGoogle() {
  return postAuth('/api/account/unlink-google', {});
}
export function exportAccount() {
  return getAuth('/api/account/export');
}

// ── Institutions (Slice 5) ─────────────────────────────────────────────────
export function myInstitutions() {
  return getAuth('/api/institutions/me');
}
export function registerInstitution(payload: Record<string, unknown>) {
  return postAuth('/api/institutions/register', payload);
}

// ── Internal: protected POST/GET ───────────────────────────────────────────
async function postAuth(path: string, body: unknown) {
  const token = await getToken();
  return postJson(path, body, token);
}
async function getAuth(path: string) {
  const token = await getToken();
  return getJson(path, token);
}
