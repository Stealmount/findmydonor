// Rev 3 Authentication screen — Google sign-in & Direct Email sign-in/up (No OTP required).
// Glassmorphic, mobile-first. Handles Google login, Email login, and session restore.
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Heart, Mail, ShieldCheck, User as UserIcon } from 'lucide-react';
import { auth, googleProvider } from '../../lib/firebase';
import { signInWithPopup, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { completeGoogle, fetchMe } from '../../lib/rev3Auth';
import type { Rev3NextStep } from '../../lib/rev3Auth';

interface Rev3AuthProps {
  onContinue: (step: Rev3NextStep) => void;
  initialIntent?: 'donor' | 'requester';
}

const card = 'rounded-3xl bg-white/95 border border-white/40 p-6 sm:p-8 w-full max-w-md shadow-xl';
const field = 'w-full rounded-xl bg-white border border-ink-200 px-4 py-3 text-sm text-ink-900 outline-none transition focus:ring-2 focus:ring-blood-500';

export function Rev3AuthScreen({ onContinue, initialIntent }: Rev3AuthProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [fullNameInput, setFullNameInput] = useState('');
  const [useEmailForm, setUseEmailForm] = useState(false);
  const startedRef = useRef(false);

  // Session restore — check if user is already signed in via Firebase
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLoading(true);
        try {
          const me = await fetchMe();
          if (me && me.authUser) {
            onContinue(me.nextStep);
            return;
          }
          // User exists in Firebase Auth but no profile yet — complete Google/Email flow
          const name = String(user.displayName || fullNameInput || 'User');
          const result = await completeGoogle(user.email || '', name);
          onContinue(result.nextStep || 'basic');
        } catch {
          // Fall through to auth UI
        }
        setLoading(false);
      }
    });
    return () => unsub();
  }, [onContinue, fullNameInput]);

  async function handleGoogle() {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const name = String(user.displayName || '');
      const profileResult = await completeGoogle(user.email || '', name);
      onContinue(profileResult.nextStep || (profileResult.isNewUser ? 'basic' : 'complete'));
    } catch (caught: any) {
      if (caught?.code === 'auth/popup-closed-by-user') {
        setLoading(false);
        return;
      }
      setError(caught instanceof Error ? caught.message : 'Google sign-in failed.');
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setLoading(true);

    const email = emailInput.toLowerCase().trim();
    const name = fullNameInput.trim() || email.split('@')[0];
    const password = `FMD2026!${email.replace(/[^a-z0-9]/gi, '')}`;

    try {
      let firebaseUser;
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        firebaseUser = cred.user;
      } catch (signInErr: any) {
        if (signInErr?.code === 'auth/user-not-found' || signInErr?.code === 'auth/invalid-credential') {
          const newCred = await createUserWithEmailAndPassword(auth, email, password);
          firebaseUser = newCred.user;
        } else {
          throw signInErr;
        }
      }

      const profileResult = await completeGoogle(email, name);
      onContinue(profileResult.nextStep || (profileResult.isNewUser ? 'basic' : 'complete'));
    } catch (caught: any) {
      setError(caught instanceof Error ? caught.message : 'Sign-in failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[85vh] px-4 py-12 flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-12 left-1/4 h-96 w-96 rounded-full bg-blood-500/10 blur-3xl" aria-hidden />
      <div className="w-full max-w-xl relative z-10">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blood-500 to-blood-700">
            <Heart className="h-7 w-7 fill-white text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">Welcome to FindMyDonor</h1>
          <p className="mt-2 text-sm text-ink-500">Sign in with Google or Email address to get started. No OTP required.</p>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={card}
        >
          {/* 1. Google Sign-in */}
          <button
            id="auth-google"
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white text-sm font-bold text-ink-800 hover:bg-ink-50 transition cursor-pointer disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M21.35 11.1h-9.17v2.9h5.03c-.42 2.3-2.6 4.2-5.03 4.2a5 5 0 0 1 0-10c1.2 0 2.3.43 3.16 1.14l2.1-2.1A8 8 0 1 0 20 12c0-.35-.02-.7-.07-1.05Z" />
            </svg>
            {loading && !useEmailForm ? 'Signing in...' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-ink-200" />
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">or with email</span>
            <div className="h-px flex-1 bg-ink-200" />
          </div>

          {/* 2. Direct Email Sign-In / Sign-Up (No OTP required) */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label htmlFor="auth-email" className="block text-xs font-bold uppercase tracking-wider text-ink-600 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-ink-400" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  placeholder="your.email@example.com"
                  className={`${field} pl-10`}
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setUseEmailForm(true);
                  }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-fullname" className="block text-xs font-bold uppercase tracking-wider text-ink-600 mb-1">
                Full Name (Optional)
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-3.5 h-4 w-4 text-ink-400" />
                <input
                  id="auth-fullname"
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  className={`${field} pl-10`}
                  value={fullNameInput}
                  onChange={(e) => {
                    setFullNameInput(e.target.value);
                    setUseEmailForm(true);
                  }}
                />
              </div>
            </div>

            <button
              id="auth-email-submit"
              type="submit"
              disabled={loading}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blood-600 to-blood-700 text-sm font-bold text-white hover:from-blood-700 hover:to-blood-800 transition cursor-pointer disabled:opacity-50"
            >
              {loading && useEmailForm ? 'Signing in...' : 'Continue with Email'}
            </button>
          </form>
        </motion.div>

        {error && (
          <div role="alert" className="mt-5 flex gap-3 rounded-2xl border border-blood-200 bg-blood-50 p-4 text-sm font-semibold text-blood-700">
            <AlertCircle className="h-5 w-5 shrink-0" />{error}
          </div>
        )}

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-ink-400">
          <ShieldCheck className="h-4 w-4" />Your data is treated as regulated and never shared.
        </p>
      </div>
    </main>
  );
}
