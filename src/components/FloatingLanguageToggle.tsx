import React from 'react';
import { motion } from 'framer-motion';
import { Globe, Check } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

export function FloatingLanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const isHi = language === 'HI';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25, delay: 0.3 }}
      className="fixed bottom-20 left-4 sm:bottom-6 sm:left-6 z-50 flex items-center gap-1.5 p-1.5 rounded-full bg-ink-950/90 backdrop-blur-md border border-ink-800/80 shadow-2xl hover:border-blood-500/60 transition-all group"
    >
      <div className="flex items-center gap-1 pl-2 pr-1 text-ink-400 group-hover:text-blood-400 transition-colors">
        <Globe className="h-4 w-4 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">
          {isHi ? 'भाषा' : 'Language'}
        </span>
      </div>

      <div className="flex items-center rounded-full bg-ink-900 p-0.5 border border-ink-800">
        <button
          onClick={() => setLanguage('EN')}
          className={`relative rounded-full px-3 py-1.5 text-xs font-black tracking-wide transition-all cursor-pointer flex items-center gap-1 ${
            !isHi
              ? 'bg-blood-600 text-white shadow-md shadow-blood-900/50 scale-105'
              : 'text-ink-400 hover:text-white hover:bg-ink-800/60'
          }`}
          title="Switch to English"
        >
          <span>EN</span>
          {!isHi && <Check className="h-3 w-3 stroke-[3]" />}
        </button>

        <button
          onClick={() => setLanguage('HI')}
          className={`relative rounded-full px-3 py-1.5 text-xs font-black tracking-wide transition-all cursor-pointer flex items-center gap-1 ${
            isHi
              ? 'bg-blood-600 text-white shadow-md shadow-blood-900/50 scale-105'
              : 'text-ink-400 hover:text-white hover:bg-ink-800/60'
          }`}
          title="हिंदी में बदलें (Switch to Hindi)"
        >
          <span>हिंदी</span>
          {isHi && <Check className="h-3 w-3 stroke-[3]" />}
        </button>
      </div>
    </motion.div>
  );
}
