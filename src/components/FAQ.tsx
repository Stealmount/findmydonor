"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { useState } from "react";

const faqs = [
  {
    q: "How does FindMyDonor™ find a donor in real time?",
    a: "When a request is posted, our matching engine filters our network by blood group, 90-day eligibility, distance, and quiet-hour preferences — and pushes a notification to every donor who fits. The first to accept is locked in; others remain on warm standby for additional units.",
  },
  {
    q: "What if a requester needs more than one unit?",
    a: "That's the default. You can request up to 10 units in a single request, and we'll notify that many eligible donors in parallel. If a donor declines or no-shows, we automatically re-page the next eligible donor in the queue.",
  },
  {
    q: "Why a 90-day cooldown?",
    a: "It takes roughly 56–90 days for the body to fully replenish red blood cells after a donation. We enforce this cooldown automatically so donors can never be over-notified and so every unit is safe for the recipient.",
  },
  {
    q: "Is FindMyDonor™ free for donors?",
    a: "Yes — forever. Donors are the heart of this network and we will never charge you, show you ads, or sell your data. Family plans and hospital subscriptions keep the lights on.",
  },
  {
    q: "How is my data protected?",
    a: "All health data is end-to-end encrypted at rest and in transit. We're HIPAA-ready, SOC 2 Type II certified, and you control what's shared with hospitals — including the option to donate anonymously.",
  },
  {
    q: "Which cities are live?",
    a: "FindMyDonor™ is live in 240+ cities across India, with the densest coverage in metro areas. We're adding new cities every month — drop your pin at signup and we'll notify you when we launch in your area.",
  },
  {
    q: "How do hospitals integrate FindMyDonor™?",
    a: "We offer a FHIR-ready REST API and a web dashboard. Most hospitals integrate in under a day. Our team handles the onboarding and runs alongside your existing blood bank workflow.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

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
            Frequently asked
          </p>
          <h2 className="mt-2 text-[clamp(1.85rem,4.5vw,3rem)] font-medium leading-[1.05] tracking-tight text-ink-900">
            Questions, answered.
          </h2>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-600">
            Still curious? Reach out at{" "}
            <a
              href="mailto:hello@raktdaan.org"
              className="text-blood-600 hover:underline underline-offset-2"
            >
              hello@raktdaan.org
            </a>
            .
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
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="text-[15.5px] font-semibold text-ink-900">
                    {f.q}
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
                        {f.a}
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
