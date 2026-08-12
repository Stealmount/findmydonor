import { Eye } from 'lucide-react';
import { User } from '../../types';

interface DonorsTabProps {
  donors: User[];
  showDeleted: boolean;
  bloodFilter: string;
  loading: boolean;
  onToggleDeleted: (show: boolean) => void;
  onBloodFilterChange: (v: string) => void;
  onOpenDetail: (donor: User) => void;
  onForceCooldown: (id: string) => void;
  onLiftCooldown: (id: string) => void;
}

export default function DonorsTab({
  donors,
  showDeleted,
  bloodFilter,
  onToggleDeleted,
  onBloodFilterChange,
  onOpenDetail,
  onForceCooldown,
  onLiftCooldown,
}: DonorsTabProps) {
  return (
    <div className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#16161c] pb-3">
        <h2 className="text-xs font-semibold text-white uppercase tracking-wider">Registered Donors Management</h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => onToggleDeleted(e.target.checked)}
              className="accent-rose-600"
            />
            Show deleted
          </label>
          <select
            value={bloodFilter}
            onChange={(e) => onBloodFilterChange(e.target.value)}
            className="bg-[#070709] border border-[#1e1e26] rounded-lg px-2.5 py-1 text-xs text-zinc-300"
          >
            <option value="">All Blood Groups</option>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto text-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#16161c] text-zinc-500 font-medium text-[11px]">
              <th className="py-2.5 font-medium">Donor Name</th>
              <th className="py-2.5 font-medium">Blood Group</th>
              <th className="py-2.5 font-medium">Pincode</th>
              <th className="py-2.5 font-medium">Account Status</th>
              <th className="py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#141418]">
            {donors
              .filter(d => !bloodFilter || d.blood_type === bloodFilter)
              .map(donor => (
                <tr key={donor.id} className="hover:bg-[#0f0f13] transition">
                  <td className="py-3 font-medium text-white">{donor.full_name}</td>
                  <td className="py-3 font-semibold text-rose-400">{donor.blood_type}</td>
                  <td className="py-3 text-zinc-400 font-mono">{donor.pincode}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      donor.account_status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                      donor.account_status === 'cooldown' ? 'bg-amber-500/10 text-amber-400' :
                      donor.account_status === 'deleted' ? 'bg-zinc-500/10 text-zinc-400 line-through' :
                      'bg-rose-500/10 text-rose-400'
                    }`}>
                      {donor.account_status}
                    </span>
                  </td>
                  <td className="py-3 text-right space-x-2 whitespace-nowrap">
                    <button onClick={() => onOpenDetail(donor)} className="px-2.5 py-1 bg-[#141418] hover:bg-sky-600 hover:text-white rounded-md text-[11px] font-medium transition cursor-pointer inline-flex items-center gap-1">
                      <Eye className="w-3 h-3" strokeWidth={1.5} /> View / Edit
                    </button>
                    {donor.account_status === 'active' ? (
                      <button onClick={() => onForceCooldown(donor.id)} className="px-2.5 py-1 bg-[#141418] hover:bg-amber-600 hover:text-white rounded-md text-[11px] font-medium transition cursor-pointer">
                        Force Cooldown
                      </button>
                    ) : donor.account_status !== 'deleted' ? (
                      <button onClick={() => onLiftCooldown(donor.id)} className="px-2.5 py-1 bg-[#141418] hover:bg-emerald-600 hover:text-white rounded-md text-[11px] font-medium transition cursor-pointer">
                        Lift Cooldown
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
