import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Building2, MapPin, Mail, Phone, FileText, ArrowRight, CheckCircle2, HeartHandshake, Droplet, Home, Clock } from 'lucide-react';
import { HospitalUser, InstitutionType } from '../../types';
import { useLanguage } from '../../lib/LanguageContext';

interface HospitalRegistrationProps {
  onRegister: (hospital: HospitalUser) => void;
  onBack: () => void;
}

export function HospitalRegistration({ onRegister, onBack }: HospitalRegistrationProps) {
  const { language, setLanguage } = useLanguage();
  const isHi = language === 'HI';

  const [institutionType, setInstitutionType] = useState<InstitutionType>('hospital');

  const typeConfig = {
    hospital: {
      icon: Building2,
      label: isHi ? 'अस्पताल' : 'Hospital',
      nameLabel: isHi ? 'अस्पताल का नाम' : 'Hospital Name',
      regLabel: isHi ? 'चिकित्सकीय पंजीकरण संख्या' : 'Clinical Registration No.',
      headerTitle: isHi ? 'अस्पताल पार्टनर' : 'Hospital Partner',
      headerSub: isHi ? 'रीयल-टाइम इन्वेंट्री और अनुमानित कमी के अलर्ट प्राप्त करें।' : 'Get real-time inventory and predictive shortage alerts.',
      btnText: isHi ? 'अस्पताल नेटवर्क से जुड़ें' : 'Join Hospital Network',
    },
    blood_bank: {
      icon: Droplet,
      label: isHi ? 'ब्लड बैंक' : 'Blood Bank',
      nameLabel: isHi ? 'ब्लड बैंक का नाम' : 'Blood Bank Name',
      regLabel: isHi ? 'लाइसेंस नंबर' : 'License Number',
      headerTitle: isHi ? 'ब्लड बैंक पार्टनर' : 'Blood Bank Partner',
      headerSub: isHi ? 'लाइव स्टॉक पब्लिश करें और आपातकालीन अनुरोध प्राप्त करें।' : 'Publish live stock levels and receive emergency requests.',
      btnText: isHi ? 'ब्लड बैंक नेटवर्क से जुड़ें' : 'Join Blood Bank Network',
    },
    ngo: {
      icon: HeartHandshake,
      label: isHi ? 'एनजीओ' : 'NGO',
      nameLabel: isHi ? 'संस्था का नाम' : 'Organization Name',
      regLabel: isHi ? 'एनजीओ पंजीकरण (दर्पण आईडी)' : 'NGO Registration (Darpan ID)',
      headerTitle: isHi ? 'एनजीओ पार्टनर' : 'NGO Partner',
      headerSub: isHi ? 'स्वैच्छिक रक्तदान शिविर आयोजित करें और समुदाय को जोड़ें।' : 'Organize voluntary camps and mobilize community donors.',
      btnText: isHi ? 'एनजीओ नेटवर्क से जुड़ें' : 'Join NGO Network',
    },
    other: {
      icon: Shield,
      label: isHi ? 'अन्य' : 'Other',
      nameLabel: isHi ? 'संस्था का नाम' : 'Organisation Name',
      regLabel: isHi ? 'पंजीकरण संख्या' : 'Registration Number',
      headerTitle: isHi ? 'संस्था पार्टनर' : 'Institution Partner',
      headerSub: isHi ? 'हमारे नेटवर्क से जुड़ें।' : 'Join our network.',
      btnText: isHi ? 'नेटवर्क से जुड़ें' : 'Join Network',
    },
  };

  const cfg = typeConfig[institutionType];

  const [formData, setFormData] = useState({
    hospital_name: '',
    registration_number: '',
    admin_name: '',
    email: '',
    phone: '',
    pincode: '',
    city: '',
    address: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setFormData(prev => ({ ...prev, [name]: value.replace(/\D/g, '').slice(0, 10) }));
      return;
    }
    if (name === 'pincode') {
      setFormData(prev => ({ ...prev, [name]: value.replace(/\D/g, '').slice(0, 6) }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const payload = {
        type: institutionType,
        org_name: formData.hospital_name,
        registration_number: formData.registration_number,
        contact_person: formData.admin_name,
        phone: `91${formData.phone}`,
        email: formData.email,
        address: formData.address || undefined,
        city: formData.city,
        pincode: formData.pincode,
      };

      const res = await fetch('/api/institutions/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        // 409 = already registered — tell them to sign in
        if (res.status === 409) {
          setError(
            data.verification_status === 'pending'
              ? (isHi ? 'यह नंबर पहले से पंजीकृत है और समीक्षा की प्रतीक्षा में है।' : 'This number is already registered and awaiting review.')
              : (isHi ? 'यह नंबर पहले से पंजीकृत है। साइन इन करें।' : 'This number is already registered. Please sign in.')
          );
        } else {
          setError(data.error || (isHi ? 'पंजीकरण विफल। पुनः प्रयास करें।' : 'Registration failed. Please try again.'));
        }
        setIsSubmitting(false);
        return;
      }

      // Success — show pending review screen (do NOT call onRegister yet)
      setIsSubmitting(false);
      setSuccess(true);

    } catch {
      setIsSubmitting(false);
      setError(isHi ? 'नेटवर्क त्रुटि। पुनः प्रयास करें।' : 'Network error. Please try again.');
    }
  };

  return (
    <div className="min-h-[85vh] py-12 px-4 sm:px-6 flex items-center justify-center relative overflow-hidden">
      {/* Ambient background blur circles */}
      <div className="absolute top-12 left-1/4 w-96 h-96 bg-blood-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-12 right-1/4 w-96 h-96 bg-ink-900/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top right language switcher */}
      <div className="absolute top-6 right-6 z-20 flex items-center rounded-full bg-white/90 p-0.5 border border-ink-200 shadow-md">
        <button
          onClick={() => setLanguage('EN')}
          className={`rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
            !isHi ? 'bg-blood-600 text-white shadow-sm' : 'text-ink-600 hover:text-ink-900'
          }`}
        >
          EN
        </button>
        <button
          onClick={() => setLanguage('HI')}
          className={`rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
            isHi ? 'bg-blood-600 text-white shadow-sm' : 'text-ink-600 hover:text-ink-900'
          }`}
        >
          HI
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl mx-auto relative z-10"
      >
        <button
          onClick={onBack}
          className="mb-6 text-ink-500 hover:text-ink-900 transition flex items-center text-sm font-bold uppercase tracking-wider cursor-pointer"
        >
          {isHi ? '← मुख्य पृष्ठ पर वापस जाएं' : '← Back to home'}
        </button>

        <div className="bg-white/80 backdrop-blur-2xl border border-ink-200/60 rounded-[28px] p-8 sm:p-12 shadow-premium-lg">
          {/* Institution Type Selector */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-ink-100/60 mb-8">
            {(['hospital', 'blood_bank', 'ngo'] as InstitutionType[]).map((type) => {
              const tc = typeConfig[type];
              const active = institutionType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setInstitutionType(type)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-[13px] font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-white text-ink-900 shadow-premium'
                      : 'text-ink-500 hover:text-ink-700'
                  }`}
                >
                  <tc.icon className={`h-4 w-4 ${active ? 'text-blood-600' : ''}`} />
                  {tc.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4 mb-8 border-b border-ink-100 pb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl blood-drop-gradient shadow-lg shadow-blood-600/30">
              <cfg.icon className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">
                  {cfg.headerTitle}
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blood-100 text-blood-700 uppercase tracking-wider">Beta</span>
              </div>
              <p className="text-ink-500 text-sm mt-1 font-medium">
                {cfg.headerSub}
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {!success ? (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                {error && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-medium">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Organisation Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-600 block">
                      {cfg.nameLabel}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Building2 className="h-4 w-4 text-ink-400" />
                      </div>
                      <input
                        type="text"
                        name="hospital_name"
                        required
                        value={formData.hospital_name}
                        onChange={handleChange}
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-ink-200 focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 font-medium text-sm transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Registration Number */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-600 block">
                      {cfg.regLabel}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <FileText className="h-4 w-4 text-ink-400" />
                      </div>
                      <input
                        type="text"
                        name="registration_number"
                        required
                        value={formData.registration_number}
                        onChange={handleChange}
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-ink-200 focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 font-medium text-sm transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Admin Contact Name */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-600 block">
                      {isHi ? 'प्रशासक संपर्क नाम' : 'Admin Contact Name'}
                    </label>
                    <input
                      type="text"
                      name="admin_name"
                      required
                      value={formData.admin_name}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-ink-200 focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 font-medium text-sm transition-all shadow-sm"
                    />
                  </div>

                  {/* Official Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-600 block">
                      {isHi ? 'आधिकारिक ईमेल' : 'Official Email'}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-ink-400" />
                      </div>
                      <input
                        type="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-ink-200 focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 font-medium text-sm transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-600 block">
                      {isHi ? 'व्हाट्सएप नंबर' : 'WhatsApp Number'}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Phone className="h-4 w-4 text-ink-400" />
                      </div>
                      <div className="absolute inset-y-0 left-10 flex items-center pointer-events-none">
                        <span className="text-sm text-ink-400 font-semibold">+91</span>
                      </div>
                      <input
                        type="tel"
                        name="phone"
                        required
                        maxLength={10}
                        placeholder="XXXXXXXXXX"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full pl-[4.5rem] pr-4 py-3 rounded-xl bg-white border border-ink-200 focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 font-medium text-sm transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Pincode */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-600 block">
                      {isHi ? 'पिनकोड' : 'Pincode'}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <MapPin className="h-4 w-4 text-ink-400" />
                      </div>
                      <input
                        type="text"
                        name="pincode"
                        required
                        maxLength={6}
                        value={formData.pincode}
                        onChange={handleChange}
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-ink-200 focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 font-medium text-sm transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  {/* City */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-600 block">
                      {isHi ? 'शहर' : 'City'}
                    </label>
                    <input
                      type="text"
                      name="city"
                      required
                      value={formData.city}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-ink-200 focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 font-medium text-sm transition-all shadow-sm"
                    />
                  </div>

                  {/* Address (optional) */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-600 block">
                      {isHi ? 'पता (वैकल्पिक)' : 'Address (Optional)'}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Home className="h-4 w-4 text-ink-400" />
                      </div>
                      <input
                        type="text"
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        placeholder={isHi ? 'गली, मोहल्ला, लैंडमार्क' : 'Street, locality, landmark'}
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-ink-200 focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 font-medium text-sm transition-all shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-14 rounded-xl bg-gradient-to-r from-blood-600 to-blood-700 hover:from-blood-500 hover:to-blood-600 text-white font-bold text-[15px] shadow-[0_8px_20px_-4px_rgba(244,63,87,0.4)] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 group"
                  >
                    {isSubmitting ? (
                      <span className="animate-pulse">{isHi ? 'आवेदन जमा हो रहा है...' : 'Submitting application...'}</span>
                    ) : (
                      <>
                        {cfg.btnText}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            ) : (
              /* ── Pending Review Success Screen ── */
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-10 text-center space-y-6"
              >
                {/* Icon */}
                <div className="mx-auto w-20 h-20 bg-amber-50 border-2 border-amber-100 rounded-full flex items-center justify-center shadow-sm">
                  <Clock className="h-10 w-10 text-amber-500" />
                </div>

                {/* Heading */}
                <div>
                  <h3 className="text-2xl font-extrabold text-ink-900 tracking-tight mb-2">
                    {isHi ? 'आवेदन जमा हो गया' : 'Application Submitted'}
                  </h3>
                  <p className="text-ink-500 font-medium text-sm leading-relaxed max-w-sm mx-auto">
                    {isHi
                      ? `हमारी टीम 1–2 कार्यदिवसों में आपके पंजीकरण की समीक्षा करेगी। अनुमोदन मिलने पर आपको +91 ${formData.phone} पर व्हाट्सएप अधिसूचना मिलेगी।`
                      : `Our team will review your registration within 1–2 business days. You'll receive a WhatsApp notification on +91 ${formData.phone} once approved.`
                    }
                  </p>
                </div>

                {/* Status badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  {isHi ? 'समीक्षा की प्रतीक्षा में' : 'Awaiting Admin Review'}
                </div>

                {/* What happens next */}
                <div className="text-left bg-ink-50/60 rounded-2xl p-5 space-y-3 border border-ink-100/60">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">
                    {isHi ? 'आगे क्या होगा' : 'What happens next'}
                  </p>
                  {[
                    isHi ? 'हमारी टीम आपके पंजीकरण की जांच करती है' : 'Our team verifies your registration number',
                    isHi ? 'आपको व्हाट्सएप पर अनुमोदन सूचना मिलती है' : 'You receive WhatsApp approval notification',
                    isHi ? 'अपने फोन नंबर से साइन इन करें' : 'Sign in with your phone number',
                    isHi ? 'अपने संस्थागत डैशबोर्ड तक पहुंचें' : 'Access your institutional dashboard',
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-blood-100 text-blood-600 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-sm text-ink-600 font-medium">{step}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={onBack}
                  className="inline-flex items-center gap-2 text-sm font-bold text-ink-500 hover:text-ink-900 transition cursor-pointer"
                >
                  {isHi ? '← मुख्य पृष्ठ पर वापस जाएं' : '← Return to home'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
