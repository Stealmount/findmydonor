import React, { useState, useEffect, useRef } from 'react';
import { User, Match, BloodRequest, AvailabilityStatus, NumberSharingPref, lookupPincode, DonationLog } from '../types';
import { sendRealEmail } from '../lib/email';
import { supabase } from '../lib/supabase';
import { authenticatedApi } from '../lib/api';
import { useLanguage } from '../lib/LanguageContext';
import { getCoordinates } from '../data/pincode_coords';
import HospitalMap from './HospitalMap';
import DonorBadges from './DonorBadges';
import { 
  Heart, 
  MapPin, 
  Clock, 
  Phone, 
  MessageSquare, 
  User as UserIcon, 
  CheckCircle, 
  XCircle, 
  Calendar,
  AlertTriangle,
  LogOut,
  Shield,
  FileText,
  Save,
  Lock,
  ArrowRight,
  Search,
  X,
  Check
} from 'lucide-react';
import { DELHI_PINCODES, DelhiPincode } from '../data/pincodes';

interface DonorDashboardProps {
  currentUser: User | null;
  onLoginSuccess: (user: User) => void;
  onLogout: () => void;
  onStateChange?: () => void;
  onGoogleRegisterRedirect?: (googleData: { uid: string; email: string; full_name: string }) => void;
  onNavigateToRequest?: () => void;
  onNavigate?: (view: string) => void;
}

export default function DonorDashboard({ currentUser, onLoginSuccess, onLogout, onStateChange, onGoogleRegisterRedirect, onNavigateToRequest, onNavigate }: DonorDashboardProps) {
  const { t, language, setLanguage } = useLanguage();
  const isHi = language === 'HI';
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Dashboard Data
  const [matches, setMatches] = useState<Match[]>([]);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<'requests' | 'history'>('requests');
  const [donationLogs, setDonationLogs] = useState<DonationLog[]>([]);
  const [loadingMatchId, setLoadingMatchId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Profile Edit fields
  const [editPincode, setEditPincode] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editAvail, setEditAvail] = useState('available' as AvailabilityStatus);
  const [editEmergency, setEditEmergency] = useState(false);

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
        item.zone.toLowerCase().includes(query)
      ).slice(0, 10);
      setFilteredSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setFilteredSuggestions([]);
    }
  };

  const handleSelectSuggestion = (suggestion: DelhiPincode) => {
    setEditPincode(suggestion.pincode);
    setEditArea(suggestion.area);
    setEditCity(suggestion.zone);
    setLocationSearch(`${suggestion.area} (${suggestion.pincode})`);
    setShowSuggestions(false);
  };

  // Manual Donation Cooldown fields
  const [reportDate, setReportDate] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [reporting, setReporting] = useState(false);

  const loadDashboardData = async () => {
    if (!currentUser) return;
    try {
      const dashboard = await authenticatedApi<{
        matches: Match[]; requests: BloodRequest[]; donationLogs?: DonationLog[];
      }>('/api/donor/matches', undefined, 'GET');
      const donorMatches = dashboard.matches || [];
      const allRequests = dashboard.requests || [];
      const donorLogs = dashboard.donationLogs || [];

      // Sort matches so pending/active ones are on top
      donorMatches.sort((a, b) => {
        if (a.donor_response === 'pending' && b.donor_response !== 'pending') return -1;
        if (a.donor_response !== 'pending' && b.donor_response === 'pending') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      // Sort donation logs by date descending
      donorLogs.sort((a, b) => {
        const dateA = new Date(a.donation_date).getTime();
        const dateB = new Date(b.donation_date).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setMatches(donorMatches);
      setRequests(allRequests);
      setDonationLogs(donorLogs);

      // Initialize edit fields
      setEditPincode(currentUser.pincode);
      setEditArea(currentUser.area);
      setEditCity(currentUser.city);
      setEditAvail(currentUser.availability_status);
      setEditEmergency(currentUser.emergency_only);
      setLocationSearch(currentUser.area ? `${currentUser.area} (${currentUser.pincode})` : currentUser.pincode);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentUser]);

  // Handle Simple Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (authError) throw authError;
      const uid = data.user?.id;
      if (!uid) throw new Error("No user returned");

      const authState = (await authenticatedApi('/api/auth/me', undefined, 'GET')) as any;
      if (authState && authState.profile) {
        onLoginSuccess(authState.profile);
        return;
      } else {
        setLoginError('Authenticated successfully, but no corresponding donor profile document was found.');
        return;
      }
    } catch (authErr: any) {
      console.warn("Supabase Auth login failed:", authErr);
      setLoginError(authErr.message || 'Login failed. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    setLoginError('');
    setLoginLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
      // redirect
    } catch (err: any) {
      console.error("Google login failed:", err);
      setLoginError(err.message || 'Google Sign-In failed. Please try again.');
      setLoginLoading(false);
    }
  };

  // Handle Edit Pincode Change
  const handlePincodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pin = e.target.value.trim();
    setEditPincode(pin);

    if (pin.length === 6 && /^\d{6}$/.test(pin)) {
      const suggest = lookupPincode(pin);
      if (suggest) {
        setEditArea(suggest.area);
        setEditCity(suggest.city);
      }
    }
  };

  // Update Profile Settings
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setSavingProfile(true);
    try {
      const updatedUser: User = {
        ...currentUser,
        pincode: editPincode,
        area: editArea,
        city: editCity,
        availability_status: editAvail,
        emergency_only: editEmergency,
        updated_at: new Date().toISOString()
      };

      await authenticatedApi('/api/donor-profile', {
        pincode: editPincode,
        area: editArea,
        city: editCity,
        availability_status: editAvail,
        emergency_only: editEmergency,
      }, 'PUT');
      
      try {
        await authenticatedApi('/api/donor-profile/availability', { isAvailable: editAvail === 'available' }, 'PATCH');
      } catch { /* ignore availability sync fallback */ }

      onLoginSuccess(updatedUser); // Update local active user state
      showToast(isHi ? "रक्तदाता सेटिंग्स सफलतापूर्वक अपडेट की गईं।" : "Donor settings updated successfully.", 'success');
    } catch (err) {
      console.error(err);
      showToast(isHi ? "सेटिंग्स अपडेट करने में विफल।" : "Failed to update settings.", 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Donor Match Decision (Approve/Decline)
  const handleMatchDecision = async (matchId: string, decision: 'approved' | 'declined') => {
    if (!currentUser) return;
    setLoadingMatchId(matchId);
    try {
      if (decision === 'approved') {
        await authenticatedApi(`/api/donor/matches/${matchId}/accept`, {}, 'POST');
      } else {
        await authenticatedApi(`/api/matches/${matchId}/decline`, {}, 'POST');
      }
      await loadDashboardData();
      if (onStateChange) onStateChange();
      showToast(isHi ? `आपने इस अनुरोध को सफलतापूर्वक ${decision === 'approved' ? 'स्वीकार' : 'अस्वीकार'} किया।` : `You have successfully ${decision} this request.`, 'success');
    } catch (error: any) {
      console.error(error);
      showToast(error.message || 'Unable to update this match. Please try again.', 'error');
    } finally {
      setLoadingMatchId(null);
    }
  };

  // Self-report external donation to trigger 60-day cooldown
  const handleSelfReportDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !reportDate) return;

    setReporting(true);
    try {
      const lastDate = new Date(reportDate);
      const cooldownObj = new Date(lastDate.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days cooldown
      const cooldownUntilStr = cooldownObj.toISOString().split('T')[0];

      await authenticatedApi('/api/donor/matches/self/confirm', {
        notes: reportNotes || 'Manually reported external donation.'
      }, 'POST');

      const updatedUser: User = {
        ...currentUser,
        last_donation_date: reportDate,
        cooldown_until: cooldownUntilStr,
        account_status: 'cooldown',
        updated_at: new Date().toISOString()
      };
      onLoginSuccess(updatedUser); // Update local state

      showToast(isHi ? `धन्यवाद! आपका रक्तदान सफलतापूर्वक दर्ज किया गया। (${cooldownUntilStr} तक विश्राम अवधि)` : "Thank you! Your donation was logged successfully. Cooldown active until " + cooldownUntilStr + ".", 'success');
      setReportDate('');
      setReportNotes('');
      await loadDashboardData();
    } catch (err) {
      console.error(err);
      showToast(isHi ? "रक्तदान दर्ज करने में विफल।" : "Failed to record donation.", 'error');
    } finally {
      setReporting(false);
    }
  };

  // Login view
  if (!currentUser) {
    return (
      <div id="donor-login-container" className="max-w-md mx-auto rounded-3xl bg-white/95 backdrop-blur-2xl border border-ink-200/80 shadow-premium-lg overflow-hidden my-8">
        <div className="bg-gradient-to-br from-ink-900 via-ink-950 to-ink-900 p-8 text-white text-center relative overflow-hidden">
          <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-blood-600/20 blur-2xl" aria-hidden />
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl blood-drop-gradient shadow-[0_8px_20px_-4px_rgba(244,63,87,0.5)]">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white font-sans">
            {isHi ? 'डोनर डैशबोर्ड' : 'Donor Dashboard'}
          </h2>
          <p className="text-ink-300 text-xs mt-1">
            {isHi ? 'अपनी उपलब्धता प्रबंधित करें, रक्त अनुरोध देखें या रक्तदान दर्ज करें।' : 'Manage availability, view match requests, or log external donations.'}
          </p>
        </div>

        <div className="p-8 space-y-4">
          <p className="text-center text-sm text-ink-600">
            {isHi
              ? 'डैशबोर्ड एक्सेस करने के लिए कृपया साइन इन करें।'
              : 'Please sign in to access your donor dashboard.'}
          </p>
          <button
            id="btn-goto-signin"
            type="button"
            onClick={() => onNavigate?.('auth-signin')}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-blood-600 to-blood-700 hover:from-blood-500 hover:to-blood-600 text-white font-semibold text-sm shadow-lg shadow-blood-600/25 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            {isHi ? 'साइन इन / रजिस्टर करें' : 'Sign In / Register'}
          </button>
        </div>
      </div>
    );
  }

  // Active user dashboard
  const isCooldown = currentUser.account_status === 'cooldown';

  return (
    <div id="donor-dashboard" className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Sleek Glass Overview Header */}
      <div className="rounded-[36px] bg-gradient-to-b from-blood-600 to-blood-700 p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" aria-hidden="true" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-black/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" aria-hidden="true" />
        
        <div className="flex items-center gap-5 relative z-10">
          <div className="grid h-16 w-16 place-items-center rounded-[20px] bg-white/15 backdrop-blur ring-1 ring-white/20 text-white shadow-lg">
            <UserIcon className="w-8 h-8" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-semibold tracking-tight text-white">{currentUser.full_name}</h2>
              {currentUser.aadhaar_verified && (
                <div className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white ring-1 ring-white/20">
                  <Shield className="w-3 h-3 text-emerald-300 fill-emerald-300/20" />
                  <span>DigiLocker</span>
                </div>
              )}
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase ${
                isCooldown ? 'bg-white/10 text-white ring-1 ring-white/20' :
                currentUser.account_status === 'active' ? 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/30' : 'bg-white/5 text-white/70 ring-1 ring-white/10'
              }`}>
                {isHi ? (currentUser.account_status === 'active' ? 'सक्रिय' : currentUser.account_status === 'cooldown' ? 'विश्राम अवधि' : 'निष्क्रिय') : currentUser.account_status}
              </span>
            </div>
             <p className="text-xs text-white/70 mt-1.5">{t.donorDashboard.memberSince} {new Date(currentUser.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Cooldown End Timer Display */}
        {isCooldown && currentUser.cooldown_until && (
          <div id="cooldown-timer-badge" className="p-4 rounded-2xl bg-white/10 ring-1 ring-white/20 flex items-center gap-3 md:max-w-xs relative z-10 backdrop-blur-md">
            <Clock className="w-5 h-5 text-white/90 flex-shrink-0" />
            <div className="text-xs text-white/90 leading-tight">
              <span className="font-semibold text-white block mb-0.5">{t.donorDashboard.cooldownActive}</span>
              {t.donorDashboard.backInPool} <strong className="font-bold">{currentUser.cooldown_until}</strong>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 relative z-10">
          <div className="rounded-2xl bg-white/15 backdrop-blur ring-1 ring-white/20 px-4 py-2 text-center text-white min-w-[90px]">
            <span className="block text-[9.5px] font-semibold uppercase tracking-wider text-white/60">{t.donorDashboard.bloodType}</span>
            <span className="text-xl font-bold">{currentUser.blood_type}</span>
          </div>
          <button
            id="btn-donor-logout"
            onClick={onLogout}
            className="p-3 rounded-2xl bg-white text-blood-700 hover:bg-white/90 transition-colors cursor-pointer shadow-lg"
            title={isHi ? 'लॉग आउट' : 'Log Out'}
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ⚡ Need Blood? Switch to Requester Mode / Request Generator Banner */}
      {onNavigateToRequest && (
        <div className="rounded-3xl bg-gradient-to-r from-ink-900 via-ink-950 to-blood-950 border border-blood-500/30 p-6 sm:p-7 text-white relative overflow-hidden shadow-premium-lg">
          <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-blood-600/15 blur-3xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
            <div className="flex items-start sm:items-center gap-4 max-w-2xl">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blood-500/20 border border-blood-500/30 text-blood-400 font-bold text-xl shrink-0 shadow-inner">
                ⚡
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-white tracking-tight">
                    {isHi ? 'क्या परिवार या मरीज के लिए तुरंत रक्त चाहिए?' : 'Need Emergency Blood for Family or Patient?'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-blood-500/20 border border-blood-500/30 text-blood-400 text-[10px] font-mono font-bold uppercase">
                    1-Click Switch
                  </span>
                </div>
                <p className="text-xs text-ink-300 mt-1 leading-relaxed">
                  {isHi
                    ? 'आप एक सत्यापित रक्तदाता हैं! बिना दोबारा पंजीकरण किए तुरंत अनुरोधकर्ता मोड में जाएं और रक्त अनुरोध जनरेट करें।'
                    : 'You are a verified donor! Instantly switch to Requester Mode and broadcast an emergency blood request without signing up again.'}
                </p>
              </div>
            </div>
            <button
              id="btn-donor-switch-requester"
              type="button"
              onClick={onNavigateToRequest}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl btn-glow bg-blood-600 hover:bg-blood-700 text-white font-extrabold text-xs shadow-lg transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{isHi ? '➕ रक्त अनुरोध जनरेट करें →' : '➕ Switch & Request Blood →'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Donor Stat Strip */}
      <div id="donor-stat-strip" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-3xl bg-white/95 backdrop-blur-xl border border-ink-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
              {isHi ? 'लंबित मिलान' : 'Pending Matches'}
            </span>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-ink-900 mt-2">
            {matches.filter(m => m.donor_response === 'pending').length}
          </p>
          <p className="text-[11px] text-ink-400 mt-1">
            {isHi ? 'कार्रवाई की प्रतीक्षा में' : 'Awaiting your response'}
          </p>
        </div>

        <div className="rounded-3xl bg-white/95 backdrop-blur-xl border border-ink-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
              {isHi ? 'कुल रक्तदान' : 'Total Donations'}
            </span>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-blood-500/10 text-blood-600">
              <Heart className="w-5 h-5 fill-blood-500/20" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-ink-900 mt-2">
            {donationLogs.length}
          </p>
          <p className="text-[11px] text-ink-400 mt-1">
            {isHi ? 'सफलतापूर्वक पूर्ण' : 'Completed lifetime'}
          </p>
        </div>

        <div className="rounded-3xl bg-white/95 backdrop-blur-xl border border-ink-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
              {isHi ? 'बचाए गए जीवन' : 'Lives Saved'}
            </span>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Shield className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-600 mt-2">
            {donationLogs.length * 3}
          </p>
          <p className="text-[11px] text-ink-400 mt-1">
            {isHi ? 'अनुमानित प्रभाव (3 जीवन/रक्तदान)' : 'Estimated impact (3 lives/donation)'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Match Requests & Action Items Tab Box */}
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-[32px] bg-gradient-to-b from-blood-600 to-blood-700 shadow-2xl overflow-hidden p-1">
            {/* Tabs Header */}
            <div className="flex bg-black/10 rounded-[28px] p-1 gap-1 mx-1 mt-1">
              <button
                id="btn-tab-requests"
                type="button"
                onClick={() => setDashboardTab('requests')}
                className={`flex-1 py-3 px-4 rounded-3xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  dashboardTab === 'requests'
                    ? 'bg-white text-blood-700 shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Heart className={`w-4 h-4 ${dashboardTab === 'requests' ? 'text-blood-600 animate-pulse' : 'text-white/70'}`} />
                {t.donorDashboard.liveMatchingRequests} ({matches.length})
              </button>
              <button
                id="btn-tab-history"
                type="button"
                onClick={() => setDashboardTab('history')}
                className={`flex-1 py-3 px-4 rounded-3xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  dashboardTab === 'history'
                    ? 'bg-white text-blood-700 shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Clock className={`w-4 h-4 ${dashboardTab === 'history' ? 'text-blood-600' : 'text-white/70'}`} />
                {t.donorDashboard.donationHistory} ({donationLogs.length})
              </button>
            </div>

            {/* Tab content panel */}
            <div className="p-5 sm:p-7 space-y-6">
              {dashboardTab === 'requests' ? (
                <>
                  <div className="flex items-center justify-between border-b border-white/15 pb-4">
                    <h3 className="text-[14px] font-semibold tracking-wide text-white flex items-center gap-2">
                      <Heart className="w-4 h-4 text-white" />
                      {t.donorDashboard.liveMatchingRequests} ({matches.length})
                    </h3>
                  </div>

                  {matches.length === 0 ? (
                    <div className="text-center py-12 px-4 rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-sm">
                      <Shield className="w-12 h-12 mx-auto mb-3 text-white/30" />
                      <p className="text-[13px] font-semibold text-white">{t.donorDashboard.noActiveRequests}</p>
                      <p className="text-[11px] text-white/60 mt-1.5 leading-relaxed">
                        {t.donorDashboard.noActiveRequestsSub}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {matches.map(match => {
                        const req = requests.find(r => r.id === match.request_id);
                        if (!req) return null;

                        const isPending = match.donor_response === 'pending';
                        const isApproved = match.donor_response === 'approved';
                        const isDeclined = match.donor_response === 'declined';

                        return (
                          <div 
                            key={match.id}
                            className={`rounded-2xl ring-1 p-5 transition-all relative overflow-hidden ${
                              isApproved ? 'bg-white border-none ring-0 shadow-xl' :
                              isDeclined ? 'bg-black/20 ring-white/5 opacity-60' :
                              'bg-white/10 ring-white/15 backdrop-blur-md'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${isApproved ? 'bg-ink-100 text-ink-600' : 'bg-white/10 text-white/80'}`}>
                                {isHi ? 'निकटता रैंक' : 'Proximity Rank'}: #{match.match_rank}
                              </span>
                              <span className={`text-[11px] font-semibold ${isApproved ? 'text-emerald-600' : 'text-white/90'}`}>
                                {isApproved ? (isHi ? 'पुष्टि की गई ✓' : 'Confirmed ✓') : 
                                 isDeclined ? (isHi ? 'अस्वीकृत' : 'Passed') : 
                                 (isHi ? 'कार्रवाई आवश्यक' : 'Action Required')}
                              </span>
                            </div>

                            <h4 className={`text-xl font-semibold mt-1 tracking-tight ${isApproved ? 'text-ink-900' : 'text-white'}`}>
                              {req.blood_type_needed} {isHi ? 'रक्त की आवश्यकता' : 'blood needed'}
                            </h4>
                            <p className={`text-[12px] mt-1 ${isApproved ? 'text-ink-500' : 'text-white/80'}`}>
                              {req.hospital_name} &bull; {req.units_required} {isHi ? 'यूनिट आवश्यक' : 'units needed'}
                            </p>
                            
                            <div className="flex items-center gap-2 mt-4">
                              <span className={`text-[11px] px-2.5 py-1 flex items-center gap-1.5 rounded-full ${isApproved ? 'bg-ink-50 text-ink-700 border border-ink-100' : 'bg-white/10 text-white ring-1 ring-white/20'}`}>
                                <MapPin className="w-3.5 h-3.5" />
                                {match.distance_km ? `${match.distance_km} ${isHi ? 'किमी दूर' : 'km away'}` : (isHi ? 'आस-पास' : 'Nearby')}
                              </span>
                              <span className={`text-[11px] px-2.5 py-1 flex items-center gap-1.5 rounded-full ${isApproved ? 'bg-ink-50 text-ink-700 border border-ink-100' : 'bg-white/10 text-white ring-1 ring-white/20'}`}>
                                <Clock className="w-3.5 h-3.5" />
                                {req.urgency_level.toUpperCase()}
                              </span>
                            </div>
                            {(isPending || isApproved) && (() => {
                              const hospitalCoords = getCoordinates(req.hospital_pincode);
                              const donorCoords = currentUser ? getCoordinates(currentUser.pincode) : undefined;
                              return (
                                <div className="mt-4">
                                  <HospitalMap
                                    hospitalLat={hospitalCoords.lat}
                                    hospitalLng={hospitalCoords.lng}
                                    hospitalName={req.hospital_name}
                                    donorLat={donorCoords?.lat}
                                    donorLng={donorCoords?.lng}
                                    distanceKm={match.distance_km}
                                  />
                                </div>
                              );
                            })()}

                            {isPending && (
                              <div className="mt-6 grid grid-cols-2 gap-3">
                                <button
                                  id={`btn-dash-decline-${match.id}`}
                                  onClick={() => handleMatchDecision(match.id, 'declined')}
                                  disabled={loadingMatchId === match.id}
                                  className="rounded-full bg-white/10 ring-1 ring-white/20 py-3 text-[12.5px] font-semibold text-white flex items-center justify-center gap-2 hover:bg-white/20 transition-all cursor-pointer"
                                >
                                  {loadingMatchId === match.id ? <span className="animate-spin w-4 h-4 border-2 border-white/40 border-t-white rounded-full" /> : <X className="h-4 w-4" />}
                                  {isHi ? 'अस्वीकार करें' : 'Pass'}
                                </button>
                                <button
                                  id={`btn-dash-approve-${match.id}`}
                                  onClick={() => handleMatchDecision(match.id, 'approved')}
                                  disabled={loadingMatchId === match.id}
                                  className="rounded-full bg-white text-blood-700 py-3 text-[12.5px] font-semibold flex items-center justify-center gap-2 hover:bg-white/90 shadow-lg transition-all cursor-pointer"
                                >
                                  {loadingMatchId === match.id ? <span className="animate-spin w-4 h-4 border-2 border-blood-200 border-t-blood-700 rounded-full" /> : <Check className="h-4 w-4 stroke-[3]" />}
                                  {isHi ? 'स्वीकार करें' : 'Accept Match'}
                                </button>
                              </div>
                            )}

                            {isApproved && (() => {
                              const mapQuery = encodeURIComponent(`${req.hospital_name}, ${req.hospital_area}, ${req.hospital_city}`);
                              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
                              return (
                                <div className="mt-5 pt-5 border-t border-ink-100 space-y-4">
                                  <div className="p-4 rounded-2xl bg-ink-50/50 border border-ink-100">
                                    <p className="text-xs font-semibold text-ink-900 mb-1">{isHi ? 'मरीज की जानकारी (अनलॉक की गई):' : 'Patient Info unlocked:'}</p>
                                    <p className="text-sm font-semibold text-ink-900">{req.patient_name}</p>
                                    <p className="text-xs text-ink-500">{req.patient_age}Y / {req.patient_gender} &bull; Attending: Dr. {req.attending_doctor || 'N/A'}</p>
                                  </div>
                                  {req.requester_phone ? (
                                    <a
                                      id={`lnk-contact-requester-${match.id}`}
                                      href={`tel:${req.requester_phone}`}
                                      className="p-3 rounded-2xl bg-ink-900 text-white flex items-center justify-between gap-3 hover:bg-ink-800 transition-all group cursor-pointer block"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 group-hover:bg-white/20 transition-colors">
                                          <Phone className="w-4 h-4 text-white" />
                                        </div>
                                        <div>
                                          <p className="text-[11px] text-white/70">{isHi ? 'अनुरोधकर्ता से संपर्क करें' : 'Contact Requester'}</p>
                                          <p className="font-semibold text-sm flex items-center gap-2">
                                            <span>{req.requester_name}</span>
                                            <span className="text-xs text-white/80 font-normal">({req.requester_phone})</span>
                                          </p>
                                        </div>
                                      </div>
                                      <span className="text-[11px] font-semibold bg-white/10 group-hover:bg-white/20 px-3 py-1 rounded-xl text-white transition-colors">
                                        {isHi ? 'कॉल करें 📞' : 'Call 📞'}
                                      </span>
                                    </a>
                                  ) : (
                                    <div className="p-3 rounded-2xl bg-ink-900/50 text-white/60 flex items-center gap-3">
                                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5">
                                        <Phone className="w-4 h-4 text-white/40" />
                                      </div>
                                      <div>
                                        <p className="text-[11px] text-white/50">{isHi ? 'अनुरोधकर्ता से संपर्क करें' : 'Contact Requester'}</p>
                                        <p className="font-semibold text-xs text-white/60">{isHi ? 'संपर्क जानकारी उपलब्ध नहीं है' : 'Contact info not available'}</p>
                                      </div>
                                    </div>
                                  )}
                                  <a
                                    href={mapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full rounded-2xl bg-blood-600 hover:bg-blood-700 text-white py-3.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition-all"
                                  >
                                    <MapPin className="w-4 h-4" />
                                    {isHi ? 'अस्पताल के लिए लाइव नेविगेशन (Google Maps)' : 'Get Exact Hospital Live Navigation (Google Maps)'}
                                  </a>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-white/15 pb-4">
                    <h3 className="text-[14px] font-semibold tracking-wide text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-white" />
                      Donation History
                    </h3>
                    <span className="text-[10px] font-medium tracking-wider uppercase text-white/50">Your Life-Saving Impact</span>
                  </div>

                  {donationLogs.length === 0 ? (
                    <div className="text-center py-12 px-4 rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-sm">
                      <Calendar className="w-12 h-12 mx-auto mb-3 text-white/30" />
                      <p className="text-[13px] font-semibold text-white">No Donation History Found</p>
                      <p className="text-[11px] text-white/60 mt-1.5 leading-relaxed">
                        You haven't logged any donations yet. You can self-report an external donation on the right panel!
                      </p>
                    </div>
                  ) : (
                    <div className="relative border-l-2 border-white/20 pl-6 ml-3 space-y-6 py-2 text-left">
                      {donationLogs.map((log) => {
                        const req = requests.find(r => r.id === log.request_id);
                        const hospitalName = req ? req.hospital_name : 'External Location / Event';
                        const locationInfo = req ? `${req.hospital_area}, ${req.hospital_city} (${req.hospital_pincode})` : log.notes;
                        const bloodType = req ? req.blood_type_needed : currentUser.blood_type;

                        return (
                          <div key={log.id} className="relative">
                            {/* Bullet point on the timeline */}
                            <span className="absolute -left-[33px] top-2 bg-white ring-2 ring-blood-700 w-3 h-3 rounded-full shadow-sm" />

                            <div className="bg-white/10 ring-1 ring-white/15 rounded-2xl p-5 space-y-3 backdrop-blur-sm text-white">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-semibold tracking-wide bg-black/20 px-2.5 py-1 rounded-full text-white/90">
                                    {new Date(log.donation_date).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </span>
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                    log.source === 'platform_match' ? 'bg-emerald-500 text-white' :
                                    log.source === 'admin_entered' ? 'bg-white/20 text-white' : 'bg-white/20 text-white'
                                  }`}>
                                    {log.source.replace('_', ' ')}
                                  </span>
                                </div>
                                <span className="bg-white text-blood-700 px-2.5 py-1 font-bold text-[10px] rounded-full">
                                  Blood Group: {bloodType}
                                </span>
                              </div>

                              <div className="space-y-1">
                                <h4 className="font-semibold text-[15px]">{hospitalName}</h4>
                                <p className="text-[11px] text-white/80 font-medium flex items-center gap-1.5">
                                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                                  {locationInfo}
                                </p>
                              </div>

                              {req && log.notes && (
                                <p className="text-[11px] text-white/70 bg-black/10 p-2.5 rounded-lg italic">
                                  &ldquo;{log.notes}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Edit profile & report external donation settings */}
        <div className="space-y-6">
          <DonorBadges donationCount={donationLogs.length} />
          {/* Edit settings */}
          <div className="rounded-[32px] bg-gradient-to-b from-blood-600 to-blood-700 shadow-2xl p-6 sm:p-7 space-y-4">
            <h3 className="font-semibold text-[14px] tracking-wide text-white border-b border-white/15 pb-4">Profile & Availability</h3>
            <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/80 block uppercase tracking-wider">Availability Status</label>
                <select
                  id="sel-edit-avail"
                  value={editAvail}
                  onChange={e => setEditAvail(e.target.value as AvailabilityStatus)}
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
                <div className="relative" ref={suggestionsRef}>
                  <input
                    id="inp-edit-delhi-location-search"
                    type="text"
                    placeholder={isHi ? 'क्षेत्र या पिनकोड खोजें...' : 'Search area or pincode...'}
                    value={locationSearch}
                    onChange={handleLocationSearchChange}
                    onFocus={() => setShowSuggestions(true)}
                    className="w-full px-4 py-3 bg-white/10 ring-1 ring-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/40 text-white font-semibold placeholder-white/50 transition-all"
                  />
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 max-h-48 overflow-y-auto rounded-2xl bg-white border border-ink-200 shadow-xl mt-1.5 divide-y divide-ink-100">
                      {filteredSuggestions.map((suggestion, idx) => (
                         <button
                           key={`${suggestion.pincode}-${suggestion.area}-${idx}`}
                           type="button"
                           onClick={() => handleSelectSuggestion(suggestion)}
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
                  value={editPincode}
                  onChange={handlePincodeChange}
                  className="w-full px-4 py-3 bg-white/10 ring-1 ring-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/40 text-white font-semibold transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-white/80 block uppercase tracking-wider">Area</label>
                  <input
                    id="inp-edit-area"
                    type="text"
                    value={editArea}
                    onChange={e => setEditArea(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 ring-1 ring-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/40 text-white font-semibold transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-white/80 block uppercase tracking-wider">City</label>
                  <input
                    id="inp-edit-city"
                    type="text"
                    value={editCity}
                    onChange={e => setEditCity(e.target.value)}
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
                  checked={editEmergency}
                  onChange={e => setEditEmergency(e.target.checked)}
                  className="w-4 h-4 text-blood-600 rounded bg-white/10 border-white/20 focus:ring-white"
                />
              </div>

              <button
                id="btn-update-profile"
                type="submit"
                disabled={savingProfile}
                className="w-full py-3.5 rounded-2xl bg-white text-blood-700 font-semibold text-[13px] transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 hover:bg-white/90 mt-2"
              >
                <Save className="w-4 h-4" />
                {savingProfile ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          </div>

          {/* Self-Report External Donation to Trigger Cooldown */}
          <div className="rounded-[32px] bg-gradient-to-b from-blood-600 to-blood-700 shadow-2xl p-6 sm:p-7 space-y-4">
            <h3 className="font-semibold text-[14px] tracking-wide text-white border-b border-white/15 pb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Self-Report Donation
            </h3>
            <p className="text-[11px] text-white/70 leading-relaxed">
              Donated externally at a hospital or blood bank? Log it to trigger your safety 60-day recovery cooldown manually.
            </p>
            <form onSubmit={handleSelfReportDonation} className="space-y-4 text-xs mt-2">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/80 block uppercase tracking-wider">Donation Date *</label>
                <input
                  id="inp-report-date"
                  type="date"
                  required
                  value={reportDate}
                  onChange={e => setReportDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 ring-1 ring-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/40 text-white font-semibold transition-all"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/80 block uppercase tracking-wider">Notes / Location</label>
                <input
                  id="inp-report-notes"
                  type="text"
                  value={reportNotes}
                  onChange={e => setReportNotes(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 ring-1 ring-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/40 text-white font-semibold placeholder-white/50 transition-all"
                />
              </div>

              <button
                id="btn-report-submit"
                type="submit"
                disabled={reporting || !reportDate}
                className="w-full py-3.5 rounded-2xl bg-white/10 ring-1 ring-white/20 hover:bg-white/20 text-white font-semibold text-[13px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                <FileText className="w-4 h-4" />
                {reporting ? 'Logging...' : 'Log Donation'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {toast && (
        <div
          id="donor-toast"
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-bottom-4 flex items-center gap-3 text-xs font-bold ${
            toast.type === 'error'
              ? 'bg-red-900/90 text-white border-red-500/50 shadow-red-900/30'
              : 'bg-emerald-900/90 text-white border-emerald-500/50 shadow-emerald-900/30'
          }`}
        >
          <span className="text-base">{toast.type === 'error' ? '⚠️' : '✅'}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
