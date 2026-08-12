import React from 'react';
import { InstitutionType } from '../../../types';
import { motion } from 'framer-motion';
import { Droplet, Radio, Clock, AlertTriangle, CheckCircle, History, TrendingUp, Users, Droplet as DropletIcon } from 'lucide-react';
import { StatCard, EmptyState, StatusPill } from '../widgets/Shared';

interface WorklistProps {
  inventory: Record<string, number>;
  activeMatches: Array<{ donor_response: string; donorName: string; id?: string }>;
  history: Array<{ status: string; created_at: string; blood_type_needed: string; units_required: number; urgency_level: string; tracking_code?: string }>;
  isHi: boolean;
  institutionType: InstitutionType;
  criticalCount: number;
  lowCount: number;
}

export function Worklist({ inventory, activeMatches, history, isHi, institutionType, criticalCount, lowCount }: WorklistProps) {
  // KPI calculations
  const totalUnits = Object.values(inventory).reduce((a, b) => a + b, 0);
  const pendingReplies = activeMatches.filter(m => m.donor_response === 'pending').length;
  const recentRequests = history.slice(0, 5);

  const kpis = [
    { label: isHi ? 'कुल इकाइयाँ' : 'Total Units', labelHi: 'कुल इकाइयाँ', value: totalUnits, icon: <DropletIcon className="h-5 w-5" />, tone: 'blood' as const },
    { label: isHi ? 'सक्रिय मैच' : 'Active Matches', labelHi: 'सक्रिय मैच', value: activeMatches.length, icon: <Radio className="h-5 w-5" />, tone: 'emerald' as const },
    { label: isHi ? 'प्रतीक्षारत उत्तर' : 'Pending Replies', labelHi: 'प्रतीक्षारत उत्तर', value: pendingReplies, icon: <Clock className="h-5 w-5" />, tone: 'amber' as const },
    { label: isHi ? 'कम स्टॉक' : 'Low Stock', labelHi: 'कम स्टॉक', value: criticalCount + lowCount, icon: <AlertTriangle className="h-5 w-5" />, tone: (criticalCount > 0 ? ('blood' as const) : ('amber' as const)) },
  ];

  // "Needs your action" items
  const toneTypes = ['blood', 'amber', 'ink'] as const;
  const actionItems: Array<{ key: string; label: string; href: string; icon: React.ReactNode; tone: typeof toneTypes[number] }> = [
    ...(pendingReplies > 0 ? [{
      key: 'replies',
      label: isHi ? `${pendingReplies} रक्तदाता उत्तर प्रतीक्षारत` : `${pendingReplies} donor replies pending`,
      href: '#matches',
      icon: <Clock className="h-4 w-4" />,
      tone: 'amber' as const,
    }] : []),
    ...(criticalCount > 0 ? [{
      key: 'critical',
      label: isHi ? `${criticalCount} ब्लड टाइप गंभीर रूप से कम` : `${criticalCount} blood types critically low`,
      href: '#inventory',
      icon: <AlertTriangle className="h-4 w-4" />,
      tone: 'blood' as const,
    }] : []),
    ...(lowCount > 0 ? [{
      key: 'low',
      label: isHi ? `${lowCount} ब्लड टाइप कम स्टॉक पर` : `${lowCount} blood types at low stock`,
      href: '#inventory',
      icon: <AlertTriangle className="h-4 w-4" />,
      tone: 'amber' as const,
    }] : []),
    ...(history.length > 0 ? [{
      key: 'recent',
      label: isHi ? `${history.length} हाल के अनुरोध` : `${history.length} recent requests`,
      href: '#history',
      icon: <History className="h-4 w-4" />,
      tone: 'ink' as const,
    }] : []),
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {kpis.map(k => (
          <StatCard key={k.label} {...k} isHi={isHi} />
        ))}
      </div>

      {/* Needs Your Action */}
      {(criticalCount > 0 || lowCount > 0 || pendingReplies > 0) && (
        <section className="bg-ink-900/60 backdrop-blur-xl border border-ink-800 rounded-3xl p-5 sm:p-7 shadow-premium-lg">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-400 mb-4 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            {isHi ? 'आपकी कार्रवाई की आवश्यकता' : 'Needs Your Action'}
          </h2>
          <div className="space-y-2">
            {actionItems.map(item => (
              <div key={item.key} className={`flex items-center gap-3 p-3 rounded-xl bg-ink-950/60 border transition-all cursor-pointer hover:bg-ink-900/80 ${
                item.tone === 'blood' ? 'border-red-500/20' : item.tone === 'amber' ? 'border-amber-500/20' : 'border-ink-800'
              }`}>
                <div className={`p-2 rounded-lg ${item.tone === 'blood' ? 'bg-red-500/15 text-red-400' : item.tone === 'amber' ? 'bg-amber-500/15 text-amber-400' : 'bg-white/5 text-white/70'}`}>
                  {item.icon}
                </div>
                <span className="text-sm font-medium text-white flex-1">{item.label}</span>
                <div className="text-[11px] font-bold text-ink-500">{isHi ? 'देखें →' : 'View →'}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Activity */}
      <section className="bg-ink-900/60 backdrop-blur-xl border border-ink-800 rounded-3xl p-5 sm:p-7 shadow-premium-lg">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-400 mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blood-400" />
          {isHi ? 'हाल की गतिविधि' : 'Recent Activity'}
        </h2>
        {recentRequests.length === 0 ? (
          <EmptyState
            title={isHi ? 'अभी तक कोई गतिविधि नहीं' : 'No recent activity'}
            titleHi={isHi ? 'अभी तक कोई गतिविधि नहीं' : 'No recent activity'}
            hint={isHi ? 'Live टैब से पहला अनुरोध भेजें।' : 'Broadcast your first request from the Live tab.'}
            hintHi={isHi ? 'Live टैब से पहला अनुरोध भेजें।' : 'Broadcast your first request from the Live tab.'}
            isHi={isHi}
          />
        ) : (
          <div className="space-y-3">
            {recentRequests.map(req => (
              <motion.div
                key={req.tracking_code || req.created_at}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between p-3 rounded-xl bg-ink-950/60 border border-ink-800/50 hover:bg-ink-900/80 transition-all gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-blood-600/10 border border-blood-500/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-extrabold text-blood-400">{req.blood_type_needed}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {req.units_required} units · {req.urgency_level}
                    </div>
                    <div className="text-[11px] text-ink-500 mt-0.5">
                      {new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {req.tracking_code && ` · ${req.tracking_code}`}
                    </div>
                  </div>
                </div>
                <StatusPill status={req.status} isHi={isHi} />
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
