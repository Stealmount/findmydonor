import React from 'react';
import { useLanguage } from '../../lib/LanguageContext';
import { Heart, Clock } from 'lucide-react';

interface TabBarProps {
 active: 'requests' | 'history';
 matchCount: number;
 historyCount: number;
 onSelect: (tab: 'requests' | 'history') => void;
}

/** Segmented control between live match requests and donation history tabs. */
export default function TabBar({ active, matchCount, historyCount, onSelect }: TabBarProps) {
 const { t } = useLanguage();

 return (
 <div className="flex bg-black/10 rounded-[28px] p-1 gap-1 mx-1 mt-1">
 <button
 id="btn-tab-requests"
 type="button"
 onClick={() => onSelect('requests')}
 className={`flex-1 py-3 px-4 rounded-3xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
 active === 'requests'
 ? 'bg-white text-blood-700'
 : 'text-white/70 hover:text-white hover:bg-white/10'
 }`}
>
 <Heart className={`w-4 h-4 ${active === 'requests' ? 'text-blood-600 animate-pulse' : 'text-white/70'}`} />
 {t.donorDashboard.liveMatchingRequests} ({matchCount})
 </button>
 <button
 id="btn-tab-history"
 type="button"
 onClick={() => onSelect('history')}
 className={`flex-1 py-3 px-4 rounded-3xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
 active === 'history'
 ? 'bg-white text-blood-700'
 : 'text-white/70 hover:text-white hover:bg-white/10'
 }`}
>
 <Clock className={`w-4 h-4 ${active === 'history' ? 'text-blood-600' : 'text-white/70'}`} />
 {t.donorDashboard.donationHistory} ({historyCount})
 </button>
 </div>
 );
}
