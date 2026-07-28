import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, MapPin, Phone, ExternalLink, Building2,
  Clock, Filter, Map as MapIcon, Grid, RefreshCw,
  Navigation, Calendar, ChevronDown, Compass, Check, ArrowUpRight
} from 'lucide-react';
import { INITIAL_BLOOD_BANKS, INITIAL_VOLUNTARY_CAMPS } from '../data/bloodBankData';
import { BloodType, BloodComponent } from '../types';
import HospitalMap from './HospitalMap';

interface BloodBankDirectoryProps {
  onNavigate: (view: string, pushHistory?: boolean, trackingCode?: string) => void;
}

/** Haversine formula — returns distance in km */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

const CATEGORY_LABEL: Record<string, { label: string; color: string }> = {
  government: { label: 'Government', color: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  red_cross:  { label: 'Red Cross',  color: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
  private:    { label: 'Private',    color: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
  charitable: { label: 'Charitable', color: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
};

const ERAKTKOSH_BASE = 'https://www.eraktkosh.in/BLDAHIMS/BLOODBANK/BLOODBANKDETAILS/BLOODBANKDETAILSJSP.FLOW?newTypeId=2&typeId=56&newType=findbloodbank';

export function BloodBankDirectory({ onNavigate }: BloodBankDirectoryProps) {
  const [activeTab, setActiveTab]   = useState<'banks' | 'camps'>('banks');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBloodType, setSelectedBloodType] = useState<BloodType | 'ALL'>('ALL');
  const [selectedComponent, setSelectedComponent] = useState<BloodComponent | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory]   = useState<string>('ALL');
  const [sortByNearest, setSortByNearest] = useState(true);
  const [viewMode, setViewMode] = useState<'split' | 'grid'>('split');
  const [selectedBankId, setSelectedBankId] = useState<string>(INITIAL_BLOOD_BANKS[0]?.id ?? '');
  const [isComponentOpen, setIsComponentOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen]   = useState(false);
  const [userLoc, setUserLoc] = useState({ lat: 28.6139, lng: 77.2090, live: false });

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude, live: true }),
      () => {}
    );
  }, []);

  const bloodTypes: (BloodType | 'ALL')[] = ['ALL', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

  const filteredBanks = useMemo(() => {
    const withDist = INITIAL_BLOOD_BANKS.map((b) => ({
      ...b,
      distanceKm: haversineKm(userLoc.lat, userLoc.lng, b.latitude, b.longitude),
    }));
    const q = searchQuery.toLowerCase();
    const results = withDist.filter((b) => {
      if (q && !b.name.toLowerCase().includes(q) && !b.city.toLowerCase().includes(q)
           && !b.pincode.includes(q) && !b.address.toLowerCase().includes(q)) return false;
      if (selectedCategory !== 'ALL' && b.category !== selectedCategory) return false;
      if (selectedBloodType !== 'ALL' && !b.stock.some(s => s.blood_type === selectedBloodType && s.available_units > 0)) return false;
      if (selectedComponent  !== 'ALL' && !b.stock.some(s => s.component === selectedComponent  && s.available_units > 0)) return false;
      return true;
    });
    return sortByNearest ? results.sort((a, b) => a.distanceKm - b.distanceKm) : results;
  }, [searchQuery, selectedBloodType, selectedComponent, selectedCategory, userLoc, sortByNearest]);

  const filteredCamps = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return INITIAL_VOLUNTARY_CAMPS.map((c) => ({
      ...c,
      distanceKm: haversineKm(userLoc.lat, userLoc.lng, c.latitude, c.longitude),
    })).filter((c) =>
      !q || c.title.toLowerCase().includes(q) || c.city.toLowerCase().includes(q)
        || c.pincode.includes(q) || c.venue_address.toLowerCase().includes(q)
    );
  }, [searchQuery, userLoc]);

  const selectedBank = filteredBanks.find((b) => b.id === selectedBankId) ?? filteredBanks[0] ?? null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pt-24 pb-20 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Page Header (clean, no badge pill) ────────────────────────────── */}
        <div className="pt-2 pb-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
                Powered by e-Raktkosh · National Blood Transfusion Council
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                Blood Banks & Donation Camps
              </h1>
              <p className="mt-1 text-sm text-gray-500 max-w-xl">
                Real-time inventory of Whole Blood, Platelets, PRBC, and Plasma across 3,500+ verified centers across India.
              </p>
            </div>
            <a
              href={ERAKTKOSH_BASE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blood-600 hover:text-blood-700 underline underline-offset-2 transition"
            >
              View full e-Raktkosh directory <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* ── Primary Tab Bar ────────────────────────────────────────────────── */}
        <div className="flex gap-0 border-b border-gray-200">
          {[
            { key: 'banks' as const, label: `Blood Banks (${filteredBanks.length})`, icon: Building2 },
            { key: 'camps' as const, label: `Donation Camps (${filteredCamps.length})`, icon: Calendar },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === key
                  ? 'border-blood-600 text-blood-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Filter & Search Bar ────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search city, pincode, hospital name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blood-500/30 focus:border-blood-500 transition bg-white"
              />
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              {/* Sort nearest */}
              <button
                type="button"
                onClick={() => setSortByNearest(!sortByNearest)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                  sortByNearest
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <Compass className={`w-3.5 h-3.5 ${sortByNearest ? 'text-emerald-500' : 'text-gray-400'}`} />
                {userLoc.live ? '📍 Live Sorted' : 'Nearest First'}
              </button>

              {/* View toggle — banks only */}
              {activeTab === 'banks' && (
                <div className="flex bg-gray-100 border border-gray-200 rounded-lg p-0.5">
                  {[
                    { key: 'split' as const, label: 'Map', icon: MapIcon },
                    { key: 'grid'  as const, label: 'Grid', icon: Grid },
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setViewMode(key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                        viewMode === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" /> {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Blood-type pill filter — banks only */}
          {activeTab === 'banks' && (
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                Filter by Blood Group
              </label>
              <div className="flex flex-wrap gap-1.5">
                {bloodTypes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedBloodType(t)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                      selectedBloodType === t
                        ? 'bg-blood-600 text-white border-blood-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {t === 'ALL' ? 'All Groups' : t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Component & Category dropdowns — banks only */}
          {activeTab === 'banks' && (
            <div className="flex flex-wrap gap-3 items-center pt-1 border-t border-gray-100">
              {/* Component dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setIsComponentOpen(!isComponentOpen); setIsCategoryOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:border-gray-300 rounded-lg text-xs font-semibold text-gray-700 cursor-pointer transition"
                >
                  Component:{' '}
                  <span className="text-blood-600 font-bold">
                    {selectedComponent === 'ALL' ? 'All' : selectedComponent.replace('_', ' ').toUpperCase()}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </button>
                {isComponentOpen && (
                  <div className="absolute top-10 left-0 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                    {[
                      { label: 'All Components', value: 'ALL' },
                      { label: 'Whole Blood', value: 'whole_blood' },
                      { label: 'PRBC — Packed Red Cells', value: 'prbc' },
                      { label: 'Platelets (SDP)', value: 'platelets_sdp' },
                      { label: 'FFP — Fresh Frozen Plasma', value: 'ffp' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setSelectedComponent(opt.value as any); setIsComponentOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-medium flex items-center justify-between transition cursor-pointer ${
                          selectedComponent === opt.value
                            ? 'bg-blood-50 text-blood-700 font-semibold'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                        {selectedComponent === opt.value && <Check className="w-3.5 h-3.5 text-blood-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Category dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setIsCategoryOpen(!isCategoryOpen); setIsComponentOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:border-gray-300 rounded-lg text-xs font-semibold text-gray-700 cursor-pointer transition"
                >
                  Category:{' '}
                  <span className="text-blood-600 font-bold">
                    {selectedCategory === 'ALL' ? 'All' : selectedCategory.replace('_', ' ')}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </button>
                {isCategoryOpen && (
                  <div className="absolute top-10 left-0 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                    {[
                      { label: 'All Categories', value: 'ALL' },
                      { label: 'Government', value: 'government' },
                      { label: 'Red Cross', value: 'red_cross' },
                      { label: 'Private', value: 'private' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setSelectedCategory(opt.value); setIsCategoryOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-medium flex items-center justify-between transition cursor-pointer ${
                          selectedCategory === opt.value
                            ? 'bg-blood-50 text-blood-700 font-semibold'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                        {selectedCategory === opt.value && <Check className="w-3.5 h-3.5 text-blood-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
                <RefreshCw className="w-3 h-3 text-emerald-500 animate-spin" />
                Synced 2 mins ago
              </div>
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            TAB 1 — BLOOD BANKS
        ───────────────────────────────────────────────────────────────────── */}
        {activeTab === 'banks' && (
          <>
            {/* Results count */}
            <p className="text-xs text-gray-400 px-0.5">
              {filteredBanks.length} blood bank{filteredBanks.length !== 1 ? 's' : ''} found
              {sortByNearest && <span className="text-emerald-600 ml-2">· sorted by nearest</span>}
            </p>

            {viewMode === 'split' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* Left — scrollable list */}
                <div className="lg:col-span-7 space-y-3 max-h-[800px] overflow-y-auto pr-1">
                  <AnimatePresence>
                    {filteredBanks.map((bank) => {
                      const cat = CATEGORY_LABEL[bank.category] ?? CATEGORY_LABEL.private;
                      const isSelected = bank.id === selectedBank?.id;
                      return (
                        <motion.div
                          key={bank.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setSelectedBankId(bank.id)}
                          className={`bg-white border rounded-xl p-5 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-blood-400 ring-2 ring-blood-100 shadow-md'
                              : 'border-gray-200 hover:border-gray-300 shadow-sm'
                          }`}
                        >
                          {/* Row 1: badge + distance */}
                          <div className="flex items-center justify-between mb-3">
                            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${cat.color}`}>
                              {cat.label}
                            </span>
                            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                              <Navigation className="w-3 h-3" /> {bank.distanceKm} km
                            </span>
                          </div>

                          {/* Row 2: name + address */}
                          <div className="mb-3">
                            <h3 className="text-base font-semibold text-gray-900 leading-snug">{bank.name}</h3>
                            <p className="text-xs text-gray-500 mt-0.5 flex items-start gap-1">
                              <MapPin className="w-3.5 h-3.5 text-blood-500 shrink-0 mt-0.5" />
                              {bank.address}, {bank.city} — {bank.pincode}
                            </p>
                            {bank.operating_hours && (
                              <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {bank.operating_hours}
                              </p>
                            )}
                          </div>

                          {/* Row 3: stock pills */}
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {bank.stock.map((item, i) => (
                              <span
                                key={i}
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                                  selectedBloodType === item.blood_type
                                    ? 'bg-blood-600 text-white border-blood-600'
                                    : 'bg-gray-50 text-gray-700 border-gray-200'
                                }`}
                              >
                                {item.blood_type} · {item.available_units}u
                              </span>
                            ))}
                          </div>

                          {/* Row 4: actions */}
                          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                            <a
                              href={`tel:${bank.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-lg text-xs font-semibold transition"
                            >
                              <Phone className="w-3.5 h-3.5 text-emerald-500" /> Call
                            </a>
                            <a
                              href={bank.eraktkosh_url ?? ERAKTKOSH_BASE}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:border-blood-300 text-blood-600 rounded-lg text-xs font-semibold transition"
                            >
                              e-Raktkosh <ArrowUpRight className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onNavigate('request'); }}
                              className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-blood-600 hover:bg-blood-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-sm"
                            >
                              Request Blood <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Right — sticky map */}
                <div className="lg:col-span-5 sticky top-28 h-[760px] rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                  {selectedBank && (
                    <HospitalMap
                      hospitalLat={selectedBank.latitude}
                      hospitalLng={selectedBank.longitude}
                      hospitalName={selectedBank.name}
                      donorLat={userLoc.lat}
                      donorLng={userLoc.lng}
                      distanceKm={selectedBank.distanceKm}
                    />
                  )}
                </div>
              </div>
            ) : (
              /* Grid Mode */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBanks.map((bank) => {
                  const cat = CATEGORY_LABEL[bank.category] ?? CATEGORY_LABEL.private;
                  return (
                    <div
                      key={bank.id}
                      className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-md transition shadow-sm flex flex-col"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${cat.color}`}>
                          {cat.label}
                        </span>
                        <span className="text-xs text-emerald-600 font-semibold">📍 {bank.distanceKm} km</span>
                      </div>

                      <h3 className="text-sm font-semibold text-gray-900 mb-1 leading-snug">{bank.name}</h3>
                      <p className="text-xs text-gray-500 mb-3">{bank.city} · {bank.pincode}</p>

                      <div className="flex flex-wrap gap-1 mb-4">
                        {bank.stock.map((s, i) => (
                          <span key={i} className="text-[11px] px-2 py-0.5 bg-gray-50 border border-gray-200 rounded-md text-gray-700 font-medium">
                            {s.blood_type} <span className="text-blood-600 font-semibold">{s.available_units}u</span>
                          </span>
                        ))}
                      </div>

                      <div className="mt-auto pt-3 border-t border-gray-100 flex gap-2">
                        <a
                          href={`tel:${bank.phone}`}
                          className="flex-1 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-lg text-xs font-semibold text-center transition"
                        >
                          Call
                        </a>
                        <a
                          href={bank.eraktkosh_url ?? ERAKTKOSH_BASE}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2 bg-white border border-gray-200 hover:border-blood-300 text-blood-600 rounded-lg text-xs font-semibold text-center transition"
                        >
                          e-Raktkosh ↗
                        </a>
                        <button
                          type="button"
                          onClick={() => onNavigate('request')}
                          className="flex-1 py-2 bg-blood-600 hover:bg-blood-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          Request
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            TAB 2 — VOLUNTARY DONATION CAMPS
        ───────────────────────────────────────────────────────────────────── */}
        {activeTab === 'camps' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCamps.map((camp) => (
              <motion.div
                key={camp.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-md transition shadow-sm"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                    Voluntary Drive
                  </span>
                  <span className="text-xs text-emerald-600 font-semibold">📍 {camp.distanceKm} km</span>
                </div>

                <h3 className="text-base font-semibold text-gray-900 mb-3 leading-snug">{camp.title}</h3>

                <div className="space-y-1.5 text-xs text-gray-500 mb-4">
                  <p className="flex items-center gap-2 font-medium text-gray-700">
                    <Calendar className="w-3.5 h-3.5 text-blood-500" />
                    {camp.camp_date} · {camp.start_time} – {camp.end_time}
                  </p>
                  <p className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-blood-500 shrink-0 mt-0.5" />
                    {camp.venue_address}, {camp.city} ({camp.pincode})
                  </p>
                  <p className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    {camp.organizer_name}
                  </p>
                </div>

                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <a
                    href={`tel:${camp.contact_number}`}
                    className="flex-1 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-lg text-xs font-semibold text-center flex items-center justify-center gap-1.5 transition"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-500" /> Contact
                  </a>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(camp.venue_address + ', ' + camp.city)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 bg-blood-600 hover:bg-blood-700 text-white rounded-lg text-xs font-semibold text-center flex items-center justify-center gap-1.5 transition shadow-sm"
                  >
                    Directions <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
