import React, { useState, useEffect, useRef } from 'react';
import { User, Match, BloodRequest, BloodType, AvailabilityStatus, lookupPincode, DonationLog } from '../types';
import { authenticatedApi } from '../lib/api';
import { useLanguage } from '../lib/LanguageContext';
import ProfileCard from './DonorDashboard/ProfileCard';
import MatchList from './DonorDashboard/MatchList';
import DonationHistory from './DonorDashboard/DonationHistory';
import SettingsPanel, { CompleteProfileModal } from './DonorDashboard/SettingsPanel';
import TabBar from './DonorDashboard/TabBar';
import LoginView from './DonorDashboard/LoginView';
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
  const { t, language } = useLanguage();
  const isHi = language === 'HI';
  const [matches, setMatches] = useState<Match[]>([]);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<'requests' | 'history'>('requests');
  const [donationLogs, setDonationLogs] = useState<DonationLog[]>([]);
  const [loadingMatchId, setLoadingMatchId] = useState<string | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
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
  const [editBloodGroup, setEditBloodGroup] = useState<BloodType>('A+');
  const [editWeightKg, setEditWeightKg] = useState<string>(currentUser?.weight_kg ? String(currentUser.weight_kg) : '');
  const [healthDeclaration, setHealthDeclaration] = useState<boolean>(true);
  const [showCompleteProfileModal, setShowCompleteProfileModal] = useState<boolean>(
    Boolean(currentUser && (!currentUser.profile_complete || !currentUser.blood_type || !currentUser.pincode))
  );

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
    setLoadingDashboard(true);
    setDashboardError(null);
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
      setEditPincode(currentUser.pincode || '');
      setEditArea(currentUser.area || '');
      setEditCity(currentUser.city || '');
      setEditAvail(currentUser.availability_status || 'available');
      setEditEmergency(Boolean(currentUser.emergency_only));
      setEditBloodGroup(currentUser.blood_type || 'A+');
      if (currentUser.weight_kg) setEditWeightKg(String(currentUser.weight_kg));
      if (!currentUser.profile_complete || !currentUser.blood_type || !currentUser.pincode) {
        setShowCompleteProfileModal(true);
      }
      setLocationSearch(currentUser.area ? `${currentUser.area} (${currentUser.pincode})` : (currentUser.pincode || ''));
    } catch (err) {
      console.error(err);
      setDashboardError(isHi ? 'आपका डेटा लोड नहीं हो सका। कृपया पुनः प्रयास करें।' : 'Could not load your data. Please try again.');
    } finally {
      setLoadingDashboard(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentUser]);

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

    if (!/^\d{6}$/.test(editPincode)) {
      showToast(isHi ? 'मान्य 6-अंकीय पिनकोड दर्ज करें।' : 'Enter a valid 6-digit pincode.', 'error');
      return;
    }
    if (editWeightKg && Number(editWeightKg) < 45) {
      showToast(isHi ? 'रक्तदान पात्रता के लिए डोनर का वजन कम से कम 45 किग्रा होना चाहिए।' : 'Donor weight must be at least 45 kg for blood donation eligibility.', 'error');
      return;
    }

    setSavingProfile(true);
    try {
      const weightNum = editWeightKg ? Number(editWeightKg) : undefined;
      const updatedUser: User = {
        ...currentUser,
        blood_type: editBloodGroup,
        pincode: editPincode,
        area: editArea,
        city: editCity,
        weight_kg: weightNum,
        profile_complete: true,
        availability_status: editAvail,
        emergency_only: editEmergency,
        updated_at: new Date().toISOString()
      };

      await authenticatedApi('/api/donor-profile/complete', {
        blood_group: editBloodGroup,
        pincode: editPincode,
        area: editArea,
        city: editCity,
        weight_kg: weightNum,
        last_donation_date: currentUser.last_donation_date ?? null,
        health_self_declaration: true,
        emergency_only: editEmergency,
        number_sharing_pref: currentUser.number_sharing_pref ?? 'on_approval',
      }, 'PATCH');

      try {
        await authenticatedApi('/api/donor-profile/availability', { isAvailable: editAvail === 'available' }, 'PATCH');
      } catch (availErr) {
        console.error('Availability sync failed:', availErr);
      }

      onLoginSuccess(updatedUser); // Update local active user state
      setShowCompleteProfileModal(false);
      showToast(isHi ? "रक्तदाता प्रोफ़ाइल और सेटिंग्स सफलतापूर्वक अपडेट की गईं।" : "Donor profile and medical settings updated successfully.", 'success');
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
    return <LoginView onNavigate={onNavigate} />;
  }

  return (
    <div id="donor-dashboard" className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      <ProfileCard
        user={currentUser}
        matches={matches}
        donationLogs={donationLogs}
        onLogout={onLogout}
        onCompleteProfile={() => setShowCompleteProfileModal(true)}
        onNavigateToRequest={onNavigateToRequest}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Match Requests & Action Items Tab Box */}
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-[32px] bg-gradient-to-b from-blood-600 to-blood-700 shadow-2xl overflow-hidden p-1">
            {/* Tabs Header */}
            <TabBar
              active={dashboardTab}
              matchCount={matches.length}
              historyCount={donationLogs.length}
              onSelect={setDashboardTab}
            />

            {/* Tab content panel */}
            <div className="p-5 sm:p-7 space-y-6">
              {dashboardError ? (
                <div className="text-center py-12 px-4 rounded-2xl bg-black/20 ring-1 ring-white/10 backdrop-blur-sm">
                  <p className="text-[13px] font-semibold text-white">{dashboardError}</p>
                  <button
                    onClick={loadDashboardData}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20 ring-1 ring-white/20 cursor-pointer"
                  >
                    {isHi ? 'फिर कोशिश करें' : 'Try again'}
                  </button>
                </div>
              ) : loadingDashboard && matches.length === 0 && donationLogs.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-sm">
                  <span className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin inline-block"></span>
                  <p className="text-xs text-white/80 mt-3 font-semibold">{isHi ? 'सिंक हो रहा है...' : 'Syncing Data...'}</p>
                </div>
              ) : dashboardTab === 'requests' ? (
                <MatchList
                  matches={matches}
                  requests={requests}
                  currentUser={currentUser}
                  loadingMatchId={loadingMatchId}
                  onRespond={handleMatchDecision}
                />
              ) : (
                <DonationHistory
                  logs={donationLogs}
                  requests={requests}
                  currentUser={currentUser}
                />
              )}
            </div>
          </div>
        </div>

        {/* Edit profile & report external donation settings */}
        <SettingsPanel
          donationCount={donationLogs.length}
          savingProfile={savingProfile}
          editBloodGroup={editBloodGroup}
          editWeightKg={editWeightKg}
          editAvail={editAvail}
          editEmergency={editEmergency}
          editPincode={editPincode}
          editArea={editArea}
          editCity={editCity}
          locationSearch={locationSearch}
          showSuggestions={showSuggestions}
          filteredSuggestions={filteredSuggestions}
          suggestionsRef={suggestionsRef}
          onSave={handleUpdateProfile}
          onBloodGroupChange={setEditBloodGroup}
          onWeightChange={setEditWeightKg}
          onAvailChange={setEditAvail}
          onEmergencyChange={setEditEmergency}
          onPincodeChange={handlePincodeChange}
          onAreaChange={(e) => setEditArea(e.target.value)}
          onCityChange={(e) => setEditCity(e.target.value)}
          onLocationSearchChange={handleLocationSearchChange}
          onSelectSuggestion={handleSelectSuggestion}
          onSuggestionsFocus={() => setShowSuggestions(true)}
          reporting={reporting}
          reportDate={reportDate}
          reportNotes={reportNotes}
          onReportDateChange={setReportDate}
          onReportNotesChange={setReportNotes}
          onReportSubmit={handleSelfReportDonation}
        />
      </div>

      {/* Complete Donor Medical Profile Modal */}
      <CompleteProfileModal
        open={showCompleteProfileModal}
        savingProfile={savingProfile}
        editBloodGroup={editBloodGroup}
        editWeightKg={editWeightKg}
        editPincode={editPincode}
        editArea={editArea}
        editCity={editCity}
        healthDeclaration={healthDeclaration}
        isHi={isHi}
        onClose={() => setShowCompleteProfileModal(false)}
        onSave={handleUpdateProfile}
        onBloodGroupChange={setEditBloodGroup}
        onWeightChange={setEditWeightKg}
        onPincodeChange={handlePincodeChange}
        onAreaChange={(e) => setEditArea(e.target.value)}
        onCityChange={(e) => setEditCity(e.target.value)}
        onHealthDeclarationChange={setHealthDeclaration}
      />

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
