import React from "react";
import { motion } from "framer-motion";
import {
  Radio,
  Users,
  Calendar,
  ShieldCheck,
  Building2,
  BellRing,
  MapPinned,
  FileCheck2,
  HeartPulse,
} from "lucide-react";
import { useLanguage } from "../../lib/LanguageContext";

const features = [
  {
    icon: Radio,
    title: "Real-time matching engine",
    desc: "Sub-second matching against verified donors. Considers blood group, proximity eligibility, location, and donation history.",
    span: "lg:col-span-2",
    accent: "from-blood-50 via-white to-white",
  },
  {
    icon: Users,
    title: "Multi-donor requests",
    desc: "Need 4 units? We page four eligible donors in parallel and assign the first to accept while others stay on warm standby.",
    span: "lg:col-span-1",
    accent: "from-amber-50 to-white",
  },
  {
    icon: ShieldCheck,
    title: "Safety cooldown tracking",
    desc: "Automatic eligibility windows (60 & 90 day safety rules) so donors can never be over-notified. Compliance-grade audit logs included.",
    span: "lg:col-span-1",
    accent: "from-emerald-50 to-white",
  },
  {
    icon: MapPinned,
    title: "Hospital-aware routing",
    desc: "Donors are navigated to the exact wing, bed, or blood bank counter — including verified parking and entry instructions.",
    span: "lg:col-span-1",
    accent: "from-violet-50 to-white",
  },
  {
    icon: HeartPulse,
    title: "Vitals & recovery",
    desc: "Optional post-donation check-ins track hemoglobin, hydration, and recovery — surfaced back to your donor profile.",
    span: "lg:col-span-2",
    accent: "from-sky-50 to-white",
  },
  {
    icon: BellRing,
    title: "Smart, silent alerts",
    desc: "Notifications respect quiet hours, frequency caps, and the donor's preferred radius. No spam — only when it matters.",
    span: "lg:col-span-1",
    accent: "from-rose-50 to-white",
  },
  {
    icon: Building2,
    title: "Hospital dashboard",
    desc: "Real-time inventory, predicted shortages, and a one-click request console for transfusion teams.",
    span: "lg:col-span-1",
    accent: "from-indigo-50 to-white",
  },
  {
    icon: Calendar,
    title: "Planned surgeries",
    desc: "Schedule a procedure 2 weeks out and we pre-warm donors for the date — no last-minute scrambles.",
    span: "lg:col-span-1",
    accent: "from-teal-50 to-white",
  },
  {
    icon: FileCheck2,
    title: "Verification, end-to-end",
    desc: "Every donor completes medical screening, ID check, and blood-type confirmation before they can be matched.",
    span: "lg:col-span-1",
    accent: "from-orange-50 to-white",
  },
];

export function Features() {
  const { t } = useLanguage();

  return (
    <section id="features" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid items-end gap-6 md:grid-cols-2"
        >
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-blood-600">
              {t.features.badge}
            </p>
            <h2 className="mt-2 text-[clamp(1.85rem,4.5vw,3rem)] font-medium leading-[1.05] tracking-tight text-ink-900">
              {t.features.title}
            </h2>
          </div>
          <p className="text-[15.5px] leading-relaxed text-ink-600">
            {t.features.subtitle}
          </p>
        </motion.div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, delay: (i % 3) * 0.08 }}
              className={`group relative overflow-hidden rounded-3xl bg-white subtle-border shadow-premium p-6 card-lift ${f.span}`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${f.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                aria-hidden
              />
              <div className="relative flex h-full flex-col">
                <div className="flex items-center justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-ink-900 text-white">
                    <f.icon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <span className="text-[11px] font-mono font-medium text-ink-300">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-6 text-[18px] font-semibold tracking-tight text-ink-900">
                  {t.features.items?.[i]?.title || f.title}
                </h3>
                <p
                  className={`mt-2 text-[13.5px] leading-relaxed text-ink-600 ${
                    f.span.includes("col-span-2") ? "max-w-md" : ""
                  }`}
                >
                  {t.features.items?.[i]?.desc || f.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
