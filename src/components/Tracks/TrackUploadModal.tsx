import React, { useState, useRef } from 'react';
import { parseTrackFile, formatTourDuration } from '../../services/trackParser';
import { SAMPLE_FIT_TOURS } from '../../data/sampleFitTours';
import { GpsTrackData, Trip, Collaborator, ThemeMode } from '../../types';
import { TrackElevationProfile } from './TrackElevationProfile';
import {
  X,
  UploadCloud,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Mountain,
  Gauge,
  Heart,
  Zap,
  Sparkles,
  Compass,
  ArrowRight,
  Flame,
  PlusCircle,
  MapPin,
  Route as RouteIcon,
  Layers,
} from 'lucide-react';

interface TrackUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTrackAsEntry: (trackData: GpsTrackData) => void;
  onAttachTrackToTrip?: (trackData: GpsTrackData) => void;
  activeTrip?: Trip | null;
  currentUser?: Collaborator;
  theme?: ThemeMode;
}

export const TrackUploadModal: React.FC<TrackUploadModalProps> = ({
  isOpen,
  onClose,
  onAddTrackAsEntry,
  onAttachTrackToTrip,
  activeTrip,
  currentUser,
  theme = 'light',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [parsedTrack, setParsedTrack] = useState<GpsTrackData | null>(null);
  const [previewPointIndex, setPreviewPointIndex] = useState(0);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.gpx') && !lowerName.endsWith('.fit')) {
      setErrorMessage('Bitte wähle eine gültige .gpx oder .fit Datei (z. B. von Garmin, Strava, Komoot, Wahoo).');
      return;
    }

    setErrorMessage(null);
    setIsParsing(true);

    try {
      const trackData = await parseTrackFile(file);
      setParsedTrack(trackData);
      setPreviewPointIndex(0);
    } catch (err: any) {
      console.error('Error parsing track file:', err);
      setErrorMessage(err.message || 'Fehler beim Einlesen der GPX/FIT Datei.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleSelectSample = (sample: GpsTrackData) => {
    setParsedTrack(sample);
    setPreviewPointIndex(0);
    setErrorMessage(null);
  };

  return (
    <div
      id="track-upload-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] bg-[#FDFBF7] dark:bg-[#1E1B18] rounded-3xl border border-[#E5E1D8] dark:border-[#38322C] shadow-2xl overflow-hidden flex flex-col my-auto transition-colors duration-200">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#E5E1D8] dark:border-[#38322C] flex items-center justify-between bg-white/50 dark:bg-[#24201D]/50 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#8A9A5B] text-white flex items-center justify-center shadow-md text-xl shrink-0">
              <RouteIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-bold font-serif text-[#4E3B31] dark:text-[#EDE8DF] truncate">
                GPS-Track importieren (.GPX / .FIT)
              </h2>
              <p className="text-[11px] sm:text-xs text-[#8C8273] dark:text-[#9C9182] truncate">
                Strecken von Garmin, Wahoo, Strava, Komoot & Apple Watch
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-full text-[#8C8273] hover:text-[#4E3B31] dark:text-[#9C9182] dark:hover:text-[#EDE8DF] hover:bg-[#F1EDE6] dark:hover:bg-[#2E2A26] transition shrink-0 cursor-pointer"
            title="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto max-h-[calc(92vh-70px)]">
          {/* File Upload Drop Zone */}
          {!parsedTrack && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-5 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-[#8A9A5B] bg-[#8A9A5B]/5 scale-[1.01]'
                  : 'border-[#E5E1D8] dark:border-[#38322C] bg-[#F8F5EE]/60 dark:bg-[#24201D]/60 hover:bg-[#F1EDE6] dark:hover:bg-[#2E2A26]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".gpx,.fit"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileProcess(e.target.files[0]);
                  }
                }}
              />

              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#8A9A5B]/15 text-[#8A9A5B] flex items-center justify-center mb-3 shadow-inner shrink-0">
                {isParsing ? (
                  <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 animate-spin" />
                ) : (
                  <UploadCloud className="w-7 h-7 sm:w-8 sm:h-8" />
                )}
              </div>

              <h3 className="text-sm sm:text-base font-bold text-[#4E3B31] dark:text-[#EDE8DF] break-words max-w-full px-2">
                {isParsing ? 'Analysiere GPS-Streckendaten...' : '.GPX oder .FIT Datei hier ablegen oder auswählen'}
              </h3>
              <p className="text-[11px] sm:text-xs text-[#8C8273] dark:text-[#9C9182] max-w-sm mt-1 px-2 break-words">
                Liest GPS-Koordinaten, Höhenmeter, Distanz, Geschwindigkeit, Zeiten & Sensorwerte ein.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2 mt-3 sm:mt-4">
                <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#342F2A] border border-[#E5E1D8] dark:border-[#38322C] text-[11px] font-bold text-[#4E3B31] dark:text-[#EDE8DF] font-mono">
                  .GPX
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#342F2A] border border-[#E5E1D8] dark:border-[#38322C] text-[11px] font-bold text-[#4E3B31] dark:text-[#EDE8DF] font-mono">
                  .FIT
                </span>
                <button
                  type="button"
                  className="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[#8A9A5B] hover:bg-[#78884E] text-white text-xs font-bold transition shadow-sm ml-1 cursor-pointer"
                >
                  Datei auswählen
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 break-words">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="min-w-0 flex-1">{errorMessage}</span>
            </div>
          )}

          {/* Track Summary & Preview if loaded */}
          {parsedTrack && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-[#24201D] border border-[#E5E1D8] dark:border-[#38322C] shadow-sm overflow-hidden">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#8A9A5B]/15 text-[#8A9A5B] font-bold text-[10px] uppercase tracking-wider font-mono shrink-0">
                        {parsedTrack.format?.toUpperCase() || 'GPS'} Track bereit
                      </span>
                      <span className="text-[11px] text-[#8C8273] font-mono shrink-0">
                        {parsedTrack.points.length} GPS-Punkte
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-[#4E3B31] dark:text-[#EDE8DF] font-serif mt-1 break-words">
                      {parsedTrack.title}
                    </h3>
                    {parsedTrack.description && (
                      <p className="text-xs text-[#8C8273] dark:text-[#9C9182] break-words line-clamp-2 mt-0.5">
                        {parsedTrack.description}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setParsedTrack(null)}
                    className="text-xs text-[#8C8273] hover:text-[#E2725B] underline shrink-0 cursor-pointer ml-2"
                  >
                    Andere Datei
                  </button>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-[#E5E1D8] dark:border-[#38322C]">
                  <div className="p-2.5 rounded-xl bg-[#F8F5EE] dark:bg-[#1E1B18] min-w-0">
                    <span className="text-[10px] text-[#8C8273] dark:text-[#9C9182] flex items-center gap-1 truncate">
                      <Compass className="w-3 h-3 text-[#8A9A5B] shrink-0" /> Distanz
                    </span>
                    <p className="text-sm sm:text-base font-bold text-[#4E3B31] dark:text-[#EDE8DF] font-mono truncate">
                      {parsedTrack.summary.totalDistanceKm} km
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#F8F5EE] dark:bg-[#1E1B18] min-w-0">
                    <span className="text-[10px] text-[#8C8273] dark:text-[#9C9182] flex items-center gap-1 truncate">
                      <Mountain className="w-3 h-3 text-[#E2725B] shrink-0" /> Höhenmeter
                    </span>
                    <p className="text-sm sm:text-base font-bold text-[#E2725B] font-mono truncate">
                      +{parsedTrack.summary.elevationGainM} hm
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#F8F5EE] dark:bg-[#1E1B18] min-w-0">
                    <span className="text-[10px] text-[#8C8273] dark:text-[#9C9182] flex items-center gap-1 truncate">
                      <Gauge className="w-3 h-3 text-amber-500" /> Max. Höhe
                    </span>
                    <p className="text-sm sm:text-base font-bold text-[#4E3B31] dark:text-[#EDE8DF] font-mono truncate">
                      {parsedTrack.summary.maxAltitudeM} m
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#F8F5EE] dark:bg-[#1E1B18] min-w-0">
                    <span className="text-[10px] text-[#8C8273] dark:text-[#9C9182] flex items-center gap-1 truncate">
                      <Flame className="w-3 h-3 text-red-500" /> Dauer
                    </span>
                    <p className="text-sm sm:text-base font-bold text-[#4E3B31] dark:text-[#EDE8DF] font-mono truncate">
                      {formatTourDuration(parsedTrack.summary.totalDurationSec)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Elevation Profile Preview */}
              <TrackElevationProfile
                points={parsedTrack.points}
                highlights={parsedTrack.highlights}
                currentPointIndex={previewPointIndex}
                onSeekToIndex={(idx) => setPreviewPointIndex(idx)}
                height={110}
              />

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onAddTrackAsEntry(parsedTrack);
                    onClose();
                  }}
                  className="py-3 px-4 rounded-2xl bg-[#8A9A5B] hover:bg-[#78884E] text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 active:scale-98 transition cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 shrink-0" />
                  <span className="truncate">Als Tagebuch-Stopp anlegen</span>
                </button>

                {onAttachTrackToTrip && (
                  <button
                    type="button"
                    onClick={() => {
                      onAttachTrackToTrip(parsedTrack);
                      onClose();
                    }}
                    className="py-3 px-4 rounded-2xl bg-[#E2725B] hover:bg-[#D46049] text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 active:scale-98 transition cursor-pointer"
                  >
                    <Layers className="w-4 h-4 shrink-0" />
                    <span className="truncate">Als Route auf Karte anheften</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Sample GPS Tracks selector if no file is selected */}
          {!parsedTrack && (
            <div className="space-y-2 pt-2 border-t border-[#E5E1D8] dark:border-[#38322C]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#6B5E55] dark:text-[#C4B9AA] flex items-center gap-1.5 truncate">
                  <Sparkles className="w-3.5 h-3.5 text-[#8A9A5B] shrink-0" />
                  <span>Keine Datei zur Hand? Teste ein Beispiel:</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {SAMPLE_FIT_TOURS.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => handleSelectSample(sample)}
                    className="p-3 rounded-2xl bg-white dark:bg-[#24201D] border border-[#E5E1D8] dark:border-[#38322C] hover:border-[#8A9A5B] text-left transition hover:shadow-md group flex flex-col justify-between overflow-hidden cursor-pointer"
                  >
                    <div className="min-w-0 w-full overflow-hidden">
                      <span className="text-[10px] font-bold font-mono text-[#8A9A5B] uppercase block truncate">
                        {sample.summary.subSport === 'road' ? 'Rennrad / Route' : 'Gravel / Berg'}
                      </span>
                      <h4 className="text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF] truncate group-hover:text-[#8A9A5B] transition">
                        {sample.title}
                      </h4>
                      <p className="text-[11px] text-[#8C8273] dark:text-[#9C9182] mt-0.5 font-mono truncate">
                        {sample.summary.totalDistanceKm} km • +{sample.summary.elevationGainM} hm
                      </p>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] font-bold text-[#8A9A5B] mt-2 group-hover:translate-x-0.5 transition shrink-0">
                      <span>Laden</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
