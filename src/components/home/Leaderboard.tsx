import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Star, ShieldCheck, Heart } from 'lucide-react';


interface LeaderboardEntry {
  name: string;
  donations: number;
  city: string;
  bloodType: string;
  rank: number;
  isLegend: boolean;
}

export function Leaderboard() {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const response = await fetch('/api/leaderboard');
        const data = await response.json().catch(() => []);
        if (response.ok && Array.isArray(data) && data.length > 0) {
          const list: LeaderboardEntry[] = data.map((item: any, idx: number) => ({
            name: item.name,
            donations: item.donation_count,
            city: item.city,
            bloodType: item.blood_group,
            rank: idx + 1,
            isLegend: item.donation_count >= 6,
          }));
          setLeaders(list.slice(0, 5));
        } else {
          setLeaders([]);
        }
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        setLeaders([]);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, []);

  return (
    <section className="py-16 sm:py-20 relative overflow-hidden bg-gradient-to-b from-white to-slate-50">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-50/50 via-transparent to-transparent" />
      
      <div className="relative mx-auto max-w-4xl px-5 sm:px-8">
        <div className="text-center max-w-xl mx-auto mb-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 text-[11px] font-bold uppercase tracking-wider mb-3">
            <Trophy className="w-3.5 h-3.5" />
            Top Lifesavers Leaderboard
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-900 font-sans">
            Hero Honor Roll
          </h2>
          <p className="text-xs sm:text-sm text-ink-500 mt-2">
            Celebrating the members of our community who step forward to donate blood.
          </p>
        </div>

        {/* Leaderboard list container */}
        <div className="bg-white rounded-3xl border border-ink-200/80 shadow-premium-lg overflow-hidden divide-y divide-ink-100 relative z-10">
          {leaders.length === 0 && !loading && (
            <div className="p-10 text-center space-y-3">
              <Trophy className="w-10 h-10 text-amber-500 mx-auto animate-bounce" />
              <h3 className="text-base sm:text-lg font-bold text-ink-900">Be the First Lifesaver on the Leaderboard!</h3>
              <p className="text-xs sm:text-sm text-ink-600 max-w-md mx-auto">
                No voluntary donations recorded yet in your area. Register as a volunteer donor today, complete your first donation, and earn the top spot on our Hero Honor Roll.
              </p>
            </div>
          )}
          {leaders.map((entry, idx) => {
            const isTop3 = entry.rank <= 3;
            return (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
                key={entry.name}
                className="flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Rank badge */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    entry.rank === 1 ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300' :
                    entry.rank === 2 ? 'bg-slate-100 text-slate-700 ring-2 ring-slate-300' :
                    entry.rank === 3 ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-300' :
                    'bg-slate-50 text-slate-500 border border-slate-200'
                  }`}>
                    {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm sm:text-base text-ink-900 truncate">
                        {entry.name.split(' ')[0]} {entry.name.split(' ')[1] ? `${entry.name.split(' ')[1][0]}.` : ''}
                      </span>
                      {entry.isLegend && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                          <Star className="w-2.5 h-2.5 fill-purple-700" />
                          Legend
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] sm:text-xs text-ink-500 font-semibold">{entry.city}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <span className="block font-extrabold text-sm sm:text-base text-rose-600">
                      {entry.donations} donations
                    </span>
                    <span className="text-[10px] text-ink-500 font-semibold">
                      ❤️ {entry.donations * 3} lives saved
                    </span>
                  </div>

                  <span className="w-10 h-10 rounded-xl bg-slate-900 text-white font-mono font-bold text-xs flex items-center justify-center border border-slate-800 shadow-sm shrink-0">
                    {entry.bloodType}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
