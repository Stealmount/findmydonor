import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Check,
  Droplet,
  Heart,
  Navigation,
  Phone,
  Shield,
  X,
  Zap,
} from "lucide-react";
import { useLanguage } from "../../lib/LanguageContext";

type Tab = "request" | "donor" | "hospital";

export function Showcase() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("request");

  return (
    <section
      id="donors"
      className="relative py-20 sm:py-28 overflow-hidden bg-ink-900 text-white"
    >
      <div
        className="absolute inset-0 grid-pattern-dark opacity-50"
        aria-hidden
      />
      <div
        className="glow-blob h-[500px] w-[500px] bg-blood-600/30 -top-20 -right-32"
        aria-hidden
      />
      <div
        className="glow-blob h-[420px] w-[420px] bg-blood-500/20 -bottom-32 -left-20"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl"
        >
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-blood-300">
            {t.showcase.badge}
          </p>
          <h2 className="mt-2 text-[clamp(1.85rem,4.5vw,3rem)] font-medium leading-[1.05] tracking-tight">
            {t.showcase.titleLine1}{" "}
            <span className="font-serif italic text-blood-200">{t.showcase.titleHighlight}</span>{" "}
            {t.showcase.titleLine2}
          </h2>
          <p className="mt-4 text-[15.5px] leading-relaxed text-white/70">
            {t.showcase.subtitle}
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="mt-10 flex flex-wrap items-center gap-2">
          {(
            [
              { id: "request", label: t.showcase.tabRequester, icon: Phone },
              { id: "donor", label: t.showcase.tabDonor, icon: Heart },
              { id: "hospital", label: t.showcase.tabHospital, icon: Shield },
            ] as const
          ).map((tItem) => {
            const active = tab === tItem.id;
            return (
              <button
                key={tItem.id}
                onClick={() => setTab(tItem.id)}
                className={`group inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-medium transition cursor-pointer ${
                  active
                    ? "bg-white text-ink-900"
                    : "bg-white/5 text-white/70 hover:bg-white/10 ring-1 ring-white/10"
                }`}
              >
                <tItem.icon
                  className={`h-3.5 w-3.5 ${
                    active ? "text-blood-600" : "text-white/60"
                  }`}
                />
                {tItem.label}
              </button>
            );
          })}
        </div>

        <div className="mt-10">
          {tab === "request" && <RequesterView />}
          {tab === "donor" && <DonorView />}
          {tab === "hospital" && <HospitalView />}
        </div>
      </div>
    </section>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      <div
        className="absolute -inset-4 bg-gradient-to-br from-blood-500/20 via-transparent to-blood-700/20 blur-2xl rounded-[44px]"
        aria-hidden
      />
      <div className="relative rounded-[36px] bg-gradient-to-b from-ink-700 to-ink-800 p-2 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)]">
        <div className="rounded-[30px] bg-ink-900 p-1.5">
          <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-b from-ink-50 to-white min-h-[520px] text-ink-900">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 h-5 w-24 rounded-full bg-ink-900 z-20" />
            <div className="relative">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequesterView() {
  const { language } = useLanguage();
  const isHi = language === "HI";

  return (
    <motion.div
      key="req"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="grid items-center gap-10 lg:grid-cols-2"
    >
      <div>
        <h3 className="text-[clamp(1.5rem,3vw,2.25rem)] font-medium leading-tight tracking-tight">
          {isHi
            ? "रक्त की उपलब्धता की जांच करें। अपने पास के दाताओं से जुड़े।"
            : "Check blood availability. Connect with donors nearby."}
        </h3>
        <p className="mt-4 text-[15px] text-white/70 leading-relaxed">
          {isHi
            ? "रोगी का रक्त समूह और स्थान दर्ज करें। हम आपको सही दाताओं से जोड़ते हैं और हर कदम पर अपडेट देते हैं — उपलब्धता, दूरी और समय।"
            : "Enter the patient's blood group and location. We connect you to the right donors and keep you updated every step of the way — availability, distance, and timing."}
        </p>
        <div className="mt-6 space-y-3">
          {(isHi
            ? [
                "रक्त समूह मिलान के साथ लाइव डोनर उपलब्धता",
                "इन-ऐप चैट और वन-टैप कॉलिंग",
                "सुविधाजनक शेड्यूलिंग",
                "विश्वसनीय और सत्यापित प्रोफाइल",
              ]
            : [
                "Live donor availability with blood-group match",
                "In-app chat and one-tap calling",
                "Convenient scheduling",
                "Reliable and verified profiles",
              ]
          ).map((b) => (
            <div key={b} className="flex items-center gap-2.5 text-[14px]">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-blood-500/20 text-blood-300">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="text-white/80">{b}</span>
            </div>
          ))}
        </div>
      </div>
      <PhoneFrame>
        <div className="p-5 pt-8">
          <div className="flex items-center justify-between text-[10px] text-ink-500">
            <span>9:41</span>
            <span>•••</span>
          </div>
          <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-ink-500">
            {isHi ? "उपलब्धता स्थिति" : "Availability Status"}
          </p>
          <h4 className="mt-1 text-[20px] font-semibold text-ink-900">
            {isHi ? "B+ · 2 यूनिट" : "B+ · 2 units"}
          </h4>
          <p className="text-[12px] text-ink-500">
            {isHi ? "स्थान · क्षेत्र" : "Location · Area"}
          </p>

          <div className="mt-5 rounded-2xl bg-white border border-ink-100 p-3.5 shadow-premium">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold text-ink-900">
                {isHi ? "उपलब्ध डोनर" : "Available donors"}
              </p>
              <span className="text-[10px] text-emerald-600 font-semibold">
                {isHi ? "सक्रिय" : "Active"}
              </span>
            </div>
            <div className="mt-3 space-y-2.5">
              {[
                {
                  name: isHi ? "प्रिया एम." : "Priya M.",
                  dist: isHi ? "1.2 किमी" : "1.2 km",
                  status: isHi ? "उपलब्ध" : "Available",
                },
                {
                  name: isHi ? "कार्तिक आर." : "Karthik R.",
                  dist: isHi ? "2.0 किमी" : "2.0 km",
                  status: isHi ? "उपलब्ध" : "Available",
                },
              ].map((d) => (
                <div
                  key={d.name}
                  className="flex items-center justify-between rounded-xl bg-ink-50/60 p-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-8 w-8 place-items-center rounded-full blood-drop-gradient text-white text-[10px] font-semibold">
                      {d.name[0]}
                    </div>
                    <div>
                      <p className="text-[11.5px] font-semibold text-ink-900">
                        {d.name}
                      </p>
                      <p className="text-[10px] text-ink-500">
                        {d.dist} {isHi ? "दूर" : "away"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10.5px] font-semibold text-emerald-600">
                      {d.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PhoneFrame>
    </motion.div>
  );
}

function DonorView() {
  const { language } = useLanguage();
  const isHi = language === "HI";

  return (
    <motion.div
      key="donor"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="grid items-center gap-10 lg:grid-cols-2"
    >
      <div>
        <h3 className="text-[clamp(1.5rem,3vw,2.25rem)] font-medium leading-tight tracking-tight">
          {isHi
            ? "एक शांत सूचना। "
            : "One quiet ping. "}
          <span className="font-serif italic text-blood-200">
            {isHi ? "एक मैच मिला।" : "One donor matched."}
          </span>
        </h3>
        <p className="mt-4 text-[15px] text-white/70 leading-relaxed">
          {isHi
            ? "रक्तदाता चुनते हैं कि उनसे कितनी बार संपर्क किया जाए, उनकी पसंदीदा दूरी और उपलब्ध दिन। जब कोई दाता मेल खाता है, तो आपको एक सम्मानजनक सूचना मिलती है।"
            : "Donors choose how often they're contacted, their preferred radius, and their availability days. When a compatible request appears nearby, you get a respectful notification — nothing more."}
        </p>
        <div className="mt-6 space-y-3">
          {(isHi
            ? [
                "शांत घंटे और फ्रीक्वेंसी सीमाएं",
                "प्रत्येक रक्तदान पर सत्यापित बैज अर्जित करें",
                "अस्पताल तक रियल-टाइम नेविगेशन",
                "स्वचालित विश्राम अवधि सुरक्षा ट्रैकिंग",
              ]
            : [
                "Quiet hours and frequency caps",
                "Earn verified badges per donation",
                "Real-time turn-by-turn to hospital",
                "Auto-cooldown safety tracking",
              ]
          ).map((b) => (
            <div key={b} className="flex items-center gap-2.5 text-[14px]">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-blood-500/20 text-blood-300">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="text-white/80">{b}</span>
            </div>
          ))}
        </div>
      </div>
      <PhoneFrame>
        <div className="relative bg-gradient-to-b from-blood-600 to-blood-700 p-5 pt-10 text-white min-h-[520px]">
          <div className="flex items-center justify-between text-[10px] text-white/70">
            <span>9:41</span>
            <span>•••</span>
          </div>
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 grid h-14 w-14 place-items-center rounded-2xl bg-white/15 backdrop-blur ring-1 ring-white/20 animate-heartbeat"
          >
            <Bell className="h-6 w-6" />
          </motion.div>
          <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-white/70">
            {isHi ? "रक्त अनुरोध · 1.2 किमी" : "Blood request · 1.2 km"}
          </p>
          <h4 className="mt-1 text-[22px] font-semibold">
            {isHi ? "B+ रक्त की आवश्यकता" : "B+ blood needed"}
          </h4>
          <p className="text-[12px] text-white/80">
            {isHi ? "नमूना अस्पताल · 2 यूनिट" : "City Hospital · 2 units"}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/10 ring-1 ring-white/15 p-2.5">
              <p className="text-[9.5px] uppercase tracking-wider text-white/60">
                {isHi ? "अंतिम रक्तदान" : "Last donation"}
              </p>
              <p className="text-[14px] font-semibold">
                {isHi ? "112 दिन पहले" : "112 days ago"}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 ring-1 ring-white/15 p-2.5">
              <p className="text-[9.5px] uppercase tracking-wider text-white/60">
                {isHi ? "पात्रता" : "Eligible"}
              </p>
              <p className="text-[14px] font-semibold text-emerald-200">
                {isHi ? "हाँ ✓" : "Yes ✓"}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button className="rounded-full bg-white/10 ring-1 ring-white/20 py-2.5 text-[12.5px] font-semibold flex items-center justify-center gap-1 cursor-pointer">
              <X className="h-3.5 w-3.5" />
              {isHi ? "छोड़ें" : "Pass"}
            </button>
            <button className="rounded-full bg-white text-blood-700 py-2.5 text-[12.5px] font-semibold flex items-center justify-center gap-1 cursor-pointer">
              <Zap className="h-3.5 w-3.5 fill-blood-600" />
              {isHi ? "स्वीकार करें" : "Accept"}
            </button>
          </div>

          <div className="mt-5 rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
            <div className="flex items-center gap-2 text-[11px] text-white/80">
              <Navigation className="h-3.5 w-3.5" />
              <span>
                {isHi
                  ? "वार्ड 4B का मार्ग · 8 मिनट"
                  : "Route to Ward 4B · 8 min"}
              </span>
            </div>
          </div>
        </div>
      </PhoneFrame>
    </motion.div>
  );
}

function HospitalView() {
  const { language } = useLanguage();
  const isHi = language === "HI";

  return (
    <motion.div
      key="hosp"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="grid items-center gap-10 lg:grid-cols-2"
    >
      <div>
        <h3 className="text-[clamp(1.5rem,3vw,2.25rem)] font-medium leading-tight tracking-tight">
          {isHi ? "ट्रांसफ्यूजन चिकित्सा के लिए " : "A control tower for "}
          <span className="font-serif italic text-blood-200">
            {isHi ? "कंट्रोल टावर।" : "transfusion medicine."}
          </span>
        </h3>
        <p className="mt-4 text-[15px] text-white/70 leading-relaxed">
          {isHi
            ? "हम अस्पतालों के लिए उपकरण बना रहे हैं — जिसमें इन्वेंटरी ट्रैकिंग, रक्तदाता नेटवर्क एक्सेस, और सुव्यवस्थित अनुरोध वर्कफ़्लो शामिल होंगे। अस्पताल एकीकरण सुविधाएँ वर्तमान में विकास में हैं।"
            : "We're building tools for hospitals — including inventory tracking, donor network access, and streamlined request workflows. Hospital integration features are currently in development."}
        </p>
        <div className="mt-6 space-y-3">
          {(isHi
            ? [
                "अस्पताल अनुरोध डैशबोर्ड (जल्द आ रहा है)",
                "रक्तदाता नेटवर्क एकीकरण (जल्द आ रहा है)",
                "इन्वेंटरी ट्रैकिंग उपकरण (योजनाबद्ध)",
                "अनुपालन और ऑडिट समर्थन (योजनाबद्ध)",
              ]
            : [
                "Hospital request dashboard (Coming Soon)",
                "Donor network integration (Coming Soon)",
                "Inventory tracking tools (Planned)",
                "Compliance & audit support (Planned)",
              ]
          ).map((b) => (
            <div key={b} className="flex items-center gap-2.5 text-[14px]">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-blood-500/20 text-blood-300">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="text-white/80">{b}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="relative">
        <div className="rounded-3xl bg-white/[0.04] backdrop-blur ring-1 ring-white/10 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/10">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-[12.5px] font-semibold">
                  {isHi ? "नमूना पूर्वावलोकन" : "Sample Hospital Preview"}
                </p>
                <p className="text-[11px] text-white/60">
                  {isHi ? "इंटरफ़ेस पूर्वावलोकन" : "Interface preview"}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/30 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-300">
              {isHi ? "स्थिर" : "Stable"}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-2">
            {[
              { g: "A+", v: 18, low: false },
              { g: "O+", v: 6, low: true },
              { g: "B+", v: 14, low: false },
              { g: "AB−", v: 3, low: true },
            ].map((b) => (
              <div
                key={b.g}
                className={`rounded-2xl p-2.5 text-center ${
                  b.low
                    ? "bg-amber-500/15 ring-1 ring-amber-400/30"
                    : "bg-white/5 ring-1 ring-white/10"
                }`}
              >
                <Droplet
                  className={`mx-auto h-3.5 w-3.5 ${
                    b.low ? "text-amber-300" : "text-white/70"
                  }`}
                />
                <p className="mt-1 text-[14px] font-semibold">{b.g}</p>
                <p
                  className={`text-[10px] ${
                    b.low ? "text-amber-200" : "text-white/60"
                  }`}
                >
                  {b.v} {isHi ? "यूनिट" : "units"}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl bg-ink-900/60 ring-1 ring-white/10 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
              {isHi ? "आने वाले रक्तदाता" : "Incoming donors"}
            </p>
            <div className="mt-2.5 space-y-2">
              {[
                {
                  n: isHi ? "प्रिया एम." : "Priya M.",
                  t: isHi ? "8 मिनट में आगमन" : "Arriving 8 min",
                  bg: "B+",
                },
                {
                  n: isHi ? "कार्तिक आर." : "Karthik R.",
                  t: isHi ? "12 मिनट में आगमन" : "Arriving 12 min",
                  bg: "B+",
                },
                {
                  n: isHi ? "स्नेहा डी." : "Sneha D.",
                  t: isHi ? "तैयार (Standby)" : "Standby",
                  bg: "B+",
                },
              ].map((d) => (
                <div
                  key={d.n}
                  className="flex items-center justify-between rounded-xl bg-white/5 px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <div className="grid h-6 w-6 place-items-center rounded-full blood-drop-gradient text-white text-[9px] font-semibold">
                      {d.n[0]}
                    </div>
                    <p className="text-[11.5px] font-semibold">{d.n}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9.5px] font-semibold">
                      {d.bg}
                    </span>
                    <span className="text-[10px] text-white/60">{d.t}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
