import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Building2, MapPin, Mail, Phone, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { HospitalUser } from '../../types';
import { useLanguage } from '../../lib/LanguageContext';
import { authenticatedApi } from '../../lib/api';

interface HospitalRegistrationProps {
  onRegister: (hospital: HospitalUser) => void;
  onBack: () => void;
}

export function HospitalRegistration({ onRegister, onBack }: HospitalRegistrationProps) {
  const { language, setLanguage } = useLanguage();
  const isHi = language === 'HI';

  const [formData, setFormData] = useState({
    institution_name: '',
    institution_type: 'hospital' as 'hospital' | 'blood_bank' | 'camp',
    pincode: '',
    city: '',
    contact_person: '',
    contact_phone: '',
    email: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'contact_phone') {
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
      await authenticatedApi('/api/hospital/register', {
        institution_name: formData.institution_name,
        institution_type: formData.institution_type,
        pincode: formData.pincode,
        city: formData.city,
        contact_person: formData.contact_person,
        contact_phone: `91${formData.contact_phone}`,
        email: formData.email,
      }, 'POST');

      setIsSubmitting(false);
      setSuccess(true);
    } catch {
      setIsSubmitting(false);
      setError(isHi ? 'पंजीकरण विफल। पुनः प्रयास करें।' : 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="min-h-[85vh] py-12 px-4 sm:px-6 flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-6 right-6 z-20 flex items-center rounded-full bg-white p-0.5 border border-ink-200">
        <button onClick={() => setLanguage('EN')}
          className={`rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer ${!isHi ? 'bg-blood-600 text-white' : 'text-ink-600 hover:text-ink-900'}`}>
          EN
        </button>
        <button onClick={() => setLanguage('HI')}
          className={`rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer ${isHi ? 'bg-blood-600 text-white' : 'text-ink-600 hover:text-ink-900'}`}>
          HI
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg mx-auto relative z-10">
        <button onClick={onBack}
          className="mb-6 text-ink-500 hover:text-ink-900 transition flex items-center text-sm font-bold uppercase tracking-wider cursor-pointer">
          {isHi ? '← मुख्य पृष्ठ' : '← Back to home'}
        </button>

        <div className="rounded-2xl bg-white border border-ink-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blood-50 border border-blood-200 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blood-600" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-ink-900 tracking-tight">
                {isHi ? 'संस्था पंजीकरण' : 'Register Institution'}
              </h1>
              <p className="text-[11px] text-ink-400 mt-0.5">
                {isHi ? 'अपनी संस्था को नेटवर्क से जोड़ें' : 'Join the RaktDaan network'}
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {!success ? (
              <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink-500 block">
                    {isHi ? 'संस्था का नाम' : 'Institution Name'}
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                    <input type="text" name="institution_name" required value={formData.institution_name}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-ink-200 text-ink-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blood-500 transition"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink-500 block">
                    {isHi ? 'प्रकार' : 'Type'}
                  </label>
                  <select name="institution_type" value={formData.institution_type} onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-white border border-ink-200 text-ink-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blood-500 transition appearance-none cursor-pointer">
                    <option value="hospital">{isHi ? 'अस्पताल' : 'Hospital'}</option>
                    <option value="blood_bank">{isHi ? 'ब्लड बैंक' : 'Blood Bank'}</option>
                    <option value="camp">{isHi ? 'शिविर' : 'Camp'}</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-500 block">
                      {isHi ? 'पिनकोड' : 'Pincode'}
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                      <input type="text" name="pincode" required maxLength={6} value={formData.pincode}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-ink-200 text-ink-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blood-500 transition"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-500 block">
                      {isHi ? 'शहर' : 'City'}
                    </label>
                    <input type="text" name="city" required value={formData.city}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-ink-200 text-ink-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blood-500 transition"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink-500 block">
                    {isHi ? 'संपर्क व्यक्ति' : 'Contact Person'}
                  </label>
                  <input type="text" name="contact_person" required value={formData.contact_person}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-white border border-ink-200 text-ink-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blood-500 transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink-500 block">
                    {isHi ? 'संपर्क फ़ोन' : 'Contact Phone'}
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                    <span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-ink-400 font-semibold">+91</span>
                    <input type="tel" name="contact_phone" required maxLength={10} placeholder="XXXXXXXXXX"
                      value={formData.contact_phone} onChange={handleChange}
                      className="w-full pl-[4.5rem] pr-4 py-3 rounded-xl bg-white border border-ink-200 text-ink-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blood-500 transition"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink-500 block">
                    {isHi ? 'ईमेल' : 'Email'}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                    <input type="email" name="email" required value={formData.email}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-ink-200 text-ink-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blood-500 transition"
                    />
                  </div>
                </div>

                <button type="submit" disabled={isSubmitting}
                  className="w-full rounded-xl bg-blood-600 hover:bg-blood-700 px-6 py-3.5 text-sm font-bold text-white transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                  {isSubmitting ? (
                    <span className="animate-pulse">{isHi ? 'जमा हो रहा है...' : 'Submitting...'}</span>
                  ) : (
                    <>
                      {isHi ? 'संस्था पंजीकृत करें' : 'Register Institution'}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="py-8 text-center space-y-5">
                <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
                  <Clock className="h-8 w-8 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-ink-900 tracking-tight mb-2">
                    {isHi ? 'पंजीकरण जमा हो गया' : 'Registration Submitted'}
                  </h3>
                  <p className="text-ink-500 text-sm leading-relaxed max-w-sm mx-auto">
                    {isHi
                      ? 'आपकी संस्था का पंजीकरण हमारी टीम द्वारा सत्यापित किया जाएगा। अनुमोदन के बाद आपको ईमेल पर सूचना मिलेगी।'
                      : "Your institution will be verified by our admin team. You'll receive an email once approved."}
                  </p>
                </div>
                <button onClick={onBack}
                  className="text-sm font-bold text-ink-500 hover:text-ink-900 transition cursor-pointer">
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
