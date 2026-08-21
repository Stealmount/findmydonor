import { AlertTriangle, Inbox, LucideIcon, RotateCcw } from 'lucide-react';

interface StateMessageProps {
 variant: 'error' | 'empty';
 icon?: LucideIcon;
 title: string;
 hint?: string;
 onRetry?: () => void;
 isHi?: boolean;
}

/**
 * StateMessage — shared error / empty-state card.
 * Renders a "Try again" button only when onRetry is provided.
 */
export function StateMessage({ variant, icon: Icon, title, hint, onRetry, isHi = false }: StateMessageProps) {
 const ResolvedIcon = Icon ?? (variant === 'error' ? AlertTriangle : Inbox);
 return (
 <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-ink-200/80 bg-white/70 p-8 text-center">
 <div className="grid h-12 w-12 place-items-center rounded-full bg-blood-500/10">
 <ResolvedIcon className={`h-6 w-6 ${variant === 'error' ? 'text-blood-500' : 'text-ink-400'}`} />
 </div>
 <div>
 <p className="text-sm font-semibold text-ink-900">{title}</p>
 {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
 </div>
 {onRetry && (
 <button
 type="button"
 onClick={onRetry}
 className="inline-flex items-center gap-2 rounded-full bg-blood-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blood-600"
 >
 <RotateCcw className="h-4 w-4" />
 {isHi ? 'फिर कोशिश करें' : 'Try again'}
 </button>
 )}
 </div>
 );
}
