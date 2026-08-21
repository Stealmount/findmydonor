import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, MapPin, Phone, Tent, Send, CheckCircle, Tent as TentIcon, XCircle, Plus, Clock } from 'lucide-react';
import { authenticatedApi } from '../../../lib/api';
import { DonationCamp } from '../../../types';
import { EmptyState } from '../widgets/Shared';

interface CampsViewProps {
  hospital: { city: string; phone: string; hospital_name: string };
  isHi: boolean;
}

export function CampsView({ hospital, isHi }: CampsViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [camps, setCamps] = useState<DonationCamp[]>([]);
  const [loading, setLoading] = useState(true);
  const [campForm, setCampForm] = useState({ title: '', venue: '', date: '', time: '' });
  const [campStatus, setCampStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [lastCampId, setLastCampId] = useState('');

  const fetchCamps = async () => {
    try {
      const data = await authenticatedApi<{ camps: DonationCamp[] }>('/api/camps', undefined, 'GET');
      setCamps(data.camps || []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCamps(); }, []);

  const handleCampSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCampStatus('submitting');
    try {
      const res = await authenticatedApi<{ success: boolean; camp: { id: string } }>(
        '/api/camps', campForm, 'POST'
      );
      setLastCampId(res.camp?.id || '');
      setCampStatus('success');
      setCampForm({ title: '', venue: '', date: '', time: '' });
      fetchCamps();
      setTimeout(() => { setCampStatus('idle'); setShowForm(false); }, 3000);
    } catch {
      setCampStatus('error');
      setTimeout(() => setCampStatus('idle'), 3000);
    }
  };

  const now = new Date();
  const upcoming = camps.filter(c => new Date(c.camp_date) >= now);
  const past = camps.filter(c => new Date(c.camp_date) < now);

  const CampCard = ({ camp }: { camp: DonationCamp }) => (
    <div className="rounded-2xl bg-white border border-ink-200 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-ink-900">{camp.title}</div>
          <div className="text-[11px] text-ink-500 mt-1 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {new Date(camp.camp_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {camp.start_time && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {camp.start_time}
                {camp.end_time && ` – ${camp.end_time}`}
              </span>
            )}
          </div>
          {camp.venue_address && (
            <div className="text-[11px] text-ink-500 mt-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {camp.venue_address}{camp.city ? `, ${camp.city}` : ''}
            </div>
          )}
        </div>
        <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
          camp.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
          camp.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-200' :
          new Date(camp.camp_date) >= now ? 'bg-blue-50 text-blue-600 border-blue-200' :
          'bg-ink-50 text-ink-500 border-ink-200'
        }`}>
          {camp.status || (new Date(camp.camp_date) >= now ? (isHi ? 'आगामी' : 'Upcoming') : (isHi ? 'पूर्ण' : 'Completed'))}
        </span>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-400">
          {isHi ? 'दान शिविर' : 'Donation Camps'}
        </h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 rounded-full bg-blood-600 hover:bg-blood-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3 h-3" />
            {isHi ? 'नया शिविर' : 'New Camp'}
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {showForm && (
          <motion.div key="form"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl bg-white border border-ink-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-ink-900">
                  {isHi ? 'शिविर की घोषणा करें' : 'Announce a Camp'}
                </h3>
                <button onClick={() => setShowForm(false)} className="text-ink-400 hover:text-ink-700 cursor-pointer">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {campStatus === 'error' && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm mb-4">
                  {isHi ? 'शिविर बनाने में विफल।' : 'Failed to create camp.'}
                </div>
              )}

              {campStatus === 'success' ? (
                <div className="py-6 text-center space-y-2">
                  <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto" />
                  <p className="text-sm font-bold text-ink-900">{isHi ? 'शिविर प्रकाशित हो गया!' : 'Camp Published!'}</p>
                </div>
              ) : (
                <form onSubmit={handleCampSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-500 block">
                      {isHi ? 'शिविर का नाम' : 'Camp Title'}
                    </label>
                    <input type="text" required value={campForm.title}
                      onChange={e => setCampForm(p => ({ ...p, title: e.target.value }))}
                      placeholder={isHi ? 'जैसे: वार्षिक रक्तदान शिविर' : 'e.g. Annual Blood Donation Camp'}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-ink-200 text-ink-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blood-500 transition"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-500 block">
                      {isHi ? 'स्थान' : 'Venue'}
                    </label>
                    <input type="text" required value={campForm.venue}
                      onChange={e => setCampForm(p => ({ ...p, venue: e.target.value }))}
                      placeholder={isHi ? 'हॉल का नाम, गली' : 'Hall name, street'}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-ink-200 text-ink-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blood-500 transition"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-ink-500 block">
                        {isHi ? 'तिथि' : 'Date'}
                      </label>
                      <input type="date" required value={campForm.date}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => setCampForm(p => ({ ...p, date: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl bg-white border border-ink-200 text-ink-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blood-500 transition"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-ink-500 block">
                        {isHi ? 'समय' : 'Time'}
                      </label>
                      <input type="text" required value={campForm.time}
                        onChange={e => setCampForm(p => ({ ...p, time: e.target.value }))}
                        placeholder={isHi ? 'सुबह 9 – शाम 5' : '09:00 AM – 05:00 PM'}
                        className="w-full px-4 py-3 rounded-xl bg-white border border-ink-200 text-ink-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blood-500 transition"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-ink-500 block">
                        {isHi ? 'शहर' : 'City'}
                      </label>
                      <div className="px-4 py-3 rounded-xl bg-ink-50 border border-ink-200 text-ink-500 text-sm">
                        {hospital.city}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-ink-500 block">
                        {isHi ? 'संपर्क' : 'Contact'}
                      </label>
                      <div className="px-4 py-3 rounded-xl bg-ink-50 border border-ink-200 text-ink-500 text-sm font-mono">
                        {hospital.phone}
                      </div>
                    </div>
                  </div>
                  <button type="submit"
                    disabled={campStatus === 'submitting'}
                    className="w-full rounded-xl bg-blood-600 hover:bg-blood-700 px-6 py-3 text-sm font-bold text-white transition cursor-pointer disabled:opacity-50"
                  >
                    {campStatus === 'submitting' ? (isHi ? 'प्रकाशित हो रहा है...' : 'Publishing...') : (isHi ? 'शिविर प्रकाशित करें' : 'Publish Camp')}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camps list */}
      {loading ? (
        <div className="py-12 text-center text-ink-400 text-sm">
          <span className="animate-pulse">{isHi ? 'लोड हो रहा है...' : 'Loading...'}</span>
        </div>
      ) : camps.length === 0 ? (
        <EmptyState
          title={isHi ? 'कोई शिविर नहीं' : 'No camps yet'}
          titleHi={isHi ? 'कोई शिविर नहीं' : 'No camps yet'}
          hint={isHi ? 'ऊपर "नया शिविर" बटन से शुरू करें।' : 'Click "New Camp" above to get started.'}
          hintHi={isHi ? 'ऊपर "नया शिविर" बटन से शुरू करें।' : 'Click "New Camp" above to get started.'}
          isHi={isHi}
        />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-3">
                {isHi ? 'आगामी शिविर' : 'Upcoming Camps'} ({upcoming.length})
              </h3>
              <div className="space-y-3">
                {upcoming.map(camp => <CampCard key={camp.id} camp={camp} />)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-3">
                {isHi ? 'पिछले शिविर' : 'Past Camps'} ({past.length})
              </h3>
              <div className="space-y-3">
                {past.map(camp => <CampCard key={camp.id} camp={camp} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
