import { Send } from 'lucide-react';

interface SOSTabProps {
 city: string;
 bloodType: string;
 message: string;
 status: string | null;
 sending: boolean;
 onCityChange: (v: string) => void;
 onBloodTypeChange: (v: string) => void;
 onMessageChange: (v: string) => void;
 onSubmit: (e: React.FormEvent) => void;
}

export default function SOSTab({
 city,
 bloodType,
 message,
 status,
 sending,
 onCityChange,
 onBloodTypeChange,
 onMessageChange,
 onSubmit,
}: SOSTabProps) {
 return (
 <div className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-5 space-y-4 max-w-xl">
 <div className="flex items-center gap-2 border-b border-[#16161c] pb-3">
 <Send className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
 <h2 className="text-xs font-semibold text-white uppercase tracking-wider">Emergency SOS City Alert Broadcaster</h2>
 </div>

 <form onSubmit={onSubmit} className="space-y-4 text-xs font-sans">
 {status && (
 <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
 {status}
 </div>
 )}

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className="text-zinc-300 font-medium block">Target City / Pincode</label>
 <input
 type="text"
 placeholder="e.g. Delhi, 110001"
 value={city}
 onChange={(e) => onCityChange(e.target.value)}
 className="w-full bg-[#070709] border border-[#1e1e26] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rose-500"
 />
 </div>

 <div className="space-y-1.5">
 <label className="text-zinc-300 font-medium block">Blood Group Filter</label>
 <select
 value={bloodType}
 onChange={(e) => onBloodTypeChange(e.target.value)}
 className="w-full bg-[#070709] border border-[#1e1e26] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rose-500"
>
 <option value="">All Blood Groups</option>
 {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => (
 <option key={b} value={b}>{b}</option>
 ))}
 </select>
 </div>
 </div>

 <div className="space-y-1.5">
 <label className="text-zinc-300 font-medium block">Emergency Alert Body</label>
 <textarea
 rows={3}
 value={message}
 onChange={(e) => onMessageChange(e.target.value)}
 placeholder="Urgent blood requirement alert for O-negative blood group at AIIMS..."
 className="w-full bg-[#070709] border border-[#1e1e26] rounded-lg p-3 text-white focus:outline-none focus:border-rose-500"
 required
 />
 </div>

 <button
 type="submit"
 disabled={sending}
 className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
>
 <Send className="w-3.5 h-3.5" strokeWidth={1.5} /> Dispatch Emergency Alert
 </button>
 </form>
 </div>
 );
}
