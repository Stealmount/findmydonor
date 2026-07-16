import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Droplet, Heart, Search, User, ShieldCheck, ArrowUpRight, Menu, X, Globe, HeartHandshake } from 'lucide-react';
import { User as DonorUser, Requester } from "../../types";
import { useLanguage } from '../../lib/LanguageContext';

interface NavbarProps {
  onNavigate: (view: 'home' | 'request' | 'tracking' | 'donor-register' | 'donor-dashboard' | 'requester-portal' | 'admin') => void;
  loggedInUser?: DonorUser | null;
  loggedInRequester?: Requester | null;
}

export function Navbar({ onNavigate, loggedInUser, loggedInRequester }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
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
          className="flex items-center gap-2.5 group cursor-pointer"
        >
          <div className="relative grid h-9 w-9 place-items-center rounded-xl blood-drop-gradient shadow-[0_8px_20px_-4px_rgba(244,63,87,0.5)]">
            <Droplet className="h-4 w-4 text-white fill-white" strokeWidth={2.2} />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-white" />
          </div>
          <span className="text-[16px] font-bold tracking-tight text-ink-900 font-sans">
            RaktDaan
          </span>
        </button>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-1.5 xl:gap-2">
          <button
            onClick={() => onNavigate('request')}
            className="rounded-full px-3.5 py-1.5 text-xs xl:text-[13.5px] font-bold text-blood-600 transition-colors hover:text-blood-700 hover:bg-blood-50 cursor-pointer whitespace-nowrap flex items-center gap-1.5"
          >
            <Heart className="w-3.5 h-3.5 text-blood-600 fill-blood-100" />
            {t.nav.requestSos}
          </button>
          <button
            onClick={() => onNavigate('tracking')}
            className="rounded-full px-3 py-1.5 text-xs xl:text-[13.5px] font-medium text-ink-600 transition-colors hover:text-ink-900 hover:bg-ink-100/60 cursor-pointer whitespace-nowrap flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5 text-ink-400" />
            {t.nav.trackMatch}
          </button>
          
          <button
            onClick={() => onNavigate('hospital-register' as any)}
            className="rounded-full px-3 py-1.5 text-xs xl:text-[13.5px] font-semibold text-ink-600 transition-colors hover:text-ink-900 hover:bg-ink-100/60 cursor-pointer whitespace-nowrap"
          >
            For hospitals
          </button>

          {!loggedInUser && !loggedInRequester ? (
            <>
              <button
                onClick={() => onNavigate('auth-signin' as any)}
                className="rounded-full px-3.5 py-1.5 text-xs xl:text-[13.5px] font-semibold text-ink-700 transition-colors hover:text-ink-900 hover:bg-ink-100/60 cursor-pointer whitespace-nowrap"
              >
                {t.nav.signIn}
              </button>
              <button
                onClick={() => onNavigate('auth-signup' as any)}
                className="rounded-full px-3.5 py-1.5 text-xs xl:text-[13.5px] font-bold text-ink-900 bg-ink-100/70 hover:bg-ink-200/80 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-blood-600" />
                {t.nav.signUp}
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

        {/* Right CTA / Language Pill / User State */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language Switcher Pill [ EN | HI ] */}
          <div className="flex items-center rounded-full bg-ink-100/80 p-0.5 border border-ink-200/60 shadow-inner">
            <button
              onClick={() => setLanguage('EN')}
              className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold transition-all cursor-pointer ${
                language === 'EN'
                  ? 'bg-blood-600 text-white shadow-sm'
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
                  ? 'bg-blood-600 text-white shadow-sm'
                  : 'text-ink-600 hover:text-ink-900'
              }`}
              title="हिन्दी (Hindi)"
            >
              HI
            </button>
          </div>

          <button
            onClick={() => onNavigate('request')}
            className="btn-glow hidden md:inline-flex group items-center gap-1.5 rounded-full bg-ink-900 px-4 py-2 text-[13.5px] font-medium text-white shadow-[0_8px_20px_-4px_rgba(13,10,10,0.3)] hover:bg-black cursor-pointer transition-all"
          >
            {t.nav.requestBloodBtn}
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>

          <button
            onClick={() => setOpen((s) => !s)}
            aria-label="Toggle menu"
            className="grid lg:hidden h-9 w-9 place-items-center rounded-full bg-ink-900 text-white cursor-pointer"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="absolute top-16 left-3 right-3 rounded-2xl glass shadow-premium-lg p-3 lg:hidden bg-white/95 backdrop-blur-2xl border border-ink-200"
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
                        ? 'bg-blood-600 text-white shadow-sm'
                        : 'text-ink-700 hover:text-ink-900'
                    }`}
                  >
                    EN
                  </button>
                  <button
                    onClick={() => setLanguage('HI')}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                      language === 'HI'
                        ? 'bg-blood-600 text-white shadow-sm'
                        : 'text-ink-700 hover:text-ink-900'
                    }`}
                  >
                    HI (हिन्दी)
                  </button>
                </div>
              </div>

              <button
                onClick={() => { setOpen(false); onNavigate('request'); }}
                className="w-full text-left rounded-xl px-3.5 py-3 min-h-[44px] text-sm font-bold text-blood-600 hover:bg-blood-50 active:scale-[0.99] transition flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-blood-600 fill-blood-100" />
                  {t.nav.requestSos}
                </span>
                <span className="text-[10px] font-bold uppercase bg-blood-100 text-blood-700 px-2 py-0.5 rounded-full">Urgent</span>
              </button>
              <button
                onClick={() => { setOpen(false); onNavigate('tracking'); }}
                className="w-full text-left rounded-xl px-3.5 py-3 min-h-[44px] text-sm font-semibold text-ink-800 hover:bg-ink-100/80 active:scale-[0.99] transition flex items-center justify-between"
              >
                <span>{t.nav.trackMatch}</span>
                <Search className="w-4 h-4 text-ink-400" />
              </button>

              <button
                onClick={() => { setOpen(false); onNavigate('hospital-register' as any); }}
                className="w-full text-left rounded-xl px-3.5 py-3 min-h-[44px] text-sm font-semibold text-ink-800 hover:bg-ink-100/80 active:scale-[0.99] transition flex items-center justify-between"
              >
                <span>For hospitals</span>
                <HeartHandshake className="w-4 h-4 text-ink-400" />
              </button>

              {!loggedInUser && !loggedInRequester ? (
                <>
                  <button
                    onClick={() => { setOpen(false); onNavigate('auth-signin' as any); }}
                    className="w-full text-left rounded-xl px-3.5 py-3 min-h-[44px] text-sm font-semibold text-ink-800 hover:bg-ink-100/80 active:scale-[0.99] transition flex items-center justify-between"
                  >
                    <span>{t.nav.signIn}</span>
                    <User className="w-4 h-4 text-ink-400" />
                  </button>
                  <button
                    onClick={() => { setOpen(false); onNavigate('auth-signup' as any); }}
                    className="w-full text-left rounded-xl px-3.5 py-3 min-h-[44px] text-sm font-bold text-blood-600 hover:bg-blood-50 active:scale-[0.99] transition flex items-center justify-between"
                  >
                    <span>{t.nav.signUp}</span>
                    <ShieldCheck className="w-4 h-4 text-blood-600" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setOpen(false); onNavigate(loggedInUser ? 'donor-dashboard' : 'requester-portal'); }}
                  className="w-full text-left rounded-xl px-3.5 py-3 min-h-[44px] text-sm font-bold text-blood-700 bg-blood-50 hover:bg-blood-100 active:scale-[0.99] transition flex items-center justify-between"
                >
                  <span>{t.nav.myDashboard} ({loggedInUser ? 'Donor' : 'Requester'})</span>
                  <User className="w-4 h-4 text-blood-600" />
                </button>
              )}

              <div className="my-1.5 h-px bg-ink-200/60" />

              <button
                onClick={() => { setOpen(false); onNavigate('request'); }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blood-600 to-blood-700 py-3 min-h-[48px] text-sm font-bold text-white shadow-md active:scale-95 transition"
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
