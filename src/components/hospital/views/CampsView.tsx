import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, MapPin, Phone, Tent, Send, CheckCircle, Tent as TentIcon, XCircle } from 'lucide-react';
import { authenticatedApi } from '../../../lib/api';
import { EmptyState } from '../widgets/Shared';

interface CampsViewProps {
  hospital: { city: string; phone: string; hospital_name: string };
  isHi: boolean;
}

export function CampsView({ hospital, isHi }: CampsViewProps) {
  const [campForm, setCampForm] = useState({ title: '', venue: '', date: '', time: '' });
  const [campStatus, setCampStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [lastCampId, setLastCampId] = useState('');

  const handleCampSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCampStatus('submitting');
    try {
      // POST to existing public camps endpoint (no auth required for NGO camp creation)
      const res = await authenticatedApi<{ success: boolean; camp: { id: string } }>(
        '/api/camps', campForm, 'POST'
      );
      setLastCampId(res.camp?.id || '');
      setCampStatus('success');
      setCampForm({ title: '', venue: '', date: '', time: '' });
      setTimeout(() => setCampStatus('idle'), 5000);
    } catch {
      setCampStatus('error');
      setTimeout(() => setCampStatus('idle'), 3000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">
          {isHi ? 'रक्तदान शिविर की घोषणा करें' : 'Announce a Donation Camp'}
        </h2>
        <p className="text-ink-400 text-sm mt-1">
          {isHi
            ? 'शिविर की जानकारी भरें — यह तुरंत सार्वजनिक निर्देशिका में प्रकाशित हो जाएगी।'
            : 'Fill in camp details — it will be published immediately to the public directory.'}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {campStatus === 'success' ? (
          <motion.div key="success"
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="py-10 text-center space-y-4 bg-ink-900/60 border border-emerald-500/20 rounded-3xl p-8"
          >
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white">{isHi ? 'शिविर प्रकाशित हो गया!' : 'Camp Published!'}</h3>
            <p className="text-ink-400 text-sm">
              {isHi ? 'आपका शिविर सार्वजनिक निर्देशिका में दिखाई दे रहा है।' : 'Your camp is now visible in the public directory.'}
            </p>
            {lastCampId && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-800 border border-ink-700 text-[11px] font-mono text-ink-300">
                ID: {lastCampId}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.form key="form"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onSubmit={handleCampSubmit}
            className="bg-ink-900/60 border border-ink-800 rounded-3xl p-6 space-y-5"
          >
            {campStatus === 'error' && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                {isHi ? 'शिविर बनाने में विफल। पुनः प्रयास करें।' : 'Failed to create camp. Please try again.'}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block">
                {isHi ? 'शिविर का नाम' : 'Camp Title'}
              </label>
              <input type="text" required
                value={campForm.title}
                onChange={e => setCampForm(p => ({ ...p, title: e.target.value }))}
                placeholder={isHi ? 'जैसे: वार्षिक रक्तदान महाशिविर 2026' : 'e.g. Annual Mega Blood Donation Drive 2026'}
                className="w-full bg-ink-950/70 border border-ink-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blood-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block">
                <MapPin className="w-3 h-3 inline mr-1" />
                {isHi ? 'स्थान / पता' : 'Venue / Address'}
              </label>
              <input type="text" required
                value={campForm.venue}
                onChange={e => setCampForm(p => ({ ...p, venue: e.target.value }))}
                placeholder={isHi ? 'हॉल का नाम, गली, शहर' : 'Hall name, street, area'}
                className="w-full bg-ink-950/70 border border-ink-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blood-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block">
                  <CalendarDays className="w-3 h-3 inline mr-1" />
                  {isHi ? 'तिथि' : 'Date'}
                </label>
                <input type="date" required
                  value={campForm.date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setCampForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full bg-ink-950/70 border border-ink-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blood-500 [color-scheme:dark]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block">
                  {isHi ? 'समय' : 'Time'}
                </label>
                <input type="text" required
                  value={campForm.time}
                  onChange={e => setCampForm(p => ({ ...p, time: e.target.value }))}
                  placeholder={isHi ? 'जैसे: सुबह 9 बजे – शाम 5 बजे' : 'e.g. 09:00 AM – 05:00 PM'}
                  className="w-full bg-ink-950/70 border border-ink-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blood-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block">
                  {isHi ? 'शहर' : 'City'}
                </label>
                <div className="w-full bg-ink-950/40 border border-ink-800/50 rounded-xl px-4 py-3 text-ink-400 text-sm">
                  {hospital.city}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block">
                  <Phone className="w-3 h-3 inline mr-1" />
                  {isHi ? 'संपर्क' : 'Contact'}
                </label>
                <div className="w-full bg-ink-950/40 border border-ink-800/50 rounded-xl px-4 py-3 text-ink-400 text-sm font-mono">
                  {hospital.phone}
                </div>
              </div>
            </div>

            <button type="submit"
              disabled={campStatus === 'submitting'}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 px-6 py-4 text-[14px] font-bold text-white shadow-[0_8px_24px_-6px_rgba(16,185,129,0.35)] transition cursor-pointer disabled:opacity-50"
            >
              {campStatus === 'submitting' ? (
                <span className="animate-pulse">{isHi ? 'प्रकाशित हो रहा है...' : 'Publishing...'}</span>
              ) : (
                <>
                  <TentIcon className="h-4 w-4" />
                  {isHi ? 'शिविर प्रकाशित करें' : 'Publish Camp'}
                </>
              )}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
