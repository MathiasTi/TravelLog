import React, { useState, useEffect, useRef } from 'react';
import { Coordinates } from '../../../types';
import { LocationPickerMap } from '../../Map/LocationPickerMap';
import { syncEngine } from '../../../services/syncEngine';
import { getLiveDeviceCoordinates } from '../../../services/mobileMediaService';
import {
  MapPin,
  Map as MapIcon,
  Loader2,
  ChevronDown,
  ChevronUp,
  Navigation,
  Search,
} from 'lucide-react';

interface LocationSectionProps {
  locationName: string;
  coordinates: Coordinates | null;
  showMapPicker: boolean;
  isGeocoding: boolean;
  showAdvancedOptions: boolean;
  photoThumbnail: string | null;
  hasExifGps: boolean;
  onLocationNameChange: (val: string) => void;
  onToggleMapPicker: () => void;
  onCloseMapPicker: () => void;
  onToggleAdvancedOptions: () => void;
  onSelectLocation: (coords: Coordinates, address?: string) => void;
  onCoordinatesChange: (coords: Coordinates) => void;
}

export const LocationSection: React.FC<LocationSectionProps> = ({
  locationName,
  coordinates,
  showMapPicker,
  isGeocoding,
  showAdvancedOptions,
  photoThumbnail,
  hasExifGps,
  onLocationNameChange,
  onToggleMapPicker,
  onCloseMapPicker,
  onToggleAdvancedOptions,
  onSelectLocation,
  onCoordinatesChange,
}) => {
  const [suggestions, setSuggestions] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Handle typing with debounced geocoding search
  const handleInputChange = (val: string) => {
    onLocationNameChange(val);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!val || val.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingPlaces(true);
      try {
        const results = await syncEngine.searchLocation(val.trim());
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (err) {
        console.warn('Place search warning:', err);
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 400);
  };

  const handleSelectSuggestion = (place: { name: string; lat: number; lng: number }) => {
    const newCoords: Coordinates = {
      lat: Number(place.lat.toFixed(6)),
      lng: Number(place.lng.toFixed(6)),
    };
    setShowSuggestions(false);
    onSelectLocation(newCoords, place.name);
  };

  // Quick GPS locate
  const handleGpsLocate = async () => {
    setIsLocatingGps(true);
    try {
      const liveGps = await getLiveDeviceCoordinates(4000);
      if (liveGps) {
        const addr = await syncEngine.reverseGeocode(liveGps.lat, liveGps.lng);
        onSelectLocation(liveGps, addr);
      }
    } catch (err) {
      console.warn('GPS location error:', err);
    } finally {
      setIsLocatingGps(false);
    }
  };

  return (
    <div className="space-y-2" ref={dropdownRef}>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[#E2725B]" />
          <span>Standort & Geokoordinaten</span>
        </label>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleGpsLocate}
            disabled={isLocatingGps}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl font-semibold transition border shadow-xs cursor-pointer bg-white hover:bg-[#F1EDE6] text-[#4E3B31] border-[#E5E1D8]"
            title="Aktuellen GPS-Standort ermitteln"
          >
            {isLocatingGps ? (
              <Loader2 className="w-3.5 h-3.5 text-[#E2725B] animate-spin" />
            ) : (
              <Navigation className="w-3.5 h-3.5 text-[#E2725B]" />
            )}
            <span className="hidden sm:inline">GPS</span>
          </button>
          <button
            type="button"
            onClick={onToggleMapPicker}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl font-bold transition border shadow-sm cursor-pointer ${
              showMapPicker
                ? 'bg-[#8A9A5B] text-white border-[#8A9A5B]'
                : 'bg-[#8A9A5B]/15 hover:bg-[#8A9A5B]/25 text-[#8A9A5B] border-[#8A9A5B]/30'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>{showMapPicker ? 'Karte einklappen' : 'Karte anzeigen'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Map Picker */}
      {showMapPicker && coordinates && (
        <div className="pt-1 pb-1">
          <LocationPickerMap
            coordinates={coordinates}
            locationName={locationName}
            photoThumbnail={photoThumbnail}
            hasExifGps={hasExifGps}
            onSelectLocation={onSelectLocation}
            onClose={onCloseMapPicker}
          />
        </div>
      )}

      {/* Location Name text input with Autocomplete Suggestions */}
      <div className="relative">
        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#E2725B]" />
        <input
          type="text"
          value={locationName}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          placeholder="Ort, Stadt, Sehenswürdigkeit eingeben..."
          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] placeholder-[#8C8273] text-base sm:text-sm focus:outline-none transition shadow-sm"
        />
        {(isGeocoding || isSearchingPlaces) && (
          <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A9A5B] animate-spin" />
        )}

        {/* Autocomplete Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-[#E5E1D8] rounded-2xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
            <div className="p-1.5 space-y-0.5">
              {suggestions.map((item, idx) => (
                <button
                  key={`${item.lat}-${item.lng}-${idx}`}
                  type="button"
                  onClick={() => handleSelectSuggestion(item)}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-[#4E3B31] hover:bg-[#F1EDE6] transition flex items-start gap-2 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5 text-[#8A9A5B] shrink-0 mt-0.5" />
                  <div className="truncate">
                    <span className="font-semibold block truncate">{item.name.split(',')[0]}</span>
                    <span className="text-[10px] text-[#8C8273] truncate block">{item.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Accordion for Precise Coordinates */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onToggleAdvancedOptions}
          className="w-full flex items-center justify-between p-3 rounded-2xl bg-white border border-[#E5E1D8] text-xs font-bold text-[#4E3B31] shadow-sm hover:bg-[#F1EDE6] transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#E2725B]" />
            <span>Detail-Koordinaten (Breitengrad & Längengrad)</span>
            <span className="px-2 py-0.5 rounded-md bg-[#8A9A5B]/15 text-[#8A9A5B] font-mono text-[10px]">
              {coordinates ? `${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}` : '0.0000, 0.0000'}
            </span>
          </div>
          {showAdvancedOptions ? <ChevronUp className="w-4 h-4 text-[#8C8273]" /> : <ChevronDown className="w-4 h-4 text-[#8C8273]" />}
        </button>

        {showAdvancedOptions && (
          <div className="mt-2.5 p-3.5 bg-white rounded-2xl border border-[#E5E1D8] shadow-sm space-y-3 animate-in fade-in duration-150">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#FDFBF7] p-2.5 rounded-xl border border-[#E5E1D8]">
                <span className="text-[10px] text-[#8C8273] font-semibold block mb-1">Lat (Breitengrad):</span>
                <input
                  type="number"
                  step="any"
                  value={coordinates?.lat ?? 0}
                  onChange={(e) => {
                    const newCoords = { lat: parseFloat(e.target.value) || 0, lng: coordinates?.lng || 0 };
                    onCoordinatesChange(newCoords);
                  }}
                  className="w-full bg-transparent font-mono text-[#4E3B31] focus:outline-none font-semibold text-xs"
                />
              </div>
              <div className="bg-[#FDFBF7] p-2.5 rounded-xl border border-[#E5E1D8]">
                <span className="text-[10px] text-[#8C8273] font-semibold block mb-1">Lng (Längengrad):</span>
                <input
                  type="number"
                  step="any"
                  value={coordinates?.lng ?? 0}
                  onChange={(e) => {
                    const newCoords = { lat: coordinates?.lat || 0, lng: parseFloat(e.target.value) || 0 };
                    onCoordinatesChange(newCoords);
                  }}
                  className="w-full bg-transparent font-mono text-[#4E3B31] focus:outline-none font-semibold text-xs"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
