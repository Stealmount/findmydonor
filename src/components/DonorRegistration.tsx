import { supabase } from '../lib/supabase';
import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { BloodType, DonationFrequency, AvailabilityStatus, NumberSharingPref, lookupPincode, User, HOSPITAL_NETWORKS } from '../types';
import { authenticatedApi } from '../lib/api';
import { Heart, UserPlus, Shield, Eye, EyeOff, CheckCircle, MapPin, Search, Activity, Building2, AlertCircle } from 'lucide-react';
import { DELHI_PINCODES, DelhiPincode } from '../data/pincodes';
import { useLanguage } from '../lib/LanguageContext';

interface DonorRegistrationProps {
  onSuccess: (donor: User) => void;
  onNavigateLogin: () => void;
  prefilledGoogleUser?: { uid: string; email: string; full_name: string } | null;
  onClearPrefilledGoogle?: () => void;
}

export default function DonorRegistration({ onSuccess, onNavigateLogin, prefilledGoogleUser, onClearPrefilledGoogle }: DonorRegistrationProps) {
  const { t, language } = useLanguage();
  const isHi = language === 'HI';
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '', 
    phone: '',
    whatsapp_number: '',
    blood_type: 'O+' as BloodType,
    age: 24,
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    weight_kg: 65,
    hospital_affiliation: HOSPITAL_NETWORKS[0],
    donation_frequency: 'regular' as DonationFrequency,
    last_donation_date: '',
    pincode: '',
    area: '',
    city: '',
    availability_status: 'available' as AvailabilityStatus,
    number_sharing_pref: 'on_approval' as NumberSharingPref,
    emergency_only: false,
    medical_clearance: true,
  });

  const [otpStep, setOtpStep] = useState<'form' | 'otp_sent'>('form');
  const [otpMethod, setOtpMethod] = useState<'whatsapp' | 'email'>('whatsapp');
  const [otpValue, setOtpValue] = useState('');
  const [otpVerificationToken, setOtpVerificationToken] = useState('');

  const [neverDonated, setNeverDonated] = useState(true);
  const [sameAsPhone, setSameAsPhone] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleUid, setGoogleUid] = useState<string | null>(null);

  const [locationSearch, setLocationSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<DelhiPincode[]>([]);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLocationSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocationSearch(val);
    if (val.trim().length >= 2) {
      const query = val.toLowerCase().trim();
      const filtered = DELHI_PINCODES.filter(item =>
        item.pincode.includes(query) ||
        item.area.toLowerCase().includes(query) ||
        item.zone.toLowerCase().includes(query) ||
        item.district.toLowerCase().includes(query)
      ).slice(0, 12);
      setFilteredSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setFilteredSuggestions([]);
    }
  };

  const handleSelectSuggestion = (suggestion: DelhiPincode) => {
    const cityMap: Record<string, string> = {
      'Delhi': 'New Delhi',
      'Gautam Buddha Nagar': 'Noida / Greater Noida',
      'Ghaziabad': 'Ghaziabad',
      'Gurugram': 'Gurugram',
      'Faridabad': 'Faridabad',
    };
    setFormData(prev => ({
      ...prev,
      pincode: suggestion.pincode,
      area: suggestion.area,
      city: cityMap[suggestion.district] ?? suggestion.zone,
    }));
    setLocationSearch(`${suggestion.area}, ${suggestion.district} (${suggestion.pincode})`);
    setShowSuggestions(false);
  };

  useEffect(() => {
    if (prefilledGoogleUser) {
      setGoogleUid(prefilledGoogleUser.uid);
      setFormData(prev => ({
        ...prev,
        full_name: prefilledGoogleUser.full_name,
        email: prefilledGoogleUser.email,
        password: '',
      }));
    }
  }, [prefilledGoogleUser]);

  const handlePincodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pin = e.target.value.trim();
    setFormData(prev => ({ ...prev, pincode: pin }));

    if (pin.length === 6 && /^\d{6}$/.test(pin)) {
      const suggest = lookupPincode(pin);
      if (suggest) {
        setFormData(prev => ({
          ...prev,
          area: suggest.area,
          city: suggest.city,
        }));
      }
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setFormData(prev => ({
      ...prev,
      phone: val,
      whatsapp_number: sameAsPhone ? val : prev.whatsapp_number
    }));
  };

  const handleSameAsPhoneToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setSameAsPhone(checked);
    if (checked) {
      setFormData(prev => ({ ...prev, whatsapp_number: prev.phone }));
    }
  };

const handleGoogleSignUp = async () => {
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
      // Redirects to google
    } catch (err: any) {
      console.error("Google sign up failed:", err);
      setError(err.message || 'Google Sign-In failed. Please try again.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.full_name || !formData.email || (!googleUid && !formData.password) || !formData.phone || !formData.pincode) {
      setError('Please fill in all mandatory fields.');
      return;
    }

    setLoading(true);

    try {
      let verificationToken = otpVerificationToken;
      if (otpStep === 'form') {
        const endpoint = '/api/wa/send-otp';
        const payload = { phone: formData.whatsapp_number || formData.phone };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.success) {
          setOtpStep('otp_sent');
        } else {
          setError(data.error || 'Failed to send OTP. Please try again.');
        }
        setLoading(false);
        return;
      }
      
      // If we are at otp_sent, verify it first
      if (otpStep === 'otp_sent') {
        const endpoint = '/api/wa/verify-otp';
        const payload = { phone: formData.whatsapp_number || formData.phone, otp: otpValue };

        const verifyRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const verifyData = await verifyRes.json();
        
        if (!verifyData.success) {
          setError(verifyData.error || 'Invalid OTP. Please try again.');
          setLoading(false);
          return;
        }
        verificationToken = verifyData.verificationToken;
        setOtpVerificationToken(verificationToken);
      }

      let donorId = googleUid;

      if (!donorId) {
        // 1. Create authentication account in Supabase Auth
        const { data, error: authErr } = await supabase.auth.signUp({
          email: formData.email.toLowerCase().trim(),
          password: formData.password,
          options: {
            data: { full_name: formData.full_name }
          }
        });

        if (authErr) {
          setError(authErr.message || 'Authentication signup failed.');
          setLoading(false);
          return;
        }
        
        if (!data.user) {
          setError('Failed to create account.');
          setLoading(false);
          return;
        }
        
        // Supabase returns a fake user with no identities if the email is already registered
        if (data.user.identities && data.user.identities.length === 0) {
          setError('This email is already registered. Please sign in instead.');
          setLoading(false);
          return;
        }
        
        donorId = data.user.id;
      }

      const nowStr = new Date().toISOString();

      let cooldownUntilStr: string | null = null;
      if (!neverDonated && formData.last_donation_date) {
        const lastDateObj = new Date(formData.last_donation_date);
        const cooldownObj = new Date(lastDateObj.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days cooldown
        
        const todayStr = new Date().toISOString().split('T')[0];
        const calculatedCooldownStr = cooldownObj.toISOString().split('T')[0];
        
        if (calculatedCooldownStr > todayStr) {
          cooldownUntilStr = calculatedCooldownStr;
        }
      }

      const newDonor: User = {
        id: donorId,
        full_name: formData.full_name,
        email: formData.email.toLowerCase().trim(),
        phone: formData.phone,
        whatsapp_number: formData.whatsapp_number,
        blood_type: formData.blood_type,
        age: Number(formData.age) || 24,
        gender: formData.gender,
        weight_kg: Number(formData.weight_kg) || 65,
        hospital_affiliation: formData.hospital_affiliation,
        medical_clearance: formData.medical_clearance,
        donation_frequency: formData.donation_frequency,
        last_donation_date: neverDonated ? null : formData.last_donation_date,
        cooldown_until: cooldownUntilStr,
        pincode: formData.pincode,
        area: formData.area,
        city: formData.city,
        availability_status: formData.availability_status,
        number_sharing_pref: formData.number_sharing_pref,
        emergency_only: formData.emergency_only,
        account_status: cooldownUntilStr ? 'cooldown' : 'active',
        whatsapp_verified: true,
        digilocker_verified: false,
        created_at: nowStr,
        updated_at: nowStr,
      } as any;

      const { donor } = await authenticatedApi<{ donor: User }>('/api/profiles/donor', {
        ...newDonor,
        verificationToken,
      });

      // Trigger success confetti animation
      try {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch (confettiErr) {
        console.error("Confetti error:", confettiErr);
      }

      // 3. Complete. Welcome delivery is handled and logged by the API.
      onSuccess(donor);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || (err.error_description ? err.error_description : JSON.stringify(err));
      setError(`Registration failed: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  if (otpStep === 'otp_sent') {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 flex items-center justify-center">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-2xl border border-ink-200/80 shadow-premium-lg rounded-3xl p-8 text-center animate-in fade-in zoom-in duration-300">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 shadow-[0_8px_20px_-4px_rgba(16,185,129,0.5)]">
            <Shield className="w-7 h-7 text-emerald-600" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-900 font-sans mb-2">Verify your {otpMethod === 'whatsapp' ? 'WhatsApp' : 'Email'}</h2>
          <p className="text-ink-500 text-sm mb-6">
            We've sent a secure 6-digit OTP to your {otpMethod === 'whatsapp' ? 'WhatsApp number' : 'Email'}:<br/>
            <span className="font-bold text-ink-800 tracking-wider">
                {otpMethod === 'whatsapp' 
                  ? (formData.whatsapp_number || formData.phone).replace(/.(?=.{4})/g, '*')
                  : formData.email.replace(/(.{2})(.*)(?=@)/, '$1***')}
              </span>
          </p>
          {otpMethod === 'email' && (
              <p className="text-xs text-blood-600 font-semibold mb-6 flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Note: Email might go to your Spam folder.
              </p>
            )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 rounded-xl bg-blood-50 text-blood-700 border border-blood-200 text-xs font-semibold">
                {error}
              </div>
            )}
            
            <div className="flex justify-center gap-2 sm:gap-3">
              {[...Array(6)].map((_, index) => (
                <input
                  key={index}
                  type="text"
                  maxLength={1}
                  className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold font-mono bg-ink-50 border border-ink-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all outline-none"
                  value={otpValue[index] || ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val) {
                      const newOtp = otpValue.split('');
                      newOtp[index] = val;
                      setOtpValue(newOtp.join(''));
                      
                      // Auto-focus next
                      if (index < 5) {
                        const nextInput = document.getElementById(`otp-input-${index + 1}`);
                        nextInput?.focus();
                      }
                    } else {
                      // Handle backspace
                      const newOtp = otpValue.split('');
                      newOtp[index] = '';
                      setOtpValue(newOtp.join(''));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !otpValue[index] && index > 0) {
                      const prevInput = document.getElementById(`otp-input-${index - 1}`);
                      prevInput?.focus();
                    }
                  }}
                  id={`otp-input-${index}`}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || otpValue.length !== 6}
              className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm tracking-wide transition-all shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Verify & Create Account
                </>
              )}
            </button>
          </form>
          
          <button
            type="button"
            onClick={() => setOtpStep('form')}
            className="mt-6 text-xs font-semibold text-ink-500 hover:text-ink-800 transition-colors cursor-pointer"
          >
            Change Contact Details
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="donor-registration-container" className="max-w-2xl mx-auto rounded-3xl bg-white/95 backdrop-blur-2xl border border-ink-200/80 shadow-premium-lg overflow-hidden my-6">
      <div className="bg-gradient-to-br from-ink-900 via-ink-950 to-ink-900 p-8 text-white text-center relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-blood-600/20 blur-2xl" aria-hidden />
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl blood-drop-gradient shadow-[0_8px_20px_-4px_rgba(244,63,87,0.5)]">
          <UserPlus className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">{t.donorReg.title}</h2>
        <p className="text-ink-300 text-xs mt-1">
          {t.donorReg.subtitle}
        </p>
      </div>

      <form id="form-donor-reg" onSubmit={handleSubmit} className="p-8 space-y-6">
        {error && (
          <div id="reg-error-alert" className="p-3 rounded-xl bg-blood-50 text-blood-700 border border-blood-200 text-xs font-semibold">
            {error}
          </div>
        )}

        {googleUid && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs font-semibold text-emerald-800">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span>Google Connected ({formData.email})</span>
            </div>
            {onClearPrefilledGoogle && (
              <button
                type="button"
                onClick={() => {
                  setGoogleUid(null);
                  setFormData(prev => ({ ...prev, full_name: '', email: '', password: '' }));
                  onClearPrefilledGoogle();
                }}
                className="text-blood-600 font-semibold hover:underline cursor-pointer"
              >
                Disconnect
              </button>
            )}
          </div>
        )}

        {!googleUid && (
          <div className="space-y-4">
            <button
              id="btn-google-register"
              type="button"
              onClick={handleGoogleSignUp}
              disabled={loading}
              className="w-full py-3 bg-white hover:bg-ink-50 text-ink-800 border border-ink-200 rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {isHi ? 'Google के साथ पंजीकरण करें' : 'Sign up with Google'}
            </button>
            <div className="flex items-center gap-3 text-ink-400">
              <hr className="flex-1 border-ink-200" />
              <span className="text-xs font-semibold uppercase">{isHi ? 'या मैनुअल रूप से पंजीकरण करें' : 'OR REGISTER MANUALLY'}</span>
              <hr className="flex-1 border-ink-200" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Account credentials */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'पूरा नाम *' : 'Full Name *'}</label>
            <div className="relative">
              <input
                id="inp-donor-name"
                type="text"
                required
                disabled={!!googleUid}
                value={formData.full_name}
                onChange={e => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                className={`w-full px-4 py-3 border border-ink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 font-medium text-sm transition-all ${googleUid ? 'bg-ink-50 cursor-not-allowed opacity-85' : 'bg-white'}`}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'ईमेल पता *' : 'Email Address *'}</label>
            <input
              id="inp-donor-email"
              type="email"
              required
              readOnly={!!googleUid}
              value={formData.email}
              onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className={`w-full px-4 py-3 border border-ink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 font-medium text-sm transition-all ${googleUid ? 'bg-ink-50 cursor-not-allowed opacity-85' : 'bg-white'}`}
            />
          </div>

          {!googleUid && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'पासवर्ड (6+ अक्षर) *' : 'Password (6+ chars) *'}</label>
              <div className="relative">
                <input
                  id="inp-donor-password"
                  type={showPassword ? 'text' : 'password'}
                  required={!googleUid}
                  minLength={6}
                  placeholder="••••••"
                  value={formData.password}
                  onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-ink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 text-sm transition-all"
                />
                <button
                  type="button"
                  id="btn-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-ink-400 hover:text-ink-700 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'फोन नंबर *' : 'Phone Number *'}</label>
            <input
              id="inp-donor-phone"
              type="tel"
              required
              maxLength={10}
              value={formData.phone}
              onChange={handlePhoneChange}
              className="w-full px-4 py-3 bg-white border border-ink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 text-sm font-mono transition-all"
            />
          </div>

          {/* WhatsApp verification settings */}
          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center gap-2">
              <input
                id="chk-same-phone"
                type="checkbox"
                checked={sameAsPhone}
                onChange={handleSameAsPhoneToggle}
                className="w-4 h-4 text-brand-red focus:ring-brand-red border-brand-dark rounded-none"
              />
              <label htmlFor="chk-same-phone" className="text-[11px] text-brand-dark font-display font-black uppercase tracking-wider select-none">
                {isHi ? 'WhatsApp नंबर फोन नंबर के समान है' : 'WhatsApp number is same as Phone number'}
              </label>
            </div>

            {!sameAsPhone && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'WhatsApp नंबर *' : 'WhatsApp Number *'}</label>
                <input
                  id="inp-donor-wa"
                  type="tel"
                  required
                  maxLength={10}
                  value={formData.whatsapp_number}
                  onChange={e => setFormData(prev => ({ ...prev, whatsapp_number: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-mono focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
                />
              </div>
            )}
          </div>

          {/* Blood Type & Clinical Verification */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'आपका रक्त समूह *' : 'Your Blood Type *'}</label>
            <select
              id="sel-donor-blood"
              value={formData.blood_type}
              onChange={e => setFormData(prev => ({ ...prev, blood_type: e.target.value as BloodType }))}
              className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-bold font-mono focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
            >
              {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'आयु (18-65 वर्ष) *' : 'Age (18-65 Yrs) *'}</label>
            <div className="relative">
              <input
                id="inp-donor-age"
                type="number"
                min={18}
                max={65}
                required
                disabled={false}
                value={formData.age}
                onChange={e => setFormData(prev => ({ ...prev, age: parseInt(e.target.value) || 18 }))}
                className={`w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-semibold focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none bg-white`}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'लिंग *' : 'Gender *'}</label>
            <select
              id="sel-donor-gender"
              value={formData.gender}
              onChange={e => setFormData(prev => ({ ...prev, gender: e.target.value as any }))}
              className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-semibold focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
            >
              <option value="Male">{isHi ? 'पुरुष' : 'Male'}</option>
              <option value="Female">{isHi ? 'महिला' : 'Female'}</option>
              <option value="Other">{isHi ? 'अन्य / बताना नहीं चाहते' : 'Other / Prefer not to say'}</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'वजन (न्यूनतम 50 किग्रा) *' : 'Weight (Min 50 kg) *'}</label>
            <input
              id="inp-donor-weight"
              type="number"
              min={50}
              max={160}
              required
              value={formData.weight_kg}
              onChange={e => setFormData(prev => ({ ...prev, weight_kg: parseInt(e.target.value) || 50 }))}
              className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-semibold focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blood-600" />
              {isHi ? 'अस्पताल / ब्लड बैंक नेटवर्क संबद्धता (रक्तदान / एम्स / अपोलो / फोर्टिस)' : 'Hospital / Blood Bank Network Affiliation (RaktDaan / AIIMS / Apollo / Fortis)'}
            </label>
            <select
              id="sel-donor-hospital-network"
              value={formData.hospital_affiliation}
              onChange={e => setFormData(prev => ({ ...prev, hospital_affiliation: e.target.value }))}
              className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-medium focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
            >
              {HOSPITAL_NETWORKS.map(net => (
                <option key={net} value={net}>{net}</option>
              ))}
            </select>
          </div>

          {/* Quick Search Delhi Location */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-blood-600 animate-pulse" />
              {isHi ? 'त्वरित स्थान ऑटोकंप्लीट (क्षेत्र या पिनकोड)' : 'Quick Location Autocomplete (Area or Pincode)'}
            </label>
            <div className="relative" ref={suggestionsRef}>
              <input
                id="inp-donor-delhi-location-search"
                type="text"
                placeholder={isHi ? 'क्षेत्र या पिनकोड खोजें...' : 'Search area or pincode...'}
                value={locationSearch}
                onChange={handleLocationSearchChange}
                onFocus={() => setShowSuggestions(true)}
                className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-medium placeholder-ink-400 focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 max-h-60 overflow-y-auto bg-white/95 backdrop-blur-xl rounded-2xl border border-ink-200 shadow-xl mt-1.5 divide-y divide-ink-100">
                  {filteredSuggestions.map((suggestion, idx) => (
                    <button
                      key={`${suggestion.pincode}-${suggestion.area}-${idx}`}
                      type="button"
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className="w-full text-left px-4 py-3 hover:bg-blood-50 text-xs font-semibold text-ink-800 flex justify-between items-center transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <MapPin className="w-4 h-4 text-blood-600 shrink-0" />
                        <div>
                          <span className="text-ink-900 font-semibold text-sm block">{suggestion.area}</span>
                          <span className="text-ink-500 text-[10px] font-medium block">
                            {suggestion.zone}
                            {suggestion.district !== 'Delhi' && (
                              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-blood-100 text-blood-700">
                                {suggestion.district}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                      <span className="bg-ink-900 text-white px-2.5 py-1 rounded-lg font-mono font-bold text-xs shrink-0">
                        {suggestion.pincode}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">Pincode (6-digit) *</label>
            <input
              id="inp-donor-pin"
              type="text"
              maxLength={6}
              required
              value={formData.pincode}
              onChange={handlePincodeChange}
              className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-mono font-bold focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'क्षेत्र / मोहल्ला' : 'Area / Locality'}</label>
            <input
              id="inp-donor-area"
              type="text"
              placeholder={isHi ? 'स्वचालित सुझाव' : 'Auto-suggested'}
              value={formData.area}
              onChange={e => setFormData(prev => ({ ...prev, area: e.target.value }))}
              className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-medium focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'शहर' : 'City'}</label>
            <input
              id="inp-donor-city"
              type="text"
              placeholder={isHi ? 'स्वचालित सुझाव' : 'Auto-suggested'}
              value={formData.city}
              onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
              className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-medium focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
            />
          </div>

          {/* Last Donation Date */}
          <div className="md:col-span-2 space-y-3 pt-4 border-t border-ink-100">
            <div className="flex items-center gap-2.5">
              <input
                id="chk-never-donated"
                type="checkbox"
                checked={neverDonated}
                onChange={e => setNeverDonated(e.target.checked)}
                className="w-4 h-4 text-blood-600 focus:ring-blood-500 border-ink-300 rounded"
              />
              <label htmlFor="chk-never-donated" className="text-xs text-ink-800 font-semibold select-none cursor-pointer">
                {isHi ? 'मैंने पहले कभी रक्तदान नहीं किया है (पहली बार रक्तदान)' : 'I have never donated blood before (or first-time donor)'}
              </label>
            </div>

            {!neverDonated && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'अंतिम रक्तदान की तिथि *' : 'Last Donation Date *'}</label>
                <input
                  id="inp-last-donation"
                  type="date"
                  required
                  value={formData.last_donation_date}
                  onChange={e => setFormData(prev => ({ ...prev, last_donation_date: e.target.value }))}
                  className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-medium focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
                />
                <p className="text-xs text-ink-500 font-medium">{isHi ? 'चिकित्सकीय रूप से अनुशंसित 60-दिवसीय विश्राम अवधि को सत्यापित करने के लिए उपयोग किया जाता है।' : 'Used to verify the medically recommended 60-day recovery cooldown period.'}</p>
              </div>
            )}
          </div>

            <div className="bg-ink-50/50 rounded-2xl p-5 border border-ink-100/50 relative">
              <div className="absolute top-4 right-4 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Shield className="w-3 h-3" /> Required
              </div>
              <h3 className="text-sm font-bold text-ink-900 mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" /> Verification Method
              </h3>
              
              <div className="grid grid-cols-2 gap-3 mb-2">
                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${otpMethod === 'whatsapp' ? 'border-emerald-500 bg-emerald-50/50 shadow-sm' : 'border-ink-200 hover:border-ink-300'}`}>
                  <input 
                    type="radio" 
                    name="otpMethod" 
                    value="whatsapp" 
                    checked={otpMethod === 'whatsapp'} 
                    onChange={() => setOtpMethod('whatsapp')} 
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" 
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-ink-900 leading-tight">WhatsApp</span>
                    <span className="text-[10px] text-emerald-600 font-medium">Recommended</span>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${otpMethod === 'email' ? 'border-blood-500 bg-blood-50/50 shadow-sm' : 'border-ink-200 hover:border-ink-300'}`}>
                  <input 
                    type="radio" 
                    name="otpMethod" 
                    value="email" 
                    checked={otpMethod === 'email'} 
                    onChange={() => setOtpMethod('email')} 
                    className="w-4 h-4 text-blood-600 focus:ring-blood-500" 
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-ink-900 leading-tight">Email</span>
                    <span className="text-[10px] text-ink-500 font-medium">Privacy focused</span>
                  </div>
                </label>
              </div>
            </div>

          {/* Preferences */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">Availability Status</label>
            <select
              id="sel-donor-avail"
              value={formData.availability_status}
              onChange={e => setFormData(prev => ({ ...prev, availability_status: e.target.value as AvailabilityStatus }))}
              className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-bold focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
            >
              <option value="available">Available Now</option>
              <option value="available_with_notice">Available with Notice</option>
              <option value="unavailable">Temporarily Unavailable</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">Number Sharing Preference</label>
            <select
              id="sel-donor-sharing"
              value={formData.number_sharing_pref}
              onChange={e => setFormData(prev => ({ ...prev, number_sharing_pref: e.target.value as NumberSharingPref }))}
              className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-bold focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
            >
              <option value="on_approval">On Approval (Default - Safe)</option>
              <option value="never">Never (Platform Messaging Only)</option>
            </select>
          </div>

          {/* Emergency Only Toggle */}
          <div className="md:col-span-2 p-4 bg-blood-50/70 border border-blood-200/80 rounded-2xl flex items-center justify-between">
            <div className="space-y-1 pr-4">
              <span className="text-xs font-bold uppercase tracking-wider text-blood-900">{isHi ? 'केवल आपातकालीन मोड' : 'Emergency Only Mode'}</span>
              <p className="text-xs text-ink-700 leading-relaxed font-medium">
                {isHi ? 'यदि सक्षम है, तो मैचिंग इंजन केवल आपको अति गंभीर अनुरोधों (6 घंटे के भीतर आवश्यक) के लिए सूचित करेगा।' : 'If enabled, the matching engine will only notify you of critical requests (needed within 6 hours).'}
              </p>
            </div>
            <input
              id="chk-emergency-only"
              type="checkbox"
              checked={formData.emergency_only}
              onChange={e => setFormData(prev => ({ ...prev, emergency_only: e.target.checked }))}
              className="w-5 h-5 text-blood-600 focus:ring-blood-500 border-ink-300 rounded flex-shrink-0 cursor-pointer"
            />
          </div>
        </div>

        {/* NBTC / RaktDaan Medical Declaration */}
        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start gap-3">
          <input
            id="chk-medical-clearance"
            type="checkbox"
            required
            checked={formData.medical_clearance}
            onChange={e => setFormData(prev => ({ ...prev, medical_clearance: e.target.checked }))}
            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-ink-300 rounded mt-0.5 cursor-pointer flex-shrink-0"
          />
          <label htmlFor="chk-medical-clearance" className="text-xs text-emerald-900 leading-relaxed font-medium select-none cursor-pointer">
            {isHi ? (
              <><strong>रक्तदान चिकित्सा घोषणा:</strong> मैं पुष्टि करता/करती हूँ कि मेरी आयु 18-65 वर्ष है, वजन ≥ 45 किलोग्राम है, और पिछले 6 महीनों में कोई बड़ी सर्जरी या रक्त आधान नहीं हुआ है।</>
            ) : (
              <><strong>RaktDaan Medical Declaration:</strong> I confirm that I am aged 18–65, weigh ≥ 45 kg, have hemoglobin levels &gt; 12.5g/dL, and have not had major surgery, tattoo, or blood transfusion in the past 6 months per National Blood Transfusion Council (NBTC) clinical guidelines.</>
            )}
          </label>
        </div>

        {/* Security / Privacy Assurance */}
        <div className="text-xs text-ink-700 bg-ink-50 p-4 rounded-2xl border border-ink-200 flex items-start gap-3">
          <Shield className="w-5 h-5 text-blood-600 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed font-medium">
            {isHi ? (
              <><strong>गोपनीयता गारंटी:</strong> हम आपका फोन नंबर कभी भी सार्वजनिक रूप से प्रदर्शित नहीं करते। आपकी संपर्क जानकारी केवल आपकी अनुमति के बाद ही साझा की जाती है।</>
            ) : (
              <><strong>Privacy Guarantee:</strong> We never list your phone number publicly. Receivers cannot search the registry directly. Your contact information is only shared after you explicitly approve an individual request.</>
            )}
          </p>
        </div>

        <button
          id="btn-donor-register"
          type="submit"
          disabled={loading}
          className="w-full py-4 px-6 btn-glow bg-blood-600 hover:bg-blood-700 text-white rounded-xl font-bold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? (isHi ? 'पंजीकरण हो रहा है...' : 'Registering...') : (isHi ? 'स्वयंसेवक रक्तदाता के रूप में पंजीकरण करें' : 'Register as Volunteer Donor')}
        </button>

        <div className="text-center text-xs text-ink-600 font-medium pt-2">
          {isHi ? 'पहले से पंजीकृत हैं? ' : 'Already registered? '}
          <button
            type="button"
            id="btn-navigate-login"
            onClick={onNavigateLogin}
            className="text-blood-600 hover:text-blood-700 font-bold hover:underline ml-1 cursor-pointer"
          >
            {isHi ? 'अपने डैशबोर्ड में लॉगिन करें' : 'Log in to your Dashboard'}
          </button>
        </div>
      </form>
    </div>
  );
}
