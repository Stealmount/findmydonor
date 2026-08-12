import React from 'react';
import { Users, FileSpreadsheet, GitFork, CheckCircle2, Server, Download, Inbox, BadgeAlert } from 'lucide-react';
import { User, BloodRequest, Match, NotificationLog, DonationLog } from '../../../types';
import { StatCard, EmptyState, Badge } from '../widgets/Shared';

interface OverviewProps {
  donors: User[];
  requests: BloodRequest[];
  matches: Match[];
  notifications: NotificationLog[];
  donationLogs: DonationLog[];
  telemetry: any;
  isHi: boolean;
  onExportCSV: () => void;
}

export default function Overview({ donors, requests, matches, notifications, donationLogs, telemetry, isHi, onExportCSV }: OverviewProps) {
  const active = donors.filter(d => d.account_status === 'active').length;
  const cooldown = donors.filter(d => d.account_status === 'cooldown').length;
  const banned = donors.filter(d => d.account_status === 'banned').length;
  const openReq = requests.filter(r => ['open', 'broadcasting', 'matching', 'partially_matched'].includes(r.status)).length;
  const critical = requests.filter(r => r.urgency_level === 'critical').length;
  const fulfilled = matches.filter(m => m.outcome === 'donated').length;
  const pending = matches.filter(m => m.donor_response === 'pending').length;
  const accepted = matches.filter(m => ['accepted', 'responded', 'approved'].includes(m.donor_response)).length;
  const dropped = matches.filter(m => ['declined', 'expired', 'no_response'].includes(m.donor_response)).length;
  const sent = notifications.filter(n => n.status === 'sent').length;

  const byStatus = (['open', 'partially_matched', 'fulfilled', 'cancelled', 'expired'] as const).map(s => ({
    s, n: requests.filter(r => r.status === s).length,
  })).filter(x => x.n > 0);

  const recent = [...(notifications || [])]
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Stat grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users className="h-5 w-5" />} label={isHi ? 'पंजीकृत दाता' : 'Registered Donors'} value={donors.length} tone="blood" isHi={isHi} />
        <StatCard icon={<FileSpreadsheet className="h-5 w-5" />} label={isHi ? 'सक्रिय अनुरोध' : 'Active Requests'} value={openReq} tone="amber" isHi={isHi} />
        <StatCard icon={<GitFork className="h-5 w-5" />} label={isHi ? 'मिलान जोड़े' : 'Match Pairs'} value={matches.length} tone="blue" isHi={isHi} />
        <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label={isHi ? 'जीवन बचाए गए' : 'Lives Saved'} value={fulfilled} tone="emerald" isHi={isHi} />
      </div>

      {/* Secondary health row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: isHi ? 'सक्रिय दाता' : 'Active Donors', value: `${active} active · ${cooldown} cooling · ${banned} banned`, tone: 'text-emerald-400' },
          { label: isHi ? 'गंभीर मामले' : 'Critical Cases', value: critical, tone: critical > 0 ? 'text-red-400' : 'text-emerald-400' },
          { label: isHi ? 'लंबित उत्तर' : 'Pending Replies', value: pending, tone: 'text-amber-400' },
          { label: isHi ? 'अनुरोध पर स्थिति' : 'Request Status', value: `${fulfilled} fulfilled`, tone: 'text-emerald-400' },
        ].map((c, i) => (
          <div key={i} className="rounded-2xl border border-ink-800 bg-ink-900/60 backdrop-blur-xl px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink-500">{c.label}</div>
            <div className={`text-lg font-bold mt-1 tabular-nums ${c.tone}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request status breakdown */}
        <div className="rounded-2xl border border-ink-800 bg-ink-900/60 backdrop-blur-xl p-5">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink-400 mb-4">{isHi ? 'अनुरोध स्थिति' : 'Request Pipeline'}</h3>
          {byStatus.length === 0 ? (
            <EmptyState title={isHi ? 'कोई अनुरोध नहीं' : 'No requests'} hint={''} isHi={isHi} />
          ) : (
            <div className="space-y-2">
              {byStatus.map(({ s, n }) => (
                <div key={s} className="flex items-center justify-between text-xs">
                  <span className="text-ink-300 capitalize">{isHi ? s : s}</span>
                  <div className="w-32 bg-ink-800 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-blood-600 rounded-full" style={{ width: `${Math.min(100, (n / Math.max(1, requests.length)) * 100)}%` }} />
                  </div>
                  <span className="text-ink-100 font-bold tabular-nums">{n}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Match response breakdown */}
        <div className="rounded-2xl border border-ink-800 bg-ink-900/60 backdrop-blur-xl p-5">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink-400 mb-4">{isHi ? 'मिलान उत्तर' : 'Match Responses'}</h3>
          <div className="space-y-2">
            {[
              { l: isHi ? 'स्वीकृत' : 'Accepted', n: accepted, c: 'bg-emerald-500' },
              { l: isHi ? 'लंबित' : 'Pending', n: pending, c: 'bg-amber-500' },
              { l: isHi ? 'अस्वीकृत / समाप्त' : 'Dropped', n: dropped, c: 'bg-red-500' },
            ].map(x => (
              <div key={x.l} className="flex items-center justify-between text-xs">
                <span className="text-ink-300">{x.l}</span>
                <div className="w-32 bg-ink-800 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${x.c}`} style={{ width: `${Math.min(100, (x.n / Math.max(1, matches.length)) * 100)}%` }} />
                </div>
                <span className="text-ink-100 font-bold tabular-nums">{x.n}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-ink-800 text-xs text-ink-400">
            <div className="flex justify-between"><span>{isHi ? 'भेजे गए नोटिफिकेशन' : 'Notifications sent'}</span><b className="text-white">{sent}</b></div>
            <div className="flex justify-between mt-1"><span>{isHi ? 'दान लॉग' : 'Donation logs'}</span><b className="text-white">{donationLogs.length}</b></div>
          </div>
        </div>

        {/* Recent activity + export */}
        <div className="rounded-2xl border border-ink-800 bg-ink-900/60 backdrop-blur-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink-400">{isHi ? 'हाल की गतिविधि' : 'Recent Activity'}</h3>
            <button onClick={onExportCSV} className="px-3 py-1.5 bg-white/5 border border-ink-700 hover:bg-white/10 text-xs font-semibold text-ink-200 rounded-lg transition transition-colors cursor-pointer flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> {isHi ? 'CSV निर्यात' : 'Export CSV'}
            </button>
          </div>
          {recent.length === 0 ? (
            <EmptyState title={isHi ? 'कोई गतिविधि नहीं' : 'No activity yet'} hint="Pattern" isHi={isHi} />
          ) : (
            <div className="flex-1 space-y-3 overflow-hidden">
              {recent.map((n, i) => (
                <div key={i} className="flex items-start gap-3">
                  <BadgeAlert className="w-3.5 h-3.5 text-ink-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-ink-100 line-clamp-2">{n.message_body}</div>
                    <div className="text-[10px text-ink-500 font-mono">{n.trigger_event} · {new Date(n.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Infrastructure health */}
      <div className="rounded-2xl border border-ink-800 bg-ink-900/60 backdrop-blur-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Server className="w-4 h-4 text-blood-500" />
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink-400">{isHi ? 'इंफ्रास्ट्रक्चर स्वास्थ्य' : 'Infrastructure & Gateway Health'}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-ink-900/60 p-3.5 rounded-lg border border-ink-800 space-y-1">
            <div className="text-ink-500 text-[11px]">{isHi ? 'सर्वर अपटाइम' : 'Server Uptime'}</div>
            <div className="text-sm font-semibold text-emerald-400 tabular-nums">{telemetry?.server_uptime_seconds ? Math.floor(telemetry.server_uptime_seconds / 60) + ' min' : '—'}</div>
          </div>
          <div className="bg-ink-900/60 p-3.5 rounded-lg border border-ink-800 space-y-1">
            <div className="text-ink-500 text-[11px">{isHi ? 'मेमोरी' : 'Memory RSS / Heap'}</div>
            <div className="text-sm font-semibold text-blue-400 tabular-nums">
              {telemetry?.memory?.rss_mb || '—'} MB / {telemetry?.memory?.heap_used_mb || '—'} MB
            </div>
          </div>
          <div className="bg-ink-900/60 p-3.5 rounded-lg border border-ink-800 space-y-1">
            <div className="text-ink-500 text-[11px">{isHi ? 'सेवाएं' : 'Services'}</div>
            <div className="text-sm font-semibold text-zinc-300">
              {telemetry?.services ? Object.entries(telemetry.services).map(([k, v]) => `${k}:${v}`).join(' · ') : '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
