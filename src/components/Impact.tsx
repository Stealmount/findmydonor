"use client";

import { motion } from "framer-motion";
import { Activity, Globe2, Heart, Users } from "lucide-react";

const facts = [
  {
    icon: Activity,
    title: "Every 2 seconds",
    value: "someone in the world needs blood.",
  },
  {
    icon: Heart,
    title: "1 donation",
    value: "can save up to 3 lives.",
  },
  {
    icon: Users,
    title: "Only 3.2%",
    value: "of eligible adults donate regularly.",
  },
  {
    icon: Globe2,
    title: "FindMyDonor™'s goal",
    value: "make that number 10% by 2030.",
  },
];

export function Impact() {
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
              The impact
            </p>
            <h2 className="mt-2 text-[clamp(1.85rem,4.5vw,3rem)] font-medium leading-[1.05] tracking-tight text-ink-900">
              We measure success in{" "}
              <span className="font-serif italic">heartbeats restored.</span>
            </h2>
            <p className="mt-5 text-[15.5px] leading-relaxed text-ink-600">
              Behind every matched unit is a child, a parent, a neighbor, a
              stranger. We're building the network that makes sure help is
              always within reach.
            </p>
            <div className="mt-7 text-[15.5px] leading-relaxed text-ink-600">
              Your donation does not sit in a freezer. It goes straight to the patient in critical need. 
            </div>
            <div className="mt-5 rounded-2xl overflow-hidden border border-ink-200/50 shadow-md h-36 relative">
              <img 
                src="https://images.unsplash.com/photo-1579154341184-13a8f6e3fbbd?w=500&q=80&auto=format&fit=crop"
                alt="Saving lives" 
                className="w-full h-full object-cover" 
                loading="lazy" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                <span className="text-white text-xs font-bold">Verified matching since 2019</span>
              </div>
            </div>
          </motion.div>

          <div className="lg:col-span-7">
            <div className="grid gap-4 sm:grid-cols-2">
              {facts.map((f, i) => (
                <motion.div
                  key={f.title}
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
                      {f.title}
                    </p>
                  </div>
                  <p className="mt-4 text-[18px] font-medium leading-snug tracking-tight text-ink-900">
                    {f.value}
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
