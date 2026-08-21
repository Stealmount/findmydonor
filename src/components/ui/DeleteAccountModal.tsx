import React, { useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { authenticatedApi } from '../../lib/api';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface DeleteAccountModalProps {
 open: boolean;
 onClose: () => void;
 onDeleted: () => void; // runs after successful deletion (e.g. sign out + redirect)
}

/** Type-to-confirm modal for permanent account deletion. */
export default function DeleteAccountModal({ open, onClose, onDeleted }: DeleteAccountModalProps) {
 const { t, language } = useLanguage();
 const trapRef = useFocusTrap<HTMLDivElement>(open);
 const isHi = language === 'HI';
 const [confirm, setConfirm] = useState('');
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');

 if (!open) return null;

 const confirmed = confirm.trim().toUpperCase() === 'DELETE';

 const handleDelete = async () => {
 if (!confirmed || loading) return;
 setLoading(true);
 setError('');
 try {
 await authenticatedApi<{ ok: boolean }>('/api/account/delete');
 onDeleted();
 } catch (err: any) {
 setError(err?.message || t.account.deleteError);
 } finally {
 setLoading(false);
 }
 };

 return (
 <div ref={trapRef} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t.account.deleteTitle}>
 <div className="w-full max-w-md rounded-3xl bg-white border border-ink-200 p-6 sm:p-7 animate-in fade-in zoom-in-95">
 <div className="flex items-start justify-between gap-4">
 <div className="flex items-center gap-3">
 <div className="grid h-11 w-11 place-items-center rounded-2xl bg-red-500/10 text-red-600">
 <AlertTriangle className="w-6 h-6" />
 </div>
 <h3 className="text-lg font-extrabold text-ink-900 tracking-tight">{t.account.deleteTitle}</h3>
 </div>
 <button
 onClick={onClose}
 disabled={loading}
 className="p-2 rounded-xl text-ink-400 hover:bg-ink-100 transition-colors cursor-pointer disabled:opacity-50"
 aria-label={t.account.deleteCancel}
>
 <X className="w-5 h-5" />
 </button>
 </div>

 <p className="mt-4 text-sm text-ink-600 leading-relaxed">{t.account.deleteWarning}</p>

 <label className="block mt-5">
 <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">{t.account.deleteConfirmPlaceholder}</span>
 <input
 type="text"
 value={confirm}
 onChange={(e) => setConfirm(e.target.value)}
 disabled={loading}
 placeholder="DELETE"
 className="mt-1.5 w-full rounded-xl border border-ink-200 bg-ink-50/60 px-4 py-2.5 text-sm text-ink-900 placeholder-ink-300 outline-none focus:ring-2 focus:ring-blood-500/40 focus:border-blood-500 transition"
 />
 </label>

 {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

 <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
 <button
 onClick={onClose}
 disabled={loading}
 className="flex-1 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50 transition-colors cursor-pointer disabled:opacity-50"
>
 {t.account.deleteCancel}
 </button>
 <button
 onClick={handleDelete}
 disabled={!confirmed || loading}
 className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2.5 text-sm font-bold text-white transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
>
 {loading && <Loader2 className="w-4 h-4 animate-spin" />}
 {loading ? t.account.deleteLoading : t.account.deleteConfirmButton}
 </button>
 </div>
 </div>
 </div>
 );
}
