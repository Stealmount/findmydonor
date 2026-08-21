import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, MapPin, Users, CheckCircle, XCircle, Clock } from 'lucide-react';
import { authenticatedApi } from '../../../lib/api';
import { BloodRequest, Match } from '../../../types';
import { EmptyState, StatusPill } from '../widgets/Shared';

interface RequestsViewProps {
  requests: BloodRequest[];
  matches: Match[];
  users: Array<{ id: string; full_name: string; blood_type?: string; phone?: string }>;
  isHi: boolean;
  onRequestFulfilled: () => void;
}

export function RequestsView({ requests, matches, users, isHi, onRequestFulfilled }: RequestsViewProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'fulfilled' | 'cancelled'>('all');
  const [fulfilling, setFulfilling] = useState<string | null>(null);

  const filtered = requests.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'active') return r.status === 'open' || r.status === 'matching' || r.status === 'broadcasting' || r.status === 'partially_matched';
    if (filter === 'fulfilled') return r.status === 'fulfilled';
    if (filter === 'cancelled') return r.status === 'cancelled' || r.status === 'expired';
    return true;
  });

  const counts = {
    all: requests.length,
    active: requests.filter(r => r.status === 'open' || r.status === 'matching' || r.status === 'broadcasting' || r.status === 'partially_matched').length,
    fulfilled: requests.filter(r => r.status === 'fulfilled').length,
    cancelled: requests.filter(r => r.status === 'cancelled' || r.status === 'expired').length,
  };

  const handleFulfill = async (requestId: string) => {
    setFulfilling(requestId);
    try {
      await authenticatedApi(`/api/requests/${requestId}/status`, { status: 'fulfilled' }, 'PATCH');
      onRequestFulfilled();
    } catch { /* silent */ } finally {
      setFulfilling(null);
    }
  };

  const getMatchedDonors = (requestId: string) => {
    return matches
      .filter(m => m.request_id === requestId)
      .map(m => {
        const user = users.find(u => u.id === m.donor_id);
        return { ...m, donorName: user?.full_name || 'Volunteer Donor', donorBlood: user?.blood_type || '—' };
      });
  };

  const filters: Array<{ key: typeof filter; label: string; labelHi: string }> = [
    { key: 'all', label: 'All', labelHi: 'सभी' },
    { key: 'active', label: 'Active', labelHi: 'सक्रिय' },
    { key: 'fulfilled', label: 'Fulfilled', labelHi: 'पूर्ण' },
    { key: 'cancelled', label: 'Cancelled', labelHi: 'रद्द' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-400">
          {isHi ? 'अनुरोध प्रबंधन' : 'Request Management'}
        </h2>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
              filter === f.key
                ? 'bg-blood-600/15 text-blood-400 border-blood-500/25'
                : 'text-ink-400 border-ink-800 hover:text-white hover:border-white/10'
            }`}
          >
            {isHi ? f.labelHi : f.label}
            <span className="ml-1.5 text-[10px] text-ink-500">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={isHi ? 'कोई अनुरोध नहीं' : 'No requests'}
          titleHi={isHi ? 'कोई अनुरोध नहीं' : 'No requests'}
          hint={isHi ? 'Live टैब से अनुरोध बनाएं।' : 'Create requests from the Live tab.'}
          hintHi={isHi ? 'Live टैब से अनुरोध बनाएं।' : 'Create requests from the Live tab.'}
          isHi={isHi}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const matchedDonors = getMatchedDonors(req.id);
            const isPending = req.status === 'open' || req.status === 'matching' || req.status === 'broadcasting' || req.status === 'partially_matched';
            return (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-white border border-ink-200 p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-blood-50 border border-blood-200 flex items-center justify-center shrink-0">
                      <span className="text-sm font-extrabold text-blood-600">{req.blood_type_needed}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-ink-900">
                        {req.patient_name || (isHi ? 'अनाम रोगी' : 'Unnamed Patient')} · {req.units_required} {isHi ? 'यूनिट' : 'units'}
                      </div>
                      <div className="text-[11px] text-ink-500 mt-0.5 flex items-center gap-2 flex-wrap">
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
                        {req.tracking_code && (
                          <span className="font-mono text-ink-400">{req.tracking_code}</span>
                        )}
                      </div>
                      {req.urgency_level && (
                        <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          req.urgency_level === 'critical' ? 'bg-red-50 text-red-600 border border-red-200' :
                          req.urgency_level === 'urgent' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                          'bg-ink-50 text-ink-500 border border-ink-200'
                        }`}>
                          {req.urgency_level}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusPill status={req.status} isHi={isHi} />
                    {isPending && (
                      <button
                        onClick={() => handleFulfill(req.id)}
                        disabled={fulfilling === req.id}
                        className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        {isHi ? 'पूर्ण' : 'Fulfilled'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Matched donors inline */}
                {matchedDonors.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-ink-100">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Users className="w-3 h-3 text-ink-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                        {isHi ? 'मैच किए गए दाता' : 'Matched Donors'}
                      </span>
                      <span className="text-[10px] text-ink-400">({matchedDonors.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {matchedDonors.map(m => (
                        <div key={m.id || m.donor_id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-ink-50 border border-ink-200">
                          <div className="w-6 h-6 rounded-full bg-blood-100 flex items-center justify-center text-[9px] font-bold text-blood-600">
                            {m.donorName.charAt(0)}
                          </div>
                          <span className="text-xs font-medium text-ink-700">{m.donorName}</span>
                          <span className="text-[9px] font-bold text-ink-400">{m.donorBlood}</span>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            m.donor_response === 'approved' ? 'bg-emerald-500' :
                            m.donor_response === 'declined' ? 'bg-red-400' :
                            'bg-amber-400'
                          }`} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
