import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { BloodRequest, Match, User } from '../types';
import { authenticatedApi } from '../lib/api';
import { useLanguage } from '../lib/LanguageContext';
import { getCoordinates } from '../data/pincode_coords';
import HospitalMap from './HospitalMap';
import { 
  CheckCircle, 
  Clock, 
  MapPin, 
  AlertTriangle, 
  Phone, 
  MessageSquare, 
  Users, 
  XCircle,
  Search,
  ShieldCheck,
  Heart
} from 'lucide-react';

interface RequestTrackingProps {
  initialCode?: string;
  onStateChange?: () => void;
}

export default function RequestTracking({ initialCode = '', onStateChange }: RequestTrackingProps) {
  const { language } = useLanguage();
  const isHi = language === 'HI';
  const [searchCode, setSearchCode] = useState(initialCode);
  const [request, setRequest] = useState<BloodRequest | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [donors, setDonors] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (codeToSearch: string) => {
    if (!codeToSearch) return;
    setLoading(true);
    setError('');
    setRequest(null);
    try {
      const response = await fetch(`/api/requests/${encodeURIComponent(codeToSearch.trim())}`);
      const data = await response.json().catch(() => ({}));
      
      if (!response.ok || !data.request) {
        setError(data.error || 'No active blood request found with this tracking code. Please verify the code and try again.');
        setLoading(false);
        return;
      }

      setRequest(data.request);
      setMatches(data.matches || []);
      setDonors(data.donors || []);
    } catch (err) {
      console.error(err);
      setError('An error occurred while fetching tracking details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      handleSearch(initialCode);
    }
  }, [initialCode]);

  const handleMarkAsFulfilled = async () => {
    if (!request) return;
    if (!window.confirm("Marking this request as fulfilled will close the search and send a confirmation to all approved donors. Proceed?")) return;

    try {
      const nowStr = new Date().toISOString();
      const updatedReq: BloodRequest = {
        ...request,
        status: 'fulfilled',
        fulfilled_at: nowStr,
      };
      await authenticatedApi(`/api/requests/${request.tracking_code}/fulfill`, {}, 'PATCH');
      setRequest(updatedReq);

      const approvedMatches = matches.filter(m => m.donor_response === 'approved');
      for (const m of approvedMatches) {
        const donor = donors.find(d => d.id === m.donor_id);
        if (donor) {
          const checkNotifId = crypto.randomUUID();
          const bodyMsg = `Did you successfully donate blood for Request ID: ${request.tracking_code} at ${request.hospital_name}? Reply YES to CONFIRM and activate your 60-day recovery cooldown, or NO to indicate it did not happen.`;
          
          await authenticatedApi('/api/notifications', {
            id: checkNotifId,
            type: 'whatsapp',
            recipient_type: 'donor',
            recipient_id: donor.id,
            trigger_event: 'cooldown_verification',
            message_body: bodyMsg,
            status: 'delivered',
            sent_at: nowStr,
            created_at: nowStr
          }, 'POST');
        }
      }

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (confettiErr) {
        console.error("Confetti error:", confettiErr);
      }

      if (onStateChange) onStateChange();
      alert("Blood request has been marked as fulfilled.");
    } catch (err) {
      console.error(err);
      alert("Failed to update request.");
    }
  };

  const handleCancelRequest = async () => {
    if (!request) return;
    if (!window.confirm("Are you sure you want to cancel this blood request?")) return;

    try {
      const response = (await authenticatedApi(`/api/requests/${request.tracking_code}/cancel`, {}, 'PATCH')) as any;
      if (response && response.request) {
        setRequest(response.request);
        if (onStateChange) onStateChange();
        alert("Blood request cancelled successfully.");
      } else {
        throw new Error("Failed to cancel");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to cancel request.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">{isHi ? 'मिलान की प्रतीक्षा' : 'Awaiting Matches'}</span>;
      case 'matching':
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200 animate-pulse">{isHi ? 'रीयल-टाइम खोज जारी' : 'Live Matching'}</span>;
      case 'partially_matched':
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">{isHi ? 'रक्तदाता की प्रतिक्रिया मिली' : 'Donor Responded'}</span>;
      case 'fulfilled':
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 border border-purple-200">{isHi ? 'पूर्ण हुआ' : 'Fulfilled'}</span>;
      case 'cancelled':
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-600 border border-ink-200">{isHi ? 'रद्द' : 'Cancelled'}</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-blood-50 px-3 py-1 text-xs font-semibold text-blood-700 border border-blood-200">{status}</span>;
    }
  };

  return (
    <div id="tracking-view-container" className="max-w-4xl mx-auto space-y-8">
      {/* Symmetrical Search Bar Card */}
      <div className="rounded-3xl bg-white/95 backdrop-blur-xl border border-ink-200/80 shadow-premium-lg p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="grid h-10 w-10 place-items-center rounded-2xl blood-drop-gradient shadow-md">
            <Search className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-ink-900">
              {isHi ? 'रीयल-टाइम मैचिंग स्थिति ट्रैक करें' : 'Track Real-Time Matching Status'}
            </h3>
            <p className="text-xs text-ink-500">
              {isHi ? 'लाइव रक्तदाता प्रतिक्रियाएं और संपर्क जानकारी देखने के लिए 12-अंकीय ट्रैकिंग कोड दर्ज करें' : 'Enter your 12-digit tracking code to view live donor responses & contact info'}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 w-4 h-4 text-ink-400" />
            <input
              type="text"
              placeholder={isHi ? '12-अंकीय ट्रैकिंग कोड दर्ज करें...' : 'Enter 12-digit Tracking Code...'}
              value={searchCode}
              onChange={e => setSearchCode(e.target.value)}
              className="w-full rounded-xl border border-ink-200 bg-white pl-11 pr-4 py-3 text-sm font-semibold text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-blood-500 transition-all"
            />
          </div>
          <button
            onClick={() => handleSearch(searchCode)}
            disabled={loading}
            className="btn-glow inline-flex items-center justify-center gap-2 rounded-xl bg-ink-900 px-8 py-3 text-sm font-semibold text-white shadow-md hover:bg-black transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (isHi ? 'खोजा जा रहा है...' : 'Searching...') : (isHi ? 'स्थिति ट्रैक करें' : 'Track Match')}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-blood-50 border border-blood-200 p-4 text-blood-700 text-xs font-semibold flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-blood-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Tracking Results */}
      {request && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main details */}
          <div className="md:col-span-2 space-y-6">
            <div className="rounded-3xl bg-white/95 backdrop-blur-xl border border-ink-200/80 shadow-premium-lg p-6 sm:p-8 space-y-6">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-xl font-bold tracking-tight text-ink-900">{request.tracking_code}</h2>
                    {getStatusBadge(request.status)}
                  </div>
                  <p className="text-xs text-ink-400 font-medium mt-1">
                    Requested on {new Date(request.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl bg-blood-50 border border-blood-200 px-4 py-3 text-center min-w-[90px]">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-blood-600">{isHi ? 'आवश्यक रक्त' : 'Blood Needed'}</span>
                  <span className="text-2xl font-bold text-blood-700">{request.blood_type_needed}</span>
                </div>
              </div>

              {/* Progress Tracker */}
              <div className="grid grid-cols-4 gap-3 pt-4 border-t border-ink-100 text-center">
                {[
                  { label: isHi ? 'पंजीकृत' : 'Created', active: true },
                  { label: isHi ? 'खोज जारी' : 'Matching', active: request.status !== 'open' },
                  { label: isHi ? 'स्वीकृत' : 'Approved', active: matches.some(m => m.donor_response === 'approved') },
                  { label: isHi ? 'पूर्ण' : 'Fulfilled', active: request.status === 'fulfilled' },
                ].map((step, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className={`h-2 rounded-full transition-all ${step.active ? 'blood-drop-gradient' : 'bg-ink-100'}`} />
                    <span className={`text-[11px] font-semibold block ${step.active ? 'text-ink-900' : 'text-ink-400'}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Patient and Hospital details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl bg-ink-50/70 p-5 border border-ink-100 text-xs font-medium text-ink-800">
                <div>
                  <span className="text-[11px] text-ink-400 uppercase font-semibold tracking-wider block">Patient Name & Demographics</span>
                  <p className="font-bold text-sm mt-0.5 text-ink-900">
                    {request.patient_name} {request.patient_age ? `(${request.patient_age}Y / ${request.patient_gender || 'M'})` : ''}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-ink-400 uppercase font-semibold tracking-wider block">Component & Units</span>
                  <p className="font-bold text-sm mt-0.5 text-ink-900">
                    {request.component_needed || 'Whole Blood'} — {request.units_required} Unit(s)
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[11px] text-ink-400 uppercase font-semibold tracking-wider block">Hospital & Clinical Verification</span>
                  <p className="font-semibold text-xs mt-1 flex items-start gap-1.5 text-ink-900">
                    <MapPin className="w-4 h-4 text-blood-500 mt-0.5 flex-shrink-0" />
                    <span>{request.hospital_name}, {request.hospital_area}, {request.hospital_city} ({request.hospital_pincode})</span>
                  </p>
                  {(request.hospital_uhid || request.attending_doctor) && (
                    <p className="text-xs text-ink-600 mt-1 pl-5 mb-3">
                      {request.hospital_uhid && <span className="font-mono bg-ink-100 px-1.5 py-0.5 rounded text-[10px] mr-2">UHID: {request.hospital_uhid}</span>}
                      {request.attending_doctor && <span>Physician: {request.attending_doctor}</span>}
                    </p>
                  )}
                  {(() => {
                    const coords = getCoordinates(request.hospital_pincode);
                    return (
                      <div className="mt-3">
                        <HospitalMap 
                          hospitalLat={coords.lat} 
                          hospitalLng={coords.lng} 
                          hospitalName={request.hospital_name} 
                        />
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <span className="text-[11px] text-ink-400 uppercase font-semibold tracking-wider block">Urgency Level</span>
                  <p className="font-semibold text-xs mt-0.5 capitalize flex items-center gap-1.5 text-ink-900">
                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${request.urgency_level === 'critical' ? 'bg-blood-600' : request.urgency_level === 'urgent' ? 'bg-amber-500' : 'bg-ink-400'}`} />
                    {request.urgency_level}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-ink-400 uppercase font-semibold tracking-wider block">Expiry / Timeout</span>
                  <p className="font-semibold text-xs mt-0.5 flex items-center gap-1.5 text-ink-900">
                    <Clock className="w-3.5 h-3.5 text-blood-500" />
                    {new Date(request.expires_at) < new Date() ? 'Expired' : new Date(request.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + new Date(request.expires_at).toLocaleDateString() + ')'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              {request.status !== 'fulfilled' && request.status !== 'cancelled' && (
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-ink-100">
                  <button
                    onClick={handleMarkAsFulfilled}
                    className="flex-1 py-3 px-4 rounded-xl bg-blood-600 hover:bg-blood-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark as Fulfilled
                  </button>
                  <button
                    onClick={handleCancelRequest}
                    className="py-3 px-4 rounded-xl bg-white hover:bg-ink-50 border border-ink-200 text-ink-700 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    Cancel Request
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Matches & Privacy Gate Info */}
          <div className="space-y-6">
            <div className="rounded-3xl bg-white/95 backdrop-blur-xl border border-ink-200/80 shadow-premium-lg p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-ink-100 pb-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-ink-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blood-600" />
                  Donors Matched ({matches.length})
                </h3>
                <span className="text-[10px] font-semibold text-ink-400">POOL</span>
              </div>

              {matches.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-2xl bg-ink-50/70 border border-ink-100">
                  <AlertTriangle className="w-8 h-8 text-blood-500 mx-auto mb-2" />
                  <p className="text-xs font-bold text-ink-800">No proximity matches yet</p>
                  <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">
                    Try registering a volunteer donor with compatible blood type and pincode {request.hospital_pincode}!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matches.map((match) => {
                    const donor = donors.find(d => d.id === match.donor_id);
                    const isApproved = match.donor_response === 'approved';
                    const isDeclined = match.donor_response === 'declined';
                    const isPending = match.donor_response === 'pending';

                    return (
                      <div key={match.id} className={`p-4 rounded-2xl border transition-all ${
                        isApproved ? 'bg-emerald-50/40 border-emerald-200 shadow-sm' : 
                        isDeclined ? 'bg-ink-50/40 border-ink-200 opacity-60' : 'bg-white border-ink-200'
                      }`}>
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="text-[10px] font-semibold text-ink-400 uppercase">Rank #{match.match_rank}</span>
                            <h4 className="font-bold text-sm text-ink-900 mt-0.5">
                              {isApproved ? donor?.full_name : `Volunteer Donor (${donor?.blood_type})`}
                            </h4>
                            <p className="text-xs text-ink-500 font-medium mt-0.5">{donor?.area}, {donor?.city}</p>
                          </div>
                          
                          <span className={`rounded-full px-2.5 py-0.5 font-semibold text-[10px] uppercase ${
                            isApproved ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            isDeclined ? 'bg-ink-100 text-ink-600 border border-ink-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {match.donor_response}
                          </span>
                        </div>

                        {isApproved ? (
                          <div className="mt-3 pt-3 border-t border-emerald-200/60 space-y-2 text-xs">
                            <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5" /> Consent granted! Direct Contact:
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <a
                                href={`tel:${donor?.phone}`}
                                className="p-2 rounded-xl bg-white hover:bg-emerald-50 text-ink-800 border border-emerald-200 flex items-center justify-center gap-1.5 font-semibold text-xs transition-colors"
                              >
                                <Phone className="w-3.5 h-3.5 text-emerald-600" /> Call
                              </a>
                              <a
                                href={`https://wa.me/${donor?.whatsapp_number?.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 font-semibold text-xs transition-colors shadow-sm"
                              >
                                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                              </a>
                            </div>
                          </div>
                        ) : isPending ? (
                          <div className="mt-3 text-xs text-ink-600 rounded-xl bg-ink-50 p-3 border border-ink-100 font-medium leading-relaxed">
                            <span className="font-semibold text-blood-600 block mb-0.5">🛡️ Privacy Shield Active</span>
                            Personal details hidden until donor replies YES via WhatsApp/Simulator.
                          </div>
                        ) : (
                          <div className="mt-2 text-xs font-semibold text-ink-400">
                            Donor unavailable or declined this request.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
