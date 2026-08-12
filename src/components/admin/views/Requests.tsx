import React from 'react';
import { Search, Download, FileSpreadsheet } from 'lucide-react';
import { BloodRequest, Match } from '../../../types';
import { StatusPill, EmptyState, EntityDrawer, downloadCSV, Badge } from '../widgets/Shared';

interface RequestsProps {
  requests: BloodRequest[];
  matches: Match[];
  statusFilter: string;
  urgencyFilter: string;
  search: string;
  isHi: boolean;
  onStatusFilterChange: (v: string) => void;
  onUrgencyFilterChange: (v: string) => void;
  onSearchChange: (v: string) => void;
}

const STATUS_OPTS = ['open', 'broadcasting', 'matching', 'partially_matched', 'fulfilled', 'cancelled', 'expired'];
const URGENCY_OPTS = ['critical', 'urgent', 'routine'];

export default function Requests({ requests, matches, statusFilter, urgencyFilter, search, isHi,
  onStatusFilterChange, onUrgencyFilterChange, onSearchChange }: RequestsProps) {
  const [selected, setSelected] = React.useState<BloodRequest | null>(null);

  const filtered = React.useMemo(() => {
    let list = requests;
    if (statusFilter) list = list.filter(r => r.status === statusFilter);
    if (urgencyFilter) list = list.filter(r => r.urgency_level === urgencyFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r => [r.tracking_code, r.patient_name, r.hospital_name, r.blood_type_needed, r.hospital_city]
        .some(v => (v || '').toLowerCase().includes(q)));
    }
    return [...list].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }, [requests, statusFilter, urgencyFilter, search]);

  const linkedFor = (rid: string) => matches.filter(m => m.request_id === rid);

  const exportCsv = () => {
    downloadCSV(`requests_${new Date().toISOString().split('T')[0]}.csv`,
      ['Tracking', 'Patient', 'Blood', 'Units', 'Hospital', 'City', 'Urgency', 'Status', 'Created'],
      filtered.map(r => [r.tracking_code, r.patient_name, r.blood_type_needed, r.units_required, r.hospital_name, r.hospital_city, r.urgency_level, r.status, r.created_at]));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink-800 bg-ink-900/60 backdrop-blur-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => onSearchChange(e.target.value)}
            placeholder={isHi ? 'ट्रैकिंग, मरीज, शहर...' : 'Search tracking, patient, city'}
            className="bg-ink-950/60 border border-ink-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-ink-500 focus:outline-none focus:border-blood-500/60 w-56" />
        </div>
        <select value={statusFilter} onChange={e => onStatusFilterChange(e.target.value)} aria-label="status filter"
          className="bg-ink-950/60 border border-ink-700 rounded-xl px-3 py-2 text-xs text-white cursor-pointer">
          <option value="">{isHi ? 'सभी स्थितियां' : 'All statuses'}</option>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={urgencyFilter} onChange={e => onUrgencyFilterChange(e.target.value)} aria-label="urgency filter"
          className="bg-ink-950/60 border border-ink-700 rounded-xl px-3 py-2 text-xs text-white cursor-pointer">
          <option value="">{isHi ? 'सभी गंभीरता' : 'All urgency'}</option>
          {URGENCY_OPTS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <button onClick={exportCsv} className="ml-auto px-3 py-1.5 bg-white/5 border border-ink-700 hover:bg-white/10 text-xs font-semibold text-ink-200 rounded-lg transition cursor-pointer flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>

      <div className="rounded-2xl border border-ink-800 bg-ink-900/60 backdrop-blur-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState title={isHi ? 'कोई अनुरोध नहीं' : 'No requests found'} hint={isHi ? 'फिल्टर बदलें' : 'Try adjusting filters'} isHi={isHi} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-ink-500 border-b border-ink-800">
                  <th className="px-4 py-3">{isHi ? 'ट्रैकिंग' : 'Tracking'}</th>
                  <th className="px-4 py-3">{isHi ? 'मरीज़' : 'Patient'}</th>
                  <th className="px-4 py-3">{isHi ? 'रक्त / यूनिट' : 'Blood / Units'}</th>
                  <th className="px-4 py-3">{isHi ? 'अस्पताल' : 'Hospital'}</th>
                  <th className="px-4 py-3">{isHi ? 'गंभीरता' : 'Urgency'}</th>
                  <th className="px-4 py-3">{isHi ? 'स्थिति' : 'Status'}</th>
                  <th className="px-4 py-3">{isHi ? 'मिलान' : 'Matches'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800/60">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition cursor-pointer" onClick={() => setSelected(r)}>
                    <td className="px-4 py-3 font-mono text-xs text-blood-300">{r.tracking_code || r.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{r.patient_name}</div>
                      <div className="text-[11px] text-ink-500">{r.requester_name}</div>
                    </td>
                    <td className="px-4 py-3"><Badge tone="blood">{r.blood_type_needed}</Badge> <span className="text-[11px] text-ink-500 ml-1">{r.units_required}u</span></td>
                    <td className="px-4 py-3 text-ink-300 text-xs">{r.hospital_name}<div className="text-[11px] text-ink-500">{r.hospital_city}</div></td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${r.urgency_level === 'critical' ? 'text-red-400' : r.urgency_level === 'urgent' ? 'text-amber-400' : 'text-ink-400'}`}>
                        {r.urgency_level}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusPill status={r.status} isHi={isHi} /></td>
                    <td className="px-4 py-3"><Badge tone="ink">{linkedFor(r.id).length}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EntityDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.tracking_code || ''}
        subtitle={selected?.patient_name}
        badge={selected && <StatusPill status={selected.status} isHi={isHi} />}
        rows={selected ? [
          { label: isHi ? 'मरीज़' : 'Patient', value: `${selected.patient_name} (${selected.patient_age ?? '—'}${selected.patient_gender ? ', ' + selected.patient_gender : ''})` },
          { label: isHi ? 'रक्त समूह' : 'Blood Group', value: `${selected.blood_type_needed} · ${selected.units_required} units` },
          { label: isHi ? 'अस्पताल' : 'Hospital', value: selected.hospital_name },
          { label: 'Location', value: `${selected.hospital_area}, ${selected.hospital_city} (${selected.hospital_pincode})` },
          { label: isHi ? 'गंभीरता' : 'Urgency', value: selected.urgency_level },
          { label: isHi ? 'अनुरोधकर्ता' : 'Requester', value: `${selected.requester_name} · ${selected.requester_phone}` },
          { label: isHi ? 'समाप्ति' : 'Expires', value: selected.expires_at ? new Date(selected.expires_at).toLocaleString() : '—' },
          { label: isHi ? 'पुष्ट यूनिट' : 'Confirmed Units', value: String(selected.units_confirmed ?? 0) },
        ] : []}
        actions={selected && (
          <div className="text-[11px] text-ink-400 space-y-1">
            <div className="font-bold uppercase tracking-wider text-ink-500 text-[10px]">{isHi ? 'लिंक किए गए मिलान' : 'Linked Matches'} ({linkedFor(selected.id).length})</div>
            {linkedFor(selected.id).length === 0 && <p>{isHi ? 'कोई मिलान नहीं' : 'No matches'}</p>}
            {linkedFor(selected.id).slice(0, 6).map(m => (
              <div key={m.id} className="flex items-center justify-between text-xs py-1 border-t border-ink-800/50">
                <span className="text-ink-200">{m.donor_name || m.donor_id || m.matchToken?.slice(0,8) || 'donor'}</span>
                <StatusPill status={m.donor_response || 'pending'} isHi={isHi} />
              </div>
            ))}
          </div>
        )}
        isHi={isHi}
      />
    </div>
  );
}
