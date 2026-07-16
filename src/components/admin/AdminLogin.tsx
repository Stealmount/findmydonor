import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, KeyRound, Lock, ArrowRight } from 'lucide-react';
import { AdminUser } from '../../types';

interface AdminLoginProps {
  onLogin: (admin: AdminUser) => void;
  onBack: () => void;
}

export function AdminLogin({ onLogin, onBack }: AdminLoginProps) {
  const [accessKey, setAccessKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Dummy authentication for UI showcase
    if (accessKey === 'RAKT-ADMIN-2026') {
      const admin: AdminUser = {
        id: 'admin_1',
        username: 'SuperAdmin',
        role: 'superadmin',
        created_at: new Date().toISOString()
      };
      onLogin(admin);
    } else {
      setError('Invalid Access Key. Security breach logged.');
    }
  };

  return (
    <div className="min-h-screen bg-ink-950 flex flex-col items-center justify-center p-6 text-white overflow-hidden relative">
      {/* Dark glowing backdrop */}
      <div className="absolute inset-0 grid-pattern-dark opacity-30 pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-red-900/20 rounded-full blur-3xl pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <button
          onClick={onBack}
          className="mb-8 text-ink-400 hover:text-white transition flex items-center text-sm font-mono uppercase tracking-widest"
        >
          ← Abort Access
        </button>

        <div className="bg-ink-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-red-950/50 border border-red-500/30 flex items-center justify-center">
              <ShieldAlert className="h-8 w-8 text-red-500" />
            </div>
          </div>
          
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold font-mono tracking-tight text-white mb-2">Restricted Area</h1>
            <p className="text-sm text-ink-400 font-mono">Enter authorization key to access the control tower.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-wider text-ink-400 ml-1">Access Key</label>
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
              className="w-full flex items-center justify-center gap-2 bg-white text-ink-900 font-bold font-mono uppercase tracking-wider py-4 rounded-xl hover:bg-ink-100 transition shadow-[0_0_20px_rgba(255,255,255,0.1)] group"
            >
              <Lock className="h-4 w-4" />
              Authenticate
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
          
          <div className="mt-8 text-center border-t border-ink-800 pt-6">
            <p className="text-[10px] text-ink-600 font-mono uppercase tracking-widest">
              Unauthorized access is strictly prohibited and monitored.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
