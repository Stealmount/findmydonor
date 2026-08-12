import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { authenticatedApi } from '../../lib/api';
import type { AuthState, BloodType, Institution, Requester, SignupIntent, User } from '../../types';
import { useLanguage } from '../../lib/LanguageContext';

interface AuthHubSignals {
  onLoginSuccessDonor: (donor: User) => void;
  onLoginSuccessRequester: (requester: Requester) => void;
  onLoginSuccessInstitution?: (institution: Institution) => void;
}

export default function useAuthHub(initialMode: 'signin' | 'signup', initialIntent: SignupIntent, signals: AuthHubSignals) {
  const { t, language } = useLanguage();
  const isHi = language === 'HI';
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  // Signup steps: 'main' = enter details, 'otp' = enter 6-digit OTP, 'donor-profile' = donor info, 'google-phone' = Google user adds phone
  const [signupStep, setSignupStep] = useState<'main' | 'otp' | 'google-phone' | 'donor-profile'>('main');
  const [signupChannel, setSignupChannel] = useState<'phone' | 'email'>('phone');
  const [intent, setIntent] = useState<SignupIntent>(initialIntent);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [devBypassNotice, setDevBypassNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Institution partner sign-in (email OTP, no password)
  const [signinMode, setSigninMode] = useState<'user' | 'institution'>('user');
  const [instStep, setInstStep] = useState<'email' | 'otp'>('email');

  // Donor profile fields (step 2 for donors)
  const [bloodGroup, setBloodGroup] = useState<BloodType | ''>('');
  const [donorPincode, setDonorPincode] = useState('');
  const [donorArea, setDonorArea] = useState('');
  const [donorCity, setDonorCity] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [lastDonationDate, setLastDonationDate] = useState('');
  const [neverDonated, setNeverDonated] = useState(false);
  const [healthDeclaration, setHealthDeclaration] = useState(false);
  const [emergencyOnly, setEmergencyOnly] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setIntent(initialIntent);

    // Check if returning from Google OAuth redirect
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const isGoogle = user.app_metadata?.provider === 'google' || Boolean(sessionStorage.getItem('findmydonor_oauth_pending'));
        if (isGoogle) {
          setFullName(String(user.user_metadata?.full_name || user.user_metadata?.name || ''));
          setEmail(user.email || '');
        }
        void resolveSignedInState();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode, initialIntent]);

  const resolveSignedInState = async (): Promise<boolean> => {
    const state = await authenticatedApi<AuthState>('/api/auth/me', undefined, 'GET').catch(() => null);
    if (!state || !state.authUser) return false;

    // Institution admin — route to hospital dashboard via App's callback (before
    // donor/requester fallback; institution profiles have can_donate=false).
    const stateWithInst = state as AuthState & { institution?: Institution | null };
    if (stateWithInst.institution) {
      signals.onLoginSuccessInstitution?.(stateWithInst.institution);
      return true;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const isGoogle = state.authUser.provider === 'google' || user?.app_metadata?.provider === 'google' || Boolean(sessionStorage.getItem('findmydonor_oauth_pending'));
    if (isGoogle && user) {
      setFullName(String(user.user_metadata?.full_name || user.user_metadata?.name || ''));
      setEmail(user.email || '');
    }

    if (!state.profile) {
      // No profile yet — Google users need to add WhatsApp number
      setMode('signup');
      const pending = sessionStorage.getItem('findmydonor_oauth_pending');
      if (pending) {
        try {
          const saved = JSON.parse(pending) as { intent: typeof intent };
          if (saved.intent) setIntent(saved.intent);
        } catch { /* ignore */ }
        sessionStorage.removeItem('findmydonor_oauth_pending');
      }
      if (isGoogle) {
        setSignupStep('google-phone');
      } else {
        setSignupStep('main');
      }
      return false;
    }

    if (state.nextStep === 'donor-profile') {
      setMode('signup');
      setSignupStep('donor-profile');
      return false;
    }

    if (state.nextStep !== 'complete') {
      setMode('signup');
      setSignupStep(isGoogle ? 'google-phone' : 'main');
      return false;
    }

    // Profile complete — navigate to dashboard
    // Legacy dashboard callbacks stay available until all dashboard reads move to profiles.
    if (state.profile.can_donate) {
      signals.onLoginSuccessDonor({
        id: state.authUser.id, full_name: state.profile.full_name, email: state.profile.email || '', phone: state.profile.phone,
        whatsapp_number: state.profile.whatsapp_phone, blood_type: state.donorProfile?.blood_group || 'O+', donation_frequency: 'first_time',
        last_donation_date: state.donorProfile?.last_donation_date || null, cooldown_until: state.donorProfile?.cooldown_until || null,
        pincode: state.donorProfile?.pincode || '', area: state.donorProfile?.area || '', city: state.donorProfile?.city || '',
        availability_status: state.donorProfile?.is_available ? 'available' : 'unavailable', number_sharing_pref: 'on_approval',
        emergency_only: false, account_status: 'active', whatsapp_verified: true, profile_complete: state.donorProfile?.profile_complete,
        is_available: state.donorProfile?.is_available, created_at: state.profile.created_at, updated_at: state.profile.updated_at,
      });
    } else {
      signals.onLoginSuccessRequester({ id: state.authUser.id, full_name: state.profile.full_name, email: state.profile.email || '', phone: state.profile.phone, created_at: state.profile.created_at, updated_at: state.profile.updated_at });
    }
    return true;
  };

  // ─── Phone + Password Sign In ──────────────────────────────────────────
  const handlePhoneSignIn = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const response = await fetch('/api/auth/phone-signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `91${phone.replace(/\D/g, '')}`, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to sign in.');

      // Set the session in the Supabase client so subsequent authenticatedApi calls work
      if (payload.session) {
        await supabase.auth.setSession({
          access_token: payload.session.access_token,
          refresh_token: payload.session.refresh_token,
        });
      }
      await resolveSignedInState();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in.');
    } finally { setLoading(false); }
  };

  // ─── Direct WhatsApp / Phone Sign Up (NO OTP) ───────────────────────────
  const handleSendOtpForSignUp = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setInfoMessage(''); setDevBypassNotice(''); setLoading(true);
    try {
      const formattedPhone = `91${phone.replace(/\D/g, '')}`;
      const signupRes = await fetch('/api/auth/phone-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formattedPhone,
          password,
          full_name: fullName.trim(),
          email: email.trim() || undefined,
          intent,
        }),
      });
      const signupPayload = await signupRes.json().catch(() => ({}));
      if (!signupRes.ok) throw new Error(signupPayload.error || 'Unable to create account.');

      // Set session in Supabase client
      if (signupPayload.session) {
        await supabase.auth.setSession({
          access_token: signupPayload.session.access_token,
          refresh_token: signupPayload.session.refresh_token,
        });
      }

      if (signupPayload.nextStep === 'donor-profile') {
        setSignupStep('donor-profile');
        setInfoMessage(isHi ? 'खाता बनाया गया! अंतिम चरण — डोनर प्रोफ़ाइल पूरा करें।' : 'Account created! Last step — complete your donor profile.');
      } else {
        await resolveSignedInState();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create account.');
    } finally { setLoading(false); }
  };

  // ─── Step 2: Verify OTP and Complete Sign Up ───────────────────────────
  const handleVerifyOtpAndSignUp = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const formattedPhone = `91${phone.replace(/\D/g, '')}`;
      // Step 2a: Verify OTP
      const verifyRes = await fetch('/api/wa/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone, otp: otpInput.trim(), purpose: 'signup' }),
      });
      const verifyPayload = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) throw new Error(verifyPayload.error || 'Invalid OTP.');

      const { verificationToken } = verifyPayload;
      if (!verificationToken) throw new Error('Verification failed. Try again.');

      // Step 2b: Create account with verification token
      const signupRes = await fetch('/api/auth/phone-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formattedPhone,
          password,
          full_name: fullName.trim(),
          email: email.trim() || undefined,
          intent,
          verificationToken,
        }),
      });
      const signupPayload = await signupRes.json().catch(() => ({}));
      if (!signupRes.ok) throw new Error(signupPayload.error || 'Unable to create account.');

      // Set session in Supabase client
      if (signupPayload.session) {
        await supabase.auth.setSession({
          access_token: signupPayload.session.access_token,
          refresh_token: signupPayload.session.refresh_token,
        });
      }

      if (signupPayload.nextStep === 'donor-profile') {
        setSignupStep('donor-profile');
        setInfoMessage(isHi ? 'WhatsApp सत्यापित! अंतिम चरण — डोनर प्रोफ़ाइल पूरा करें।' : 'WhatsApp verified! Last step — complete your donor profile.');
      } else {
        await resolveSignedInState();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Verification or account creation failed.');
    } finally { setLoading(false); }
  };

  // ─── Step 1 (Email): Send Email OTP via Resend ───────────────────────
  const handleSendEmailOtpForSignUp = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setInfoMessage(''); setLoading(true);
    try {
      const response = await fetch('/api/email/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to send Email OTP.');

      // Gmail fast-track: skip OTP input screen, auto-verify
      if (payload.skipOtp && payload.isGmail) {
        setInfoMessage(isHi ? '✅ Gmail तुरंत सत्यापित! आगे बढ़ रहे हैं...' : '✅ Gmail verified instantly! Proceeding...');
        // Auto-submit verify-otp with a dummy code (backend accepts any code for Gmail)
        setOtpInput('000000');
        // Small delay for UX, then auto-submit the verify step
        setTimeout(() => {
          handleVerifyEmailOtpAndSignUp(new Event('submit') as unknown as React.FormEvent);
        }, 500);
        return;
      }

      setSignupStep('otp');
      setInfoMessage(isHi ? `Email ${email} पर 6-अंकीय OTP कोड भेजा गया है।` : `6-digit OTP code sent to Email ${email}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to send Email OTP.');
    } finally { setLoading(false); }
  };

  // ─── Step 2 (Email): Verify Email OTP & Create Account ─────────────────
  const handleVerifyEmailOtpAndSignUp = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const verifyRes = await fetch('/api/email/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otpInput.trim() }),
      });
      const verifyPayload = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) throw new Error(verifyPayload.error || 'Invalid Email OTP.');

      const { verificationToken } = verifyPayload;
      if (!verificationToken) throw new Error('Email verification failed. Try again.');

      const signupRes = await fetch('/api/auth/email-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          intent,
          verificationToken,
        }),
      });
      const signupPayload = await signupRes.json().catch(() => ({}));
      if (!signupRes.ok) throw new Error(signupPayload.error || 'Unable to create account.');

      if (signupPayload.session) {
        await supabase.auth.setSession({
          access_token: signupPayload.session.access_token,
          refresh_token: signupPayload.session.refresh_token,
        });
      }

      if (signupPayload.nextStep === 'donor-profile') {
        setSignupStep('donor-profile');
        setInfoMessage(isHi ? 'Email सत्यापित! अंतिम चरण — डोनर प्रोफ़ाइल पूरा करें।' : 'Email verified! Last step — complete your donor profile.');
      } else {
        await resolveSignedInState();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Email OTP verification failed.');
    } finally { setLoading(false); }
  };

  // ─── Institution partner sign-in (Email OTP, no password) ─────────────
  const handleInstitutionSendOtp = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setInfoMessage(''); setLoading(true);
    try {
      const response = await fetch('/api/email/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to send email OTP.');

      // Gmail fast-track: auto-verify with dev code, same as signup flow
      if (payload.skipOtp && payload.isGmail) {
        setOtpInput('000000');
        setTimeout(() => handleInstitutionVerifyAndSignIn(new Event('submit') as unknown as React.FormEvent), 500);
        return;
      }

      setInstStep('otp');
      setInfoMessage(isHi ? `Email ${email} पर 6-अंकीय OTP कोड भेजा गया है।` : `6-digit OTP code sent to ${email}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to send email OTP.');
    } finally { setLoading(false); }
  };

  const handleInstitutionVerifyAndSignIn = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const verifyRes = await fetch('/api/email/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otpInput.trim() }),
      });
      const verifyPayload = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) throw new Error(verifyPayload.error || 'Invalid email OTP.');
      const { verificationToken } = verifyPayload;
      if (!verificationToken) throw new Error('Email verification failed. Try again.');

      const signinRes = await fetch('/api/institutions/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), verificationToken }),
      });
      const signinPayload = await signinRes.json().catch(() => ({}));
      if (!signinRes.ok) throw new Error(signinPayload.error || 'Unable to sign in to institution.');

      if (signinPayload.session) {
        await supabase.auth.setSession({
          access_token: signinPayload.session.access_token,
          refresh_token: signinPayload.session.refresh_token,
        });
      }
      await resolveSignedInState();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Institution sign-in failed.');
    } finally { setLoading(false); }
  };

  // ─── Google OAuth ──────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setError(''); setLoading(true);
    sessionStorage.setItem('findmydonor_oauth_pending', JSON.stringify({ intent }));
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}` },
      });
      if (authError) throw authError;
    } catch (caught) {
      sessionStorage.removeItem('findmydonor_oauth_pending');
      setError(caught instanceof Error ? caught.message : 'Google authentication failed.');
      setLoading(false);
    }
  };

  // ─── Google user: add WhatsApp number (no OTP) ─────────────────────────
  const handleGooglePhoneSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const result = await authenticatedApi<{ profile: any; donorProfile: any; nextStep: string }>('/api/auth/complete-verification', {
        phone: `91${phone.replace(/\D/g, '')}`,
        whatsappPhone: `91${phone.replace(/\D/g, '')}`,
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        intent,
      });

      if (result.nextStep === 'donor-profile') {
        setSignupStep('donor-profile');
        setInfoMessage(isHi ? 'WhatsApp नंबर सहेजा गया! अंतिम चरण।' : 'WhatsApp number saved! One last step.');
      } else {
        await resolveSignedInState();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save WhatsApp number.');
    } finally { setLoading(false); }
  };

  // ─── Donor profile completion (preserved from original) ────────────────
  const submitDonorProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!bloodGroup) { setError(isHi ? 'अपना ब्लड ग्रुप चुनें।' : 'Select your blood group.'); return; }
    if (!/^\d{6}$/.test(donorPincode)) { setError(isHi ? 'मान्य 6-अंकीय पिनकोड दर्ज करें।' : 'Enter a valid 6-digit pincode.'); return; }
    if (weightKg && Number(weightKg) < 45) { setError(isHi ? 'चिकित्सकीय रक्तदान पात्रता के लिए वजन कम से कम 45 किग्रा होना चाहिए।' : 'Weight must be at least 45 kg for blood donation eligibility.'); return; }
    if (!healthDeclaration) { setError(isHi ? 'स्वास्थ्य स्व-घोषणा आवश्यक है।' : 'Health self-declaration is required.'); return; }
    if (!neverDonated && !lastDonationDate) { setError(isHi ? 'अपनी अंतिम दान तारीख दर्ज करें या "कभी दान नहीं किया" चुनें।' : 'Enter your last donation date or select "Never donated".'); return; }
    setLoading(true);
    try {
      await authenticatedApi('/api/donor-profile/complete', {
        blood_group: bloodGroup,
        pincode: donorPincode,
        area: donorArea,
        city: donorCity,
        weight_kg: weightKg ? Number(weightKg) : null,
        last_donation_date: neverDonated ? null : lastDonationDate,
        health_self_declaration: true,
        emergency_only: emergencyOnly,
        number_sharing_pref: 'on_approval',
      }, 'PATCH');
      await resolveSignedInState();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save profile. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return {
    t, isHi, mode, setMode, signupStep, setSignupStep, signupChannel, setSignupChannel, intent, setIntent,
    phone, setPhone, password, setPassword, fullName, setFullName, email, setEmail, otpInput, setOtpInput,
    devBypassNotice, setDevBypassNotice, loading, setLoading, error, setError, infoMessage, setInfoMessage,
    signinMode, setSigninMode, instStep, setInstStep,
    bloodGroup, setBloodGroup, donorPincode, setDonorPincode, donorArea, setDonorArea, donorCity, setDonorCity,
    weightKg, setWeightKg, lastDonationDate, setLastDonationDate, neverDonated, setNeverDonated,
    healthDeclaration, setHealthDeclaration, emergencyOnly, setEmergencyOnly,
    handlePhoneSignIn, handleSendOtpForSignUp, handleVerifyOtpAndSignUp, handleSendEmailOtpForSignUp,
    handleVerifyEmailOtpAndSignUp, handleInstitutionSendOtp, handleInstitutionVerifyAndSignIn, handleGoogle,
    handleGooglePhoneSubmit, submitDonorProfile,
  };
}
