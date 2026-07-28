"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Check,
  Clock,
  Droplet,
  Heart,
  MapPin,
  Navigation,
  Phone,
  Shield,
  User,
  X,
  Zap,
} from "lucide-react";

type Tab = "request" | "donor" | "hospital";

export function Showcase() {
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
            See it in action
          </p>
          <h2 className="mt-2 text-[clamp(1.85rem,4.5vw,3rem)] font-medium leading-[1.05] tracking-tight">
            One product.{" "}
            <span className="font-serif italic text-blood-200">Three lives</span>{" "}
            in the loop.
          </h2>
          <p className="mt-4 text-[15.5px] leading-relaxed text-white/70">
            The same FindMyDonor™ app serves the patient who needs blood, the donor
            who gives it, and the hospital that runs the request. Switch between
            perspectives to see the magic happen.
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="mt-10 flex flex-wrap items-center gap-2">
          {(
            [
              { id: "request", label: "Requester view", icon: Phone },
              { id: "donor", label: "Donor view", icon: Heart },
              { id: "hospital", label: "Hospital view", icon: Shield },
            ] as const
          ).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`group inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-medium transition ${
                  active
                    ? "bg-white text-ink-900"
                    : "bg-white/5 text-white/70 hover:bg-white/10 ring-1 ring-white/10"
                }`}
              >
                <t.icon
                  className={`h-3.5 w-3.5 ${
                    active ? "text-blood-600" : "text-white/60"
                  }`}
                />
                {t.label}
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
          <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-b from-ink-50 to-white min-h-[520px]">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 h-5 w-24 rounded-full bg-ink-900 z-20" />
            <div className="relative">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequesterView() {
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
          Request blood in under a minute. Track every donor in real time.
        </h3>
        <p className="mt-4 text-[15px] text-white/70 leading-relaxed">
          Type in the patient's blood group, units needed, and hospital
          location. We push a live request to the right donors and stream you
          every step — acceptances, ETAs, and confirmations.
        </p>
        <div className="mt-6 space-y-3">
          {[
            "Live donor count with blood-group match",
            "In-app chat and one-tap calling",
            "Auto-reroute if a donor cancels",
            "Receipt with hospital confirmation",
          ].map((b) => (
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
            Active request
          </p>
          <h4 className="mt-1 text-[20px] font-semibold text-ink-900">
            B+ · 2 units
          </h4>
          <p className="text-[12px] text-ink-500">Apollo Hospital · Ward 4B</p>

          <div className="mt-5 rounded-2xl bg-white border border-ink-100 p-3.5 shadow-premium">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold text-ink-900">
                Donors responding
              </p>
              <span className="text-[10px] text-emerald-600 font-semibold">
                2/2 matched
              </span>
            </div>
            <div className="mt-3 space-y-2.5">
              {[
                { name: "Priya M.", dist: "1.2 km", eta: "8 min", status: "Confirmed" },
                { name: "Karthik R.", dist: "2.0 km", eta: "12 min", status: "En route" },
              ].map((d, i) => (
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
                        {d.dist} away
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10.5px] font-semibold text-emerald-600">
                      {d.status}
                    </p>
                    <p className="text-[10px] text-ink-500">ETA {d.eta}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-ink-900 p-3.5 text-white">
            <div className="flex items-center justify-between">
              <p className="text-[11.5px] text-white/70">ETA to first unit</p>
              <p className="text-[14px] font-semibold">8 min 12 sec</p>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "72%" }}
                transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                className="h-full bg-blood-500"
              />
            </div>
          </div>
        </div>
      </PhoneFrame>
    </motion.div>
  );
}

function DonorView() {
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
          One quiet ping.{" "}
          <span className="font-serif italic text-blood-200">One life saved.</span>
        </h3>
        <p className="mt-4 text-[15px] text-white/70 leading-relaxed">
          Donors choose how often they want to be contacted, their preferred
          radius, and which days they're available. When a match fits, you get
          a single, respectful notification — never spam, never guilt.
        </p>
        <div className="mt-6 space-y-3">
          {[
            "Quiet hours and frequency caps",
            "Earn verified badges per donation",
            "Real-time turn-by-turn to hospital",
            "Auto-cooldown for 90 days",
          ].map((b) => (
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
        <div className="relative bg-gradient-to-b from-blood-600 to-blood-700 p-5 pt-10 text-white">
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
            Urgent request · 1.2 km
          </p>
          <h4 className="mt-1 text-[22px] font-semibold">
            B+ blood needed
          </h4>
          <p className="text-[12px] text-white/80">Apollo Hospital · 2 units</p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/10 ring-1 ring-white/15 p-2.5">
              <p className="text-[9.5px] uppercase tracking-wider text-white/60">
                Last donation
              </p>
              <p className="text-[14px] font-semibold">112 days ago</p>
            </div>
            <div className="rounded-2xl bg-white/10 ring-1 ring-white/15 p-2.5">
              <p className="text-[9.5px] uppercase tracking-wider text-white/60">
                Eligible
              </p>
              <p className="text-[14px] font-semibold text-emerald-200">Yes ✓</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button className="rounded-full bg-white/10 ring-1 ring-white/20 py-2.5 text-[12.5px] font-semibold flex items-center justify-center gap-1">
              <X className="h-3.5 w-3.5" />
              Pass
            </button>
            <button className="rounded-full bg-white text-blood-700 py-2.5 text-[12.5px] font-semibold flex items-center justify-center gap-1">
              <Zap className="h-3.5 w-3.5 fill-blood-600" />
              Accept
            </button>
          </div>

          <div className="mt-5 rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
            <div className="flex items-center gap-2 text-[11px] text-white/80">
              <Navigation className="h-3.5 w-3.5" />
              <span>Route to Ward 4B · 8 min</span>
            </div>
          </div>
        </div>
      </PhoneFrame>
    </motion.div>
  );
}

function HospitalView() {
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
          A control tower for{" "}
          <span className="font-serif italic text-blood-200">transfusion medicine.</span>
        </h3>
        <p className="mt-4 text-[15px] text-white/70 leading-relaxed">
          Hospitals get a real-time inventory, donor network access, predictive
          shortage alerts, and a one-click request console. Integrate in a day
          with our FHIR-ready API.
        </p>
        <div className="mt-6 space-y-3">
          {[
            "FHIR-ready EHR integration",
            "Predicted 7-day demand model",
            "Multi-hospital inventory sharing",
            "Audit logs for regulatory review",
          ].map((b) => (
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
                <p className="text-[12.5px] font-semibold">Apollo Hospital</p>
                <p className="text-[11px] text-white/60">Live inventory</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/30 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-300">
              Stable
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
                  {b.v} units
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl bg-ink-900/60 ring-1 ring-white/10 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
              Incoming donors
            </p>
            <div className="mt-2.5 space-y-2">
              {[
                { n: "Priya M.", t: "Arriving 8 min", bg: "B+" },
                { n: "Karthik R.", t: "Arriving 12 min", bg: "B+" },
                { n: "Sneha D.", t: "Standby", bg: "B+" },
              ].map((d, i) => (
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
