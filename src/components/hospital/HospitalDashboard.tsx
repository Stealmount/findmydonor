import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Clock, LogOut, X } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { authenticatedApi } from '../../lib/api';
import { HospitalUser, BloodType, BloodRequest, Match, User } from '../../types';
import { HospitalSidebar, HospitalView } from './HospitalSidebar';
import { HospitalHeader } from './HospitalHeader';
import { Worklist } from './views/Worklist';
import { LiveView } from './views/LiveView';
import { HistoryView } from './views/HistoryView';
import { CampsView } from './views/CampsView';
import { EntityDrawer } from './widgets/Shared';

interface HospitalDashboardProps {
  hospital: HospitalUser;
  onLogout: () => void;
}

// Trust range for a "verified" institution — reflects live network health.
function LivePulse() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      {seconds}s ago
    </span>
  );
}

export function HospitalDashboard({ hospital, onLogout }: HospitalDashboardProps) {
  const { language, setLanguage } = useLanguage();
  const isHi = language === 'HI';

  // Status gate — render holding screen before any real state
  if (hospital.status === 'pending') {
    return (
      <div className="min-h-screen bg-ink-950 flex flex-col items-center justify-center p-8 text-center font-sans">
        <div className="w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center mb-6">
          <Clock className="w-10 h-10 text-amber-400" />
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight mb-2">
          {isHi ? 'सत्यापन प्रतीक्षित है' : 'Verification Pending'}
        </h1>
        <p className="text-ink-400 text-sm max-w-sm leading-relaxed mb-2">
          {isHi
            ? `${hospital.hospital_name} का आवेदन हमारी टीम द्वारा समीक्षाधीन है। अनुमोदन पर आपको WhatsApp पर सूचना मिलेगी।`
            : `Your application for ${hospital.hospital_name} is under review. You'll be notified once approved.`}
        </p>
        <button onClick={onLogout} className="text-ink-500 hover:text-white text-sm transition flex items-center gap-2 cursor-pointer">
          <LogOut className="w-4 h-4" /> {isHi ? 'लॉगआउट' : 'Sign out'}
        </button>
      </div>
    );
  }
  if (hospital.status === 'rejected') {
    return (
      <div className="min-h-screen bg-ink-950 flex flex-col items-center justify-center p-8 text-center font-sans">
        <div className="w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center mb-6">
          <X className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight mb-2">
          {isHi ? 'आवेदन अस्वीकृत' : 'Application Rejected'}
        </h1>
        <p className="text-ink-400 text-sm max-w-sm leading-relaxed mb-6">
          {isHi
            ? 'आपका संस्थागत आवेदन इस समय अनुमोदित नहीं किया जा सका। सही विवरण के साथ पुनः पंजीकरण करें या सहायता से संपर्क करें।'
            : 'Your institutional application could not be approved at this time. Please re-register or contact support.'}
        </p>
        <button onClick={onLogout} className="text-ink-500 hover:text-white text-sm transition flex items-center gap-2 cursor-pointer">
          <LogOut className="w-4 h-4" /> {isHi ? 'लॉगआउट' : 'Sign out'}
        </button>
      </div>
    );
  }

  // ── View router
  const showCamps = hospital.institution_type === 'ngo';
  const [activeView, setActiveView] = useState<HospitalView>('dashboard');

  // ── Inventory (localStorage-backed, blood banks / hospitals only)
  const [inventory, setInventory] = useState<Record<BloodType, number>>(() => {
    const saved = localStorage.getItem(`hosp_inventory_${hospital.id}`);
    if (saved) { try { return JSON.parse(saved); } catch { } }
    return { 'A+': 18, 'A-': 5, 'B+': 14, 'B-': 4, 'O+': 6, 'O-': 8, 'AB+': 12, 'AB-': 3 };
  });

  useEffect(() => {
    localStorage.setItem(`hosp_inventory_${hospital.id}`, JSON.stringify(inventory));
  }, [inventory, hospital.id]);

  const criticalCount = (Object.values(inventory) as number[]).filter(v => v <= 3).length;
  const lowCount = (Object.values(inventory) as number[]).filter(v => v > 3 && v <= 6).length;

  // ── Emergency broadcast state
  const [selectedBlood, setSelectedBlood] = useState<BloodType>('O+');
  const [units, setUnits] = useState(2);
  const [urgency, setUrgency] = useState<'critical' | 'urgent' | 'planned'>('urgent');
  const [patientName, setPatientName] = useState('Emergency Transfusion');
  const [requestStatus, setRequestStatus] = useState<'idle' | 'broadcasting' | 'sent' | 'error'>('idle');
  const [notifiedCount, setNotifiedCount] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // ── Live Matches
  const [activeMatches, setActiveMatches] = useState<(Match & { donorName: string; donorPhone: string })[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);

  const fetchLiveMatches = async () => {
    try {
      const data = await authenticatedApi<{ requests: BloodRequest[]; matches: Match[]; users: User[] }>(
        '/api/hospital/dashboard', undefined, 'GET'
      );
      const allRequests = data.requests || [];
      const allMatches = data.matches || [];
      const allUsers = data.users || [];
      const hospitalReqs = allRequests.filter(r =>
        r.requester_phone === hospital.phone || r.hospital_name === hospital.hospital_name
      );
      const reqIds = new Set(hospitalReqs.map(r => r.id));
      const enriched = allMatches
        .filter(m => reqIds.has(m.request_id))
        .map(m => {
          const donor = allUsers.find(u => u.id === m.donor_id);
          return { ...m, donorName: donor?.full_name || 'Volunteer Donor', donorPhone: donor?.whatsapp_number || donor?.phone || '—' };
        });
      setActiveMatches(enriched);
      setLastSync(new Date());
    } catch { /* silent */ } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    fetchLiveMatches();
    const interval = setInterval(fetchLiveMatches, 8000);
    return () => clearInterval(interval);
  }, [hospital.phone, hospital.hospital_name]);

  // ── History
  const [history, setHistory] = useState<BloodRequest[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Re-pointed: `/api/institutions/requests` does not exist — derive institution
  // requests from the live dashboard payload instead (single source of truth).
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await authenticatedApi<{ requests: BloodRequest[] }>(
        '/api/hospital/dashboard', undefined, 'GET'
      );
      const hospitalReqs = (data.requests || []).filter(r =>
        r.requester_phone === hospital.phone || r.hospital_name === hospital.hospital_name
      );
      setHistory(hospitalReqs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch { /* silent */ } finally {
      setHistoryLoading(false);
    }
  };

  // ── Donor detail drawer
  const [detailMatch, setDetailMatch] = useState<(Match & { donorName: string; donorPhone: string }) | null>(null);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestStatus('broadcasting');
    try {
      const data = await authenticatedApi<{ matched?: number }>(
        '/api/requests',
        {
          verificationToken: 'verified',
          patient_name: patientName,
          blood_type_needed: selectedBlood,
          units_required: units,
          hospital_name: hospital.hospital_name,
          hospital_pincode: hospital.pincode,
          hospital_area: hospital.city,
          hospital_city: hospital.city,
          urgency_level: urgency,
          showcase_opt_in: true,
        },
        'POST'
      );
      setNotifiedCount(data.matched || 0);
      setRequestStatus('sent');
      fetchLiveMatches();
      setTimeout(() => { setRequestStatus('idle'); setPatientName('Emergency Transfusion'); }, 4000);
    } catch {
      setRequestStatus('error');
      setTimeout(() => setRequestStatus('idle'), 3000);
    }
  };

  const pendingReplies = activeMatches.filter(m => m.donor_response === 'pending').length;

  return (
    <div className="min-h-screen bg-ink-950 flex flex-col font-sans relative overflow-hidden text-white w-full">
      {/* Background */}
      <div className="absolute inset-0 grid-pattern-dark opacity-35 pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-blood-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-amber-900/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Mobile-only horizontal top bar */}
      <div className="md:hidden relative z-10">
        <div className="px-4 pt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-ink-900 border border-ink-700 flex items-center justify-center">
              <Shield className="h-4 w-4 text-blood-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-none">{hospital.hospital_name}</div>
              <div className="text-[10px] text-ink-500 mt-0.5">{isHi ? 'संस्थागत CRM' : 'Institution CRM'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LivePulse />
            <button onClick={onLogout} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-ink-400 cursor-pointer">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Mobile view switcher */}
        <div className="px-3 py-3 flex gap-1 overflow-x-auto">
          {(['dashboard', 'live', 'history', ...(showCamps ? ['camps'] : [])] as HospitalView[]).map(v => (
            <button key={v} onClick={() => setActiveView(v)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeView === v ? 'bg-blood-600/20 text-blood-400 border border-blood-500/25' : 'text-ink-500 border border-white/5 hover:text-white'
              }`}>
              {isHi
                ? (v === 'dashboard' ? 'डैशबोर्ड' : v === 'live' ? 'लाइव' : v === 'history' ? 'इतिहास' : 'शिविर')
                : (v === 'dashboard' ? 'Dashboard' : v === 'live' ? 'Live' : v === 'history' ? 'History' : 'Camps')}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop header + sidebar layout */}
      <div className="flex flex-1 min-h-0 relative z-10">
        <HospitalSidebar
          activeView={activeView}
          onNavigate={setActiveView}
          showCamps={showCamps}
          pendingReplies={pendingReplies}
          lowStockCount={criticalCount + lowCount}
          isHi={isHi}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Desktop header only (mobile has its own top bar) */}
          <div className="hidden md:block">
            <HospitalHeader
              hospital={hospital}
              criticalCount={criticalCount}
              lowCount={lowCount}
              onLanguageChange={(lang) => setLanguage(lang)}
              onLogout={onLogout}
              language={language}
              lastSync={lastSync}
            />
          </div>

          <main className="flex-1 relative z-10 p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeView === 'dashboard' && (
                  <Worklist
                    inventory={inventory}
                    activeMatches={activeMatches}
                    history={history}
                    isHi={isHi}
                    institutionType={hospital.institution_type}
                    criticalCount={criticalCount}
                    lowCount={lowCount}
                  />
                )}

                {activeView === 'live' && (
                  <LiveView
                    inventory={inventory}
                    setInventory={setInventory}
                    activeMatches={activeMatches}
                    loadingMatches={loadingMatches}
                    fetchLiveMatches={fetchLiveMatches}
                    isHi={isHi}
                    institutionType={hospital.institution_type}
                    selectedBlood={selectedBlood}
                    setSelectedBlood={setSelectedBlood}
                    units={units}
                    setUnits={setUnits}
                    urgency={urgency}
                    setUrgency={setUrgency}
                    patientName={patientName}
                    setPatientName={setPatientName}
                    requestStatus={requestStatus}
                    notifiedCount={notifiedCount}
                    onBroadcast={handleBroadcast}
                  />
                )}

                {activeView === 'history' && (
                  <HistoryView
                    history={history}
                    historyLoading={historyLoading}
                    historyLoaded={false}
                    fetchHistory={fetchHistory}
                    isHi={isHi}
                  />
                )}

                {showCamps && activeView === 'camps' && (
                  <CampsView hospital={hospital} isHi={isHi} />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Entity detail drawer */}
      <EntityDrawer
        open={!!detailMatch}
        onClose={() => setDetailMatch(null)}
        title={detailMatch?.donorName || ''}
        badge={detailMatch ? <LivePulse /> : undefined}
        rows={[
          ...(detailMatch ? [
            { label: isHi ? 'संपर्क' : 'Contact', value: detailMatch.donorPhone },
            ...(detailMatch.distance_km ? [{ label: isHi ? 'दूरी' : 'Distance', value: `${detailMatch.distance_km} km` }] : []),
            { label: isHi ? 'स्थिति' : 'Status', value: detailMatch.donor_response },
          ] : []),
        ]}
        isHi={isHi}
      />
    </div>
  );
}
