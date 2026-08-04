import React from 'react';
import { Award, Zap, Heart, Shield, Flame } from 'lucide-react';

interface DonorBadgesProps {
  donationCount: number;
}

export interface BadgeTier {
  name: string;
  donationsNeeded: number;
  icon: React.ReactNode;
  color: string;
  description: string;
  xpNeeded: number;
}

export const BADGE_TIERS: BadgeTier[] = [
  {
    name: 'Blood Recruit',
    donationsNeeded: 0,
    icon: <Shield className="w-8 h-8 text-slate-400" />,
    color: 'from-slate-100 to-slate-200 text-slate-700 border-slate-300',
    description: 'Registered as a lifesaving donor',
    xpNeeded: 50,
  },
  {
    name: 'Life Giver',
    donationsNeeded: 1,
    icon: <Heart className="w-8 h-8 text-rose-500 fill-rose-500/20" />,
    color: 'from-rose-500/10 to-rose-500/20 text-rose-700 border-rose-200',
    description: 'Completed your first blood donation',
    xpNeeded: 250,
  },
  {
    name: 'Community Hero',
    donationsNeeded: 3,
    icon: <Flame className="w-8 h-8 text-orange-500 fill-orange-500/20" />,
    color: 'from-orange-500/10 to-orange-500/20 text-orange-700 border-orange-200',
    description: '3 donations logged. Highly active responder.',
    xpNeeded: 650,
  },
  {
    name: 'Blood Champion',
    donationsNeeded: 6,
    icon: <Zap className="w-8 h-8 text-amber-500 fill-amber-500/20 animate-pulse" />,
    color: 'from-amber-500/10 to-amber-500/20 text-amber-800 border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]',
    description: '6 donations logged. Lifesaver status.',
    xpNeeded: 1250,
  },
  {
    name: 'FindMyDonor™ Legend',
    donationsNeeded: 12,
    icon: <Award className="w-10 h-10 text-purple-600 fill-purple-600/20 animate-bounce" />,
    color: 'from-purple-500/10 to-purple-600/30 text-purple-900 border-purple-300 shadow-[0_0_20px_rgba(147,51,234,0.3)]',
    description: '12+ donations. Absolute community pillar.',
    xpNeeded: 2450,
  },
];

export function getDonorStats(donationCount: number) {
  // Base XP computation
  // Registering = 50 XP
  // Profile complete = 50 XP
  // External self-report = 100 XP
  // Matches donated = 200 XP
  const xp = 100 + donationCount * 200;
  
  // Find current tier
  let currentTier = BADGE_TIERS[0];
  let nextTier = BADGE_TIERS[1];
  
  for (let i = 0; i < BADGE_TIERS.length; i++) {
    if (donationCount >= BADGE_TIERS[i].donationsNeeded) {
      currentTier = BADGE_TIERS[i];
      nextTier = BADGE_TIERS[i + 1] || BADGE_TIERS[i]; // cap at legend
    }
  }

  const livesSaved = donationCount * 3;
  const isMaxTier = currentTier === nextTier;
  const progressPercent = isMaxTier
    ? 100
    : Math.min(
        100,
        ((donationCount - currentTier.donationsNeeded) /
          (nextTier.donationsNeeded - currentTier.donationsNeeded)) *
          100
      );

  return {
    xp,
    currentTier,
    nextTier,
    livesSaved,
    progressPercent,
    isMaxTier,
  };
}

export default function DonorBadges({ donationCount }: DonorBadgesProps) {
  const { xp, currentTier, nextTier, livesSaved, progressPercent, isMaxTier } = getDonorStats(donationCount);

  return (
    <div className="bg-white rounded-3xl p-6 border border-ink-200/80 shadow-premium-lg space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-ink-900">Lifesaver Level</h3>
          <p className="text-xs text-ink-500">Every donation saves up to 3 lives</p>
        </div>
        <span className="px-3.5 py-1 rounded-full bg-blood-50 text-blood-700 font-mono font-bold text-xs border border-blood-100">
          🔥 Level {Math.max(1, Math.floor(xp / 400))}
        </span>
      </div>

      {/* Progress Card */}
      <div className="rounded-2xl bg-gradient-to-br from-ink-900 to-black p-5 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl translate-x-1/3 -translate-y-1/3" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className={`p-3 rounded-2xl bg-white flex items-center justify-center border-2 border-white/20 shadow-lg`}>
            {currentTier.icon}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold tracking-wider uppercase text-white/50">Current Badge</span>
            <h4 className="text-lg font-extrabold text-white truncate">{currentTier.name}</h4>
            <p className="text-xs text-white/70 font-semibold">{livesSaved} lives saved so far</p>
          </div>
        </div>

        {/* XP Bar */}
        <div className="mt-5 space-y-2 relative z-10">
          <div className="flex justify-between text-[11px] font-semibold text-white/70">
            <span>{xp} XP earned</span>
            {!isMaxTier && (
              <span>
                {nextTier.donationsNeeded - donationCount} more donation(s) to {nextTier.name}
              </span>
            )}
          </div>
          <div className="h-2 w-full bg-white/15 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Showcase list */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-ink-500">All Badges</h4>
        <div className="grid grid-cols-1 gap-2.5">
          {BADGE_TIERS.map((tier) => {
            const unlocked = donationCount >= tier.donationsNeeded;
            return (
              <div 
                key={tier.name}
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                  unlocked 
                    ? `bg-gradient-to-r ${tier.color}` 
                    : 'bg-white border-ink-100 opacity-40'
                }`}
              >
                <div className={`p-1.5 rounded-xl bg-white border border-ink-200/50`}>
                  {React.cloneElement(tier.icon as React.ReactElement<{ className?: string }>, { className: 'w-6 h-6' })}
                </div>
                <div>
                  <h5 className="font-bold text-xs flex items-center gap-1.5">
                    {tier.name}
                    {unlocked && <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">✓ Unlocked</span>}
                  </h5>
                  <p className="text-[10px] text-ink-500 font-semibold">{tier.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
