import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, ArrowRight, Building2, CheckCircle2, Heart, ShieldCheck } from 'lucide-react';
import type { Institution, Requester, SignupIntent, User } from '../types';
import useAuthHub from './AuthHub/useAuthHub';
import PhoneStep from './AuthHub/PhoneStep';
import OTPStep from './AuthHub/OTPStep';
import ProfileStep from './AuthHub/ProfileStep';

interface AuthHubProps {
  initialMode?: 'signin' | 'signup';
  initialIntent?: SignupIntent;
  onLoginSuccessDonor: (donor: User) => void;
  onLoginSuccessRequester: (requester: Requester) => void;
  onLoginSuccessInstitution?: (institution: Institution) => void;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onSelectDonorSignUp?: () => void;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onSelectRequesterSignUp?: () => void;
}

export function AuthHub({ initialMode = 'signin', initialIntent = 'donor', onLoginSuccessDonor, onLoginSuccessRequester, onLoginSuccessInstitution }: AuthHubProps) {
  const F = useAuthHub(initialMode, initialIntent, { onLoginSuccessDonor, onLoginSuccessRequester, onLoginSuccessInstitution });
  const {
    t, isHi, mode, setMode, signupStep, setSignupStep, signupChannel, setSignupChannel, signinChannel, setSigninChannel, intent, setIntent,
    phone, setPhone, password, setPassword, fullName, setFullName, email, setEmail, otpInput, setOtpInput,
    devBypassNotice, loading, error, setError, infoMessage, setInfoMessage,
    signinMode, setSigninMode, instStep, setInstStep,
    bloodGroup, setBloodGroup, donorPincode, setDonorPincode, donorArea, setDonorArea, donorCity, setDonorCity,
    weightKg, setWeightKg, lastDonationDate, setLastDonationDate, neverDonated, setNeverDonated,
    healthDeclaration, setHealthDeclaration, emergencyOnly, setEmergencyOnly,
    handlePhoneSignIn, handleEmailSignIn, handleSendOtpForSignUp, handleVerifyOtpAndSignUp, handleSendEmailOtpForSignUp,
    handleVerifyEmailOtpAndSignUp, handleInstitutionSendOtp, handleInstitutionVerifyAndSignIn, handleGoogle,
    handleGooglePhoneSubmit, submitDonorProfile,
  } = F;

  const card = 'rounded-3xl bg-white/95 backdrop-blur-2xl border border-ink-200/80 shadow-premium-lg p-6 sm:p-8';
  const field = 'w-full rounded-xl bg-white border border-ink-200 px-4 py-3 text-sm text-ink-900 outline-none transition focus:ring-2 focus:ring-blood-500';
  const btnPrimary = 'mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blood-600 to-blood-700 text-sm font-bold text-white shadow-lg shadow-blood-600/25 disabled:opacity-50 cursor-pointer';
  const btnGoogle = 'h-12 w-full rounded-xl border border-ink-200 bg-white text-sm font-bold text-ink-800 hover:bg-ink-50 transition cursor-pointer';

  const stepProps = { isHi, card, field, btnPrimary, btnGoogle };

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
        {/* ─── SIGN IN / SIGN UP (MAIN): PHONE / INSTITUTION ── */}
        {(mode === 'signin' || mode === 'signup') && signupStep === 'main' && (
          <PhoneStep
            mode={mode}
            signupStep={signupStep}
            signupChannel={signupChannel}
            signinChannel={signinChannel}
            signinMode={signinMode}
            instStep={instStep}
            phone={phone} password={password} fullName={fullName} email={email} otpInput={otpInput} intent={intent}
            loading={loading} setSignupChannel={setSignupChannel} setSigninChannel={setSigninChannel} setIntent={setIntent}
            setPhone={setPhone} setPassword={setPassword} setFullName={setFullName} setEmail={setEmail} setOtpInput={setOtpInput}
            setSigninMode={setSigninMode} setInstStep={setInstStep} setError={setError} setInfoMessage={setInfoMessage}
            onGoogle={handleGoogle} onPhoneSignIn={handlePhoneSignIn} onEmailSignIn={handleEmailSignIn} onSendOtpForSignUp={handleSendOtpForSignUp}
            onSendEmailOtpForSignUp={handleSendEmailOtpForSignUp} onInstitutionSendOtp={handleInstitutionSendOtp}
            onInstitutionVerifyAndSignIn={handleInstitutionVerifyAndSignIn} {...stepProps}
          />
        )}

        {/* ─── SIGN UP STEP 2: VERIFY OTP ─────────────────────── */}
        {mode === 'signup' && signupStep === 'otp' && (
          <OTPStep
            signupChannel={signupChannel} phone={phone} email={email} otpInput={otpInput}
            devBypassNotice={devBypassNotice} loading={loading}
            setOtpInput={setOtpInput} onBackToMain={() => { setSignupStep('main'); setError(''); setInfoMessage(''); }}
            onSubmit={signupChannel === 'email' ? handleVerifyEmailOtpAndSignUp : handleVerifyOtpAndSignUp} {...stepProps}
          />
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
          <ProfileStep
            bloodGroup={bloodGroup} weightKg={weightKg} donorPincode={donorPincode} donorArea={donorArea} donorCity={donorCity}
            lastDonationDate={lastDonationDate} neverDonated={neverDonated} emergencyOnly={emergencyOnly} healthDeclaration={healthDeclaration}
            loading={loading} setBloodGroup={setBloodGroup} setWeightKg={setWeightKg} setDonorPincode={setDonorPincode}
            setDonorArea={setDonorArea} setDonorCity={setDonorCity} setLastDonationDate={setLastDonationDate}
            setNeverDonated={setNeverDonated} setEmergencyOnly={setEmergencyOnly} setHealthDeclaration={setHealthDeclaration}
            onSubmit={submitDonorProfile} {...stepProps}
          />
        )}
      </AnimatePresence>
    </section>
  </main>;
}
