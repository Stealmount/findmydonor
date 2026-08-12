import { Activity } from 'lucide-react';

interface Institution {
  id: string;
  org_name: string;
  type: string;
  registration_number: string;
  verification_status: string;
  contact_person: string;
  phone: string;
  city: string;
  pincode: string;
  email?: string;
  address?: string;
  created_at: string;
  reviewed_by?: string;
  rejection_reason?: string;
}

interface InstitutionsTabProps {
  institutions: Institution[];
  loading: boolean;
  reviewId: string | null;
  rejectReason: string;
  actionLoading: boolean;
  onRefresh: () => void;
  onApprove: (id: string) => void;
  onToggleReject: (id: string) => void;
  onRejectReasonChange: (v: string) => void;
  onConfirmReject: (id: string) => void;
  onCancelReject: () => void;
}

export default function InstitutionsTab({
  institutions,
  loading,
  reviewId,
  rejectReason,
  actionLoading,
  onRefresh,
  onApprove,
  onToggleReject,
  onRejectReasonChange,
  onConfirmReject,
  onCancelReject,
}: InstitutionsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-white uppercase tracking-wider">Institution Approval Queue</h2>
        <button onClick={onRefresh} className="text-[11px] text-zinc-400 hover:text-white transition cursor-pointer flex items-center gap-1">
          <Activity className="w-3 h-3" strokeWidth={1.5} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-zinc-500 text-xs py-8 text-center">Loading institutions...</div>
      ) : institutions.length === 0 ? (
        <div className="text-zinc-500 text-xs py-8 text-center">No institutions registered yet.</div>
      ) : (
        <div className="space-y-5">
          {(['pending', 'verified', 'rejected'] as const).map(statusGroup => {
            const group = institutions.filter(i => i.verification_status === statusGroup);
            if (group.length === 0) return null;
            return (
              <div key={statusGroup}>
                <div className="text-[10px] font-bold uppercase tracking-widest mb-2 px-1 text-zinc-500">
                  {statusGroup === 'pending' ? '⏳ Pending Review' : statusGroup === 'verified' ? '✅ Verified' : '❌ Rejected'}
                  <span className="ml-2 text-zinc-600">({group.length})</span>
                </div>
                <div className="space-y-3">
                  {group.map(inst => (
                    <div key={inst.id} className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-semibold text-sm truncate">{inst.org_name}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                              inst.type === 'hospital' ? 'bg-blue-900/40 text-blue-300' :
                              inst.type === 'ngo' ? 'bg-purple-900/40 text-purple-300' :
                              inst.type === 'blood_bank' ? 'bg-rose-900/40 text-rose-300' :
                              'bg-zinc-800 text-zinc-400'
                            }`}>{inst.type.replace('_', ' ')}</span>
                          </div>
                          <div className="text-zinc-400 text-[11px] mt-1 font-mono">{inst.registration_number}</div>
                        </div>
                        {statusGroup === 'pending' && (
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => onApprove(inst.id)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold rounded-lg transition cursor-pointer disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => onToggleReject(inst.id)}
                              className="px-3 py-1.5 bg-[#1a1a20] hover:bg-rose-900/40 text-zinc-300 hover:text-rose-300 text-[11px] font-bold rounded-lg border border-[#2a2a32] transition cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-zinc-400">
                        <div><span className="text-zinc-600">Contact: </span>{inst.contact_person}</div>
                        <div><span className="text-zinc-600">Phone: </span>{inst.phone}</div>
                        <div><span className="text-zinc-600">City: </span>{inst.city} — {inst.pincode}</div>
                        {inst.email && <div className="col-span-2"><span className="text-zinc-600">Email: </span>{inst.email}</div>}
                        {inst.address && <div className="col-span-3"><span className="text-zinc-600">Address: </span>{inst.address}</div>}
                        <div><span className="text-zinc-600">Registered: </span>{new Date(inst.created_at).toLocaleDateString()}</div>
                        {inst.reviewed_by && <div><span className="text-zinc-600">Reviewed by: </span>{inst.reviewed_by}</div>}
                      </div>

                      {inst.verification_status === 'rejected' && inst.rejection_reason && (
                        <div className="text-[11px] text-rose-400 bg-rose-900/10 border border-rose-900/30 rounded-lg px-3 py-2">
                          <span className="font-bold">Reason: </span>{inst.rejection_reason}
                        </div>
                      )}

                      {reviewId === inst.id && statusGroup === 'pending' && (
                        <div className="space-y-2 pt-1">
                          <input
                            type="text"
                            value={rejectReason}
                            onChange={e => onRejectReasonChange(e.target.value)}
                            placeholder="Reason for rejection (required)..."
                            className="w-full bg-[#070709] border border-rose-900/50 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => onConfirmReject(inst.id)}
                              disabled={!rejectReason.trim() || actionLoading}
                              className="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white text-[11px] font-bold rounded-lg transition cursor-pointer disabled:opacity-40"
                            >
                              Confirm Rejection
                            </button>
                            <button
                              onClick={onCancelReject}
                              className="px-3 py-1.5 bg-[#1a1a20] text-zinc-400 text-[11px] rounded-lg transition cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
