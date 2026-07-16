import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Droplet,
  Search,
  Shield,
  ArrowRight,
  Activity,
  Check,
  Sparkles,
  Heart,
} from "lucide-react";
import { useLanguage } from "../../lib/LanguageContext";

interface HeroProps {
  onNavigate: (view: 'home' | 'request' | 'tracking' | 'donor-register' | 'donor-dashboard' | 'requester-portal' | 'admin') => void;
}

export function Hero({ onNavigate }: HeroProps) {
  const [unitsRequested, setUnitsRequested] = useState(3);
  const [donorsFound, setDonorsFound] = useState(0);
  const { t } = useLanguage();

  useEffect(() => {
    const timer = setTimeout(() => setDonorsFound(unitsRequested), 1200);
    return () => clearTimeout(timer);
  }, [unitsRequested]);

  return (
    <section
      id="top"
      className="relative overflow-hidden pt-28 sm:pt-36 pb-20 sm:pb-28"
    >
      {/* Ambient background layers */}
      <div className="absolute inset-0 ambient-bg" aria-hidden />
      <div className="absolute inset-0 grid-pattern opacity-50" aria-hidden />
      <div
        className="glow-blob h-[500px] w-[500px] bg-blood-400/20 -top-40 left-1/2 -translate-x-1/2"
        aria-hidden
      />
      <div
        className="glow-blob h-[360px] w-[360px] bg-blood-300/15 top-40 -right-20"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full bg-white/80 ring-1 ring-ink-200/60 px-3.5 py-1.5 shadow-sm backdrop-blur"
        >
          <span className="grid h-5 w-5 place-items-center rounded-full bg-blood-100 text-blood-700">
            <Activity className="h-3 w-3" />
          </span>
          <span className="text-[12.5px] font-medium tracking-tight text-ink-700">
            {t.hero.badge}
          </span>
        </motion.div>

        <div className="mt-7 grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
          {/* Copy */}
          <div className="lg:col-span-7">
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-[clamp(2.3rem,6vw,4.5rem)] font-medium leading-[1.05] tracking-[-0.03em] text-ink-900"
            >
              {t.hero.titleLine1}{" "}
              <span className="relative inline-block">
                <span className="relative z-10 gradient-text">{t.hero.titleHighlight}</span>
                <span className="absolute bottom-1 left-0 right-0 h-3 bg-blood-200/60 -z-0 rounded-full" />
              </span>{" "}
              {t.hero.titleLine2}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-600"
            >
              {t.hero.subtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-8 flex flex-col sm:flex-row gap-3"
            >
              <button
                onClick={() => onNavigate('request')}
                className="btn-glow group inline-flex items-center justify-center gap-2 rounded-full bg-blood-600 px-6 py-3.5 text-[14.5px] font-semibold text-white shadow-[0_14px_32px_-8px_rgba(244,63,87,0.5)] hover:bg-blood-700 cursor-pointer"
              >
                <Search className="h-4 w-4" />
                {t.hero.requestBloodNow}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => onNavigate('auth-signup' as any)}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-[14.5px] font-semibold text-ink-900 shadow-premium hover:shadow-premium-lg subtle-border cursor-pointer"
              >
                <Heart className="h-4 w-4 text-blood-600 fill-blood-600" />
                {t.hero.joinNetwork}
              </button>
              <button
                onClick={() => onNavigate('tracking')}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-ink-100/80 px-5 py-3.5 text-[13.5px] font-semibold text-ink-700 hover:bg-ink-200 transition cursor-pointer"
              >
                {t.hero.trackLiveRequest}
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.45 }}
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] text-ink-600"
            >
              {[
                t.hero.safetyVerification,
                t.hero.safetyCooldown,
                t.hero.privacyConsent,
              ].map((text) => (
                <div key={text} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />
                  <span>{text}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Interactive card */}
          <div className="lg:col-span-5">
            <HeroCard
              unitsRequested={unitsRequested}
              donorsFound={donorsFound}
              onNavigate={onNavigate}
              onAddUnit={() => {
                setUnitsRequested((u) => Math.min(u + 1, 10));
                setDonorsFound(0);
                setTimeout(() => setDonorsFound(unitsRequested + 1), 1100);
              }}
            />
          </div>
        </div>

        {/* Logos strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-20 sm:mt-28"
        >
          <p className="text-center text-[12px] font-medium uppercase tracking-[0.18em] text-ink-400">
            {useLanguage().language === 'HI'
              ? 'समुदाय नेटवर्क, अस्पतालों और 380,000+ सत्यापित रक्तदाताओं द्वारा विश्वसनीय'
              : 'Trusted by community networks, hospitals, and 380,000+ verified donors'}
          </p>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 items-center gap-x-8 gap-y-6">
            {["Apollo", "Medanta", "RedCross+", "Lifeline", "AIIMS", "Fortis"].map(
              (n) => (
                <div
                  key={n}
                  className="flex items-center justify-center text-ink-400/80 hover:text-ink-700 transition"
                >
                  <span className="text-[15px] font-semibold tracking-tight">
                    {n}
                  </span>
                </div>
              )
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function HeroCard({
  unitsRequested,
  donorsFound,
  onNavigate,
  onAddUnit,
}: {
  unitsRequested: number;
  donorsFound: number;
  onNavigate: (view: 'home' | 'request' | 'tracking' | 'donor-register' | 'donor-dashboard' | 'requester-portal' | 'admin') => void;
  onAddUnit: () => void;
}) {
  const [quickBlood, setQuickBlood] = useState('O+');
  const { language } = useLanguage();
  const isHi = language === 'HI';

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: 1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
    >
      {/* Glow ring */}
      <div
        className="absolute -inset-6 bg-gradient-to-br from-blood-300/30 via-blood-400/10 to-transparent rounded-[36px] blur-2xl"
        aria-hidden
      />

      <div className="relative rounded-3xl bg-white shadow-premium-lg subtle-border p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative grid h-9 w-9 place-items-center rounded-xl blood-drop-gradient">
              <Droplet className="h-4 w-4 text-white fill-white" />
            </div>
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wider text-blood-600">
                {isHi ? 'तत्काल आपातकालीन SOS अनुरोध' : 'Quick Emergency SOS Requisition'}
              </p>
              <p className="text-[13px] font-semibold text-ink-900">
                {isHi ? 'सत्यापित अस्पताल रक्तदाताओं से तुरंत जुड़ें' : 'Instantly connect with verified hospital donors'}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200/60 flex items-center">
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {isHi ? 'लाइव 24/7' : 'Live 24/7'}
          </span>
        </div>

        {/* Quick Requisition Selector Box */}
        <div className="mt-4 p-4 rounded-2xl bg-blood-50/70 border border-blood-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blood-900">
              {isHi ? 'आवश्यक रक्त समूह चुनें:' : 'Select Needed Blood Group:'}
            </span>
            <div className="flex flex-col text-right">
              <span className="text-[10px] sm:text-xs font-semibold text-blood-700 font-sans tracking-wide">
                {isHi ? 'रक्तदान सत्यापित' : 'RaktDaan Verified'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setQuickBlood(type)}
                className={`h-9 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                  quickBlood === type
                    ? 'blood-drop-gradient text-white shadow-md scale-105'
                    : 'bg-white text-ink-800 border border-ink-200 hover:border-blood-400'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              onNavigate('request');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-full mt-2 btn-glow group flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blood-600 to-blood-700 py-3.5 text-sm font-bold text-white shadow-md hover:from-blood-700 hover:to-blood-800 transition-all cursor-pointer"
          >
            <Heart className="w-4 h-4 text-white fill-white animate-bounce" />
            {isHi ? `${quickBlood} के लिए तुरंत SOS अनुरोध भेजें` : `Launch SOS Request for ${quickBlood} Now`}
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        {/* Request details simulation */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: isHi ? 'रक्त समूह' : 'Blood group', value: quickBlood, color: 'blood' },
            { label: isHi ? 'तैयार रक्तदाता' : 'Donors Ready', value: isHi ? '14 पास में' : '14 Near', color: 'ink' },
            { label: isHi ? 'औसत प्रतिक्रिया' : 'Avg Response', value: isHi ? '< 4 मिनट' : '< 4 mins', color: 'blood' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-ink-100 bg-ink-50/50 p-3"
            >
              <p className="text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
                {s.label}
              </p>
              <p
                className={`mt-1 text-[16px] font-semibold ${
                  s.color === "blood" ? "text-blood-600" : "text-ink-900"
                }`}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Authentic Clinical Photography Banner (100% Real Unsplash Photo) */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-ink-200/80 relative group">
          <img
            src="https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80"
            alt="Sterile Clinical Blood Laboratory and Testing"
            className="h-36 w-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent flex items-end p-3.5">
            <div className="text-white">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blood-600/95 px-2 py-0.5 rounded-full">
                {isHi ? 'वास्तविक चिकित्सा मानक' : 'Real Clinical Standards'}
              </span>
              <p className="text-[12.5px] font-semibold mt-1.5">
                {isHi
                  ? 'स्टरिलाइज्ड प्रयोगशाला रक्त प्रसंस्करण और सत्यापन'
                  : 'Sterile Laboratory Blood Processing & Verification'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating stat */}
      <motion.div
        initial={{ opacity: 0, y: 10, x: 10 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        className="absolute -top-4 -right-3 sm:-right-6 hidden sm:flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 shadow-premium subtle-border"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-50">
          <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />
        </span>
        <div>
          <p className="text-[10.5px] font-medium text-ink-500">{isHi ? 'तुरंत अलर्ट' : 'Instant Alerting'}</p>
          <p className="text-[12.5px] font-semibold text-ink-900">
            {isHi ? 'रीयल-टाइम SMS व WhatsApp' : 'Real-time SMS & WhatsApp'}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
