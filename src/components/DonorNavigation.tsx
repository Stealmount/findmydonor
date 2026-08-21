import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Navigation, Phone, Clock, AlertTriangle, ExternalLink, X, ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import type { BloodRequest, User } from '../types';

interface DonorNavigationProps {
 request: BloodRequest;
 donor: User;
 onClose: () => void;
 googleMapsApiKey?: string;
}

const URGENCY_CONFIG = {
 critical: { bg: 'bg-red-950/60', border: 'border-red-500', badge: 'bg-red-600', label: 'CRITICAL', emoji: '🚨' },
 urgent: { bg: 'bg-orange-950/60', border: 'border-orange-500', badge: 'bg-orange-600', label: 'URGENT', emoji: '⚠️' },
 planned: { bg: 'bg-blue-950/60', border: 'border-blue-500', badge: 'bg-blue-600', label: 'PLANNED', emoji: '📋' },
} as const;

function buildEmbedUrl(req: BloodRequest, apiKey?: string): string {
 const q = encodeURIComponent(`${req.hospital_name}, ${req.hospital_area}, ${req.hospital_city}, ${req.hospital_pincode}`);
 if (apiKey) return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${q}&zoom=15`;
 return `https://maps.google.com/maps?q=${q}&output=embed&z=15`;
}

function buildDirectionsUrl(req: BloodRequest): string {
 const dest = encodeURIComponent(`${req.hospital_name}, ${req.hospital_area}, ${req.hospital_city}`);
 return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
}

function estimateEta(distanceKm?: number): string {
 if (!distanceKm || distanceKm <= 0) return 'ETA unavailable';
 const minutes = Math.round((distanceKm / 20) * 60);
 if (minutes < 5) return 'Under 5 minutes';
 if (minutes < 60) return `~${minutes} min`;
 const hrs = Math.floor(minutes / 60);
 const mins = minutes % 60;
 return `~${hrs}h${mins > 0 ? ` ${mins}m` : ''}`;
}

const PulsingDot: React.FC<{ color?: string }> = ({ color = 'bg-red-500' }) => (
 <span className="relative flex h-3 w-3 mr-2">
 <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`} />
 <span className={`relative inline-flex rounded-full h-3 w-3 ${color}`} />
 </span>
);

const StepCard: React.FC<{ icon: React.ReactNode; title: string; value: string; sub?: string }> = ({ icon, title, value, sub }) => (
 <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
 <div className="text-red-400 mt-0.5">{icon}</div>
 <div className="min-w-0">
 <p className="text-xs text-white/50 uppercase tracking-wider">{title}</p>
 <p className="text-white font-medium text-sm leading-snug truncate">{value}</p>
 {sub && <p className="text-white/50 text-xs">{sub}</p>}
 </div>
 </div>
);

/**
 * DonorNavigation — Google Maps live navigation view.
 * Shown to a donor immediately after they accept a blood request match.
 * Uses Google Maps Embed API (iframe, no JS SDK key required).
 * Falls back gracefully if the embed is blocked by the browser.
 */
export const DonorNavigation: React.FC<DonorNavigationProps> = ({ request, donor, onClose, googleMapsApiKey }) => {
 const [mapLoaded, setMapLoaded] = useState(false);
 const [mapError, setMapError] = useState(false);
 const [minimised, setMinimised] = useState(false);
 const [copied, setCopied] = useState(false);

 const urgency = URGENCY_CONFIG[request.urgency_level] ?? URGENCY_CONFIG.urgent;
 const embedUrl = buildEmbedUrl(request, googleMapsApiKey);
 const directUrl = buildDirectionsUrl(request);
 const distKm = (donor as any).distance_km as number | undefined;
 const eta = estimateEta(distKm);

 const handleShare = useCallback(async () => {
 const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(request.hospital_name + ', ' + request.hospital_city)}`;
 try {
 if (navigator.share) { await navigator.share({ title: 'Hospital Location', url }); }
 else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
 } catch { /* user cancelled */ }
 }, [request]);

 return (
 <AnimatePresence>
 <motion.div
 key="donor-nav"
 initial={{ opacity: 0, y: 40 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: 40 }}
 transition={{ type: 'spring', damping: 22, stiffness: 260 }}
 className="fixed inset-0 z-50 flex flex-col bg-black/95"
 role="dialog"
 aria-label="Donor Navigation"
 aria-modal="true"
 >
 {/* Header */}
 <div className={`flex items-center justify-between px-4 py-3 border-b ${urgency.border} ${urgency.bg}`}>
 <div className="flex items-center gap-2">
 <PulsingDot color={urgency.badge} />
 <span className={`text-xs font-bold text-white px-2 py-0.5 rounded-full ${urgency.badge}`}>
 {urgency.emoji} {urgency.label}
 </span>
 <span className="text-white/70 text-sm hidden sm:block">Navigate to donation point</span>
 </div>
 <div className="flex items-center gap-2">
 <button id="donor-nav-minimise" onClick={() => setMinimised(v => !v)}
 className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
 aria-label={minimised ? 'Expand' : 'Minimise'}>
 {minimised ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
 </button>
 <button id="donor-nav-close" onClick={onClose}
 className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
 aria-label="Close navigation">
 <X size={16} />
 </button>
 </div>
 </div>

 <AnimatePresence>
 {!minimised && (
 <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex flex-col flex-1 overflow-hidden">
 {/* Info strip */}
 <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-white/10 bg-black/60">
 <StepCard icon={<MapPin size={16} />} title="Hospital" value={request.hospital_name} sub={`${request.hospital_area}, ${request.hospital_city}`} />
 <StepCard icon={<Navigation size={16} />} title="ETA" value={eta} sub={distKm ? `~${distKm} km away` : undefined} />
 <StepCard icon={<AlertTriangle size={16} />} title="Blood needed" value={request.blood_type_needed} sub={`${request.units_required} unit(s)`} />
 <StepCard icon={<Clock size={16} />} title="Request ID" value={request.tracking_code} />
 </div>

 {/* Map */}
 <div className="relative flex-1 bg-black/80">
 {!mapLoaded && !mapError && (
 <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
 <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
 <p className="text-white/60 text-sm">Loading map…</p>
 </div>
 )}
 {mapError ? (
 <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
 <MapPin size={40} className="text-red-400" />
 <div>
 <p className="text-white font-semibold mb-1">Map could not be loaded</p>
 <p className="text-white/60 text-sm">Open navigation directly in Google Maps</p>
 </div>
 <a id="donor-nav-open-maps" href={directUrl} target="_blank" rel="noopener noreferrer"
 className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-semibold transition-colors">
 <Navigation size={16} /> Open in Google Maps <ExternalLink size={14} />
 </a>
 </div>
 ) : (
 <iframe key={embedUrl} src={embedUrl} title="Hospital location map"
 className="w-full h-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
 onLoad={() => setMapLoaded(true)} onError={() => { setMapError(true); setMapLoaded(true); }}
 style={{ opacity: mapLoaded ? 1 : 0, transition: 'opacity 0.4s ease' }} />
 )}
 </div>

 {/* Action bar */}
 <div className="px-4 py-3 bg-black/80 border-t border-white/10 flex flex-wrap gap-2 items-center justify-between">
 <div className="flex items-center gap-2 text-white/60 text-sm">
 <Phone size={14} className="text-red-400 flex-shrink-0" />
 <span>Show Request ID at hospital: <strong className="text-white">{request.tracking_code}</strong></span>
 </div>
 <div className="flex gap-2">
 <button id="donor-nav-share" onClick={handleShare}
 className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors">
 <Share2 size={14} /> {copied ? 'Copied!' : 'Share'}
 </button>
 <a id="donor-nav-directions" href={directUrl} target="_blank" rel="noopener noreferrer"
 className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors">
 <Navigation size={14} /> Get Directions <ExternalLink size={12} />
 </a>
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </motion.div>
 </AnimatePresence>
 );
};

export default DonorNavigation;