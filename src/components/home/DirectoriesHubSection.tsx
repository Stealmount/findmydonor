import React from 'react';
import { Building2, Activity, Calendar, ArrowRight, MapPin } from 'lucide-react';
import { INITIAL_BLOOD_BANKS, INITIAL_VOLUNTARY_CAMPS } from '../../data/bloodBankData';

interface DirectoriesHubSectionProps {
 onNavigate: (view: any) => void;
}

export function DirectoriesHubSection({ onNavigate }: DirectoriesHubSectionProps) {
 return (
 <section className="relative py-20 bg-gray-50 border-y border-gray-200">
 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">

 {/* Header */}
 <div className="text-center max-w-2xl mx-auto space-y-3">
 <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
 Powered by e-Raktkosh · National Blood Transfusion Council
 </p>
 <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
 Access 3,500+ Verified Blood Banks & Live Stock
 </h2>
 <p className="text-sm text-gray-500 leading-relaxed">
 Real-time government and private blood bank inventory, live stock levels, and upcoming voluntary donation drives across India.
 </p>
 </div>

 {/* 3 Cards */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

 {/* Card 1 — Blood Bank Directory */}
 <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-gray-300 transition flex flex-col gap-5">
 <div>
 <div className="h-10 w-10 rounded-lg bg-blood-50 border border-blood-100 grid place-items-center mb-4">
 <Building2 className="w-5 h-5 text-blood-600" />
 </div>
 <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600 mb-1">Live Inventory</p>
 <h3 className="text-base font-semibold text-gray-900">Blood Bank Directory</h3>
 <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
 Search government hospitals, Red Cross centers, and private banks by city or pincode.
 </p>
 </div>

 {/* Preview rows */}
 <div className="space-y-2 border-t border-gray-100 pt-3">
 {INITIAL_BLOOD_BANKS.slice(0, 2).map((bank) => (
 <div key={bank.id} className="text-xs text-gray-700 flex items-center justify-between bg-gray-50 border border-gray-100 px-3 py-2 rounded-lg">
 <span className="truncate font-medium max-w-[160px]">{bank.name}</span>
 <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full ml-2 shrink-0">
 O+: {bank.stock.find((s) => s.blood_type === 'O+')?.available_units ?? 0}u
 </span>
 </div>
 ))}
 </div>

 <button
 type="button"
 onClick={() => onNavigate('blood-banks')}
 className="mt-auto w-full py-2.5 px-4 bg-blood-600 hover:bg-blood-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
>
 Explore Blood Banks <ArrowRight className="w-3.5 h-3.5" />
 </button>
 </div>

 {/* Card 2 — Live Stock Availability */}
 <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-gray-300 transition flex flex-col gap-5">
 <div>
 <div className="h-10 w-10 rounded-lg bg-blue-50 border border-blue-100 grid place-items-center mb-4">
 <Activity className="w-5 h-5 text-blue-600" />
 </div>
 <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-600 mb-1">Component Breakdown</p>
 <h3 className="text-base font-semibold text-gray-900">Live Stock Availability</h3>
 <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
 Filter by Whole Blood, Platelets (SDP), PRBC Red Cells, or FFP Plasma across all centres.
 </p>
 </div>

 <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
 {[
 { label: 'Whole Blood', sub: 'All groups live' },
 { label: 'Platelets', sub: 'SDP available' },
 { label: 'PRBC', sub: 'Packed red cells' },
 { label: 'FFP Plasma', sub: 'Fresh frozen' },
 ].map((item) => (
 <div key={item.label} className="bg-gray-50 border border-gray-100 rounded-lg p-2.5 text-center">
 <div className="text-xs font-semibold text-gray-800">{item.label}</div>
 <div className="text-[10px] text-gray-400 mt-0.5">{item.sub}</div>
 </div>
 ))}
 </div>

 <button
 type="button"
 onClick={() => onNavigate('blood-banks')}
 className="mt-auto w-full py-2.5 px-4 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
>
 Check Group Stock <ArrowRight className="w-3.5 h-3.5" />
 </button>
 </div>

 {/* Card 3 — Voluntary Camps */}
 <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-gray-300 transition flex flex-col gap-5">
 <div>
 <div className="h-10 w-10 rounded-lg bg-amber-50 border border-amber-100 grid place-items-center mb-4">
 <Calendar className="w-5 h-5 text-amber-600" />
 </div>
 <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 mb-1">Community Drives</p>
 <h3 className="text-base font-semibold text-gray-900">Voluntary Donation Camps</h3>
 <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
 Upcoming blood donation drives by Red Cross, Rotary Club, and Lions Club near you.
 </p>
 </div>

 {/* Preview rows */}
 <div className="space-y-2 border-t border-gray-100 pt-3">
 {INITIAL_VOLUNTARY_CAMPS.slice(0, 2).map((camp) => (
 <div key={camp.id} className="bg-gray-50 border border-gray-100 px-3 py-2 rounded-lg space-y-0.5">
 <div className="text-xs font-medium text-gray-800 truncate">{camp.title}</div>
 <div className="text-[11px] text-gray-400 flex items-center gap-1">
 <MapPin className="w-3 h-3 text-blood-500" /> {camp.city} · {camp.camp_date}
 </div>
 </div>
 ))}
 </div>

 <button
 type="button"
 onClick={() => onNavigate('blood-banks')}
 className="mt-auto w-full py-2.5 px-4 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
>
 Find Donation Camps <ArrowRight className="w-3.5 h-3.5" />
 </button>
 </div>

 </div>
 </div>
 </section>
 );
}
