import React, { useState, useEffect } from 'react';
import { GpsTrackData, GpsTrackPoint } from '../../types';
import { syncEngine } from '../../services/syncEngine';
import { getGradientColor, getGradientLabel } from '../../services/trackParser';
import {
  MapPin,
  Mountain,
  Plus,
  X,
  Navigation,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Gauge,
  Clock,
  Heart,
  Zap,
  Flag,
  Loader2
} from 'lucide-react';

interface TrackPointInspectorSheetProps {
  track: GpsTrackData;
  pointIndex: number;
  onSeekToIndex: (index: number) => void;
  onClose: () => void;
  onAddEntry: (
    point: GpsTrackPoint,
    track: GpsTrackData,
    pointIndex: number,
    locationName?: string
  ) => void;
  onCenterOnPoint?: (point: GpsTrackPoint) => void;
  theme?: 'light' | 'dark';
}

export const TrackPointInspectorSheet: React.FC<TrackPointInspectorSheetProps> = ({
  track,
  pointIndex,
  onSeekToIndex,
  onClose,
  onAddEntry,
  onCenterOnPoint,
  theme = 'light',
}) => {
  const points = track.points || [];
  const safeIdx = Math.max(0, Math.min(pointIndex, points.length - 1));
  const currentPt = points[safeIdx] || points[0];

  const [locationName, setLocationName] = useState<string>('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [showFullProfile, setShowFullProfile] = useState(false);

  // Reverse geocode location when point moves significantly
  useEffect(() => {
    if (!currentPt) return;
    let isCancelled = false;
    setIsGeocoding(true);

    const timer = setTimeout(async () => {
      try {
        const addr = await syncEngine.reverseGeocode(currentPt.lat, currentPt.lng);
        if (!isCancelled) {
          setLocationName(addr || '');
          setIsGeocoding(false);
        }
      } catch (err) {
        if (!isCancelled) {
          setIsGeocoding(false);
        }
      }
    }, 280);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [currentPt.lat, currentPt.lng]);

  if (!currentPt || points.length === 0) return null;

  const currentDist = currentPt.distance !== undefined
    ? currentPt.distance
    : Number(((safeIdx / Math.max(1, points.length - 1)) * track.summary.totalDistanceKm).toFixed(1));

  const totalDist = track.summary.totalDistanceKm || 1;
  const progressPercent = Math.min(100, Math.max(0, (currentDist / totalDist) * 100));

  const handleStep = (stepCount: number) => {
    const nextIdx = Math.max(0, Math.min(points.length - 1, safeIdx + stepCount));
    onSeekToIndex(nextIdx);
    if (onCenterOnPoint && points[nextIdx]) {
      onCenterOnPoint(points[nextIdx]);
    }
  };

  const slopeColor = getGradientColor(currentPt.slope);
  const slopeLabel = getGradientLabel(currentPt.slope);

  const formattedTime = currentPt.timestamp
    ? new Date(currentPt.timestamp).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div
      id="track-point-inspector-sheet"
      className="absolute bottom-16 md:bottom-6 left-2 right-2 sm:left-auto sm:right-6 sm:w-[420px] max-w-full z-[1000] animate-slide-up"
    >
      <div className="bg-[#FDFBF7]/95 dark:bg-[#1A1815]/95 backdrop-blur-xl border border-[#D5CEC2] dark:border-[#38322C] rounded-3xl shadow-2xl overflow-hidden transition-all text-[#4E3B31] dark:text-[#EDE8DF]">
        {/* Accent Color Line reflecting current slope */}
        <div
          className="h-1.5 w-full transition-colors duration-300"
          style={{ backgroundColor: slopeColor }}
        />

        <div className="p-3.5 sm:p-4 space-y-3">
          {/* Header Bar */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8A9A5B] dark:text-[#A7B67B] uppercase tracking-wider">
                <span className="inline-block w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                <span className="truncate">Strecken-Explorer · {track.title}</span>
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <h3 className="text-base sm:text-lg font-extrabold text-[#4E3B31] dark:text-[#FAF7F2] font-serif flex items-center gap-1.5 truncate">
                  <span>km {currentDist.toFixed(1)}</span>
                  <span className="text-xs font-normal text-[#8C8273] dark:text-[#A89C8F]">
                    / {totalDist.toFixed(1)} km
                  </span>
                </h3>
                {currentPt.altitude !== undefined && (
                  <span className="px-2 py-0.5 rounded-lg bg-[#E2725B]/15 text-[#E2725B] text-xs font-bold font-mono">
                    ⛰️ {Math.round(currentPt.altitude)} m
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {onCenterOnPoint && (
                <button
                  type="button"
                  onClick={() => onCenterOnPoint(currentPt)}
                  className="p-2 rounded-xl bg-white dark:bg-[#2A2622] hover:bg-[#E5E1D8] dark:hover:bg-[#38322C] text-[#6B5E55] dark:text-[#C8B8A6] border border-[#E5E1D8] dark:border-[#38322C] shadow-xs transition"
                  title="Auf der Karte zentrieren"
                >
                  <Navigation className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-white dark:bg-[#2A2622] hover:bg-[#E5E1D8] dark:hover:bg-[#38322C] text-[#6B5E55] dark:text-[#C8B8A6] border border-[#E5E1D8] dark:border-[#38322C] shadow-xs transition"
                title="Schließen"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Reverse Geocoded Address Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-[#24201C]/80 border border-[#E5E1D8] dark:border-[#38322C] text-xs">
            <MapPin className="w-3.5 h-3.5 text-[#E2725B] shrink-0" />
            <div className="flex-1 truncate">
              {isGeocoding ? (
                <span className="flex items-center gap-1.5 text-[#8C8273] dark:text-[#A89C8F] italic text-[11px]">
                  <Loader2 className="w-3 h-3 animate-spin text-[#8A9A5B]" />
                  <span>Ort wird ermittelt...</span>
                </span>
              ) : (
                <span className="font-semibold text-[#4E3B31] dark:text-[#EDE8DF] truncate block">
                  {locationName || `${currentPt.lat.toFixed(4)}, ${currentPt.lng.toFixed(4)}`}
                </span>
              )}
            </div>
          </div>

          {/* Telemetry Chips (Slope, Speed, HeartRate, Time) */}
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            {/* Slope */}
            <div className="p-2 rounded-xl bg-white/70 dark:bg-[#24201C]/70 border border-[#E5E1D8] dark:border-[#38322C] flex flex-col items-center justify-center text-center">
              <span className="text-[10px] text-[#8C8273] dark:text-[#A89C8F] font-medium">Steigung</span>
              <span
                className="font-bold font-mono text-xs mt-0.5"
                style={{ color: slopeColor }}
              >
                {currentPt.slope !== undefined
                  ? `${currentPt.slope > 0 ? '+' : ''}${currentPt.slope}%`
                  : '0%'}
              </span>
            </div>

            {/* Speed / Pace */}
            <div className="p-2 rounded-xl bg-white/70 dark:bg-[#24201C]/70 border border-[#E5E1D8] dark:border-[#38322C] flex flex-col items-center justify-center text-center">
              <span className="text-[10px] text-[#8C8273] dark:text-[#A89C8F] font-medium">Tempo</span>
              <span className="font-bold font-mono text-xs text-[#4E3B31] dark:text-[#EDE8DF] mt-0.5 flex items-center gap-0.5">
                <Gauge className="w-3 h-3 text-[#8A9A5B]" />
                {currentPt.speed !== undefined ? `${currentPt.speed.toFixed(1)} km/h` : '–'}
              </span>
            </div>

            {/* Time / HR */}
            <div className="p-2 rounded-xl bg-white/70 dark:bg-[#24201C]/70 border border-[#E5E1D8] dark:border-[#38322C] flex flex-col items-center justify-center text-center">
              <span className="text-[10px] text-[#8C8273] dark:text-[#A89C8F] font-medium">
                {currentPt.heartRate ? 'Puls' : 'Uhrzeit'}
              </span>
              <span className="font-bold font-mono text-xs text-[#4E3B31] dark:text-[#EDE8DF] mt-0.5 flex items-center gap-0.5">
                {currentPt.heartRate ? (
                  <>
                    <Heart className="w-3 h-3 text-red-500 fill-red-500" />
                    <span>{currentPt.heartRate} bpm</span>
                  </>
                ) : formattedTime ? (
                  <>
                    <Clock className="w-3 h-3 text-[#D4A373]" />
                    <span>{formattedTime}</span>
                  </>
                ) : (
                  <span>Passhöhe</span>
                )}
              </span>
            </div>
          </div>

          {/* Touch-Ergonomic Scrubber Slider with Stepper Buttons */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleStep(-10)}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#2A2622] hover:bg-[#E5E1D8] dark:hover:bg-[#38322C] active:scale-95 text-xs font-bold border border-[#E5E1D8] dark:border-[#38322C] transition shadow-2xs flex items-center gap-0.5"
                title="Schritt zurück"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>-200m</span>
              </button>

              <div className="flex-1 relative flex items-center">
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, points.length - 1)}
                  value={safeIdx}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    onSeekToIndex(val);
                    if (onCenterOnPoint && points[val]) {
                      onCenterOnPoint(points[val]);
                    }
                  }}
                  className="w-full h-2.5 bg-[#E5E1D8] dark:bg-[#38322C] rounded-lg appearance-none cursor-pointer accent-[#E2725B] focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => handleStep(10)}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#2A2622] hover:bg-[#E5E1D8] dark:hover:bg-[#38322C] active:scale-95 text-xs font-bold border border-[#E5E1D8] dark:border-[#38322C] transition shadow-2xs flex items-center gap-0.5"
                title="Schritt vor"
              >
                <span>+200m</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Milestone Chips for Mobile */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[10px]">
              <button
                type="button"
                onClick={() => {
                  onSeekToIndex(0);
                  if (onCenterOnPoint && points[0]) onCenterOnPoint(points[0]);
                }}
                className={`px-2 py-0.5 rounded-full font-bold whitespace-nowrap transition border ${
                  safeIdx === 0
                    ? 'bg-[#10B981] text-white border-[#10B981]'
                    : 'bg-white dark:bg-[#2A2622] text-[#4E3B31] dark:text-[#EDE8DF] border-[#E5E1D8] dark:border-[#38322C]'
                }`}
              >
                🏁 Start (km 0.0)
              </button>

              {track.highlights?.map((h, idx) => {
                const isSelected = Math.abs(safeIdx - h.pointIndex) < 5;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onSeekToIndex(h.pointIndex);
                      if (onCenterOnPoint && points[h.pointIndex]) onCenterOnPoint(points[h.pointIndex]);
                    }}
                    className={`px-2 py-0.5 rounded-full font-bold whitespace-nowrap transition border ${
                      isSelected
                        ? 'bg-[#E2725B] text-white border-[#E2725B]'
                        : 'bg-white dark:bg-[#2A2622] text-[#4E3B31] dark:text-[#EDE8DF] border-[#E5E1D8] dark:border-[#38322C]'
                    }`}
                  >
                    {h.type === 'summit' ? '⛰️ ' : h.type === 'max_speed' ? '⚡ ' : '📍 '}
                    {h.title}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  const endIdx = points.length - 1;
                  onSeekToIndex(endIdx);
                  if (onCenterOnPoint && points[endIdx]) onCenterOnPoint(points[endIdx]);
                }}
                className={`px-2 py-0.5 rounded-full font-bold whitespace-nowrap transition border ${
                  safeIdx === points.length - 1
                    ? 'bg-[#E11D48] text-white border-[#E11D48]'
                    : 'bg-white dark:bg-[#2A2622] text-[#4E3B31] dark:text-[#EDE8DF] border-[#E5E1D8] dark:border-[#38322C]'
                }`}
              >
                🏆 Ziel (km {totalDist.toFixed(1)})
              </button>
            </div>
          </div>

          {/* Primary High-Impact Call to Action Button */}
          <button
            type="button"
            id="btn-add-entry-at-trackpoint"
            onClick={() => {
              if (navigator.vibrate) {
                navigator.vibrate(20);
              }
              onAddEntry(currentPt, track, safeIdx, locationName);
            }}
            className="w-full py-3 px-4 rounded-2xl bg-[#E2725B] hover:bg-[#D0624C] active:scale-[0.98] text-white font-bold text-sm shadow-lg shadow-[#E2725B]/25 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Reiseeintrag bei km {currentDist.toFixed(1)} anlegen</span>
          </button>
        </div>
      </div>
    </div>
  );
};
