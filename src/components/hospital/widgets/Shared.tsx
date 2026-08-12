import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Droplet, X } from 'lucide-react';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

// Status pill helper (bilingual) shared across views.
export function StatusPill({ status, isHi }: { status: string; isHi: boolean }) {
  const map: Record<string, { label: string; hi: string; cls: string }> = {
    approved:  { label: 'Approved',   hi: 'स्वीकृत',    cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
    declined:  { label: 'Declined',   hi: 'अस्वीकृत',   cls: 'bg-red-500/10 border-red-500/30 text-red-400' },
    pending:   { label: 'Pending',    hi: 'प्रतीक्षारत', cls: 'bg-ink-700 border-ink-600 text-ink-300' },
    open:      { label: 'Active',     hi: 'सक्रिय',      cls: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
    fulfilled: { label: 'Fulfilled',  hi: 'पूर्ण',       cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
    cancelled: { label: 'Cancelled',  hi: 'रद्द',        cls: 'bg-red-500/10 border-red-500/30 text-red-400' },
    searching: { label: 'Searching',  hi: 'खोज जारी',   cls: 'bg-ink-700 border-ink-600 text-ink-300' },
  };
  const cfg = map[status] || map['pending'];
  return (
    <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${cfg.cls}`}>
      {isHi ? cfg.hi : cfg.label}
    </span>
  );
}

// Empty state: friendly blood-drop card (Phase 8.2 pattern).
export function EmptyState({ title, titleHi, hint, hintHi, isHi }: { title: string; titleHi: string; hint: string; hintHi: string; isHi: boolean }) {
  return (
    <div className="py-12 text-center rounded-3xl bg-ink-950/40 border border-ink-800/40">
      <div className="w-14 h-14 rounded-full bg-blood-600/10 border border-blood-500/20 flex items-center justify-center mx-auto mb-4">
        <Droplet className="h-7 w-7 text-blood-400" />
      </div>
      <p className="text-sm font-semibold text-white/70">{isHi ? titleHi : title}</p>
      <p className="text-xs text-ink-500 mt-1">{isHi ? hintHi : hint}</p>
    </div>
  );
}

// ── KPI stat card ──────────────────────────────────────────────────────────────
export function StatCard({ icon, label, labelHi, value, tone = 'blood', isHi }: {
  icon: React.ReactNode; label: string; labelHi: string; value: string | number; tone?: 'blood' | 'emerald' | 'amber' | 'ink'; isHi: boolean;
}) {
  const tones: Record<string, string> = {
    blood:   'text-blood-400 bg-blood-500/10 border-blood-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
    ink:     'text-ink-300 bg-white/5 border-white/10',
  };
  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900/60 backdrop-blur-xl p-4 sm:p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${tones[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink-500 truncate">
          {isHi ? labelHi : label}
        </div>
        <div className="text-2xl font-extrabold text-white tracking-tight leading-tight mt-0.5 tabular-nums">
          {value}
        </div>
      </div>
    </div>
  );
}

// ── Focus-trapped detail drawer for donor / request records ───────────────────
export interface EntityDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  rows: { label: string; value: string }[];
  actions?: React.ReactNode;
  isHi: boolean;
}

export function EntityDrawer({ open, onClose, title, subtitle, badge, rows, actions, isHi }: EntityDrawerProps) {
  const trapRef = useFocusTrap<HTMLElement>(open);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.aside
            key="drawer"
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: 'easeInOut' }}
            className="fixed right-0 top-0 bottom-0 z-[70] h-full w-full max-w-md bg-ink-950 border-l border-ink-800 flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-ink-800 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[15px] font-bold text-white tracking-tight truncate">{title}</h3>
                  {badge}
                </div>
                {subtitle && <p className="text-[12px] text-ink-500 mt-1 truncate">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-ink-400 hover:text-white transition shrink-0 cursor-pointer"
                aria-label={isHi ? 'बंद करें' : 'Close'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {rows.map(r => (
                <div key={r.label}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">{r.label}</div>
                  <div className="text-[13px] font-semibold text-white mt-0.5 break-words">{r.value}</div>
                </div>
              ))}
              {rows.length === 0 && (
                <p className="text-[13px] text-ink-500">{isHi ? 'कोई विवरण उपलब्ध नहीं' : 'No details available'}</p>
              )}
            </div>

            {/* Actions */}
            {actions && (
              <div className="px-6 py-5 border-t border-ink-800 bg-ink-950/60 space-y-2">
                {actions}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
