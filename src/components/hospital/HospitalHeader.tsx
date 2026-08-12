import React from 'react';
import { Shield, BadgeCheck, AlertTriangle, Bell } from 'lucide-react';
import { InstitutionType } from '../../types';

interface HospitalHeaderProps {
  hospital: { hospital_name: string; institution_type: InstitutionType; status: string; phone: string; city: string };
  criticalCount: number;
  lowCount: number;
  onLanguageChange: (lang: 'EN' | 'HI') => void;
  onLogout: () => void;
  language: 'EN' | 'HI';
  lastSync: Date | null;
}

export function HospitalHeader({
  hospital,
  criticalCount,
  lowCount,
  onLanguageChange,
  onLogout,
  language,
  lastSync,
}: HospitalHeaderProps) {
  const isHi = language === 'HI';

  return (
    <header className="sticky top-0 z-20 border-b border-ink-800 bg-ink-950/80 backdrop-blur-xl px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-lg bg-ink-900 border border-ink-700 flex items-center justify-center shadow-lg shrink-0">
          <Shield className="h-5 w-5 text-blood-400" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[15px] font-bold text-white tracking-tight leading-tight truncate">
              {hospital.hospital_name}
            </h1>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest shrink-0">
              <BadgeCheck className="w-3 h-3" /> Verified
            </span>
            {criticalCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold shrink-0">
                <AlertTriangle className="w-3 h-3" />
                {criticalCount} {isHi ? 'गंभीर' : 'Critical'}
              </span>
            )}
            {lowCount > 0 && criticalCount === 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold shrink-0">
                <AlertTriangle className="w-3 h-3" />
                {lowCount} {isHi ? 'कम' : 'Low'}
              </span>
            )}
          </div>
          <p className="text-[11px] font-medium text-ink-400 truncate">
            {hospital.institution_type === 'blood_bank'
              ? (isHi ? 'लाइव स्टॉक और आपातकालीन अनुरोध' : 'Live Stock & Emergency Requests')
              : hospital.institution_type === 'ngo'
              ? (isHi ? 'शिविर प्रबंधन और समुदाय' : 'Camp Management & Community')
              : (isHi ? 'लाइव इन्वेंट्री और कंट्रोल टॉवर' : 'Live Inventory & Control Tower')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="flex items-center rounded-full bg-ink-900 p-0.5 border border-ink-800">
          {(['EN', 'HI'] as const).map(lang => (
            <button key={lang}
              onClick={() => onLanguageChange(lang)}
              className={`rounded-full px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${language === lang ? 'bg-blood-600 text-white shadow-sm' : 'text-ink-400 hover:text-white'}`}
            >
              {lang}
            </button>
          ))}
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 text-[13px] font-semibold text-ink-400 hover:text-white transition bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/10 cursor-pointer"
        >
          <Bell className="h-4 w-4" />
          <span className="hidden sm:inline">{isHi ? 'लॉगआउट' : 'Logout'}</span>
        </button>
      </div>
    </header>
  );
}
