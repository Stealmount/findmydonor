import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Check, ShieldAlert } from 'lucide-react';
import { BloodType } from '../../../types';

interface EmergencyConsoleProps {
 inventory: Record<BloodType, number>;
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
 isHi: boolean;
}

export function EmergencyConsole({
 inventory, selectedBlood, setSelectedBlood, units, setUnits,
 urgency, setUrgency, patientName, setPatientName,
 requestStatus, notifiedCount, onBroadcast, isHi,
}: EmergencyConsoleProps) {
 return (
 <section className="bg-blood-950/20 border border-blood-500/20 rounded-3xl p-5 sm:p-7">
 <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-blood-400 mb-1">
 {isHi ? 'आपातकालीन कंसोल' : 'Emergency Console'}
 </h2>
 <h3 className="text-xl font-bold text-white mb-5 tracking-tight">
 {isHi ? 'आपातकालीन रक्त अनुरोध भेजें' : 'Broadcast Emergency Request'}
 </h3>

 <AnimatePresence mode="wait">
 {requestStatus === 'idle' && (
 <motion.form key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
 onSubmit={onBroadcast} className="space-y-4"
 >
 <div className="space-y-1.5">
 <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 block">
 {isHi ? 'रोगी का नाम / संदर्भ' : 'Patient Name / Ref'}
 </label>
 <input type="text" required value={patientName}
 onChange={e => setPatientName(e.target.value)}
 placeholder="Emergency Patient"
 className="w-full bg-ink-950/70 border border-ink-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blood-500"
 />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div className="space-y-1.5">
 <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 block">
 {isHi ? 'रक्त समूह' : 'Blood Group'}
 </label>
 <select value={selectedBlood} onChange={e => setSelectedBlood(e.target.value as BloodType)}
 className="w-full bg-ink-950/70 border border-ink-800 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blood-500"
 >
 {(Object.keys(inventory) as BloodType[]).map(t => <option key={t} value={t}>{t}</option>)}
 </select>
 </div>
 <div className="space-y-1.5">
 <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 block">
 {isHi ? 'आवश्यक इकाइयाँ' : 'Units'}
 </label>
 <input type="number" required min={1} max={10} value={units}
 onChange={e => setUnits(parseInt(e.target.value, 10))}
 className="w-full bg-ink-950/70 border border-ink-800 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blood-500"
 />
 </div>
 </div>
 <div className="space-y-1.5">
 <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 block">
 {isHi ? 'तत्कालता स्तर' : 'Urgency'}
 </label>
 <select value={urgency} onChange={e => setUrgency(e.target.value as typeof urgency)}
 className="w-full bg-ink-950/70 border border-ink-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blood-500"
 >
 <option value="critical">{isHi ? 'गंभीर (तत्काल)' : 'Critical (Immediate)'}</option>
 <option value="urgent">{isHi ? 'आवश्यक (4 घंटे में)' : 'Urgent (Within 4 hrs)'}</option>
 <option value="planned">{isHi ? 'नियोजित (सर्जरी)' : 'Planned (Surgery)'}</option>
 </select>
 </div>
 <button type="submit"
 className="w-full group inline-flex items-center justify-center gap-2 rounded-xl bg-blood-600 px-6 py-4 text-[14px] font-bold text-white hover:bg-blood-700 transition cursor-pointer"
 >
 <Send className="h-4 w-4" />
 {isHi ? 'रक्तदाता नेटवर्क पिंग करें' : 'Ping Donor Network'}
 </button>
 </motion.form>
 )}

 {requestStatus === 'broadcasting' && (
 <motion.div key="broadcasting" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
 className="py-12 flex flex-col items-center justify-center text-center"
 >
 <div className="w-12 h-12 border-2 border-blood-500/20 border-t-blood-500 rounded-full animate-spin mb-4" />
 <p className="text-sm font-bold text-white">{isHi ? 'अनुरोध प्रसारित किया जा रहा है...' : 'Broadcasting Request...'}</p>
 <p className="text-[11px] text-ink-400 mt-1">{isHi ? 'संगत रक्तदाताओं की खोज जारी है' : 'Locating eligible donors within proximity radius'}</p>
 </motion.div>
 )}

 {requestStatus === 'sent' && (
 <motion.div key="sent" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
 className="py-12 flex flex-col items-center justify-center text-center"
 >
 <div className="w-14 h-14 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mb-4">
 <Check className="h-7 w-7 text-green-500" strokeWidth={3} />
 </div>
 <p className="text-base font-bold text-white">{isHi ? 'प्रसारण सफल रहा' : 'Broadcast Successful'}</p>
 <p className="text-[12px] text-ink-400 mt-1">
 {isHi ? `${notifiedCount} रक्तदाता अधिसूचित।` : `${notifiedCount} donors matched. Tracking active.`}
 </p>
 </motion.div>
 )}

 {requestStatus === 'error' && (
 <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
 className="py-12 flex flex-col items-center justify-center text-center"
 >
 <ShieldAlert className="h-12 w-12 text-red-500 mb-4" />
 <p className="text-sm font-bold text-white">{isHi ? 'प्रसारण विफल हुआ' : 'Broadcast Failed'}</p>
 <p className="text-[11px] text-ink-400 mt-1">{isHi ? 'API कनेक्शन जांचें।' : 'Check API connection status'}</p>
 </motion.div>
 )}
 </AnimatePresence>
 </section>
 );
}
