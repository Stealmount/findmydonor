import React, { useState, useEffect } from 'react';
import { User, BloodRequest, Match, NotificationLog, DonationLog, BloodType, RequestStatus } from '../types';
import { getCollection as getLocalOrFirestoreCollection, seedInitialDonors } from '../lib/db';
import { authenticatedApi } from '../lib/api';
import { 
  Users, 
  Heart, 
  Layers, 
  TrendingUp, 
  MapPin, 
  AlertOctagon, 
  Clock, 
  MessageSquare, 
  CheckCircle, 
  XCircle, 
  ShieldAlert, 
  Activity,
  Plus,
  RefreshCw,
  Search,
  Filter,
  BarChart2,
  Lock,
  Calendar
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { useLanguage } from '../lib/LanguageContext';

interface AdminPanelProps {
  onStateChange?: () => void;
}

export default function AdminPanel({ onStateChange }: AdminPanelProps) {
  const { t } = useLanguage();
  // Authentication State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  // Data State
  const [donors, setDonors] = useState<User[]>([]);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [donationLogs, setDonationLogs] = useState<DonationLog[]>([]);

  // Sub-Navigation Tabs
  const [activeSubTab, setActiveSubTab] = useState<'analytics' | 'donors' | 'requests' | 'matches' | 'notifs'>('analytics');

  // Filters
  const [donorBloodFilter, setDonorBloodFilter] = useState('');
  const [donorStatusFilter, setDonorStatusFilter] = useState('');
  const [donorPincodeSearch, setDonorPincodeSearch] = useState('');

  const [reqStatusFilter, setReqStatusFilter] = useState('');
  const [reqUrgencyFilter, setReqUrgencyFilter] = useState('');
  const [reqPincodeSearch, setReqPincodeSearch] = useState('');

  const [loading, setLoading] = useState(false);

  // Ban Dialog state
  const [banDonorId, setBanDonorId] = useState<string | null>(null);
  const [banReason, setBanReason] = useState('');

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const allDonors = await getLocalOrFirestoreCollection<User>('users');
      const allRequests = await getLocalOrFirestoreCollection<BloodRequest>('blood_requests');
      const allMatches = await getLocalOrFirestoreCollection<Match>('matches');
      const allNotifs = await getLocalOrFirestoreCollection<NotificationLog>('notifications');
      const allDonationLogs = await getLocalOrFirestoreCollection<DonationLog>('donation_log');

      setDonors(allDonors);
      setRequests(allRequests);
      setMatches(allMatches);
      setNotifications(allNotifs);
      setDonationLogs(allDonationLogs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminLoggedIn) {
      loadAdminData();
    }
  }, [isAdminLoggedIn]);

  // Handle Admin Auth
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'admin123' || adminPassword === 'admin') {
      setIsAdminLoggedIn(true);
      setAdminError('');
    } else {
      setAdminError('Invalid administrator credentials.');
    }
  };

  // Force Donor Cooldown
  const handleForceCooldown = async (donorId: string) => {
    const donor = donors.find(d => d.id === donorId);
    if (!donor) return;

    if (!window.confirm(`Force 60-day cooldown on donor ${donor.full_name}?`)) return;

    try {
      await authenticatedApi(`/api/admin/donors/${donorId}/log-donation`, {}, 'POST');
      await loadAdminData();
      if (onStateChange) onStateChange();
      alert(`Forced cooldown on donor ${donor.full_name} successfully.`);
    } catch (err) {
      console.error(err);
    }
  };

  // Lift Cooldown
  const handleLiftCooldown = async (donorId: string) => {
    const donor = donors.find(d => d.id === donorId);
    if (!donor) return;

    if (!window.confirm(`Lift cooldown and reset donor ${donor.full_name} to ACTIVE ahead of schedule?`)) return;

    try {
      await authenticatedApi(`/api/admin/donors/${donorId}/approve`, {}, 'PATCH');
      await loadAdminData();
      if (onStateChange) onStateChange();
      alert(`Lifted cooldown on donor ${donor.full_name} successfully.`);
    } catch (err) {
      console.error(err);
    }
  };

  // Ban / Unban Donor
  const handleBanSubmit = async () => {
    if (!banDonorId) return;
    const donor = donors.find(d => d.id === banDonorId);
    if (!donor) return;

    try {
      await authenticatedApi(`/api/admin/donors/${banDonorId}/ban`, { banReason }, 'PATCH');
      setBanDonorId(null);
      setBanReason('');
      await loadAdminData();
      if (onStateChange) onStateChange();
      alert("Donor has been banned.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnbanDonor = async (donorId: string) => {
    const donor = donors.find(d => d.id === donorId);
    if (!donor) return;

    if (!window.confirm(`Reinstate/unban donor ${donor.full_name}?`)) return;

    try {
      await authenticatedApi(`/api/admin/donors/${donorId}/approve`, {}, 'PATCH');
      await loadAdminData();
      if (onStateChange) onStateChange();
      alert("Donor status reinstated to Active.");
    } catch (err) {
      console.error(err);
    }
  };

  // Manual Match status override
  const handleOverrideMatchStatus = async (matchId: string, newStatus: 'approved' | 'declined' | 'timed_out' | 'donated') => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    if (!window.confirm(`Override Match Status to ${newStatus.toUpperCase()}?`)) return;

    try {
      const nowStr = new Date().toISOString();
      const payload: any = {
        ...match,
        donor_response: newStatus === 'donated' ? 'approved' : newStatus,
        donor_response_at: nowStr,
      };

      if (newStatus === 'donated') {
        payload.outcome = 'donated';
        payload.outcome_confirmed_at = nowStr;
      }

      await authenticatedApi("/api/admin/matches", { matchId, payload }, "POST");
      await loadAdminData();
      if (onStateChange) onStateChange();
      alert("Override completed successfully.");
    } catch (err) {
      console.error(err);
    }
  };

  // Seed compatible database
  const handleSeedDatabase = async () => {
    if (!window.confirm("Seed initial compatible donors, logs, and mock alerts into database?")) return;
    await seedInitialDonors();
    await loadAdminData();
    if (onStateChange) onStateChange();
    alert("Pre-seeded database populated successfully.");
  };

  // CALCULATION OF ANALYTICS METRICS (Section 11.2)
  const totalRequests = requests.length;
  const matchedRequests = requests.filter(r => {
    const rMatches = matches.filter(m => m.request_id === r.id);
    return rMatches.length > 0;
  }).length;

  const matchRate = totalRequests > 0 ? Math.round((matchedRequests / totalRequests) * 100) : 0;

  const fulfilledRequests = requests.filter(r => r.status === 'fulfilled').length;
  const fulfillmentRate = matchedRequests > 0 ? Math.round((fulfilledRequests / matchedRequests) * 100) : 0;

  // Donor utilization
  const activeDonors = donors.filter(d => d.account_status === 'active' || d.account_status === 'cooldown').length;
  const donorsWhoDonatedIn90Days = donors.filter(d => {
    if (!d.last_donation_date) return false;
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    return new Date(d.last_donation_date) >= ninetyDaysAgo;
  }).length;
  const donorUtilization = activeDonors > 0 ? Math.round((donorsWhoDonatedIn90Days / activeDonors) * 100) : 0;

  // Unmatched alerts
  const unmatchedRequests = requests.filter(r => {
    const hasMatches = matches.some(m => m.request_id === r.id);
    return !hasMatches && r.status !== 'cancelled';
  });

  // Demand calculations by blood type
  const bloodTypeDemandData = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'ANY'].map(type => {
    const count = requests.filter(r => r.blood_type_needed === type).length;
    return { name: type, value: count };
  });

  // Demand calculations by pincode
  const pincodeDensity: Record<string, number> = {};
  requests.forEach(r => {
    pincodeDensity[r.hospital_pincode] = (pincodeDensity[r.hospital_pincode] || 0) + 1;
  });
  const topPincodes = Object.entries(pincodeDensity)
    .map(([pin, count]) => ({ pincode: pin, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Filter lists
  const filteredDonors = donors.filter(donor => {
    if (donorBloodFilter && donor.blood_type !== donorBloodFilter) return false;
    if (donorStatusFilter && donor.account_status !== donorStatusFilter) return false;
    if (donorPincodeSearch && !donor.pincode.includes(donorPincodeSearch)) return false;
    return true;
  });

  const filteredRequests = requests.filter(req => {
    if (reqStatusFilter && req.status !== reqStatusFilter) return false;
    if (reqUrgencyFilter && req.urgency_level !== reqUrgencyFilter) return false;
    if (reqPincodeSearch && !req.hospital_pincode.includes(reqPincodeSearch)) return false;
    return true;
  });

  // Auth Gateway check
  if (!isAdminLoggedIn) {
    return (
      <div id="admin-login-container" className="max-w-md mx-auto my-12 rounded-3xl bg-white/95 backdrop-blur-2xl border border-ink-200/80 shadow-premium-lg overflow-hidden">
        <div className="bg-gradient-to-br from-ink-900 via-ink-950 to-ink-900 p-8 text-white text-center relative overflow-hidden">
          <div className="absolute -top-16 -right-16 h-32 w-32 rounded-full bg-blood-600/20 blur-2xl" aria-hidden />
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl blood-drop-gradient shadow-[0_8px_20px_-4px_rgba(244,63,87,0.5)]">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">{t.admin.loginTitle}</h2>
          <p className="text-ink-300 text-xs mt-1">
            {t.admin.loginSubtitle}
          </p>
        </div>

        <form onSubmit={handleAdminLogin} className="p-8 space-y-5">
          {adminError && (
            <div id="admin-login-error" className="p-3.5 rounded-xl bg-blood-50 text-blood-700 border border-blood-200 text-xs font-semibold">
              {adminError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-700 block">{t.admin.passwordLabel}</label>
            <input
              id="inp-admin-password"
              type="password"
              required
              placeholder={t.admin.passwordPlaceholder}
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-ink-200 bg-white/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blood-500/20 focus:border-blood-500 text-sm font-medium text-ink-900 transition"
            />
          </div>

          <button
            id="btn-admin-login"
            type="submit"
            className="w-full py-3.5 bg-blood-600 hover:bg-blood-700 text-white rounded-xl font-bold text-sm tracking-wide transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            <span>{t.admin.authenticateBtn}</span>
          </button>
        </form>
      </div>
    );
  }

  return (
    <div id="admin-panel-container" className="space-y-8">
      {/* Admin Action Bar */}
      <div className="bg-white/95 backdrop-blur-2xl p-5 rounded-2xl border border-ink-200/80 shadow-premium flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 bg-blood-600 rounded-full animate-ping"></span>
          <h2 className="text-xs sm:text-sm font-bold tracking-tight text-ink-900 font-sans">{t.admin.consoleAuthenticated}</h2>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            id="btn-seed-db"
            onClick={handleSeedDatabase}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-ink-100 hover:bg-ink-200 text-ink-800 rounded-xl font-semibold text-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> {t.admin.seedDemoData}
          </button>
          <button
            id="btn-admin-refresh"
            onClick={loadAdminData}
            className="p-2 bg-ink-100 hover:bg-ink-200 text-ink-800 rounded-xl transition cursor-pointer"
            title="Reload Database"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            id="btn-admin-logout"
            onClick={() => setIsAdminLoggedIn(false)}
            className="px-4 py-2 bg-blood-600 hover:bg-blood-700 text-white rounded-xl font-bold text-xs transition shadow-sm cursor-pointer"
          >
            {t.admin.lockSession}
          </button>
        </div>
      </div>

      {/* Unmatched Requests Live Alert Flag */}
      {unmatchedRequests.length > 0 && (
        <div id="unmatched-alerts-banner" className="bg-blood-50/90 border border-blood-200/80 rounded-2xl p-6 shadow-premium space-y-3">
          <div className="flex items-center gap-2 text-blood-700 font-bold text-xs sm:text-sm">
            <AlertOctagon className="w-5 h-5 text-blood-600" />
            <span>{t.admin.criticalAlertPrefix}: {unmatchedRequests.length} Unmatched Blood Requests Flagged</span>
          </div>
          <p className="text-xs text-ink-700 font-medium leading-relaxed">
            {t.admin.criticalAlertSub}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {unmatchedRequests.map(req => (
              <span key={req.id} className="px-3 py-1 bg-blood-600 text-white rounded-lg text-xs font-mono font-bold shadow-sm">
                {req.tracking_code} ({req.blood_type_needed} at {req.hospital_city})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex bg-ink-100/70 border border-ink-200/80 p-1.5 overflow-x-auto rounded-2xl gap-1">
        {[
          { id: 'analytics', label: t.admin.tabAnalytics, icon: BarChart2 },
          { id: 'donors', label: `${t.admin.tabDonors} (${donors.length})`, icon: Users },
          { id: 'requests', label: `${t.admin.tabRequests} (${requests.length})`, icon: Heart },
          { id: 'matches', label: t.admin.tabMatches, icon: Layers },
          { id: 'notifs', label: t.admin.tabNotifs, icon: MessageSquare },
        ].map(tab => (
          <button
            key={tab.id}
            id={`btn-admin-tab-${tab.id}`}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeSubTab === tab.id
                ? 'bg-white text-ink-900 shadow-sm'
                : 'text-ink-600 hover:text-ink-900 hover:bg-white/50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Content Areas */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-8">
          {/* Key Metrics grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t.admin.matchRate, value: `${matchRate}%`, desc: t.admin.matchRateSub, icon: Activity, color: 'text-ink-800 bg-ink-100' },
              { label: t.admin.fulfillmentRate, value: `${fulfillmentRate}%`, desc: t.admin.fulfillmentRateSub, icon: CheckCircle, color: 'text-blood-600 bg-blood-50' },
              { label: t.admin.donorUtilization, value: `${donorUtilization}%`, desc: t.admin.donorUtilizationSub, icon: Users, color: 'text-ink-800 bg-ink-100' },
              { label: t.admin.avgResponseTime, value: '12 Mins', desc: t.admin.avgResponseTimeSub, icon: Clock, color: 'text-blood-600 bg-blood-50' },
            ].map((metric, idx) => (
              <div key={idx} className="bg-white/95 rounded-2xl border border-ink-200/80 p-6 shadow-premium hover:shadow-premium-lg transition space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-ink-500">{metric.label}</span>
                  <div className={`p-2.5 rounded-xl ${metric.color}`}>
                    <metric.icon className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <h3 className="text-3xl font-bold tracking-tight text-ink-900">{metric.value}</h3>
                  <p className="text-xs text-ink-500 font-medium mt-1">{metric.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Blood type demand heatmap */}
            <div className="bg-white/95 rounded-2xl border border-ink-200/80 p-6 sm:p-8 shadow-premium space-y-6 lg:col-span-2">
              <h3 className="text-sm font-bold tracking-tight text-ink-900 border-b border-ink-100 pb-3 font-sans">{t.admin.demandHeatmapTitle}</h3>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bloodTypeDemandData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'rgba(244,63,87,0.05)' }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {bloodTypeDemandData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.value > 2 ? '#e11d48' : '#fb7185'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Geographic demand density */}
            <div className="bg-white/95 rounded-2xl border border-ink-200/80 p-6 shadow-premium space-y-6 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-ink-900 border-b border-ink-100 pb-3 mb-4 font-sans">{t.admin.topPincodesTitle}</h3>
                {topPincodes.length === 0 ? (
                  <p className="text-xs text-ink-500 font-medium italic text-center py-12">No requests logged yet.</p>
                ) : (
                  <div className="space-y-4">
                    {topPincodes.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <div className="flex items-center gap-2.5">
                          <span className="h-6 w-6 rounded-lg bg-blood-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-ink-800 font-mono">Pincode {item.pincode}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-ink-700 font-mono">{item.count} Req(s)</span>
                          <div className="w-20 bg-ink-100 h-2.5 rounded-full overflow-hidden">
                            <div className="bg-blood-600 h-full rounded-full transition-all" style={{ width: `${(item.count / topPincodes[0].count) * 100}%` }}></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-ink-100 text-xs text-ink-500 font-medium leading-relaxed flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blood-600 flex-shrink-0" />
                <span>Geographic matches prioritize exact matching, then expand adjacent city rings automatically.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'donors' && (
        <div className="bg-white/95 backdrop-blur-2xl p-6 sm:p-8 rounded-2xl border border-ink-200/80 shadow-premium space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center border-b border-ink-100 pb-4">
            <h3 className="font-bold text-sm tracking-tight text-ink-900 font-sans">{t.admin.donorsTableTitle}</h3>
            
            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                id="sel-admin-filter-blood"
                value={donorBloodFilter}
                onChange={e => setDonorBloodFilter(e.target.value)}
                className="px-3 py-1.5 bg-ink-50 border border-ink-200 rounded-xl text-xs font-semibold text-ink-800 focus:outline-none focus:ring-2 focus:ring-blood-500/20 focus:bg-white transition"
              >
                <option value="">{t.admin.allBloodTypes}</option>
                {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <select
                id="sel-admin-filter-status"
                value={donorStatusFilter}
                onChange={e => setDonorStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-ink-50 border border-ink-200 rounded-xl text-xs font-semibold text-ink-800 focus:outline-none focus:ring-2 focus:ring-blood-500/20 focus:bg-white transition"
              >
                <option value="">{t.admin.allStatuses}</option>
                <option value="active">Active</option>
                <option value="cooldown">Cooldown</option>
                <option value="unavailable">Unavailable</option>
                <option value="banned">Banned</option>
              </select>

              <input
                id="inp-admin-search-pin"
                type="text"
                placeholder={t.admin.searchPincode}
                value={donorPincodeSearch}
                onChange={e => setDonorPincodeSearch(e.target.value)}
                className="px-3 py-1.5 bg-ink-50 border border-ink-200 rounded-xl text-xs font-medium text-ink-800 focus:outline-none focus:ring-2 focus:ring-blood-500/20 w-32 focus:bg-white font-mono transition"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-ink-100 text-ink-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 font-sans">{t.admin.colDonorName}</th>
                  <th className="py-3 font-sans">{t.admin.colBloodType}</th>
                  <th className="py-3 font-sans">{t.admin.colPincode}</th>
                  <th className="py-3 font-sans">{t.admin.colStatus}</th>
                  <th className="py-3 font-sans">{t.admin.colLastDonation}</th>
                  <th className="py-3 text-right font-sans">{t.admin.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100/70">
                {filteredDonors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-ink-400 italic font-medium">No matching donors in pool.</td>
                  </tr>
                ) : (
                  filteredDonors.map(donor => (
                    <tr key={donor.id} className="hover:bg-ink-50/60 transition-colors">
                      <td className="py-4">
                        <div className="font-bold text-ink-900">{donor.full_name}</div>
                        <div className="text-[11px] font-mono text-ink-500 mt-0.5">{donor.email} | {donor.phone}</div>
                      </td>
                      <td className="py-4 font-mono font-bold text-blood-600 text-sm">{donor.blood_type}</td>
                      <td className="py-4">
                        <div className="font-mono font-bold text-ink-800">{donor.pincode}</div>
                        <div className="text-[11px] text-ink-500">{donor.area}, {donor.city}</div>
                      </td>
                      <td className="py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide ${
                          donor.account_status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          donor.account_status === 'cooldown' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          donor.account_status === 'banned' ? 'bg-blood-50 text-blood-700 border border-blood-200' : 'bg-ink-100 text-ink-700'
                        }`}>
                          {donor.account_status.toUpperCase()}
                        </span>
                        {donor.cooldown_until && (
                          <div className="text-[10px] text-amber-600 font-mono font-semibold mt-1">Until: {donor.cooldown_until}</div>
                        )}
                      </td>
                      <td className="py-4 font-mono font-medium text-ink-600">{donor.last_donation_date || 'Never'}</td>
                      <td className="py-4 text-right space-x-1.5 whitespace-nowrap">
                        {donor.account_status === 'cooldown' ? (
                          <button
                            id={`btn-admin-lift-${donor.id}`}
                            onClick={() => handleLiftCooldown(donor.id)}
                            className="px-3 py-1.5 bg-white hover:bg-ink-900 hover:text-white border border-ink-200 rounded-lg text-[11px] font-semibold tracking-wide transition-all shadow-sm cursor-pointer"
                          >
                            {t.admin.btnLiftCooldown}
                          </button>
                        ) : (
                          <button
                            id={`btn-admin-force-${donor.id}`}
                            onClick={() => handleForceCooldown(donor.id)}
                            disabled={donor.account_status === 'banned'}
                            className="px-3 py-1.5 bg-white hover:bg-blood-600 hover:text-white hover:border-blood-600 border border-ink-200 rounded-lg text-[11px] font-semibold tracking-wide transition-all shadow-sm disabled:opacity-40 cursor-pointer"
                          >
                            {t.admin.btnForceCooldown}
                          </button>
                        )}

                        {donor.account_status === 'banned' ? (
                          <button
                            id={`btn-admin-unban-${donor.id}`}
                            onClick={() => handleUnbanDonor(donor.id)}
                            className="px-3 py-1.5 bg-white hover:bg-ink-900 hover:text-white border border-ink-200 rounded-lg text-[11px] font-semibold tracking-wide transition-all shadow-sm cursor-pointer"
                          >
                            {t.admin.btnUnban}
                          </button>
                        ) : (
                          <button
                            id={`btn-admin-ban-${donor.id}`}
                            onClick={() => {
                               setBanDonorId(donor.id);
                               setBanReason('');
                            }}
                            className="px-3 py-1.5 bg-white hover:bg-blood-600 hover:text-white hover:border-blood-600 border border-ink-200 rounded-lg text-[11px] font-semibold tracking-wide transition-all shadow-sm cursor-pointer"
                          >
                            {t.admin.btnBan}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Ban Reason modal block */}
          {banDonorId && (
            <div id="ban-modal" className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-ink-200 max-w-sm w-full space-y-4 shadow-premium-lg">
                <h4 className="font-bold text-sm tracking-tight text-ink-900 flex items-center gap-2 pb-3 border-b border-ink-100">
                  <ShieldAlert className="text-blood-600 w-5 h-5" /> Ban Volunteer Account
                </h4>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink-700 block">Reason for Ban</label>
                  <textarea
                    id="inp-ban-reason"
                    rows={3}
                    placeholder="e.g. Inactive spamming, false reporting..."
                    value={banReason}
                    onChange={e => setBanReason(e.target.value)}
                    className="w-full px-3 py-2 bg-ink-50 border border-ink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blood-500/20 focus:bg-white text-ink-900 text-xs font-medium"
                  ></textarea>
                </div>
                <div className="flex gap-2.5">
                  <button
                    id="btn-confirm-ban"
                    onClick={handleBanSubmit}
                    className="flex-1 py-2.5 bg-blood-600 hover:bg-blood-700 text-white rounded-xl font-bold text-xs tracking-wide shadow-md cursor-pointer transition"
                  >
                    Confirm Ban
                  </button>
                  <button
                    id="btn-cancel-ban"
                    onClick={() => setBanDonorId(null)}
                    className="flex-1 py-2.5 bg-ink-100 hover:bg-ink-200 text-ink-800 rounded-xl font-bold text-xs tracking-wide cursor-pointer transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'requests' && (
        <div className="bg-white/95 backdrop-blur-2xl p-6 sm:p-8 rounded-2xl border border-ink-200/80 shadow-premium space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center border-b border-ink-100 pb-4">
            <h3 className="font-bold text-sm tracking-tight text-ink-900 font-sans">{t.admin.requestsTableTitle}</h3>
            
            <div className="flex flex-wrap items-center gap-2">
              <select
                id="sel-req-filter-status"
                value={reqStatusFilter}
                onChange={e => setReqStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-ink-50 border border-ink-200 rounded-xl text-xs font-semibold text-ink-800 focus:outline-none focus:ring-2 focus:ring-blood-500/20 focus:bg-white transition"
              >
                <option value="">{t.admin.allStatuses}</option>
                <option value="open">Awaiting Matches</option>
                <option value="matching">Matching</option>
                <option value="partially_matched">Partially Matched</option>
                <option value="fulfilled">Fulfilled</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select
                id="sel-req-filter-urgency"
                value={reqUrgencyFilter}
                onChange={e => setReqUrgencyFilter(e.target.value)}
                className="px-3 py-1.5 bg-ink-50 border border-ink-200 rounded-xl text-xs font-semibold text-ink-800 focus:outline-none focus:ring-2 focus:ring-blood-500/20 focus:bg-white transition"
              >
                <option value="">{t.admin.allUrgencies}</option>
                <option value="critical">Critical</option>
                <option value="urgent">Urgent</option>
                <option value="planned">Planned</option>
              </select>

              <input
                id="inp-req-search-pin"
                type="text"
                placeholder={t.admin.searchHospitalPin}
                value={reqPincodeSearch}
                onChange={e => setReqPincodeSearch(e.target.value)}
                className="px-3 py-1.5 bg-ink-50 border border-ink-200 rounded-xl text-xs font-medium text-ink-800 focus:outline-none focus:ring-2 focus:ring-blood-500/20 w-32 focus:bg-white font-mono transition"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-ink-100 text-ink-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 font-sans">{t.admin.colTrackingCode}</th>
                  <th className="py-3 font-sans">{t.admin.colPatient}</th>
                  <th className="py-3 font-sans">{t.admin.colBloodType}</th>
                  <th className="py-3 font-sans">{t.admin.colUnits}</th>
                  <th className="py-3 font-sans">{t.admin.colPincode}</th>
                  <th className="py-3 font-sans">{t.admin.colUrgency}</th>
                  <th className="py-3 font-sans">{t.admin.colStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100/70">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-ink-400 italic font-medium">No matching blood requests in system.</td>
                  </tr>
                ) : (
                  filteredRequests.map(req => (
                    <tr key={req.id} className="hover:bg-ink-50/60 transition-colors">
                      <td className="py-4 font-mono font-bold text-ink-900">{req.tracking_code}</td>
                      <td className="py-4">
                        <div className="font-bold text-ink-900">{req.patient_name}</div>
                        <div className="text-[11px] text-ink-500 font-mono mt-0.5">By: {req.requester_name} ({req.requester_phone})</div>
                      </td>
                      <td className="py-4"><span className="px-2.5 py-1 bg-blood-50 text-blood-700 border border-blood-200 rounded-lg font-mono font-bold text-xs">{req.blood_type_needed}</span></td>
                      <td className="py-4 font-mono font-bold text-ink-900 text-sm">{req.units_required}</td>
                      <td className="py-4">
                        <div className="font-bold text-ink-900">{req.hospital_name}</div>
                        <div className="text-[11px] text-ink-500 font-mono mt-0.5">{req.hospital_pincode} | {req.hospital_city}</div>
                      </td>
                      <td className="py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide ${
                          req.urgency_level === 'critical' ? 'bg-blood-50 text-blood-700 border border-blood-200' :
                          req.urgency_level === 'urgent' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-ink-100 text-ink-700'
                        }`}>
                          {req.urgency_level.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide ${
                          req.status === 'open' ? 'bg-ink-100 text-ink-700' :
                          req.status === 'matching' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          req.status === 'partially_matched' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          req.status === 'fulfilled' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-ink-100 text-ink-600'
                        }`}>
                          {req.status.toUpperCase().replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'matches' && (
        <div className="bg-white/95 backdrop-blur-2xl p-6 sm:p-8 rounded-2xl border border-ink-200/80 shadow-premium space-y-6">
          <h3 className="font-bold text-sm tracking-tight text-ink-900 border-b border-ink-100 pb-3 font-sans">{t.admin.matchesTableTitle}</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-ink-100 text-ink-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 font-sans">{t.admin.colRequestId}</th>
                  <th className="py-3 font-sans">Donor Match Details</th>
                  <th className="py-3 font-sans">{t.admin.colMatchRank}</th>
                  <th className="py-3 font-sans">{t.admin.colNotified}</th>
                  <th className="py-3 font-sans">{t.admin.colResponse}</th>
                  <th className="py-3 font-sans">{t.admin.colOutcome}</th>
                  <th className="py-3 text-right font-sans">{t.admin.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100/70">
                {matches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-ink-400 italic font-medium">No matches created. Submit a blood request to trigger matching.</td>
                  </tr>
                ) : (
                  matches.map(m => {
                    const req = requests.find(r => r.id === m.request_id);
                    const donor = donors.find(d => d.id === m.donor_id);

                    return (
                      <tr key={m.id} className="hover:bg-ink-50/60 transition-colors">
                        <td className="py-4 font-mono font-bold text-ink-900">{req?.tracking_code || 'Deleted'}</td>
                        <td className="py-4">
                          <div className="font-bold text-ink-900">{donor?.full_name || 'Deleted'}</div>
                          <div className="text-[11px] font-mono text-ink-500 mt-0.5">{donor?.blood_type} | Pin: {donor?.pincode}</div>
                        </td>
                        <td className="py-4 font-mono font-bold text-ink-900">Rank #{m.match_rank}</td>
                        <td className="py-4 text-[11px] font-mono text-ink-500">{m.notification_sent_at ? new Date(m.notification_sent_at).toLocaleTimeString() : 'N/A'}</td>
                        <td className="py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide ${
                            m.donor_response === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            m.donor_response === 'declined' ? 'bg-ink-100 text-ink-700' : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {m.donor_response.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-4 font-mono font-semibold text-ink-700">{m.outcome || 'N/A'}</td>
                        <td className="py-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            id={`btn-ov-approve-${m.id}`}
                            onClick={() => handleOverrideMatchStatus(m.id, 'approved')}
                            disabled={m.donor_response === 'approved'}
                            className="px-3 py-1.5 bg-white hover:bg-emerald-600 hover:text-white hover:border-emerald-600 border border-ink-200 rounded-lg text-[11px] font-semibold tracking-wide transition-all shadow-sm disabled:opacity-40 cursor-pointer"
                          >
                            {t.admin.btnApprove}
                          </button>
                          <button
                            id={`btn-ov-decline-${m.id}`}
                            onClick={() => handleOverrideMatchStatus(m.id, 'declined')}
                            disabled={m.donor_response === 'declined'}
                            className="px-3 py-1.5 bg-white hover:bg-ink-900 hover:text-white border border-ink-200 rounded-lg text-[11px] font-semibold tracking-wide transition-all shadow-sm disabled:opacity-40 cursor-pointer"
                          >
                            {t.admin.btnDecline}
                          </button>
                          <button
                            id={`btn-ov-donated-${m.id}`}
                            onClick={() => handleOverrideMatchStatus(m.id, 'donated')}
                            disabled={m.outcome === 'donated'}
                            className="px-3 py-1.5 bg-blood-600 hover:bg-blood-700 text-white rounded-lg text-[11px] font-semibold tracking-wide transition-all shadow-sm disabled:opacity-40 cursor-pointer"
                          >
                            {t.admin.btnMarkDonated}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'notifs' && (
        <div className="bg-white/95 backdrop-blur-2xl p-6 sm:p-8 rounded-2xl border border-ink-200/80 shadow-premium space-y-6">
          <h3 className="font-bold text-sm tracking-tight text-ink-900 border-b border-ink-100 pb-3 font-sans">{t.admin.notifsTableTitle}</h3>
          
          <div className="overflow-y-auto max-h-[480px] space-y-4 pr-2">
            {notifications.filter(n => n.type === 'whatsapp' || n.type === 'sms').length === 0 ? (
              <p className="text-xs text-ink-400 italic font-medium text-center py-12">No communication logs recorded.</p>
            ) : (
              notifications.filter(n => n.type === 'whatsapp' || n.type === 'sms').map(log => (
                <div key={log.id} className="p-4 bg-ink-50/70 rounded-xl border border-ink-200/80 space-y-2.5 text-xs shadow-sm">
                  <div className="flex justify-between items-center text-[11px] text-ink-500 font-semibold uppercase">
                    <span className="font-bold text-blood-600 uppercase tracking-wide">{log.type} {t.admin.gatewayLog}</span>
                    <span className="font-mono text-[10px]">{log.sent_at ? new Date(log.sent_at).toLocaleString() : 'Pending'}</span>
                  </div>
                  <div className="font-mono bg-white p-3 rounded-lg border border-ink-200 text-ink-800 whitespace-pre-wrap leading-relaxed text-xs">
                    {log.message_body}
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-ink-500 font-medium">
                    <span>{t.admin.recipientId}: <strong className="text-ink-900 font-mono">{log.recipient_id}</strong> ({log.recipient_type})</span>
                    <span className="bg-blood-50 text-blood-700 border border-blood-200 font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full text-[10px]">{log.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
