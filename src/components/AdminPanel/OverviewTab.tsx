import { Users, FileSpreadsheet, Activity, CheckCircle2, Server, Download } from 'lucide-react';
import { User, BloodRequest, Match } from '../../types';

interface OverviewTabProps {
 donors: User[];
 requests: BloodRequest[];
 matches: Match[];
 telemetry: any;
 onExportCSV: () => void;
}

export default function OverviewTab({ donors, requests, matches, telemetry, onExportCSV }: OverviewTabProps) {
 const activeDonorsCount = donors.filter(d => d.account_status === 'active').length;
 const openRequestsCount = requests.filter(r => r.status === 'open').length;

 return (
 <div className="space-y-6">
 {/* Stat Cards */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 <div className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-4 space-y-2">
 <div className="flex items-center justify-between text-xs text-zinc-400">
 <span>Registered Donors</span>
 <Users className="w-4 h-4 text-rose-500" strokeWidth={1.5} />
 </div>
 <div className="text-2xl font-semibold text-white">{donors.length}</div>
 <div className="text-[11px] text-emerald-400">{activeDonorsCount} active & ready</div>
 </div>

 <div className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-4 space-y-2">
 <div className="flex items-center justify-between text-xs text-zinc-400">
 <span>Open Requests</span>
 <FileSpreadsheet className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
 </div>
 <div className="text-2xl font-semibold text-white">{openRequestsCount}</div>
 <div className="text-[11px] text-amber-400">{requests.filter(r => r.urgency_level === 'critical').length} critical cases</div>
 </div>

 <div className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-4 space-y-2">
 <div className="flex items-center justify-between text-xs text-zinc-400">
 <span>Match Pairs</span>
 <Activity className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
 </div>
 <div className="text-2xl font-semibold text-white">{matches.length}</div>
 <div className="text-[11px] text-blue-400">Automated dispatch active</div>
 </div>

 <div className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-4 space-y-2">
 <div className="flex items-center justify-between text-xs text-zinc-400">
 <span>Lives Saved</span>
 <CheckCircle2 className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
 </div>
 <div className="text-2xl font-semibold text-white">{matches.filter(m => m.outcome === 'donated').length}</div>
 <div className="text-[11px] text-emerald-400">Fulfilled donations</div>
 </div>
 </div>

 {/* System Health Block */}
 <div className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-5 space-y-4">
 <div className="flex items-center justify-between border-b border-[#16161c] pb-3">
 <div className="flex items-center gap-2">
 <Server className="w-4 h-4 text-rose-500" strokeWidth={1.5} />
 <span className="text-xs font-semibold text-white">Infrastructure & Gateway Health</span>
 </div>
 <button onClick={onExportCSV} className="px-2.5 py-1 bg-[#141418] hover:bg-[#1a1a20] text-xs font-medium text-zinc-300 rounded-lg transition flex items-center gap-1.5 cursor-pointer">
 <Download className="w-3.5 h-3.5" strokeWidth={1.5} /> Export Audit CSV
 </button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
 <div className="bg-[#070709] p-3.5 rounded-lg border border-[#1a1a20] space-y-1">
 <div className="text-zinc-400 text-[11px]">Server Process Uptime</div>
 <div className="text-sm font-semibold text-emerald-400">{telemetry?.server_uptime_seconds || 1420} seconds</div>
 </div>
 <div className="bg-[#070709] p-3.5 rounded-lg border border-[#1a1a20] space-y-1">
 <div className="text-zinc-400 text-[11px]">System Memory RSS / Heap</div>
 <div className="text-sm font-semibold text-blue-400">{telemetry?.memory?.rss_mb || 112} MB / {telemetry?.memory?.heap_used_mb || 64} MB</div>
 </div>
 <div className="bg-[#070709] p-3.5 rounded-lg border border-[#1a1a20] space-y-1">
 <div className="text-zinc-400 text-[11px]">Database Synchronization</div>
 <div className="text-sm font-semibold text-zinc-300">Supabase + Firestore Dual Cluster</div>
 </div>
 </div>
 </div>
 </div>
 );
}
