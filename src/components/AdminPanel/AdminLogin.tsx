import { ShieldCheck, AlertCircle, ChevronRight } from 'lucide-react';

interface AdminLoginProps {
  password: string;
  error: string;
  onPasswordChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function AdminLogin({ password, error, onPasswordChange, onSubmit }: AdminLoginProps) {
  return (
    <div className="min-h-screen bg-[#070709] text-zinc-200 flex flex-col items-center justify-center p-6 antialiased font-sans">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-[#111115] border border-[#1a1a20] flex items-center justify-center text-rose-500 shadow-sm">
            <ShieldCheck className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-white">FindMyDonor Console</h1>
          <p className="text-xs text-zinc-400">Isolated Admin Environment (Port 7000)</p>
        </div>

        <div className="bg-[#0b0b0e] border border-[#18181f] rounded-2xl p-6 shadow-xl space-y-5">
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300 block">Security Access Key</label>
              <input
                type="password"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                placeholder="Enter security key..."
                className="w-full bg-[#070709] border border-[#1e1e26] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500/70 transition font-mono"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-medium text-xs tracking-wide transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
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
