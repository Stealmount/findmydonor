import React from 'react';
import { ScrollText, Download } from 'lucide-react';
import { AuditEntry } from '../../AdminPanel/useAdminPanel';
import { EmptyState, downloadCSV, Badge } from '../widgets/Shared';

interface AuditLogProps {
  audits: AuditEntry[];
  loading: boolean;
  actionFilter: string;
  isHi: boolean;
  onActionFilterChange: (v: string) => void;
}

export default function AuditLog({ audits, loading, actionFilter, isHi, onActionFilterChange }: AuditLogProps) {
  const actions = React.useMemo(() => Array.from(new Set(audits.map(a => a.action))), [audits]);
  const filtered = React.useMemo(() => {
    let list = audits;
    if (actionFilter) list = list.filter(a => a.action === actionFilter);
    return [...list].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }, [audits, actionFilter]);

  const exportCsv = () => {
    downloadCSV(`audit_${new Date().toISOString().split('T')[0]}.csv`,
      ['Actor', 'Action', 'Entity Type', 'Entity ID', 'Meta', 'Created'],
      filtered.map(a => [a.actor, a.action, a.entity_type, a.entity_id, a.meta || '', a.created_at]));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink-800 bg-ink-900/60 backdrop-blur-xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-blood-400" />
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink-400">{isHi ? 'ऑडिट लॉग' : 'Audit Trail'}</h3>
          <span className="text-[11px] text-ink-500">({filtered.length})</span>
        </div>
        <select value={actionFilter} onChange={e => onActionFilterChange(e.target.value)} aria-label="action filter"
          className="bg-ink-950/60 border border-ink-700 rounded-xl px-3 py-1.5 text-xs text-white cursor-pointer ml-auto">
          <option value="">{isHi ? 'सभी क्रियाएं' : 'All actions'}</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={exportCsv} className="px-3 py-1.5 bg-white/5 border border-ink-700 hover:bg-white/10 text-xs font-semibold text-ink-200 rounded-lg transition cursor-pointer flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>

      <div className="rounded-2xl border border-ink-800 bg-ink-900/60 backdrop-blur-xl overflow-hidden">
        {loading ? (
          <div className="p-16 flex items-center justify-center">
            <span className="w-6 h-6 border-2 border-blood-500/30 border-t-blood-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState title={isHi ? 'कोई ऑडिट प्रविष्टि नहीं' : 'No audit entries yet'} hint={isHi ? 'प्रशासनिक क्रियाएं यहां दर्ज होंगी' : 'Admin actions will be logged here'} isHi={isHi} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-ink-500 border-b border-ink-800">
                  <th className="px-4 py-3">{isHi ? 'अभिनेता' : 'Actor'}</th>
                  <th className="px-4 py-3">{isHi ? 'क्रिया' : 'Action'}</th>
                  <th className="px-4 py-3">{isHi ? 'इकाई' : 'Entity'}</th>
                  <th className="px-4 py-3">{isHi ? 'लक्ष्य' : 'Target ID'}</th>
                  <th className="px-4 py-3">{isHi ? 'विवरण' : 'Detail'}</th>
                  <th className="px-4 py-3">{isHi ? 'समय' : 'Time'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800/60">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3 text-xs text-ink-200 font-medium">{a.actor}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold text-blood-300 bg-blood-600/10 border border-blood-500/20 rounded-full px-2.5 py-1 uppercase tracking-wider">{a.action}</span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-ink-400">{a.entity_type}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-ink-400">{a.entity_id?.slice(0, 12) || '—'}</td>
                    <td className="px-4 py-3 text-[11px] text-ink-500 max-w-xs line-clamp-1">{a.meta || '—'}</td>
                    <td className="px-4 py-3 text-[11px] text-ink-500 whitespace-nowrap">{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
