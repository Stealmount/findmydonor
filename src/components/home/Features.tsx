import React from "react";
import { motion } from "framer-motion";
import {
  Radio,
  Users,
  ShieldCheck,
  BellRing,
  MapPinned,
  FileCheck2,
} from "lucide-react";
import { useLanguage } from "../../lib/LanguageContext";

const features = [
  {
    icon: Radio,
    title: "Smart Donor Matching",
    span: "lg:col-span-2",
    accent: "from-blood-50 via-white to-white",
  },
  {
    icon: Users,
    title: "Notify Multiple Donors",
    desc: "Simultaneously notifies multiple eligible donors when more than one unit is required, so you're not dependent on a single response.",
    span: "lg:col-span-1",
    accent: "from-amber-50 to-white",
  },
  {
    icon: ShieldCheck,
    title: "Safety Cooldown Tracking",
    desc: "Automatically checks donor eligibility based on recommended donation intervals. Donors within their recovery window won't be contacted.",
    span: "lg:col-span-1",
    accent: "from-emerald-50 to-white",
  },
  {
    icon: MapPinned,
    title: "Hospital-Aware Routing",
    desc: "Planned navigation to the exact hospital wing or blood bank counter — including entry instructions for donors.",
    span: "lg:col-span-1",
    accent: "from-violet-50 to-white",
    comingSoon: true,
  },
  {
    icon: BellRing,
    title: "Timely Notifications",
    desc: "Notifications respect quiet hours, frequency caps, and donor preferences. No spam — only relevant alerts when a compatible request is nearby.",
    span: "lg:col-span-1",
    accent: "from-rose-50 to-white",
  },
  {
    icon: FileCheck2,
    title: "Donor Verification",
    desc: "Supports identity verification and stores donor information. Final medical screening and donation eligibility are determined by the authorised blood bank or hospital.",
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
                  <div className="flex items-center gap-2">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-ink-900 text-white">
                      <f.icon className="h-5 w-5" strokeWidth={2} />
                    </div>
                    {f.comingSoon && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                        Coming Soon
                      </span>
                    )}
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
