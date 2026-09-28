import React, { useState, useEffect, useCallback } from 'react';
import { JournalEntry, Coordinates, MediaItem, CategoryType, Collaborator, WeatherInfo } from '../../types';
import { CATEGORIES } from '../../data/initialData';
import { syncEngine } from '../../services/syncEngine';
import { fetchHistoricalWeather, WeatherFetchResult } from '../../services/weatherService';
import { processMobileMediaFile, ProcessedMediaResult, getLiveDeviceCoordinates } from '../../services/mobileMediaService';
import { MobileSyncQrModal } from './MobileSyncQrModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { MediaUploadSection } from './EntryModal/MediaUploadSection';
import { WeatherSection, WEATHER_OPTIONS } from './EntryModal/WeatherSection';
import { LocationSection } from './EntryModal/LocationSection';
import {
  X,
  MapPin,
  Calendar,
  Trash2,
  Image as ImageIcon,
  ArrowLeft,
  Check,
} from 'lucide-react';

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entryData: Partial<JournalEntry>) => void;
  onDelete?: (entryId: string) => void;
  initialCoords?: Coordinates | null;
  initialAddress?: string;
  initialTitle?: string;
  initialNote?: string;
  initialDate?: string;
  initialCategory?: CategoryType;
  tripDefaultCoords?: Coordinates | null;
  tripStartDate?: string;
  tripId: string;
  currentUser: Collaborator;
  editingEntry?: JournalEntry | null;
}

const MOOD_OPTIONS = [
  '🤩 Begeistert',
  '🌅 Magisch',
  '🥾 Abenteuerlich',
  '😋 Lecker',
  '😴 Erschöpft',
  '⚡ Elektrisierend',
  '🌊 Entspannt',
  '⛩️ Spirituell',
  '❤️ Glücklich',
];

export const EntryModal: React.FC<EntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialCoords,
  initialAddress,
  initialTitle,
  initialNote,
  initialDate,
  initialCategory,
  tripDefaultCoords,
  tripStartDate,
  tripId,
  currentUser,
  editingEntry,
}) => {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState<CategoryType>('sight');
  const [mood, setMood] = useState('🤩 Begeistert');
  const [weatherLabel, setWeatherLabel] = useState('Sonnig & heiter');
  const [weatherTemp, setWeatherTemp] = useState<number | ''>(22);
  const [weatherDetails, setWeatherDetails] = useState<WeatherInfo | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [, setWeatherNotice] = useState<string | null>(null);
  const [locationName, setLocationName] = useState('');
  const [coordinates, setCoordinates] = useState<Coordinates>({ lat: 48.137, lng: 11.576 });
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showManualWeatherEdit, setShowManualWeatherEdit] = useState(false);

  // Mobile and media upload states
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [processingProgressText, setProcessingProgressText] = useState('');
  const [processingProgressPercent, setProcessingProgressPercent] = useState(0);
  const [processingCurrentFile, setProcessingCurrentFile] = useState('');
  const [processingStats, setProcessingStats] = useState<{ current: number; total: number } | null>(null);
  const [exifNotice, setExifNotice] = useState<string | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Fetch weather helper
  const loadWeatherForLocationAndDate = useCallback(
    async (coords: Coordinates, dateString: string, isManual = false) => {
      if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number' || !dateString) {
        return;
      }
      setIsLoadingWeather(true);
      try {
        const result: WeatherFetchResult | null = await fetchHistoricalWeather(coords, dateString);
        if (result && result.weather) {
          setWeatherDetails(result.weather);
          setWeatherLabel(result.weather.label);
          if (result.weather.temp !== undefined) {
            setWeatherTemp(result.weather.temp);
          }
          const minMaxStr =
            result.weather.tempMin !== undefined && result.weather.tempMax !== undefined
              ? ` (${result.weather.tempMin}°C bis ${result.weather.tempMax}°C)`
              : '';
          const rainStr = result.weather.precipitation ? ` · ${result.weather.precipitation} mm Regen` : '';
          const windStr = result.weather.windSpeed ? ` · ${result.weather.windSpeed} km/h Wind` : '';
          const histText = result.isHistorical ? 'Historische Wetterdaten' : 'Wetterdaten';

          setWeatherNotice(
            `🌤️ ${histText} automatisch abgerufen: ${result.weather.temp !== undefined ? `${result.weather.temp}°C, ` : ''}${result.weather.label}${minMaxStr}${rainStr}${windStr}`
          );
        }
      } catch (err) {
        console.warn('Weather auto-fetch error:', err);
        if (isManual) {
          setWeatherNotice('Wetterdaten konnten für diesen Zeitpunkt nicht geladen werden.');
        }
      } finally {
        setIsLoadingWeather(false);
      }
    },
    []
  );

  // Populate data when opening or editing
  useEffect(() => {
    if (editingEntry) {
      setTitle(editingEntry.title);
      setNote(editingEntry.note);
      setDate(editingEntry.date ? editingEntry.date.split('T')[0] : new Date().toISOString().split('T')[0]);
      setCategory(editingEntry.category);
      setMood(editingEntry.mood || '🤩 Begeistert');
      setWeatherLabel(editingEntry.weather?.label || 'Sonnig & heiter');
      setWeatherTemp(editingEntry.weather?.temp ?? 22);
      setWeatherDetails(editingEntry.weather || null);
      setLocationName(editingEntry.locationName || '');
      setCoordinates(editingEntry.coordinates || initialCoords || { lat: 48.137, lng: 11.576 });
      setMediaList(editingEntry.media || []);
      setExifNotice(null);
      setWeatherNotice(
        editingEntry.weather?.source
          ? `🌤️ Gespeicherte Wetterdaten: ${editingEntry.weather.temp !== undefined ? `${editingEntry.weather.temp}°C, ` : ''}${editingEntry.weather.label}`
          : null
      );
    } else {
      const now = new Date();
      const defaultDateStr = initialDate || (tripStartDate && tripStartDate.length === 10 ? tripStartDate : now.toISOString().split('T')[0]);
      setDate(defaultDateStr);

      if (initialCategory) {
        setCategory(initialCategory);
      } else {
        setCategory('sight');
      }

      if (initialNote) {
        setNote(initialNote);
      } else {
        setNote('');
      }

      if (initialTitle) {
        setTitle(initialTitle);
      } else {
        setTitle('');
      }

      setMediaList([]);
      setExifNotice(null);

      // Determine starting coordinates for the new entry
      const targetCoords = initialCoords || tripDefaultCoords || { lat: 48.137, lng: 11.576 };
      setCoordinates(targetCoords);

      if (initialAddress) {
        setLocationName(initialAddress);
        if (!initialTitle) {
          const shortName = initialAddress.split(',')[0].trim();
          setTitle(shortName || initialAddress);
        }
      } else {
        setIsGeocoding(true);
        syncEngine.reverseGeocode(targetCoords.lat, targetCoords.lng).then((addr) => {
          setLocationName(addr);
          if (addr && !initialTitle) {
            const shortName = addr.split(',')[0].trim();
            setTitle(shortName || addr);
          }
          setIsGeocoding(false);
        });
      }

      // Automatically fetch historical weather for the new entry based on location & travel date
      loadWeatherForLocationAndDate(targetCoords, defaultDateStr);
    }
  }, [editingEntry, initialCoords, initialAddress, initialTitle, initialNote, initialDate, initialCategory, tripDefaultCoords, tripStartDate, isOpen, loadWeatherForLocationAndDate]);

  if (!isOpen) return null;

  // Handle File Upload from iPhone / Android Mediathek / Desktop with EXIF GPS parsing & image compression
  const handleFilesSelected = async (files: FileList | null | File[]) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const totalFiles = fileArray.length;
    setIsProcessingMedia(true);
    setProcessingProgressPercent(5);
    const newItems: MediaItem[] = [];
    let detectedGps: Coordinates | null = null;
    let detectedDate: string | null = null;
    let detectedDevice: string | null = null;

    try {
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setProcessingCurrentFile(file.name);
        setProcessingStats({ current: i + 1, total: totalFiles });

        const basePercent = (i / totalFiles) * 100;
        const fileWeight = 100 / totalFiles;

        const onFileProgress = (stage: string, percentInFile: number) => {
          const currentTotal = Math.min(99, Math.round(basePercent + (percentInFile / 100) * fileWeight));
          setProcessingProgressPercent(currentTotal);
          setProcessingProgressText(
            totalFiles > 1
              ? `[${i + 1}/${totalFiles}] ${file.name}: ${stage}`
              : `${file.name}: ${stage}`
          );
        };

        try {
          const result: ProcessedMediaResult = await processMobileMediaFile(file, onFileProgress);
          newItems.push(result.mediaItem);

          if (result.exifGps && !detectedGps) {
            detectedGps = result.exifGps;
          }
          if (result.exifDate && !detectedDate) {
            detectedDate = result.exifDate;
          }
          if (result.deviceModel && !detectedDevice) {
            detectedDevice = result.deviceModel;
          }
        } catch (err) {
          console.error('Error processing media file:', err);
          setExifNotice(`⚠️ Bild "${file.name}" konnte nicht verarbeitet werden.`);
        }
      }

      setProcessingProgressPercent(100);
      setProcessingProgressText('Fotos erfolgreich verarbeitet');
      setMediaList((prev) => [...prev, ...newItems]);
    } catch (outerErr) {
      console.error('Outer error handling files:', outerErr);
    } finally {
      setTimeout(() => {
        setIsProcessingMedia(false);
        setProcessingProgressText('');
        setProcessingProgressPercent(0);
        setProcessingCurrentFile('');
        setProcessingStats(null);
      }, 350);
    }

    // Set date if detected from EXIF, file modification time, or filename
    let formattedDateString = '';
    let targetDateToUse = date;
    if (detectedDate) {
      const parsedDate = detectedDate.split('T')[0];
      if (parsedDate && /^\d{4}-\d{2}-\d{2}$/.test(parsedDate)) {
        setDate(parsedDate);
        targetDateToUse = parsedDate;
        try {
          formattedDateString = new Date(detectedDate).toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });
        } catch {
          formattedDateString = parsedDate;
        }
      }
    }

    const devText = detectedDevice ? ` (${detectedDevice})` : '';

    // If no GPS was embedded in EXIF (e.g. live camera snap in Android Chrome), attempt live device GPS fallback
    if (!detectedGps && typeof window !== 'undefined' && navigator.geolocation) {
      try {
        const liveGps = await getLiveDeviceCoordinates(3000);
        if (liveGps) {
          detectedGps = liveGps;
        }
      } catch {
        // ignore
      }
    }

    // If GPS was found in the smartphone photo EXIF or live fallback, auto-update coordinates and reverse geocode!
    if (detectedGps) {
      const gpsToUse = detectedGps;
      setCoordinates(gpsToUse);
      setShowMapPicker(true);
      setIsGeocoding(true);
      syncEngine.reverseGeocode(gpsToUse.lat, gpsToUse.lng).then((addr) => {
        setLocationName(addr);
        if (!title.trim() && addr) {
          const shortPlace = addr.split(',')[0].trim();
          setTitle(shortPlace || addr);
        }
        setIsGeocoding(false);
        loadWeatherForLocationAndDate(gpsToUse, targetDateToUse);
      });

      if (formattedDateString) {
        setExifNotice(`📍 GPS-Standort & 📅 Aufnahmedatum (${formattedDateString}) aus Foto übernommen${devText}!`);
      } else {
        setExifNotice(`📍 GPS-Standort (${gpsToUse.lat.toFixed(4)}, ${gpsToUse.lng.toFixed(4)}) aus Foto übernommen${devText}!`);
      }
    } else {
      setShowMapPicker(true);
      if (formattedDateString) {
        setExifNotice(`📅 Aufnahmedatum (${formattedDateString}) aus Foto übernommen. ℹ️ Foto enthält keine GPS-Standortdaten. Wähle den Ort auf der Karte.`);
        // Immediately fetch historical weather for the photo's date at current location
        if (coordinates) {
          loadWeatherForLocationAndDate(coordinates, targetDateToUse);
        }
      } else {
        setExifNotice('📸 Foto hinzugefügt. ℹ️ Foto enthält keine EXIF-Metadaten. Wähle den Ort einfach auf der Karte oder per GPS-Button.');
      }

      if (!title.trim() && fileArray[0]) {
        const cleanName = fileArray[0].name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        if (cleanName.length > 2 && !cleanName.startsWith('IMG') && !cleanName.startsWith('PXL')) {
          setTitle(cleanName);
        }
      }
    }
  };

  const handleRemoveMedia = (mediaId: string) => {
    setMediaList((prev) => prev.filter((m) => m.id !== mediaId));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const shortPlace = locationName.trim() ? locationName.split(',')[0].trim() : '';
      const finalTitle = title.trim() || shortPlace || locationName.trim() || 'Reiseerinnerung';

      const matchedOption = WEATHER_OPTIONS.find((w) => w.label === weatherLabel);
      const finalWeather: WeatherInfo = {
        icon: matchedOption?.icon || weatherDetails?.icon || 'sun',
        temp: weatherTemp === '' || isNaN(Number(weatherTemp)) ? undefined : Number(weatherTemp),
        label: weatherLabel || 'Sonnig & heiter',
        tempMin: weatherDetails?.tempMin,
        tempMax: weatherDetails?.tempMax,
        precipitation: weatherDetails?.precipitation,
        windSpeed: weatherDetails?.windSpeed,
        weatherCode: weatherDetails?.weatherCode,
        source: weatherDetails?.source || 'Historische Wetterdaten (Open-Meteo)',
        isHistorical: weatherDetails?.isHistorical ?? true,
      };

      const finalLat = typeof coordinates?.lat === 'number' && !isNaN(coordinates.lat) ? coordinates.lat : 48.137154;
      const finalLng = typeof coordinates?.lng === 'number' && !isNaN(coordinates.lng) ? coordinates.lng : 11.576124;
      const finalCoords: Coordinates = {
        lat: Number(finalLat.toFixed(6)),
        lng: Number(finalLng.toFixed(6)),
      };

      let safeIsoDate = new Date().toISOString();
      if (date && typeof date === 'string' && date.trim()) {
        try {
          const parsed = new Date(date);
          if (!isNaN(parsed.getTime())) {
            safeIsoDate = parsed.toISOString();
          }
        } catch {
          safeIsoDate = new Date().toISOString();
        }
      }

      const payload: Partial<JournalEntry> = {
        tripId: tripId || (editingEntry ? editingEntry.tripId : undefined),
        title: finalTitle,
        note: (note || '').trim(),
        date: safeIsoDate,
        coordinates: finalCoords,
        locationName: locationName.trim() || `${finalCoords.lat.toFixed(4)}, ${finalCoords.lng.toFixed(4)}`,
        category: category || 'sight',
        mood: mood || '🤩 Begeistert',
        weather: finalWeather,
        media: mediaList || [],
        author: editingEntry ? editingEntry.author : currentUser,
      };

      onSave(payload);
      onClose();
    } catch (err) {
      console.error('Error submitting journal entry:', err);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col bg-[#FDFBF7] sm:items-center sm:justify-center sm:p-4 sm:bg-[#4E3B31]/60 sm:backdrop-blur-sm sm:overflow-y-auto">
        <div className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl bg-[#FDFBF7] sm:border sm:border-[#E5E1D8] sm:rounded-3xl sm:shadow-2xl flex flex-col overflow-hidden">
          
          {/* Mobile & Desktop Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-[#E5E1D8] bg-[#F1EDE6]/90 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="p-2 -ml-2 rounded-xl text-[#6B5E55] hover:text-[#4E3B31] hover:bg-[#E5E1D8] transition sm:hidden flex items-center gap-1 text-xs font-semibold"
                title="Zurück"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="p-2 rounded-xl bg-[#8A9A5B]/15 border border-[#8A9A5B]/30 text-[#8A9A5B] hidden sm:block">
                <ImageIcon className="w-5 h-5" />
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#4E3B31] font-serif leading-tight">
                  {editingEntry ? 'Erinnerung bearbeiten' : 'Neuer Reiseeintrag'}
                </h3>
                <div className="flex items-center gap-1.5 text-[11px] text-[#8C8273]">
                  {locationName ? (
                    <span className="text-[#E2725B] font-semibold flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate max-w-[180px] sm:max-w-[260px]">{locationName.split(',')[0]}</span>
                    </span>
                  ) : (
                    <span className="hidden sm:block">Fotos, Notizen & GPS-Koordinaten festhalten</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={isProcessingMedia}
                className="sm:hidden px-4 py-1.5 rounded-xl bg-[#E2725B] hover:bg-[#D46049] text-white font-bold text-xs shadow-md shadow-[#E2725B]/20 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Fertig</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="hidden sm:flex p-2 rounded-xl text-[#6B5E55] hover:text-[#4E3B31] hover:bg-[#E5E1D8] transition cursor-pointer"
                title="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form Scroll Area */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 pb-28 sm:pb-6">
            
            {/* Modular Photo Upload Section */}
            <MediaUploadSection
              mediaList={mediaList}
              isProcessingMedia={isProcessingMedia}
              processingProgressText={processingProgressText}
              processingProgressPercent={processingProgressPercent}
              processingCurrentFile={processingCurrentFile}
              processingStats={processingStats}
              exifNotice={exifNotice}
              showMapPicker={showMapPicker}
              onFilesSelected={handleFilesSelected}
              onRemoveMedia={handleRemoveMedia}
              onOpenQrModal={() => setIsQrModalOpen(true)}
              onToggleMapPicker={() => setShowMapPicker((prev) => !prev)}
              onExifLocationJump={(loc, photoDate) => {
                setCoordinates(loc);
                setShowMapPicker(true);
                setIsGeocoding(true);
                let targetDate = date;
                if (photoDate) {
                  const parsed = photoDate.split('T')[0];
                  if (parsed && /^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
                    setDate(parsed);
                    targetDate = parsed;
                  }
                }
                syncEngine.reverseGeocode(loc.lat, loc.lng).then((addr) => {
                  setLocationName(addr);
                  setIsGeocoding(false);
                  loadWeatherForLocationAndDate(loc, targetDate);
                });
              }}
              onExifDateJump={(photoDate, photoLoc) => {
                const targetDate = photoDate.split('T')[0];
                if (targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
                  setDate(targetDate);
                  const targetCoords = photoLoc || coordinates;
                  if (photoLoc) {
                    setCoordinates(photoLoc);
                    setShowMapPicker(true);
                    setIsGeocoding(true);
                    syncEngine.reverseGeocode(photoLoc.lat, photoLoc.lng).then((addr) => {
                      setLocationName(addr);
                      setIsGeocoding(false);
                      loadWeatherForLocationAndDate(photoLoc, targetDate);
                    });
                  } else {
                    loadWeatherForLocationAndDate(targetCoords, targetDate);
                  }
                  const formatted = new Date(photoDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                  setExifNotice(`📅 Reisedatum (${formatted}) aus Foto übernommen!`);
                }
              }}
              onClearExifNotice={() => setExifNotice(null)}
            />

            {/* Title Input */}
            <div>
              <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Überschrift (Ort / Titel)</span>
                {locationName && (
                  <button
                    type="button"
                    onClick={() => setTitle(locationName.split(',')[0].trim() || locationName)}
                    className="text-[11px] text-[#8A9A5B] hover:underline font-semibold cursor-pointer"
                  >
                    Als Überschrift: „{locationName.split(',')[0].trim()}“
                  </button>
                )}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={locationName ? locationName.split(',')[0].trim() : "z.B. Rom, Zugspitze, Strand von Vik..."}
                className="w-full px-4 py-3 rounded-xl bg-white border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] placeholder-[#8C8273] text-base sm:text-sm focus:outline-none transition shadow-sm"
              />
            </div>

            {/* Modular Location & Map Section */}
            <LocationSection
              locationName={locationName}
              coordinates={coordinates}
              showMapPicker={showMapPicker}
              isGeocoding={isGeocoding}
              showAdvancedOptions={showAdvancedOptions}
              photoThumbnail={mediaList.length > 0 ? mediaList[0].url : null}
              hasExifGps={!!exifNotice || mediaList.some((m) => !!m.exifLocation)}
              onLocationNameChange={(val) => {
                const prevShort = locationName.split(',')[0].trim();
                setLocationName(val);
                if (!title.trim() || title === locationName || title === prevShort) {
                  setTitle(val.split(',')[0].trim() || val);
                }
              }}
              onToggleMapPicker={() => setShowMapPicker((prev) => !prev)}
              onCloseMapPicker={() => setShowMapPicker(false)}
              onToggleAdvancedOptions={() => setShowAdvancedOptions((prev) => !prev)}
              onSelectLocation={(newCoords, newAddr) => {
                setCoordinates(newCoords);
                if (newAddr) {
                  setLocationName(newAddr);
                  const shortPlace = newAddr.split(',')[0].trim();
                  if (!title.trim() || title === locationName || title === locationName.split(',')[0].trim()) {
                    setTitle(shortPlace || newAddr);
                  }
                }
                loadWeatherForLocationAndDate(newCoords, date);
              }}
              onCoordinatesChange={(newCoords) => {
                setCoordinates(newCoords);
                loadWeatherForLocationAndDate(newCoords, date);
              }}
            />

            {/* Travel Note & Story */}
            <div>
              <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider mb-1">
                Reisenotiz & Erlebnisse
              </label>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Atmosphäre, Empfehlungen, schöne Momente oder Notizen..."
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] placeholder-[#8C8273] text-base sm:text-sm focus:outline-none transition resize-y shadow-sm"
              />
            </div>

            {/* Date, Mood & Category in a compact grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider mb-1">
                  Datum
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8273]" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      loadWeatherForLocationAndDate(coordinates, e.target.value);
                    }}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] text-sm focus:outline-none shadow-sm min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider mb-1">
                  Kategorie
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CategoryType)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] text-sm focus:outline-none shadow-sm min-h-[44px]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B5E55] uppercase tracking-wider mb-1">
                  Stimmung
                </label>
                <select
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] text-sm focus:outline-none shadow-sm min-h-[44px]"
                >
                  {MOOD_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modular Historical Weather Section */}
            <WeatherSection
              coordinates={coordinates}
              date={date}
              weatherDetails={weatherDetails}
              weatherLabel={weatherLabel}
              weatherTemp={weatherTemp}
              isLoadingWeather={isLoadingWeather}
              showManualWeatherEdit={showManualWeatherEdit}
              onToggleManualEdit={() => setShowManualWeatherEdit((prev) => !prev)}
              onRefreshWeather={() => loadWeatherForLocationAndDate(coordinates, date, true)}
              onWeatherLabelChange={(newLabel) => {
                setWeatherLabel(newLabel);
                const matched = WEATHER_OPTIONS.find((w) => w.label === newLabel);
                if (matched && weatherDetails) {
                  setWeatherDetails({ ...weatherDetails, label: newLabel, icon: matched.icon });
                }
              }}
              onWeatherTempChange={(newTemp) => setWeatherTemp(newTemp)}
            />
          </form>

          {/* Fixed Desktop Bottom Actions */}
          <div className="hidden sm:flex items-center justify-between gap-3 px-6 py-4 border-t border-[#E5E1D8] bg-[#F1EDE6]/90 backdrop-blur-md shrink-0">
            {editingEntry && onDelete ? (
              <button
                type="button"
                onClick={() => setIsConfirmDeleteOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs border border-red-200 transition flex items-center gap-1.5 cursor-pointer"
                title="Reiseeintrag löschen"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eintrag löschen</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-[#6B5E55] hover:text-[#4E3B31] hover:bg-[#E5E1D8] text-xs font-semibold transition cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={isProcessingMedia}
                className="px-6 py-2.5 rounded-xl bg-[#E2725B] hover:bg-[#D46049] text-white font-bold text-xs shadow-md shadow-[#E2725B]/20 transition transform active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {editingEntry ? 'Änderungen speichern' : 'Eintrag veröffentlichen'}
              </button>
            </div>
          </div>

          {/* Sticky Mobile Bottom Toolbar */}
          <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-[#E5E1D8] flex items-center justify-between gap-2.5 z-30 shadow-lg">
            {editingEntry && onDelete ? (
              <button
                type="button"
                onClick={() => setIsConfirmDeleteOpen(true)}
                className="p-3 rounded-2xl bg-red-50 text-red-600 border border-red-200 active:scale-95 transition cursor-pointer"
                title="Löschen"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isProcessingMedia}
              className="flex-1 py-3 px-5 rounded-2xl bg-[#E2725B] hover:bg-[#D46049] text-white font-bold text-sm shadow-lg shadow-[#E2725B]/25 flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50 min-h-[48px] cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{editingEntry ? 'Speichern' : 'Eintrag speichern'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* Confirm Delete In-App Dialog */}
      {editingEntry && onDelete && (
        <ConfirmDeleteModal
          isOpen={isConfirmDeleteOpen}
          onClose={() => setIsConfirmDeleteOpen(false)}
          onConfirm={() => {
            onDelete(editingEntry.id);
            setIsConfirmDeleteOpen(false);
            onClose();
          }}
          title="Reiseeintrag löschen?"
          itemName={editingEntry.title || 'Unbenannter Eintrag'}
          description="Möchtest du diesen Reiseeintrag und alle verknüpften Fotos wirklich unwiderruflich aus deiner Reise entfernen?"
          confirmText="Eintrag löschen"
        />
      )}

      {/* Mobile QR Transfer Modal */}
      <MobileSyncQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
      />
    </>
  );
};
