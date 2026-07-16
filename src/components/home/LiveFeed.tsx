import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Heart, Bell } from 'lucide-react';

const LIVE_EVENTS = [
  { text: 'Amit K. matched for O+ blood request at AIIMS New Delhi', time: 'Just now', type: 'match' },
  { text: 'New donor registered in Noida Sector 15', time: '1 min ago', type: 'donor' },
  { text: 'Aditya M. donated 2 units of A- at Max Saket', time: '3 min ago', type: 'donation' },
  { text: 'Emergency SOS sent to 14 donors in Gurugram', time: '4 min ago', type: 'sos' },
  { text: 'Priya S. matched for AB- at Medanta Hospital', time: '7 min ago', type: 'match' },
  { text: 'Faisal I. completed blood donation safety cooldown', time: '12 min ago', type: 'cooldown' },
  { text: 'Safdarjung Hospital registered 3 critical blood requests', time: '15 min ago', type: 'request' },
  { text: 'Fortis Hospital Noida matched 100% compatible O- donor', time: '18 min ago', type: 'match' },
];

type LiveRequest = {
  blood_type_needed: string;
  units_required: number;
  hospital_city: string;
  urgency_level: string;
};

export function LiveFeed() {
  const [index, setIndex] = useState(0);
  const [liveRequests, setLiveRequests] = useState<LiveRequest[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/live-requests');
        const payload = await response.json();
        if (active && response.ok) setLiveRequests(payload.requests || []);
      } catch {
        // The static feed is a graceful fallback while the API is unavailable.
      }
    };
    void load();
    const refresh = window.setInterval(load, 30_000);
    return () => { active = false; window.clearInterval(refresh); };
  }, []);

  const events = liveRequests.length
    ? liveRequests.map((request) => ({
        text: `${request.urgency_level.toUpperCase()} request: ${request.units_required} unit${request.units_required > 1 ? 's' : ''} of ${request.blood_type_needed} needed in ${request.hospital_city}`,
        time: 'Live', type: 'request',
      }))
    : LIVE_EVENTS;

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % events.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [events.length]);

  const event = events[index % events.length];

  return (
    <div className="relative mx-auto max-w-4xl px-5 sm:px-8 mt-6">
      <div className="bg-gradient-to-br from-ink-950 to-ink-900 border border-white/10 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-4 overflow-hidden relative">
        <div className="absolute inset-0 bg-rose-500/5 blur-xl pointer-events-none" />
        
        <div className="flex items-center gap-3 relative z-10">
          <div className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-400 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5" />
            Live Network Feed
          </span>
        </div>

        <div className="flex-1 min-w-0 relative h-6 overflow-hidden z-10 flex items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="text-xs sm:text-sm font-semibold text-white/90 truncate flex items-center gap-2"
            >
              {event.type === 'match' && <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0 fill-rose-500/20" />}
              {event.type === 'sos' && <Bell className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
              <span>{event.text}</span>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="text-[10px] font-mono text-white/40 shrink-0 relative z-10">
          {event.time}
        </div>
      </div>
    </div>
  );
}
