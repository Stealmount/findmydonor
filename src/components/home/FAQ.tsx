import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { useLanguage } from "../../lib/LanguageContext";

const faqs = [
  {
    q: "How does FindMyDonor™ find a donor in real time?",
    a: "When a request is posted, our matching engine filters our network by blood group, eligibility, distance, and preferences — and pushes a notification to every donor who fits. The first to accept is locked in; others remain on warm standby for additional units.",
  },
  {
    q: "How fast is a donor matched after posting a request?",
    a: "Usually within 3 to 10 minutes. As soon as you post a blood request, our engine instantly alerts verified voluntary donors within a 3–5 km radius whose blood group matches.",
  },
  {
    q: "Is FindMyDonor™ really 100% free?",
    a: "Yes. Always. FindMyDonor™ is a non-profit community initiative. We do not charge patients, hospitals, or donors anything. We believe saving lives should never come with a price tag.",
  },
  {
    q: "How does the 60-day safety cooldown work?",
    a: "Once a donor logs a successful donation, their profile is automatically marked on safety recovery cooldown for 60 days (whole blood). During this period, they will not receive emergency SOS alerts.",
  },
  {
    q: "Can hospitals register and broadcast urgent needs?",
    a: "Absolutely. Hospitals and blood banks have a dedicated Requester Portal where they can post multi-unit requests and track real-time donor responses.",
  },
  {
    q: "How do hospitals integrate FindMyDonor™?",
    a: "We offer a REST API and a web console. Most hospitals and blood centers integrate in under a day. Our team handles the onboarding and runs alongside your existing blood bank workflow.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const { t } = useLanguage();

  return (
    <section id="faq" className="relative py-20 sm:py-28 bg-gradient-to-b from-ink-50/40 to-white">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-blood-600">
            {t.faq.badge}
          </p>
          <h2 className="mt-2 text-[clamp(1.85rem,4.5vw,3rem)] font-medium leading-[1.05] tracking-tight text-ink-900">
            {t.faq.title}
          </h2>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-600">
            {t.faq.subtitle}
          </p>
        </motion.div>

        <div className="mt-12 divide-y divide-ink-100 rounded-3xl bg-white subtle-border shadow-premium overflow-hidden">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={f.q}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
                className="px-5 sm:px-7"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left cursor-pointer"
                >
                  <span className="text-[15.5px] font-semibold text-ink-900">
                    {t.faq.items?.[i]?.q || f.q}
                  </span>
                  <span
                    className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-full transition ${
                      isOpen
                        ? "bg-ink-900 text-white"
                        : "bg-ink-100 text-ink-700"
                    }`}
                  >
                    {isOpen ? (
                      <Minus className="h-3.5 w-3.5" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pb-6 pr-10 text-[14.5px] leading-relaxed text-ink-600">
                        {t.faq.items?.[i]?.a || f.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
