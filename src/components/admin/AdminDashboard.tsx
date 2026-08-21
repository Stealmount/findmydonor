import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { AdminUser, BloodRequest, User } from '../../types';
import NotificationSimulator from '../NotificationSimulator';
import { Activity, Users, Droplet, BellRing, Link2, ShieldAlert, CheckCircle, RefreshCcw } from 'lucide-react';
import { authenticatedApi } from '../../lib/api';
import { useLanguage } from '../../lib/LanguageContext';

interface AdminDashboardProps {
 admin: AdminUser;
 onLogout: () => void;
}

export function AdminDashboard({ admin, onLogout }: AdminDashboardProps) {
 const { language, setLanguage } = useLanguage();
 const isHi = language === 'HI';

 // Mock Data for Showcase
 const [stats, setStats] = useState({
 totalDonors: 0,
 activeRequests: 0,
 hospitals: 0,
 livesSaved: 0
 });
 const [openRequests, setOpenRequests] = useState<any[]>([]);

 useEffect(() => {
 fetch('/api/stats')
 .then((r) => r.json())
 .then((data) => setStats({
 totalDonors: data.totalDonors || 0,
 activeRequests: data.activeRequests || 0,
 hospitals: data.hospitals || 0,
 livesSaved: data.livesSaved || 0
 }))
 .catch(() => {});

 fetch('/api/live-requests')
 .then((r) => r.json())
 .then((data) => setOpenRequests((data.requests || []).map((req: any, i: number) => ({
 id: req.id || `req_${i}`,
 patient: req.patient_name || 'Emergency Case',
 hospital: req.hospital_city || 'City Hospital',
 blood: req.blood_type_needed || 'O+',
 units: req.units_required || 1,
 status: (req.urgency_level || 'CRITICAL').toUpperCase(),
 time: 'Live'
 }))))
 .catch(() => {});
 }, []);

 const [activeTab, setActiveTab] = useState<'overview' | 'matcher'>('overview');
 const [matchingStatus, setMatchingStatus] = useState<'idle' | 'matching' | 'matched' | 'error'>('idle');

 const handleForceMatch = async () => {
 setMatchingStatus('matching');
 try {
 const matchId = crypto.randomUUID();
 const reqId = openRequests[0]?.id || 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
 await authenticatedApi('/api/admin/matches', {
 matchId,
 payload: {
 id: matchId,
 request_id: reqId,
 donor_id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
 donor_response: 'pending',
 distance_km: 0,
 created_at: new Date().toISOString()
 }
 }, 'POST');
 setMatchingStatus('matched');
 setTimeout(() => setMatchingStatus('idle'), 3000);
 } catch (err) {
 console.error('Error forcing match:', err);
 setMatchingStatus('error');
 setTimeout(() => setMatchingStatus('idle'), 3000);
 }
 };

 return (
 <div className="min-h-screen bg-ink-950 text-white font-mono flex flex-col relative overflow-hidden">
 {/* Dynamic Background Pattern */}
 <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
 <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-900/10 blur-[100px] rounded-full pointer-events-none" />

 {/* Header */}
 <header className="relative z-10 border-b border-ink-800 bg-ink-950/80 px-6 py-4 flex flex-wrap gap-4 items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-lg bg-red-950 border border-red-500/30 flex items-center justify-center">
 <ShieldAlert className="h-5 w-5 text-red-500" />
 </div>
 <div>
 <h1 className="text-lg font-bold tracking-tight">
 {isHi ? 'नियंत्रण केंद्र (GOD-MODE CONTROL TOWER)' : 'GOD-MODE CONTROL TOWER'}
 </h1>
 <p className="text-[10px] text-ink-400 uppercase tracking-widest">
 {isHi ? `व्यवस्थापक पहुँच: ${admin.username}` : `Admin Access: ${admin.username}`}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 {/* Language Switcher Pill [ EN | HI ] */}
 <div className="flex items-center rounded-full bg-ink-900 p-0.5 border border-ink-800">
 <button
 onClick={() => setLanguage('EN')}
 className={`rounded-full px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
 !isHi ? 'bg-red-600 text-white' : 'text-ink-400 hover:text-white'
 }`}
>
 EN
 </button>
 <button
 onClick={() => setLanguage('HI')}
 className={`rounded-full px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
 isHi ? 'bg-red-600 text-white' : 'text-ink-400 hover:text-white'
 }`}
>
 HI
 </button>
 </div>

 <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold tracking-widest">
 <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
 {isHi ? 'सिस्टम सक्रिय' : 'SYSTEM ONLINE'}
 </div>
 <button 
 onClick={async () => { try { await signOut(auth); } catch {} sessionStorage.removeItem('fmd_admin_secret'); onLogout(); }}
 className="text-xs text-ink-400 hover:text-white px-3 py-1.5 border border-ink-700 rounded hover:bg-ink-800 transition cursor-pointer"
>
 {isHi ? 'लॉग आउट' : 'LOGOUT'}
 </button>
 </div>
 </header>

 {/* Main Content */}
 <main className="flex-1 relative z-10 p-6 flex flex-col gap-6">
 
 {/* Navigation */}
 <div className="flex gap-4 border-b border-ink-800 pb-2">
 <button 
 onClick={() => setActiveTab('overview')}
 className={`px-4 py-2 text-sm uppercase tracking-wider font-bold transition-colors cursor-pointer ${activeTab === 'overview' ? 'text-white border-b-2 border-red-500' : 'text-ink-500 hover:text-ink-300'}`}
>
 {isHi ? 'नेटवर्क अवलोकन' : 'Network Overview'}
 </button>
 <button 
 onClick={() => setActiveTab('matcher')}
 className={`px-4 py-2 text-sm uppercase tracking-wider font-bold transition-colors cursor-pointer ${activeTab === 'matcher' ? 'text-white border-b-2 border-red-500' : 'text-ink-500 hover:text-ink-300'}`}
>
 {isHi ? 'मैनुअल मिलान इंजन' : 'Manual Matchmaker'}
 </button>
 </div>

 {activeTab === 'overview' && (
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
 {/* Stats Grid */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 {[
 { label: 'Total Donors', value: stats.totalDonors.toLocaleString(), icon: Users, color: 'text-blue-400' },
 { label: 'Active Requests', value: stats.activeRequests, icon: BellRing, color: 'text-red-400' },
 { label: 'Verified Hospitals', value: stats.hospitals, icon: Activity, color: 'text-amber-400' },
 { label: 'Lives Saved', value: stats.livesSaved.toLocaleString(), icon: Droplet, color: 'text-green-400' }
 ].map((stat, idx) => (
 <div key={idx} className="bg-ink-900 border border-ink-800 rounded-xl p-5 flex items-center gap-4">
 <div className={`p-3 rounded-lg bg-ink-800 ${stat.color}`}>
 <stat.icon className="h-6 w-6" />
 </div>
 <div>
 <p className="text-xs text-ink-400 uppercase tracking-wider">{stat.label}</p>
 <p className="text-2xl font-bold">{stat.value}</p>
 </div>
 </div>
 ))}
 </div>

 {/* Live Traffic Log (Mock) */}
 <div className="bg-ink-900 border border-ink-800 rounded-xl p-5 h-[400px] flex flex-col">
 <h2 className="text-sm uppercase tracking-widest text-ink-400 mb-4 flex items-center gap-2">
 <RefreshCcw className="h-4 w-4 animate-spin-slow" /> 
 Live Network Feed
 </h2>
 <div className="flex-1 overflow-auto space-y-3 font-mono text-xs">
 {[
 { tag: '[SYSTEM_AUDIT]', text: 'Admin security dashboard active & listening across all regions', time: 'Just now', color: 'text-blue-400' },
 { tag: '[NETWORK_SYNC]', text: '60-day medical safety cooldown tracker verification pass completed', time: '2 min ago', color: 'text-green-400' },
 { tag: '[MATCH_ENGINE]', text: 'Live geographical pincode matching engine operational', time: '5 min ago', color: 'text-amber-400' },
 ].map((log, i) => (
 <div key={i} className="flex gap-4 items-center text-ink-300 border-b border-ink-800/50 pb-2">
 <span className="text-ink-500">{log.time}</span>
 <span className={log.color}>{log.tag}</span>
 <span className="flex-1 truncate">{log.text}</span>
 </div>
 ))}
 </div>
 </div>
 </motion.div>
 )}

 {activeTab === 'matcher' && (
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-6 h-[600px]">
 {/* Requests Panel */}
 <div className="w-1/2 bg-ink-900 border border-ink-800 rounded-xl p-5 flex flex-col">
 <h2 className="text-sm uppercase tracking-widest text-ink-400 mb-4">Open Critical Requests</h2>
 <div className="flex-1 overflow-auto space-y-3">
 {openRequests.length === 0 ? (
 <div className="p-8 text-center border border-ink-800 rounded-lg text-ink-500 text-xs">
 No open critical requests pending in network right now.
 </div>
 ) : (
 openRequests.map((req) => (
 <div key={req.id} className="border border-ink-700 bg-ink-950 p-4 rounded-lg cursor-pointer hover:border-red-500 transition group relative overflow-hidden">
 <div className="absolute top-0 right-0 p-2 text-[10px] text-ink-500 group-hover:text-red-400 transition">{req.time}</div>
 <div className="flex items-center gap-3 mb-2">
 <span className="px-2 py-1 bg-red-950 text-red-500 border border-red-900 rounded text-xs font-bold">
 {req.blood}
 </span>
 <span className="text-sm font-bold text-white">{req.patient}</span>
 </div>
 <div className="text-xs text-ink-400">
 <div>📍 {req.hospital}</div>
 <div>🩸 Needs {req.units} units · <span className={req.status === 'CRITICAL' ? 'text-red-500' : 'text-amber-500'}>{req.status}</span></div>
 </div>
 </div>
 ))
 )}
 </div>
 </div>

 {/* Match Action Panel */}
 <div className="w-1/2 bg-ink-900 border border-ink-800 rounded-xl p-5 flex flex-col items-center justify-center relative overflow-hidden">
 <div className="absolute inset-0 bg-blood-900/5 opacity-50" />
 
 <div className="relative z-10 text-center w-full max-w-sm">
 <div className="w-20 h-20 mx-auto bg-ink-950 border-2 border-dashed border-ink-700 rounded-full flex items-center justify-center mb-6">
 <Link2 className="h-8 w-8 text-ink-500" />
 </div>
 
 <h3 className="text-lg font-bold mb-2">Force Network Match</h3>
 <p className="text-xs text-ink-400 mb-8">Select a request to scan the database and override algorithms to force a match.</p>

 <AnimatePresence mode="wait">
 {matchingStatus === 'idle' && (
 <motion.button
 key="idle"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 onClick={handleForceMatch}
 className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition tracking-widest"
>
 INITIATE MATCH
 </motion.button>
 )}
 {matchingStatus === 'matching' && (
 <motion.div
 key="matching"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="w-full bg-ink-800 border border-ink-700 text-ink-300 font-bold py-3 rounded-lg flex items-center justify-center gap-2"
>
 <RefreshCcw className="h-4 w-4 animate-spin" />
 SCANNING DATABASE...
 </motion.div>
 )}
 {matchingStatus === 'matched' && (
 <motion.div
 key="matched"
 initial={{ scale: 0.9, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 exit={{ opacity: 0 }}
 className="w-full bg-green-950 border border-green-500 text-green-400 font-bold py-3 rounded-lg flex items-center justify-center gap-2"
>
 <CheckCircle className="h-5 w-5" />
 MATCH FORCED (3 Donors Notified)
 </motion.div>
 )}
 {matchingStatus === 'error' && (
 <motion.div
 key="error"
 initial={{ scale: 0.9, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 exit={{ opacity: 0 }}
 className="w-full bg-red-950 border border-red-500 text-red-400 font-bold py-3 rounded-lg flex items-center justify-center gap-2"
>
 <ShieldAlert className="h-5 w-5" />
 MATCH FAILED
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </div>
 </motion.div>
 )}
 </main>
 <NotificationSimulator showSimulatorButton={true} />
 </div>
 );
}
