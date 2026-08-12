import React from 'react';
import { LayoutDashboard, Radio, History, Tent, Droplet, Bell, Shield } from 'lucide-react';

export type HospitalView = 'dashboard' | 'live' | 'history' | 'camps';

interface HospitalSidebarProps {
  activeView: HospitalView;
  onNavigate: (v: HospitalView) => void;
  showCamps: boolean;
  pendingReplies: number;
  lowStockCount: number;
  isHi: boolean;
}

export function HospitalSidebar({ activeView, onNavigate, showCamps, pendingReplies, lowStockCount, isHi }: HospitalSidebarProps) {
  const groups: { label: string; labelHi: string; items: { id: HospitalView; label: string; labelHi: string; icon: React.ReactNode; badge?: number; badgeTone?: 'blood' | 'amber' }[] }[] = [
    {
      label: 'Overview', labelHi: 'अवलोकन',
      items: [
        { id: 'dashboard', label: 'Dashboard', labelHi: 'डैशबोर्ड', icon: <LayoutDashboard className="w-4 h-4" /> },
      ],
    },
    {
      label: 'Operations', labelHi: 'संचालन',
      items: [
        { id: 'live', label: 'Live Network', labelHi: 'लाइव नेटवर्क', icon: <Radio className="w-4 h-4" />, badge: pendingReplies, badgeTone: 'blood' },
        { id: 'history', label: 'Request History', labelHi: 'अनुरोध इतिहास', icon: <History className="w-4 h-4" /> },
        ...(lowStockCount > 0 ? [{ id: 'live' as HospitalView, label: 'Low Stock', labelHi: 'कम स्टॉक', icon: <Droplet className="w-4 h-4" />, badge: lowStockCount, badgeTone: 'amber' as const }] : []),
      ],
    },
    ...(showCamps ? [{
      label: 'Outreach', labelHi: 'आउटरीच',
      items: [
        { id: 'camps' as HospitalView, label: 'Donation Camps', labelHi: 'दान शिविर', icon: <Tent className="w-4 h-4" /> },
      ],
    }] : []),
  ];

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-ink-800 bg-ink-950/60 backdrop-blur-xl relative z-10">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-ink-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blood-600/15 border border-blood-500/30 flex items-center justify-center">
          <Shield className="h-4.5 w-4.5 text-blood-400" />
        </div>
        <div>
          <div className="text-[13px] font-extrabold text-white tracking-tight leading-none">RaktDaan</div>
          <div className="text-[10px] font-semibold text-ink-500 mt-1 uppercase tracking-widest">
            {isHi ? 'संस्थागत CRM' : 'Institution CRM'}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label={isHi ? 'मुख्य नेविगेशन' : 'Main navigation'}>
        {groups.map(group => (
          <div key={group.label}>
            <div className="px-3 mb-1.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-ink-600">
              {isHi ? group.labelHi : group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = activeView === item.id;
                return (
                  <button
                    key={item.label}
                    onClick={() => onNavigate(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all cursor-pointer ${
                      active
                        ? 'bg-blood-600/15 text-blood-400 border border-blood-500/25 shadow-[0_0_16px_rgba(244,63,87,0.08)]'
                        : 'text-ink-400 border border-transparent hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {item.icon}
                    <span className="flex-1 text-left truncate">{isHi ? item.labelHi : item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[9.5px] font-extrabold flex items-center justify-center ${
                        item.badgeTone === 'amber'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-blood-600/25 text-blood-300 border border-blood-500/30'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer note */}
      <div className="px-5 py-4 border-t border-ink-800 flex items-center gap-2 text-[10px] text-ink-600">
        <Bell className="w-3 h-3" />
        {isHi ? 'रीयल-टाइम नेटवर्क सिंक' : 'Real-time network sync'}
      </div>
    </aside>
  );
}
