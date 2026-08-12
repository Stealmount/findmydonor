import React from 'react';
import { DonationLog, BloodRequest, User } from '../../types';
import { useLanguage } from '../../lib/LanguageContext';
import { Heart, Clock, MapPin, Calendar } from 'lucide-react';

interface DonationHistoryProps {
  logs: DonationLog[];
  requests: BloodRequest[];
  currentUser: User;
}

/** Past donation timeline. */
export default function DonationHistory({ logs, requests, currentUser }: DonationHistoryProps) {
  const { language } = useLanguage();
  const isHi = language === 'HI';

  return (
    <>
      <div className="flex items-center justify-between border-b border-white/15 pb-4">
        <h3 className="text-[14px] font-semibold tracking-wide text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-white" />
          Donation History
        </h3>
        <span className="text-[10px] font-medium tracking-wider uppercase text-white/50">Your Life-Saving Impact</span>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-sm">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-white/30" />
          <p className="text-[13px] font-semibold text-white">No Donation History Found</p>
          <p className="text-[11px] text-white/60 mt-1.5 leading-relaxed">
            You haven't logged any donations yet. You can self-report an external donation on the right panel!
          </p>
        </div>
      ) : (
        <div className="relative border-l-2 border-white/20 pl-6 ml-3 space-y-6 py-2 text-left">
          {logs.map((log) => {
            const req = requests.find(r => r.id === log.request_id);
            const hospitalName = req ? req.hospital_name : 'External Location / Event';
            const locationInfo = req ? `${req.hospital_area}, ${req.hospital_city} (${req.hospital_pincode})` : log.notes;
            const bloodType = req ? req.blood_type_needed : currentUser.blood_type;

            return (
              <div key={log.id} className="relative">
                {/* Bullet point on the timeline */}
                <span className="absolute -left-[33px] top-2 bg-white ring-2 ring-blood-700 w-3 h-3 rounded-full shadow-sm" />

                <div className="bg-white/10 ring-1 ring-white/15 rounded-2xl p-5 space-y-3 backdrop-blur-sm text-white">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold tracking-wide bg-black/20 px-2.5 py-1 rounded-full text-white/90">
                        {new Date(log.donation_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        log.source === 'platform_match' ? 'bg-emerald-500 text-white' :
                        log.source === 'admin_entered' ? 'bg-white/20 text-white' : 'bg-white/20 text-white'
                      }`}>
                        {log.source.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="bg-white text-blood-700 px-2.5 py-1 font-bold text-[10px] rounded-full">
                      Blood Group: {bloodType}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-semibold text-[15px]">{hospitalName}</h4>
                    <p className="text-[11px] text-white/80 font-medium flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      {locationInfo}
                    </p>
                  </div>

                  {req && log.notes && (
                    <p className="text-[11px] text-white/70 bg-black/10 p-2.5 rounded-lg italic">
                      &ldquo;{log.notes}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
