import React from "react";
import { motion } from "framer-motion";
import { Users, Shield, Lock, Building2, HeartHandshake } from "lucide-react";
import { useLanguage } from "../../lib/LanguageContext";

const points = [
  {
    icon: Users,
    title: "Connects requesters with voluntary donors nearby",
    desc: "Post a request with blood group, location, and units needed. We notify matching donors in your area.",
  },
  {
    icon: Shield,
    title: "Respects donor health with built-in safety intervals",
    desc: "Donors are only contacted when their recommended recovery period has passed.",
  },
  {
    icon: Lock,
    title: "Keeps your information private",
    desc: "Phone numbers and personal details stay hidden until both sides confirm a match.",
  },
  {
    icon: Building2,
    title: "Provides a searchable blood bank directory",
    desc: "Browse 3,500+ government and private blood banks with live stock data powered by e-Raktkosh.",
  },
  {
    icon: HeartHandshake,
    title: "100% free, always",
    desc: "No fees for donors, requesters, or hospitals. FindMyDonor is a community platform, not a commercial service.",
  },
];

export function WhatFMDDoes() {
  const { t } = useLanguage();

  return (
    <section id="what-fmd-does" className="relative py-20 sm:py-28 bg-ink-50/40">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-blood-600">
            {t.howItWorks.badge}
          </p>
          <h2 className="mt-2 text-[clamp(1.85rem,4.5vw,3rem)] font-medium leading-[1.05] tracking-tight text-ink-900">
            {t.howItWorks.title}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[15.5px] leading-relaxed text-ink-600">
            {t.howItWorks.subtitle}
          </p>
        </motion.div>

        <div className="mt-12 space-y-4">
          {points.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: i * 0.05 }}
                className="flex items-start gap-4 rounded-3xl bg-white subtle-border shadow-premium p-5 card-lift"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blood-50 text-blood-600 ring-1 ring-blood-100">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold tracking-tight text-ink-900">
                    {p.title}
                  </h3>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-ink-600">
                    {p.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
