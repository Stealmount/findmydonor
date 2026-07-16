import React from "react";
import { motion } from "framer-motion";
import { Search, Bell, MapPin, Heart, ArrowRight } from "lucide-react";
import { useLanguage } from "../../lib/LanguageContext";

export function HowItWorks() {
  const { t, language } = useLanguage();

  const steps = [
    {
      n: "01",
      icon: Search,
      title: t.howItWorks.step1Title,
      desc: t.howItWorks.step1Desc,
      color: "from-blood-50 to-white",
      iconColor: "text-blood-600",
      iconBg: "bg-blood-50",
    },
    {
      n: "02",
      icon: Bell,
      title: t.howItWorks.step2Title,
      desc: t.howItWorks.step2Desc,
      color: "from-amber-50 to-white",
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50",
    },
    {
      n: "03",
      icon: MapPin,
      title: t.howItWorks.step3Title,
      desc: t.howItWorks.step3Desc,
      color: "from-emerald-50 to-white",
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="relative py-20 sm:py-28 bg-gradient-to-b from-white to-ink-50/40"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl"
        >
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-blood-600">
            {t.howItWorks.badge}
          </p>
          <h2 className="mt-2 text-[clamp(1.85rem,4.5vw,3rem)] font-medium leading-[1.05] tracking-tight text-ink-900">
            {t.howItWorks.title}
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-600">
            {t.howItWorks.subtitle}
          </p>
        </motion.div>

        <div className="mt-14 relative">
          {/* Connecting line on desktop */}
          <div
            className="hidden lg:block absolute top-12 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ink-200 to-transparent"
            aria-hidden
          />

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="group relative rounded-3xl bg-white subtle-border shadow-premium p-6 card-lift overflow-hidden"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                  aria-hidden
                />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div
                      className={`relative grid h-12 w-12 place-items-center rounded-2xl ${s.iconBg} ring-1 ring-ink-100`}
                    >
                      <s.icon className={`h-5 w-5 ${s.iconColor}`} strokeWidth={2} />
                    </div>
                    <span className="text-[11px] font-semibold tracking-[0.18em] text-ink-300">
                      {language === "HI" ? `चरण ${s.n}` : `STEP ${s.n}`}
                    </span>
                  </div>
                  <h3 className="mt-5 text-[18px] font-semibold tracking-tight text-ink-900">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-600">
                    {s.desc}
                  </p>
                  <div className="mt-5 flex items-center gap-1 text-[12.5px] font-medium text-ink-500 group-hover:text-ink-900 transition">
                    {language === "HI" ? "और जानें" : "Learn more"}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Authentic Clinical Photography Banner (100% Real Unsplash Photo) */}
          <div className="mt-12 overflow-hidden rounded-3xl border border-ink-200/80 shadow-premium-lg relative group">
            <img
              src="https://images.unsplash.com/photo-1615461066841-6116e61058f4?auto=format&fit=crop&w=1200&q=80"
              alt="Real Hospital Clinical Workflow & Sterile Equipment"
              className="h-48 sm:h-64 w-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex items-end p-6 sm:p-8">
              <div className="text-white max-w-xl">
                <span className="text-[11px] font-bold uppercase tracking-wider bg-blood-600 px-3 py-1 rounded-full">
                  {language === "HI"
                    ? "सत्यापित अस्पताल बुनियादी ढांचा"
                    : "Verified Hospital Infrastructure"}
                </span>
                <h3 className="text-lg sm:text-2xl font-semibold mt-2">
                  {language === "HI"
                    ? "100% सुरक्षित और पेशेवर रूप से प्रबंधित रक्त संग्रह केंद्र"
                    : "100% Sterile, Professionally Managed Collection Points"}
                </h3>
                <p className="text-xs sm:text-sm text-white/80 mt-1">
                  {language === "HI"
                    ? "प्रत्येक मिलान प्रक्रिया राष्ट्रीय सुरक्षा दिशानिर्देशों का कड़ाई से पालन करने वाले सत्यापित नैदानिक भागीदारों से जुड़ी है।"
                    : "Every matching cycle is tied to verified clinical partners adhering strictly to national transfusion safety guidelines."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
