import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, ArrowRight, Building2, CheckCircle2, Heart, Lock, Mail, Phone, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { authenticatedApi } from '../lib/api';
import type { AuthState, BloodType, Requester, SignupIntent, User } from '../types';
import { lookupPincode } from '../types';
import { useLanguage } from '../lib/LanguageContext';

interface AuthHubProps {
  initialMode?: 'signin' | 'signup';
  initialIntent?: SignupIntent;
  onLoginSuccessDonor: (donor: User) => void;
  onLoginSuccessRequester: (requester: Requester) => void;
  onSelectDonorSignUp?: () => void;
  onSelectRequesterSignUp?: () => void;
}

export function AuthHub({ initialMode = 'signin', initialIntent = 'donor', onLoginSuccessDonor, onLoginSuccessRequester }: AuthHubProps) {
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

  // Donor profile fields (step 2 for donors)
  const [bloodGroup, setBloodGroup] = useState<BloodType | ''>('');
  const [donorPincode, setDonorPincode] = useState('');
  const [donorArea, setDonorArea] = useState('');
  const [donorCity, setDonorCity] = useState('');
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
  }, [initialMode, initialIntent]);

  const resolveSignedInState = async (): Promise<boolean> => {
    const state = await authenticatedApi<AuthState>('/api/auth/me', undefined, 'GET').catch(() => null);
    if (!state || !state.authUser) return false;

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
      onLoginSuccessDonor({
        id: state.authUser.id, full_name: state.profile.full_name, email: state.profile.email || '', phone: state.profile.phone,
        whatsapp_number: state.profile.whatsapp_phone, blood_type: state.donorProfile?.blood_group || 'O+', donation_frequency: 'first_time',
        last_donation_date: state.donorProfile?.last_donation_date || null, cooldown_until: state.donorProfile?.cooldown_until || null,
        pincode: state.donorProfile?.pincode || '', area: state.donorProfile?.area || '', city: state.donorProfile?.city || '',
        availability_status: state.donorProfile?.is_available ? 'available' : 'unavailable', number_sharing_pref: 'on_approval',
        emergency_only: false, account_status: 'active', whatsapp_verified: true, profile_complete: state.donorProfile?.profile_complete,
        is_available: state.donorProfile?.is_available, created_at: state.profile.created_at, updated_at: state.profile.updated_at,
      });
    } else {
      onLoginSuccessRequester({ id: state.authUser.id, full_name: state.profile.full_name, email: state.profile.email || '', phone: state.profile.phone, created_at: state.profile.created_at, updated_at: state.profile.updated_at });
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

  // ─── Step 1: Send WhatsApp OTP for Sign Up ─────────────────────────────
  const handleSendOtpForSignUp = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setInfoMessage(''); setDevBypassNotice(''); setLoading(true);
    try {
      const formattedPhone = `91${phone.replace(/\D/g, '')}`;
      const response = await fetch('/api/wa/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone, purpose: 'signup' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to send WhatsApp OTP.');

      setSignupStep('otp');
      setInfoMessage(isHi ? `WhatsApp +91 ${phone} पर 6-अंकीय OTP भेजा गया है।` : `6-digit OTP sent to WhatsApp +91 ${phone}.`);
      if (payload.devBypass) {
        setDevBypassNotice(payload.message || (isHi ? 'DEV MODE: OTP "000000" दर्ज करें।' : 'DEV MODE: Enter OTP "000000".'));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to send WhatsApp OTP.');
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
    if (!healthDeclaration) { setError(isHi ? 'स्वास्थ्य स्व-घोषणा आवश्यक है।' : 'Health self-declaration is required.'); return; }
    if (!neverDonated && !lastDonationDate) { setError(isHi ? 'अपनी अंतिम दान तारीख दर्ज करें या "कभी दान नहीं किया" चुनें।' : 'Enter your last donation date or select "Never donated".'); return; }
    setLoading(true);
    try {
      await authenticatedApi('/api/donor-profile/complete', {
        blood_group: bloodGroup,
        pincode: donorPincode,
        area: donorArea,
        city: donorCity,
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

  const card = 'rounded-3xl bg-white/95 backdrop-blur-2xl border border-ink-200/80 shadow-premium-lg p-6 sm:p-8';
  const field = 'w-full rounded-xl bg-white border border-ink-200 px-4 py-3 text-sm text-ink-900 outline-none transition focus:ring-2 focus:ring-blood-500';
  const btnPrimary = 'mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blood-600 to-blood-700 text-sm font-bold text-white shadow-lg shadow-blood-600/25 disabled:opacity-50 cursor-pointer';
  const btnGoogle = 'h-12 w-full rounded-xl border border-ink-200 bg-white text-sm font-bold text-ink-800 hover:bg-ink-50 transition cursor-pointer';

  return <main className="min-h-[85vh] px-4 py-12 flex items-center justify-center relative overflow-hidden">
    <div className="absolute top-12 left-1/4 h-96 w-96 rounded-full bg-blood-500/10 blur-3xl" aria-hidden />
    <section className="w-full max-w-xl relative z-10">
      <header className="mb-8 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl blood-drop-gradient shadow-lg shadow-blood-600/30"><Heart className="h-7 w-7 fill-white text-white" /></div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          {mode === 'signin'
            ? (isHi ? 'FindMyDonor™ में साइन इन करें' : t.auth.welcomeSignIn)
            : signupStep === 'donor-profile'
              ? (isHi ? 'डोनर प्रोफ़ाइल पूरा करें' : 'Complete your donor profile')
              : signupStep === 'google-phone'
                ? (isHi ? 'अपना WhatsApp नंबर जोड़ें' : 'Add your WhatsApp number')
                : (isHi ? 'FindMyDonor™ से जुड़ें' : 'Join FindMyDonor™')
          }
        </h1>
        <p className="mt-2 text-sm text-ink-500">
          {signupStep === 'google-phone'
            ? (isHi ? 'मैच सूचनाओं के लिए आपका WhatsApp नंबर चाहिए।' : 'We need your WhatsApp number for match notifications.')
            : signupStep === 'donor-profile'
              ? (isHi ? 'जरूरतमंदों से मिलान के लिए इसकी ज़रूरत है।' : 'Helps us match you with compatible requests nearby.')
              : (isHi ? 'एक WhatsApp पहचान। आवश्यकता पड़ने पर दोनों भूमिकाएँ।' : 'One WhatsApp identity. Choose both roles whenever needed.')
          }
        </p>
        {signupStep === 'main' && <div className="mt-6 inline-flex rounded-2xl border border-ink-200 bg-ink-100 p-1.5">
          {(['signin', 'signup'] as const).map(item => <button id={`auth-mode-${item}`} key={item} type="button" onClick={() => { setMode(item); setError(''); setInfoMessage(''); }} className={`rounded-xl px-6 py-2.5 text-sm font-bold transition cursor-pointer ${mode === item ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600'}`}>{item === 'signin' ? (isHi ? 'साइन इन' : 'Sign in') : (isHi ? 'खाता बनाएं' : 'Create account')}</button>)}
        </div>}
      </header>
      {error && <div role="alert" className="mb-5 flex gap-3 rounded-2xl border border-blood-200 bg-blood-50 p-4 text-sm font-semibold text-blood-700"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
      {infoMessage && <div className="mb-5 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-5 w-5 shrink-0" />{infoMessage}</div>}
      <AnimatePresence mode="wait">
        {/* ─── SIGN IN ──────────────────────────────────────── */}
        {mode === 'signin' && signupStep === 'main' && (
          <motion.form key="signin" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={card} onSubmit={handlePhoneSignIn}>
            <button id="signin-google" type="button" onClick={handleGoogle} className={btnGoogle}>
              <span className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                {isHi ? 'Google से जारी रखें' : 'Continue with Google'}
              </span>
            </button>
            <div className="my-5 flex items-center gap-3"><hr className="flex-1 border-ink-200" /><span className="text-[10px] font-bold text-ink-400">{isHi ? 'या' : 'OR'}</span><hr className="flex-1 border-ink-200" /></div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-600">{isHi ? 'WhatsApp नंबर' : 'WhatsApp Number'}</label>
            <div className="flex gap-2">
              <div className="flex h-[46px] items-center rounded-xl border border-ink-200 bg-ink-50 px-3 text-sm font-bold text-ink-600 select-none">91</div>
              <input id="signin-phone" className={field} required inputMode="numeric" maxLength={10} placeholder="9876543210" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
            </div>
            <label className="mb-2 mt-4 block text-xs font-bold uppercase tracking-wider text-ink-600">{isHi ? 'पासवर्ड' : 'Password'}</label>
            <input id="signin-password" className={field} required type="password" value={password} onChange={e => setPassword(e.target.value)} />
            <button id="signin-submit" disabled={loading || phone.length !== 10} className={btnPrimary}>{loading ? (isHi ? 'साइन इन हो रहा है…' : 'Signing in…') : <>{isHi ? 'साइन इन करें' : 'Sign in'} <ArrowRight className="h-4 w-4" /></>}</button>
          </motion.form>
        )}

        {/* ─── SIGN UP STEP 1: ENTER DETAILS ──────────────────── */}
        {mode === 'signup' && signupStep === 'main' && (
          <motion.form key="signup" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={card} onSubmit={signupChannel === 'email' ? handleSendEmailOtpForSignUp : handleSendOtpForSignUp}>
            <button id="signup-google" type="button" onClick={handleGoogle} className={btnGoogle}>
              <span className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                {isHi ? 'Google से जारी रखें' : 'Continue with Google'}
              </span>
            </button>
            <div className="my-5 flex items-center gap-3"><hr className="flex-1 border-ink-200" /><span className="text-[10px] font-bold text-ink-400">{isHi ? 'या' : 'OR'}</span><hr className="flex-1 border-ink-200" /></div>

            {/* Verification Channel Selector */}
            <div className="mb-4 flex rounded-xl border border-ink-200 bg-ink-50 p-1">
              <button type="button" onClick={() => setSignupChannel('phone')} className={`flex-1 rounded-lg py-2 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${signupChannel === 'phone' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}>
                <Phone className="h-3.5 w-3.5" /> WhatsApp OTP
              </button>
              <button type="button" onClick={() => setSignupChannel('email')} className={`flex-1 rounded-lg py-2 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${signupChannel === 'email' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}>
                <Mail className="h-3.5 w-3.5 text-blood-600" /> Email OTP (Resend)
              </button>
            </div>

            <label className="block text-xs font-bold uppercase tracking-wider text-ink-600">{isHi ? 'पूरा नाम' : 'Full name'}
              <input id="signup-name" className={`${field} mt-1`} required value={fullName} onChange={e => setFullName(e.target.value)} />
            </label>

            {signupChannel === 'email' ? (
              <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-ink-600">{isHi ? 'ईमेल पता' : 'Email Address'}
                <input id="signup-email" className={`${field} mt-1`} required type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              </label>
            ) : (
              <>
                <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-ink-600">{isHi ? 'ईमेल (वैकल्पिक)' : 'Email (optional)'}
                  <input id="signup-email" className={`${field} mt-1`} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                </label>

                <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-ink-600">{isHi ? 'WhatsApp नंबर' : 'WhatsApp Number'}</label>
                <div className="mt-1 flex gap-2">
                  <div className="flex h-[46px] items-center rounded-xl border border-ink-200 bg-ink-50 px-3 text-sm font-bold text-ink-600 select-none">91</div>
                  <input id="signup-phone" className={field} required inputMode="numeric" maxLength={10} placeholder="9876543210" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
                </div>
              </>
            )}

            <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-ink-600">{isHi ? 'पासवर्ड (कम से कम 8 अक्षर)' : 'Password (min 8 characters)'}
              <input id="signup-password" className={`${field} mt-1`} required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} />
            </label>

            <div className="mt-5 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-600">{isHi ? 'FindMyDonor™ का उपयोग कैसे करेंगे?' : 'How will you use FindMyDonor™?'}</p>
              {([['donor', Heart, isHi ? 'स्वयंसेवक दाता' : 'Volunteer donor'], ['requester', Building2, isHi ? 'रक्त अनुरोधकर्ता' : 'Request blood'], ['both', ShieldCheck, isHi ? 'दोनों भूमिकाएँ' : 'Both roles']] as const).map(([value, Icon, title]) => (
                <button id={`signup-intent-${value}`} key={value} type="button" onClick={() => setIntent(value)}
                  className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left text-sm font-bold transition cursor-pointer ${intent === value ? 'border-blood-500 bg-blood-50 text-blood-700' : 'border-ink-200 text-ink-700 hover:border-blood-300'}`}>
                  <Icon className={`h-4 w-4 ${intent === value ? 'text-blood-600' : 'text-ink-400'}`} />{title}
                </button>
              ))}
            </div>

            <button id="signup-submit" disabled={loading || (signupChannel === 'phone' ? phone.length !== 10 : !email.includes('@')) || password.length < 8 || !fullName.trim()} className={btnPrimary}>
              {loading ? (isHi ? 'OTP भेजा जा रहा है…' : 'Sending OTP…') : <>{signupChannel === 'email' ? (isHi ? 'Email OTP प्राप्त करें' : 'Get Email OTP') : (isHi ? 'WhatsApp OTP प्राप्त करें' : 'Get WhatsApp OTP')} <ArrowRight className="h-4 w-4" /></>}
            </button>
          </motion.form>
        )}

        {/* ─── SIGN UP STEP 2: VERIFY OTP ─────────────────────── */}
        {mode === 'signup' && signupStep === 'otp' && (
          <motion.form key="signup-otp" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={card} onSubmit={signupChannel === 'email' ? handleVerifyEmailOtpAndSignUp : handleVerifyOtpAndSignUp}>
            <div className="mb-4 flex items-center justify-between rounded-xl bg-ink-50 p-3.5 border border-ink-200">
              <div className="flex items-center gap-2.5 text-xs text-ink-700 font-semibold">
                {signupChannel === 'email' ? <Mail className="h-4 w-4 text-blood-600 shrink-0" /> : <Phone className="h-4 w-4 text-blood-600 shrink-0" />}
                <span>{signupChannel === 'email' ? email : `+91 ${phone}`}</span>
              </div>
              <button
                type="button"
                onClick={() => { setSignupStep('main'); setError(''); setInfoMessage(''); }}
                className="text-xs font-bold text-blood-600 hover:text-blood-700 underline cursor-pointer"
              >
                {isHi ? 'बदलें' : 'Change'}
              </button>
            </div>

            {devBypassNotice && signupChannel === 'phone' && (
              <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs font-semibold text-amber-900 flex items-center gap-2.5">
                <Lock className="h-4 w-4 shrink-0 text-amber-600" />
                <span>{devBypassNotice}</span>
              </div>
            )}

            <label className="block text-xs font-bold uppercase tracking-wider text-ink-600">
              {signupChannel === 'email' ? (isHi ? '6-अंकीय Email OTP (Resend)' : '6-Digit Email OTP (via Resend)') : (isHi ? '6-अंकीय WhatsApp OTP' : '6-Digit WhatsApp OTP')}
              <input
                id="signup-otp"
                className={`${field} mt-1 text-center font-mono text-xl tracking-widest`}
                required
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otpInput}
                onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>

            <button id="signup-otp-submit" disabled={loading || otpInput.length !== 6} className={btnPrimary}>
              {loading ? (isHi ? 'सत्यापित हो रहा है…' : 'Verifying…') : <>{isHi ? 'सत्यापित करें और खाता बनाएं' : 'Verify & Create Account'} <ArrowRight className="h-4 w-4" /></>}
            </button>
          </motion.form>
        )}

        {/* ─── GOOGLE USER: ADD WHATSAPP NUMBER ──────────────── */}
        {signupStep === 'google-phone' && (
          <motion.form key="google-phone" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={card} onSubmit={handleGooglePhoneSubmit}>
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {isHi ? `Google से साइन इन सफल: ${fullName}` : `Signed in with Google as ${fullName}`}
            </div>

            <label className="block text-xs font-bold uppercase tracking-wider text-ink-600">{isHi ? 'पूरा नाम' : 'Full name'}
              <input id="google-fullname" className={`${field} mt-1`} required value={fullName} onChange={e => setFullName(e.target.value)} />
            </label>

            <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-ink-600">{isHi ? 'ईमेल' : 'Email'}
              <input id="google-email" className={`${field} mt-1`} type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </label>

            <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-ink-600">{isHi ? 'WhatsApp नंबर' : 'WhatsApp Number'}</label>
            <div className="mt-1 flex gap-2">
              <div className="flex h-[46px] items-center rounded-xl border border-ink-200 bg-ink-50 px-3 text-sm font-bold text-ink-600 select-none">91</div>
              <input id="google-phone" className={field} required inputMode="numeric" maxLength={10} placeholder="9876543210" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
            </div>

            <div className="mt-5 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-600">{isHi ? 'FindMyDonor™ का उपयोग कैसे करेंगे?' : 'How will you use FindMyDonor™?'}</p>
              {([['donor', Heart, isHi ? 'स्वयंसेवक दाता' : 'Volunteer donor'], ['requester', Building2, isHi ? 'रक्त अनुरोधकर्ता' : 'Request blood'], ['both', ShieldCheck, isHi ? 'दोनों भूमिकाएँ' : 'Both roles']] as const).map(([value, Icon, title]) => (
                <button id={`google-intent-${value}`} key={value} type="button" onClick={() => setIntent(value)}
                  className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left text-sm font-bold transition cursor-pointer ${intent === value ? 'border-blood-500 bg-blood-50 text-blood-700' : 'border-ink-200 text-ink-700 hover:border-blood-300'}`}>
                  <Icon className={`h-4 w-4 ${intent === value ? 'text-blood-600' : 'text-ink-400'}`} />{title}
                </button>
              ))}
            </div>

            <button id="google-phone-submit" disabled={loading || phone.length !== 10 || !fullName.trim()} className={btnPrimary}>
              {loading ? (isHi ? 'सहेजा जा रहा है…' : 'Saving…') : <>{isHi ? 'जारी रखें' : 'Continue'} <ArrowRight className="h-4 w-4" /></>}
            </button>
          </motion.form>
        )}

        {/* ─── DONOR PROFILE (preserved from original) ───────── */}
        {signupStep === 'donor-profile' && (
          <motion.form key="donor-profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={card} onSubmit={submitDonorProfile}>
            <h2 className="text-xl font-bold text-ink-900">{isHi ? 'आपकी डोनर प्रोफ़ाइल' : 'Your donor profile'}</h2>
            <p className="mb-4 text-sm text-ink-500">{isHi ? 'जरूरतमंदों से मिलान के लिए।' : 'Helps us match you with compatible requests nearby.'}</p>

            <label className="block text-xs font-bold text-ink-600">
              {isHi ? 'ब्लड ग्रुप *' : 'Blood group *'}
              <select required className={`${field} mt-1`} value={bloodGroup} onChange={e => setBloodGroup(e.target.value as BloodType)}>
                <option value="">{isHi ? 'ब्लड ग्रुप चुनें' : 'Select blood group'}</option>
                {(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as BloodType[]).map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </label>

            <label className="mt-4 block text-xs font-bold text-ink-600">
              {isHi ? 'पिनकोड *' : 'Pincode *'}
              <input
                required
                className={`${field} mt-1`}
                inputMode="numeric"
                maxLength={6}
                placeholder="e.g. 110001"
                value={donorPincode}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setDonorPincode(val);
                  if (val.length === 6) {
                    const result = lookupPincode(val);
                    if (result) { setDonorArea(result.area); setDonorCity(result.city); }
                  }
                }}
              />
            </label>
            {donorArea && (
              <p className="text-xs font-semibold text-emerald-700">📍 {donorArea}, {donorCity}</p>
            )}

            <label className="mt-4 block text-xs font-bold text-ink-600">
              {isHi ? 'अंतिम दान तारीख' : 'Last donation date'}
              <input
                type="date"
                disabled={neverDonated}
                max={new Date().toISOString().split('T')[0]}
                className={`${field} mt-1`}
                value={lastDonationDate}
                onChange={e => setLastDonationDate(e.target.value)}
              />
            </label>
            <label className="mt-2 flex items-center gap-2 text-xs text-ink-600">
              <input type="checkbox" checked={neverDonated} onChange={e => { setNeverDonated(e.target.checked); if (e.target.checked) setLastDonationDate(''); }} />
              {isHi ? 'मैंने पहले कभी रक्तदान नहीं किया' : 'I have never donated blood before'}
            </label>

            <label className="mt-2 flex items-center gap-2 text-xs text-ink-600">
              <input type="checkbox" checked={emergencyOnly} onChange={e => setEmergencyOnly(e.target.checked)} />
              {isHi ? 'केवल आपातकालीन मामलों के लिए संपर्क करें' : 'Only contact me for critical/emergency cases'}
            </label>

            <label className="mt-3 flex gap-3 rounded-xl bg-ink-50 p-3 text-xs leading-relaxed text-ink-600">
              <input required type="checkbox" checked={healthDeclaration} onChange={e => setHealthDeclaration(e.target.checked)} />
              {isHi
                ? 'मैं पुष्टि करता/करती हूँ कि मैं 18-65 वर्ष का/की हूँ, मेरा वज़न कम से कम 45 किग्रा है, और मैंने पिछले 90 दिनों में दान नहीं किया है।'
                : 'I confirm I am 18–65 years old, weigh at least 45 kg, am not on blood-donation-restricting medication, and have not donated in the last 90 days.'}
            </label>

            <button disabled={loading} className={btnPrimary}>
              {loading ? (isHi ? 'सहेजा जा रहा है…' : 'Saving…') : (isHi ? 'पंजीकरण पूरा करें →' : 'Complete registration →')}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </section>
  </main>;
}
