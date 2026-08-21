import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Droplet, MapPin, Clock, User } from 'lucide-react';
import { BloodType } from '../../../types';
import { EmptyState } from '../widgets/Shared';

interface DonorsViewProps {
  users: Array<{
    id: string;
    full_name: string;
    blood_type?: string;
    city?: string;
    phone?: string;
    whatsapp_number?: string;
  }>;
  isHi: boolean;
}

const BLOOD_GROUPS: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export function DonorsView({ users, isHi }: DonorsViewProps) {
  const [search, setSearch] = useState('');
  const [selectedBlood, setSelectedBlood] = useState<BloodType | 'all'>('all');

  const filtered = useMemo(() => {
    return users.filter(d => {
      const matchesSearch = search === '' ||
        d.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (d.city && d.city.toLowerCase().includes(search.toLowerCase()));
      const matchesBlood = selectedBlood === 'all' || d.blood_type === selectedBlood;
      return matchesSearch && matchesBlood;
    });
  }, [users, search, selectedBlood]);

  const bloodCounts = useMemo(() => {
    const counts: Record<string, number> = { all: users.length };
    BLOOD_GROUPS.forEach(bg => { counts[bg] = users.filter(d => d.blood_type === bg).length; });
    return counts;
  }, [users]);

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-400">
          {isHi ? 'दाता निर्देशिका' : 'Donor Directory'}
        </h2>
        <span className="text-[11px] font-semibold text-ink-400">
          {filtered.length} {isHi ? 'दाता' : 'donors'}
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={isHi ? 'नाम या शहर से खोजें...' : 'Search by name or city...'}
          className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-ink-200 text-ink-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blood-500 transition"
        />
      </div>

      {/* Blood group filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedBlood('all')}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
            selectedBlood === 'all'
              ? 'bg-blood-600/15 text-blood-400 border-blood-500/25'
              : 'text-ink-500 border-ink-200 hover:text-ink-700'
          }`}
        >
          {isHi ? 'सभी' : 'All'} ({bloodCounts.all})
        </button>
        {BLOOD_GROUPS.map(bg => (
          <button
            key={bg}
            onClick={() => setSelectedBlood(bg)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
              selectedBlood === bg
                ? 'bg-blood-600/15 text-blood-400 border-blood-500/25'
                : 'text-ink-500 border-ink-200 hover:text-ink-700'
            }`}
          >
            {bg} ({bloodCounts[bg]})
          </button>
        ))}
      </div>

      {/* Donor list */}
      {filtered.length === 0 ? (
        <EmptyState
          title={isHi ? 'कोई दाता नहीं मिला' : 'No donors found'}
          titleHi={isHi ? 'कोई दाता नहीं मिला' : 'No donors found'}
          hint={isHi ? 'फ़िल्टर बदलकर देखें।' : 'Try adjusting your filters.'}
          hintHi={isHi ? 'फ़िल्टर बदलकर देखें।' : 'Try adjusting your filters.'}
          isHi={isHi}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(donor => (
            <motion.div
              key={donor.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-white border border-ink-200 p-4 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-blood-50 border border-blood-200 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-blood-600">{donor.blood_type || '—'}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-ink-900 truncate">{donor.full_name}</div>
                  <div className="text-[11px] text-ink-500 mt-0.5 flex items-center gap-2">
                    {donor.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {donor.city}
                      </span>
                    )}
                    {donor.blood_type && (
                      <span className="flex items-center gap-1">
                        <Droplet className="w-3 h-3" />
                        {donor.blood_type}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                {donor.phone && (
                  <div className="text-[11px] font-mono text-ink-400">{donor.phone}</div>
                )}
                <div className="text-[10px] text-ink-400 flex items-center gap-1 justify-end mt-0.5">
                  <Clock className="w-3 h-3" />
                  {isHi ? 'सक्रिय' : 'Active'}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
