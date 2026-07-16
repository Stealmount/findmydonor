import React from "react";
import { motion } from "framer-motion";
import { HeartPulse, Clock, MapPin, Building2 } from "lucide-react";
import { useLanguage } from "../../lib/LanguageContext";

const stats = [
  {
    icon: HeartPulse,
    n: "50+",
    label: "Verified voluntary donors",
    sub: "Ready to respond on safety cooldowns in Delhi NCR",
  },
  {
    icon: Clock,
    n: "18 mins",
    label: "Median time to match",
    sub: "Down from hours via traditional phone groups",
  },
  {
    icon: MapPin,
    n: "3",
    label: "Active pilot cities",
    sub: "Delhi, Noida, and Gurugram live",
  },
  {
    icon: Building2,
    n: "5",
    label: "Partner hospitals",
    sub: "Direct SOS integration during our pilot phase",
  },
];

export function Impact() {
  const { t, language } = useLanguage();

  return (
    <section
      id="impact"
      className="relative py-20 sm:py-28 overflow-hidden"
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
              {t.impact.badge}
            </p>
            <h2 className="mt-2 text-[clamp(1.85rem,4.5vw,3rem)] font-medium leading-[1.05] tracking-tight text-ink-900">
              {t.impact.title}
            </h2>
            <p className="mt-5 text-[15.5px] leading-relaxed text-ink-600">
              {t.impact.subtitle}
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white subtle-border p-4 shadow-premium">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-500">
                  This week
                </p>
                <p className="mt-1.5 text-[28px] font-semibold tracking-tight text-ink-900">
                  14
                </p>
                <p className="text-[12px] text-ink-500">units matched</p>
              </div>
              <div className="rounded-2xl blood-drop-gradient p-5 text-white shadow-premium">
                <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/90">
                  {language === 'HI' ? 'औसत प्रतिक्रिया' : 'Avg. response'}
                </p>
                <p className="mt-1.5 text-[28px] font-semibold tracking-tight text-white">
                  {language === 'HI' ? '3 मिनट 42 सेकंड' : '3m 42s'}
                </p>
                <p className="text-[12px] text-white/80">
                  {language === 'HI' ? 'अनुरोध → रक्तदाता' : 'request → donor'}
                </p>
              </div>
            </div>
          </motion.div>

          <div className="lg:col-span-7">
            <div className="grid gap-4 sm:grid-cols-2">
              {stats.map((f, i) => (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.55, delay: i * 0.08 }}
                  className="group relative overflow-hidden rounded-3xl bg-white subtle-border shadow-premium p-6 card-lift"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-ink-900 text-white">
                      <f.icon className="h-5 w-5" />
                    </div>
                    <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-500">
                      {t.impact.stats?.[i]?.label || f.label}
                    </p>
                  </div>
                  <p className="mt-3 text-[26px] font-bold tracking-tight text-ink-900">
                    {f.n}
                  </p>
                  <p className="mt-1 text-[13.5px] leading-snug text-ink-600">
                    {t.impact.stats?.[i]?.sub || f.sub}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
