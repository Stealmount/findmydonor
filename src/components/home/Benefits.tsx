import React from "react";
import { motion } from "framer-motion";
import { Check, Heart, Shield, Sparkles, Zap, Users2, Lock } from "lucide-react";
import { useLanguage } from "../../lib/LanguageContext";

const benefits = [
  {
    icon: Zap,
    title: "Instant proximity paging",
    desc: "We notify only eligible donors within the required travel radius — no broadcast blast to people 500 km away.",
  },
  {
    icon: Shield,
    title: "Zero spam, strict frequency caps",
    desc: "Once a donor donates, our engine enforces an automatic 60-day cool-off window.",
  },
  {
    icon: Users2,
    title: "Verified hospital integration",
    desc: "Direct blood bank verification ensures requests are genuine and units reach the intended patient.",
  },
  {
    icon: Lock,
    title: "Privacy first communication",
    desc: "Phone numbers stay private between donors and hospitals until a match is confirmed.",
  },
];

export function Benefits() {
  const { t, language } = useLanguage();
  const isHi = language === 'HI';

  return (
    <section
      id="benefits"
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
              {t.benefits.badge}
            </p>
            <h2 className="mt-2 text-[clamp(1.85rem,4.5vw,3rem)] font-medium leading-[1.05] tracking-tight text-ink-900">
              {t.benefits.title}
            </h2>
            <p className="mt-5 text-[15.5px] leading-relaxed text-ink-600">
              {t.benefits.subtitle}
            </p>

            <div className="mt-8 rounded-3xl bg-ink-900 p-6 text-white shadow-premium-lg">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-blood-300">
                {useLanguage().language === 'HI' ? 'रक्तदान का वादा' : 'The FindMyDonor™ promise'}
              </p>
              <p className="mt-3 text-[20px] font-medium leading-snug tracking-tight">
                {useLanguage().language === 'HI' ? (
                  <>
                    "जब किसी को रक्त की आवश्यकता हो, तो उसे 30 लोगों से मांगने की आवश्यकता नहीं होनी चाहिए। उसे केवल{" "}
                    <span className="text-blood-300">एक नेटवर्क</span> से जुड़ना चाहिए।"
                  </>
                ) : (
                  <>
                    "When someone asks for blood, they shouldn't have to ask 30
                    people. They should ask{" "}
                    <span className="text-blood-300">one network</span>."
                  </>
                )}
              </p>
              <p className="mt-4 text-[12.5px] text-white/60">
                {useLanguage().language === 'HI' ? '— सामुदायिक रक्त नेटवर्क' : '— Community Blood Network'}
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
                      {t.benefits.items?.[i]?.title || b.title}
                    </h3>
                  </div>
                  <p className="mt-4 text-[13.5px] leading-relaxed text-ink-600">
                    {t.benefits.items?.[i]?.desc || b.desc}
                  </p>
                  <ul className="mt-4 space-y-1.5">
                    {(useLanguage().language === 'HI'
                      ? ['सेकंडों में मिलान', 'सुरक्षित विश्राम अवधि', 'गोपनीयता सर्वोपरी']
                      : ['Sub-second matching', 'Safety cooldowns', 'Privacy first']
                    ).map((tItem) => (
                      <li
                        key={tItem}
                        className="flex items-center gap-2 text-[12.5px] text-ink-500"
                      >
                        <Check
                          className="h-3.5 w-3.5 text-emerald-600"
                          strokeWidth={3}
                        />
                        {tItem}
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
