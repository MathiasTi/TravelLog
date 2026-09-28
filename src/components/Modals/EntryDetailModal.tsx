import React, { useState, useRef, useEffect, useCallback } from 'react';
import { JournalEntry, Collaborator } from '../../types';
import { CATEGORIES } from '../../data/initialData';
import { storage } from '../../services/storage';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { ElevationChart } from '../Tracks/ElevationChart';
import { FullScreenSlideshow, GalleryMediaItem } from '../Gallery/FullScreenSlideshow';
import {
  X,
  MapPin,
  Calendar,
  Heart,
  MessageCircle,
  Share2,
  Edit,
  Trash2,
  Maximize2,
  Send,
  Navigation,
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  Wind,
  Snowflake,
  Droplets,
  Thermometer,
  Smile,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Download,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { downloadSingleMediaItem } from '../../services/mediaExportService';
import { fetchHistoricalWeather } from '../../services/weatherService';

interface EntryDetailModalProps {
  entry: JournalEntry | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: Collaborator;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (entryId: string) => void;
  onAddComment: (entryId: string, text: string) => void;
  onToggleLike: (entryId: string) => void;
  onFocusOnMap: (entry: JournalEntry) => void;
}

const EMOJI_REACTIONS = ['❤️', '🔥', '👏', '😍', '🏖️', '✈️'];

export const EntryDetailModal: React.FC<EntryDetailModalProps> = ({
  entry,
  isOpen,
  onClose,
  currentUser,
  onEdit,
  onDelete,
  onAddComment,
  onToggleLike,
  onFocusOnMap,
}) => {
  const [commentText, setCommentText] = useState('');
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isFullscreenMedia, setIsFullscreenMedia] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const renderWeatherIcon = (iconName?: string, className = 'w-4 h-4') => {
    switch (iconName) {
      case 'cloud-rain':
        return <CloudRain className={className} />;
      case 'cloud-sun':
        return <CloudSun className={className} />;
      case 'cloud':
        return <Cloud className={className} />;
      case 'snowflake':
        return <Snowflake className={className} />;
      case 'wind':
        return <Wind className={className} />;
      case 'sun':
      default:
        return <Sun className={className} />;
    }
  };

  const handleLoadHistoricalWeather = async () => {
    if (!entry?.coordinates || !entry?.date) return;
    setIsLoadingWeather(true);
    try {
      const dateStr = entry.date.split('T')[0];
      const res = await fetchHistoricalWeather(entry.coordinates, dateStr);
      if (res && res.weather) {
        onEdit({
          ...entry,
          weather: res.weather,
        });
      }
    } catch (err) {
      console.warn('Failed to load historical weather:', err);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  // Calculate and update scroll progress
  const updateScrollProgress = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll <= 0) {
      setScrollProgress(0);
      return;
    }
    const progress = Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100));
    setScrollProgress(progress);
  }, []);

  // Reset scroll and recalculate whenever the entry or open state changes
  useEffect(() => {
    if (isOpen && entry) {
      setScrollProgress(0);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      // Re-check scroll height after render layout
      const timer = setTimeout(() => {
        updateScrollProgress();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, entry?.id, updateScrollProgress]);

  if (!isOpen || !entry) return null;

  const catConfig = CATEGORIES.find((c) => c.id === entry.category) || CATEGORIES[0];
  const hasLiked = entry.likes?.includes(currentUser.id);
  const mediaList = entry.media || [];
  const currentMedia = mediaList[currentMediaIndex];

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(entry.id, commentText.trim());
    setCommentText('');
  };

  const handleQuickEmojiComment = (emoji: string) => {
    onAddComment(entry.id, emoji);
  };

  return (
    <div
      id="entry-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#4E3B31]/60 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-3xl bg-[#FDFBF7] border border-[#E5E1D8] rounded-3xl shadow-2xl overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E1D8] bg-[#F1EDE6]/80 shrink-0">
          <div className="flex items-center gap-3">
            <span
              className="px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider border shadow-sm"
              style={{
                backgroundColor: `${catConfig.color}15`,
                color: catConfig.color,
                borderColor: `${catConfig.color}40`,
              }}
            >
              {catConfig.label}
            </span>
            {entry.mood && (
              <span className="px-2.5 py-1 rounded-xl bg-white text-xs text-[#4E3B31] border border-[#E5E1D8] shadow-sm">
                {entry.mood}
              </span>
            )}
            {scrollProgress > 0 && (
              <span
                id="entry-detail-scroll-percent-badge"
                className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition-opacity duration-200"
                style={{
                  backgroundColor: `${catConfig.color}15`,
                  color: catConfig.color,
                }}
              >
                {Math.round(scrollProgress)}% gelesen
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onFocusOnMap(entry);
                onClose();
              }}
              className="px-3 py-1.5 rounded-xl bg-[#8A9A5B]/15 hover:bg-[#8A9A5B]/25 border border-[#8A9A5B]/30 text-[#8A9A5B] text-xs font-semibold flex items-center gap-1.5 transition"
              title="Auf Karte anzeigen"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Auf Karte</span>
            </button>

            <button
              type="button"
              onClick={() => onEdit(entry)}
              className="p-2 rounded-xl text-[#6B5E55] hover:text-[#4E3B31] hover:bg-[#E5E1D8] transition"
              title="Bearbeiten"
            >
              <Edit className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsDeleteConfirmOpen(true)}
              className="p-2 rounded-xl text-[#6B5E55] hover:text-red-500 hover:bg-red-50 transition"
              title="Löschen"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#6B5E55] hover:text-[#4E3B31] hover:bg-[#E5E1D8] transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Subtle Horizontal Scroll / Reading Progress Bar */}
        <div
          id="entry-detail-scroll-progress-track"
          className="w-full h-1 bg-[#E5E1D8]/60 relative overflow-hidden shrink-0"
          role="progressbar"
          aria-valuenow={Math.round(scrollProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
          title={`Lesefortschritt: ${Math.round(scrollProgress)}%`}
        >
          <div
            id="entry-detail-scroll-progress-bar"
            className="h-full transition-all duration-150 ease-out rounded-r-full"
            style={{
              width: `${scrollProgress}%`,
              backgroundColor: catConfig.color || '#E2725B',
              boxShadow: scrollProgress > 0 ? `0 0 6px ${catConfig.color || '#E2725B'}80` : 'none',
            }}
          />
        </div>

        {/* Modal Scrollable Body */}
        <div
          id="entry-detail-scroll-container"
          ref={scrollContainerRef}
          onScroll={updateScrollProgress}
          className="overflow-y-auto flex-1 p-6 space-y-6"
        >
          {/* Media Carousel / Gallery */}
          {mediaList.length > 0 && currentMedia && (
            <div className="relative rounded-2xl overflow-hidden bg-stone-900 border border-[#E5E1D8] shadow-md group">
              <div
                onClick={() => setIsFullscreenMedia(true)}
                className="relative aspect-video w-full flex items-center justify-center bg-black cursor-pointer"
                title="Klicken für Vollbild-Diashow"
              >
                <img
                  src={currentMedia.url}
                  alt={currentMedia.caption || entry.title}
                  className="w-full h-full object-cover"
                />

                {/* Action buttons overlay */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (currentMedia) {
                        downloadSingleMediaItem(
                          currentMedia,
                          `${entry.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${currentMediaIndex + 1}`
                        );
                      }
                    }}
                    className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition shadow-lg cursor-pointer"
                    title="Foto in Originalauflösung herunterladen"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFullscreenMedia(true);
                    }}
                    className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition shadow-lg cursor-pointer"
                    title="Vollbild-Diashow öffnen"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Media Navigation Arrows */}
                {mediaList.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentMediaIndex((prev) => (prev > 0 ? prev - 1 : mediaList.length - 1));
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition shadow-lg opacity-80 group-hover:opacity-100 cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentMediaIndex((prev) => (prev < mediaList.length - 1 ? prev + 1 : 0));
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition shadow-lg opacity-80 group-hover:opacity-100 cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                {/* Media Counter Pill */}
                {mediaList.length > 1 && (
                  <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-[11px] font-semibold text-white border border-white/20">
                    {currentMediaIndex + 1} / {mediaList.length}
                  </span>
                )}
              </div>

              <div className="px-4 py-2 bg-stone-900/90 text-xs text-stone-300 flex items-center justify-between border-t border-stone-800">
                <span className="italic truncate">{currentMedia.caption || 'Foto'}</span>
                <div className="flex items-center gap-2 text-[10px] text-stone-400 shrink-0">
                  {currentMedia.deviceInfo && (
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-[#C8B8A6]">
                      {currentMedia.deviceInfo}
                    </span>
                  )}
                  {currentMedia.exifLocation && (
                    <span className="text-[#8A9A5B] flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" />
                      <span>EXIF GPS</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Title & Author Meta */}
          <div>
            {entry.locationName && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#E2725B] uppercase tracking-wider mb-1">
                <MapPin className="w-4 h-4 shrink-0" />
                <span>{entry.locationName}</span>
              </div>
            )}
            <h2 className="text-2xl font-bold text-[#4E3B31] font-serif mb-2">{entry.title}</h2>

            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-[#8C8273]">
              {/* Author */}
              <div className="flex items-center gap-2">
                <img
                  src={entry.author.avatar}
                  alt={entry.author.name}
                  className="w-5 h-5 rounded-full object-cover border border-[#E5E1D8]"
                />
                <span className="text-[#4E3B31] font-medium">{entry.author.name}</span>
              </div>

              {/* Date */}
              <div className="flex items-center gap-1.5 text-[#8C8273]">
                <Calendar className="w-3.5 h-3.5 text-[#D4A373]" />
                <span>
                  {new Date(entry.date).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>

              {/* Location */}
              <div className="flex items-center gap-1.5 text-[#8C8273]">
                <MapPin className="w-3.5 h-3.5 text-[#E2725B]" />
                <span className="text-[#4E3B31]">{entry.locationName}</span>
              </div>

              {/* Weather Pill */}
              {entry.weather && (
                <div className="flex items-center gap-1.5 text-[#E2725B] bg-[#E2725B]/10 px-2.5 py-0.5 rounded-lg border border-[#E2725B]/20 font-medium">
                  {entry.weather.icon === 'cloud-rain' ? (
                    <CloudRain className="w-3.5 h-3.5" />
                  ) : entry.weather.icon === 'cloud-sun' ? (
                    <CloudSun className="w-3.5 h-3.5" />
                  ) : entry.weather.icon === 'cloud' ? (
                    <Cloud className="w-3.5 h-3.5" />
                  ) : entry.weather.icon === 'snowflake' ? (
                    <Snowflake className="w-3.5 h-3.5" />
                  ) : entry.weather.icon === 'wind' ? (
                    <Wind className="w-3.5 h-3.5" />
                  ) : (
                    <Sun className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {entry.weather.temp !== undefined ? `${entry.weather.temp}°C · ` : ''}
                    {entry.weather.label}
                  </span>
                </div>
              )}
            </div>

            {/* Dedicated Historical Weather History Section (Historische Wetterhistorie) */}
            {entry.weather ? (
              <div
                id="entry-detail-historical-weather-section"
                className="mt-4 p-4 sm:p-5 rounded-2xl bg-[#FAF8F5] border border-[#E5E1D8] shadow-xs space-y-3.5"
              >
                {/* Section Header */}
                <div className="flex items-start sm:items-center justify-between gap-3 border-b border-[#E5E1D8]/80 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#E2725B]/10 text-[#E2725B] shrink-0">
                      {renderWeatherIcon(entry.weather.icon, 'w-5 h-5')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-[#4E3B31]">
                          Historische Wetterhistorie
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#8A9A5B]/15 text-[#8A9A5B] border border-[#8A9A5B]/25">
                          {entry.weather.isHistorical ? 'Archivdaten' : 'Reisewetter'}
                        </span>
                      </div>
                      <p className="text-xs text-[#8C8273] mt-0.5">
                        Wetteraufzeichnung für <span className="text-[#4E3B31] font-semibold">{entry.locationName || 'Standort'}</span> am{' '}
                        <span className="text-[#4E3B31] font-semibold">
                          {new Date(entry.date).toLocaleDateString('de-DE', {
                            weekday: 'long',
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline-block text-[10px] text-[#8C8273] bg-white px-2.5 py-1 rounded-lg border border-[#E5E1D8] shadow-2xs font-mono">
                      {entry.weather.source || 'Open-Meteo ERA5'}
                    </span>
                    <button
                      type="button"
                      onClick={handleLoadHistoricalWeather}
                      disabled={isLoadingWeather}
                      title="Wetterdaten für diesen Tag und Standort aktualisieren"
                      className="p-1.5 rounded-lg text-[#8C8273] hover:text-[#4E3B31] hover:bg-[#E5E1D8]/50 transition cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWeather ? 'animate-spin text-[#E2725B]' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* 1. Temperatur */}
                  <div className="p-3 rounded-xl bg-white border border-[#E5E1D8]/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8C8273] uppercase tracking-wider">
                      <Thermometer className="w-3.5 h-3.5 text-[#E2725B]" />
                      <span>Temperatur</span>
                    </div>
                    <div className="text-xl font-bold text-[#4E3B31] font-mono">
                      {entry.weather.temp !== undefined ? `${entry.weather.temp}°C` : '–'}
                    </div>
                    <div className="text-[11px] text-[#8C8273]">
                      {entry.weather.tempMin !== undefined && entry.weather.tempMax !== undefined
                        ? `${entry.weather.tempMin}° bis ${entry.weather.tempMax}°C`
                        : 'Tages-Messwert'}
                    </div>
                  </div>

                  {/* 2. Wetterbedingungen */}
                  <div className="p-3 rounded-xl bg-white border border-[#E5E1D8]/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8C8273] uppercase tracking-wider">
                      {renderWeatherIcon(entry.weather.icon, 'w-3.5 h-3.5 text-[#D4A373]')}
                      <span>Bedingungen</span>
                    </div>
                    <div className="text-sm font-bold text-[#4E3B31] truncate" title={entry.weather.label}>
                      {entry.weather.label || 'Sonnig & heiter'}
                    </div>
                    <div className="text-[11px] text-[#8C8273]">
                      {entry.weather.weatherCode !== undefined ? `WMO-Code ${entry.weather.weatherCode}` : 'Atmosphärischer Zustand'}
                    </div>
                  </div>

                  {/* 3. Niederschlag */}
                  <div className="p-3 rounded-xl bg-white border border-[#E5E1D8]/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8C8273] uppercase tracking-wider">
                      <Droplets className="w-3.5 h-3.5 text-[#6B8E8E]" />
                      <span>Niederschlag</span>
                    </div>
                    <div className="text-xl font-bold text-[#4E3B31] font-mono">
                      {entry.weather.precipitation !== undefined ? `${entry.weather.precipitation} mm` : '0 mm'}
                    </div>
                    <div className="text-[11px] text-[#8C8273]">
                      {entry.weather.precipitation && entry.weather.precipitation > 0 ? 'Regen registriert' : 'Trockener Reisetag'}
                    </div>
                  </div>

                  {/* 4. Windgeschwindigkeit */}
                  <div className="p-3 rounded-xl bg-white border border-[#E5E1D8]/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8C8273] uppercase tracking-wider">
                      <Wind className="w-3.5 h-3.5 text-[#8A9A5B]" />
                      <span>Wind</span>
                    </div>
                    <div className="text-xl font-bold text-[#4E3B31] font-mono">
                      {entry.weather.windSpeed !== undefined ? `${entry.weather.windSpeed} km/h` : '–'}
                    </div>
                    <div className="text-[11px] text-[#8C8273]">
                      {entry.weather.windSpeed && entry.weather.windSpeed > 20 ? 'Frischer Wind' : 'Ruhige Brise'}
                    </div>
                  </div>
                </div>

                {/* Context Footnote with Coordinates and Reanalysis details */}
                <div className="flex flex-wrap items-center justify-between text-[11px] text-[#8C8273] pt-1 border-t border-[#E5E1D8]/60 gap-2">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#E2725B]" />
                    <span>GPS-Koordinaten: {entry.coordinates.lat.toFixed(4)}°, {entry.coordinates.lng.toFixed(4)}°</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-[#D4A373]" />
                    <span>Historische Reanalysis-Wetterdaten</span>
                  </span>
                </div>
              </div>
            ) : (
              entry.coordinates && (
                <div className="mt-4 p-3 rounded-2xl bg-[#FAF8F5]/80 border border-dashed border-[#E5E1D8] flex items-center justify-between gap-3 text-xs text-[#8C8273]">
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4 text-[#D4A373]" />
                    <span>Keine historischen Wetterdaten hinterlegt.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLoadHistoricalWeather}
                    disabled={isLoadingWeather}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#F1EDE6] text-[#4E3B31] font-medium border border-[#E5E1D8] shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    {isLoadingWeather ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E2725B]" /> : <Sparkles className="w-3.5 h-3.5 text-[#E2725B]" />}
                    <span>Historische Wetterdaten abrufen</span>
                  </button>
                </div>
              )
            )}
          </div>

          {/* Note / Journal Text */}
          {entry.note && (
            <div className="p-5 rounded-2xl bg-white border border-[#E5E1D8] text-sm text-[#4E3B31] leading-relaxed whitespace-pre-line shadow-sm">
              {entry.note}
            </div>
          )}

          {/* Attached GPS Track Elevation Profile using Recharts */}
          {entry.track && entry.track.points && entry.track.points.length > 1 && (
            <div className="space-y-2">
              <ElevationChart
                track={entry.track}
                points={entry.track.points}
                highlights={entry.track.highlights}
                height={180}
              />
            </div>
          )}

          {/* Like & Reaction Bar */}
          <div className="flex items-center justify-between pt-2 pb-3 border-b border-[#E5E1D8]">
            <button
              type="button"
              onClick={() => onToggleLike(entry.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                hasLiked
                  ? 'bg-[#E2725B]/15 text-[#E2725B] border border-[#E2725B]/40'
                  : 'bg-white text-[#6B5E55] hover:text-[#E2725B] hover:bg-[#F1EDE6] border border-[#E5E1D8]'
              }`}
            >
              <Heart className={`w-4 h-4 ${hasLiked ? 'fill-[#E2725B] text-[#E2725B]' : ''}`} />
              <span>{entry.likes?.length || 0} Gefällt mir</span>
            </button>

            {/* Quick emoji reaction buttons */}
            <div className="flex items-center gap-1">
              {EMOJI_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleQuickEmojiComment(emoji)}
                  className="p-1.5 rounded-lg hover:bg-[#E5E1D8] transition text-sm hover:scale-125 transform active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Comments Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#4E3B31] font-serif flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[#8A9A5B]" />
                <span>Reiseerinnerung kommentieren ({entry.comments?.length || 0})</span>
              </h4>
            </div>

            {/* Comment List */}
            <div className="space-y-3">
              {entry.comments && entry.comments.length > 0 ? (
                entry.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="flex items-start gap-3 p-3.5 rounded-2xl bg-white border border-[#E5E1D8] shadow-sm"
                  >
                    <img
                      src={comment.author.avatar}
                      alt={comment.author.name}
                      className="w-7 h-7 rounded-full object-cover border border-[#E5E1D8] mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold text-[#4E3B31]">
                          {comment.author.name}
                        </span>
                        <span className="text-[10px] text-[#8C8273]">
                          {new Date(comment.timestamp).toLocaleTimeString('de-DE', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-[#6B5E55] leading-normal">{comment.text}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#8C8273] italic py-2">
                  Noch keine Kommentare. Schreibe deiner Reisegruppe als Erste(r)!
                </p>
              )}
            </div>

            {/* Comment Input */}
            <form onSubmit={handleSendComment} className="flex items-center gap-2 pt-2">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-8 h-8 rounded-full object-cover border border-[#8A9A5B]/50 shrink-0"
              />
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Kommentar oder Erinnerung teilen..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-[#E5E1D8] focus:border-[#8A9A5B] text-[#4E3B31] placeholder-[#8C8273] text-xs focus:outline-none transition shadow-sm"
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="p-2.5 rounded-xl bg-[#8A9A5B] hover:bg-[#7D8C68] disabled:opacity-40 disabled:hover:bg-[#8A9A5B] text-white font-bold transition shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        itemName={entry.title}
        title="Reiseeintrag löschen?"
        description={`Möchtest du die Erinnerung an "${entry.title}" wirklich unwiderruflich aus deiner Chronik löschen?`}
        confirmText="Eintrag löschen"
        onConfirm={() => {
          onDelete(entry.id);
          setIsDeleteConfirmOpen(false);
          onClose();
        }}
      />

      {/* Full-Screen Slideshow for Entry Photos */}
      <FullScreenSlideshow
        items={mediaList.map((m) => ({ media: m, entry }))}
        initialIndex={currentMediaIndex}
        isOpen={isFullscreenMedia}
        onClose={() => setIsFullscreenMedia(false)}
      />
    </div>
  );
};
