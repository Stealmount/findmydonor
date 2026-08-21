import React from 'react';
import { motion } from 'framer-motion';
import { Droplet, Plus, Minus, Radio } from 'lucide-react';
import { BloodType, InstitutionType } from '../../../types';
import { EmptyState } from '../widgets/Shared';
import { EmergencyConsole } from '../widgets/EmergencyConsole';

interface LiveViewProps {
 inventory: Record<BloodType, number>;
 setInventory: React.Dispatch<React.SetStateAction<Record<BloodType, number>>>;
 activeMatches: Array<{
 id?: string;
 request_id?: string;
 donor_id?: string;
 donorName: string;
 donorPhone: string;
 donor_response: string;
 distance_km?: number;
 is_exact_match?: boolean;
 }>;
 loadingMatches: boolean;
 fetchLiveMatches: () => Promise<void>;
 isHi: boolean;
 institutionType: InstitutionType;

 // Emergency console state lifted to shell
 selectedBlood: BloodType;
 setSelectedBlood: (b: BloodType) => void;
 units: number;
 setUnits: (n: number) => void;
 urgency: 'critical' | 'urgent' | 'planned';
 setUrgency: (u: 'critical' | 'urgent' | 'planned') => void;
 patientName: string;
 setPatientName: (s: string) => void;
 requestStatus: 'idle' | 'broadcasting' | 'sent' | 'error';
 notifiedCount: number;
 onBroadcast: (e: React.FormEvent) => void;
}

export function LiveView({
 inventory, setInventory, activeMatches, loadingMatches, fetchLiveMatches,
 isHi, institutionType,
 selectedBlood, setSelectedBlood, units, setUnits, urgency, setUrgency,
 patientName, setPatientName, requestStatus, notifiedCount, onBroadcast,
}: LiveViewProps) {
 const adjustInventory = (type: BloodType, delta: number) =>
 setInventory(prev => ({ ...prev, [type]: Math.max(0, prev[type] + delta) }));

 const bloodTypes: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

 return (
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 animate-fade-in">
 {/* Left: Inventory + Live Matches */}
 <div className="lg:col-span-8 space-y-8">
 {institutionType !== 'ngo' && (
 <section className="bg-ink-900/60 border border-ink-800 rounded-3xl p-5 sm:p-7 -lg">
 <div className="flex justify-between items-center mb-5">
 <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-400">
 {isHi ? 'लाइव रक्त सूची (इन्वेंट्री मैट्रिक्स)' : 'Live Inventory Matrix'}
 </h2>
 <span className="text-[11px] text-white/50">
 {isHi ? 'संख्या समायोजित करने के लिए + / - का उपयोग करें' : 'Use + / - to adjust levels'}
 </span>
 </div>

 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
 {bloodTypes.map(type => {
 const count = inventory[type];
 const isCritical = count <= 3;
 const isLow = count > 3 && count <= 6;
 const cardStyle = isCritical
 ? 'border-red-500/45 bg-red-950/20'
 : isLow ? 'border-amber-500/40 bg-amber-950/15'
 : 'border-ink-800 bg-white/[0.02]';
 const textStyle = isCritical ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-white/90';
 const dropColor = isCritical ? 'text-red-400 fill-red-400/20' : isLow ? 'text-amber-400' : 'text-white/60';
 return (
 <motion.div
 key={type}
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: bloodTypes.indexOf(type) * 0.04 }}
 className={`rounded-2xl p-4 border transition-all duration-300 relative group flex flex-col justify-between ${cardStyle}`}
 >
 <div className="flex items-center justify-between mb-2">
 <Droplet className={`h-4 w-4 ${dropColor}`} strokeWidth={2} />
 <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
 isCritical ? 'bg-red-500/20 text-red-300' : isLow ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-white/60'
 }`}>
 {isCritical ? (isHi ? 'गंभीर' : 'Critical') : isLow ? (isHi ? 'कम' : 'Low') : (isHi ? 'स्थिर' : 'Stable')}
 </span>
 </div>
 <div className="text-center my-2">
 <div className="text-3xl font-extrabold tracking-tight mb-1">{type}</div>
 <div className={`text-[13px] font-semibold ${textStyle}`}>
 {count} {isHi ? 'यूनिट' : 'units'}
 </div>
 </div>
 <div className="flex justify-center gap-1.5 mt-2 pt-2 border-t border-white/5 opacity-80 group-hover:opacity-100 transition-opacity">
 <button onClick={() => adjustInventory(type, -1)}
 className="p-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white cursor-pointer transition"
 title={isHi ? '1 यूनिट घटाएं' : 'Decrease'}>
 <Minus size={13} />
 </button>
 <button onClick={() => adjustInventory(type, 1)}
 className="p-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white cursor-pointer transition"
 title={isHi ? '1 यूनिट जोड़ें' : 'Increase'}>
 <Plus size={13} />
 </button>
 </div>
 </motion.div>
 );
 })}
 </div>
 </section>
 )}

 <section className="bg-ink-900/60 border border-ink-800 rounded-3xl p-5 sm:p-7 -lg">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-400">
 {isHi ? 'आने वाले स्वैच्छिक रक्तदाता' : 'Incoming Matched Donors'}
 </h2>
 <p className="text-[11px] text-ink-500 mt-1">
 {isHi ? 'रीयल-टाइम प्रतिक्रिया ट्रैकिंग' : 'Real-time response tracking from matched network alerts'}
 </p>
 </div>
 <div className="flex items-center gap-2">
 <button onClick={fetchLiveMatches}
 className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-ink-400 hover:text-white transition cursor-pointer"
 title="Refresh">
 <Radio className="h-4 w-4" />
 </button>
 <span className="text-[12px] font-bold text-blood-400 bg-blood-500/10 px-3 py-1 rounded-full border border-blood-500/20">
 {activeMatches.length} {isHi ? 'सक्रिय' : 'Active'}
 </span>
 </div>
 </div>

 {loadingMatches ? (
 <div className="py-8 text-center text-ink-400 text-sm">
 <span className="animate-pulse">{isHi ? 'सिंक हो रहा है...' : 'Syncing donor network matches...'}</span>
 </div>
 ) : activeMatches.length === 0 ? (
 <EmptyState
 title={isHi ? 'कोई आने वाला रक्तदाता नहीं है' : 'No incoming donor matches yet'}
 titleHi={isHi ? 'कोई आने वाला रक्तदाता नहीं है' : 'No incoming donor matches yet'}
 hint={isHi ? 'इमरजेंसी कंसोल से पिंग करें।' : 'Use the Emergency Console to trigger alerts.'}
 hintHi={isHi ? 'इमरजेंसी कंसोल से पिंग करें।' : 'Use the Emergency Console to trigger alerts.'}
 isHi={isHi}
 />
 ) : (
 <div className="space-y-3">
 {activeMatches.map(match => {
 const s = match.donor_response;
 return (
 <motion.div
 key={match.id}
 initial={{ opacity: 0, y: 6 }}
 animate={{ opacity: 1, y: 0 }}
 className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-ink-950/60 border border-ink-800/50 hover:bg-ink-900/80 transition-all gap-4"
 >
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-blood-600/90 flex items-center justify-center text-white font-bold text-sm">
 {match.donorName.charAt(0)}
 </div>
 <div>
 <div className="text-[14px] font-bold text-white flex items-center gap-2">
 {match.donorName}
 {match.is_exact_match && (
 <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">
 {isHi ? 'सटीक मिलान' : 'Exact Match'}
 </span>
 )}
 </div>
 <div className="text-[12px] text-ink-400 mt-0.5 font-medium">
 {isHi ? 'संपर्क:' : 'Contact:'} <strong className="text-white">{match.donorPhone}</strong>
 {match.distance_km && ` · ~${match.distance_km} km`}
 </div>
 </div>
 </div>
 <span className={`px-3 py-1.5 rounded-full border text-[10.5px] font-bold tracking-wider uppercase ${
 s === 'approved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
 : s === 'declined' ? 'bg-red-500/10 border-red-500/30 text-red-400'
 : 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
 }`}>
 {s === 'approved' ? (isHi ? 'स्वीकृत' : 'Approved')
 : s === 'declined' ? (isHi ? 'अस्वीकृत' : 'Declined')
 : (isHi ? 'प्रतीक्षारत' : 'Pending Reply')}
 </span>
 </motion.div>
 );
 })}
 </div>
 )}
 </section>
 </div>

 {/* Right column */}
 <div className="lg:col-span-4 space-y-6 sm:space-y-8">
 {institutionType !== 'ngo' && (
 <section className="bg-ink-900/60 border border-ink-800 rounded-3xl p-5 sm:p-7 -lg">
 <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-400 mb-5">
 {isHi ? '7-दिन की मांग' : '7-Day Demand Forecast'}
 </h2>
 <div className="h-32 w-full flex items-end justify-between px-2">
 {[40, 70, 45, 90, 60, 30, 80].map((h, i) => (
 <div key={i} className="w-[10%] bg-ink-850 rounded-t-sm relative" style={{ height: '100%' }}>
 <div className={`absolute bottom-0 w-full rounded-t-sm transition-all duration-1000 ${i === 3 ? 'bg-red-500' : 'bg-ink-600'}`}
 style={{ height: `${h}%` }} />
 </div>
 ))}
 </div>
 <div className="flex justify-between text-[10px] font-mono text-ink-500 px-2 mt-2">
 {(isHi ? ['सोम','मंगल','बुध','गुरु','शुक्र','शनि','रवि'] : ['MON','TUE','WED','THU','FRI','SAT','SUN']).map((d, i) => (
 <span key={d} className={i === 3 ? 'text-red-400 font-bold' : ''}>{d}</span>
 ))}
 </div>
 </section>
 )}

 <EmergencyConsole
 inventory={inventory}
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
 onBroadcast={onBroadcast}
 isHi={isHi}
 />
 </div>
 </div>
 );
}

