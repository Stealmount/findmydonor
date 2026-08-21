import { ShieldCheck, AlertCircle, ChevronRight, Mail, Lock } from 'lucide-react';

interface AdminLoginProps {
 email: string;
 password: string;
 error: string;
 onEmailChange: (v: string) => void;
 onPasswordChange: (v: string) => void;
 onSubmit: (e: React.FormEvent) => void;
}

export default function AdminLogin({ email, password, error, onEmailChange, onPasswordChange, onSubmit }: AdminLoginProps) {
 return (
 <div className="min-h-screen bg-[#070709] text-zinc-200 flex flex-col items-center justify-center p-6 antialiased font-sans">
 <div className="w-full max-w-sm space-y-6">
 <div className="flex flex-col items-center text-center space-y-2">
 <div className="w-10 h-10 rounded-xl bg-[#111115] border border-[#1a1a20] flex items-center justify-center text-rose-500">
 <ShieldCheck className="w-5 h-5" strokeWidth={1.5} />
 </div>
 <h1 className="text-lg font-semibold tracking-tight text-white">FindMyDonor Console</h1>
 <p className="text-xs text-zinc-400">Isolated Admin Environment</p>
 </div>

 <div className="bg-[#0b0b0e] border border-[#18181f] rounded-2xl p-6 space-y-5">
 <form onSubmit={onSubmit} className="space-y-4">
 {error && (
 <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
 <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
 <span>{error}</span>
 </div>
 )}

 <div className="space-y-1.5">
 <label className="text-xs font-medium text-zinc-300 block">Admin Email</label>
 <div className="relative">
 <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
 <input
 type="email"
 value={email}
 onChange={(e) => onEmailChange(e.target.value)}
 placeholder="admin@findmydonor.online"
 className="w-full bg-[#070709] border border-[#1e1e26] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500/70 transition font-mono"
 required
 />
 </div>
 </div>

 <div className="space-y-1.5">
 <label className="text-xs font-medium text-zinc-300 block">Password</label>
 <div className="relative">
 <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
 <input
 type="password"
 value={password}
 onChange={(e) => onPasswordChange(e.target.value)}
 placeholder="Enter password..."
 className="w-full bg-[#070709] border border-[#1e1e26] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500/70 transition font-mono"
 required
 />
 </div>
 </div>

 <button
 type="submit"
 className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-medium text-xs tracking-wide transition flex items-center justify-center gap-1.5 cursor-pointer"
>
 Authenticate <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
 </button>
 </form>
 </div>

 <p className="text-[11px] text-zinc-500 text-center">FindMyDonor Operational Governance</p>
 </div>
 </div>
 );
}
