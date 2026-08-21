import React, { useState, useEffect } from 'react';
import { authenticatedApi } from '../lib/api';
import { sendRealEmail } from '../lib/email';
import { Match, BloodRequest, User } from '../types';
import { MessageSquare, Mail, AlertTriangle, Check, X, Bell, Sparkles, Trash2, Clock, ShieldAlert, Lock, PartyPopper, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../lib/LanguageContext';

interface NotificationSimulatorProps {
 onStateChange?: () => void;
 onNavigate?: (view: string) => void;
 showSimulatorButton?: boolean;
}

export default function NotificationSimulator({ onStateChange, onNavigate, showSimulatorButton = false }: NotificationSimulatorProps) {
 const { language } = useLanguage();
 const isHi = language === 'HI';
 const [isOpen, setIsOpen] = useState(false);
 const [notifications, setNotifications] = useState<any[]>([]);
 const [matches, setMatches] = useState<Match[]>([]);
 const [donors, setDonors] = useState<User[]>([]);
 const [requests, setRequests] = useState<BloodRequest[]>([]);
 const [congratsMatch, setCongratsMatch] = useState<{ donor: string; requester: string; trackingCode: string } | null>(null);
 const [activeTab, setActiveTab] = useState<'broadcasts' | 'congrats'>('broadcasts');

 const loadData = async () => {
 const response = await fetch('/api/simulator/data');
 const data = await response.json().catch(() => ({}));
 if (response.ok && data) {
 setNotifications(data.notifications || []);
 setMatches(data.matches || []);
 setDonors(data.donors || []);
 setRequests(data.requests || []);
 }
 };

 useEffect(() => {
 loadData();
 const interval = setInterval(loadData, 5000);
 return () => clearInterval(interval);
 }, []);

 const handleSimulateReply = async (matchId: string, reply: 'YES' | 'NO' | 'TIMEOUT') => {
 const match = matches.find(m => m.id === matchId);
 if (!match) return;

 const donor = donors.find(d => d.id === match.donor_id);
 const request = requests.find(r => r.id === match.request_id);
 if (!donor || !request) return;

 const nowStr = new Date().toISOString();

 if (reply === 'YES') {
 await authenticatedApi(`/api/matches/${matchId}/approve`, {}, 'POST');
 setCongratsMatch({
 donor: donor.full_name,
 requester: request.requester_name,
 trackingCode: request.tracking_code
 });
 } else if (reply === 'NO') {
 await authenticatedApi(`/api/matches/${matchId}/decline`, {}, 'POST');
 } else if (reply === 'TIMEOUT') {
 await authenticatedApi(`/api/matches/${matchId}/timeout`, {}, 'POST');
 }

 await loadData();
 if (onStateChange) {
 onStateChange();
 }
 };

 const filteredNotifs = activeTab === 'broadcasts'
 ? notifications.filter(n => {
 // Congrats (donor_approved) go ONLY in the Congrats tab — exclude from broadcasts
 if (n.trigger_event === 'donor_approved') return false;
 const associatedMatch = matches.find(m => n.id === `notif_wa_${m.request_id}_${m.donor_id}`);
 if (associatedMatch) {
 const req = requests.find(r => r.id === associatedMatch.request_id);
 if (req && req.broadcast_to_simulator === false) return false;
 }
 return true;
 })
 : notifications.filter(n => n.trigger_event === 'donor_approved');

 const congratsCount = notifications.filter(n => n.trigger_event === 'donor_approved').length;

 return (
 <>
 {/* Floating Bottom-Right Action Bar */}
 <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
 {/* Public Floating Support Us Button */}
 <button
 onClick={() => {
 if (onNavigate) {
 onNavigate('support');
 } else {
 window.location.href = '/?view=support';
 }
 }}
 className="flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-rose-600/40 border border-rose-400/50 transition-all transform hover:scale-105 cursor-pointer group"
>
 <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white group-hover:scale-110 transition-transform">
 <Heart className="w-3.5 h-3.5 fill-white text-white animate-pulse" />
 </div>
 <span className="text-xs font-extrabold tracking-tight">{isHi ? 'Support Us ❤️' : 'Support Us ❤️'}</span>
 </button>

 {/* Admin-Only Simulator Trigger Pill */}
 {showSimulatorButton && (
 <button
 onClick={() => setIsOpen(!isOpen)}
 title={isHi ? "लाइव सिमुलेटर कंसोल" : "Live Simulator Console"}
 className="flex items-center gap-1.5 px-3 py-3 rounded-full bg-ink-900/95 hover:bg-black text-white border border-ink-700/80 transition-all transform hover:scale-105 cursor-pointer"
>
 <Sparkles className="w-4 h-4 text-amber-400" />
 {notifications.length> 0 && (
 <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blood-600 px-1 text-[10px] font-bold text-white">
 {notifications.length}
 </span>
 )}
 </button>
 )}
 </div>

 {/* Modern Slide-Over Simulator Panel */}
 <AnimatePresence>
 {isOpen && (
 <motion.div
 initial={{ opacity: 0, x: 480 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: 480 }}
 transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
 className="fixed right-0 top-0 bottom-0 w-full sm:w-[460px] bg-white/95 border-l border-ink-200/80 text-ink-900 z-50 flex flex-col"
>
 {/* Header */}
 <div className="p-5 border-b border-ink-100 flex items-center justify-between bg-white/50">
 <div className="flex items-center gap-3">
 <div className="grid h-10 w-10 place-items-center rounded-2xl blood-drop-gradient">
 <Sparkles className="w-5 h-5 text-white" />
 </div>
 <div>
 <h3 className="font-bold text-sm tracking-tight text-ink-900">{isHi ? 'लाइव सिमुलेटर' : 'Live Simulator'}</h3>
 <p className="text-xs text-ink-500 font-medium">{isHi ? 'लाइव सूचना स्ट्रीम और टेस्ट कंसोल' : 'Live notification stream & test console'}</p>
 </div>
 </div>
 <button 
 onClick={() => setIsOpen(false)} 
 className="p-2 rounded-full hover:bg-ink-100 text-ink-500 hover:text-ink-900 transition-colors cursor-pointer"
>
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Navigation Tabs */}
 <div className="flex bg-ink-50/70 p-1.5 border-b border-ink-100 gap-1">
 <button
 onClick={() => setActiveTab('broadcasts')}
 className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
 activeTab === 'broadcasts' 
 ? 'bg-white text-ink-900' 
 : 'text-ink-500 hover:text-ink-900'
 }`}
>
 {isHi ? 'हाल के प्रसारण' : 'Recent Broadcasts'} ({notifications.length})
 </button>
 <button
 onClick={() => setActiveTab('congrats')}
 className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
 activeTab === 'congrats' 
 ? 'bg-white text-ink-900' 
 : 'text-ink-500 hover:text-ink-900'
 }`}
>
 {isHi ? 'बधाई संदेश' : 'Recent Congrats'} ({congratsCount})
 </button>
 </div>

 {/* Real-Time Congratulations Banner */}
 <AnimatePresence>
 {congratsMatch && (
 <motion.div
 initial={{ opacity: 0, y: -20 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -20 }}
 className="bg-emerald-500 text-white p-4 border-b border-emerald-600 flex flex-col items-center text-center relative overflow-hidden"
>
 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent opacity-50" />
 <Sparkles className="w-6 h-6 mb-1 text-yellow-300 animate-bounce" />
 <h4 className="font-bold text-[14px] tracking-tight">🎉 Congratulations!</h4>
 <p className="text-xs mt-1 max-w-sm">
 Donor <strong className="underline">{congratsMatch.donor}</strong> accepted the request from requester <strong className="underline">{congratsMatch.requester}</strong> in real time!
 </p>
 <button 
 onClick={() => setCongratsMatch(null)}
 className="absolute top-2 right-2 text-white/80 hover:text-white"
>
 <X className="w-4 h-4" />
 </button>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Notification Stream */}
 <div className="flex-1 overflow-y-auto p-4 space-y-3">
 {filteredNotifs.length === 0 ? (
 <div className="text-center py-16 px-4">
 <div className="grid h-12 w-12 mx-auto mb-3 place-items-center rounded-2xl bg-ink-100 text-ink-400">
 <Bell className="w-6 h-6" />
 </div>
 <p className="text-sm font-semibold text-ink-800">
 {isHi ? 'अभी कोई सिमुलेटेड सूचना नहीं है' : 'No simulated notifications yet'}
 </p>
 <p className="text-xs text-ink-500 mt-1">
 {isHi ? 'रीयल-टाइम सिमुलेटेड अलर्ट ट्रिगर करने के लिए रक्त अनुरोध सबमिट करें या रक्तदाता के रूप में पंजीकरण करें।' : 'Submit a blood request or register as donor to trigger real-time simulated alerts.'}
 </p>
 </div>
 ) : (
 filteredNotifs.map((notif) => {
 const associatedMatch = matches.find(m => notif.id === `notif_wa_${m.request_id}_${m.donor_id}`);
 const donor = associatedMatch ? donors.find(d => d.id === associatedMatch.donor_id) : null;

 // Find display name for recipient
 let recipientName = '';
 const matchedDonor = donors.find(d => 
 d.id === notif.recipient_id || 
 d.email === notif.recipient_id || 
 d.phone === notif.recipient_id || 
 d.whatsapp_number === notif.recipient_id
 );
 const matchedReq = requests.find(r => 
 r.id === notif.recipient_id || 
 r.requester_email === notif.recipient_id || 
 r.requester_phone === notif.recipient_id
 );

 if (matchedDonor) {
 recipientName = `${matchedDonor.full_name} (Donor)`;
 } else if (matchedReq) {
 recipientName = `${matchedReq.requester_name} (Requester)`;
 } else {
 // Fallback to regex name extraction from greeting e.g. "Hi Rahul," or "Hi ramesh,"
 const matchHi = notif.message_body.match(/Hi\s+([A-Za-z0-9\s]+?)[,!]/i);
 if (matchHi && matchHi[1]) {
 const rawName = matchHi[1].trim();
 const capitalized = rawName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
 recipientName = `${capitalized} (${notif.recipient_type === 'donor' ? 'Donor' : 'Requester'})`;
 } else {
 recipientName = notif.recipient_type === 'donor' ? 'Volunteer Donor' : 'FindMyDonor™ Requester';
 }
 }

 // Clean message body
 const displayBody = notif.message_body
 .replaceAll('FindMyDonor™', 'FindMyDonor™')
 // Clean up location / pincode references
 .replace(/active in\s+[A-Za-z0-9\s]+?\.(\s+|$)/i, 'active. ')
 .replace(/patients in pincode\s*(\d{6})?\s*or adjacent areas/i, 'patients nearby')
 .replace(/across Delhi NCR/i, 'nearby')
 .replace(/pincode\s*\d{6}/i, '')
 .replace(/\b\d{6}\b/g, '') // remove any other 6-digit numbers (like pincodes)
 .replace(/\s+/g, ' ')
 .trim();

 // Congrats-style card for donor_approved entries
 if (notif.trigger_event === 'donor_approved' && activeTab === 'congrats') {
 const donorApproved = donors.find(d =>
 d.id === notif.recipient_id ||
 d.phone === notif.recipient_id ||
 d.whatsapp_number === notif.recipient_id
 );
 return (
 <div key={notif.id} className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
 <div className="flex items-center gap-2">
 <PartyPopper className="w-4 h-4 text-emerald-600" />
 <span className="text-xs font-bold text-emerald-800 flex-1">Match Confirmed</span>
 <span className="text-[10px] text-emerald-600 font-mono">
 {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
 </span>
 </div>
 <p className="text-xs text-emerald-900 font-medium leading-relaxed">
 {donorApproved?.full_name ?? recipientName} agreed to donate.
 </p>
 <div className="rounded-lg bg-white border border-emerald-200 p-2.5 text-xs text-ink-700 leading-relaxed whitespace-pre-wrap">
 {displayBody}
 </div>
 </div>
 );
 }

 // Determine clear-button locking for broadcast logs
 const clearLocked = (() => {
 if (!associatedMatch) return false; // non-broadcast logs are always clearable
 const req = requests.find(r => r.id === associatedMatch.request_id);
 if (!req) return false;
 return req.status === 'broadcasting' || req.status === 'matching';
 })();

 const handleDeleteLog = async () => {
 if (clearLocked) return;
 try {
 const { authenticatedApi } = await import('../lib/api');
 await authenticatedApi(`/api/notifications/${notif.id}`, {}, 'DELETE');
 loadData();
 } catch {
 loadData();
 }
 };

 return (
 <div key={notif.id} className="rounded-2xl bg-white border border-ink-200/80 p-4 hover:shadow-md transition-shadow space-y-3">
 <div className="flex justify-between items-center border-b border-ink-50 pb-2">
 <span className="text-xs font-bold text-ink-900 truncate max-w-[220px]">
 {recipientName}
 </span>
 <div className="flex items-center gap-2">
 <span className="text-[10px] text-ink-400 font-mono">
 {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
 </span>
 {clearLocked ? (
 <span title="Locked — waiting for a donor to be matched" className="text-ink-300 cursor-not-allowed">
 <Lock className="w-3.5 h-3.5" />
 </span>
 ) : (
 <button
 onClick={handleDeleteLog}
 title="Delete this log entry"
 className="text-ink-300 hover:text-blood-500 transition-colors cursor-pointer"
>
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 )}
 </div>
 </div>

 <div className="rounded-xl bg-ink-50/70 p-3.5 border border-ink-100 text-ink-800 text-xs leading-relaxed whitespace-pre-wrap font-sans">
 {displayBody}
 </div>

 {/* Interactive Response Simulation */}
 {associatedMatch && associatedMatch.donor_response === 'pending' && (
 <div className="pt-3 border-t border-ink-100 space-y-2.5">
 <p className="text-xs text-blood-600 font-semibold flex items-center gap-1.5">
 <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" /> Simulating reply for donor: <span className="font-bold">{donor?.full_name}</span>
 </p>
 <div className="flex gap-2">
 <button
 onClick={() => handleSimulateReply(associatedMatch.id, 'YES')}
 className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
>
 <Check className="w-3.5 h-3.5" /> Reply YES
 </button>
 <button
 onClick={() => handleSimulateReply(associatedMatch.id, 'NO')}
 className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-ink-50 border border-ink-200 text-ink-800 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
>
 <X className="w-3.5 h-3.5" /> Reply NO
 </button>
 <button
 onClick={() => handleSimulateReply(associatedMatch.id, 'TIMEOUT')}
 className="py-2 px-3 rounded-xl bg-ink-100 hover:bg-ink-200 text-ink-700 font-medium text-xs transition-colors cursor-pointer"
 title="Simulate timeout"
>
 Timeout
 </button>
 </div>
 </div>
 )}

 {associatedMatch && associatedMatch.donor_response !== 'pending' && (
 <div className="pt-2.5 border-t border-ink-100 flex justify-between items-center text-xs">
 <span className="text-ink-500 font-medium">Simulated response:</span>
 <span className={`rounded-full px-2.5 py-0.5 font-semibold uppercase text-[10px] ${
 associatedMatch.donor_response === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
 associatedMatch.donor_response === 'declined' ? 'bg-ink-100 text-ink-600 border border-ink-200' : 'bg-blood-50 text-blood-700 border border-blood-200'
 }`}>
 {associatedMatch.donor_response}
 </span>
 </div>
 )}
 </div>
 );
 })
 )}
 </div>

 {/* Footer */}
 <div className="p-4 border-t border-ink-100 bg-white/80 flex justify-between items-center text-xs text-ink-500">
 <span className="flex items-center gap-1.5 font-medium">
 <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
 {isHi ? 'स्वचालित रिफ्रेशिंग लाइव लॉग' : 'Auto-refreshing live logs'}
 </span>
 <button 
 onClick={async () => {
 if (window.confirm(isHi ? 'सभी सिमुलेटेड सूचनाएं साफ़ करें?' : "Clear all simulated notifications?")) {
 try {
 const { authenticatedApi } = await import('../lib/api');
 await authenticatedApi('/api/notifications/all', {}, 'DELETE');
 // Also clear local if it existed
 localStorage.removeItem('findmydonor_notifications');
 loadData();
 } catch (err) {
 console.error(err);
 localStorage.removeItem('findmydonor_notifications');
 loadData();
 }
 }
 }}
 className="text-blood-600 hover:text-blood-700 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
>
 <Trash2 className="w-3.5 h-3.5" /> {isHi ? 'लॉग साफ़ करें' : 'Clear Logs'}
 </button>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </>
 );
}
