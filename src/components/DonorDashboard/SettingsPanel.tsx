import React, { useRef, useState } from 'react';
import { BloodType, AvailabilityStatus } from '../../types';
import { DelhiPincode } from '../../data/pincodes';
import { useLanguage } from '../../lib/LanguageContext';
import { authenticatedApi } from '../../lib/api';
import DonorBadges from '../DonorBadges';
import {
  MapPin,
  Search,
  Save,
  FileText,
  Calendar,
  Heart,
  X,
} from 'lucide-react';
import { DELHI_PINCODES } from '../../data/pincodes';

interface SettingsPanelProps {
  donationCount: number;
  savingProfile: boolean;
  editBloodGroup: BloodType | '';
  editWeightKg: string;
  editAvail: AvailabilityStatus;
  editEmergency: boolean;
  editPincode: string;
  editArea: string;
  editCity: string;
  locationSearch: string;
  showSuggestions: boolean;
  filteredSuggestions: DelhiPincode[];
  suggestionsRef: React.RefObject<HTMLDivElement | null>;

  onSave: (e: React.FormEvent) => void;
  onBloodGroupChange: (bg: BloodType) => void;
  onWeightChange: (w: string) => void;
  onAvailChange: (a: AvailabilityStatus) => void;
  onEmergencyChange: (e: boolean) => void;
  onPincodeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAreaChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCityChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLocationSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectSuggestion: (s: DelhiPincode) => void;
  onSuggestionsFocus: () => void;

  // Self-report donation
  reporting: boolean;
  reportDate: string;
  reportNotes: string;
  onReportDateChange: (d: string) => void;
  onReportNotesChange: (n: string) => void;
  onReportSubmit: (e: React.FormEvent) => void;
  // Contact info (phone / WhatsApp) — for the persistent settings section
  phone?: string | null;
  whatsappPhone?: string | null;
}

const BLOOD_GROUPS: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

/** Profile & availability edit form, self-report donation, and badges. */
export default function SettingsPanel(props: SettingsPanelProps) {
  const { language } = useLanguage();
  const isHi = language === 'HI';

  return (
    <div className="space-y-6">
      <DonorBadges donationCount={props.donationCount} />
      {/* Edit settings */}
      <div className="rounded-[32px] bg-gradient-to-b from-blood-600 to-blood-700 shadow-2xl p-6 sm:p-7 space-y-4">
        <h3 className="font-semibold text-[14px] tracking-wide text-white border-b border-white/15 pb-4">Profile & Availability</h3>
        <form onSubmit={props.onSave} className="space-y-4 text-xs">
          {/* Blood Group */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-white/80 block uppercase tracking-wider">Blood Group</label>
            <select
              id="sel-edit-blood-group"
              value={props.editBloodGroup}
              onChange={e => props.onBloodGroupChange(e.target.value as BloodType)}
              className="w-full px-4 py-3 bg-white/10 ring-1 ring-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/40 text-white font-semibold transition-all appearance-none"
            >
              {BLOOD_GROUPS.map(bg => (
                <option key={bg} value={bg} className="text-ink-900">{bg}</option>
              ))}
            </select>
          </div>

          {/* Weight (kg) */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-white/80 block uppercase tracking-wider flex items-center justify-between">
              <span>Weight (kg) * (Min 45 kg)</span>
              <span className="text-[9px] font-bold text-emerald-300 bg-white/10 px-2 py-0.5 rounded-full ring-1 ring-white/20">NBTC Criteria</span>
            </label>
            <input
              id="inp-edit-weight"
              type="number"
              min={45}
              max={250}
              placeholder="e.g. 60"
              value={props.editWeightKg}
              onChange={e => props.onWeightChange(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 ring-1 ring-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/40 text-white font-semibold placeholder-white/40 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-white/80 block uppercase tracking-wider">Availability Status</label>
            <select
              id="sel-edit-avail"
              value={props.editAvail}
              onChange={e => props.onAvailChange(e.target.value as AvailabilityStatus)}
              className="w-full px-4 py-3 bg-white/10 ring-1 ring-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/40 text-white font-semibold transition-all appearance-none"
            >
              <option value="available" className="text-ink-900">Available Now</option>
              <option value="available_with_notice" className="text-ink-900">Available with Notice</option>
              <option value="unavailable" className="text-ink-900">Temporarily Unavailable</option>
            </select>
          </div>

          {/* Quick Search Delhi Location */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-white/80 block uppercase tracking-wider flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" />
              Quick Location Picker (Area/Pincode)
            </label>
            <div className="relative" ref={props.suggestionsRef}>
              <input
                id="inp-edit-delhi-location-search"
                type="text"
                placeholder={isHi ? 'क्षेत्र या पिनकोड खोजें...' : 'Search area or pincode...'}
                value={props.locationSearch}
                onChange={props.onLocationSearchChange}
                onFocus={props.onSuggestionsFocus}
                className="w-full px-4 py-3 bg-white/10 ring-1 ring-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/40 text-white font-semibold placeholder-white/50 transition-all"
              />
              {props.showSuggestions && props.filteredSuggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 max-h-48 overflow-y-auto rounded-2xl bg-white border border-ink-200 shadow-xl mt-1.5 divide-y divide-ink-100">
                  {props.filteredSuggestions.map((suggestion, idx) => (
                    <button
                      key={`${suggestion.pincode}-${suggestion.area}-${idx}`}
                      type="button"
                      onClick={() => props.onSelectSuggestion(suggestion)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-ink-50 text-xs text-ink-900 flex justify-between items-center transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-blood-500 shrink-0" />
                        <div className="truncate">
                          <span className="font-semibold block truncate">{suggestion.area}</span>
                          <span className="text-ink-400 text-[10px] uppercase font-semibold block truncate">{suggestion.zone}</span>
                        </div>
                      </div>
                      <span className="rounded-lg bg-ink-900 text-white px-2 py-0.5 font-mono font-bold text-[10px] shrink-0">
                        {suggestion.pincode}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-white/80 block uppercase tracking-wider">Pincode *</label>
            <input
              id="inp-edit-pin"
              type="text"
              maxLength={6}
              required
              value={props.editPincode}
              onChange={props.onPincodeChange}
              className="w-full px-4 py-3 bg-white/10 ring-1 ring-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/40 text-white font-semibold transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-white/80 block uppercase tracking-wider">Area</label>
              <input
                id="inp-edit-area"
                type="text"
                value={props.editArea}
                onChange={props.onAreaChange}
                className="w-full px-4 py-3 bg-white/10 ring-1 ring-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/40 text-white font-semibold transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-white/80 block uppercase tracking-wider">City</label>
              <input
                id="inp-edit-city"
                type="text"
                value={props.editCity}
                onChange={props.onCityChange}
                className="w-full px-4 py-3 bg-white/10 ring-1 ring-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/40 text-white font-semibold transition-all"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/10 ring-1 ring-white/20">
            <div className="space-y-0.5">
              <span className="text-[12px] font-semibold text-white">Emergency Only</span>
              <p className="text-[11px] text-white/60">Only notify on critical requests</p>
            </div>
            <input
              id="chk-edit-emergency"
              type="checkbox"
              checked={props.editEmergency}
              onChange={e => props.onEmergencyChange(e.target.checked)}
              className="w-4 h-4 text-blood-600 rounded bg-white/10 border-white/20 focus:ring-white"
            />
          </div>

          <button
            id="btn-update-profile"
            type="submit"
            disabled={props.savingProfile}
            className="w-full py-3.5 rounded-2xl bg-white text-blood-700 font-semibold text-[13px] transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 hover:bg-white/90 mt-2"
          >
            <Save className="w-4 h-4" />
            {props.savingProfile ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>

      {/* ─ Contact Info (phone + WhatsApp) — persistent editable section */}
      <ContactInfoSection phone={props.phone ?? null} whatsappPhone={props.whatsappPhone ?? null} />

      {/* Self-Report External Donation to Trigger Cooldown */}
      <div className="rounded-[32px] bg-gradient-to-b from-blood-600 to-blood-700 shadow-2xl p-6 sm:p-7 space-y-4">
        <h3 className="font-semibold text-[14px] tracking-wide text-white border-b border-white/15 pb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Self-Report Donation
        </h3>
        <p className="text-[11px] text-white/70 leading-relaxed">
          Donated externally at a hospital or blood bank? Log it to trigger your safety 60-day recovery cooldown manually.
        </p>
        <form onSubmit={props.onReportSubmit} className="space-y-4 text-xs mt-2">
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-white/80 block uppercase tracking-wider">Donation Date *</label>
            <input
              id="inp-report-date"
              type="date"
              required
              value={props.reportDate}
              onChange={e => props.onReportDateChange(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 ring-1 ring-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/40 text-white font-semibold transition-all"
              style={{ colorScheme: 'dark' }}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-white/80 block uppercase tracking-wider">Notes / Location</label>
            <input
              id="inp-report-notes"
              type="text"
              value={props.reportNotes}
              onChange={e => props.onReportNotesChange(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 ring-1 ring-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/40 text-white font-semibold placeholder-white/50 transition-all"
            />
          </div>

          <button
            id="btn-report-submit"
            type="submit"
            disabled={props.reporting || !props.reportDate}
            className="w-full py-3.5 rounded-2xl bg-white/10 ring-1 ring-white/20 hover:bg-white/20 text-white font-semibold text-[13px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
          >
            <FileText className="w-4 h-4" />
            {props.reporting ? 'Logging...' : 'Log Donation'}
          </button>
        </form>
      </div>
    </div>
  );
}

import { useFocusTrap } from '../../hooks/useFocusTrap';

/** Complete-profile modal — blood group, weight, pincode, area, city, consent. */
export function CompleteProfileModal(props: {
  open: boolean;
  savingProfile: boolean;
  editBloodGroup: BloodType | '';
  editWeightKg: string;
  editPincode: string;
  editArea: string;
  editCity: string;
  healthDeclaration: boolean;
  isHi: boolean;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  onBloodGroupChange: (bg: BloodType) => void;
  onWeightChange: (w: string) => void;
  onPincodeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAreaChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCityChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onHealthDeclarationChange: (v: boolean) => void;
}) {
  const isHi = props.isHi;
  const trapRef = useFocusTrap<HTMLDivElement>(props.open);
  if (!props.open) return null;

  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-label={isHi ? 'प्रोफ़ाइल पूरी करें' : 'Complete Profile'}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/70 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white border border-ink-200 shadow-premium-lg p-6 sm:p-8 space-y-6 relative text-ink-900">
        <button
          onClick={props.onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-ink-400 hover:text-ink-900 hover:bg-ink-100 transition cursor-pointer"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl blood-drop-gradient text-white shadow-md shadow-blood-600/30">
            <Heart className="w-6 h-6 fill-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink-900">
              {isHi ? 'डोनर मेडिकल प्रोफ़ाइल पूरी करें' : 'Complete Your Donor Medical Profile'}
            </h2>
            <p className="text-xs text-ink-500">
              {isHi ? 'आपातकालीन ब्लड मैच और सटीक लोकेशन के लिए आवश्यक।' : 'Required for accurate, safe emergency blood matching in your area.'}
            </p>
          </div>
        </div>

        <form onSubmit={props.onSave} className="space-y-4 text-xs">
          {/* Blood Group */}
          <div>
            <label className="block text-xs font-bold text-ink-700 mb-1">
              {isHi ? 'ब्लड ग्रुप *' : 'Blood Group *'}
            </label>
            <select
              required
              value={props.editBloodGroup}
              onChange={e => props.onBloodGroupChange(e.target.value as BloodType)}
              className="w-full px-4 py-3 bg-white border border-ink-200 rounded-xl text-ink-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blood-500"
            >
              {BLOOD_GROUPS.map(bg => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>

          {/* Weight (kg) */}
          <div>
            <label className="block text-xs font-bold text-ink-700 mb-1 flex items-center justify-between">
              <span>{isHi ? 'वजन (किग्रा) * (कम से कम 45 किग्रा)' : 'Weight (kg) * (Min 45 kg required)'}</span>
              <span className="text-[10px] font-bold text-blood-600 bg-blood-50 px-2 py-0.5 rounded-full border border-blood-200">NBTC Guideline</span>
            </label>
            <input
              required
              type="number"
              min={45}
              max={250}
              placeholder="e.g. 60"
              value={props.editWeightKg}
              onChange={e => props.onWeightChange(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-ink-200 rounded-xl text-ink-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blood-500 placeholder:text-ink-400"
            />
            <p className="text-[10px] text-ink-500 mt-1">
              {isHi ? 'चिकित्सकीय रक्तदान पात्रता के लिए न्यूनतम वजन 45 किग्रा आवश्यक है।' : 'Minimum 45 kg is required by Indian NBTC guidelines for safe blood donation.'}
            </p>
          </div>

          {/* Pincode */}
          <div>
            <label className="block text-xs font-bold text-ink-700 mb-1">
              {isHi ? 'पिनकोड (6-अंकीय) *' : 'Pincode (6-digit) *'}
            </label>
            <input
              required
              type="text"
              maxLength={6}
              placeholder="e.g. 110001"
              value={props.editPincode}
              onChange={props.onPincodeChange}
              className="w-full px-4 py-3 bg-white border border-ink-200 rounded-xl text-ink-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blood-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink-700 mb-1">{isHi ? 'क्षेत्र / इलाका' : 'Area / Locality'}</label>
              <input
                type="text"
                placeholder="e.g. Connaught Place"
                value={props.editArea}
                onChange={props.onAreaChange}
                className="w-full px-4 py-3 bg-white border border-ink-200 rounded-xl text-ink-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blood-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-700 mb-1">{isHi ? 'शहर' : 'City'}</label>
              <input
                type="text"
                placeholder="e.g. New Delhi"
                value={props.editCity}
                onChange={props.onCityChange}
                className="w-full px-4 py-3 bg-white border border-ink-200 rounded-xl text-ink-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blood-500"
              />
            </div>
          </div>

          {/* Health Self-Declaration Checkbox */}
          <label className="flex gap-3 rounded-2xl bg-ink-50 border border-ink-200 p-3.5 text-xs leading-relaxed text-ink-700 font-medium">
            <input
              required
              type="checkbox"
              checked={props.healthDeclaration}
              onChange={e => props.onHealthDeclarationChange(e.target.checked)}
              className="w-4 h-4 text-blood-600 rounded mt-0.5"
            />
            <span>
              {isHi
                ? 'मैं पुष्टि करता/करती हूँ कि मेरा वज़न कम से कम 45 किग्रा है, मैं 18-65 वर्ष का/की हूँ, और मैं रक्तदान के लिए पूर्णतः स्वस्थ हूँ।'
                : 'I declare that I weigh at least 45 kg, am 18–65 years old, free of active infections, and healthy to donate blood.'}
            </span>
          </label>

          <button
            type="submit"
            disabled={props.savingProfile}
            className="btn-glow w-full py-3.5 rounded-xl bg-blood-600 hover:bg-blood-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-blood-600/30"
          >
            <Save className="w-4 h-4" />
            {props.savingProfile ? (isHi ? 'सहेजा जा रहा है...' : 'Saving Profile...') : (isHi ? 'प्रोफ़ाइल सहेजें और सक्रिय करें →' : 'Save Profile & Activate →')}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── ContactInfoSection — standalone settings card for phone / WhatsApp ───────
// Used inside SettingsPanel (Settings tab) so users can update contact info at
// any time, not just via the banner. Self-contained: own local state + fetch.
function toDisplay(stored: string | null): string {
  if (!stored) return '';
  const digits = stored.replace(/\D/g, '');
  return digits.startsWith('91') ? digits.slice(2) : digits;
}

function ContactInfoSection({ phone, whatsappPhone }: { phone: string | null; whatsappPhone: string | null }) {
  const [phoneInput, setPhoneInput] = useState(toDisplay(phone));
  const [waInput, setWaInput] = useState(toDisplay(whatsappPhone));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const phoneTrimmed = phoneInput.trim();
    const waTrimmed = waInput.trim();

    const payload: { phone?: string; whatsappPhone?: string } = {};

    if (phoneTrimmed) {
      if (phoneTrimmed.length < 10) {
        setFeedback({ msg: 'Enter a valid 10-digit phone number.', ok: false });
        return;
      }
      payload.phone = phoneTrimmed;
    }

    if (waTrimmed) {
      if (waTrimmed.length < 10) {
        setFeedback({ msg: 'Enter a valid 10-digit WhatsApp number.', ok: false });
        return;
      }
      payload.whatsappPhone = waTrimmed;
    }

    if (!payload.phone && !payload.whatsappPhone) {
      setFeedback({ msg: 'Enter at least one contact number (phone or WhatsApp).', ok: false });
      return;
    }

    setSaving(true);
    try {
      await authenticatedApi('/api/profile/contact', payload, 'PATCH');
      setFeedback({ msg: 'Contact info saved!', ok: true });
    } catch (err: any) {
      setFeedback({ msg: err.message || 'Save failed. Try again.', ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[32px] bg-gradient-to-b from-blood-600 to-blood-700 shadow-2xl p-6 sm:p-7 space-y-4">
      <h3 className="font-semibold text-[14px] tracking-wide text-white border-b border-white/15 pb-4">
        Phone &amp; WhatsApp
      </h3>
      <p className="text-[11px] text-white/60 -mt-2">
        Used for WhatsApp match alerts. Keep this up to date.
      </p>
      <form onSubmit={handleSave} className="space-y-4 text-xs">
        {/* Phone */}
        <div className="space-y-2">
          <label htmlFor="settings-phone" className="text-[11px] font-semibold text-white/80 block uppercase tracking-wider">
            Phone Number
          </label>
          <div className="flex items-center rounded-2xl bg-white/10 ring-1 ring-white/20 px-4 h-12 gap-2">
            <span className="text-white/60 font-mono text-xs">+91</span>
            <input
              id="settings-phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={phoneInput}
              onChange={e => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit number"
              className="flex-1 bg-transparent text-white font-semibold placeholder-white/40 outline-none"
            />
          </div>
        </div>

        {/* WhatsApp */}
        <div className="space-y-2">
          <label htmlFor="settings-whatsapp" className="text-[11px] font-semibold text-white/80 block uppercase tracking-wider">
            WhatsApp Number
          </label>
          <div className="flex items-center rounded-2xl bg-white/10 ring-1 ring-white/20 px-4 h-12 gap-2">
            <span className="text-white/60 font-mono text-xs">+91</span>
            <input
              id="settings-whatsapp"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={waInput}
              onChange={e => setWaInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit WhatsApp number"
              className="flex-1 bg-transparent text-white font-semibold placeholder-white/40 outline-none"
            />
          </div>
        </div>

        {feedback && (
          <p className={`text-[11px] font-semibold ${feedback.ok ? 'text-emerald-300' : 'text-red-300'}`}>
            {feedback.ok ? '\u2713 ' : '\u26a0 '}{feedback.msg}
          </p>
        )}

        <button
          id="btn-save-contact"
          type="submit"
          disabled={
            saving ||
            (!phoneInput && !waInput) ||
            (phoneInput.length > 0 && phoneInput.length < 10) ||
            (waInput.length > 0 && waInput.length < 10)
          }
          className="w-full py-3.5 rounded-2xl bg-white text-blood-700 font-semibold text-[13px] transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 hover:bg-white/90"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Contact Info'}
        </button>
      </form>
    </div>
  );
}
