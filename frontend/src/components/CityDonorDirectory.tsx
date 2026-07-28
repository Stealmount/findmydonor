import React, { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Heart, ShieldCheck, Megaphone, Users, Award, ExternalLink, HelpCircle } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { DELHI_PINCODES, DelhiPincode } from '../data/pincodes';
import { BLOOD_COMPATIBILITY_MATRIX, BloodType } from '../types';
import { supabase } from '../lib/supabase';

interface CityDonorDirectoryProps {
  initialZone?: string;
  initialBloodGroup?: string;
  onNavigate: (view: any, pushHistory?: boolean, customCode?: string) => void;
}

const BLOOD_GROUPS: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

// Group pincodes by Zone
const ZONES_MAP: Record<string, DelhiPincode[]> = {};
DELHI_PINCODES.forEach(item => {
  const normalizedZone = item.zone.trim();
  if (!ZONES_MAP[normalizedZone]) {
    ZONES_MAP[normalizedZone] = [];
  }
  ZONES_MAP[normalizedZone].push(item);
});

const ALL_ZONES = Object.keys(ZONES_MAP).sort();

export function CityDonorDirectory({ initialZone, initialBloodGroup, onNavigate }: CityDonorDirectoryProps) {
  const { language } = useLanguage();
  const isHi = language === 'HI';

  const [selectedZone, setSelectedZone] = useState<string>(initialZone || ALL_ZONES[0] || 'Central Delhi');
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<BloodType | 'ALL'>((initialBloodGroup as BloodType) || 'ALL');
  const [donorCount, setDonorCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState<boolean>(true);

  const zonePincodes = ZONES_MAP[selectedZone] || [];
  const uniqueAreas = Array.from(new Set(zonePincodes.map(p => p.area))).slice(0, 15);
  const pincodeList = Array.from(new Set(zonePincodes.map(p => p.pincode)));

  // Query real donor counts from database matching pincodes (Privacy preserved: count only, zero PII)
  useEffect(() => {
    let isMounted = true;
    async function fetchDonorCount() {
      setLoadingCount(true);
      try {
        if (pincodeList.length === 0) {
          if (isMounted) { setDonorCount(0); setLoadingCount(false); }
          return;
        }

        let query = supabase
          .from('donor_profiles')
          .select('profile_id', { count: 'exact', head: true })
          .in('pincode', pincodeList);

        if (selectedBloodGroup !== 'ALL') {
          query = query.eq('blood_group', selectedBloodGroup);
        }

        const { count, error } = await query;
        if (!error && count !== null && isMounted) {
          setDonorCount(count);
        } else if (isMounted) {
          setDonorCount(0);
        }
      } catch {
        if (isMounted) setDonorCount(0);
      } finally {
        if (isMounted) setLoadingCount(false);
      }
    }

    fetchDonorCount();
    return () => { isMounted = false; };
  }, [selectedZone, selectedBloodGroup]);

  // Compatibility data for selected blood group
  const compatibility = selectedBloodGroup !== 'ALL' ? BLOOD_COMPATIBILITY_MATRIX[selectedBloodGroup] : null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Navigation */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isHi ? 'मुख्य पृष्ठ पर लौटें' : 'Back to Home'}</span>
          </button>
          <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
            <MapPin className="w-5 h-5" />
            <span>FindMyDonor™ Regional Directory</span>
          </div>
        </div>

        {/* Title & Zone Selector */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
                {isHi ? `रक्तदाता निर्देशिका: ${selectedZone}` : `Blood Donors in ${selectedZone}`}
                {selectedBloodGroup !== 'ALL' && <span className="text-rose-500 ml-2">({selectedBloodGroup})</span>}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                {isHi ? 'दिल्ली एनसीआर में व्हाट्सएप-आधारित आपातकालीन रक्तदाता मिलान' : 'WhatsApp-based Emergency Blood Donor Network in Delhi NCR'}
              </p>
            </div>

            {/* Zone Selector Dropdown */}
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="bg-slate-800 text-white border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
            >
              {ALL_ZONES.map(z => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Honest Donor Count Banner (No Fake Numbers) */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
          {loadingCount ? (
            <div className="flex items-center gap-3 text-slate-400 text-sm">
              <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
              <span>{isHi ? 'रक्तदाताओं की संख्या जांची जा रही है...' : 'Checking registered donor availability...'}</span>
            </div>
          ) : donorCount && donorCount > 0 ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 font-black text-xl">
                  {donorCount}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {isHi ? `${selectedZone} में ${donorCount} सत्यापित रक्तदाता सक्रिय हैं` : `${donorCount} Verified Donor(s) Available in ${selectedZone}`}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isHi ? '100% गोपनीयता सुरक्षित: आवश्यकता पड़ने पर केवल प्रत्यक्ष मैच साझा किया जाता है' : '100% Privacy Protected. Contacts shared only upon explicit donor match approval.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('request')}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer flex-shrink-0"
              >
                <Megaphone className="w-4 h-4" />
                <span>{isHi ? 'रक्त की आवश्यकता पोस्ट करें' : 'Request Blood in Area'}</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                  <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                  <span>{isHi ? `पहला रक्तदाता बनें!` : `Be the first donor in ${selectedZone}!`}</span>
                </div>
                <p className="text-xs text-slate-300">
                  {isHi 
                    ? `वर्तमान में ${selectedZone} (${selectedBloodGroup !== 'ALL' ? selectedBloodGroup : 'सभी समूह'}) में पंजीकृत दाता कम हैं। जीवन बचाने के लिए अभी पंजीकरण करें।`
                    : `Currently zero public donors registered for ${selectedBloodGroup !== 'ALL' ? selectedBloodGroup : 'all blood types'} in ${selectedZone}. Register now to help patients in emergency.`}
                </p>
              </div>
              <button
                onClick={() => onNavigate('auth-signup')}
                className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white rounded-xl font-bold text-xs tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer flex-shrink-0"
              >
                <Users className="w-4 h-4" />
                <span>{isHi ? 'रक्तदाता के रूप में जुड़ें' : `Register as Donor in ${selectedZone} →`}</span>
              </button>
            </div>
          )}
        </div>

        {/* Filter by Blood Group Pills */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            {isHi ? 'रक्त समूह द्वारा फ़िल्टर करें:' : 'Filter by Blood Group:'}
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedBloodGroup('ALL')}
              className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                selectedBloodGroup === 'ALL'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              {isHi ? 'सभी समूह (ALL)' : 'ALL GROUPS'}
            </button>
            {BLOOD_GROUPS.map(bg => (
              <button
                key={bg}
                onClick={() => setSelectedBloodGroup(bg)}
                className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  selectedBloodGroup === bg
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                {bg}
              </button>
            ))}
          </div>
        </div>

        {/* Covered Areas in Zone */}
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-6 space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-rose-400" />
            <span>{isHi ? `${selectedZone} के अंतर्गत प्रमुख क्षेत्र` : `Key Areas & Pincodes Covered in ${selectedZone}`}</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
            {uniqueAreas.map((area, idx) => (
              <div key={idx} className="bg-slate-800/80 px-3 py-2 rounded-lg border border-slate-700/60 text-xs text-slate-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                <span className="truncate">{area}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Blood Group Compatibility Guide (Reusable from BLOOD_COMPATIBILITY_MATRIX) */}
        {compatibility && (
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-400 font-bold text-base">
              <Award className="w-5 h-5" />
              <h3>{isHi ? `${selectedBloodGroup} रक्त समूह अनुकूलता (Compatibility Guide)` : `Blood Compatibility Guide for ${selectedBloodGroup}`}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50 space-y-1.5">
                <span className="font-bold text-emerald-400 uppercase tracking-wider block">
                  {isHi ? 'इन रक्त समूहों को दान कर सकते हैं:' : 'Can Give Blood To:'}
                </span>
                <p className="text-slate-200 text-sm font-semibold">{compatibility.canGiveTo.join(', ')}</p>
              </div>
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50 space-y-1.5">
                <span className="font-bold text-blue-400 uppercase tracking-wider block">
                  {isHi ? 'इन रक्त समूहों से प्राप्त कर सकते हैं:' : 'Can Receive Blood From:'}
                </span>
                <p className="text-slate-200 text-sm font-semibold">{compatibility.canReceiveFrom.join(', ')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Dual CTAs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <button
            onClick={() => onNavigate('auth-signup')}
            className="p-5 bg-gradient-to-r from-rose-600 to-rose-800 hover:from-rose-700 hover:to-rose-900 text-white rounded-2xl font-bold text-sm transition-all shadow-xl flex items-center justify-between group cursor-pointer"
          >
            <div className="text-left space-y-1">
              <span className="block text-xs uppercase tracking-wider text-rose-200">{isHi ? 'रक्तदाता पंजीकरण' : 'Become a Volunteer Donor'}</span>
              <span className="block text-base font-extrabold">{isHi ? `${selectedZone} में दान दें` : `Register in ${selectedZone}`}</span>
            </div>
            <Users className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>

          <button
            onClick={() => onNavigate('request')}
            className="p-5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-2xl font-bold text-sm transition-all shadow-xl flex items-center justify-between group cursor-pointer"
          >
            <div className="text-left space-y-1">
              <span className="block text-xs uppercase tracking-wider text-slate-400">{isHi ? 'आपातकालीन आवश्यकता' : 'Emergency Requirement'}</span>
              <span className="block text-base font-extrabold">{isHi ? `${selectedZone} में रक्त माँगें` : `Request Blood in ${selectedZone}`}</span>
            </div>
            <Megaphone className="w-6 h-6 text-rose-400 group-hover:scale-110 transition-transform" />
          </button>
        </div>

        {/* Links to Phase 2 Legal/FAQ pages */}
        <div className="pt-8 border-t border-slate-800 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
          <button onClick={() => onNavigate('privacy')} className="hover:text-white transition-colors cursor-pointer">
            {isHi ? 'गोपनीयता नीति (Privacy Policy)' : 'Privacy Policy'}
          </button>
          <span>•</span>
          <button onClick={() => onNavigate('terms')} className="hover:text-white transition-colors cursor-pointer">
            {isHi ? 'सेवा की शर्तें (Terms of Service)' : 'Terms of Service'}
          </button>
          <span>•</span>
          <button onClick={() => onNavigate('faq')} className="hover:text-white transition-colors cursor-pointer flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{isHi ? 'अक्सर पूछे जाने वाले प्रश्न (FAQ)' : 'FAQ & Eligibility'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
