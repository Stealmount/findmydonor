import {
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  Building,
  Send,
  Terminal,
  Search,
  LogOut,
  Zap,
  Droplets,
  UserRound,
} from 'lucide-react';

export type AdminTab = 'overview' | 'donors' | 'requesters' | 'requests' | 'stocks' | 'institutions' | 'sos' | 'logs';

interface AdminSidebarProps {
  children: React.ReactNode;
  activeTab: AdminTab;
  pendingInstitutionsCount: number;
  onTabChange: (tab: AdminTab) => void;
  onLoadRequesters: () => void;
  onLoadInstitutions: () => void;
  onLogout: () => void;
  onSweep: () => void;
  globalSearch: string;
  onGlobalSearchChange: (v: string) => void;
}

export default function AdminSidebar({
  children,
  activeTab,
  pendingInstitutionsCount,
  onTabChange,
  onLoadRequesters,
  onLoadInstitutions,
  onLogout,
  onSweep,
  globalSearch,
  onGlobalSearchChange,
}: AdminSidebarProps) {
  const navBtn = (tab: AdminTab, icon: React.ReactNode, label: React.ReactNode, extra?: React.ReactNode) => (
    <button
      onClick={() => {
        if (tab === 'requesters') onLoadRequesters();
        if (tab === 'institutions') onLoadInstitutions();
        onTabChange(tab);
      }}
      aria-current={activeTab === tab ? 'page' : undefined}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
        activeTab === tab ? 'bg-[#141418] text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#0e0e11]'
      }`}
    >
      {icon} {label}
      {extra}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-200 font-sans flex flex-col md:flex-row antialiased">
      {/* ─── SIDEBAR (ULTRA MINIMAL REFUSED) ────────────────────────────────── */}
      <aside className="w-full md:w-56 bg-[#070709] border-r border-[#16161b] flex flex-col justify-between shrink-0">
        <div className="p-4 space-y-6">
          {/* Brand Header */}
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="w-6 h-6 rounded-md bg-rose-600 flex items-center justify-center text-white">
              <Droplets className="w-3.5 h-3.5" strokeWidth={2} />
            </div>
            <div>
              <div className="text-xs font-semibold text-white tracking-tight">FindMyDonor</div>
              <div className="text-[10px] text-zinc-500 font-mono">ADMIN TOWER</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navBtn('overview', <LayoutDashboard className="w-4 h-4 text-rose-500" strokeWidth={1.5} />, 'Overview')}
            {navBtn('donors', <Users className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />, 'Donors Directory')}
            {navBtn('requesters', <UserRound className="w-4 h-4 text-sky-500" strokeWidth={1.5} />, 'Requesters')}
            {navBtn('requests', <FileSpreadsheet className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />, 'Emergency Pipeline')}
            {navBtn('stocks', <Building className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />, 'Blood Bank Stocks')}
            {navBtn(
              'institutions',
              <Building className="w-4 h-4 text-emerald-500" strokeWidth={1.5} />,
              <span>Institution Approvals</span>,
              pendingInstitutionsCount > 0 ? (
                <span className="ml-auto bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {pendingInstitutionsCount}
                </span>
              ) : undefined
            )}
            {navBtn('sos', <Send className="w-4 h-4 text-amber-500" strokeWidth={1.5} />, 'SOS Broadcaster')}
            {navBtn('logs', <Terminal className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />, 'Gateway Logs')}
          </nav>
        </div>

        {/* Footer & End Session */}
        <div className="p-3 border-t border-[#16161b]">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-[#141418] transition cursor-pointer"
          >
            <span className="font-medium">End Session</span>
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT CANVAS ───────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#070709]">
        {/* Top Minimal Bar */}
        <header className="sticky top-0 z-20 bg-[#070709]/90 backdrop-blur-md border-b border-[#16161b] px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Admin</span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-200 font-medium capitalize">{activeTab}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Search donors, pincode..."
                value={globalSearch}
                onChange={(e) => onGlobalSearchChange(e.target.value)}
                className="bg-[#0f0f13] border border-[#1e1e26] rounded-lg pl-8 pr-8 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500/70 w-52 transition font-sans"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-mono bg-[#16161c] px-1 py-0.2 rounded border border-[#23232c]">⌘K</span>
            </div>

            <button
              onClick={onSweep}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Zap className="w-3.5 h-3.5" strokeWidth={1.5} /> Run Match Engine
            </button>
          </div>
        </header>

        <div className="p-6 space-y-6">{children}</div>
      </main>
    </div>
  );
}
