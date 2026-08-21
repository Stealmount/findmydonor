import React from 'react';
import { HelpCircle, Plus, Eye, EyeOff } from 'lucide-react';
import { FaqEntry } from '../../AdminPanel/useAdminPanel';
import { EmptyState, StatusPill } from '../widgets/Shared';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

interface FaqProps {
 faqs: FaqEntry[];
 loading: boolean;
 isHi: boolean;
 onSaveFaq: (faq: Omit<FaqEntry, 'id' | 'created_at'> & { id?: string }) => Promise<boolean>;
 onToggleActive: (id: string, active: boolean) => void;
}

const EMPTY_DRAFT = { title_en: '', title_hi: '', body_en: '', body_hi: '', active: true };

export default function Faq({ faqs, loading, isHi, onSaveFaq, onToggleActive }: FaqProps) {
 const [editing, setEditing] = React.useState<(Omit<FaqEntry, 'id' | 'created_at'> & { id?: string }) | null>(null);
 const [saving, setSaving] = React.useState(false);
 const [showHidden, setShowHidden] = React.useState(false);
 const editingTrapRef = useFocusTrap<HTMLDivElement>(!!editing);

 const visible = showHidden ? faqs : faqs.filter(f => f.active);

 const update = (k: keyof typeof EMPTY_DRAFT, v: string | boolean) => {
 if (!editing) return;
 setEditing({ ...editing, [k]: v });
 };

 const save = async () => {
 if (!editing) return;
 if (!editing.title_en.trim() || !editing.body_en.trim()) return;
 setSaving(true);
 const ok = await onSaveFaq(editing);
 setSaving(false);
 if (ok) setEditing(null);
 };

 return (
 <div className="space-y-4">
 <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-4 flex flex-wrap items-center gap-3">
 <div className="flex items-center gap-2">
 <HelpCircle className="w-4 h-4 text-blood-400" />
 <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink-400">{isHi ? 'सामग्री और FAQ' : 'Content & FAQ'}</h3>
 <span className="text-[11px] text-ink-500">({visible.length})</span>
 </div>
 <button onClick={() => setShowHidden(v => !v)}
 className="px-3 py-1.5 text-xs font-semibold text-ink-300 bg-white/5 border border-ink-700 hover:bg-white/10 rounded-lg transition cursor-pointer ml-auto flex items-center gap-1.5">
 {showHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
 {isHi ? 'छिपे हुए' : 'Hidden'}
 </button>
 <button onClick={() => setEditing({ ...EMPTY_DRAFT })}
 className="px-3 py-1.5 bg-blood-600 hover:bg-blood-500 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5">
 <Plus className="w-3.5 h-3.5" /> {isHi ? 'नया FAQ' : 'New FAQ'}
 </button>
 </div>

 {loading ? (
 <div className="p-16 flex items-center justify-center">
 <span className="w-6 h-6 border-2 border-blood-500/30 border-t-blood-500 rounded-full animate-spin" />
 </div>
 ) : visible.length === 0 ? (
 <EmptyState title={isHi ? 'कोई FAQ नहीं' : 'No FAQ entries'} hint={isHi ? 'नया FAQ बनाएं' : 'Create your first FAQ entry'} isHi={isHi} />
 ) : (
 <div className="space-y-3">
 {visible.map(f => (
 <div key={f.id} className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5 flex items-start justify-between gap-4">
 <div className="min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <h4 className="text-[14px] font-bold text-white">{f.title_en || f.title_hi}</h4>
 {!f.active && <span className="text-[10px] font-bold text-ink-400 bg-ink-700 rounded-full px-2 py-0.5">{isHi ? 'छिपा' : 'Hidden'}</span>}
 </div>
 <p className="text-[12px] text-ink-400 mt-1">{f.title_hi}</p>
 <p className="text-[13px] text-ink-300 mt-2 line-clamp-2">{f.body_en}</p>
 </div>
 <div className="flex flex-col gap-2 shrink-0">
 <button onClick={() => { setEditing({ ...f }); }}
 className="px-3 py-1.5 text-xs font-semibold text-ink-200 bg-white/5 border border-ink-700 hover:bg-white/10 rounded-lg transition cursor-pointer">
 {isHi ? 'संपादित करें' : 'Edit'}
 </button>
 <button onClick={() => onToggleActive(f.id, !f.active)}
 className="px-3 py-1.5 text-xs font-semibold text-ink-300 bg-white/5 border border-ink-700 hover:bg-white/10 rounded-lg transition cursor-pointer">
 {f.active ? (isHi ? 'छिपाएं' : 'Hide') : (isHi ? 'दिखाएं' : 'Show')}
 </button>
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Editor */}
 {editing && (
 <div
 ref={editingTrapRef}
 role="dialog"
 aria-modal="true"
 aria-label={isHi ? 'FAQ संपादित करें' : 'Edit FAQ'}
 className="fixed inset-0 z-[90] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
>
 <div className="w-full max-w-lg rounded-2xl border border-ink-700 bg-ink-900 p-6 max-h-[90vh] overflow-y-auto">
 <h3 className="text-[15px] font-bold text-white">{isHi ? 'FAQ संपादित करें' : 'Edit FAQ'}</h3>
 <div className="mt-4 space-y-3">
 <label className="block">
 <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Title (EN)</span>
 <input value={editing.title_en} onChange={e => update('title_en', e.target.value)}
 className="mt-1 w-full bg-ink-950/60 border border-ink-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blood-500/60" />
 </label>
 <label className="block">
 <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Title (HI)</span>
 <input value={editing.title_hi} onChange={e => update('title_hi', e.target.value)}
 className="mt-1 w-full bg-ink-950/60 border border-ink-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blood-500/60" />
 </label>
 <label className="block">
 <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Body (EN)</span>
 <textarea value={editing.body_en} onChange={e => update('body_en', e.target.value)}
 className="mt-1 w-full bg-ink-950/60 border border-ink-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blood-500/60 min-h-[80px]" />
 </label>
 <label className="block">
 <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Body (HI)</span>
 <textarea value={editing.body_hi} onChange={e => update('body_hi', e.target.value)}
 className="mt-1 w-full bg-ink-950/60 border border-ink-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blood-500/60 min-h-[80px]" />
 </label>
 <label className="flex items-center gap-2 text-xs text-ink-300 cursor-pointer">
 <input type="checkbox" checked={!!editing.active} onChange={e => update('active', e.target.checked)} className="accent-blood-600 cursor-pointer" />
 {isHi ? 'प्रकाशित (active)' : 'Published (active)'}
 </label>
 </div>
 <div className="mt-5 flex justify-end gap-2">
 <button onClick={() => setEditing(null)} disabled={saving}
 className="px-4 py-2 rounded-lg border border-ink-700 text-ink-300 text-xs font-semibold hover:bg-white/5 transition cursor-pointer">
 {isHi ? 'रद्द करें' : 'Cancel'}
 </button>
 <button onClick={save} disabled={saving || !editing.title_en.trim() || !editing.body_en.trim()}
 className="px-4 py-2 rounded-lg bg-blood-600 hover:bg-blood-500 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer flex items-center gap-2">
 {saving && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
 {isHi ? 'सहेजें' : 'Save'}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
