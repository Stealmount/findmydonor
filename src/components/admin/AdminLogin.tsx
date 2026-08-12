import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, KeyRound, Lock, ArrowRight } from 'lucide-react';
import { AdminUser } from '../../types';
import { useLanguage } from '../../lib/LanguageContext';

interface AdminLoginProps {
  onLogin: (admin: AdminUser) => void;
  onBack: () => void;
}

export function AdminLogin({ onLogin, onBack }: AdminLoginProps) {
  const { language, setLanguage } = useLanguage();
  const isHi = language === 'HI';
  const [accessKey, setAccessKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const secret = accessKey.trim();
    if (!secret) { setError(isHi ? 'कुंजी दर्ज करें।' : 'Enter the access key.'); return; }
    try {
      const res = await fetch('/api/admin/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      });
      if (!res.ok) throw new Error('Invalid');
      // Phase 7.2: server returns a short-lived JWT; the raw key never reaches the browser.
      const data = await res.json();
      sessionStorage.setItem('fmd_admin_secret', data.token);
      const admin: AdminUser = {
        id: 'admin_1',
        username: 'SuperAdmin',
        role: 'superadmin',
        created_at: new Date().toISOString()
      };
      onLogin(admin);
    } catch {
      setError(isHi ? 'अमान्य कुंजी। सुरक्षा उल्लंघन दर्ज किया गया।' : 'Invalid Access Key. Security breach logged.');
    }
  };

  return (
    <div className="min-h-screen bg-ink-950 flex flex-col items-center justify-center p-6 text-white overflow-hidden relative">
      {/* Dark glowing backdrop */}
      <div className="absolute inset-0 grid-pattern-dark opacity-30 pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-red-900/20 rounded-full blur-3xl pointer-events-none" />
      
      {/* Top right language switcher */}
      <div className="absolute top-6 right-6 z-20 flex items-center rounded-full bg-ink-900 p-0.5 border border-ink-800">
        <button
          onClick={() => setLanguage('EN')}
          className={`rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
            !isHi ? 'bg-red-600 text-white shadow-sm' : 'text-ink-400 hover:text-white'
          }`}
        >
          EN
        </button>
        <button
          onClick={() => setLanguage('HI')}
          className={`rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
            isHi ? 'bg-red-600 text-white shadow-sm' : 'text-ink-400 hover:text-white'
          }`}
        >
          HI
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <button
          onClick={onBack}
          className="mb-8 text-ink-400 hover:text-white transition flex items-center text-sm font-mono uppercase tracking-widest cursor-pointer"
        >
          ← {isHi ? 'वापस जाएं' : 'Abort Access'}
        </button>

        <div className="bg-ink-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-red-950/50 border border-red-500/30 flex items-center justify-center">
              <ShieldAlert className="h-8 w-8 text-red-500" />
            </div>
          </div>
          
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold font-mono tracking-tight text-white mb-2">
              {isHi ? 'प्रतिबंधित क्षेत्र' : 'Restricted Area'}
            </h1>
            <p className="text-sm text-ink-400 font-mono">
              {isHi ? 'नियंत्रण केंद्र तक पहुँचने के लिए प्राधिकरण कुंजी दर्ज करें।' : 'Enter authorization key to access the control tower.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-wider text-ink-400 ml-1">
                {isHi ? 'एक्सेस कुंजी (Access Key)' : 'Access Key'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-ink-500" />
                </div>
                <input
                  type="password"
                  value={accessKey}
                  onChange={(e) => {
                    setAccessKey(e.target.value);
                    setError('');
                  }}
                  className="w-full bg-ink-950/50 border border-ink-800 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-ink-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition font-mono"
                  placeholder="XXXX-XXXX-XXXX"
                  required
                />
              </div>
              {error && (
                <motion.p 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="text-xs text-red-400 font-mono mt-2"
                >
                  {error}
                </motion.p>
              )}
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-white text-ink-900 font-bold font-mono uppercase tracking-wider py-4 rounded-xl hover:bg-ink-100 transition shadow-[0_0_20px_rgba(255,255,255,0.1)] group cursor-pointer"
            >
              <Lock className="h-4 w-4" />
              {isHi ? 'प्रमाणित करें (Authenticate)' : 'Authenticate'}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
          
          <div className="mt-8 text-center border-t border-ink-800 pt-6">
            <p className="text-[10px] text-ink-600 font-mono uppercase tracking-widest">
              {isHi ? 'अनधिकृत प्रवेश सख्त वर्जित है और निगरानी में है।' : 'Unauthorized access is strictly prohibited and monitored.'}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
