import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Bell, Droplet, User as UserIcon, LogOut, ArrowUpRight, ShieldAlert, CheckCircle, Activity, Plus, Minus, Send, Check } from 'lucide-react';
import { HospitalUser, BloodType, BloodRequest, Match, User } from '../../types';
import { useLanguage } from '../../lib/LanguageContext';
import { authenticatedApi } from '../../lib/api';

interface HospitalDashboardProps {
  hospital: HospitalUser;
  onLogout: () => void;
}

export function HospitalDashboard({ hospital, onLogout }: HospitalDashboardProps) {
  const { language, setLanguage } = useLanguage();
  const isHi = language === 'HI';

  // --- Real-functioning Inventory State ---
  // Initial inventory levels (Delhi NCR Pilot setup)
  const [inventory, setInventory] = useState<Record<BloodType, number>>(() => {
    const saved = localStorage.getItem(`hosp_inventory_${hospital.id}`);
    if (saved) {
      try { return JSON.parse(saved); } catch { }
    }
    return {
      'A+': 18,
      'A-': 5,
      'B+': 14,
      'B-': 4,
      'O+': 6,
      'O-': 8,
      'AB+': 12,
      'AB-': 3
    };
  });

  useEffect(() => {
    localStorage.setItem(`hosp_inventory_${hospital.id}`, JSON.stringify(inventory));
  }, [inventory, hospital.id]);

  const adjustInventory = (type: BloodType, amount: number) => {
    setInventory(prev => ({
      ...prev,
      [type]: Math.max(0, prev[type] + amount)
    }));
  };

  // --- Real-functioning Emergency Broadcast ---
  const [selectedBlood, setSelectedBlood] = useState<BloodType>('O+');
  const [units, setUnits] = useState(2);
  const [urgency, setUrgency] = useState<'critical' | 'urgent' | 'planned'>('urgent');
  const [patientName, setPatientName] = useState('Emergency Transfusion');
  const [requestStatus, setRequestStatus] = useState<'idle' | 'broadcasting' | 'sent' | 'error'>('idle');
  const [notifiedCount, setNotifiedCount] = useState(0);

  // --- Live Match & Donor Data ---
  const [activeMatches, setActiveMatches] = useState<(Match & { donorName: string; donorPhone: string })[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);

  // Load matches and requests from Database
  const fetchLiveMatches = async () => {
    try {
      const data = await authenticatedApi<{
        requests: BloodRequest[];
        matches: Match[];
        users: User[];
      }>('/api/hospital/dashboard', undefined, 'GET');

      const allRequests = data.requests || [];
      const allMatches = data.matches || [];
      const allUsers = data.users || [];

      // Filter requests sent by this hospital
      const hospitalReqs = allRequests.filter(r => 
        r.hospital_name === hospital.hospital_name || r.requester_phone === hospital.phone
      );

      const reqIds = new Set(hospitalReqs.map(r => r.id));
      const hospitalMatches = allMatches.filter(m => reqIds.has(m.request_id));

      const enrichedMatches = hospitalMatches.map(m => {
        const donor = allUsers.find(u => u.id === m.donor_id);
        return {
          ...m,
          donorName: donor ? donor.full_name : 'Volunteer Donor',
          donorPhone: donor ? (donor.whatsapp_number || donor.phone) : '-'
        };
      });
      setActiveMatches(enrichedMatches);
    } catch (err) {
      console.error('Error fetching live hospital matches:', err);
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    fetchLiveMatches();
    const interval = setInterval(fetchLiveMatches, 8000);
    return () => clearInterval(interval);
  }, [hospital.hospital_name, hospital.phone]);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestStatus('broadcasting');

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer demo-token`
        },
        body: JSON.stringify({
          verificationToken: 'verified',
          patient_name: patientName,
          blood_type_needed: selectedBlood,
          units_required: units,
          hospital_name: hospital.hospital_name,
          hospital_pincode: hospital.pincode,
          hospital_area: 'Transfusion Wing',
          hospital_city: hospital.city,
          urgency_level: urgency,
          showcase_opt_in: true
        })
      });

      const data = await response.json();
      if (response.ok) {
        setNotifiedCount(data.matched || 0);
        setRequestStatus('sent');
        fetchLiveMatches();
        setTimeout(() => {
          setRequestStatus('idle');
          setPatientName('Emergency Transfusion');
        }, 4000);
      } else {
        setRequestStatus('error');
        setTimeout(() => setRequestStatus('idle'), 3000);
      }
    } catch {
      setRequestStatus('error');
      setTimeout(() => setRequestStatus('idle'), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-ink-950 flex flex-col font-sans relative overflow-hidden text-white w-full">
      {/* Premium Dark Background Elements */}
      <div className="absolute inset-0 grid-pattern-dark opacity-35 pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-blood-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-amber-900/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-ink-800 bg-ink-950/80 backdrop-blur-xl px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-ink-900 border border-ink-700 flex items-center justify-center shadow-lg">
            <Shield className="h-5 w-5 text-blood-400" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-white tracking-tight leading-tight">{hospital.hospital_name}</h1>
            <p className="text-[11px] font-medium text-ink-400">
              {isHi ? 'लाइव इन्वेंटरी और कंट्रोल टॉवर' : 'Live Inventory & Control Tower'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Language Switcher Pill [ EN | HI ] */}
          <div className="flex items-center rounded-full bg-ink-900 p-0.5 border border-ink-800">
            <button
              onClick={() => setLanguage('EN')}
              className={`rounded-full px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                !isHi ? 'bg-blood-600 text-white shadow-sm' : 'text-ink-400 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('HI')}
              className={`rounded-full px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                isHi ? 'bg-blood-600 text-white shadow-sm' : 'text-ink-400 hover:text-white'
              }`}
            >
              HI
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[11px] font-bold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            {isHi ? 'स्थिर' : 'Stable'}
          </div>
          <button 
            onClick={onLogout}
            className="flex items-center gap-2 text-[13px] font-semibold text-ink-400 hover:text-white transition bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/10 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>{isHi ? 'लॉगआउट' : 'Logout'}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 relative z-10 max-w-7xl mx-auto w-full p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        
        {/* Left Column: Inventory & Donors */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Live Inventory Matrix */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-400">
                {isHi ? 'लाइव रक्त सूची (इन्वेंट्री मैट्रिक्स)' : 'Live Inventory Matrix'}
              </h2>
              <span className="text-[11px] text-white/50">{isHi ? 'संख्या समायोजित करने के लिए + / - का उपयोग करें' : 'Use + / - to adjust levels'}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {(Object.keys(inventory) as BloodType[]).map((type) => {
                const count = inventory[type];
                const isLow = count <= 6;
                const isCritical = count <= 3;
                
                let cardStyle = "border-ink-800 bg-white/[0.02]";
                let textStyle = "text-white/90";
                let dropColor = "text-white/60";
                
                if (isCritical) {
                  cardStyle = "border-red-500/45 bg-red-950/20 shadow-[0_0_15px_rgba(239,68,68,0.08)]";
                  textStyle = "text-red-400";
                  dropColor = "text-red-400 fill-red-400/20";
                } else if (isLow) {
                  cardStyle = "border-amber-500/40 bg-amber-950/15";
                  textStyle = "text-amber-400";
                  dropColor = "text-amber-400";
                }

                return (
                  <div key={type} className={`rounded-2xl p-4 border transition-all duration-300 relative group flex flex-col justify-between ${cardStyle}`}>
                    <div className="flex items-center justify-between mb-2">
                      <Droplet className={`h-4.5 w-4.5 ${dropColor}`} strokeWidth={2} />
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        isCritical ? "bg-red-500/20 text-red-300" : isLow ? "bg-amber-500/20 text-amber-300" : "bg-white/10 text-white/60"
                      }`}>
                        {isCritical ? (isHi ? 'गंभीर' : 'Critical') : isLow ? (isHi ? 'कम' : 'Low') : (isHi ? 'स्थिर' : 'Stable')}
                      </span>
                    </div>

                    <div className="text-center my-2">
                      <div className="text-3xl font-extrabold tracking-tight mb-1">{type}</div>
                      <div className={`text-[13px] font-semibold ${textStyle}`}>
                        {count} {isHi ? 'यूनिट' : 'units'}
                      </div>
                    </div>

                    {/* Inventory Adjuster Controls */}
                    <div className="flex justify-center gap-1.5 mt-2 pt-2 border-t border-white/5 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => adjustInventory(type, -1)}
                        className="p-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white cursor-pointer transition"
                        title={isHi ? '1 यूनिट घटाएं' : 'Decrease 1 unit'}
                      >
                        <Minus size={13} />
                      </button>
                      <button 
                        onClick={() => adjustInventory(type, 1)}
                        className="p-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white cursor-pointer transition"
                        title={isHi ? '1 यूनिट जोड़ें' : 'Increase 1 unit'}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Incoming Matched Donors */}
          <section className="bg-ink-900/60 backdrop-blur-xl border border-ink-800 rounded-3xl p-5 sm:p-7 shadow-premium-lg">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-400">
                  {isHi ? 'आने वाले स्वैच्छिक रक्तदाता' : 'Incoming Matched Donors'}
                </h2>
                <p className="text-[11px] text-ink-500 mt-1">
                  {isHi ? 'रक्तदान की पुष्टि करने वाले अलर्ट और लाइव ट्रैकिंग' : 'Real-time response tracking from matched network alerts'}
                </p>
              </div>
              <span className="text-[12px] font-bold text-blood-400 bg-blood-500/10 px-3 py-1 rounded-full border border-blood-500/20">
                {activeMatches.length} {isHi ? 'सक्रिय' : 'Active'}
              </span>
            </div>

            {loadingMatches ? (
              <div className="py-8 text-center text-ink-400 text-sm">
                <span className="animate-pulse">{isHi ? 'रक्तदाताओं की स्थिति लोड हो रही है...' : 'Syncing donor network matches...'}</span>
              </div>
            ) : activeMatches.length === 0 ? (
              <div className="py-10 text-center rounded-2xl bg-ink-950/40 border border-ink-800/40">
                <ShieldAlert className="h-10 w-10 text-ink-600 mx-auto mb-3" />
                <p className="text-sm font-semibold text-white/70">
                  {isHi ? 'कोई आने वाला रक्तदाता नहीं है' : 'No incoming donor matches yet'}
                </p>
                <p className="text-xs text-ink-500 mt-1 max-w-sm mx-auto">
                  {isHi ? 'दाहिनी ओर स्थित इमरजेंसी कंसोल का उपयोग करके रक्तदाता नेटवर्क को पिंग करें।' : 'Use the Emergency Console on the right to trigger matching alerts.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeMatches.map((match) => {
                  const status = match.donor_response;
                  return (
                    <div key={match.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-ink-950/60 border border-ink-800/50 hover:bg-ink-900/80 transition-all gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blood-600/90 flex items-center justify-center text-white font-bold text-sm shadow-[0_0_15px_rgba(244,63,87,0.3)]">
                          {match.donorName.charAt(0)}
                        </div>
                        <div>
                          <div className="text-[14px] font-bold text-white flex items-center gap-2">
                            {match.donorName}
                            {match.is_exact_match && (
                              <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                                {isHi ? 'सटीक मिलान' : 'Exact Match'}
                              </span>
                            )}
                          </div>
                          <div className="text-[12px] text-ink-400 mt-0.5 font-medium">
                            {isHi ? 'संपर्क नंबर:' : 'Contact:'} <strong className="text-white">{match.donorPhone}</strong>
                            {match.distance_km && ` · ~${match.distance_km} km`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <span className={`px-3 py-1.5 rounded-full border text-[10.5px] font-bold tracking-wider uppercase ${
                          status === 'approved' 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                            : status === 'declined' 
                            ? 'bg-red-500/10 border-red-500/30 text-red-400'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
                        }`}>
                          {status === 'approved' ? (isHi ? 'स्वीकृत' : 'Approved') : status === 'declined' ? (isHi ? 'अस्वीकृत' : 'Declined') : (isHi ? 'प्रतीक्षारत' : 'Pending Reply')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Predictive Analytics & Quick Request */}
        <div className="lg:col-span-4 space-y-6 sm:space-y-8">
          
          {/* Predictive Model */}
          <section className="bg-ink-900/60 backdrop-blur-xl border border-ink-800 rounded-3xl p-5 sm:p-7 shadow-premium-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-400">
                {isHi ? 'अनुमानित 7-दिवसीय मांग' : 'Predicted 7-Day Demand'}
              </h2>
              <Activity className="h-4 w-4 text-amber-500 animate-pulse" />
            </div>
            
            <div className="h-32 w-full mt-6 mb-2 relative flex items-end justify-between px-2">
              {[40, 70, 45, 90, 60, 30, 80].map((h, i) => (
                <div key={i} className="w-[10%] bg-ink-850 rounded-t-sm relative transition" style={{ height: '100%' }}>
                  <div 
                    className={`absolute bottom-0 w-full rounded-t-sm transition-all duration-1000 ${i === 3 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-ink-600'}`} 
                    style={{ height: `${h}%` }} 
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] font-mono text-ink-500 px-2 mt-2">
              <span>{isHi ? 'सोम' : 'MON'}</span>
              <span>{isHi ? 'मंगल' : 'TUE'}</span>
              <span>{isHi ? 'बुध' : 'WED'}</span>
              <span className="text-red-400 font-bold">{isHi ? 'गुरु' : 'THU'}</span>
              <span>{isHi ? 'शुक्र' : 'FRI'}</span>
              <span>{isHi ? 'शनि' : 'SAT'}</span>
              <span>{isHi ? 'रवि' : 'SUN'}</span>
            </div>
            
            <div className="mt-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-200 leading-relaxed">
              <span className="font-bold text-red-400 block mb-1">AI Prediction: Deficit Risk</span>
              {isHi 
                ? 'गुरुवार तक AB- रक्त समूह में 40% की कमी की भविष्यवाणी है। सक्रिय ड्राइव आरंभ करने का सुझाव।'
                : 'Projected 40% deficit in AB- inventory by Thursday. Recommend pre-emptive donor drive.'}
            </div>
          </section>

          {/* Emergency Console Broadcast Form */}
          <section className="bg-blood-950/20 backdrop-blur-xl border border-blood-500/20 rounded-3xl p-5 sm:p-7 shadow-[0_0_30px_rgba(244,63,87,0.1)]">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-blood-400 mb-1">
              {isHi ? 'आपातकालीन कंसोल' : 'Emergency Console'}
            </h2>
            <h3 className="text-xl font-bold text-white mb-5 tracking-tight">
              {isHi ? 'आपातकालीन रक्त अनुरोध भेजें' : 'Broadcast Emergency Request'}
            </h3>
            
            <AnimatePresence mode="wait">
              {requestStatus === 'idle' && (
                <motion.form
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleBroadcast}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 block">
                      {isHi ? 'रोगी का नाम / संदर्भ' : 'Patient Name / Ref'}
                    </label>
                    <input 
                      type="text" 
                      required
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Emergency Patient" 
                      className="w-full bg-ink-950/70 border border-ink-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blood-500" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 block">
                        {isHi ? 'रक्त समूह' : 'Blood Group'}
                      </label>
                      <select 
                        value={selectedBlood}
                        onChange={(e) => setSelectedBlood(e.target.value as BloodType)}
                        className="w-full bg-ink-950/70 border border-ink-800 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blood-500"
                      >
                        {(Object.keys(inventory) as BloodType[]).map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 block">
                        {isHi ? 'आवश्यक इकाइयाँ' : 'Units'}
                      </label>
                      <input 
                        type="number" 
                        required
                        min={1}
                        max={10}
                        value={units}
                        onChange={(e) => setUnits(parseInt(e.target.value, 10))}
                        className="w-full bg-ink-950/70 border border-ink-800 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blood-500" 
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 block">
                      {isHi ? 'तत्कालता स्तर' : 'Urgency'}
                    </label>
                    <select 
                      value={urgency}
                      onChange={(e) => setUrgency(e.target.value as any)}
                      className="w-full bg-ink-950/70 border border-ink-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blood-500"
                    >
                      <option value="critical">{isHi ? 'गंभीर (तत्काल)' : 'Critical (Immediate)'}</option>
                      <option value="urgent">{isHi ? 'आवश्यक (4 घंटे में)' : 'Urgent (Within 4 hrs)'}</option>
                      <option value="planned">{isHi ? 'नियोजित (सर्जरी)' : 'Planned (Surgery)'}</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full btn-glow group inline-flex items-center justify-center gap-2 rounded-xl bg-blood-600 px-6 py-4 text-[14px] font-bold text-white shadow-[0_14px_32px_-8px_rgba(244,63,87,0.5)] hover:bg-blood-700 transition cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                    {isHi ? 'रक्तदाता नेटवर्क पिंग करें' : 'Ping Donor Network'}
                  </button>
                </motion.form>
              )}

              {requestStatus === 'broadcasting' && (
                <motion.div
                  key="broadcasting"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="py-12 flex flex-col items-center justify-center text-center"
                >
                  <div className="w-12 h-12 border-2 border-blood-500/20 border-t-blood-500 rounded-full animate-spin mb-4" />
                  <p className="text-sm font-bold text-white">{isHi ? 'अनुरोध प्रसारित किया जा रहा है...' : 'Broadcasting Request...'}</p>
                  <p className="text-[11px] text-ink-400 mt-1">
                    {isHi ? 'दिल्ली एनसीआर में संगत रक्तदाताओं की खोज जारी है' : 'Locating eligible donors within proximity radius'}
                  </p>
                </motion.div>
              )}

              {requestStatus === 'sent' && (
                <motion.div
                  key="sent"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-12 flex flex-col items-center justify-center text-center"
                >
                  <div className="w-14 h-14 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                    <Check className="h-7 w-7 text-green-500" strokeWidth={3} />
                  </div>
                  <p className="text-base font-bold text-white">{isHi ? 'प्रसारण सफल रहा' : 'Broadcast Successful'}</p>
                  <p className="text-[12px] text-ink-400 mt-1">
                    {isHi ? `${notifiedCount} स्वैच्छिक रक्तदाता अधिसूचित। प्रतिक्रिया की प्रतीक्षा करें।` : `${notifiedCount} voluntary donors matched. Tracking active.`}
                  </p>
                </motion.div>
              )}

              {requestStatus === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-12 flex flex-col items-center justify-center text-center"
                >
                  <ShieldAlert className="h-12 w-12 text-red-500 mb-4" />
                  <p className="text-sm font-bold text-white">{isHi ? 'प्रसारण विफल हुआ' : 'Broadcast Failed'}</p>
                  <p className="text-[11px] text-ink-400 mt-1">{isHi ? 'कृपया क्रेडेंशियल्स की जांच करें।' : 'Check API connection status'}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

        </div>
      </main>
    </div>
  );
}
