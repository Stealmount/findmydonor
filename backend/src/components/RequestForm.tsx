import React, { useState, useEffect, useRef } from 'react';
import { BloodRequest, BloodType, UrgencyLevel, lookupPincode, Requester, HOSPITAL_NETWORKS, BLOOD_COMPONENTS } from '../types';
import { authenticatedApi } from '../lib/api';
import { useLanguage } from '../lib/LanguageContext';
import { Heart, Landmark, Send, CheckCircle, ShieldAlert, Lock, User as UserIcon, Mail, Phone, ArrowRight, Sparkles, MapPin, Search, Activity, Stethoscope, Megaphone, Save, Clock, AlertTriangle } from 'lucide-react';
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
  const { language, setLanguage } = useLanguage();
  const isHi = language === 'HI';

  const [formData, setFormData] = useState({
    patient_name: '',
    patient_age: '' as unknown as number,
    patient_gender: '' as 'Male' | 'Female' | 'Other',
    blood_type_needed: '' as BloodType | 'ANY',
    component_needed: '' as any,
    units_required: '' as unknown as number,
    hospital_name: '',
    hospital_uhid: '',
    attending_doctor: '',
    hospital_pincode: '110058',
    hospital_area: 'Janakpuri',
    hospital_city: 'Delhi',
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
    const user = loggedInRequester || loggedInDonor;
    if (user) {
      setFormData(prev => ({
        ...prev,
        requester_name: prev.requester_name || user.full_name,
        requester_email: prev.requester_email || user.email || '',
        requester_phone: prev.requester_phone || user.phone || '',
      }));
    }
  }, [loggedInRequester, loggedInDonor]);

  const [loading, setLoading] = useState(false);
  const [captchaChecked, setCaptchaChecked] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

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

  // Validate and broadcast directly (single-step flow)
  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!captchaChecked) {
      setError('Please complete the verification checkbox to submit.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // ponytail: field-specific validation — collects missing fields, scrolls to first, names them all
    const requiredFields: { key: string; id: string; label: string }[] = [
      { key: 'patient_name', id: 'inp-patient-name', label: 'Patient Full Name' },
      { key: 'patient_age', id: 'inp-patient-age', label: 'Patient Age' },
      { key: 'patient_gender', id: 'sel-patient-gender', label: 'Gender' },
      { key: 'blood_type_needed', id: 'sel-blood-needed', label: 'Blood Group' },
      { key: 'component_needed', id: 'sel-component-needed', label: 'Required Component' },
      { key: 'units_required', id: 'inp-units', label: 'Units Required' },
      { key: 'hospital_name', id: 'sel-hospital-network', label: 'Hospital Network' },
      { key: 'hospital_pincode', id: 'inp-hospital-pin', label: 'Pincode' },
      { key: 'hospital_area', id: 'inp-hospital-area', label: 'Locality' },
      { key: 'hospital_city', id: 'inp-hospital-city', label: 'City' },
    ];

    const missing = requiredFields.filter(f => !formData[f.key as keyof typeof formData]);
    if (missing.length > 0) {
      const errMap: Record<string, boolean> = {};
      missing.forEach(f => { errMap[f.id] = true; });
      setFieldErrors(errMap);
      const names = missing.map(f => f.label).join(', ');
      setError(`Please fill the following required fields: ${names}.`);
      const firstEl = document.getElementById(missing[0].id);
      if (firstEl) {
        firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstEl.focus();
      }
      return;
    }

    if (Number(formData.patient_age) >= 120 || Number(formData.patient_age) <= 0) {
      setError('Please enter a valid patient age between 1 and 120.');
      setFieldErrors({ 'inp-patient-age': true });
      const el = document.getElementById('inp-patient-age');
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
      return;
    }
    const cleanPhone = formData.requester_phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number for Contact Phone.');
      setFieldErrors({ 'inp-req-phone': true });
      const el = document.getElementById('inp-req-phone');
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
      return;
    }

    // Auth gate — must be logged in to broadcast
    if (!loggedInRequester && !loggedInDonor) {
      if (onNavigate) {
        onNavigate('requester-register');
      } else {
        setError('Please sign up or sign in to broadcast blood requests.');
      }
      return;
    }

    // All valid — broadcast immediately (no confirm step)
    handleBroadcast();
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
    } finally {
      setLoading(false);
    }
  };



  return (
    <div id="request-form-container" className="max-w-2xl mx-auto rounded-3xl bg-white/95 backdrop-blur-xl border border-ink-200/80 shadow-premium-lg overflow-hidden my-6">
      {!loggedInRequester && !loggedInDonor && (
        <div className="bg-gradient-to-r from-ink-900 via-ink-950 to-blood-950 border-b border-blood-500/30 p-6 sm:p-7 text-white relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-blood-600/15 blur-2xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blood-500/20 border border-blood-500/30 text-blood-400 font-bold text-lg shrink-0">
                <ShieldAlert className="w-5 h-5 text-blood-400" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-white tracking-tight leading-snug">
                  {isHi ? 'रक्त मांगने के लिए खाता सत्यापन आवश्यक है' : 'Account Verification Required to Request Blood'}
                </p>
                <p className="text-xs text-ink-300 mt-0.5 leading-relaxed">
                  {isHi ? 'रोगी की सुरक्षा के लिए और रीयल-टाइम ट्रैकिंग सक्षम करने के लिए, सभी अनुरोधकर्ताओं को पहले साइन अप या साइन इन करना होगा।' : 'To protect patient safety and enable real-time tracking, all requesters must sign up or sign in first.'}
                </p>
              </div>
            </div>
            {onNavigate && (
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => onNavigate('requester-register')}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl btn-glow bg-blood-600 hover:bg-blood-700 text-white font-bold text-xs shadow-md transition-all whitespace-nowrap cursor-pointer"
                >
                  {isHi ? 'पंजीकरण करें →' : 'Sign Up to Request →'}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('auth-signin')}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/15 transition-all whitespace-nowrap cursor-pointer"
                >
                  {isHi ? 'साइन इन करें' : 'Sign In'}
                </button>
              </div>
            )}
          </div>
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
          {isHi ? 'हम रक्तदान नैदानिक एवं अस्पताल विवरण एकत्र करते हैं ताकि हमारा मैचिंग इंजन केवल 100% संगत रक्तदाताओं को तुरंत सूचित करे।' : 'We collect exact FindMyDonor™ clinical & hospital details so our matching engine alerts only 100% compatible, verified donors instantly.'}
        </p>
      </div>

      <form id="form-blood-request" onSubmit={handlePreview} className="p-8 space-y-6" noValidate>
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
              className={`w-full h-11 px-4 rounded-xl border ${fieldErrors['inp-patient-name'] ? 'border-blood-500' : 'border-ink-200'} bg-white/80 text-sm text-ink-900 font-medium focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'रोगी की आयु *' : 'Patient Age *'}</label>
              <input
                id="inp-patient-age"
                type="number"
                min="1"
                max="119"
                placeholder={isHi ? 'आयु दर्ज करें' : 'Enter age'}
                required
                value={formData.patient_age === '' as any ? '' : formData.patient_age}
                onChange={e => setFormData(prev => ({ ...prev, patient_age: e.target.value === '' ? ('' as any) : parseInt(e.target.value) }))}
                className={`w-full h-11 px-4 rounded-xl border ${fieldErrors['inp-patient-age'] ? 'border-blood-500' : 'border-ink-200'} bg-white/80 text-sm text-ink-900 font-semibold focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none`}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'लिंग *' : 'Gender *'}</label>
              <select
                id="sel-patient-gender"
                required
                value={formData.patient_gender}
                onChange={e => setFormData(prev => ({ ...prev, patient_gender: e.target.value as any }))}
                className={`w-full h-11 px-4 rounded-xl border ${fieldErrors['sel-patient-gender'] ? 'border-blood-500' : 'border-ink-200'} bg-white/80 text-sm text-ink-900 font-semibold focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none`}
              >
                <option value="" disabled>{isHi ? '-- चयन करें --' : '-- Select Gender --'}</option>
                <option value="Male">{isHi ? 'पुरुष' : 'Male'}</option>
                <option value="Female">{isHi ? 'महिला' : 'Female'}</option>
                <option value="Other">{isHi ? 'अन्य' : 'Other'}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'रक्त समूह *' : 'Blood Group *'}</label>
              <select
                id="sel-blood-needed"
                required
                value={formData.blood_type_needed}
                onChange={e => setFormData(prev => ({ ...prev, blood_type_needed: e.target.value as BloodType | 'ANY' }))}
                className={`w-full h-11 px-4 rounded-xl border ${fieldErrors['sel-blood-needed'] ? 'border-blood-500' : 'border-ink-200'} bg-white/80 text-sm text-ink-900 font-bold font-mono focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none`}
              >
                <option value="" disabled>{isHi ? '-- चयन करें --' : '-- Select Blood Group --'}</option>
                {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
                <option value="ANY">ANY (Universal)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'आवश्यक यूनिट *' : 'Units Required *'}</label>
              <input
                id="inp-units"
                type="number"
                min="1"
                max="10"
                placeholder={isHi ? 'यूनिट' : 'Units'}
                required
                value={formData.units_required === '' as any ? '' : formData.units_required}
                onChange={e => setFormData(prev => ({ ...prev, units_required: e.target.value === '' ? ('' as any) : Number(e.target.value) }))}
                className={`w-full h-11 px-4 rounded-xl border ${fieldErrors['inp-units'] ? 'border-blood-500' : 'border-ink-200'} bg-white/80 text-sm text-ink-900 font-bold focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none`}
              />
            </div>
          </div>

          {/* Component Needed */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blood-600" />
              {isHi ? 'आवश्यक घटक (FindMyDonor™ मानक) *' : 'Required Component (FindMyDonor™ Standard) *'}
            </label>
            <select
              id="sel-component-needed"
              required
              value={formData.component_needed}
              onChange={e => setFormData(prev => ({ ...prev, component_needed: e.target.value as any }))}
              className={`w-full h-11 px-4 rounded-xl border ${fieldErrors['sel-component-needed'] ? 'border-blood-500' : 'border-ink-200'} bg-white/80 text-sm text-ink-900 font-medium focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none`}
            >
              <option value="" disabled>{isHi ? '-- चयन करें --' : '-- Select Component --'}</option>
              {BLOOD_COMPONENTS.map(comp => (
                <option key={comp} value={comp}>{comp}</option>
              ))}
            </select>
          </div>

          {/* Hospital & Clinical Identifiers */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'अस्पताल नेटवर्क / संस्था *' : 'Hospital Network / Institution *'}</label>
            <select
              id="sel-hospital-network"
              required
              value={formData.hospital_name}
              onChange={e => setFormData(prev => ({ ...prev, hospital_name: e.target.value }))}
              className={`w-full h-11 px-4 rounded-xl border ${fieldErrors['sel-hospital-network'] ? 'border-blood-500' : 'border-ink-200'} bg-white/80 text-sm text-ink-900 font-semibold focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none`}
            >
              <option value="" disabled>{isHi ? '-- चयन करें --' : '-- Select Hospital / Network --'}</option>
              {HOSPITAL_NETWORKS.map(net => (
                <option key={net} value={net}>{net}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'अस्पताल IPD / UHID / बेड नंबर (सत्यापन)' : 'Hospital IPD / UHID / Bed No. (Verification)'}</label>
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
              {isHi ? 'उपस्थित चिकित्सक / डॉक्टर का नाम (वैकल्पिक)' : 'Attending Physician / Doctor Name (Optional)'}
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
              {isHi ? 'त्वरित स्थान खोज (क्षेत्र या पिनकोड)' : 'Quick Location Autocomplete (Area or Pincode)'}
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
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'पिनकोड *' : 'Pincode *'}</label>
              <input
                id="inp-hospital-pin"
                type="text"
                maxLength={6}
                required
                value={formData.hospital_pincode}
                onChange={handlePincodeChange}
                className={`w-full h-11 px-4 rounded-xl border ${fieldErrors['inp-hospital-pin'] ? 'border-blood-500' : 'border-ink-200'} bg-white/80 text-sm text-ink-900 font-mono font-bold focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none`}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'इलाका' : 'Locality'}</label>
              <input
                id="inp-hospital-area"
                type="text"
                placeholder={isHi ? 'स्वतः सुझाव' : 'Auto-suggested'}
                value={formData.hospital_area}
                onChange={e => setFormData(prev => ({ ...prev, hospital_area: e.target.value }))}
                className={`w-full h-11 px-4 rounded-xl border ${fieldErrors['inp-hospital-area'] ? 'border-blood-500' : 'border-ink-200'} bg-white/80 text-sm text-ink-900 font-medium focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none`}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'शहर' : 'City'}</label>
              <input
                id="inp-hospital-city"
                type="text"
                placeholder="Auto-suggested"
                value={formData.hospital_city}
                onChange={e => setFormData(prev => ({ ...prev, hospital_city: e.target.value }))}
                className={`w-full h-11 px-4 rounded-xl border ${fieldErrors['inp-hospital-city'] ? 'border-blood-500' : 'border-ink-200'} bg-white/80 text-sm text-ink-900 font-medium focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none`}
              />
            </div>
          </div>

          {/* Urgency & Notes */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'आपातकाल स्तर *' : 'Urgency Level *'}</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'critical', label: isHi ? 'अत्यावश्यक (< 6 घंटे)' : 'CRITICAL (< 6 Hrs)', activeColor: 'bg-blood-600 text-white shadow-md' },
                { value: 'urgent', label: isHi ? 'जरूरी (< 24 घंटे)' : 'URGENT (< 24 Hrs)', activeColor: 'bg-ink-900 text-white shadow-md' },
                { value: 'planned', label: isHi ? 'नियोजित / अनुसूचित' : 'PLANNED / Scheduled', activeColor: 'bg-ink-100 text-ink-800' },
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
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-800">{isHi ? 'अनुरोधकर्ता / संपर्क व्यक्ति' : 'Requester / Contact Person'}</h4>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'अनुरोधकर्ता का नाम' : 'Requester Name'}</label>
            <input
              id="inp-req-name"
              type="text"
              value={formData.requester_name}
              onChange={e => setFormData(prev => ({ ...prev, requester_name: e.target.value }))}
              className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/80 text-sm text-ink-900 font-medium focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'संपर्क फोन *' : 'Contact Phone *'}</label>
            <input
              id="inp-req-phone"
              type="tel"
              required
              maxLength={10}
              value={formData.requester_phone}
              onChange={e => setFormData(prev => ({ ...prev, requester_phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
              className={`w-full h-11 px-4 rounded-xl border ${fieldErrors['inp-req-phone'] ? 'border-blood-500' : 'border-ink-200'} bg-white/80 text-sm text-ink-900 font-mono font-medium focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 transition-all outline-none`}
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'संपर्क ईमेल *' : 'Contact Email *'}</label>
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
                  <strong>Testing Note:</strong> This email matches your Donor profile. Per FindMyDonor™'s self-match prevention rule, you will <em>not</em> receive a donor match notification for your own request. Use a different email to test the live alert flow.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'अतिरिक्त नोट्स' : 'Additional Notes'}</label>
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
                  {isHi ? <><strong>मेरी संपर्क जानकारी तुरंत साझा करें:</strong> मिले हुए रक्तदाताओं को WhatsApp SOS अलर्ट में मेरा फोन नंबर दिखाएं।</> : <><strong>Share my contact details immediately:</strong> Allow matched donors to see my phone number in the initial WhatsApp SOS alert so they can contact me directly.</>}
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
                <span>{isHi ? 'इस अनुरोध को सार्वजनिक लाइव फ़ीड में केवल रक्त समूह, शहर, आपात स्तर और यूनिट काउंट के साथ दिखाएं।' : 'Show this request in the public live feed using only blood group, city, urgency, and unit count. No patient, hospital, phone, or tracking details are shared.'}</span>
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
                  {isHi ? <><strong>लाइव सिमुलेटर फ़ीड में अलर्ट भेजें:</strong> परीक्षण और सामुदायिक प्रसारण के लिए रीयल-टाइम सिमुलेशन अलर्ट सक्रिय करें।</> : <><strong>Broadcast alert to Live Simulator feed:</strong> Enable real-time simulation alerts in the Live Simulator console for testing and instant community broadcast.</>}
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
            <p className="font-bold text-ink-900">{isHi ? 'वास्तविक चिकित्सा अनुरोध सत्यापन' : 'Genuine Medical Request Verification'}</p>
            <p className="text-ink-500 text-[11px] mt-0.5">{isHi ? 'स्पैमिंग या नकली अनुरोध पोस्ट करना सख्ती से प्रतिबंधित है।' : 'Spamming or posting fake requests is strictly prohibited and subject to account flagging.'}</p>
          </div>
        </div>

        {error && (
          <div className="p-3.5 mt-4 rounded-xl bg-blood-50 text-blood-700 border border-blood-200 text-xs font-semibold flex items-start gap-2">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span><strong>Validation Error:</strong> {error}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            id="btn-broadcast-now"
            type="submit"
            disabled={loading}
            className="flex-1 py-4 px-6 btn-glow bg-gradient-to-r from-blood-600 via-blood-700 to-blood-800 hover:from-blood-700 hover:to-blood-900 text-white rounded-xl font-extrabold text-sm tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Broadcasting...</span>
            ) : (
              <>
                <Megaphone className="w-4 h-4 text-white" />
                <span>{isHi ? 'अनुरोध अभी प्रसारित करें' : 'Broadcast Request Now'}</span>
              </>
            )}
          </button>
          <button
            id="btn-save-draft"
            type="button"
            onClick={() => {
              if (loggedInRequester || loggedInDonor) {
                handleSaveDraft();
              } else if (onNavigate) {
                onNavigate('requester-register');
              }
            }}
            disabled={loading}
            className="sm:w-auto py-4 px-6 rounded-xl border border-ink-200 bg-white hover:bg-ink-50 text-ink-700 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isHi ? 'ड्राफ्ट सहेजें' : 'Save as Draft'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
