"use client";

import { motion } from "framer-motion";
import {
  Droplet,
  Heart,
  Search,
  Shield,
  ArrowRight,
  Activity,
  Check,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

interface HeroProps {
  onNavigate?: (view: string) => void;
}

export function Hero({ onNavigate }: HeroProps) {
  const [unitsRequested, setUnitsRequested] = useState(3);
  const [donorsFound, setDonorsFound] = useState(0);

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
        className="glow-blob h-[480px] w-[480px] bg-blood-400/30 -top-20 -left-32"
        aria-hidden
      />
      <div
        className="glow-blob h-[420px] w-[420px] bg-blood-300/20 top-40 -right-20"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        {/* Privacy Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto flex w-fit items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50/70 px-4 py-1.5 backdrop-blur"
        >
          <Shield className="h-4 w-4 text-emerald-600" />
          <span className="text-[12px] font-semibold tracking-tight text-emerald-800">
            Zero Data Retention Policy: We keep nothing. 100% Privacy.
          </span>
        </motion.div>

        <div className="mt-7 grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
          {/* Copy */}
          <div className="lg:col-span-7">
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-[clamp(2.5rem,6.5vw,4.75rem)] font-medium leading-[0.95] tracking-[-0.035em] text-ink-900"
            >
              The moment{" "}
              <span className="relative inline-block">
                <span className="relative z-10 gradient-text">life</span>
                <span className="absolute bottom-1 left-0 right-0 h-3 bg-blood-200/60 -z-0 rounded-full" />
              </span>{" "}
              needs blood, we find a donor{" "}
              <span className="font-serif italic font-normal">in minutes.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-600"
            >
              FindMyDonor™ is a real-time blood matching network. Post a request, and
              we instantly notify verified donors nearby who match the blood
              group — multiple donors for multiple units, with 90-day safety
              tracking built in.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-8 flex flex-col sm:flex-row gap-3"
            >
              <button
                onClick={() => onNavigate?.('request')}
                className="btn-glow group inline-flex items-center justify-center gap-2 rounded-full bg-blood-600 px-6 py-3.5 text-[14.5px] font-semibold text-white shadow-[0_14px_32px_-8px_rgba(244,63,87,0.5)] hover:bg-blood-700 cursor-pointer"
              >
                <Search className="h-4 w-4" />
                Request blood now
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => onNavigate?.('donor-register')}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-[14.5px] font-semibold text-ink-900 shadow-premium hover:shadow-premium-lg subtle-border cursor-pointer"
              >
                <Heart className="h-4 w-4 text-blood-600 fill-blood-600" />
                Become a donor
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.45 }}
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] text-ink-600"
            >
              {[
                "AABB-style safety checks",
                "90-day donor cooldown",
                "HIPAA-ready privacy",
              ].map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />
                  <span>{t}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Interactive card */}
          <div className="lg:col-span-5">
            <HeroCard
              unitsRequested={unitsRequested}
              donorsFound={donorsFound}
              onAddUnit={() => {
                setUnitsRequested((u) => Math.min(u + 1, 10));
                setDonorsFound(0);
                setTimeout(() => setDonorsFound(unitsRequested + 1), 1100);
              }}
            />
          </div>
        </div>

        {/* Trust strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-20 sm:mt-28"
        >
          <p className="text-center text-[12px] font-medium uppercase tracking-[0.18em] text-ink-400">
            Trusted by the community
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function HeroCard({
  unitsRequested,
  donorsFound,
  onAddUnit,
}: {
  unitsRequested: number;
  donorsFound: number;
  onAddUnit: () => void;
}) {
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
        <div className="h-32 w-full rounded-2xl overflow-hidden mb-4 relative">
          <img 
            src="https://images.unsplash.com/photo-1615461065929-4f0fc08cd3c9?w=500&q=80&auto=format&fit=crop" 
            alt="Medical Network" 
            className="w-full h-full object-cover" 
            loading="lazy" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent flex items-end p-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-rose-300 bg-black/30 px-2 py-0.5 rounded-full backdrop-blur-sm">FindMyDonor™ Proximity Grid</span>
          </div>
        </div>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative grid h-9 w-9 place-items-center rounded-xl blood-drop-gradient">
              <Droplet className="h-4 w-4 text-white fill-white" />
            </div>
            <div>
              <p className="text-[12px] font-medium text-ink-500">
                Live matching
              </p>
              <p className="text-[13px] font-semibold text-ink-900">
                New request · 1.2 km away
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200/60">
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" />
            Active
          </span>
        </div>

        {/* Request details */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { label: "Blood group", value: "O−", color: "blood" },
            { label: "Units", value: `${unitsRequested}`, color: "ink" },
            { label: "Urgency", value: "Critical", color: "blood" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-ink-100 bg-ink-50/50 p-3"
            >
              <p className="text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
                {s.label}
              </p>
              <p
                className={`mt-1 text-[18px] font-semibold ${
                  s.color === "blood" ? "text-blood-600" : "text-ink-900"
                }`}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Matching animation */}
        <div className="mt-5 rounded-2xl bg-gradient-to-br from-ink-50 to-white border border-ink-100 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium text-ink-600">Matching donors</p>
            <div className="flex items-center gap-1 text-[11px] text-ink-500">
              <Activity className="h-3 w-3" />
              <span>radius 3 km</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {Array.from({ length: Math.max(unitsRequested, 1) }).map((_, i) => {
              const matched = i < donorsFound;
              return (
                <motion.div
                  key={i}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{
                    scale: matched ? 1 : 0.9,
                    opacity: matched ? 1 : 0.35,
                  }}
                  transition={{ delay: i * 0.15, duration: 0.5 }}
                  className={`relative grid h-9 w-9 place-items-center rounded-full text-[11px] font-semibold ${
                    matched
                      ? "blood-drop-gradient text-white shadow-[0_8px_18px_-4px_rgba(244,63,87,0.45)]"
                      : "bg-ink-100 text-ink-400"
                  }`}
                >
                  {matched ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : (
                    <Droplet className="h-3.5 w-3.5" />
                  )}
                  {matched && (
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
                  )}
                </motion.div>
              );
            })}
            <button
              onClick={onAddUnit}
              className="ml-1 grid h-9 w-9 place-items-center rounded-full border border-dashed border-ink-300 text-ink-500 hover:border-blood-400 hover:text-blood-600 transition"
              aria-label="Add another unit"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(donorsFound / Math.max(unitsRequested, 1)) * 100}%` }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              className="h-full blood-drop-gradient"
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-[11.5px]">
            <span className="text-ink-500">
              <span className="font-semibold text-ink-900">
                {donorsFound}/{unitsRequested}
              </span>{" "}
              donors notified
            </span>
            <span className="text-ink-400">avg. response 3m 42s</span>
          </div>
        </div>

        {/* Trust row */}
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-ink-900 px-4 py-3 text-white">
          <div className="flex items-center gap-2.5">
            <Shield className="h-4 w-4 text-emerald-400" />
            <p className="text-[12px] text-white/80">
              Every donor is medically verified
            </p>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-white/60" />
        </div>
      </div>

    </motion.div>
  );
}
