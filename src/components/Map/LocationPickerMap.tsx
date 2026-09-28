import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Coordinates } from '../../types';
import { syncEngine } from '../../services/syncEngine';
import {
  MapPin,
  Search,
  Check,
  X,
  Loader2,
  Navigation,
  Globe
} from 'lucide-react';

interface LocationPickerMapProps {
  coordinates: Coordinates;
  locationName: string;
  onSelectLocation: (coords: Coordinates, address: string) => void;
  onClose?: () => void;
  photoThumbnail?: string | null;
  hasExifGps?: boolean;
}

const createPinIcon = (photoUrl?: string | null) => {
  if (photoUrl) {
    return L.divIcon({
      html: `
        <div class="relative group cursor-grab active:cursor-grabbing transform -translate-x-1/2 -translate-y-full flex flex-col items-center">
          <div class="relative p-1 rounded-2xl bg-white shadow-2xl border-2 border-[#E2725B] ring-4 ring-[#E2725B]/25 transform transition hover:scale-110">
            <img src="${photoUrl}" alt="Foto" class="w-12 h-12 rounded-xl object-cover" />
            <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[#E2725B]"></div>
            <div class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#E2725B] text-white flex items-center justify-center text-[10px] font-bold shadow">
              📍
            </div>
          </div>
        </div>
      `,
      className: 'location-picker-marker-photo',
      iconSize: [52, 58],
      iconAnchor: [26, 56],
    });
  }

  return L.divIcon({
    html: `
      <div class="relative group cursor-grab active:cursor-grabbing transform -translate-x-1/2 -translate-y-full">
        <div class="w-10 h-10 rounded-2xl bg-[#E2725B] text-white shadow-xl flex items-center justify-center border-2 border-white ring-4 ring-[#E2725B]/20 animate-bounce-subtle">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
      </div>
    `,
    className: 'location-picker-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 36],
  });
};

export const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  coordinates,
  locationName,
  onSelectLocation,
  onClose,
  photoThumbnail,
  hasExifGps,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [currentCoords, setCurrentCoords] = useState<Coordinates>(coordinates);
  const [currentAddress, setCurrentAddress] = useState<string>(locationName);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  const lastThumbnailRef = useRef<string | null | undefined>(photoThumbnail);
  const isMountedRef = useRef(false);

  // Helper to safely mount or remount marker
  const renderMarker = (lat: number, lng: number, thumbnail?: string | null) => {
    if (!mapRef.current) return;

    if (markerRef.current) {
      try {
        mapRef.current.removeLayer(markerRef.current);
      } catch (e) {
        console.warn('Error removing marker layer:', e);
      }
      markerRef.current = null;
    }

    try {
      const pinIcon = createPinIcon(thumbnail);
      const marker = L.marker([lat, lng], {
        draggable: true,
        icon: pinIcon,
      }).addTo(mapRef.current);

      marker.on('dragend', async () => {
        if (!markerRef.current) return;
        const pos = markerRef.current.getLatLng();
        const newCoords = { lat: Number(pos.lat.toFixed(6)), lng: Number(pos.lng.toFixed(6)) };
        setCurrentCoords(newCoords);
        setIsReverseGeocoding(true);
        const addr = await syncEngine.reverseGeocode(newCoords.lat, newCoords.lng);
        setIsReverseGeocoding(false);
        setCurrentAddress(addr);
        onSelectLocation(newCoords, addr);
      });

      markerRef.current = marker;
    } catch (err) {
      console.warn('Error creating marker:', err);
    }
  };

  // Initialize Leaflet mini-picker map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialLat = coordinates?.lat && !isNaN(coordinates.lat) ? coordinates.lat : 48.137154;
    const initialLng = coordinates?.lng && !isNaN(coordinates.lng) ? coordinates.lng : 11.576124;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: photoThumbnail || hasExifGps ? 14 : 12,
      zoomControl: true,
      attributionControl: false,
    });

    const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapRef.current = map;
    isMountedRef.current = true;
    lastThumbnailRef.current = photoThumbnail;

    renderMarker(initialLat, initialLng, photoThumbnail);

    // Handle map click to place pin
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const newCoords = { lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) };
      renderMarker(newCoords.lat, newCoords.lng, photoThumbnail);
      setCurrentCoords(newCoords);
      setIsReverseGeocoding(true);
      const addr = await syncEngine.reverseGeocode(newCoords.lat, newCoords.lng);
      setIsReverseGeocoding(false);
      setCurrentAddress(addr);
      onSelectLocation(newCoords, addr);
    });

    const timer = setTimeout(() => {
      if (mapRef.current) {
        try {
          mapRef.current.invalidateSize();
          mapRef.current.setView([initialLat, initialLng], photoThumbnail || hasExifGps ? 14 : 12);
        } catch (e) {
          // ignore
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      isMountedRef.current = false;
      if (mapRef.current) {
        try {
          if (markerRef.current) {
            mapRef.current.removeLayer(markerRef.current);
            markerRef.current = null;
          }
          mapRef.current.remove();
        } catch (e) {
          // ignore
        }
        mapRef.current = null;
      }
    };
  }, []);

  // Update map and marker safely if coordinates or photoThumbnail change
  useEffect(() => {
    if (!isMountedRef.current || !mapRef.current) return;

    try {
      const lat = coordinates?.lat && !isNaN(coordinates.lat) ? coordinates.lat : 48.137154;
      const lng = coordinates?.lng && !isNaN(coordinates.lng) ? coordinates.lng : 11.576124;

      const thumbChanged = lastThumbnailRef.current !== photoThumbnail;
      if (thumbChanged) {
        lastThumbnailRef.current = photoThumbnail;
      }

      if (markerRef.current) {
        const currentMarkerPos = markerRef.current.getLatLng();
        const posChanged = Math.abs(currentMarkerPos.lat - lat) > 0.0001 || Math.abs(currentMarkerPos.lng - lng) > 0.0001;

        if (thumbChanged || posChanged) {
          renderMarker(lat, lng, photoThumbnail);
          const currentZoom = mapRef.current.getZoom();
          const targetZoom = currentZoom < 13 ? 14 : currentZoom;
          mapRef.current.setView([lat, lng], targetZoom, { animate: false });
          setCurrentCoords(coordinates);
          setCurrentAddress(locationName);
        }
      } else {
        renderMarker(lat, lng, photoThumbnail);
      }
    } catch (err) {
      console.warn('Map update warning:', err);
    }
  }, [coordinates, locationName, photoThumbnail]);

  // Search places using Nominatim
  const handleSearchSubmit = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const results = await syncEngine.searchLocation(searchQuery.trim());
    setIsSearching(false);
    setSearchResults(results);
  };

  const handleSelectSearchResult = (result: { name: string; lat: number; lng: number }) => {
    const newCoords = { lat: Number(result.lat.toFixed(6)), lng: Number(result.lng.toFixed(6)) };
    setCurrentCoords(newCoords);
    setCurrentAddress(result.name);
    setSearchResults([]);
    setSearchQuery('');

    if (mapRef.current && markerRef.current) {
      try {
        markerRef.current.setLatLng([newCoords.lat, newCoords.lng]);
        mapRef.current.setView([newCoords.lat, newCoords.lng], 14, { animate: true });
      } catch (err) {
        console.warn('Search result fly warning:', err);
      }
    }

    onSelectLocation(newCoords, result.name);
  };

  return (
    <div className="w-full bg-[#FDFBF7] rounded-2xl border border-[#D5CEC2] shadow-md overflow-hidden flex flex-col space-y-2 p-3">
      {/* Top Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2 relative z-20">
        <div className="flex-1 relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-[#8C8273]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearchSubmit();
              }
            }}
            placeholder="Ort, Stadt, Strand oder Sehenswürdigkeit weltweit suchen..."
            className="w-full pl-9 pr-20 py-2 rounded-xl bg-white border border-[#E5E1D8] text-xs text-[#4E3B31] placeholder-[#8C8273] focus:outline-none focus:border-[#8A9A5B] shadow-sm"
          />
          <button
            type="button"
            onClick={handleSearchSubmit}
            disabled={isSearching || !searchQuery.trim()}
            className="absolute right-1.5 px-3 py-1 rounded-lg bg-[#8A9A5B] hover:bg-[#7D8C68] disabled:opacity-50 text-white font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
          >
            {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Suchen'}
          </button>
        </div>
      </div>

      {/* Search Results Dropdown */}
      {searchResults.length > 0 && (
        <div className="relative z-30 bg-white border border-[#E5E1D8] rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-[#F1EDE6]">
          {searchResults.map((res, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelectSearchResult(res)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-[#F1EDE6]/70 flex items-start gap-2 text-[#4E3B31] transition"
            >
              <MapPin className="w-3.5 h-3.5 text-[#E2725B] shrink-0 mt-0.5" />
              <div className="flex-1 truncate">
                <span className="font-semibold block truncate">{res.name.split(',')[0]}</span>
                <span className="text-[10px] text-[#8C8273] block truncate">{res.name}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Leaflet Interactive Map Container */}
      <div className="relative w-full h-64 sm:h-72 rounded-xl overflow-hidden border border-[#E5E1D8] shadow-inner bg-[#E5E1D8]/40">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Tip / Guidance overlay */}
        <div className="absolute top-2.5 left-2.5 z-[400] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/80 shadow-md text-[11px] text-[#4E3B31] flex items-center gap-2 max-w-[85%]">
          {photoThumbnail ? (
            <div className="flex items-center gap-1.5 font-semibold text-[#E2725B]">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>Foto-Standort auf der Karte markiert</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[#6B5E55]">
              <MapPin className="w-3.5 h-3.5 text-[#E2725B] shrink-0" />
              <span>Klicke auf die Karte oder ziehe den Pin</span>
            </div>
          )}
        </div>
      </div>

      {/* Selected Location Card & Actions */}
      <div className="p-3 bg-white rounded-xl border border-[#E5E1D8] flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm text-xs">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className="p-1.5 rounded-lg bg-[#E2725B]/10 text-[#E2725B] shrink-0 mt-0.5">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#4E3B31] truncate">
                {currentAddress || 'Ausgewählter Ort'}
              </span>
              {isReverseGeocoding && (
                <Loader2 className="w-3 h-3 text-[#8A9A5B] animate-spin shrink-0" />
              )}
            </div>
            <div className="text-[11px] text-[#8C8273] font-mono mt-0.5">
              Lat: {currentCoords.lat.toFixed(5)}, Lng: {currentCoords.lng.toFixed(5)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              onSelectLocation(currentCoords, currentAddress);
              if (onClose) onClose();
            }}
            className="px-3.5 py-1.5 rounded-xl bg-[#8A9A5B] hover:bg-[#7D8C68] text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Koordinaten & Standort übernehmen</span>
          </button>
        </div>
      </div>
    </div>
  );
};
