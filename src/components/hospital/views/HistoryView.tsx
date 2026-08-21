import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, MapPin, History, RefreshCw } from 'lucide-react';
import { BloodRequest } from '../../../types';
import { EmptyState, StatusPill } from '../widgets/Shared';

interface HistoryViewProps {
 history: BloodRequest[];
 historyLoading: boolean;
 historyLoaded: boolean;
 fetchHistory: () => Promise<void>;
 isHi: boolean;
}

export function HistoryView({ history, historyLoading, historyLoaded, fetchHistory, isHi }: HistoryViewProps) {
 return (
 <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">
 <div className="flex items-center justify-between mb-2">
 <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-400">
 {isHi ? 'रक्त अनुरोध इतिहास' : 'Blood Request History'}
 </h2>
 <button
 onClick={() => fetchHistory()}
 className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-ink-400 hover:text-white transition cursor-pointer"
 title="Refresh"
 >
 <RefreshCw size={13} />
 </button>
 </div>

 {historyLoading ? (
 <div className="py-16 text-center text-ink-400 text-sm">
 <span className="animate-pulse">{isHi ? 'इतिहास लोड हो रहा है...' : 'Loading history...'}</span>
 </div>
 ) : history.length === 0 ? (
 <EmptyState
 title={isHi ? 'अभी तक कोई अनुरोध नहीं' : 'No requests yet'}
 titleHi={isHi ? 'अभी तक कोई अनुरोध नहीं' : 'No requests yet'}
 hint={isHi ? 'Live टैब से आपातकालीन अनुरोध भेजें।' : 'Broadcast your first emergency request from the Live tab.'}
 hintHi={isHi ? 'Live टैब से आपातकालीन अनुरोध भेजें।' : 'Broadcast your first emergency request from the Live tab.'}
 isHi={isHi}
 />
 ) : (
 <div className="space-y-3">
 {history.map(req => (
 <motion.div
 key={req.id}
 initial={{ opacity: 0, y: 6 }}
 animate={{ opacity: 1, y: 0 }}
 className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-ink-900/60 border border-ink-800/50 hover:bg-ink-900/90 transition-all gap-3"
 >
 <div className="flex items-center gap-4 min-w-0">
 <div className="w-12 h-12 rounded-xl bg-blood-600/10 border border-blood-500/20 flex items-center justify-center shrink-0">
 <span className="text-sm font-extrabold text-blood-400">{req.blood_type_needed}</span>
 </div>
 <div className="min-w-0">
 <div className="text-sm font-bold text-white truncate">
 {req.units_required} {isHi ? 'यूनिट' : 'unit'}{req.units_required !== 1 ? 's' : ''} · {req.urgency_level || 'urgent'}
 </div>
 <div className="text-[11px] text-ink-400 mt-0.5 flex items-center gap-2 flex-wrap">
 <span className="flex items-center gap-1">
 <CalendarDays className="w-3 h-3" />
 {new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
 </span>
 {req.hospital_city && (
 <span className="flex items-center gap-1">
 <MapPin className="w-3 h-3" />
 {req.hospital_city}
 </span>
 )}
 </div>
 {req.tracking_code && (
 <div className="text-[10px] font-mono text-ink-600 mt-0.5">
 {req.tracking_code}
 </div>
 )}
 </div>
 </div>
 <div className="shrink-0 self-end sm:self-center">
 <StatusPill status={req.status} isHi={isHi} />
 </div>
 </motion.div>
 ))}
 </div>
 )}
 </div>
 );
}
