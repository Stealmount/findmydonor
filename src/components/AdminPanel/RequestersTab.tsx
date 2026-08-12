import { Eye } from 'lucide-react';
import { Requester } from '../../types';

interface RequestersTabProps {
  requesters: Requester[];
  showDeleted: boolean;
  loading: boolean;
  onToggleDeleted: (show: boolean) => void;
  onOpenDetail: (requester: Requester) => void;
}

export default function RequestersTab({
  requesters,
  showDeleted,
  loading,
  onToggleDeleted,
  onOpenDetail,
}: RequestersTabProps) {
  return (
    <div className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#16161c] pb-3">
        <h2 className="text-xs font-semibold text-white uppercase tracking-wider">Requester Accounts Management</h2>
        <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => onToggleDeleted(e.target.checked)}
            className="accent-rose-600"
          />
          Show deleted
        </label>
      </div>

      {loading ? (
        <div className="text-zinc-500 text-xs py-8 text-center">Loading requesters...</div>
      ) : requesters.length === 0 ? (
        <div className="text-zinc-500 text-xs py-8 text-center">No requester accounts found.</div>
      ) : (
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#16161c] text-zinc-500 font-medium text-[11px]">
                <th className="py-2.5 font-medium">Requester Name</th>
                <th className="py-2.5 font-medium">Phone</th>
                <th className="py-2.5 font-medium">Account Status</th>
                <th className="py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141418]">
              {requesters.map(requester => (
                <tr key={requester.id} className="hover:bg-[#0f0f13] transition">
                  <td className="py-3 font-medium text-white">{requester.full_name}</td>
                  <td className="py-3 text-zinc-400 font-mono">{requester.phone}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      requester.account_status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                      requester.account_status === 'deleted' ? 'bg-zinc-500/10 text-zinc-400 line-through' :
                      'bg-rose-500/10 text-rose-400'
                    }`}>
                      {requester.account_status || 'active'}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button onClick={() => onOpenDetail(requester)} className="px-2.5 py-1 bg-[#141418] hover:bg-sky-600 hover:text-white rounded-md text-[11px] font-medium transition cursor-pointer inline-flex items-center gap-1">
                      <Eye className="w-3 h-3" strokeWidth={1.5} /> View / Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
