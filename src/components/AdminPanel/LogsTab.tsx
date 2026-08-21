import { NotificationLog } from '../../types';
import { Terminal } from 'lucide-react';

interface LogsTabProps {
 notifications: NotificationLog[];
}

export default function LogsTab({ notifications }: LogsTabProps) {
 return (
 <div className="bg-[#0c0c0f] border border-[#16161c] rounded-xl p-5 space-y-4">
 <h2 className="text-xs font-semibold text-white uppercase tracking-wider border-b border-[#16161c] pb-3">Gateway Log Stream</h2>
 {notifications.length === 0 ? (
 <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
 <div className="grid h-12 w-12 place-items-center rounded-full bg-zinc-500/10 ring-1 ring-zinc-500/20">
 <Terminal className="h-6 w-6 text-zinc-600" />
 </div>
 <div>
 <p className="text-sm font-semibold text-zinc-300">No notifications yet</p>
 <p className="mt-1 text-xs text-zinc-600">Gateway events will appear here as they fire.</p>
 </div>
 </div>
 ) : (
 <div className="space-y-2 text-xs font-mono">
 {notifications.map(n => (
 <div key={n.id} className="p-3 bg-[#070709] rounded-lg border border-[#16161c] space-y-1">
 <div className="flex justify-between items-center text-zinc-500 text-[10px]">
 <span className="text-rose-400 font-semibold">{n.type.toUpperCase()} GATEWAY</span>
 <span>{n.sent_at ? new Date(n.sent_at).toLocaleString() : 'Pending'}</span>
 </div>
 <p className="text-zinc-300 font-sans text-xs">{n.message_body}</p>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}
