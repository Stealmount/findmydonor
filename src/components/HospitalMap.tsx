import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface HospitalMapProps {
  hospitalLat: number;
  hospitalLng: number;
  hospitalName: string;
  donorLat?: number;
  donorLng?: number;
  distanceKm?: number;
}

export default function HospitalMap({
  hospitalLat,
  hospitalLng,
  hospitalName,
  donorLat,
  donorLng,
  distanceKm,
}: HospitalMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    // 1. Inject Leaflet CSS if not already present
    const cssId = 'leaflet-css-link';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!mapContainerRef.current) return;

    // 2. Initialize Map
    const centerLat = donorLat ? (hospitalLat + donorLat) / 2 : hospitalLat;
    const centerLng = donorLng ? (hospitalLng + donorLng) / 2 : hospitalLng;
    const zoomLevel = donorLat ? 12 : 14;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: zoomLevel,
      zoomControl: true,
      attributionControl: false,
    });

    mapRef.current = map;

    // 3. Add OpenStreetMap Tiles (Delivery-app style sleek grey/warm style)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // 4. Custom Marker Icons to avoid Leaflet's default image loading bugs in webpack/vite
    const hospitalIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center">
          <span class="animate-ping absolute inline-flex h-9 w-9 rounded-full bg-rose-400 opacity-75"></span>
          <div class="relative bg-rose-600 border-2 border-white rounded-full p-2 text-white shadow-lg flex items-center justify-center w-8 h-8">
            🏥
          </div>
        </div>
      `,
      className: 'custom-div-icon',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const donorIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center">
          <div class="relative bg-blue-600 border-2 border-white rounded-full p-2 text-white shadow-lg flex items-center justify-center w-8 h-8">
            📍
          </div>
        </div>
      `,
      className: 'custom-div-icon',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    // 5. Add markers
    L.marker([hospitalLat, hospitalLng], { icon: hospitalIcon })
      .addTo(map)
      .bindPopup(`<b>${hospitalName}</b><br/>Hospital Destination`)
      .openPopup();

    if (donorLat && donorLng) {
      L.marker([donorLat, donorLng], { icon: donorIcon })
        .addTo(map)
        .bindPopup('<b>Your Registered Area</b><br/>Approximate Start Point');

      // Draw route indicator line
      L.polyline([[donorLat, donorLng], [hospitalLat, hospitalLng]], {
        color: '#f43f5e',
        weight: 3,
        dashArray: '5, 8',
        opacity: 0.8,
      }).addTo(map);

      // Fit bounds to show both
      const bounds = L.latLngBounds([[donorLat, donorLng], [hospitalLat, hospitalLng]]);
      map.fitBounds(bounds, { padding: [30, 30] });
    }

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [hospitalLat, hospitalLng, hospitalName, donorLat, donorLng]);

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${hospitalLat},${hospitalLng}`;

  return (
    <div className="w-full space-y-3">
      <div 
        ref={mapContainerRef} 
        className="w-full h-[220px] sm:h-[260px] rounded-2xl overflow-hidden border border-ink-200/50 shadow-inner relative z-10" 
      />
      <div className="flex items-center justify-between gap-3 bg-ink-50/50 rounded-xl p-3 border border-ink-100">
        <div className="text-xs text-ink-600">
          {distanceKm ? (
            <p>
              Distance: <strong className="text-ink-950 font-bold">~{distanceKm} km</strong> away
            </p>
          ) : (
            <p>Hospital Location ready</p>
          )}
        </div>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all active:scale-[0.98]"
        >
          🗺️ Get Directions
        </a>
      </div>
    </div>
  );
}
