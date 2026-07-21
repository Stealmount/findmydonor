import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, ArrowRight, Building2, CheckCircle2, Heart, Lock, Mail, Phone, ShieldCheck, User as UserIcon } from 'lucide-react';
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
  const { t, language, setLanguage } = useLanguage();
  const isHi = language === 'HI';
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [signupStep, setSignupStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [intent, setIntent] = useState<SignupIntent>(initialIntent);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [sameWhatsApp, setSameWhatsApp] = useState(true);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [otp, setOtp] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [hasOAuthIdentity, setHasOAuthIdentity] = useState(false);
  const [emailConfirmPending, setEmailConfirmPending] = useState(false);
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
    const emailPending = sessionStorage.getItem('raktdaan_email_confirm_pending');
    if (emailPending) {
      void (async () => {
        try {
          const saved = JSON.parse(emailPending) as { intent: SignupIntent; fullName: string; phone: string; email: string };
          const { data: { session } } = await supabase.auth.getSession();
          const user = session?.user;
          if (user && user.email_confirmed_at) {
            sessionStorage.removeItem('raktdaan_email_confirm_pending');
            setIntent(saved.intent);
            setFullName(saved.fullName);
            setPhone(saved.phone);
            setEmail(saved.email);
            setMode('signup');
            setSignupStep(3);
            setInfoMessage('Email confirmed — continue with WhatsApp verification.');
          } else {
            setEmailConfirmPending(true);
            setEmail(saved.email);
            setIntent(saved.intent);
            setFullName(saved.fullName);
            setPhone(saved.phone);
            setMode('signup');
          }
        } catch { sessionStorage.removeItem('raktdaan_email_confirm_pending'); }
      })();
    }
    const otpPending = sessionStorage.getItem('raktdaan_otp_pending');
    if (otpPending) {
      try {
        const saved = JSON.parse(otpPending) as {
          phone: string; whatsappPhone: string; intent: typeof intent; otpSentAt: number
        };
        if (Date.now() - saved.otpSentAt < 15 * 60 * 1000) {
          setPhone(saved.phone);
          setWhatsappPhone(saved.whatsappPhone);
          setSameWhatsApp(saved.phone === saved.whatsappPhone);
          setIntent(saved.intent);
          setMode('signup');
          setSignupStep(4);
          setInfoMessage(`Welcome back — enter the OTP we sent to ${saved.whatsappPhone}.`);
        }
      } catch { /* ignore */ }
      sessionStorage.removeItem('raktdaan_otp_pending'); // always clear regardless
    }
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const metadata = user.user_metadata || {};
        const isGoogle = user.app_metadata?.provider === 'google' || Boolean(sessionStorage.getItem('raktdaan_oauth_pending'));
        if (isGoogle) {
          setFullName(String(metadata.full_name || metadata.name || ''));
          setEmail(user.email || '');
          setHasOAuthIdentity(true);
        }
        void resolveSignedInState();
      } else if (initialMode !== 'signup') {
        setHasOAuthIdentity(false);
      }
    });
  }, [initialMode, initialIntent]);

  const normalizedWhatsApp = sameWhatsApp ? phone : whatsappPhone;
  const resolveSignedInState = async (): Promise<boolean> => {
    const state = await authenticatedApi<AuthState>('/api/auth/me', undefined, 'GET').catch(() => null);
    if (!state || !state.authUser) return false;

    const { data: { user } } = await supabase.auth.getUser();
    const isGoogle = state.authUser.provider === 'google' || user?.app_metadata?.provider === 'google' || hasOAuthIdentity || Boolean(sessionStorage.getItem('raktdaan_oauth_pending'));
    if (isGoogle && user) {
      const metadata = user.user_metadata || {};
      setFullName(String(metadata.full_name || metadata.name || ''));
      setEmail(user.email || '');
      setHasOAuthIdentity(true);
    }

    if (!state.profile) {
      setMode('signup');
      const pending = sessionStorage.getItem('raktdaan_oauth_pending');
      if (pending) {
        try {
          const saved = JSON.parse(pending) as { intent: typeof intent; phone: string };
          if (saved.intent) setIntent(saved.intent);
          if (saved.phone) setPhone(saved.phone);
        } catch { /* ignore */ }
        sessionStorage.removeItem('raktdaan_oauth_pending');
      }
      setSignupStep(isGoogle ? 3 : 1);
      return false;
    }

    if (state.nextStep !== 'complete') {
      setMode('signup');
      if (state.nextStep === 'donor-profile') {
        setSignupStep(5);
      } else if (state.nextStep === 'otp') {
        setSignupStep(3);
      } else {
        setSignupStep(isGoogle ? 3 : 2);
      }
      return false;
    }
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

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;
      await resolveSignedInState();
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : 'Unable to sign in.';
      if (msg.includes('Email not confirmed')) {
        setError('Your email is not yet confirmed. Check your inbox for the confirmation link.');
      } else if (msg.includes('Invalid login credentials')) {
        setError('Incorrect email or password. Please try again.');
      } else {
        setError(msg);
      }
    }
    finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError(''); setLoading(true);
    sessionStorage.setItem('raktdaan_oauth_pending', JSON.stringify({
      intent, step: signupStep, phone
    }));
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
      if (authError) throw authError;
    } catch (caught) {
      sessionStorage.removeItem('raktdaan_oauth_pending');
      setError(caught instanceof Error ? caught.message : 'Google authentication failed.');
      setLoading(false);
    }
  };

  const createEmailIdentity = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (!fullName.trim() || !phone.trim() || !email.trim() || password.length < 8) { setError('Name, email, 8-character password, and phone are required.'); return; }
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { full_name: fullName.trim() } } });
      if (authError) throw authError;
      if (!data.session) {
        sessionStorage.setItem('raktdaan_email_confirm_pending', JSON.stringify({
          intent, fullName: fullName.trim(), phone, email: email.trim().toLowerCase()
        }));
        setEmailConfirmPending(true);
        setInfoMessage('Confirmation link sent. Check your inbox, click the link, then return here.');
        return;
      }
      setSignupStep(3);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to create account.'); }
    finally { setLoading(false); }
  };

  const sendOtp = async () => {
    setError('');
    if (!consentAccepted) { setError('Consent is required before WhatsApp verification.'); return; }
    const digits = normalizedWhatsApp.replace(/\D/g, '');
    if (!/^(?:91)?[6-9]\d{9}$/.test(digits)) { setError('Enter a valid 10-digit Indian WhatsApp number.'); return; }
    setLoading(true);
    try {
      const response = await fetch('/api/wa/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: normalizedWhatsApp }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to send WhatsApp OTP.');
      setSignupStep(4); setInfoMessage('OTP sent to WhatsApp.');
      sessionStorage.setItem('raktdaan_otp_pending', JSON.stringify({
        phone,
        whatsappPhone: normalizedWhatsApp,
        intent,
        otpSentAt: Date.now()
      }));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to send OTP.'); }
    finally { setLoading(false); }
  };

  const verifyAndLink = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const verify = await fetch('/api/wa/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: normalizedWhatsApp, otp }) });
      const verified = await verify.json().catch(() => ({}));
      if (!verify.ok) throw new Error(verified.error || 'OTP verification failed.');
      setVerificationToken(verified.verificationToken);
      const result = await authenticatedApi<{ nextStep: AuthState['nextStep'] }>('/api/auth/complete-verification', {
        verificationToken: verified.verificationToken, phone, whatsappPhone: normalizedWhatsApp, fullName, intent, consentAccepted,
      });
      sessionStorage.removeItem('raktdaan_otp_pending');
      if (result.nextStep === 'donor-profile') {
        setSignupStep(5);
        setInfoMessage('WhatsApp verified! One last step — complete your donor profile.');
      } else {
        await resolveSignedInState();
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to verify WhatsApp.'); }
    finally { setLoading(false); }
  };

  const submitDonorProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!bloodGroup) { setError('Select your blood group.'); return; }
    if (!/^\d{6}$/.test(donorPincode)) { setError('Enter a valid 6-digit pincode.'); return; }
    if (!healthDeclaration) { setError('Health self-declaration is required.'); return; }
    if (!neverDonated && !lastDonationDate) { setError('Enter your last donation date or select "Never donated".'); return; }
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

  return <main className="min-h-[85vh] px-4 py-12 flex items-center justify-center relative overflow-hidden">
    <div className="absolute top-12 left-1/4 h-96 w-96 rounded-full bg-blood-500/10 blur-3xl" aria-hidden />
    <section className="w-full max-w-xl relative z-10">
      <header className="mb-8 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl blood-drop-gradient shadow-lg shadow-blood-600/30"><Heart className="h-7 w-7 fill-white text-white" /></div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          {mode === 'signin' ? t.auth.welcomeSignIn : (isHi ? 'सुरक्षित रूप से FindMyDonor™ से जुड़ें' : 'Join FindMyDonor™ safely')}
        </h1>
        <p className="mt-2 text-sm text-ink-500">
          {isHi ? 'एक सत्यापित WhatsApp पहचान। आवश्यकता पड़ने पर दोनों भूमिकाएँ चुनें।' : 'One verified WhatsApp identity. Choose both roles whenever needed.'}
        </p>
        <div className="mt-6 inline-flex rounded-2xl border border-ink-200 bg-ink-100 p-1.5">
          {(['signin', 'signup'] as const).map(item => <button id={`auth-mode-${item}`} key={item} type="button" onClick={() => { setMode(item); setError(''); }} className={`rounded-xl px-6 py-2.5 text-sm font-bold transition cursor-pointer ${mode === item ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600'}`}>{item === 'signin' ? (isHi ? 'साइन इन करें' : 'Sign in') : (isHi ? 'खाता बनाएं' : 'Create account')}</button>)}
        </div>
      </header>
      {error && <div role="alert" className="mb-5 flex gap-3 rounded-2xl border border-blood-200 bg-blood-50 p-4 text-sm font-semibold text-blood-700"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
      {infoMessage && <div className="mb-5 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-5 w-5 shrink-0" />{infoMessage}</div>}
      <AnimatePresence mode="wait">
        {mode === 'signin' ? <motion.form key="signin" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={card} onSubmit={handleSignIn}>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-600">Email</label><input id="signin-email" className={field} required type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <label className="mb-2 mt-4 block text-xs font-bold uppercase tracking-wider text-ink-600">Password</label><input id="signin-password" className={field} required type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button id="signin-submit" disabled={loading} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blood-600 to-blood-700 text-sm font-bold text-white shadow-lg shadow-blood-600/25 disabled:opacity-50">{loading ? 'Signing in…' : <>Sign in <ArrowRight className="h-4 w-4" /></>}</button>
          <div className="my-5 flex items-center gap-3"><hr className="flex-1 border-ink-200" /><span className="text-[10px] font-bold text-ink-400">OR</span><hr className="flex-1 border-ink-200" /></div>
          <button id="signin-google" type="button" onClick={handleGoogle} className="h-12 w-full rounded-xl border border-ink-200 bg-white text-sm font-bold text-ink-800">Continue with Google</button>
        </motion.form> : <motion.div key="signup" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={card}>
          <div className="mb-6 flex items-center gap-2">{Array.from({ length: (intent === 'donor' || intent === 'both') ? 5 : 4 }, (_, i) => i + 1).map(n => (
            <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= signupStep ? 'bg-blood-600' : 'bg-ink-200'}`} />
          ))}</div>
          {emailConfirmPending ? (
            <div className="space-y-5 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100">
                <Mail className="h-7 w-7 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-ink-900">Check your email</h2>
              <p className="text-sm text-ink-500">
                We sent a confirmation link to <strong>{email}</strong>.
                Click it, then return to this page.
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    // After clicking the confirm link, the session may be available
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (user?.email_confirmed_at) {
                        sessionStorage.removeItem('raktdaan_email_confirm_pending');
                        setEmailConfirmPending(false);
                        setSignupStep(3);
                        setInfoMessage('Email confirmed — continue with WhatsApp verification.');
                        return;
                      }
                    }
                    // No session yet — try refreshing to pick up the confirmed session
                    const { data: refreshed } = await supabase.auth.refreshSession();
                    if (refreshed.session?.user?.email_confirmed_at) {
                      sessionStorage.removeItem('raktdaan_email_confirm_pending');
                      setEmailConfirmPending(false);
                      setSignupStep(3);
                      setInfoMessage('Email confirmed — continue with WhatsApp verification.');
                    } else {
                      setInfoMessage('Not confirmed yet. Check your inbox or spam folder.');
                    }
                  } catch {
                    setInfoMessage('Not confirmed yet. Check your inbox or spam folder.');
                  }
                }}
                className="h-11 w-full rounded-xl border border-ink-200 bg-white text-sm font-bold text-ink-700"
              >
                I've confirmed my email
              </button>
            </div>
          ) : (
            <>
              {signupStep === 1 && <div className="space-y-4"><h2 className="text-xl font-bold text-ink-900">How will you use FindMyDonor™?</h2><p className="text-sm text-ink-500">Roles can change later. One account covers both.</p>{([['donor', Heart, 'Volunteer donor', 'Get verified, complete health and location details, then choose availability.'], ['requester', Building2, 'Request blood', 'Create and track verified emergency requests.'], ['both', ShieldCheck, 'Both roles', 'Donate when available and request help when needed.']] as const).map(([value, Icon, title, copy]) => <button id={`signup-intent-${value}`} key={value} type="button" onClick={() => { setIntent(value); setSignupStep(hasOAuthIdentity ? 3 : 2); }} className="w-full rounded-2xl border border-ink-200 p-4 text-left transition hover:border-blood-500 hover:bg-blood-50"><span className="flex items-center gap-3 text-sm font-bold text-ink-900"><Icon className="h-5 w-5 text-blood-600" />{title}</span><span className="mt-1 block pl-8 text-xs text-ink-500">{copy}</span></button>)}</div>}
              {signupStep === 2 && <form className="space-y-4" onSubmit={createEmailIdentity}><h2 className="text-xl font-bold text-ink-900">Create identity</h2><label className="block text-xs font-bold text-ink-600">Full name<input id="signup-name" className={`${field} mt-1`} required value={fullName} onChange={e => setFullName(e.target.value)} /></label><label className="block text-xs font-bold text-ink-600">Email<input id="signup-email" className={`${field} mt-1`} required type="email" value={email} onChange={e => setEmail(e.target.value)} /></label><label className="block text-xs font-bold text-ink-600">Password<input id="signup-password" className={`${field} mt-1`} required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} /></label><label className="block text-xs font-bold text-ink-600">Primary phone<input id="signup-phone" className={`${field} mt-1`} required inputMode="numeric" value={phone} onChange={e => setPhone(e.target.value)} /></label><button id="signup-email-submit" disabled={loading} className="h-12 w-full rounded-xl bg-ink-900 text-sm font-bold text-white disabled:opacity-50">{loading ? 'Creating…' : 'Continue'}</button><button id="signup-google" type="button" onClick={handleGoogle} className="w-full text-sm font-bold text-blood-600">Continue with Google instead</button></form>}
              {signupStep === 3 && <div className="space-y-4"><h2 className="text-xl font-bold text-ink-900">Consent and WhatsApp</h2><label className="block text-xs font-bold text-ink-600">Primary phone<input id="signup-google-phone" className={`${field} mt-1`} required inputMode="numeric" value={phone} onChange={e => setPhone(e.target.value)} /></label><label className="block text-xs font-bold text-ink-600">WhatsApp number<input id="signup-whatsapp" className={`${field} mt-1`} required value={normalizedWhatsApp} onChange={e => { setSameWhatsApp(false); setWhatsappPhone(e.target.value); }} /></label><label className="flex items-center gap-2 text-xs text-ink-600"><input id="same-whatsapp-phone" type="checkbox" checked={sameWhatsApp} onChange={e => setSameWhatsApp(e.target.checked)} />Same as primary phone</label><label className="flex gap-3 rounded-xl bg-ink-50 p-3 text-xs leading-relaxed text-ink-600"><input id="signup-consent" type="checkbox" checked={consentAccepted} onChange={e => setConsentAccepted(e.target.checked)} />I consent to FindMyDonor™ using this WhatsApp number for verification and life-saving request coordination. I can change availability later.</label><button id="signup-send-otp" type="button" onClick={sendOtp} disabled={loading || !consentAccepted} className="h-12 w-full rounded-xl bg-gradient-to-r from-blood-600 to-blood-700 text-sm font-bold text-white disabled:opacity-50">Send WhatsApp OTP</button></div>}
              {signupStep === 4 && <form className="space-y-4" onSubmit={verifyAndLink}><h2 className="text-xl font-bold text-ink-900">Verify WhatsApp</h2><p className="text-sm text-ink-500">Enter six-digit code sent to {normalizedWhatsApp}.</p><input id="signup-otp" className={`${field} text-center text-xl tracking-[0.5em]`} required inputMode="numeric" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} /><button id="signup-verify-otp" disabled={loading || otp.length !== 6} className="h-12 w-full rounded-xl bg-ink-900 text-sm font-bold text-white disabled:opacity-50">{loading ? 'Verifying…' : 'Verify and continue'}</button><button id="signup-resend-otp" type="button" onClick={sendOtp} className="w-full text-xs font-bold text-blood-600">Resend OTP</button></form>}
              {signupStep === 5 && (
                <form className="space-y-4" onSubmit={submitDonorProfile}>
                  <h2 className="text-xl font-bold text-ink-900">Your donor profile</h2>
                  <p className="text-sm text-ink-500">Helps us match you with compatible requests nearby.</p>

                  <label className="block text-xs font-bold text-ink-600">
                    Blood group *
                    <select required className={`${field} mt-1`} value={bloodGroup} onChange={e => setBloodGroup(e.target.value as BloodType)}>
                      <option value="">Select blood group</option>
                      {(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as BloodType[]).map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-xs font-bold text-ink-600">
                    Pincode *
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

                  <label className="block text-xs font-bold text-ink-600">
                    Last donation date
                    <input
                      type="date"
                      disabled={neverDonated}
                      max={new Date().toISOString().split('T')[0]}
                      className={`${field} mt-1`}
                      value={lastDonationDate}
                      onChange={e => setLastDonationDate(e.target.value)}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-ink-600">
                    <input type="checkbox" checked={neverDonated} onChange={e => { setNeverDonated(e.target.checked); if (e.target.checked) setLastDonationDate(''); }} />
                    I have never donated blood before
                  </label>

                  <label className="flex items-center gap-2 text-xs text-ink-600">
                    <input type="checkbox" checked={emergencyOnly} onChange={e => setEmergencyOnly(e.target.checked)} />
                    Only contact me for critical/emergency cases
                  </label>

                  <label className="flex gap-3 rounded-xl bg-ink-50 p-3 text-xs leading-relaxed text-ink-600">
                    <input required type="checkbox" checked={healthDeclaration} onChange={e => setHealthDeclaration(e.target.checked)} />
                    I confirm I am 18–65 years old, weigh at least 45 kg, am not on blood-donation-restricting medication,
                    and have not donated in the last 90 days. This is a self-declaration.
                  </label>

                  <button disabled={loading} className="h-12 w-full rounded-xl bg-gradient-to-r from-blood-600 to-blood-700 text-sm font-bold text-white shadow-lg shadow-blood-600/25 disabled:opacity-50">
                    {loading ? 'Saving…' : 'Complete registration →'}
                  </button>
                </form>
              )}
            </>
          )}
        </motion.div>}
      </AnimatePresence>
    </section>
  </main>;
}
