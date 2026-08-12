import React from "react";
import { motion } from "framer-motion";
import { HeartPulse, Clock, MapPin, Building2 } from "lucide-react";
import { useLanguage } from "../../lib/LanguageContext";

export function Impact() {
  const { t, language } = useLanguage();
  const [dbStats, setDbStats] = React.useState({ totalDonors: 0, activeRequests: 0, livesSaved: 0 });

  React.useEffect(() => {
    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => setDbStats(data || { totalDonors: 0, activeRequests: 0, livesSaved: 0 }))
      .catch(() => {});
  }, []);

  const stats = [
    {
      icon: HeartPulse,
      n: dbStats.totalDonors > 0 ? `${dbStats.totalDonors}` : "Building",
      label: language === 'HI' ? "सत्यापित स्वैच्छिक रक्तदाता" : "Verified voluntary donors",
      sub: language === 'HI' ? "सुरक्षा कूलडाउन पर प्रतिक्रिया के लिए तैयार" : "Ready to respond with safety cooldown verification",
    },
    {
      icon: Clock,
      n: "< 3 mins",
      label: language === 'HI' ? "लक्ष्य मिलान समय" : "Target matching time",
      sub: language === 'HI' ? "त्वरित अलर्ट इंजन" : "Instant SMS & WhatsApp notification engine",
    },
    {
      icon: MapPin,
      n: "Delhi NCR",
      label: language === 'HI' ? "नेटवर्क क्षेत्र" : "Pilot coverage",
      sub: language === 'HI' ? "दिल्ली, नोएडा, और गुरुग्राम" : "Geographical matching across NCR",
    },
    {
      icon: Building2,
      n: dbStats.livesSaved > 0 ? `${dbStats.livesSaved}` : "0 Fees",
      label: language === 'HI' ? "समुदाय समर्थित मंच" : "100% Free Community Platform",
      sub: language === 'HI' ? "बिना किसी वाणिज्यिक शुल्क के" : "Direct voluntary connection, no commercial fees",
    },
  ];

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
                  {language === 'HI' ? 'लक्ष्य' : 'Target'}
                </p>
                <p className="mt-1.5 text-[28px] font-semibold tracking-tight text-ink-900">
                  50+
                </p>
                <p className="text-[12px] text-ink-500">{language === 'HI' ? 'रक्तदाता नेटवर्क' : 'donors in the network'}</p>
              </div>
              <div className="rounded-2xl blood-drop-gradient p-5 text-white shadow-premium">
                <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/90">
                  {language === 'HI' ? 'औसत प्रतिक्रिया' : 'Avg. response'}
                </p>
                <p className="mt-1.5 text-[28px] font-semibold tracking-tight text-white">
                  {language === 'HI' ? '< 3 मिनट' : '< 3m'}
                </p>
                <p className="text-[12px] text-white/80">
                  {language === 'HI' ? 'स्वचालित पिनकोड अलर्ट' : 'automated pincode alert'}
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
                      {f.label}
                    </p>
                  </div>
                  <p className="mt-3 text-[26px] font-bold tracking-tight text-ink-900">
                    {f.n}
                  </p>
                  <p className="mt-1 text-[13.5px] leading-snug text-ink-600">
                    {f.sub}
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
