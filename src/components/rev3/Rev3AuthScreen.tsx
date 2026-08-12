// Rev 3 Authentication screen (Phase 5, Slice 1).
// Glassmorphic, mobile-first. Handles Google login, email OTP flow, and
// session restore. Routes to the correct onward step via onContinue().
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, ArrowRight, CheckCircle2, Heart, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  sendEmailOtp, verifyEmailOtp, emailComplete, googleSignIn, completeGoogle, fetchMe,
} from '../../lib/rev3Auth';
import type { Rev3NextStep } from '../../lib/rev3Auth';

interface Rev3AuthProps {
  onContinue: (step: Rev3NextStep) => void;
}

type Screen = 'choose' | 'email' | 'otp';

const card =
  'rounded-3xl bg-white/95 backdrop-blur-2xl border border-white/40 shadow-lg p-6 sm:p-8 w-full max-w-md';
const field =
  'w-full rounded-xl bg-white border border-ink-200 px-4 py-3 text-sm text-ink-900 outline-none transition focus:ring-2 focus:ring-blood-500';
const btnPrimary =
  'mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blood-600 to-blood-700 text-sm font-bold text-white shadow-lg shadow-blood-600/25 disabled:opacity-50 cursor-pointer';

export function Rev3AuthScreen({ onContinue }: Rev3AuthProps) {
  const [screen, setScreen] = useState<Screen>('choose');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const startedRef = useRef(false);

  

  // Session restore — Google OAuth return, or already-logged-in refresh.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      try {
        const sessionState = await supabase.auth.getSession();
        const user = sessionState.data.session?.user;
        const isGoogleReturn = user?.app_metadata?.provider === 'google';

        if (isGoogleReturn && user) {
          setLoading(true);
          try {
            const name = String(
              user.user_metadata?.name || user.user_metadata?.full_name || '',
            );
            const result = await completeGoogle(user.email || '', name);
            setLoading(false);
            onContinue(result.nextStep || 'basic');
          } catch (caught) {
            setLoading(false);
            setError(
              caught instanceof Error
                ? caught.message
                : 'Google sign-in could not be completed.',
            );
          }
          return;
        }

        // Already in a session (refresh) — restore straight to the app.
        if (user) {
          try {
            const me = await fetchMe();
            if (me && me.authUser) {
              onContinue(me.nextStep);
              return;
            }
          } catch { /* fall through to auth UI */ }
        }
      } catch { /* ignore restore errors — show auth UI */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onContinue]);

  // ── Email OTP handlers ────────────────────────────────────────────────
  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setInfo(''); setLoading(true);
    try {
      const submitted = email.trim().toLowerCase();
      await sendEmailOtp(submitted);
      setScreen('otp');
      setInfo(`6-digit code sent to ${submitted}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send the code.');
    } finally { setLoading(false); }
  }

  async function handleVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const submitted = email.trim().toLowerCase();
      const { verificationToken } = await verifyEmailOtp(submitted, otp.trim());
      const result = await emailComplete(
        submitted,
        verificationToken,
        fullName.trim() || 'User',
      );
      // Magic-link fallback: no interactive session yet.
      if (result.magicLink && !result.session?.access_token) {
        setScreen('choose');
        setInfo('Check your inbox for the sign-in link.');
        return;
      }
      onContinue(
        result.nextStep || (result.isNewUser ? 'basic' : 'complete'),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to verify the code.');
    } finally { setLoading(false); }
  }

  async function handleGoogle() {
    setError(''); setLoading(true);
    try { await googleSignIn(); }
    catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Google sign-in failed.');
      setLoading(false);
    }
  }

  const chooseView = (
    <motion.div
      key="choose"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={card}
    >
      <button
        id="auth-google"
        onClick={handleGoogle}
        disabled={loading}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white text-sm font-bold text-ink-800 hover:bg-ink-50 transition cursor-pointer disabled:opacity-50"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M21.35 11.1h-9.17v2.9h5.03c-.42 2.3-2.6 4.2-5.03 4.2a5 5 0 0 1 0-10c1.2 0 2.3.43 3.16 1.14l2.1-2.1A8 8 0 1 0 20 12c0-.35-.02-.7-.07-1.05Z" />
        </svg>
        Continue with Google
      </button>
      <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
        <span className="h-px flex-1 bg-ink-200" />or<span className="h-px flex-1 bg-ink-200" />
      </div>
      <button
        onClick={() => { setError(''); setInfo(''); setScreen('email'); }}
        className="h-12 w-full rounded-xl border border-ink-200 bg-white text-sm font-bold text-ink-800 hover:bg-ink-50 transition cursor-pointer"
      >
        Continue with Email
      </button>
    </motion.div>
  );

  const emailView = (
    <motion.form
      key={screen}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={card}
      onSubmit={screen === 'otp' ? handleVerifyEmail : handleSendEmail}
    >
      {screen === 'otp' && (
        <div className="mb-4 flex items-center justify-between text-xs font-semibold text-blood-700">
          <button
            type="button"
            onClick={() => { setScreen('email'); setError(''); setInfo(''); }}
            className="cursor-pointer hover:underline"
          >
            ← Back
          </button>
          <span>{email.trim().toLowerCase()}</span>
        </div>
      )}
      {screen === 'email' && (
        <label className="block text-xs font-bold uppercase tracking-wider text-ink-600">
          Email
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            className={`${field} mt-1`}
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
      )}
      {screen === 'otp' && (
        <label className="block text-xs font-bold uppercase tracking-wider text-ink-600">
          6-digit code
          <input
            id="auth-otp"
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            className={`${field} mt-1 text-center text-lg tracking-widest`}
            required
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="• • • • • •"
          />
        </label>
      )}
      {screen === 'otp' && (
        <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-ink-600">
          Full name <span className="font-normal normal-case text-ink-400">(new accounts)</span>
          <input
            id="auth-name"
            className={`${field} mt-1`}
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Your name"
          />
        </label>
      )}
      <button id="auth-submit" type="submit" disabled={loading} className={btnPrimary}>
        {loading ? 'Please wait…' : screen === 'otp' ? (
          <>
            Verify <ArrowRight className="h-4 w-4" />
          </>
        ) : 'Send code'}
      </button>
    </motion.form>
  );

  return (
    <main className="min-h-[85vh] px-4 py-12 flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-12 left-1/4 h-96 w-96 rounded-full bg-blood-500/10 blur-3xl" aria-hidden />
      <div className="w-full max-w-xl relative z-10">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blood-500 to-blood-700 shadow-lg shadow-blood-600/30">
            <Heart className="h-7 w-7 fill-white text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">Welcome to FindMyDonor</h1>
          <p className="mt-2 text-sm text-ink-500">One sign-in for donors, requesters, and institutions.</p>
        </header>

        <AnimatePresence mode="wait">
          {screen === 'choose' ? chooseView : emailView}
        </AnimatePresence>

        {error && (
          <div role="alert" className="mt-5 flex gap-3 rounded-2xl border border-blood-200 bg-blood-50 p-4 text-sm font-semibold text-blood-700">
            <AlertCircle className="h-5 w-5 shrink-0" />{error}
          </div>
        )}
        {!error && info && (
          <div className="mt-5 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            <CheckCircle2 className="h-5 w-5 shrink-0" />{info}
          </div>
        )}

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-ink-400">
          <ShieldCheck className="h-4 w-4" />Your data is treated as regulated and never shared.
        </p>
      </div>
    </main>
  );
}
