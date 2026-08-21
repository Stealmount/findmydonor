import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
 Heart,
 User,
 Phone,
 MapPin,
 Bell,
 ShieldCheck,
 ArrowRight,
 ArrowLeft,
 Building2,
 UserCheck,
 AlertCircle,
 Loader2,
 CheckCircle2,
} from 'lucide-react';
import { lookupPincode, BloodType } from '../../types';
import {
 fetchMe,
 submitBasic,
 submitIntent,
 completionWizard,
 Rev3Me,
} from '../../lib/rev3Auth';

interface Rev3OnboardingWizardProps {
 onComplete: () => void;
}

type OnboardingStep = 'basic' | 'intent';

export function Rev3OnboardingWizard({ onComplete }: Rev3OnboardingWizardProps) {
 const [loading, setLoading] = useState(true);
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState('');
 const [step, setStep] = useState<OnboardingStep>('basic');

 // Step 2 — Basic Profile Form State
 const [fullName, setFullName] = useState('');
 const [whatsappPhone, setWhatsappPhone] = useState('');
 const [pincode, setPincode] = useState('');
 const [area, setArea] = useState('');
 const [city, setCity] = useState('');
 const [district, setDistrict] = useState('');
 const [state, setState] = useState('');
 const [notificationChannel, setNotificationChannel] = useState<'whatsapp' | 'email' | 'both'>('both');

 // Step 3 — Intent Form State
 const [intent, setIntent] = useState<'donor' | 'requester' | 'institution'>('donor');
 const [bloodGroup, setBloodGroup] = useState<BloodType | ''>('');
 const [isAvailable, setIsAvailable] = useState(true);
 const [healthSelfDeclaration, setHealthSelfDeclaration] = useState(false);

 // Load existing profile info on mount
 useEffect(() => {
 let mounted = true;
 (async () => {
 try {
 const me: Rev3Me = await fetchMe();
 if (!mounted) return;
 if (me.profile) {
 setFullName(me.profile.full_name || '');
 setWhatsappPhone(me.profile.whatsapp_phone || me.profile.phone || '');
 if ((me.profile as any).notification_channel) {
 setNotificationChannel((me.profile as any).notification_channel);
 }
 if ((me.profile as any).pincode) setPincode((me.profile as any).pincode);
 if ((me.profile as any).area) setArea((me.profile as any).area);
 if ((me.profile as any).city) setCity((me.profile as any).city);
 if ((me.profile as any).district) setDistrict((me.profile as any).district);
 if ((me.profile as any).state) setState((me.profile as any).state);
 }
 if (me.donorProfile) {
 if (me.donorProfile.blood_group) setBloodGroup(me.donorProfile.blood_group);
 if (typeof me.donorProfile.is_available === 'boolean') {
 setIsAvailable(me.donorProfile.is_available);
 }
 if (me.donorProfile.health_self_declaration) {
 setHealthSelfDeclaration(me.donorProfile.health_self_declaration);
 }
 }
 if (me.nextStep === 'intent') {
 setStep('intent');
 }
 } catch (err) {
 if (mounted) {
 setError('Failed to load profile context. Please refresh.');
 }
 } finally {
 if (mounted) setLoading(false);
 }
 })();
 return () => {
 mounted = false;
 };
 }, []);

 // Handle PIN auto-lookup
 const handlePincodeChange = (val: string) => {
 const cleaned = val.replace(/\D/g, '').slice(0, 6);
 setPincode(cleaned);
 if (cleaned.length === 6) {
 const match = lookupPincode(cleaned);
 if (match) {
 if (match.area) setArea(match.area);
 if (match.city) setCity(match.city);
 if (match.district) setDistrict(match.district);
 setState('Delhi');
 }
 }
 };

 // Submit Step 2 (Basic Profile)
 const handleBasicSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError('');

 if (!fullName.trim()) {
 setError('Please enter your full name.');
 return;
 }

 if (!whatsappPhone.trim()) {
 setError('WhatsApp phone number is required for emergency match alerts.');
 return;
 }
 const cleanPhone = whatsappPhone.replace(/\D/g, '');
 if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
 setError('Please enter a valid 10-digit Indian mobile number (starts with 6-9).');
 return;
 }

 if (pincode.trim() && pincode.trim().length !== 6) {
 setError('PIN code must be exactly 6 digits.');
 return;
 }

 setSubmitting(true);
 try {
 await submitBasic({
 fullName: fullName.trim(),
 whatsappPhone: whatsappPhone.trim() ? whatsappPhone.replace(/\D/g, '') : undefined,
 pincode: pincode.trim() || undefined,
 city: city.trim() || undefined,
 district: district.trim() || undefined,
 state: state.trim() || undefined,
 area: area.trim() || undefined,
 notificationChannel,
 verifyLater: true,
 });
 setStep('intent');
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to save basic profile.');
 } finally {
 setSubmitting(false);
 }
 };

 // Submit Step 3 (Intent & Details)
 const handleIntentSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError('');

 if (intent === 'donor') {
 if (!bloodGroup) {
 setError('Please select your blood group.');
 return;
 }
 if (!healthSelfDeclaration) {
 setError('Please accept the health self-declaration to register as a donor.');
 return;
 }
 }

 setSubmitting(true);
 try {
 await submitIntent({
 intent,
 bloodGroup: intent === 'donor' ? bloodGroup : undefined,
 isAvailable: intent === 'donor' ? isAvailable : undefined,
 healthSelfDeclaration: intent === 'donor' ? healthSelfDeclaration : undefined,
 });
 await completionWizard();
 onComplete();
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to complete onboarding.');
 } finally {
 setSubmitting(false);
 }
 };

 if (loading) {
 return (
 <div className="min-h-[70vh] flex items-center justify-center p-4">
 <div className="flex items-center gap-3 text-ink-600">
 <Loader2 className="h-6 w-6 animate-spin text-blood-600" />
 <span className="font-medium text-sm">Preparing onboarding...</span>
 </div>
 </div>
 );
 }

 const currentStepNum = step === 'basic' ? 2 : 3;

 return (
 <div className="min-h-[85vh] flex items-center justify-center p-4 py-8">
 <div className="w-full max-w-xl">
 {/* Progress Header */}
 <div className="mb-6 text-center">
 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blood-50 border border-blood-200 text-blood-700 text-xs font-semibold uppercase tracking-wider mb-2">
 Step {currentStepNum} of 3
 </div>
 <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-900 tracking-tight">
 {step === 'basic' ? 'Complete Your Profile' : 'How would you like to participate?'}
 </h1>
 <p className="text-sm text-ink-500 mt-1">
 {step === 'basic'
 ? 'Tell us a bit about yourself so emergency matches can reach you accurately.'
 : 'Choose your primary role. You can request blood anytime regardless of intent.'}
 </p>

 {/* Progress Bar */}
 <div className="mt-4 h-1.5 w-full bg-ink-100 rounded-full overflow-hidden">
 <motion.div
 className="h-full bg-gradient-to-r from-blood-500 to-blood-600"
 initial={{ width: step === 'basic' ? '33%' : '66%' }}
 animate={{ width: step === 'basic' ? '66%' : '100%' }}
 transition={{ duration: 0.3 }}
 />
 </div>
 </div>

 {error && (
 <motion.div
 initial={{ opacity: 0, y: -8 }}
 animate={{ opacity: 1, y: 0 }}
 className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800"
>
 <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
 <span>{error}</span>
 </motion.div>
 )}

 <AnimatePresence mode="wait">
 {step === 'basic' ? (
 <motion.form
 key="step-basic"
 initial={{ opacity: 0, x: -10 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: 10 }}
 onSubmit={handleBasicSubmit}
 className="glass p-6 sm:p-8 rounded-2xl space-y-5 border border-white/60"
>
 {/* Full Name */}
 <div>
 <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5 flex items-center gap-1.5">
 <User className="h-3.5 w-3.5 text-blood-600" />
 Full Name <span className="text-blood-600">*</span>
 </label>
 <input
 type="text"
 required
 value={fullName}
 onChange={(e) => setFullName(e.target.value)}
 placeholder="e.g. Rahul Sharma"
 className="w-full h-11 px-3.5 rounded-xl border border-ink-200 bg-white/80 text-sm font-medium text-ink-900 placeholder:text-ink-300 focus:border-blood-500 focus:outline-none focus:ring-2 focus:ring-blood-500/20"
 />
 </div>

 {/* WhatsApp Number */}
 <div>
 <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5 flex items-center gap-1.5">
 <Phone className="h-3.5 w-3.5 text-emerald-600" />
 WhatsApp Phone Number <span className="text-emerald-600">*</span>
 </label>
 <input
 type="tel"
 required
 value={whatsappPhone}
 onChange={(e) => setWhatsappPhone(e.target.value)}
 placeholder="10-digit mobile number"
 className="w-full h-11 px-3.5 rounded-xl border border-ink-200 bg-white/80 text-sm font-medium text-ink-900 placeholder:text-ink-300 focus:border-blood-500 focus:outline-none focus:ring-2 focus:ring-blood-500/20"
 />
 <p className="text-[11px] text-ink-400 mt-1">
 Compulsory for urgent donor notifications and match alerts.
 </p>
 </div>

 {/* PIN Code & Location */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5 flex items-center gap-1.5">
 <MapPin className="h-3.5 w-3.5 text-blood-600" />
 PIN Code
 </label>
 <input
 type="text"
 maxLength={6}
 value={pincode}
 onChange={(e) => handlePincodeChange(e.target.value)}
 placeholder="6-digit PIN"
 className="w-full h-11 px-3.5 rounded-xl border border-ink-200 bg-white/80 text-sm font-medium text-ink-900 placeholder:text-ink-300 focus:border-blood-500 focus:outline-none focus:ring-2 focus:ring-blood-500/20"
 />
 </div>
 <div>
 <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
 City / Region
 </label>
 <input
 type="text"
 value={city}
 onChange={(e) => setCity(e.target.value)}
 placeholder="Auto-resolved or type city"
 className="w-full h-11 px-3.5 rounded-xl border border-ink-200 bg-white/80 text-sm font-medium text-ink-900 placeholder:text-ink-300 focus:border-blood-500 focus:outline-none focus:ring-2 focus:ring-blood-500/20"
 />
 </div>
 </div>

 {/* Notification Channel */}
 <div>
 <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5 flex items-center gap-1.5">
 <Bell className="h-3.5 w-3.5 text-blood-600" />
 Preferred Communication Channel
 </label>
 <div className="grid grid-cols-3 gap-2">
 {(
 [
 { id: 'both', label: 'Both' },
 { id: 'whatsapp', label: 'WhatsApp' },
 { id: 'email', label: 'Email' },
 ] as const
 ).map((opt) => (
 <button
 key={opt.id}
 type="button"
 onClick={() => setNotificationChannel(opt.id)}
 className={`h-10 rounded-xl text-xs font-bold transition border ${
 notificationChannel === opt.id
 ? 'bg-blood-500 border-blood-600 text-white'
 : 'bg-white/80 border-ink-200 text-ink-700 hover:bg-ink-50'
 }`}
>
 {opt.label}
 </button>
 ))}
 </div>
 </div>

 <div className="pt-2">
 <button
 type="submit"
 disabled={submitting}
 className="w-full h-12 rounded-xl bg-gradient-to-r from-blood-600 to-blood-700 text-white font-bold text-sm hover:from-blood-700 hover:to-blood-800 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
>
 {submitting ? (
 <Loader2 className="h-4 w-4 animate-spin" />
 ) : (
 <>
 <span>Continue to Role Selection</span>
 <ArrowRight className="h-4 w-4" />
 </>
 )}
 </button>
 </div>
 </motion.form>
 ) : (
 <motion.form
 key="step-intent"
 initial={{ opacity: 0, x: 10 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: -10 }}
 onSubmit={handleIntentSubmit}
 className="glass p-6 sm:p-8 rounded-2xl space-y-6 border border-white/60"
>
 {/* Intent Selection Cards */}
 <div className="space-y-3">
 <label className="block text-xs font-bold uppercase tracking-wider text-ink-700">
 Select Your Primary Role
 </label>
 <div className="grid grid-cols-1 gap-3">
 {/* Donor */}
 <button
 type="button"
 onClick={() => setIntent('donor')}
 className={`p-4 rounded-xl border text-left transition flex items-start gap-3.5 cursor-pointer ${
 intent === 'donor'
 ? 'border-blood-500 bg-blood-50/60 ring-2 ring-blood-500/20'
 : 'border-ink-200 bg-white/70 hover:bg-white'
 }`}
>
 <div
 className={`p-2.5 rounded-lg shrink-0 ${
 intent === 'donor' ? 'bg-blood-600 text-white' : 'bg-ink-100 text-ink-600'
 }`}
>
 <Heart className="h-5 w-5" />
 </div>
 <div>
 <div className="font-bold text-sm text-ink-900 flex items-center gap-1.5">
 Volunteer Blood Donor
 {intent === 'donor' && <CheckCircle2 className="h-4 w-4 text-blood-600" />}
 </div>
 <p className="text-xs text-ink-500 mt-0.5">
 I want to register to donate blood when compatible emergencies arise nearby.
 </p>
 </div>
 </button>

 {/* Requester */}
 <button
 type="button"
 onClick={() => setIntent('requester')}
 className={`p-4 rounded-xl border text-left transition flex items-start gap-3.5 cursor-pointer ${
 intent === 'requester'
 ? 'border-blood-500 bg-blood-50/60 ring-2 ring-blood-500/20'
 : 'border-ink-200 bg-white/70 hover:bg-white'
 }`}
>
 <div
 className={`p-2.5 rounded-lg shrink-0 ${
 intent === 'requester' ? 'bg-blood-600 text-white' : 'bg-ink-100 text-ink-600'
 }`}
>
 <UserCheck className="h-5 w-5" />
 </div>
 <div>
 <div className="font-bold text-sm text-ink-900 flex items-center gap-1.5">
 Blood Requester / Caregiver
 {intent === 'requester' && <CheckCircle2 className="h-4 w-4 text-blood-600" />}
 </div>
 <p className="text-xs text-ink-500 mt-0.5">
 I am looking for voluntary blood donors for a patient or hospital request.
 </p>
 </div>
 </button>

 {/* Institution */}
 <button
 type="button"
 onClick={() => setIntent('institution')}
 className={`p-4 rounded-xl border text-left transition flex items-start gap-3.5 cursor-pointer ${
 intent === 'institution'
 ? 'border-blood-500 bg-blood-50/60 ring-2 ring-blood-500/20'
 : 'border-ink-200 bg-white/70 hover:bg-white'
 }`}
>
 <div
 className={`p-2.5 rounded-lg shrink-0 ${
 intent === 'institution' ? 'bg-blood-600 text-white' : 'bg-ink-100 text-ink-600'
 }`}
>
 <Building2 className="h-5 w-5" />
 </div>
 <div>
 <div className="font-bold text-sm text-ink-900 flex items-center gap-1.5">
 Medical Institution / Blood Bank / NGO
 {intent === 'institution' && <CheckCircle2 className="h-4 w-4 text-blood-600" />}
 </div>
 <p className="text-xs text-ink-500 mt-0.5">
 We represent a hospital, blood bank, or blood donation organization.
 </p>
 </div>
 </button>
 </div>
 </div>

 {/* Inline Donor Details */}
 {intent === 'donor' && (
 <motion.div
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height: 'auto' }}
 className="space-y-4 pt-3 border-t border-ink-200/60"
>
 <div>
 <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
 Blood Group <span className="text-blood-600">*</span>
 </label>
 <select
 value={bloodGroup}
 onChange={(e) => setBloodGroup(e.target.value as BloodType)}
 className="w-full h-11 px-3.5 rounded-xl border border-ink-200 bg-white/80 text-sm font-bold text-ink-900 focus:border-blood-500 focus:outline-none focus:ring-2 focus:ring-blood-500/20"
>
 <option value="">Select Blood Group</option>
 {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
 <option key={bg} value={bg}>
 {bg}
 </option>
 ))}
 </select>
 </div>

 <div className="flex items-center gap-3 p-3 rounded-xl bg-ink-50/80 border border-ink-200">
 <input
 type="checkbox"
 id="isAvailable"
 checked={isAvailable}
 onChange={(e) => setIsAvailable(e.target.checked)}
 className="h-4 w-4 rounded border-ink-300 text-blood-600 focus:ring-blood-500 cursor-pointer"
 />
 <label htmlFor="isAvailable" className="text-xs font-medium text-ink-800 cursor-pointer">
 I am available to donate blood immediately when notified.
 </label>
 </div>

 <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blood-50/50 border border-blood-200/80">
 <input
 type="checkbox"
 id="healthSelfDeclaration"
 checked={healthSelfDeclaration}
 onChange={(e) => setHealthSelfDeclaration(e.target.checked)}
 className="h-4 w-4 mt-0.5 rounded border-ink-300 text-blood-600 focus:ring-blood-500 cursor-pointer shrink-0"
 />
 <label htmlFor="healthSelfDeclaration" className="text-xs font-medium text-ink-800 leading-relaxed cursor-pointer">
 <span className="font-bold text-blood-900 block mb-0.5 flex items-center gap-1">
 <ShieldCheck className="h-3.5 w-3.5 text-blood-600" />
 Clinical Self-Declaration
 </span>
 I declare that I am between 18–65 years old, weigh at least 45 kg, and have no major health contraindications for blood donation.
 </label>
 </div>
 </motion.div>
 )}

 {/* Action Buttons */}
 <div className="pt-2 flex items-center gap-3">
 <button
 type="button"
 onClick={() => {
 setError('');
 setStep('basic');
 }}
 className="h-12 px-4 rounded-xl border border-ink-200 bg-white/80 text-ink-700 font-bold text-sm hover:bg-ink-50 transition flex items-center justify-center gap-1.5 cursor-pointer"
>
 <ArrowLeft className="h-4 w-4" />
 <span>Back</span>
 </button>

 <button
 type="submit"
 disabled={submitting}
 className="flex-1 h-12 rounded-xl bg-gradient-to-r from-blood-600 to-blood-700 text-white font-bold text-sm hover:from-blood-700 hover:to-blood-800 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
>
 {submitting ? (
 <Loader2 className="h-4 w-4 animate-spin" />
 ) : (
 <>
 <span>Complete Onboarding</span>
 <CheckCircle2 className="h-4 w-4" />
 </>
 )}
 </button>
 </div>
 </motion.form>
 )}
 </AnimatePresence>
 </div>
 </div>
 );
}
