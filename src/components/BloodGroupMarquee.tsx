"use client";

import { motion } from "framer-motion";
import { Droplet } from "lucide-react";

const groups = [
  "A+", "O+", "B+", "AB+", "O−", "A−", "B−", "AB−",
];

export function BloodGroupMarquee() {
  return (
    <section className="relative py-12 border-y border-ink-100 bg-white/40 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <p className="text-center text-[11.5px] font-semibold uppercase tracking-[0.2em] text-ink-500">
          Every blood group. Real-time. Right now.
        </p>
      </div>
      <div className="mt-6 marquee-mask overflow-hidden">
        <div className="flex w-max items-center gap-10 animate-marquee">
          {[...groups, ...groups, ...groups].map((g, i) => (
            <div
              key={`${g}-${i}`}
              className="flex items-center gap-2.5 text-ink-400"
            >
              <Droplet className="h-4 w-4 fill-blood-300 text-blood-300" />
              <span className="text-[20px] font-semibold tracking-tight">
                {g}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
