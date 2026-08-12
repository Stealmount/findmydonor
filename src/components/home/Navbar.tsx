import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Droplet, Heart, Search, User, ShieldCheck, ArrowUpRight, Menu, X, Globe, HeartHandshake, Building2, ChevronDown, HelpCircle } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { useAuth } from '../../lib/AuthContext';

interface NavbarProps {
  onNavigate: (view: 'home' | 'request' | 'tracking' | 'donor-register' | 'donor-dashboard' | 'requester-portal' | 'hospital-register' | 'admin') => void;
}

export function Navbar({ onNavigate }: NavbarProps) {
  const { loggedInUser, loggedInRequester } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-50 flex justify-center px-3 pt-3 sm:px-6 sm:pt-4"
    >
      <nav
        className={`flex w-full max-w-6xl items-center justify-between rounded-2xl px-4 py-2.5 sm:px-6 sm:py-3 transition-all duration-500 ${
          scrolled
            ? "glass shadow-premium border border-ink-200/50"
            : "bg-white/90 backdrop-blur-xl border border-ink-200/60 shadow-sm"
        }`}
      >
        <button
          onClick={() => {
            onNavigate('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center gap-2.5 group cursor-pointer shrink-0"
        >
          <div className="relative grid h-9 w-9 place-items-center rounded-xl blood-drop-gradient shadow-[0_8px_20px_-4px_rgba(244,63,87,0.5)]">
            <Droplet className="h-4 w-4 text-white fill-white" strokeWidth={2.2} />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-white" />
          </div>
          <span className="text-[17px] font-extrabold tracking-tight text-ink-900 font-sans flex items-center">
            FindMy<span className="text-blood-600">Donor</span><span className="text-[10px] font-bold text-ink-400 ml-0.5 -translate-y-1">™</span>
          </span>
        </button>

        {/* Desktop Navigation (Primary & Secondary "More" Dropdown) */}
        <div className="hidden lg:flex items-center gap-1 xl:gap-1.5">
          {/* Primary Nav Items */}
          <button
            onClick={() => { onNavigate('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="rounded-full px-3 py-1.5 text-xs xl:text-[13.5px] font-medium text-ink-600 transition-colors hover:text-ink-900 hover:bg-ink-100/60 cursor-pointer whitespace-nowrap"
          >
            {language === 'HI' ? 'होम' : 'Home'}
          </button>

          <button
            onClick={() => onNavigate('donor-register')}
            className="rounded-full px-3 py-1.5 text-xs xl:text-[13.5px] font-medium text-ink-600 transition-colors hover:text-ink-900 hover:bg-ink-100/60 cursor-pointer whitespace-nowrap flex items-center gap-1.5"
          >
            <HeartHandshake className="w-3.5 h-3.5 text-blood-600" />
            <span>{language === 'HI' ? 'रक्तदाता' : 'Donor'}</span>
          </button>

          <button
            onClick={() => onNavigate('request')}
            className="rounded-full px-3 py-1.5 text-xs xl:text-[13.5px] font-bold text-blood-600 transition-colors hover:text-blood-700 hover:bg-blood-50 cursor-pointer whitespace-nowrap flex items-center gap-1.5"
          >
            <Heart className="w-3.5 h-3.5 text-blood-600 fill-blood-100" />
            <span>{t.nav.requestSos}</span>
          </button>

          <button
            onClick={() => onNavigate('tracking')}
            className="rounded-full px-3 py-1.5 text-xs xl:text-[13.5px] font-medium text-ink-600 transition-colors hover:text-ink-900 hover:bg-ink-100/60 cursor-pointer whitespace-nowrap flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5 text-ink-400" />
            <span>{t.nav.trackMatch}</span>
          </button>

          {/* Secondary Items — "More" Dropdown Menu */}
          <div className="relative" onMouseLeave={() => setMoreOpen(false)}>
            <button
              onClick={() => setMoreOpen(prev => !prev)}
              className="rounded-full px-3 py-1.5 text-xs xl:text-[13.5px] font-medium text-ink-600 hover:text-ink-900 hover:bg-ink-100/60 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
            >
              <span>{language === 'HI' ? 'अधिक' : 'More'}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-ink-400 transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {moreOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 w-56 rounded-2xl bg-white/95 backdrop-blur-2xl border border-ink-200/80 shadow-premium p-2 z-50"
                >
                  <button
                    onClick={() => { setMoreOpen(false); onNavigate('blood-banks' as any); }}
                    className="w-full text-left rounded-xl px-3 py-2 text-xs xl:text-[13px] font-medium text-ink-700 hover:text-ink-900 hover:bg-ink-100/70 transition flex items-center gap-2.5 cursor-pointer"
                  >
                    <Building2 className="w-4 h-4 text-ink-500 shrink-0" />
                    <span>{language === 'HI' ? 'ब्लड बैंक स्टॉक' : 'Blood Banks & Stock'}</span>
                  </button>
                  <button
                    onClick={() => { setMoreOpen(false); onNavigate('faq' as any); }}
                    className="w-full text-left rounded-xl px-3 py-2 text-xs xl:text-[13px] font-medium text-ink-700 hover:text-ink-900 hover:bg-ink-100/70 transition flex items-center gap-2.5 cursor-pointer"
                  >
                    <HelpCircle className="w-4 h-4 text-ink-500 shrink-0" />
                    <span>{language === 'HI' ? 'सवाल-जवाब (FAQ)' : 'FAQ & Help Center'}</span>
                  </button>
                  <div className="my-1 border-t border-ink-100" />
                  <button
                    onClick={() => { setMoreOpen(false); onNavigate('hospital-register'); }}
                    className="w-full text-left rounded-xl px-3 py-2 text-xs xl:text-[13px] font-semibold text-blood-700 bg-blood-50/60 hover:bg-blood-100/80 transition flex items-center gap-2.5 cursor-pointer border border-blood-200/50"
                  >
                    <Building2 className="w-4 h-4 text-blood-600 shrink-0" />
                    <span>{language === 'HI' ? 'अस्पतालों के लिए' : 'For Hospitals'}</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right CTA / Language Pill / User State */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Sign In & Sign Up buttons (Desktop) */}
          <div className="hidden lg:flex items-center gap-2">
            {!loggedInUser && !loggedInRequester ? (
              <>
                <button
                  onClick={() => onNavigate('auth-signin' as any)}
                  className="rounded-full px-3 py-1.5 text-xs xl:text-[13.5px] font-semibold text-ink-700 transition-colors hover:text-ink-900 hover:bg-ink-100/60 cursor-pointer whitespace-nowrap"
                >
                  {t.nav.signIn}
                </button>
                <button
                  onClick={() => onNavigate('auth-signup' as any)}
                  className="rounded-full px-4 py-1.5 text-xs xl:text-[13.5px] font-bold text-white bg-blood-600 hover:bg-blood-700 shadow-sm transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-white/90" />
                  <span>{t.nav.signUp}</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => onNavigate(loggedInUser ? 'donor-dashboard' : 'requester-portal')}
                className="rounded-full px-4 py-1.5 text-xs xl:text-[13.5px] font-bold bg-blood-50 text-blood-700 border border-blood-200 hover:bg-blood-100 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <User className="w-3.5 h-3.5 text-blood-600" />
                <span>{t.nav.myDashboard} ({loggedInUser ? 'Donor' : 'Requester'})</span>
              </button>
            )}
          </div>

          {/* Language Switcher Pill [ EN | HI ] — De-cluttered visually (ink-900 active state) */}
          <div className="flex items-center rounded-full bg-ink-100/80 p-0.5 border border-ink-200/60 shadow-inner">
            <button
              onClick={() => setLanguage('EN')}
              className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold transition-all cursor-pointer ${
                language === 'EN'
                  ? 'bg-ink-900 text-white shadow-sm'
                  : 'text-ink-600 hover:text-ink-900'
              }`}
              title="English"
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('HI')}
              className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold transition-all cursor-pointer ${
                language === 'HI'
                  ? 'bg-ink-900 text-white shadow-sm'
                  : 'text-ink-600 hover:text-ink-900'
              }`}
              title="हिन्दी (Hindi)"
            >
              HI
            </button>
          </div>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setOpen((s) => !s)}
            aria-label="Toggle menu"
            className="grid lg:hidden h-9 w-9 place-items-center rounded-full bg-ink-900 text-white cursor-pointer"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer (Organized into Primary, Secondary & Account) */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="absolute top-16 left-3 right-3 rounded-2xl glass shadow-premium-lg p-3 lg:hidden bg-white/95 backdrop-blur-2xl border border-ink-200 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex flex-col space-y-1">
              {/* Language Switcher in Mobile Drawer */}
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-ink-50 border border-ink-200/50 mb-1">
                <span className="text-xs font-semibold text-ink-600 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-ink-500" />
                  Language / भाषा
                </span>
                <div className="flex items-center rounded-full bg-ink-200/60 p-0.5">
                  <button
                    onClick={() => setLanguage('EN')}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                      language === 'EN'
                        ? 'bg-ink-900 text-white shadow-sm'
                        : 'text-ink-700 hover:text-ink-900'
                    }`}
                  >
                    EN
                  </button>
                  <button
                    onClick={() => setLanguage('HI')}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                      language === 'HI'
                        ? 'bg-ink-900 text-white shadow-sm'
                        : 'text-ink-700 hover:text-ink-900'
                    }`}
                  >
                    HI (हिन्दी)
                  </button>
                </div>
              </div>

              {/* Primary Actions Group */}
              <div className="px-3.5 pt-1 pb-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ink-400">
                {language === 'HI' ? 'मुख्य कार्य' : 'Core Actions'}
              </div>

              <button
                onClick={() => { setOpen(false); onNavigate('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="w-full text-left rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink-800 hover:bg-ink-100/80 active:scale-[0.99] transition flex items-center justify-between"
              >
                <span>{language === 'HI' ? 'होम' : 'Home'}</span>
              </button>
              <button
                onClick={() => { setOpen(false); onNavigate('donor-register'); }}
                className="w-full text-left rounded-xl px-3.5 py-2.5 text-sm font-bold text-blood-600 hover:bg-blood-50 active:scale-[0.99] transition flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-blood-600" />
                  {language === 'HI' ? 'रक्तदाता बनें' : 'Become a Donor'}
                </span>
              </button>
              <button
                onClick={() => { setOpen(false); onNavigate('request'); }}
                className="w-full text-left rounded-xl px-3.5 py-2.5 text-sm font-bold text-blood-600 hover:bg-blood-50 active:scale-[0.99] transition flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-blood-600 fill-blood-100" />
                  {t.nav.requestSos}
                </span>
              </button>
              <button
                onClick={() => { setOpen(false); onNavigate('tracking'); }}
                className="w-full text-left rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink-800 hover:bg-ink-100/80 active:scale-[0.99] transition flex items-center justify-between"
              >
                <span>{t.nav.trackMatch}</span>
                <Search className="w-4 h-4 text-ink-400" />
              </button>

              {/* Secondary Resources & Partner Group */}
              <div className="px-3.5 pt-3 pb-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ink-400">
                {language === 'HI' ? 'संसाधन और पार्टनर' : 'Resources & Partners'}
              </div>

              <button
                onClick={() => { setOpen(false); onNavigate('blood-banks' as any); }}
                className="w-full text-left rounded-xl px-3.5 py-2.5 text-sm font-medium text-ink-800 hover:bg-ink-100/80 active:scale-[0.99] transition flex items-center justify-between"
              >
                <span>{language === 'HI' ? 'ब्लड बैंक डायरेक्टरी & लाइव स्टॉक' : 'Blood Banks & Live Stock'}</span>
                <Building2 className="w-4 h-4 text-ink-500" />
              </button>

              <button
                onClick={() => { setOpen(false); onNavigate('faq' as any); }}
                className="w-full text-left rounded-xl px-3.5 py-2.5 text-sm font-medium text-ink-800 hover:bg-ink-100/80 active:scale-[0.99] transition flex items-center justify-between"
              >
                <span>{language === 'HI' ? 'अक्सर पूछे जाने वाले प्रश्न (FAQ)' : 'FAQ & Help Center'}</span>
                <HelpCircle className="w-4 h-4 text-ink-500" />
              </button>

              <button
                onClick={() => { setOpen(false); onNavigate('hospital-register'); }}
                className="w-full text-left rounded-xl px-3.5 py-2.5 text-sm font-semibold text-blood-700 bg-blood-50/60 hover:bg-blood-100 active:scale-[0.99] transition flex items-center justify-between border border-blood-200/50"
              >
                <span>{language === 'HI' ? 'अस्पताल / ब्लड बैंक पार्टनर बनें' : 'For Hospitals / Become a Partner'}</span>
                <Building2 className="w-4 h-4 text-blood-600" />
              </button>

              <div className="my-1.5 h-px bg-ink-200/60" />

              {/* Account Actions */}
              {!loggedInUser && !loggedInRequester ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => { setOpen(false); onNavigate('auth-signin' as any); }}
                    className="w-full text-center rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink-800 bg-ink-100/70 hover:bg-ink-200/80 active:scale-[0.99] transition"
                  >
                    {t.nav.signIn}
                  </button>
                  <button
                    onClick={() => { setOpen(false); onNavigate('auth-signup' as any); }}
                    className="w-full text-center rounded-xl px-3.5 py-2.5 text-sm font-bold text-white bg-blood-600 hover:bg-blood-700 active:scale-[0.99] transition flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4 text-white" />
                    <span>{t.nav.signUp}</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setOpen(false); onNavigate(loggedInUser ? 'donor-dashboard' : 'requester-portal'); }}
                  className="w-full text-left rounded-xl px-3.5 py-2.5 text-sm font-bold text-blood-700 bg-blood-50 hover:bg-blood-100 active:scale-[0.99] transition flex items-center justify-between"
                >
                  <span>{t.nav.myDashboard} ({loggedInUser ? 'Donor' : 'Requester'})</span>
                  <User className="w-4 h-4 text-blood-600" />
                </button>
              )}

              <button
                onClick={() => { setOpen(false); onNavigate('request'); }}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blood-600 to-blood-700 py-3 text-sm font-bold text-white shadow-md active:scale-95 transition"
              >
                {t.nav.requestBloodBtn}
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
