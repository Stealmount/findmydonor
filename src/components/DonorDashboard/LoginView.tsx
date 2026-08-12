import React from 'react';
import { useLanguage } from '../../lib/LanguageContext';
import { ArrowRight, Lock } from 'lucide-react';

interface LoginViewProps {
  onNavigate?: (view: string) => void;
}

/** Not-signed-in placeholder card for the donor dashboard route. */
export default function LoginView({ onNavigate }: LoginViewProps) {
  const { language } = useLanguage();
  const isHi = language === 'HI';

  return (
    <div id="donor-login-container" className="max-w-md mx-auto rounded-3xl bg-white/95 backdrop-blur-2xl border border-ink-200/80 shadow-premium-lg overflow-hidden my-8">
      <div className="bg-gradient-to-br from-ink-900 via-ink-950 to-ink-900 p-8 text-white text-center relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-blood-600/20 blur-2xl" aria-hidden />
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl blood-drop-gradient shadow-[0_8px_20px_-4px_rgba(244,63,87,0.5)]">
          <Lock className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white font-sans">
          {isHi ? 'डोनर डैशबोर्ड' : 'Donor Dashboard'}
        </h2>
        <p className="text-ink-300 text-xs mt-1">
          {isHi ? 'अपनी उपलब्धता प्रबंधित करें, रक्त अनुरोध देखें या रक्तदान दर्ज करें।' : 'Manage availability, view match requests, or log external donations.'}
        </p>
      </div>

      <div className="p-8 space-y-4">
        <p className="text-center text-sm text-ink-600">
          {isHi
            ? 'डैशबोर्ड एक्सेस करने के लिए कृपया साइन इन करें।'
            : 'Please sign in to access your donor dashboard.'}
        </p>
        <button
          id="btn-goto-signin"
          type="button"
          onClick={() => onNavigate?.('auth-signin')}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-blood-600 to-blood-700 hover:from-blood-500 hover:to-blood-600 text-white font-semibold text-sm shadow-lg shadow-blood-600/25 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          {isHi ? 'साइन इन / रजिस्टर करें' : 'Sign In / Register'}
        </button>
      </div>
    </div>
  );
}
