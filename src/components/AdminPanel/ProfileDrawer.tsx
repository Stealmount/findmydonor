import { Users, UserRound, X, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { User, Requester } from '../../types';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ProfileDrawerProps {
  drawer: {
    kind: 'donor' | 'requester';
    donor?: User;
    requester?: Requester;
    donorProfile?: any;
    stats?: any;
  };
  editForm: Record<string, string>;
  actionLoading: boolean;
  onClose: () => void;
  onEditChange: (key: string, value: string) => void;
  onSave: () => void;
  onSoftDelete: () => void;
  onRestore: () => void;
}

export default function ProfileDrawer({
  drawer,
  editForm,
  actionLoading,
  onClose,
  onEditChange,
  onSave,
  onSoftDelete,
  onRestore,
}: ProfileDrawerProps) {
  const drawerRef = useFocusTrap<HTMLDivElement>(true);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={drawer.kind === 'donor' ? 'Donor profile management' : 'Requester profile management'}
        tabIndex={-1}
        className="w-full max-w-lg h-full bg-[#0b0b0e] border-l border-[#1e1e26] overflow-y-auto p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#16161c] pb-4">
          <div className="flex items-center gap-2">
            {drawer.kind === 'donor' ? (
              <Users className="w-4 h-4 text-rose-500" strokeWidth={1.5} />
            ) : (
              <UserRound className="w-4 h-4 text-sky-500" strokeWidth={1.5} />
            )}
            <h2 className="text-sm font-semibold text-white capitalize">{drawer.kind} Profile Management</h2>
          </div>
          <button onClick={onClose} aria-label="Close profile" className="p-1.5 text-zinc-500 hover:text-white transition cursor-pointer">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          {drawer.kind === 'donor' && drawer.donor ? (
            <>
              <div className="p-3 bg-[#070709] rounded-lg border border-[#1a1a20]">
                <div className="text-zinc-500 text-[10px]">Blood Group</div>
                <div className="text-rose-400 font-semibold">{drawer.donor.blood_type}</div>
              </div>
              <div className="p-3 bg-[#070709] rounded-lg border border-[#1a1a20]">
                <div className="text-zinc-500 text-[10px]">Account Status</div>
                <div className="text-white font-semibold capitalize">{drawer.donor.account_status}</div>
              </div>
              <div className="p-3 bg-[#070709] rounded-lg border border-[#1a1a20]">
                <div className="text-zinc-500 text-[10px]">Total Matches</div>
                <div className="text-white font-semibold">{drawer.stats?.total_matches ?? '-'}</div>
              </div>
              <div className="p-3 bg-[#070709] rounded-lg border border-[#1a1a20]">
                <div className="text-zinc-500 text-[10px]">Donations</div>
                <div className="text-white font-semibold">{drawer.stats?.total_donations ?? '-'}</div>
              </div>
            </>
          ) : drawer.requester ? (
            <>
              <div className="p-3 bg-[#070709] rounded-lg border border-[#1a1a20]">
                <div className="text-zinc-500 text-[10px]">Phone</div>
                <div className="text-white font-semibold font-mono">{drawer.requester.phone}</div>
              </div>
              <div className="p-3 bg-[#070709] rounded-lg border border-[#1a1a20]">
                <div className="text-zinc-500 text-[10px]">Account Status</div>
                <div className="text-white font-semibold capitalize">{drawer.requester.account_status || 'active'}</div>
              </div>
              <div className="p-3 bg-[#070709] rounded-lg border border-[#1a1a20]">
                <div className="text-zinc-500 text-[10px]">Email</div>
                <div className="text-white font-semibold truncate">{drawer.requester.email || '-'}</div>
              </div>
              <div className="p-3 bg-[#070709] rounded-lg border border-[#1a1a20]">
                <div className="text-zinc-500 text-[10px]">Registered</div>
                <div className="text-white font-semibold">{drawer.requester.created_at ? new Date(drawer.requester.created_at).toLocaleDateString() : '-'}</div>
              </div>
            </>
          ) : null}
        </div>

        {/* Edit form */}
        <div className="space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Edit Profile Fields</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(editForm).map(([key, value]) => {
              if (key === 'emergency_only' || key === 'gender' || key === 'availability_status' || key === 'number_sharing_pref') return null; // handled by selects below
              if (key === 'address_text') return null; // full-width below
              return (
                <div key={key} className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wide block">{key.replace(/_/g, ' ')}</label>
                  <input
                    type={key === 'weight_kg' || key === 'age' ? 'number' : 'text'}
                    value={value}
                    onChange={(e) => onEditChange(key, e.target.value)}
                    className="w-full bg-[#070709] border border-[#1e1e26] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500/70 transition"
                  />
                </div>
              );
            })}
          </div>

          {drawer.kind === 'donor' && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wide block">Address</label>
                <input
                  value={editForm.address_text || ''}
                  onChange={(e) => onEditChange('address_text', e.target.value)}
                  className="w-full bg-[#070709] border border-[#1e1e26] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500/70 transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wide block">Availability</label>
                  <select
                    value={editForm.availability_status || ''}
                    onChange={(e) => onEditChange('availability_status', e.target.value)}
                    className="w-full bg-[#070709] border border-[#1e1e26] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500/70 transition"
                  >
                    <option value="available">Available</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wide block">Emergency Only</label>
                  <select
                    value={editForm.emergency_only || 'false'}
                    onChange={(e) => onEditChange('emergency_only', e.target.value)}
                    className="w-full bg-[#070709] border border-[#1e1e26] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500/70 transition"
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-[#16161c]">
          <button
            onClick={onSave}
            disabled={actionLoading}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium rounded-lg transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} /> Save Changes
          </button>
          {(drawer.donor?.account_status !== 'deleted' && drawer.requester?.account_status !== 'deleted') && (
            <button
              onClick={onSoftDelete}
              disabled={actionLoading}
              className="px-4 py-2 bg-[#1a1a20] hover:bg-rose-900/40 text-zinc-300 hover:text-rose-300 text-xs font-medium rounded-lg border border-[#2a2a32] transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} /> Soft Delete
            </button>
          )}
          {(drawer.donor?.account_status === 'deleted' || drawer.requester?.account_status === 'deleted') && (
            <button
              onClick={onRestore}
              disabled={actionLoading}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} /> Restore Account
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
