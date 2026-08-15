import { motion } from 'framer-motion';
import { ArrowRight, Building2, Heart, Mail, Phone, ShieldCheck } from 'lucide-react';
import { SignupIntent } from '../../types';
import { SignupStep, SignupChannel, SigninChannel, SigninMode, InstStep } from './useAuthHubTypes';

interface PhoneStepProps {
  mode: 'signin' | 'signup';
  signupStep: SignupStep;
  signupChannel: SignupChannel;
  signinChannel: SigninChannel;
  signinMode: SigninMode;
  instStep: InstStep;
  phone: string;
  password: string;
  fullName: string;
  email: string;
  otpInput: string;
  intent: SignupIntent;
  loading: boolean;
  isHi: boolean;
  card: string;
  field: string;
  btnPrimary: string;
  btnGoogle: string;
  setSignupChannel: (c: SignupChannel) => void;
  setSigninChannel: (c: SigninChannel) => void;
  setIntent: (i: SignupIntent) => void;
  setPhone: (v: string) => void;
  setPassword: (v: string) => void;
  setFullName: (v: string) => void;
  setEmail: (v: string) => void;
  setOtpInput: (v: string) => void;
  setSigninMode: (m: SigninMode) => void;
  setInstStep: (s: InstStep) => void;
  setError: (e: string) => void;
  setInfoMessage: (m: string) => void;
  onGoogle: () => void;
  onPhoneSignIn: (e: React.FormEvent) => void;
  onEmailSignIn: (e: React.FormEvent) => void;
  onSendOtpForSignUp: (e: React.FormEvent) => void;
  onSendEmailOtpForSignUp: (e: React.FormEvent) => void;
  onInstitutionSendOtp: (e: React.FormEvent) => void;
  onInstitutionVerifyAndSignIn: (e: React.FormEvent) => void;
}

export default function PhoneStep(props: PhoneStepProps) {
  const {
    mode, signupStep, signupChannel, signinChannel, signinMode, instStep,
    phone, password, fullName, email, otpInput, intent, loading, isHi,
    card, field, btnPrimary, btnGoogle,
    setSignupChannel, setSigninChannel, setIntent, setPhone, setPassword, setFullName, setEmail, setOtpInput,
    setSigninMode, setInstStep, setError, setInfoMessage,
    onGoogle, onPhoneSignIn, onEmailSignIn, onSendOtpForSignUp, onSendEmailOtpForSignUp, onInstitutionSendOtp, onInstitutionVerifyAndSignIn,
  } = props;

  const GoogleButton = () => (
    <button id="google-btn" type="button" onClick={onGoogle} className={btnGoogle}>
      <span className="flex items-center justify-center gap-2">
        <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
        {isHi ? 'Google से जारी रखें' : 'Continue with Google'}
      </span>
    </button>
  );

  return (
    <>
      {/* ─── SIGN IN ──────────────────────────────────────── */}
      {mode === 'signin' && signupStep === 'main' && signinMode === 'user' && (
        <motion.form key="signin" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={card} onSubmit={signinChannel === 'email' ? onEmailSignIn : onPhoneSignIn}>
          <GoogleButton />
          <div className="my-5 flex items-center gap-3"><hr className="flex-1 border-ink-200" /><span className="text-[10px] font-bold text-ink-400">{isHi ? 'या' : 'OR'}</span><hr className="flex-1 border-ink-200" /></div>
          
          {/* Sign In Channel Selector */}
          <div className="mb-4 flex rounded-xl border border-ink-200 bg-ink-50 p-1">
            <button id="signin-tab-phone" type="button" onClick={() => setSigninChannel('phone')} className={`flex-1 rounded-lg py-2 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${signinChannel === 'phone' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}>
              <Phone className="h-3.5 w-3.5" /> WhatsApp / Phone
            </button>
            <button id="signin-tab-email" type="button" onClick={() => setSigninChannel('email')} className={`flex-1 rounded-lg py-2 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${signinChannel === 'email' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}>
              <Mail className="h-3.5 w-3.5 text-blood-600" /> Email & Password
            </button>
          </div>

          {signinChannel === 'email' ? (
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-600">{isHi ? 'ईमेल पता' : 'Email Address'}
              <input id="signin-email" className={`${field} mt-1`} required type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </label>
          ) : (
            <>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-600">{isHi ? 'WhatsApp नंबर' : 'WhatsApp Number'}</label>
              <div className="flex gap-2">
                <div className="flex h-[46px] items-center rounded-xl border border-ink-200 bg-ink-50 px-3 text-sm font-bold text-ink-600 select-none">91</div>
                <input id="signin-phone" className={field} required inputMode="numeric" maxLength={10} placeholder="9876543210" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
              </div>
            </>
          )}

          <label className="mb-2 mt-4 block text-xs font-bold uppercase tracking-wider text-ink-600">{isHi ? 'पासवर्ड' : 'Password'}</label>
          <input id="signin-password" className={field} required type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button id="signin-submit" disabled={loading || (signinChannel === 'phone' ? phone.length !== 10 : !email.includes('@')) || !password} className={btnPrimary}>{loading ? (isHi ? 'साइन इन हो रहा है…' : 'Signing in…') : <>{isHi ? 'साइन इन करें' : 'Sign in'} <ArrowRight className="h-4 w-4" /></>}</button>
          <button id="signin-institution-toggle" type="button" onClick={() => { setSigninMode('institution'); setInstStep('email'); setOtpInput(''); setError(''); setInfoMessage(''); }}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blood-300 bg-blood-50/50 text-sm font-bold text-blood-700 hover:bg-blood-50 transition cursor-pointer">
            <Building2 className="h-4 w-4" />{isHi ? 'अस्पताल / ब्लड बैंक साथी? ईमेल OTP से साइन इन करें' : 'Hospital / blood bank partner? Sign in with email OTP'}
          </button>
        </motion.form>
      )}

      {/* ─── INSTITUTION SIGN-IN: EMAIL ─────────────────────── */}
      {mode === 'signin' && signupStep === 'main' && signinMode === 'institution' && instStep === 'email' && (
        <motion.form key="inst-email" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={card} onSubmit={onInstitutionSendOtp}>
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-blood-50 border border-blood-200 p-3 text-xs font-semibold text-blood-700">
            <Building2 className="h-4 w-4 shrink-0" />
            {isHi ? 'संस्था पार्टनर साइन इन — ईमेल OTP' : 'Institution partner sign-in — email OTP'}
          </div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-600">{isHi ? 'पंजीकृत ईमेल' : 'Registered email'}
            <input id="inst-signin-email" className={`${field} mt-1`} required type="email" placeholder="admin@hospital.org" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <button id="inst-signin-send-otp" disabled={loading || !email.includes('@')} className={btnPrimary}>
            {loading ? (isHi ? 'OTP भेजा जा रहा है…' : 'Sending OTP…') : <>{isHi ? 'Email OTP प्राप्त करें' : 'Get email OTP'} <ArrowRight className="h-4 w-4" /></>}
          </button>
          <button type="button" onClick={() => setSigninMode('user')} className="mt-3 w-full text-center text-xs font-bold text-ink-500 hover:text-blood-600 underline cursor-pointer">
            ← {isHi ? 'उपयोगकर्ता साइन इन पर लौटें' : 'Back to user sign-in'}
          </button>
        </motion.form>
      )}

      {/* ─── INSTITUTION SIGN-IN: OTP ───────────────────────── */}
      {mode === 'signin' && signupStep === 'main' && signinMode === 'institution' && instStep === 'otp' && (
        <motion.form key="inst-otp" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={card} onSubmit={onInstitutionVerifyAndSignIn}>
          <div className="mb-4 flex items-center justify-between rounded-xl bg-ink-50 p-3.5 border border-ink-200">
            <div className="flex items-center gap-2.5 text-xs text-ink-700 font-semibold">
              <Mail className="h-4 w-4 text-blood-600 shrink-0" />{email}
            </div>
            <button type="button" onClick={() => { setInstStep('email'); setError(''); setInfoMessage(''); }} className="text-xs font-bold text-blood-600 hover:text-blood-700 underline cursor-pointer">
              {isHi ? 'बदलें' : 'Change'}
            </button>
          </div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-600">
            {isHi ? '6-अंकीय Email OTP' : '6-Digit email OTP'}
            <input id="inst-signin-otp" className={`${field} mt-1 text-center font-mono text-xl tracking-widest`} required inputMode="numeric" maxLength={6} placeholder="000000" value={otpInput} onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          </label>
          <button id="inst-signin-submit" disabled={loading || otpInput.length !== 6} className={btnPrimary}>
            {loading ? (isHi ? 'साइन इन हो रहा है…' : 'Signing in…') : <>{isHi ? 'सत्यापित करें और साइन इन करें' : 'Verify & Sign In'} <ArrowRight className="h-4 w-4" /></>}
          </button>
        </motion.form>
      )}

      {/* ─── SIGN UP STEP 1: ENTER DETAILS ──────────────────── */}
      {mode === 'signup' && signupStep === 'main' && (
        <motion.form key="signup" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={card} onSubmit={signupChannel === 'email' ? onSendEmailOtpForSignUp : onSendOtpForSignUp}>
          <GoogleButton />
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
    </>
  );
}
