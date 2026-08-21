import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { authenticatedApi } from '../../lib/api';
import { useLanguage } from '../../lib/LanguageContext';

interface ProfileCompletionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  existingData?: {
    blood_group?: string;
    weight_kg?: number;
    pincode?: string;
    area?: string;
    city?: string;
    whatsapp_phone?: string;
  };
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function ProfileCompletionPopup({ isOpen, onClose, existingData }: ProfileCompletionPopupProps) {
  const { language } = useLanguage();
  const isHi = language === 'HI';

  const [bloodGroup, setBloodGroup] = useState(existingData?.blood_group || '');
  const [weightKg, setWeightKg] = useState(existingData?.weight_kg ? String(existingData.weight_kg) : '');
  const [pincode, setPincode] = useState(existingData?.pincode || '');
  const [area, setArea] = useState(existingData?.area || '');
  const [city, setCity] = useState(existingData?.city || '');
  const [whatsappPhone, setWhatsappPhone] = useState(
    existingData?.whatsapp_phone
      ? existingData.whatsapp_phone.replace(/^91/, '').replace(/\D/g, '').slice(0, 10)
      : ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingData) {
      setBloodGroup(existingData.blood_group || '');
      setWeightKg(existingData.weight_kg ? String(existingData.weight_kg) : '');
      setPincode(existingData.pincode || '');
      setArea(existingData.area || '');
      setCity(existingData.city || '');
      setWhatsappPhone(
        existingData.whatsapp_phone
          ? existingData.whatsapp_phone.replace(/^91/, '').replace(/\D/g, '').slice(0, 10)
          : ''
      );
    }
  }, [existingData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!bloodGroup) {
      setError(isHi ? 'कृपया ब्लड ग्रुप चुनें।' : 'Please select a blood group.');
      return;
    }
    if (pincode && !/^\d{6}$/.test(pincode)) {
      setError(isHi ? 'पिनकोड 6 अंकों का होना चाहिए।' : 'Pincode must be exactly 6 digits.');
      return;
    }
    if (whatsappPhone && !/^\d{10}$/.test(whatsappPhone)) {
      setError(isHi ? 'WhatsApp नंबर 10 अंकों का होना चाहिए।' : 'WhatsApp number must be exactly 10 digits.');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (bloodGroup) payload.blood_group = bloodGroup;
      if (weightKg) payload.weight_kg = Number(weightKg);
      if (pincode) payload.pincode = pincode;
      if (area) payload.area = area;
      if (city) payload.city = city;
      if (whatsappPhone) payload.whatsapp_phone = '91' + whatsappPhone;

      await authenticatedApi('/api/donor/profile', payload, 'POST');
      onClose();
    } catch (err: any) {
      setError(err.message || (isHi ? 'सेव करने में विफल। कृपया पुनः प्रयास करें।' : 'Failed to save. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isHi ? 'प्रोफ़ाइल पूर्ण करें' : 'Complete your profile'}
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-ink-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100">
          <div>
            <h2 className="text-base font-bold text-ink-900 tracking-tight">
              {isHi ? 'अपनी प्रोफ़ाइल पूरी करें' : 'Complete Your Profile'}
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">
              {isHi
                ? 'आपातकालीन मिलान के लिए ये विवरण आवश्यक हैं'
                : 'These details are needed for emergency blood matching'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Medical Section */}
          <div>
            <h3 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-3">
              {isHi ? 'मेडिकल' : 'Medical'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-600 mb-1">
                  {isHi ? 'ब्लड ग्रुप' : 'Blood Group'} <span className="text-blood-500">*</span>
                </label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none focus:border-blood-500 focus:ring-1 focus:ring-blood-500/20 transition-colors cursor-pointer"
                >
                  <option value="">{isHi ? 'चुनें' : 'Select'}</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-600 mb-1">
                  {isHi ? 'वजन (किग्रा)' : 'Weight (kg)'}
                </label>
                <input
                  type="number"
                  min={45}
                  max={150}
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder={isHi ? 'किग्रा में' : 'In kg'}
                  className="w-full h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 outline-none focus:border-blood-500 focus:ring-1 focus:ring-blood-500/20 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Location Section */}
          <div>
            <h3 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-3">
              {isHi ? 'स्थान' : 'Location'}
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-600 mb-1">
                  {isHi ? 'पिनकोड' : 'Pincode'}
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="110001"
                  className="w-full h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 outline-none focus:border-blood-500 focus:ring-1 focus:ring-blood-500/20 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-600 mb-1">
                  {isHi ? 'मोहल्ला / एरिया' : 'Area / Locality'}
                </label>
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder={isHi ? 'एरिया' : 'Area'}
                  className="w-full h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 outline-none focus:border-blood-500 focus:ring-1 focus:ring-blood-500/20 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-600 mb-1">
                  {isHi ? 'शहर' : 'City'}
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={isHi ? 'शहर' : 'City'}
                  className="w-full h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 outline-none focus:border-blood-500 focus:ring-1 focus:ring-blood-500/20 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Contact Section */}
          <div>
            <h3 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-3">
              {isHi ? 'संपर्क' : 'Contact'}
            </h3>
            <div>
              <label className="block text-xs font-semibold text-ink-600 mb-1">
                {isHi ? 'WhatsApp नंबर' : 'WhatsApp Number'}
              </label>
              <div className="flex items-center h-10 rounded-xl border border-ink-200 bg-white overflow-hidden focus-within:border-blood-500 focus-within:ring-1 focus-within:ring-blood-500/20 transition-colors">
                <span className="flex-shrink-0 px-3 text-sm font-semibold text-ink-500 bg-ink-50 h-full flex items-center border-r border-ink-200">
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit number"
                  className="flex-1 h-full bg-transparent px-3 text-sm text-ink-900 placeholder:text-ink-400 outline-none min-w-0"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-ink-400 hover:text-ink-600 transition-colors cursor-pointer py-2"
            >
              {isHi ? 'अभी नहीं' : 'Skip for now'}
            </button>
            <button
              type="submit"
              disabled={saving || !bloodGroup}
              className="inline-flex items-center gap-2 rounded-xl bg-blood-600 hover:bg-blood-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-5 py-2.5 transition-colors cursor-pointer"
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                  {isHi ? 'सेव हो रहा है...' : 'Saving...'}
                </>
              ) : (
                isHi ? 'सेव करें' : 'Save Profile'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
