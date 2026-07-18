"use client";

import { motion } from "framer-motion";
import { Check, Heart, Shield, Sparkles, Zap } from "lucide-react";

const benefits = [
  {
    icon: Zap,
    title: "Faster than a phone tree",
    text: "Replace 30 panicked calls with one push. Reach every eligible donor within a 3 km radius in under a minute.",
  },
  {
    icon: Heart,
    title: "Built for the donor",
    text: "No spam, no guilt, no surprises. Quiet hours, frequency caps, and 90-day cooldowns are first-class — not afterthoughts.",
  },
  {
    icon: Shield,
    title: "Privacy by default",
    text: "End-to-end encrypted, HIPAA-grade controls, and zero resale of health data. Donors decide what's shared, when.",
  },
  {
    icon: Sparkles,
    title: "Smart, not just fast",
    text: "We learn from every successful match — pre-warming donors before scheduled surgeries and predicting shortfalls.",
  },
];

export function Benefits() {
  return (
    <section
      id="donors"
      className="relative py-20 sm:py-28 bg-gradient-to-b from-white to-ink-50/40"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-5"
          >
            <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-blood-600">
              Why FindMyDonor™
            </p>
            <h2 className="mt-2 text-[clamp(1.85rem,4.5vw,3rem)] font-medium leading-[1.05] tracking-tight text-ink-900">
              The blood supply chain,{" "}
              <span className="font-serif italic">re-engineered</span> for the
              smartphone era.
            </h2>
            <p className="mt-5 text-[15.5px] leading-relaxed text-ink-600">
              We rebuilt the entire workflow — from request to recovery — around
              real-time signals instead of phone calls, paper forms, and
              WhatsApp forwards.
            </p>

            <div className="mt-8 rounded-3xl bg-ink-900 p-6 text-white shadow-premium-lg">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-blood-300">
                The FindMyDonor™ promise
              </p>
              <p className="mt-3 text-[20px] font-medium leading-snug tracking-tight">
                "When someone asks for blood, they shouldn't have to ask 30
                people. They should ask{" "}
                <span className="text-blood-300">one network</span>."
              </p>
              <p className="mt-4 text-[12.5px] text-white/60">
                — Aanya Verma, Founder & CEO
              </p>
            </div>
          </motion.div>

          <div className="lg:col-span-7">
            <div className="grid gap-4 sm:grid-cols-2">
              {benefits.map((b, i) => (
                <motion.div
                  key={b.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.55, delay: i * 0.08 }}
                  className="group relative overflow-hidden rounded-3xl bg-white subtle-border shadow-premium p-6 card-lift"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blood-50 text-blood-600 ring-1 ring-blood-100">
                      <b.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-[16.5px] font-semibold tracking-tight text-ink-900">
                      {b.title}
                    </h3>
                  </div>
                  <p className="mt-4 text-[13.5px] leading-relaxed text-ink-600">
                    {b.text}
                  </p>
                  <ul className="mt-4 space-y-1.5">
                    {[
                      "Sub-second matching",
                      "90-day eligibility",
                      "Privacy first",
                    ].map((t) => (
                      <li
                        key={t}
                        className="flex items-center gap-2 text-[12.5px] text-ink-500"
                      >
                        <Check
                          className="h-3.5 w-3.5 text-emerald-600"
                          strokeWidth={3}
                        />
                        {t}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
