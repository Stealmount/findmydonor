import { useEffect, useState } from 'react';
import { auth, googleProvider } from '../../lib/firebase';
import { onAuthStateChanged, signInWithPopup, type User as FirebaseUser } from 'firebase/auth';
import { authenticatedApi } from '../../lib/api';
import type { AuthState, Institution, Requester, SignupIntent, User } from '../../types';
import type { SignupStep } from './useAuthHubTypes';
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
 const [signupStep, setSignupStep] = useState<SignupStep>('initial');
 const [intent, setIntent] = useState<SignupIntent>(initialIntent);
 const [phone, setPhone] = useState('');
 const [fullName, setFullName] = useState('');
 const [email, setEmail] = useState('');
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const [infoMessage, setInfoMessage] = useState('');

 useEffect(() => {
 setMode(initialMode);
 setIntent(initialIntent);

 const user = auth.currentUser;
 if (user) {
 const isGoogle = user.providerData.some(p => p.providerId === 'google.com') || Boolean(sessionStorage.getItem('findmydonor_oauth_pending'));
 if (isGoogle) {
 setFullName(String(user.displayName || ''));
 setEmail(user.email || '');
 }
 void resolveSignedInState();
 }

 const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
 if (firebaseUser) {
 void resolveSignedInState();
 }
 });

 return () => {
 unsubscribe();
 };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [initialMode, initialIntent]);

 const resolveSignedInState = async (): Promise<boolean> => {
 const state = await authenticatedApi<AuthState>('/api/auth/me', undefined, 'GET').catch(() => null);
 if (!state || !state.authUser) return false;

 const stateWithInst = state as AuthState & { institution?: Institution | null };
 if (stateWithInst.institution) {
 signals.onLoginSuccessInstitution?.(stateWithInst.institution);
 return true;
 }

 const user = auth.currentUser;
 const isGoogle = state.authUser.provider === 'google' || (user != null && user.providerData.some(p => p.providerId === 'google.com')) || Boolean(sessionStorage.getItem('findmydonor_oauth_pending'));
 if (isGoogle && user) {
 setFullName(String(user.displayName || ''));
 setEmail(user.email || '');
 }

 if (!state.profile && isGoogle && user) {
 setSignupStep('google-phone');
 const pending = sessionStorage.getItem('findmydonor_oauth_pending');
 let savedIntent = intent;
 if (pending) {
 try {
 const saved = JSON.parse(pending) as { intent: typeof intent };
 if (saved.intent) { setIntent(saved.intent); savedIntent = saved.intent; }
 } catch { /* ignore */ }
 sessionStorage.removeItem('findmydonor_oauth_pending');
 }
 try {
 await authenticatedApi<{ profile: unknown; nextStep: string }>('/api/auth/complete-verification', {
 fullName: String(user.displayName || '').trim(),
 email: user.email || undefined,
 intent: savedIntent || undefined,
 });
 } catch (cvErr) {
 console.error('[Auth] complete-verification failed:', cvErr);
 setError('Account setup failed. Please try again.');
 return false;
 }
 const refreshed = await authenticatedApi<AuthState>('/api/auth/me', undefined, 'GET').catch(() => null);
 if (refreshed?.profile) {
 return resolveProfileToCallback(refreshed);
 }
 setError('Profile setup incomplete. Please try again.');
 return false;
 }

 if (!state.profile) {
 setMode('signup');
 return false;
 }

 return resolveProfileToCallback(state);
 };

 const resolveProfileToCallback = (state: AuthState): boolean => {
 if (!state.profile) return false;
 if (state.profile.can_donate) {
 signals.onLoginSuccessDonor({
 id: state.authUser.id, full_name: state.profile.full_name, email: state.profile.email || '', phone: state.profile.phone,
 whatsapp_number: state.profile.whatsapp_phone, blood_type: state.donorProfile?.blood_group || 'O+', donation_frequency: 'first_time',
 last_donation_date: state.donorProfile?.last_donation_date || null, cooldown_until: state.donorProfile?.cooldown_until || null,
 pincode: state.donorProfile?.pincode || '', area: state.donorProfile?.area || '', city: state.donorProfile?.city || '',
 availability_status: state.donorProfile?.is_available ? 'available' : 'unavailable', number_sharing_pref: 'on_approval',
 emergency_only: false, account_status: 'active', whatsapp_verified: state.profile.whatsapp_verified ?? false,
 profile_complete: state.donorProfile?.profile_complete,
 is_available: state.donorProfile?.is_available, created_at: state.profile.created_at, updated_at: state.profile.updated_at,
 });
 } else {
 signals.onLoginSuccessRequester({
 id: state.authUser.id, full_name: state.profile.full_name, email: state.profile.email || '',
 phone: state.profile.phone, created_at: state.profile.created_at, updated_at: state.profile.updated_at,
 });
 }
 return true;
 };

 // ─── Google OAuth ──────────────────────────────────────────────────────
 const handleGoogle = async () => {
 setError(''); setLoading(true);
 sessionStorage.setItem('findmydonor_oauth_pending', JSON.stringify({ intent }));
 try {
 await signInWithPopup(auth, googleProvider);
 // Transition to WhatsApp form step — resolveSignedInState called by onAuthStateChanged
 } catch (caught) {
 sessionStorage.removeItem('findmydonor_oauth_pending');
 setError(caught instanceof Error ? caught.message : 'Google authentication failed.');
 setLoading(false);
 }
 };

 // ─── Google user: add WhatsApp number ─────────────────────────────────
 const handleGooglePhoneSubmit = async (event: React.FormEvent) => {
 event.preventDefault(); setError(''); setLoading(true);
 try {
 await authenticatedApi<{ profile: unknown; donorProfile: unknown; nextStep: string }>('/api/auth/complete-verification', {
 phone: `91${phone.replace(/\D/g, '')}`,
 whatsappPhone: `91${phone.replace(/\D/g, '')}`,
 fullName: fullName.trim(),
 email: email.trim() || undefined,
 intent,
 });

 await resolveSignedInState();
 } catch (caught) {
 setError(caught instanceof Error ? caught.message : 'Unable to save WhatsApp number.');
 } finally { setLoading(false); }
 };

 return {
 t, isHi, mode, setMode, signupStep, setSignupStep, intent, setIntent,
 phone, setPhone, fullName, setFullName, email, setEmail,
 loading, setLoading, error, setError, infoMessage, setInfoMessage,
 handleGoogle, handleGooglePhoneSubmit,
 };
}
