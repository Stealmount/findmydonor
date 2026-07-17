import React, { useState, useEffect, useRef } from 'react';
import { BloodRequest, BloodType, UrgencyLevel, lookupPincode, Requester, HOSPITAL_NETWORKS, BLOOD_COMPONENTS } from '../types';
import { supabase } from '../lib/supabase';
import { runMatchingEngine } from '../lib/matching';
import { authenticatedApi } from '../lib/api';
import { useLanguage } from '../lib/LanguageContext';
import { Heart, Landmark, Send, CheckCircle, ShieldAlert, Lock, User as UserIcon, Mail, Phone, ArrowRight, Sparkles, MapPin, Search, Activity, Stethoscope, Eye, Megaphone, Save, ArrowLeft, Clock, AlertTriangle } from 'lucide-react';
import { DELHI_PINCODES, DelhiPincode } from '../data/pincodes';

import { User } from '../types';

interface RequestFormProps {
  onSuccess: (trackingCode: string) => void;
  loggedInRequester?: Requester | null;
  loggedInDonor?: User | null;
  onLoginSuccess?: (requester: Requester) => void;
  onNavigate?: (view: any) => void;
}

export default function RequestForm({ onSuccess, loggedInRequester, loggedInDonor, onLoginSuccess, onNavigate }: RequestFormProps) {
  const { language } = useLanguage();
  const isHi = language === 'HI';
  
  // Quick Emergency SOS verification state
  const [sosOtp, setSosOtp] = useState('');
  const [sosVerificationToken, setSosVerificationToken] = useState('');
  const [sosSending, setSosSending] = useState(false);

  const [formData, setFormData] = useState({
    patient_name: '',
    patient_age: 35,
    patient_gender: 'Male' as 'Male' | 'Female' | 'Other',
    blood_type_needed: 'O+' as BloodType | 'ANY',
    component_needed: BLOOD_COMPONENTS[0],
    units_required: 1,
    hospital_name: HOSPITAL_NETWORKS[0],
    hospital_uhid: '',
    attending_doctor: '',
    hospital_pincode: '',
    hospital_area: '',
    hospital_city: '',
    urgency_level: 'urgent' as UrgencyLevel,
    requester_name: '',
    requester_email: '',
    requester_phone: '',
    additional_notes: '',
    showcase_opt_in: false,
    broadcast_to_simulator: false,
    share_contact_immediately: false,
  });

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
      hospital_pincode: suggestion.pincode,
      hospital_area: suggestion.area,
      hospital_city: cityMap[suggestion.district] ?? suggestion.zone,
    }));
    setLocationSearch(`${suggestion.area}, ${suggestion.district} (${suggestion.pincode})`);
    setShowSuggestions(false);
  };

  useEffect(() => {
    if (loggedInRequester) {
      setFormData(prev => ({
        ...prev,
        requester_name: loggedInRequester.full_name,
        requester_email: loggedInRequester.email,
        requester_phone: loggedInRequester.phone,
      }));
    }
  }, [loggedInRequester]);

  const [loading, setLoading] = useState(false);
  const [captchaChecked, setCaptchaChecked] = useState(false);
  const [error, setError] = useState('');
  // Step progression: 'form' → fill details, 'confirm' → preview, 'sos-verify' → Quick SOS OTP verification
  const [step, setStep] = useState<'form' | 'confirm' | 'sos-verify'>('form');

  // Quick Emergency SOS handlers
  const handleSendSosOtp = async () => {
    setError('');
    setSosSending(true);
    try {
      const normalizedPhone = formData.requester_phone.replace(/\D/g, '');
      if (normalizedPhone.length !== 10) {
        throw new Error('Please enter a valid 10-digit mobile number for WhatsApp verification.');
      }
      const res = await fetch('/api/wa/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone, purpose: 'sos' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send WhatsApp verification code.');
      setStep('sos-verify');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to send WhatsApp OTP.');
    } finally {
      setSosSending(false);
    }
  };

  const handleVerifySosOtpAndBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const normalizedPhone = formData.requester_phone.replace(/\D/g, '');
      const verifyRes = await fetch('/api/wa/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone, otp: sosOtp, purpose: 'sos' }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.verificationToken) {
        throw new Error(verifyData.error || 'Invalid OTP code.');
      }

      const token = verifyData.verificationToken;
      setSosVerificationToken(token);

      // Broadcast anonymous request via /api/sos/requests (plural route)
      const res = await fetch('/api/sos/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationToken: token,
          requester_name: formData.requester_name || formData.patient_name,
          requester_phone: normalizedPhone,
          patient_name: formData.patient_name,
          patient_age: formData.patient_age,
          patient_gender: formData.patient_gender,
          blood_type_needed: formData.blood_type_needed,
          component_needed: formData.component_needed,
          units_required: formData.units_required,
          hospital_name: formData.hospital_name,
          hospital_uhid: formData.hospital_uhid,
          attending_doctor: formData.attending_doctor,
          hospital_pincode: formData.hospital_pincode,
          hospital_area: formData.hospital_area,
          hospital_city: formData.hospital_city,
          hospital_state: formData.hospital_state,
          urgency_level: formData.urgency_level,
          additional_notes: formData.additional_notes,
          showcase_opt_in: formData.showcase_opt_in,
          share_contact_immediately: formData.share_contact_immediately,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to broadcast Quick Emergency SOS.');
      onSuccess(data.trackingCode);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to verify and broadcast SOS.');
    } finally {
      setLoading(false);
    }
  };

  // Self-match detection: Warn user if their requester email/phone matches their logged-in donor profile
  const isSelfMatch = !!(
    loggedInDonor && (
      (formData.requester_email && formData.requester_email.toLowerCase().trim() === loggedInDonor.email.toLowerCase().trim()) ||
      (formData.requester_phone && formData.requester_phone.replace(/\D/g, '') === loggedInDonor.phone.replace(/\D/g, ''))
    )
  );

  const handlePincodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pin = e.target.value.trim();
    setFormData(prev => ({ ...prev, hospital_pincode: pin }));

    if (pin.length === 6 && /^\d{6}$/.test(pin)) {
      const suggest = lookupPincode(pin);
      if (suggest) {
        setFormData(prev => ({
          ...prev,
          hospital_area: suggest.area,
          hospital_city: suggest.city,
        }));
      }
    }
  };

  // Step 1: Validate the form and move to confirmation preview
  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!captchaChecked) {
      setError('Please complete the verification checkbox to submit.');
      return;
    }
    if (!formData.patient_name || !formData.hospital_name || !formData.hospital_pincode) {
      setError('Please fill in all mandatory fields.');
      return;
    }
    if (Number(formData.patient_age) >= 120) {
      setError('Patient age must be less than 120.');
      return;
    }

    setStep('confirm');
  };

  // Step 2a: User confirmed → broadcast to donors
  const handleBroadcast = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await authenticatedApi<{ trackingCode: string }>('/api/requests', {
        ...formData,
        status: 'broadcasting',
      });
      onSuccess(response.trackingCode);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to broadcast: ${err.message || JSON.stringify(err)}`);
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  // Step 2b: User chose to save as draft — no notifications sent
  const handleSaveDraft = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await authenticatedApi<{ trackingCode: string }>('/api/requests', {
        ...formData,
        status: 'draft',
      });
      onSuccess(response.trackingCode);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to save draft: ${err.message || JSON.stringify(err)}`);
      setStep('form');
    } finally {
      setLoading(false);
    }
  };



  if (step === 'sos-verify') {
    return (
      <div id="request-sos-verify-container" className="max-w-md mx-auto rounded-3xl bg-white/95 backdrop-blur-xl border border-ink-200/80 shadow-premium-lg overflow-hidden my-8">
        <div className="bg-gradient-to-br from-ink-900 via-ink-950 to-black p-8 text-white text-center relative">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl blood-drop-gradient">
            <Phone className="w-6 h-6 text-white" />
          </div>
          <span className="inline-block px-3 py-1 rounded-full bg-blood-500/20 border border-blood-500/30 text-blood-400 text-[11px] font-mono font-bold uppercase tracking-widest mb-2">
            ⚡ Quick Emergency SOS Verification
          </span>
          <h2 className="text-xl font-bold tracking-tight text-white font-sans">
            Verify WhatsApp Number
          </h2>
          <p className="text-ink-300 text-xs mt-1">
            Enter the 6-digit verification code sent to +91 {formData.requester_phone} to broadcast your emergency request immediately.
          </p>
        </div>

        <form onSubmit={handleVerifySosOtpAndBroadcast} className="p-8 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-blood-50 text-blood-700 border border-blood-200 text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">6-Digit Verification Code *</label>
            <input
              id="inp-sos-otp"
              type="text"
              required
              maxLength={6}
              value={sosOtp}
              onChange={e => setSosOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              className="w-full h-12 px-4 rounded-xl border border-ink-200 bg-white text-center font-mono text-xl tracking-[0.5em] font-bold text-ink-900 focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
            />
          </div>

          <button
            id="btn-verify-sos-broadcast"
            type="submit"
            disabled={loading || sosOtp.length !== 6}
            className="w-full py-4 px-6 btn-glow bg-gradient-to-r from-blood-600 to-blood-700 hover:from-blood-500 hover:to-blood-600 text-white rounded-xl font-extrabold text-sm tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Broadcasting SOS...</span>
            ) : (<><Megaphone className="w-4 h-4" /> Verify & Broadcast Now</>)}
          </button>

          <div className="flex items-center justify-between pt-3 border-t border-ink-100 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setStep('confirm')}
              className="text-ink-600 hover:text-ink-900"
            >
              ← Back to Review
            </button>
            <button
              type="button"
              onClick={handleSendSosOtp}
              disabled={sosSending}
              className="text-blood-600 hover:underline disabled:opacity-50"
            >
              {sosSending ? 'Resending...' : 'Resend Code'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div id="request-form-container" className="max-w-2xl mx-auto rounded-3xl bg-white/95 backdrop-blur-xl border border-ink-200/80 shadow-premium-lg overflow-hidden my-6">
      {!loggedInRequester && !loggedInDonor && (
        <div className="bg-ink-900 border-b border-ink-800 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blood-500/20 text-blood-400 font-bold text-sm">⚡</span>
            <div>
              <p className="text-xs font-bold text-white leading-tight">Quick Emergency SOS Mode</p>
              <p className="text-[11px] text-ink-300">Broadcasting as public contact without an account (&lt; 45s).</p>
            </div>
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('auth-signin')}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/15 transition-all whitespace-nowrap"
            >
              Sign In / Create Account →
            </button>
          )}
        </div>
      )}
      <div className="bg-gradient-to-br from-ink-900 via-ink-950 to-black p-8 text-white text-center relative">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl blood-drop-gradient shadow-[0_8px_20px_-4px_rgba(244,63,87,0.5)]">
          <Heart className="w-6 h-6 text-white" />
        </div>
        <span className="inline-block px-3 py-1 rounded-full bg-blood-500/20 border border-blood-500/30 text-blood-400 text-[11px] font-mono font-bold uppercase tracking-widest mb-2">
          {isHi ? '⚡ त्वरित आपातकालीन अनुरोध (< 45s)' : '⚡ Fast Emergency Requisition (< 45s)'}
        </span>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
          {isHi ? 'आपातकालीन रक्त अनुरोध सबमिट करें' : 'Submit Emergency Blood Request'}
        </h2>
        <p className="text-ink-300 text-xs mt-1 max-w-md mx-auto">
          {isHi ? 'हम रक्तदान नैदानिक एवं अस्पताल विवरण एकत्र करते हैं ताकि हमारा मैचिंग इंजन केवल 100% संगत रक्तदाताओं को तुरंत सूचित करे।' : 'We collect exact RaktDaan clinical & hospital details so our matching engine alerts only 100% compatible, verified donors instantly.'}
        </p>
      </div>

      <form id="form-blood-request" onSubmit={handlePreview} className="p-8 space-y-6">
        {error && (
          <div id="req-error-alert" className="p-3.5 rounded-xl bg-blood-50 text-blood-700 border border-blood-200 text-xs font-semibold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Patient Details */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'रोगी का पूरा नाम *' : 'Patient Full Name *'}</label>
            <input
              id="inp-patient-name"
              type="text"
              required
              value={formData.patient_name}
              onChange={e => setFormData(prev => ({ ...prev, patient_name: e.target.value }))}
              className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-medium focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'रोगी की आयु *' : 'Patient Age *'}</label>
              <input
                id="inp-patient-age"
                type="number"
                min="0"
                max="119"
                required
                value={formData.patient_age}
                onChange={e => setFormData(prev => ({ ...prev, patient_age: parseInt(e.target.value) || 35 }))}
                className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-semibold focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">Gender *</label>
              <select
                id="sel-patient-gender"
                value={formData.patient_gender}
                onChange={e => setFormData(prev => ({ ...prev, patient_gender: e.target.value as any }))}
                className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-semibold focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">Blood Group *</label>
              <select
                id="sel-blood-needed"
                value={formData.blood_type_needed}
                onChange={e => setFormData(prev => ({ ...prev, blood_type_needed: e.target.value as BloodType | 'ANY' }))}
                className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-bold font-mono focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
              >
                {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
                <option value="ANY">ANY (Universal)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">Units Required *</label>
              <input
                id="inp-units"
                type="number"
                min="1"
                max="10"
                required
                value={formData.units_required}
                onChange={e => setFormData(prev => ({ ...prev, units_required: Number(e.target.value) }))}
                className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-bold focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
              />
            </div>
          </div>

          {/* Component Needed */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blood-600" />
              Required Component (RaktDaan Standard)
            </label>
            <select
              id="sel-component-needed"
              value={formData.component_needed}
              onChange={e => setFormData(prev => ({ ...prev, component_needed: e.target.value as any }))}
              className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-medium focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
            >
              {BLOOD_COMPONENTS.map(comp => (
                <option key={comp} value={comp}>{comp}</option>
              ))}
            </select>
          </div>

          {/* Hospital & Clinical Identifiers */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">Hospital Network / Institution *</label>
            <select
              id="sel-hospital-network"
              value={formData.hospital_name}
              onChange={e => setFormData(prev => ({ ...prev, hospital_name: e.target.value }))}
              className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-semibold focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
            >
              {HOSPITAL_NETWORKS.map(net => (
                <option key={net} value={net}>{net}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">Hospital IPD / UHID / Bed No. (Verification)</label>
            <input
              id="inp-hospital-uhid"
              type="text"
              value={formData.hospital_uhid}
              onChange={e => setFormData(prev => ({ ...prev, hospital_uhid: e.target.value }))}
              className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-mono focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-blood-600" />
              Attending Physician / Doctor Name (Optional)
            </label>
            <input
              id="inp-attending-doctor"
              type="text"
              value={formData.attending_doctor}
              onChange={e => setFormData(prev => ({ ...prev, attending_doctor: e.target.value }))}
              className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-medium focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
            />
          </div>

          {/* Quick Search Delhi Location */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-blood-600 animate-pulse" />
              Quick Location Autocomplete (Area or Pincode)
            </label>
            <div className="relative" ref={suggestionsRef}>
              <input
                id="inp-delhi-location-search"
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

          <div className="grid grid-cols-3 gap-4 md:col-span-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">Pincode *</label>
              <input
                id="inp-hospital-pin"
                type="text"
                maxLength={6}
                required
                value={formData.hospital_pincode}
                onChange={handlePincodeChange}
                className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-mono font-bold focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">Locality</label>
              <input
                id="inp-hospital-area"
                type="text"
                placeholder="Auto-suggested"
                value={formData.hospital_area}
                onChange={e => setFormData(prev => ({ ...prev, hospital_area: e.target.value }))}
                className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-medium focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">City</label>
              <input
                id="inp-hospital-city"
                type="text"
                placeholder="Auto-suggested"
                value={formData.hospital_city}
                onChange={e => setFormData(prev => ({ ...prev, hospital_city: e.target.value }))}
                className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-medium focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
              />
            </div>
          </div>

          {/* Urgency & Notes */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">Urgency Level</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'critical', label: 'CRITICAL (< 6 Hrs)', activeColor: 'bg-blood-600 text-white shadow-md' },
                { value: 'urgent', label: 'URGENT (< 24 Hrs)', activeColor: 'bg-ink-900 text-white shadow-md' },
                { value: 'planned', label: 'PLANNED / Scheduled', activeColor: 'bg-ink-100 text-ink-800' },
              ].map(opt => (
                <button
                  key={opt.value}
                  id={`btn-urgency-${opt.value}`}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, urgency_level: opt.value as UrgencyLevel }))}
                  className={`py-3 px-3 rounded-xl border border-ink-200 text-xs font-bold tracking-wide text-center transition-all cursor-pointer ${
                    formData.urgency_level === opt.value
                      ? `${opt.activeColor} border-transparent`
                      : 'bg-white text-ink-700 hover:bg-ink-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Requester Contact Details */}
          <div className="space-y-1.5 md:col-span-2 pt-4 border-t border-ink-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-800">Requester / Contact Person</h4>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">Requester Name</label>
            <input
              id="inp-req-name"
              type="text"
              value={formData.requester_name}
              onChange={e => setFormData(prev => ({ ...prev, requester_name: e.target.value }))}
              className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-medium focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">Contact Phone *</label>
            <input
              id="inp-req-phone"
              type="tel"
              required
              maxLength={10}
              value={formData.requester_phone}
              onChange={e => setFormData(prev => ({ ...prev, requester_phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
              className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-mono font-medium focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">Contact Email *</label>
            <input
              id="inp-req-email"
              type="email"
              required
              value={formData.requester_email}
              onChange={e => setFormData(prev => ({ ...prev, requester_email: e.target.value }))}
              className={`w-full h-11 px-4 rounded-xl border bg-white/80 text-sm text-ink-900 font-medium focus:ring-4 transition-all outline-none ${
                isSelfMatch
                  ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-500/10'
                  : 'border-ink-200 focus:border-blood-500 focus:ring-blood-500/10'
              }`}
            />
            {isSelfMatch && (
              <div className="mt-2 flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-amber-500 mt-0.5 shrink-0">⚠️</span>
                <p className="text-[11px] text-amber-800 font-medium leading-snug">
                  <strong>Testing Note:</strong> This email matches your Donor profile. Per RaktDaan's self-match prevention rule, you will <em>not</em> receive a donor match notification for your own request. Use a different email to test the live alert flow.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">Additional Notes</label>
            <textarea
              id="inp-req-notes"
              rows={3}
              value={formData.additional_notes}
              onChange={e => setFormData(prev => ({ ...prev, additional_notes: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-medium focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
            ></textarea>
            <div className="flex flex-col gap-2 mt-3">
              <label className="flex items-start gap-3 rounded-xl border border-ink-200 bg-ink-50/70 p-3 text-xs text-ink-700 cursor-pointer">
                <input
                  id="inp-request-share-contact"
                  type="checkbox"
                  checked={formData.share_contact_immediately}
                  onChange={e => setFormData(prev => ({ ...prev, share_contact_immediately: e.target.checked }))}
                  className="mt-0.5 rounded border-ink-300 text-blood-600 focus:ring-blood-500"
                />
                <span>
                  <strong>Share my contact details immediately:</strong> Allow matched donors to see my phone number in the initial WhatsApp SOS alert so they can contact me directly.
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-ink-200 bg-ink-50/70 p-3 text-xs text-ink-700 cursor-pointer">
                <input
                  id="inp-request-showcase-opt-in"
                  type="checkbox"
                  checked={formData.showcase_opt_in}
                  onChange={e => setFormData(prev => ({ ...prev, showcase_opt_in: e.target.checked }))}
                className="mt-0.5 accent-blood-600"
              />
              <span>Show this request in the public live feed using only blood group, city, urgency, and unit count. No patient, hospital, phone, or tracking details are shared.</span>
            </label>
              <label className="flex items-start gap-3 rounded-xl border border-blood-200 bg-blood-50/40 p-3 text-xs text-blood-900 cursor-pointer font-medium">
                <input
                  id="inp-request-broadcast-opt-in"
                  type="checkbox"
                  checked={formData.broadcast_to_simulator}
                  onChange={e => setFormData(prev => ({ ...prev, broadcast_to_simulator: e.target.checked }))}
                  className="mt-0.5 accent-blood-600 w-4 h-4"
                />
                <span>
                  <strong>Broadcast alert to Live Simulator feed:</strong> Enable real-time simulation alerts in the bottom-right Live Simulator console for testing and instant community broadcast.
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Captcha Verification */}
        <div className="p-4 bg-ink-50 rounded-2xl border border-ink-200 flex items-center gap-3">
          <input
            id="chk-captcha"
            type="checkbox"
            checked={captchaChecked}
            onChange={e => setCaptchaChecked(e.target.checked)}
            className="w-5 h-5 text-blood-600 rounded focus:ring-blood-500 border-ink-300"
          />
          <div className="text-xs text-ink-800 leading-tight font-medium">
            <p className="font-bold text-ink-900">Genuine Medical Request Verification</p>
            <p className="text-ink-500 text-[11px] mt-0.5">Spamming or posting fake requests is strictly prohibited and subject to account flagging.</p>
          </div>
        </div>

        <button
          id="btn-preview-request"
          type="submit"
          disabled={loading}
          className="w-full py-4 px-6 btn-glow bg-gradient-to-r from-blood-600 via-blood-700 to-blood-800 hover:from-blood-700 hover:to-blood-900 text-white rounded-xl font-extrabold text-sm tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Eye className="w-4 h-4 text-white" />
          <span>Preview Request Before Broadcasting</span>
        </button>
      </form>
    </div>
  );

  // ── Step 2: Confirmation Screen ─────────────────────────────────────────────
  if (step === 'confirm') {
    const urgencyColors: Record<string, string> = {
      critical: 'bg-blood-600 text-white',
      urgent: 'bg-amber-500 text-white',
      planned: 'bg-emerald-600 text-white',
    };
    return (
      <div id="request-confirm-container" className="max-w-2xl mx-auto rounded-3xl bg-white/95 backdrop-blur-xl border border-ink-200/80 shadow-premium-lg overflow-hidden my-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-ink-900 via-ink-950 to-black p-8 text-white text-center relative">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/20 border border-amber-400/30">
            <Eye className="w-6 h-6 text-amber-300" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">Review Before Broadcasting</h2>
          <p className="text-ink-300 text-xs mt-1 max-w-md mx-auto">
            Double-check all details. Once you broadcast, matched donors will be notified immediately.
          </p>
        </div>

        <div className="p-8 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-blood-50 text-blood-700 border border-blood-200 text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Summary Card */}
          <div className="rounded-2xl border border-ink-200/80 overflow-hidden">
            {/* Blood + Urgency header */}
            <div className="flex items-center justify-between bg-ink-950 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-3xl text-white tracking-tight">{formData.blood_type_needed}</span>
                <div>
                  <p className="text-xs text-ink-400 font-medium">Blood Group Needed</p>
                  <p className="text-sm text-ink-200 font-semibold">{formData.units_required} unit(s) · {formData.component_needed}</p>
                </div>
              </div>
              <span className={`text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${urgencyColors[formData.urgency_level]}`}>
                {formData.urgency_level}
              </span>
            </div>

            {/* Detail rows */}
            <div className="divide-y divide-ink-100">
              <div className="flex gap-3 items-start px-5 py-3.5">
                <Landmark className="w-4 h-4 text-ink-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Hospital</p>
                  <p className="text-sm font-semibold text-ink-900">{formData.hospital_name}</p>
                  <p className="text-xs text-ink-500">{formData.hospital_area && `${formData.hospital_area}, `}{formData.hospital_city} — {formData.hospital_pincode}</p>
                  {formData.attending_doctor && <p className="text-xs text-ink-400 mt-0.5">Dr. {formData.attending_doctor}</p>}
                </div>
              </div>

              <div className="flex gap-3 items-start px-5 py-3.5">
                <UserIcon className="w-4 h-4 text-ink-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Patient</p>
                  <p className="text-sm font-semibold text-ink-900">{formData.patient_name}</p>
                  <p className="text-xs text-ink-500">{formData.patient_age} yrs · {formData.patient_gender}</p>
                </div>
              </div>

              <div className="flex gap-3 items-start px-5 py-3.5">
                <Phone className="w-4 h-4 text-ink-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Requester Contact</p>
                  <p className="text-sm font-semibold text-ink-900">{formData.requester_name || formData.patient_name}</p>
                  <p className="text-xs text-ink-500">{formData.requester_phone}{formData.requester_email && ` · ${formData.requester_email}`}</p>
                </div>
              </div>

              {formData.additional_notes && (
                <div className="flex gap-3 items-start px-5 py-3.5">
                  <Activity className="w-4 h-4 text-ink-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Notes</p>
                    <p className="text-xs text-ink-700">{formData.additional_notes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Privacy note */}
          <div className="flex gap-2 items-start p-3.5 rounded-xl bg-ink-50 border border-ink-200 text-xs text-ink-600">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p>Once you broadcast, matching donors nearby will receive a WhatsApp message. This action cannot be undone. Choose <strong>"Save as Draft"</strong> if you need more time.</p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              id="btn-back-to-form"
              type="button"
              onClick={() => setStep('form')}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-ink-200 bg-white hover:bg-ink-50 text-ink-700 font-semibold text-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" /> Edit Details
            </button>

            <button
              id="btn-save-draft"
              type="button"
              onClick={handleSaveDraft}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-ink-300 bg-ink-100 hover:bg-ink-200 text-ink-800 font-semibold text-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-ink-700 border-t-transparent rounded-full animate-spin" />Saving...</span>
              ) : (<><Save className="w-4 h-4" /> Save as Draft</>)}
            </button>

            <button
              id="btn-broadcast-now"
              type="button"
              onClick={() => {
                if (loggedInRequester || loggedInDonor) {
                  handleBroadcast();
                } else {
                  handleSendSosOtp();
                }
              }}
              disabled={loading || sosSending}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 btn-glow bg-gradient-to-r from-blood-600 to-blood-700 hover:from-blood-500 hover:to-blood-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg cursor-pointer disabled:opacity-50"
            >
              {loading || sosSending ? (
                <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{sosSending ? 'Sending OTP...' : 'Broadcasting...'}</span>
              ) : (<><Megaphone className="w-4 h-4" /> {loggedInRequester || loggedInDonor ? 'Broadcast Now' : 'Send OTP & Broadcast Now'}</>)}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
