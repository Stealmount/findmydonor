import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, MapPin, Phone, ExternalLink, Building2,
  Clock, Filter, Map as MapIcon, Grid, RefreshCw,
  Navigation, Calendar, ChevronDown, Compass, Check, ArrowUpRight, ChevronLeft, ChevronRight
} from 'lucide-react';
import { INDIAN_STATES_AND_UT, DISTRICTS_BY_STATE, ALL_INDIA_SEED_BLOOD_BANKS, ALL_INDIA_SEED_CAMPS } from '../data/allIndiaBloodBankSeed';
import { BloodBank, DonationCamp, BloodType, BloodComponent } from '../types';
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
  other:       { label: 'General',    color: 'bg-gray-50 text-gray-700 ring-1 ring-gray-200' }
};

const ERAKTKOSH_BASE = 'https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/findbloodbank.cnt';

export function BloodBankDirectory({ onNavigate }: BloodBankDirectoryProps) {
  const [activeTab, setActiveTab] = useState<'banks' | 'camps'>('banks');
  
  // Filtering states
  const [selectedState, setSelectedState] = useState<string>('ALL');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBloodType, setSelectedBloodType] = useState<BloodType | 'ALL'>('ALL');
  const [selectedComponent, setSelectedComponent] = useState<BloodComponent | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [sortByNearest, setSortByNearest] = useState(true);
  const [viewMode, setViewMode] = useState<'split' | 'grid'>('split');
  
  // Pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Data & loading states
  const [banks, setBanks] = useState<BloodBank[]>([]);
  const [camps, setCamps] = useState<DonationCamp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [isComponentOpen, setIsComponentOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isStateOpen, setIsStateOpen] = useState(false);
  const [isDistrictOpen, setIsDistrictOpen] = useState(false);
  const [userLoc, setUserLoc] = useState({ lat: 28.6139, lng: 77.2090, live: false });

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude, live: true }),
      () => {}
    );
  }, []);

  // Available districts based on selected state
  const availableDistricts = useMemo(() => {
    if (selectedState === 'ALL' || !DISTRICTS_BY_STATE[selectedState]) return [];
    return DISTRICTS_BY_STATE[selectedState];
  }, [selectedState]);

  // Reset district and page when state changes
  const handleStateChange = (stateName: string) => {
    setSelectedState(stateName);
    setSelectedDistrict('ALL');
    setPage(1);
    setIsStateOpen(false);
  };

  const handleDistrictChange = (distName: string) => {
    setSelectedDistrict(distName);
    setPage(1);
    setIsDistrictOpen(false);
  };

  // Fetch Blood Banks or Camps from backend API
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const endpoint = activeTab === 'banks' ? '/api/blood-banks' : '/api/camps';
    const params = new URLSearchParams();
    if (selectedState !== 'ALL') params.append('state', selectedState);
    if (selectedDistrict !== 'ALL') params.append('district', selectedDistrict);
    if (searchQuery.trim()) params.append('q', searchQuery.trim());
    if (activeTab === 'banks') {
      if (selectedCategory !== 'ALL') params.append('category', selectedCategory);
      if (selectedBloodType !== 'ALL') params.append('blood_type', selectedBloodType);
      if (selectedComponent !== 'ALL') params.append('component', selectedComponent);
      if (sortByNearest && userLoc.live) {
        params.append('sort', 'nearest');
        params.append('lat', String(userLoc.lat));
        params.append('lng', String(userLoc.lng));
      }
    }
    params.append('page', String(page));
    params.append('limit', String(limit));

    fetch(`${endpoint}?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data.success) {
          if (activeTab === 'banks') {
            setBanks(data.blood_banks || []);
            setTotalRecords(data.total || data.count || 0);
            setTotalPages(data.total_pages || 1);
            if (data.blood_banks?.[0]?.id) setSelectedBankId(data.blood_banks[0].id);
          } else {
            setCamps(data.camps || []);
            setTotalRecords(data.total || data.count || 0);
            setTotalPages(data.total_pages || 1);
          }
        } else {
          throw new Error(data.error || 'Failed to load directory');
        }
      })
      .catch(err => {
        if (!isMounted) return;
        console.warn('[Directory UI] API fetch fallback to local seed data:', err.message);
        // Fallback to local master seed
        if (activeTab === 'banks') {
          setBanks(ALL_INDIA_SEED_BLOOD_BANKS);
          setTotalRecords(ALL_INDIA_SEED_BLOOD_BANKS.length);
          setTotalPages(1);
        } else {
          setCamps(ALL_INDIA_SEED_CAMPS);
          setTotalRecords(ALL_INDIA_SEED_CAMPS.length);
          setTotalPages(1);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [activeTab, selectedState, selectedDistrict, searchQuery, selectedCategory, selectedBloodType, selectedComponent, sortByNearest, userLoc, page, limit]);

  const bloodTypes: (BloodType | 'ALL')[] = ['ALL', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

  // Distance computation for current page items
  const processedBanks = useMemo(() => {
    return banks.map((b) => ({
      ...b,
      distanceKm: (b.latitude && b.longitude)
        ? haversineKm(userLoc.lat, userLoc.lng, b.latitude, b.longitude)
        : 12.5,
    }));
  }, [banks, userLoc]);

  const processedCamps = useMemo(() => {
    return camps.map((c) => ({
      ...c,
      distanceKm: (c.latitude && c.longitude)
        ? haversineKm(userLoc.lat, userLoc.lng, c.latitude, c.longitude)
        : 10.0,
    }));
  }, [camps, userLoc]);

  const selectedBank = processedBanks.find((b) => b.id === selectedBankId) ?? processedBanks[0] ?? null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pt-24 pb-20 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Page Header ────────────────────────────────────────────────────── */}
        <div className="pt-2 pb-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blood-600 mb-1 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Synchronized with e-RaktKosh · National Blood Transfusion Council (NBTC)
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                All India Blood Banks & Donation Camps Directory
              </h1>
              <p className="mt-1 text-sm text-gray-500 max-w-2xl">
                Nationwide real-time directory covering 3,500+ verified blood centers and voluntary drives across 36 States/UTs.
              </p>
            </div>
            <a
              href={ERAKTKOSH_BASE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blood-600 hover:text-blood-700 underline underline-offset-2 transition"
            >
              e-RaktKosh Portal <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* ── Primary Tab Switcher ───────────────────────────────────────────── */}
        <div className="flex gap-0 border-b border-gray-200">
          {[
            { key: 'banks' as const, label: `Blood Banks (${activeTab === 'banks' ? totalRecords : 'All India'})`, icon: Building2 },
            { key: 'camps' as const, label: `Donation Camps (${activeTab === 'camps' ? totalRecords : 'Voluntary Drives'})`, icon: Calendar },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setActiveTab(key); setPage(1); }}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
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

        {/* ── Filter & Search Control Panel ─────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by city, pincode, hospital or bank name…"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blood-500/30 focus:border-blood-500 transition bg-white"
              />
            </div>

            {/* State Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setIsStateOpen(!isStateOpen); setIsDistrictOpen(false); setIsComponentOpen(false); setIsCategoryOpen(false); }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white border border-gray-200 hover:border-gray-300 rounded-xl text-xs font-semibold text-gray-800 cursor-pointer transition"
              >
                <span className="truncate">State: <strong className="text-blood-600">{selectedState}</strong></span>
                <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
              </button>
              {isStateOpen && (
                <div className="absolute top-12 left-0 right-0 max-h-60 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => handleStateChange('ALL')}
                    className={`w-full text-left px-4 py-2 text-xs font-medium flex items-center justify-between ${
                      selectedState === 'ALL' ? 'bg-blood-50 text-blood-700 font-bold' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    All States & Union Territories
                    {selectedState === 'ALL' && <Check className="w-3.5 h-3.5 text-blood-600" />}
                  </button>
                  {INDIAN_STATES_AND_UT.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleStateChange(s)}
                      className={`w-full text-left px-4 py-2 text-xs font-medium flex items-center justify-between ${
                        selectedState === s ? 'bg-blood-50 text-blood-700 font-bold' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {s}
                      {selectedState === s && <Check className="w-3.5 h-3.5 text-blood-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* District Dropdown */}
            <div className="relative">
              <button
                type="button"
                disabled={selectedState === 'ALL' || availableDistricts.length === 0}
                onClick={() => { setIsDistrictOpen(!isDistrictOpen); setIsStateOpen(false); setIsComponentOpen(false); setIsCategoryOpen(false); }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 transition ${
                  selectedState === 'ALL' ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:border-gray-300 cursor-pointer'
                }`}
              >
                <span className="truncate">District: <strong className="text-blood-600">{selectedDistrict}</strong></span>
                <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
              </button>
              {isDistrictOpen && (
                <div className="absolute top-12 left-0 right-0 max-h-60 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => handleDistrictChange('ALL')}
                    className={`w-full text-left px-4 py-2 text-xs font-medium flex items-center justify-between ${
                      selectedDistrict === 'ALL' ? 'bg-blood-50 text-blood-700 font-bold' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    All Districts in {selectedState}
                    {selectedDistrict === 'ALL' && <Check className="w-3.5 h-3.5 text-blood-600" />}
                  </button>
                  {availableDistricts.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleDistrictChange(d)}
                      className={`w-full text-left px-4 py-2 text-xs font-medium flex items-center justify-between ${
                        selectedDistrict === d ? 'bg-blood-50 text-blood-700 font-bold' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {d}
                      {selectedDistrict === d && <Check className="w-3.5 h-3.5 text-blood-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Secondary filter strip for Banks */}
          {activeTab === 'banks' && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mr-1">Group:</span>
                  {bloodTypes.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setSelectedBloodType(t); setPage(1); }}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition cursor-pointer ${
                        selectedBloodType === t
                          ? 'bg-blood-600 text-white border-blood-600 shadow-sm'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {t === 'ALL' ? 'All' : t}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  {/* Category Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => { setIsCategoryOpen(!isCategoryOpen); setIsComponentOpen(false); setIsStateOpen(false); setIsDistrictOpen(false); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:border-gray-300 rounded-lg text-xs font-semibold text-gray-700 cursor-pointer transition"
                    >
                      Category: <strong className="text-blood-600">{selectedCategory === 'ALL' ? 'All' : selectedCategory}</strong>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    {isCategoryOpen && (
                      <div className="absolute right-0 top-9 w-44 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                        {[
                          { label: 'All Categories', value: 'ALL' },
                          { label: 'Government', value: 'government' },
                          { label: 'Red Cross', value: 'red_cross' },
                          { label: 'Private', value: 'private' },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => { setSelectedCategory(opt.value); setIsCategoryOpen(false); setPage(1); }}
                            className="w-full text-left px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                          >
                            {opt.label}
                            {selectedCategory === opt.value && <Check className="w-3.5 h-3.5 text-blood-600" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Component Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => { setIsComponentOpen(!isComponentOpen); setIsCategoryOpen(false); setIsStateOpen(false); setIsDistrictOpen(false); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:border-gray-300 rounded-lg text-xs font-semibold text-gray-700 cursor-pointer transition"
                    >
                      Component: <strong className="text-blood-600">{selectedComponent === 'ALL' ? 'All' : selectedComponent.replace('_', ' ').toUpperCase()}</strong>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    {isComponentOpen && (
                      <div className="absolute right-0 top-9 w-52 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                        {[
                          { label: 'All Components', value: 'ALL' },
                          { label: 'Whole Blood', value: 'whole_blood' },
                          { label: 'PRBC', value: 'prbc' },
                          { label: 'Platelets (SDP)', value: 'platelets_sdp' },
                          { label: 'FFP', value: 'ffp' },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => { setSelectedComponent(opt.value as any); setIsComponentOpen(false); setPage(1); }}
                            className="w-full text-left px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                          >
                            {opt.label}
                            {selectedComponent === opt.value && <Check className="w-3.5 h-3.5 text-blood-600" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* View Mode Toggle */}
                  <div className="flex bg-gray-100 border border-gray-200 rounded-lg p-0.5 ml-1">
                    {[
                      { key: 'split' as const, label: 'Map', icon: MapIcon },
                      { key: 'grid' as const, label: 'Grid', icon: Grid },
                    ].map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setViewMode(key)}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                          viewMode === key ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" /> {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Status & Pagination Header Bar ───────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
            {loading ? (
              <span className="flex items-center gap-1.5 text-blood-600">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Fetching e-RaktKosh live directory…
              </span>
            ) : (
              <span>
                Showing <strong className="text-gray-900">{totalRecords > 0 ? (page - 1) * limit + 1 : 0}</strong>–<strong className="text-gray-900">{Math.min(page * limit, totalRecords)}</strong> of <strong className="text-gray-900">{totalRecords}</strong> {activeTab === 'banks' ? 'Blood Banks' : 'Camps'}
              </span>
            )}
          </div>

          {/* Pagination buttons */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Previous Page"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-gray-700">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Next Page"
                aria-label="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            TAB 1 — BLOOD BANKS
        ───────────────────────────────────────────────────────────────────── */}
        {activeTab === 'banks' && (
          <>
            {viewMode === 'split' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left — scrollable list */}
                <div className="lg:col-span-7 space-y-3 max-h-[800px] overflow-y-auto pr-1">
                  <AnimatePresence>
                    {processedBanks.map((bank) => {
                      const cat = CATEGORY_LABEL[bank.category] ?? CATEGORY_LABEL.other;
                      const isSelected = bank.id === selectedBank?.id;
                      return (
                        <motion.div
                          key={bank.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setSelectedBankId(bank.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedBankId(bank.id);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-pressed={isSelected}
                          className={`bg-white border rounded-2xl p-5 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-blood-500 ring-2 ring-blood-100 shadow-md'
                              : 'border-gray-200 hover:border-gray-300 shadow-sm'
                          }`}
                        >
                          {/* Row 1: category badge + distance */}
                          <div className="flex items-center justify-between mb-2.5">
                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${cat.color}`}>
                              {cat.label}
                            </span>
                            <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                              <Navigation className="w-3 h-3" /> {bank.distanceKm} km
                            </span>
                          </div>

                          {/* Row 2: name + address */}
                          <div className="mb-3">
                            <h3 className="text-base font-extrabold text-gray-900 leading-snug">{bank.name}</h3>
                            <p className="text-xs text-gray-500 mt-1 flex items-start gap-1">
                              <MapPin className="w-3.5 h-3.5 text-blood-500 shrink-0 mt-0.5" />
                              {bank.address}, {bank.city}, {bank.district}, {bank.state} — {bank.pincode}
                            </p>
                            {bank.operating_hours && (
                              <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-gray-400" /> {bank.operating_hours}
                              </p>
                            )}
                          </div>

                          {/* Row 3: stock pills */}
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {Array.isArray(bank.stock) && bank.stock.map((item, i) => (
                              <span
                                key={i}
                                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                                  selectedBloodType === item.blood_type
                                    ? 'bg-blood-600 text-white border-blood-600'
                                    : 'bg-gray-50 text-gray-700 border-gray-200'
                                }`}
                              >
                                {item.blood_type} · <span className={selectedBloodType === item.blood_type ? 'text-white' : 'text-blood-600'}>{item.available_units}u</span>
                              </span>
                            ))}
                          </div>

                          {/* Row 4: actions */}
                          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                            {bank.phone && (
                              <a
                                href={`tel:${bank.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-xl text-xs font-semibold transition"
                              >
                                <Phone className="w-3.5 h-3.5 text-emerald-500" /> Call
                              </a>
                            )}
                            <a
                              href={bank.eraktkosh_url ?? ERAKTKOSH_BASE}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:border-blood-300 text-blood-600 rounded-xl text-xs font-semibold transition"
                            >
                              e-RaktKosh <ArrowUpRight className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onNavigate('request'); }}
                              className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-blood-600 hover:bg-blood-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
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
                <div className="lg:col-span-5 sticky top-28 h-[760px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
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
                {processedBanks.map((bank) => {
                  const cat = CATEGORY_LABEL[bank.category] ?? CATEGORY_LABEL.other;
                  return (
                    <div
                      key={bank.id}
                      className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-gray-300 hover:shadow-md transition shadow-sm flex flex-col"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${cat.color}`}>
                          {cat.label}
                        </span>
                        <span className="text-xs text-emerald-600 font-bold">📍 {bank.distanceKm} km</span>
                      </div>

                      <h3 className="text-base font-extrabold text-gray-900 mb-1 leading-snug">{bank.name}</h3>
                      <p className="text-xs text-gray-500 mb-3">{bank.city}, {bank.state} · {bank.pincode}</p>

                      <div className="flex flex-wrap gap-1 mb-4">
                        {Array.isArray(bank.stock) && bank.stock.map((s, i) => (
                          <span key={i} className="text-[11px] px-2 py-0.5 bg-gray-50 border border-gray-200 rounded-md text-gray-700 font-semibold">
                            {s.blood_type} <span className="text-blood-600">{s.available_units}u</span>
                          </span>
                        ))}
                      </div>

                      <div className="mt-auto pt-3 border-t border-gray-100 flex gap-2">
                        {bank.phone && (
                          <a
                            href={`tel:${bank.phone}`}
                            className="flex-1 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-xl text-xs font-semibold text-center transition"
                          >
                            Call
                          </a>
                        )}
                        <a
                          href={bank.eraktkosh_url ?? ERAKTKOSH_BASE}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2 bg-white border border-gray-200 hover:border-blood-300 text-blood-600 rounded-xl text-xs font-semibold text-center transition"
                        >
                          e-RaktKosh ↗
                        </a>
                        <button
                          type="button"
                          onClick={() => onNavigate('request')}
                          className="flex-1 py-2 bg-blood-600 hover:bg-blood-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
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
            {processedCamps.map((camp) => (
              <motion.div
                key={camp.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-gray-300 hover:shadow-md transition shadow-sm"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                    Voluntary Drive
                  </span>
                  <span className="text-xs text-emerald-600 font-bold">📍 {camp.distanceKm} km</span>
                </div>

                <h3 className="text-base font-extrabold text-gray-900 mb-3 leading-snug">{camp.title}</h3>

                <div className="space-y-1.5 text-xs text-gray-600 mb-4">
                  <p className="flex items-center gap-2 font-bold text-gray-800">
                    <Calendar className="w-3.5 h-3.5 text-blood-500" />
                    {camp.camp_date} · {camp.start_time} – {camp.end_time}
                  </p>
                  <p className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-blood-500 shrink-0 mt-0.5" />
                    {camp.venue_address}, {camp.city}, {camp.state} ({camp.pincode})
                  </p>
                  <p className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    Organized by: {camp.organizer_name}
                  </p>
                </div>

                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  {camp.contact_phone && (
                    <a
                      href={`tel:${camp.contact_phone}`}
                      className="flex-1 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-xl text-xs font-semibold text-center flex items-center justify-center gap-1.5 transition"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-500" /> Contact
                    </a>
                  )}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(camp.venue_address + ', ' + camp.city)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 bg-blood-600 hover:bg-blood-700 text-white rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5 transition shadow-xs"
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
