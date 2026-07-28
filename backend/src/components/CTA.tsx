"use client";

import { motion } from "framer-motion";
import { ArrowRight, Droplet, Heart, Search, Sparkles, Star } from "lucide-react";

interface CTAProps {
  onNavigate?: (view: string) => void;
}

export function CTA({ onNavigate }: CTAProps) {
  return (
    <section id="cta" className="relative py-20 sm:py-28 overflow-hidden">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="relative overflow-hidden rounded-[32px] sm:rounded-[40px] bg-ink-900 text-white p-7 sm:p-12 lg:p-16 shadow-premium-lg"
        >
          {/* Background layers */}
          <div
            className="absolute inset-0 grid-pattern-dark opacity-30"
            aria-hidden
          />
          <div
            className="glow-blob h-[420px] w-[420px] bg-blood-600/30 -top-20 -left-20"
            aria-hidden
          />
          <div
            className="glow-blob h-[360px] w-[360px] bg-blood-500/20 -bottom-32 -right-20"
            aria-hidden
          />

          {/* Floating decorative drops */}
          <div
            className="absolute top-8 right-10 hidden md:block animate-float-slow opacity-30"
            aria-hidden
          >
            <Droplet
              className="h-10 w-10 text-blood-300 fill-blood-300"
              strokeWidth={1}
            />
          </div>
          <div
            className="absolute bottom-12 right-1/3 hidden md:block animate-float opacity-20"
            aria-hidden
          >
            <Droplet
              className="h-6 w-6 text-blood-200 fill-blood-200"
              strokeWidth={1}
            />
          </div>

          <div className="relative grid items-center gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1.5 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-blood-300" />
                <span className="text-[12px] font-medium text-white/85">
                  Be someone's hero today
                </span>
              </div>

              <h2 className="mt-6 text-[clamp(2rem,5.5vw,3.75rem)] font-medium leading-[1.02] tracking-[-0.02em]">
                A donor's{" "}
                <span className="font-serif italic text-blood-300">30 minutes</span>{" "}
                can give someone a lifetime.
              </h2>

              <p className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-white/70">
                Join 380,000+ verified donors who show up when it counts. The
                app takes 60 seconds to set up. The impact lasts forever.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => onNavigate?.('donor-register')}
                  className="btn-glow group inline-flex items-center justify-center gap-2 rounded-full blood-drop-gradient px-6 py-3.5 text-[14.5px] font-semibold text-white shadow-[0_14px_32px_-8px_rgba(244,63,87,0.5)] cursor-pointer"
                >
                  <Heart className="h-4 w-4 fill-white" />
                  Sign up to donate
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
                <button
                  onClick={() => onNavigate?.('request')}
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-white/10 ring-1 ring-white/15 px-6 py-3.5 text-[14.5px] font-semibold text-white hover:bg-white/15 cursor-pointer"
                >
                  <Search className="h-4 w-4" />
                  Request blood
                </button>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] text-white/70">
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                    />
                  ))}
                  <span className="ml-1.5 text-white">
                    4.9 · 12,400+ reviews
                  </span>
                </div>
                <span>·</span>
                <span>HIPAA-ready privacy</span>
                <span>·</span>
                <span>Available on iOS & Android</span>
              </div>
            </div>

            {/* Right side: pulse illustration */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative grid h-64 w-64 sm:h-80 sm:w-80 place-items-center">
                <div className="absolute inset-0 rounded-full bg-blood-500/10 pulse-ring" />
                <div className="absolute inset-6 rounded-full bg-blood-500/15 pulse-ring" />
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7 }}
                  className="relative grid h-44 w-44 sm:h-56 sm:w-56 place-items-center rounded-full blood-drop-gradient shadow-[0_30px_60px_-20px_rgba(244,63,87,0.6)]"
                >
                  <Heart
                    className="h-16 w-16 text-white fill-white animate-heartbeat"
                    strokeWidth={1.5}
                  />
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-ink-900 shadow-premium">
                    +1 life saved
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
