import React from 'react';
import { Match, BloodRequest, User } from '../../types';
import { useLanguage } from '../../lib/LanguageContext';
import { getCoordinates } from '../../data/pincode_coords';
import HospitalMap from '../HospitalMap';
import {
  Heart,
  MapPin,
  Clock,
  Phone,
  Droplet,
  X,
  Check,
} from 'lucide-react';

interface MatchListProps {
  matches: Match[];
  requests: BloodRequest[];
  currentUser: User;
  loadingMatchId: string | null;
  onRespond: (matchId: string, decision: 'approved' | 'declined') => void;
}

/** Pending/active match request cards with accept/decline, map, and contact. */
export default function MatchList({ matches, requests, currentUser, loadingMatchId, onRespond }: MatchListProps) {
  const { t, language } = useLanguage();
  const isHi = language === 'HI';

  return (
    <>
      <div className="flex items-center justify-between border-b border-white/15 pb-4">
        <h3 className="text-[14px] font-semibold tracking-wide text-white flex items-center gap-2">
          <Heart className="w-4 h-4 text-white" />
          {t.donorDashboard.liveMatchingRequests} ({matches.length})
        </h3>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-sm">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-blood-500/15 ring-1 ring-blood-400/20">
            <Droplet className="w-7 h-7 text-blood-400" />
          </div>
          <p className="text-[13px] font-semibold text-white">{t.donorDashboard.noActiveRequests}</p>
          <p className="text-[11px] text-white/60 mt-1.5 leading-relaxed">
            {t.donorDashboard.noActiveRequestsSub}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map(match => {
            const req = requests.find(r => r.id === match.request_id);
            if (!req) return null;

            const isPending = match.donor_response === 'pending';
            const isApproved = match.donor_response === 'approved';
            const isDeclined = match.donor_response === 'declined';

            return (
              <div
                key={match.id}
                className={`rounded-2xl ring-1 p-5 transition-all relative overflow-hidden ${
                  isApproved ? 'bg-white border-none ring-0 shadow-xl' :
                  isDeclined ? 'bg-black/20 ring-white/5 opacity-60' :
                  'bg-white/10 ring-white/15 backdrop-blur-md'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${isApproved ? 'bg-ink-100 text-ink-600' : 'bg-white/10 text-white/80'}`}>
                    {isHi ? 'निकटता रैंक' : 'Proximity Rank'}: #{match.match_rank}
                  </span>
                  <span className={`text-[11px] font-semibold ${isApproved ? 'text-emerald-600' : 'text-white/90'}`}>
                    {isApproved ? (isHi ? 'पुष्टि की गई ✓' : 'Confirmed ✓') :
                     isDeclined ? (isHi ? 'अस्वीकृत' : 'Passed') :
                     (isHi ? 'कार्रवाई आवश्यक' : 'Action Required')}
                  </span>
                </div>

                <h4 className={`text-xl font-semibold mt-1 tracking-tight ${isApproved ? 'text-ink-900' : 'text-white'}`}>
                  {req.blood_type_needed} {isHi ? 'रक्त की आवश्यकता' : 'blood needed'}
                </h4>
                <p className={`text-[12px] mt-1 ${isApproved ? 'text-ink-500' : 'text-white/80'}`}>
                  {req.hospital_name} &bull; {req.units_required} {isHi ? 'यूनिट आवश्यक' : 'units needed'}
                </p>

                <div className="flex items-center gap-2 mt-4">
                  <span className={`text-[11px] px-2.5 py-1 flex items-center gap-1.5 rounded-full ${isApproved ? 'bg-ink-50 text-ink-700 border border-ink-100' : 'bg-white/10 text-white ring-1 ring-white/20'}`}>
                    <MapPin className="w-3.5 h-3.5" />
                    {match.distance_km ? `${match.distance_km} ${isHi ? 'किमी दूर' : 'km away'}` : (isHi ? 'आस-पास' : 'Nearby')}
                  </span>
                  <span className={`text-[11px] px-2.5 py-1 flex items-center gap-1.5 rounded-full ${isApproved ? 'bg-ink-50 text-ink-700 border border-ink-100' : 'bg-white/10 text-white ring-1 ring-white/20'}`}>
                    <Clock className="w-3.5 h-3.5" />
                    {req.urgency_level.toUpperCase()}
                  </span>
                </div>

                {(isPending || isApproved) && (() => {
                  const hospitalCoords = getCoordinates(req.hospital_pincode);
                  const donorCoords = currentUser ? getCoordinates(currentUser.pincode) : undefined;
                  return (
                    <div className="mt-4">
                      <HospitalMap
                        hospitalLat={hospitalCoords.lat}
                        hospitalLng={hospitalCoords.lng}
                        hospitalName={req.hospital_name}
                        donorLat={donorCoords?.lat}
                        donorLng={donorCoords?.lng}
                        distanceKm={match.distance_km}
                      />
                    </div>
                  );
                })()}

                {isPending && (
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <button
                      id={`btn-dash-decline-${match.id}`}
                      onClick={() => onRespond(match.id, 'declined')}
                      disabled={loadingMatchId === match.id}
                      className="rounded-full bg-white/10 ring-1 ring-white/20 py-3 text-[12.5px] font-semibold text-white flex items-center justify-center gap-2 hover:bg-white/20 transition-all cursor-pointer"
                    >
                      {loadingMatchId === match.id ? <span className="animate-spin w-4 h-4 border-2 border-white/40 border-t-white rounded-full" /> : <X className="h-4 w-4" />}
                      {isHi ? 'अस्वीकार करें' : 'Pass'}
                    </button>
                    <button
                      id={`btn-dash-approve-${match.id}`}
                      onClick={() => onRespond(match.id, 'approved')}
                      disabled={loadingMatchId === match.id}
                      className="rounded-full bg-white text-blood-700 py-3 text-[12.5px] font-semibold flex items-center justify-center gap-2 hover:bg-white/90 shadow-lg transition-all cursor-pointer"
                    >
                      {loadingMatchId === match.id ? <span className="animate-spin w-4 h-4 border-2 border-blood-200 border-t-blood-700 rounded-full" /> : <Check className="h-4 w-4 stroke-[3]" />}
                      {isHi ? 'स्वीकार करें' : 'Accept Match'}
                    </button>
                  </div>
                )}

                {isApproved && (() => {
                  const mapQuery = encodeURIComponent(`${req.hospital_name}, ${req.hospital_area}, ${req.hospital_city}`);
                  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
                  return (
                    <div className="mt-5 pt-5 border-t border-ink-100 space-y-4">
                      <div className="p-4 rounded-2xl bg-ink-50/50 border border-ink-100">
                        <p className="text-xs font-semibold text-ink-900 mb-1">{isHi ? 'मरीज की जानकारी (अनलॉक की गई):' : 'Patient Info unlocked:'}</p>
                        <p className="text-sm font-semibold text-ink-900">{req.patient_name}</p>
                        <p className="text-xs text-ink-500">{req.patient_age}Y / {req.patient_gender} &bull; Attending: Dr. {req.attending_doctor || 'N/A'}</p>
                      </div>
                      {req.requester_phone ? (
                        <a
                          id={`lnk-contact-requester-${match.id}`}
                          href={`tel:${req.requester_phone}`}
                          className="p-3 rounded-2xl bg-ink-900 text-white flex items-center justify-between gap-3 hover:bg-ink-800 transition-all group cursor-pointer block"
                        >
                          <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 group-hover:bg-white/20 transition-colors">
                              <Phone className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="text-[11px] text-white/70">{isHi ? 'अनुरोधकर्ता से संपर्क करें' : 'Contact Requester'}</p>
                              <p className="font-semibold text-sm flex items-center gap-2">
                                <span>{req.requester_name}</span>
                                <span className="text-xs text-white/80 font-normal">({req.requester_phone})</span>
                              </p>
                            </div>
                          </div>
                          <span className="text-[11px] font-semibold bg-white/10 group-hover:bg-white/20 px-3 py-1 rounded-xl text-white transition-colors">
                            {isHi ? 'कॉल करें 📞' : 'Call 📞'}
                          </span>
                        </a>
                      ) : (
                        <div className="p-3 rounded-2xl bg-ink-900/50 text-white/60 flex items-center gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5">
                            <Phone className="w-4 h-4 text-white/40" />
                          </div>
                          <div>
                            <p className="text-[11px] text-white/50">{isHi ? 'अनुरोधकर्ता से संपर्क करें' : 'Contact Requester'}</p>
                            <p className="font-semibold text-xs text-white/60">{isHi ? 'संपर्क जानकारी उपलब्ध नहीं है' : 'Contact info not available'}</p>
                          </div>
                        </div>
                      )}
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full rounded-2xl bg-blood-600 hover:bg-blood-700 text-white py-3.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition-all"
                      >
                        <MapPin className="w-4 h-4" />
                        {isHi ? 'अस्पताल के लिए लाइव नेविगेशन (Google Maps)' : 'Get Exact Hospital Live Navigation (Google Maps)'}
                      </a>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
