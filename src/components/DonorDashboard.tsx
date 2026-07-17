import React, { useState, useEffect, useRef } from 'react';
import { User, Match, BloodRequest, AvailabilityStatus, NumberSharingPref, lookupPincode, DonationLog } from '../types';
import { getCollection as getLocalOrFirestoreCollection, getDoc as getLocalOrFirestoreDoc } from '../lib/db';
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
}

export default function DonorDashboard({ currentUser, onLoginSuccess, onLogout, onStateChange, onGoogleRegisterRedirect }: DonorDashboardProps) {
  const { t, language } = useLanguage();
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

      const found = await getLocalOrFirestoreDoc<User>('users', uid);
      if (found) {
        onLoginSuccess(found);
        return;
      } else {
        setLoginError('Authenticated successfully, but no corresponding donor profile document was found.');
        return;
      }
    } catch (authErr: any) {
      console.warn("Supabase Auth login failed, checking fallback seed users...", authErr);
      
      try {
        // Fallback for preseeded test users if real Auth fails
        const allDonors = await getLocalOrFirestoreCollection<User>('users');
        const seedUser = allDonors.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
        
        if (seedUser && seedUser.id.startsWith('donor_')) {
          if (password === 'password' || !(seedUser as any).password || (seedUser as any).password === password) {
            onLoginSuccess(seedUser);
            return;
          }
        }
      } catch (err) {
        console.error("Seed fallback check failed:", err);
      }

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
      alert("Donor settings updated successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to update settings.");
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
      alert(`You have successfully ${decision} this request.`);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Unable to update this match. Please try again.');
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

      alert("Thank you! Your donation was logged successfully. You are now placed in Cooldown for 60 days (until " + cooldownUntilStr + ") to allow you to recover safely.");
      setReportDate('');
      setReportNotes('');
      await loadDashboardData();
    } catch (err) {
      console.error(err);
      alert("Failed to record donation.");
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
          <h2 className="text-xl font-bold tracking-tight text-white font-sans">{t.donorDashboard.loginTitle}</h2>
          <p className="text-ink-300 text-xs mt-1">
            {isHi ? 'अपनी उपलब्धता प्रबंधित करें, रक्त अनुरोध देखें या रक्तदान दर्ज करें।' : 'Manage availability, view match requests, or log external donations.'}
          </p>
        </div>

        <form onSubmit={handleLoginSubmit} className="p-8 space-y-5">
          {loginError && (
            <div id="login-error" className="p-3.5 rounded-xl bg-blood-50 text-blood-700 border border-blood-200 text-xs font-semibold flex items-center gap-2">
              <span>{loginError}</span>
            </div>
          )}

          {/* Google Sign-In Button */}
          <button
            id="btn-google-login"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loginLoading}
            className="w-full h-12 rounded-xl bg-white hover:bg-ink-50/80 active:scale-[0.99] text-ink-800 border border-ink-200 font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {isHi ? 'Google के साथ जारी रखें' : 'Continue with Google'}
          </button>
          
          <div className="flex items-center gap-2 my-2">
            <hr className="flex-1 border-ink-200" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">{isHi ? 'या ईमेल से लॉगिन करें' : 'OR WITH EMAIL'}</span>
            <hr className="flex-1 border-ink-200" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{t.donorDashboard.emailLabel}</label>
            <input
              id="inp-login-email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/90 text-ink-900 font-medium text-sm focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{t.donorDashboard.passwordLabel}</label>
            <input
              id="inp-login-password"
              type="password"
              required
              placeholder="••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-ink-200 bg-white/90 text-ink-900 font-medium text-sm focus:border-blood-500 focus:ring-4 focus:ring-blood-500/10 outline-none transition-all"
            />
          </div>

          <button
            id="btn-login-submit"
            type="submit"
            disabled={loginLoading}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-blood-600 to-blood-700 hover:from-blood-500 hover:to-blood-600 text-white font-semibold text-sm shadow-lg shadow-blood-600/25 transition-all disabled:opacity-50 cursor-pointer"
          >
            {loginLoading ? 'Logging in...' : t.donorDashboard.loginBtn}
          </button>

          <div className="rounded-xl bg-ink-50 p-3.5 text-center text-xs text-ink-600 border border-ink-100">
            <span>{isHi ? 'त्वरित परीक्षण के लिए पूर्व-पंजीकृत खाता:' : 'Rapid testing pre-seeded account:'}</span><br />
            <strong className="text-ink-900 font-bold">rahul@gmail.com</strong> ({isHi ? 'कोई पासवर्ड आवश्यक नहीं' : 'no password required'})
          </div>
        </form>
      </div>
    );
  }

  // Active user dashboard
  const isCooldown = currentUser.account_status === 'cooldown';

  return (
    <div id="donor-dashboard" className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Sleek Glass Overview Header */}
      <div className="rounded-[36px] bg-gradient-to-b from-blood-600 to-blood-700 p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" aria-hidden="true" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-black/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" aria-hidden="true" />
        
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
            title="Log Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
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
                                  <div className="p-3 rounded-2xl bg-ink-900 text-white flex items-center justify-between gap-3">
                                     <div className="flex items-center gap-3">
                                       <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10">
                                         <Phone className="w-4 h-4 text-white" />
                                       </div>
                                       <div>
                                         <p className="text-[11px] text-white/70">{isHi ? 'अनुरोधकर्ता से संपर्क करें' : 'Contact Requester'}</p>
                                         <p className="font-semibold text-sm">{req.requester_name}</p>
                                       </div>
                                     </div>
                                  </div>
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
    </div>
  );
}
