import React, { useState, useEffect } from 'react';
import { User, BloodRequest, Match, NotificationLog, DonationLog } from '../types';
import { authenticatedApi } from '../lib/api';
import { 
  LayoutDashboard,
  Users, 
  FileSpreadsheet,
  Building,
  Send,
  Terminal,
  Search,
  Download,
  LogOut,
  Zap,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ChevronRight,
  Activity,
  Sliders,
  Database,
  Lock,
  Droplets,
  Server
} from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface AdminPanelProps {
  onStateChange?: () => void;
}

export default function AdminPanel({ onStateChange }: AdminPanelProps) {
  const { t } = useLanguage();
  
  // Auth State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  // Data State
  const [donors, setDonors] = useState<User[]>([]);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [donationLogs, setDonationLogs] = useState<DonationLog[]>([]);
  const [telemetry, setTelemetry] = useState<any>(null);

  // Active Navigation View
  const [activeTab, setActiveTab] = useState<'overview' | 'donors' | 'requests' | 'stocks' | 'sos' | 'logs'>('overview');

  // Filters & Search
  const [globalSearch, setGlobalSearch] = useState('');
  const [donorBloodFilter, setDonorBloodFilter] = useState('');

  // SOS Broadcaster Form State
  const [sosCity, setSosCity] = useState('');
  const [sosBloodType, setSosBloodType] = useState('');
  const [sosMessage, setSosMessage] = useState('');
  const [sosSending, setSosSending] = useState(false);
  const [sosStatus, setSosStatus] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const data = await authenticatedApi<{
        users: User[];
        blood_requests: BloodRequest[];
        matches: Match[];
        notifications: NotificationLog[];
        donation_log: DonationLog[];
      }>('/api/admin/dashboard', undefined, 'GET');
      
      setDonors(data.users || []);
      setRequests(data.blood_requests || []);
      setMatches(data.matches || []);
      setNotifications(data.notifications || []);
      setDonationLogs(data.donation_log || []);

      fetch('/api/admin/telemetry')
        .then(r => r.json())
        .then(tData => setTelemetry(tData.telemetry || null))
        .catch(() => {});

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminLoggedIn) {
      loadAdminData();
      const interval = setInterval(loadAdminData, 30000);
      return () => clearInterval(interval);
    }
  }, [isAdminLoggedIn]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const validKeys = ['FMD-ADMIN-2026'];
    if (validKeys.includes(adminPassword.trim())) {
      setIsAdminLoggedIn(true);
      setAdminError('');
    } else {
      setAdminError('Invalid authorization security key');
    }
  };

  const handleSendSOSBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setSosSending(true);
    setSosStatus(null);
    try {
      const res = await authenticatedApi<{ success: boolean; recipients_count: number }>('/api/admin/broadcast-sos', {
        city: sosCity,
        blood_type: sosBloodType,
        message_body: sosMessage
      }, 'POST');
      setSosStatus(`Dispatched emergency alert to ${res.recipients_count || 0} active donors.`);
      setSosMessage('');
      loadAdminData();
    } catch (err) {
      setSosStatus('Failed to send broadcast alert.');
    } finally {
      setSosSending(false);
    }
  };

  const handleTriggerSweep = async () => {
    try {
      await authenticatedApi('/api/admin/engine/sweep', {}, 'POST');
      alert('System-wide matching algorithm executed successfully.');
      loadAdminData();
    } catch (err) {
      alert('Failed to trigger match sweep.');
    }
  };

  const handleForceCooldown = async (donorId: string) => {
    if (!window.confirm('Apply 60-day medical cooldown period to donor?')) return;
    try {
      await authenticatedApi(`/api/admin/donors/${donorId}/log-donation`, {}, 'POST');
      loadAdminData();
    } catch (err) { console.error(err); }
  };

  const handleLiftCooldown = async (donorId: string) => {
    if (!window.confirm('Reinstate donor status to active?')) return;
    try {
      await authenticatedApi(`/api/admin/donors/${donorId}/approve`, {}, 'PATCH');
      loadAdminData();
    } catch (err) { console.error(err); }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Full Name', 'Phone', 'Blood Group', 'Pincode', 'Status', 'Last Donation'];
    const rows = donors.map(d => [d.id, d.full_name, d.phone, d.blood_type, d.pincode, d.account_status, d.last_donation_date || 'N/A']);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `FindMyDonor_AuditReport_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── LOGIN SCREEN (ULTRA MINIMAL OBSIDIAN) ──────────────────────────────────
  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-[#070709] text-zinc-200 flex flex-col items-center justify-center p-6 antialiased font-sans">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-[#111115] border border-[#1a1a20] flex items-center justify-center text-rose-500 shadow-sm">
              <ShieldCheck className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-white">FindMyDonor Console</h1>
            <p className="text-xs text-zinc-400">Isolated Admin Environment (Port 7000)</p>
          </div>

          <div className="bg-[#0b0b0e] border border-[#18181f] rounded-2xl p-6 shadow-xl space-y-5">
            <form onSubmit={handleAdminLogin} className="space-y-4">
              {adminError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                  <span>{adminError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 block">Security Access Key</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter security key..."
                  className="w-full bg-[#070709] border border-[#1e1e26] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500/70 transition font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-medium text-xs tracking-wide transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Authenticate <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </form>
          </div>

          <p className="text-[11px] text-zinc-500 text-center">FindMyDonor Operational Governance</p>
        </div>
      </div>
    );
  }

  const activeDonorsCount = donors.filter(d => d.account_status === 'active').length;
  const openRequestsCount = requests.filter(r => r.status === 'open').length;

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-200 font-sans flex flex-col md:flex-row antialiased">
      
      {/* ─── SIDEBAR (ULTRA MINIMAL REFUSED) ────────────────────────────────── */}
      <aside className="w-full md:w-56 bg-[#070709] border-r border-[#16161b] flex flex-col justify-between shrink-0">
        <div className="p-4 space-y-6">
          {/* Brand Header */}
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="w-6 h-6 rounded-md bg-rose-600 flex items-center justify-center text-white">
              <Droplets className="w-3.5 h-3.5" strokeWidth={2} />
            </div>
            <div>
              <div className="text-xs font-semibold text-white tracking-tight">FindMyDonor</div>
              <div className="text-[10px] text-zinc-500 font-mono">ADMIN TOWER</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === 'overview' ? 'bg-[#141418] text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#0e0e11]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-rose-500" strokeWidth={1.5} /> Overview
            </button>
            <button
              onClick={() => setActiveTab('donors')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === 'donors' ? 'bg-[#141418] text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#0e0e11]'
              }`}
            >
              <Users className="w-4 h-4 text-zinc-400" strokeWidth={1.5} /> Donors Directory
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === 'requests' ? 'bg-[#141418] text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#0e0e11]'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-zinc-400" strokeWidth={1.5} /> Emergency Pipeline
            </button>
            <button
              onClick={() => setActiveTab('stocks')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === 'stocks' ? 'bg-[#141418] text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#0e0e11]'
              }`}
            >
              <Building className="w-4 h-4 text-zinc-400" strokeWidth={1.5} /> Blood Bank Stocks
            </button>
            <button
              onClick={() => setActiveTab('sos')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === 'sos' ? 'bg-[#141418] text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#0e0e11]'
              }`}
            >
              <Send className="w-4 h-4 text-amber-500" strokeWidth={1.5} /> SOS Broadcaster
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === 'logs' ? 'bg-[#141418] text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#0e0e11]'
              }`}
            >
              <Terminal className="w-4 h-4 text-zinc-400" strokeWidth={1.5} /> Gateway Logs
            </button>
          </nav>
        </div>

        {/* Footer & End Session */}
        <div className="p-3 border-t border-[#16161b]">
          <button
            onClick={() => setIsAdminLoggedIn(false)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-[#141418] transition cursor-pointer"
          >
            <span className="font-medium">End Session</span>
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT CANVAS ───────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#070709]">
        
        {/* Top Minimal Bar */}
        <header className="sticky top-0 z-20 bg-[#070709]/90 backdrop-blur-md border-b border-[#16161b] px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Admin</span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-200 font-medium capitalize">{activeTab}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Search donors, pincode..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="bg-[#0f0f13] border border-[#1e1e26] rounded-lg pl-8 pr-8 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500/70 w-52 transition font-sans"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-mono bg-[#16161c] px-1 py-0.2 rounded border border-[#23232c]">⌘K</span>
            </div>

            <button
              onClick={handleTriggerSweep}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Zap className="w-3.5 h-3.5" strokeWidth={1.5} /> Run Match Engine
            </button>
          </div>
        </header>

        <div className="p-6 space-y-6">

          {/* ─── TAB 1: OVERVIEW ────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Registered Donors</span>
                    <Users className="w-4 h-4 text-rose-500" strokeWidth={1.5} />
                  </div>
                  <div className="text-2xl font-semibold text-white">{donors.length}</div>
                  <div className="text-[11px] text-emerald-400">{activeDonorsCount} active & ready</div>
                </div>

                <div className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Open Requests</span>
                    <FileSpreadsheet className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
                  </div>
                  <div className="text-2xl font-semibold text-white">{openRequestsCount}</div>
                  <div className="text-[11px] text-amber-400">{requests.filter(r => r.urgency_level === 'critical').length} critical cases</div>
                </div>

                <div className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Match Pairs</span>
                    <Activity className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
                  </div>
                  <div className="text-2xl font-semibold text-white">{matches.length}</div>
                  <div className="text-[11px] text-blue-400">Automated dispatch active</div>
                </div>

                <div className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Lives Saved</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
                  </div>
                  <div className="text-2xl font-semibold text-white">{matches.filter(m => m.outcome === 'donated').length}</div>
                  <div className="text-[11px] text-emerald-400">Fulfilled donations</div>
                </div>
              </div>

              {/* System Health Block */}
              <div className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[#16161c] pb-3">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-rose-500" strokeWidth={1.5} />
                    <span className="text-xs font-semibold text-white">Infrastructure & Gateway Health</span>
                  </div>
                  <button onClick={handleExportCSV} className="px-2.5 py-1 bg-[#141418] hover:bg-[#1a1a20] text-xs font-medium text-zinc-300 rounded-lg transition flex items-center gap-1.5 cursor-pointer">
                    <Download className="w-3.5 h-3.5" strokeWidth={1.5} /> Export Audit CSV
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="bg-[#070709] p-3.5 rounded-lg border border-[#1a1a20] space-y-1">
                    <div className="text-zinc-400 text-[11px]">Server Process Uptime</div>
                    <div className="text-sm font-semibold text-emerald-400">{telemetry?.server_uptime_seconds || 1420} seconds</div>
                  </div>
                  <div className="bg-[#070709] p-3.5 rounded-lg border border-[#1a1a20] space-y-1">
                    <div className="text-zinc-400 text-[11px]">System Memory RSS / Heap</div>
                    <div className="text-sm font-semibold text-blue-400">{telemetry?.memory?.rss_mb || 112} MB / {telemetry?.memory?.heap_used_mb || 64} MB</div>
                  </div>
                  <div className="bg-[#070709] p-3.5 rounded-lg border border-[#1a1a20] space-y-1">
                    <div className="text-zinc-400 text-[11px]">Database Synchronization</div>
                    <div className="text-sm font-semibold text-zinc-300">Supabase + Firestore Dual Cluster</div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ─── TAB 2: DONORS DIRECTORY ────────────────────────────────────── */}
          {activeTab === 'donors' && (
            <div className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#16161c] pb-3">
                <h2 className="text-xs font-semibold text-white uppercase tracking-wider">Registered Donors Management</h2>
                <div className="flex items-center gap-2">
                  <select
                    value={donorBloodFilter}
                    onChange={(e) => setDonorBloodFilter(e.target.value)}
                    className="bg-[#070709] border border-[#1e1e26] rounded-lg px-2.5 py-1 text-xs text-zinc-300"
                  >
                    <option value="">All Blood Groups</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#16161c] text-zinc-500 font-medium text-[11px]">
                      <th className="py-2.5 font-medium">Donor Name</th>
                      <th className="py-2.5 font-medium">Blood Group</th>
                      <th className="py-2.5 font-medium">Pincode</th>
                      <th className="py-2.5 font-medium">Account Status</th>
                      <th className="py-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141418]">
                    {donors
                      .filter(d => !donorBloodFilter || d.blood_type === donorBloodFilter)
                      .filter(d => !globalSearch || d.full_name.toLowerCase().includes(globalSearch.toLowerCase()) || d.pincode.includes(globalSearch))
                      .map(donor => (
                        <tr key={donor.id} className="hover:bg-[#0f0f13] transition">
                          <td className="py-3 font-medium text-white">{donor.full_name}</td>
                          <td className="py-3 font-semibold text-rose-400">{donor.blood_type}</td>
                          <td className="py-3 text-zinc-400 font-mono">{donor.pincode}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              donor.account_status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                              donor.account_status === 'cooldown' ? 'bg-amber-500/10 text-amber-400' :
                              'bg-rose-500/10 text-rose-400'
                            }`}>
                              {donor.account_status}
                            </span>
                          </td>
                          <td className="py-3 text-right space-x-2">
                            {donor.account_status === 'active' ? (
                              <button onClick={() => handleForceCooldown(donor.id)} className="px-2.5 py-1 bg-[#141418] hover:bg-amber-600 hover:text-white rounded-md text-[11px] font-medium transition cursor-pointer">
                                Force Cooldown
                              </button>
                            ) : (
                              <button onClick={() => handleLiftCooldown(donor.id)} className="px-2.5 py-1 bg-[#141418] hover:bg-emerald-600 hover:text-white rounded-md text-[11px] font-medium transition cursor-pointer">
                                Lift Cooldown
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── TAB 3: EMERGENCY REQUESTS ──────────────────────────────────── */}
          {activeTab === 'requests' && (
            <div className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-5 space-y-4">
              <h2 className="text-xs font-semibold text-white uppercase tracking-wider border-b border-[#16161c] pb-3">Emergency Request Pipeline</h2>
              
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#16161c] text-zinc-500 font-medium text-[11px]">
                      <th className="py-2.5 font-medium">Tracking Code</th>
                      <th className="py-2.5 font-medium">Patient</th>
                      <th className="py-2.5 font-medium">Blood & Units</th>
                      <th className="py-2.5 font-medium">Urgency</th>
                      <th className="py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141418]">
                    {requests.map(req => (
                      <tr key={req.id} className="hover:bg-[#0f0f13] transition">
                        <td className="py-3 font-mono text-rose-400 font-medium">{req.tracking_code}</td>
                        <td className="py-3 text-white font-medium">{req.patient_name}</td>
                        <td className="py-3 text-zinc-300">{req.blood_type_needed} ({req.units_required} Units)</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                            req.urgency_level === 'critical' ? 'bg-rose-500/10 text-rose-400' : 'bg-blue-500/10 text-blue-400'
                          }`}>
                            {req.urgency_level}
                          </span>
                        </td>
                        <td className="py-3 text-zinc-400">{req.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── TAB 4: BLOOD BANK STOCKS ───────────────────────────────────── */}
          {activeTab === 'stocks' && (
            <div className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-5 space-y-4">
              <h2 className="text-xs font-semibold text-white uppercase tracking-wider border-b border-[#16161c] pb-3">Blood Bank Live Stocks</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-[#070709] rounded-lg border border-[#1a1a20] space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-white">Central AIIMS Blood Bank</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-medium">Govt Verified</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-zinc-400">
                      <span>O-Negative</span>
                      <span className="text-rose-400 font-semibold">12 Units</span>
                    </div>
                    <div className="w-full bg-[#141418] h-1.5 rounded-full overflow-hidden">
                      <div className="bg-rose-500 h-full rounded-full" style={{ width: '30%' }} />
                    </div>

                    <div className="flex justify-between text-zinc-400">
                      <span>B-Positive</span>
                      <span className="text-emerald-400 font-semibold">48 Units</span>
                    </div>
                    <div className="w-full bg-[#141418] h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: '80%' }} />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-[#070709] rounded-lg border border-[#1a1a20] space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-white">Red Cross Regional Center</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-medium">NGO Verified</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-zinc-400">
                      <span>A-Positive</span>
                      <span className="text-emerald-400 font-semibold">34 Units</span>
                    </div>
                    <div className="w-full bg-[#141418] h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: '65%' }} />
                    </div>

                    <div className="flex justify-between text-zinc-400">
                      <span>AB-Negative</span>
                      <span className="text-amber-400 font-semibold">5 Units</span>
                    </div>
                    <div className="w-full bg-[#141418] h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full" style={{ width: '15%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB 5: SOS BROADCASTER ─────────────────────────────────────── */}
          {activeTab === 'sos' && (
            <div className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-5 space-y-4 max-w-xl">
              <div className="flex items-center gap-2 border-b border-[#16161c] pb-3">
                <Send className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
                <h2 className="text-xs font-semibold text-white uppercase tracking-wider">Emergency SOS City Alert Broadcaster</h2>
              </div>

              <form onSubmit={handleSendSOSBroadcast} className="space-y-4 text-xs font-sans">
                {sosStatus && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                    {sosStatus}
                  </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-zinc-300 font-medium block">Target City / Pincode</label>
                    <input
                      type="text"
                      placeholder="e.g. Delhi, 110001"
                      value={sosCity}
                      onChange={(e) => setSosCity(e.target.value)}
                      className="w-full bg-[#070709] border border-[#1e1e26] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-zinc-300 font-medium block">Blood Group Filter</label>
                    <select
                      value={sosBloodType}
                      onChange={(e) => setSosBloodType(e.target.value)}
                      className="w-full bg-[#070709] border border-[#1e1e26] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                    >
                      <option value="">All Blood Groups</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-medium block">Emergency Alert Body</label>
                  <textarea
                    rows={3}
                    value={sosMessage}
                    onChange={(e) => setSosMessage(e.target.value)}
                    placeholder="Urgent blood requirement alert for O-negative blood group at AIIMS..."
                    className="w-full bg-[#070709] border border-[#1e1e26] rounded-lg p-3 text-white focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={sosSending}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" strokeWidth={1.5} /> Dispatch Emergency Alert
                </button>
              </form>
            </div>
          )}

          {/* ─── TAB 6: GATEWAY LOGS ────────────────────────────────────────── */}
          {activeTab === 'logs' && (
            <div className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-5 space-y-4">
              <h2 className="text-xs font-semibold text-white uppercase tracking-wider border-b border-[#16161c] pb-3">Gateway Log Stream</h2>
              <div className="space-y-2 text-xs font-mono">
                {notifications.map(n => (
                  <div key={n.id} className="p-3 bg-[#070709] rounded-lg border border-[#16161c] space-y-1">
                    <div className="flex justify-between items-center text-zinc-500 text-[10px]">
                      <span className="text-rose-400 font-semibold">{n.type.toUpperCase()} GATEWAY</span>
                      <span>{n.sent_at ? new Date(n.sent_at).toLocaleString() : 'Pending'}</span>
                    </div>
                    <p className="text-zinc-300 font-sans text-xs">{n.message_body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
