import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Building2, MapPin, Mail, Phone, FileText, ArrowRight, CheckCircle2 } from 'lucide-react';
import { HospitalUser } from '../../types';
import { useLanguage } from '../../lib/LanguageContext';

interface HospitalRegistrationProps {
  onRegister: (hospital: HospitalUser) => void;
  onBack: () => void;
}

export function HospitalRegistration({ onRegister, onBack }: HospitalRegistrationProps) {
  const { language } = useLanguage();
  const isHi = language === 'HI';

  const [formData, setFormData] = useState({
    hospital_name: '',
    registration_number: '',
    admin_name: '',
    email: '',
    phone: '',
    pincode: '',
    city: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setFormData(prev => ({ ...prev, [name]: value.replace(/\D/g, '').slice(0, 10) }));
      return;
    }
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Mock save delay
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccess(true);
      
      const newHospital: HospitalUser = {
        id: 'hosp_' + Date.now(),
        ...formData,
        status: 'verified', // Auto-verify for demo
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      setTimeout(() => {
        onRegister(newHospital);
      }, 1500);
    }, 1200);
  };

  return (
    <div className="min-h-[85vh] py-12 px-4 sm:px-6 flex items-center justify-center relative overflow-hidden">
      {/* Ambient background blur circles */}
      <div className="absolute top-12 left-1/4 w-96 h-96 bg-blood-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-12 right-1/4 w-96 h-96 bg-ink-900/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl mx-auto relative z-10"
      >
        <button
          onClick={onBack}
          className="mb-6 text-ink-500 hover:text-ink-900 transition flex items-center text-sm font-bold uppercase tracking-wider"
        >
          {isHi ? '← मुख्य पृष्ठ पर वापस जाएं' : '← Back to home'}
        </button>

        <div className="bg-white/80 backdrop-blur-2xl border border-ink-200/60 rounded-[28px] p-8 sm:p-12 shadow-premium-lg">
          <div className="flex items-center gap-4 mb-8 border-b border-ink-100 pb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl blood-drop-gradient shadow-lg shadow-blood-600/30">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">
                  {isHi ? 'अस्पताल पार्टनर' : 'Hospital Partner'}
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blood-100 text-blood-700 uppercase tracking-wider">Beta</span>
              </div>
              <p className="text-ink-500 text-sm mt-1 font-medium">
                {isHi ? 'रीयल-टाइम इन्वेंट्री और अनुमानित कमी के अलर्ट प्राप्त करें।' : 'Get real-time inventory and predictive shortage alerts.'}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-600 block">
                      {isHi ? 'अस्पताल/ब्लड बैंक का नाम' : 'Hospital/Blood Bank Name'}
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

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-600 block">
                      {isHi ? 'चिकित्सकीय पंजीकरण संख्या' : 'Clinical Registration No.'}
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

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-600 block">
                      {isHi ? 'प्रशासक संपर्क नाम' : 'Admin Contact Name'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        name="admin_name"
                        required
                        value={formData.admin_name}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl bg-white border border-ink-200 focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 font-medium text-sm transition-all shadow-sm"
                      />
                    </div>
                  </div>

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

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-600 block">
                      {isHi ? 'फ़ोन नंबर' : 'Phone Number'}
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      maxLength={10}
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-ink-200 focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 font-medium text-sm transition-all shadow-sm"
                    />
                  </div>

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
                        value={formData.pincode}
                        onChange={handleChange}
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-ink-200 focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 font-medium text-sm transition-all shadow-sm"
                      />
                    </div>
                  </div>

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
                </div>

                <div className="pt-6">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-14 rounded-xl bg-gradient-to-r from-blood-600 to-blood-700 hover:from-blood-500 hover:to-blood-600 text-white font-bold text-[15px] shadow-[0_8px_20px_-4px_rgba(244,63,87,0.4)] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 group"
                  >
                    {isSubmitting ? (
                      <span className="animate-pulse">{isHi ? 'क्रेडेंशियल्स सत्यापित किए जा रहे हैं...' : 'Verifying credentials...'}</span>
                    ) : (
                      <>
                        {isHi ? 'अस्पताल नेटवर्क से जुड़ें' : 'Join Hospital Network'}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 text-center"
              >
                <div className="mx-auto w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <h3 className="text-2xl font-extrabold text-ink-900 mb-2 tracking-tight">
                  {isHi ? 'अस्पताल सत्यापित हुआ' : 'Hospital Verified'}
                </h3>
                <p className="text-ink-500 font-medium">
                  {isHi ? 'कंट्रोल टावर डैशबोर्ड प्रारंभ किया जा रहा है...' : 'Initializing your control tower dashboard...'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
