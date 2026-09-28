import React, { useState, useEffect, useRef, useCallback } from 'react';
import { JournalEntry, MediaItem, Trip } from '../../types';
import { CATEGORIES } from '../../data/initialData';
import {
  X,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  EyeOff,
  Film,
  MapPin,
  Calendar,
  ExternalLink,
  Compass,
  Camera,
  Download,
} from 'lucide-react';
import { downloadSingleMediaItem } from '../../services/mediaExportService';

export interface GalleryMediaItem {
  media: MediaItem;
  entry: JournalEntry;
}

interface FullScreenSlideshowProps {
  items: GalleryMediaItem[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  onSelectEntry?: (entry: JournalEntry) => void;
  activeTrip?: Trip | null;
}

export const FullScreenSlideshow: React.FC<FullScreenSlideshowProps> = ({
  items,
  initialIndex = 0,
  isOpen,
  onClose,
  onSelectEntry,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playInterval, setPlayInterval] = useState<number>(5000); // 5 seconds default
  const [progress, setProgress] = useState<number>(0);
  const [showInfoOverlay, setShowInfoOverlay] = useState<boolean>(true);
  const [showFilmstrip, setShowFilmstrip] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const autoplayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync index when initialIndex changes or modal opens
  useEffect(() => {
    if (isOpen) {
      const validIndex = Math.max(0, Math.min(initialIndex, items.length - 1));
      setCurrentIndex(validIndex);
      setZoomLevel(1);
      setPanOffset({ x: 0, y: 0 });
      setProgress(0);
    }
  }, [isOpen, initialIndex, items.length]);

  const handleNext = useCallback(() => {
    if (items.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % items.length);
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setProgress(0);
  }, [items.length]);

  const handlePrev = useCallback(() => {
    if (items.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setProgress(0);
  }, [items.length]);

  // Autoplay loop timer
  useEffect(() => {
    if (!isOpen || !isPlaying || items.length <= 1) {
      if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      setProgress(0);
      return;
    }

    const intervalStep = 50; // update progress every 50ms
    const totalSteps = playInterval / intervalStep;
    let stepCount = 0;

    progressTimerRef.current = setInterval(() => {
      stepCount++;
      setProgress(Math.min(100, (stepCount / totalSteps) * 100));
    }, intervalStep);

    autoplayTimerRef.current = setInterval(() => {
      handleNext();
      stepCount = 0;
      setProgress(0);
    }, playInterval);

    return () => {
      if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isOpen, isPlaying, playInterval, handleNext, items.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleBrowserFullscreen();
      } else if (e.key === 'i' || e.key === 'I') {
        setShowInfoOverlay((prev) => !prev);
      } else if (e.key === '+' || e.key === '=') {
        setZoomLevel((prev) => Math.min(3, +(prev + 0.5).toFixed(1)));
      } else if (e.key === '-') {
        setZoomLevel((prev) => {
          const next = Math.max(1, +(prev - 0.5).toFixed(1));
          if (next === 1) setPanOffset({ x: 0, y: 0 });
          return next;
        });
      } else if (e.key === '0') {
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  // Scroll active thumbnail into view
  useEffect(() => {
    if (showFilmstrip && filmstripRef.current) {
      const activeThumb = filmstripRef.current.querySelector(
        `[data-thumb-index="${currentIndex}"]`
      ) as HTMLElement;
      if (activeThumb && typeof activeThumb.scrollIntoView === 'function') {
        activeThumb.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [currentIndex, showFilmstrip]);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsBrowserFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsBrowserFullscreen(false);
    }
  };

  // Touch Swipe Handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoomLevel > 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || zoomLevel > 1) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 100) {
      if (deltaX > 0) {
        handlePrev();
      } else {
        handleNext();
      }
    }
  };

  // Mouse Drag / Pan when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    if (zoomLevel > 1) {
      setZoomLevel(1);
      setPanOffset({ x: 0, y: 0 });
    } else {
      setZoomLevel(2);
    }
  };

  if (!isOpen || items.length === 0) return null;

  const currentItem = items[currentIndex];
  if (!currentItem) return null;

  const { media, entry } = currentItem;
  const catConfig = CATEGORIES.find((c) => c.id === entry.category) || CATEGORIES[0];

  return (
    <div
      ref={containerRef}
      id="fullscreen-slideshow-overlay"
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col justify-between select-none overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Top Autoplay Progress Bar */}
      {isPlaying && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 z-50">
          <div
            className="h-full bg-[#8A9A5B] transition-all duration-75 ease-linear shadow-[0_0_10px_#8A9A5B]"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Top Controls Header Bar */}
      <div className="relative z-40 p-4 sm:px-6 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        {/* Left: Slide Counter & Playback Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-white text-xs font-semibold">
            <span className="font-mono text-stone-200">
              {currentIndex + 1} / {items.length}
            </span>
            {isPlaying && (
              <span className="flex items-center gap-1 text-[10px] text-[#8A9A5B] font-bold uppercase tracking-wider pl-1 border-l border-white/20">
                <span className="w-2 h-2 rounded-full bg-[#8A9A5B] animate-pulse" />
                Live
              </span>
            )}
          </div>

          {/* Autoplay Interval Selector */}
          <div className="hidden sm:flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/10 text-[11px] text-stone-300">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition ${
                isPlaying
                  ? 'bg-[#8A9A5B] text-white shadow-sm'
                  : 'hover:bg-white/10 text-stone-300 hover:text-white'
              }`}
              title={isPlaying ? 'Diashow anhalten (Leertaste)' : 'Diashow starten (Leertaste)'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pause' : 'Autoplay'}</span>
            </button>

            {isPlaying && (
              <select
                value={playInterval}
                onChange={(e) => setPlayInterval(Number(e.target.value))}
                className="bg-transparent text-stone-300 text-[11px] font-medium px-2 py-0.5 rounded outline-none cursor-pointer hover:text-white"
                title="Wechselintervall anpassen"
              >
                <option value={3000} className="bg-stone-900 text-white">3s</option>
                <option value={5000} className="bg-stone-900 text-white">5s</option>
                <option value={8000} className="bg-stone-900 text-white">8s</option>
                <option value={12000} className="bg-stone-900 text-white">12s</option>
              </select>
            )}
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="hidden md:flex items-center gap-1 bg-white/10 backdrop-blur-md rounded-xl p-1 border border-white/10 text-white">
            <button
              type="button"
              onClick={() =>
                setZoomLevel((prev) => {
                  const next = Math.max(1, +(prev - 0.5).toFixed(1));
                  if (next === 1) setPanOffset({ x: 0, y: 0 });
                  return next;
                })
              }
              disabled={zoomLevel <= 1}
              className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 transition cursor-pointer"
              title="Verkleinern (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-mono font-bold px-1 min-w-[36px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((prev) => Math.min(3, +(prev + 0.5).toFixed(1)))}
              disabled={zoomLevel >= 3}
              className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 transition cursor-pointer"
              title="Vergrößern (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            {zoomLevel > 1 && (
              <button
                type="button"
                onClick={() => {
                  setZoomLevel(1);
                  setPanOffset({ x: 0, y: 0 });
                }}
                className="p-1.5 rounded-lg hover:bg-white/10 text-[#E2725B] transition cursor-pointer"
                title="Zoom zurücksetzen (0)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Toggle Info Overlay */}
          <button
            type="button"
            onClick={() => setShowInfoOverlay(!showInfoOverlay)}
            className={`p-2 rounded-xl backdrop-blur-md border transition cursor-pointer ${
              showInfoOverlay
                ? 'bg-white/20 border-white/30 text-white shadow-sm'
                : 'bg-white/10 border-white/10 text-stone-400 hover:text-white'
            }`}
            title={showInfoOverlay ? 'Informationen ausblenden (I)' : 'Informationen einblenden (I)'}
          >
            {showInfoOverlay ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          {/* Toggle Filmstrip */}
          <button
            type="button"
            onClick={() => setShowFilmstrip(!showFilmstrip)}
            className={`p-2 rounded-xl backdrop-blur-md border transition cursor-pointer ${
              showFilmstrip
                ? 'bg-white/20 border-white/30 text-white shadow-sm'
                : 'bg-white/10 border-white/10 text-stone-400 hover:text-white'
            }`}
            title={showFilmstrip ? 'Vorschauleiste ausblenden' : 'Vorschauleiste einblenden'}
          >
            <Film className="w-4 h-4" />
          </button>

          {/* Download Current Photo */}
          <button
            type="button"
            onClick={() => {
              const current = items[currentIndex];
              if (current) {
                downloadSingleMediaItem(
                  current.media,
                  `${current.entry.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${currentIndex + 1}`
                );
              }
            }}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/25 backdrop-blur-md border border-white/10 text-white transition cursor-pointer"
            title="Aktuelles Foto in Originalqualität herunterladen"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Native Browser Fullscreen */}
          <button
            type="button"
            onClick={toggleBrowserFullscreen}
            className="hidden sm:flex p-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white transition cursor-pointer"
            title="Vollbild umschalten (F)"
          >
            {isBrowserFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Slideshow */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-[#E2725B] backdrop-blur-md border border-white/10 text-white transition cursor-pointer shadow-lg ml-1"
            title="Schließen (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Slide Canvas */}
      <div className="relative flex-1 flex items-center justify-center p-2 sm:p-6 overflow-hidden">
        {/* Navigation Arrow Left */}
        {items.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-30 p-3 sm:p-4 rounded-2xl bg-black/50 hover:bg-black/80 hover:scale-110 active:scale-95 text-white backdrop-blur-xl border border-white/10 transition shadow-2xl group cursor-pointer"
            title="Vorheriges Bild (Pfeil links)"
          >
            <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition" />
          </button>
        )}

        {/* Navigation Arrow Right */}
        {items.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-30 p-3 sm:p-4 rounded-2xl bg-black/50 hover:bg-black/80 hover:scale-110 active:scale-95 text-white backdrop-blur-xl border border-white/10 transition shadow-2xl group cursor-pointer"
            title="Nächstes Bild (Pfeil rechts)"
          >
            <ChevronRight className="w-6 h-6 group-hover:translate-x-0.5 transition" />
          </button>
        )}

        {/* Media Container with Zoom & Pan */}
        <div
          className="relative max-w-full max-h-full flex items-center justify-center transition-transform duration-200 ease-out"
          style={{
            transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
            cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          }}
          onDoubleClick={handleDoubleClick}
        >
          <img
            src={media.url}
            alt={media.caption || entry.title}
            className="max-h-[75vh] sm:max-h-[82vh] max-w-[92vw] object-contain rounded-xl shadow-2xl pointer-events-auto"
            draggable={false}
          />
        </div>

        {/* Floating Info Overlay Card (Toggleable) */}
        {showInfoOverlay && (
          <div className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-lg z-30 bg-stone-950/85 backdrop-blur-xl border border-white/15 rounded-2xl p-4 sm:p-5 text-white shadow-2xl animate-fade-in">
            {/* Category & Date Header */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <span
                className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border shadow-xs"
                style={{
                  backgroundColor: `${catConfig.color}25`,
                  color: catConfig.color,
                  borderColor: `${catConfig.color}60`,
                }}
              >
                {catConfig.label}
              </span>

              <div className="flex items-center gap-1.5 text-[11px] text-stone-400 font-medium">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                <span>
                  {new Date(entry.date).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Entry Title & Location */}
            <h3 className="text-base sm:text-lg font-bold font-serif text-white line-clamp-1 mb-1">
              {entry.title}
            </h3>

            {entry.locationName && (
              <p className="text-xs text-[#E2725B] font-semibold flex items-center gap-1.5 mb-2 line-clamp-1">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>{entry.locationName}</span>
              </p>
            )}

            {/* Photo Caption */}
            {media.caption && (
              <p className="text-xs text-stone-300 italic bg-white/5 rounded-xl p-2.5 border border-white/10 mb-3">
                "{media.caption}"
              </p>
            )}

            {/* EXIF / Telemetry Tags */}
            {(media.deviceInfo || media.exifLocation || media.exifDate) && (
              <div className="flex items-center gap-2 flex-wrap text-[10px] text-stone-400 mb-3 pt-2 border-t border-white/10">
                {media.deviceInfo && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 text-stone-300">
                    <Camera className="w-2.5 h-2.5" />
                    <span>{media.deviceInfo}</span>
                  </span>
                )}
                {media.exifLocation && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 text-[#8A9A5B]">
                    <Compass className="w-2.5 h-2.5" />
                    <span>GPS Koordinaten</span>
                  </span>
                )}
              </div>
            )}

            {/* Action Bar: Open Journal Entry */}
            {onSelectEntry && (
              <div className="pt-2 flex items-center justify-between border-t border-white/10">
                <div className="flex items-center gap-2">
                  <img
                    src={entry.author?.avatar || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=150&auto=format&fit=crop&q=80'}
                    alt={entry.author?.name}
                    className="w-5 h-5 rounded-full object-cover border border-white/20"
                  />
                  <span className="text-xs text-stone-300 font-medium">
                    {entry.author?.name || 'Reisender'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectEntry(entry);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#8A9A5B] hover:bg-[#7D8C68] active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                >
                  <span>Tagebucheintrag öffnen</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Filmstrip / Thumbnails Bar */}
      {showFilmstrip && (
        <div className="relative z-40 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-3 sm:px-6">
          <div
            ref={filmstripRef}
            className="flex items-center gap-2 overflow-x-auto py-1 px-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent max-w-5xl mx-auto"
          >
            {items.map((item, idx) => {
              const isSelected = idx === currentIndex;
              return (
                <button
                  key={item.media.id || idx}
                  data-thumb-index={idx}
                  type="button"
                  onClick={() => {
                    setCurrentIndex(idx);
                    setZoomLevel(1);
                    setPanOffset({ x: 0, y: 0 });
                    setProgress(0);
                  }}
                  className={`relative shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'border-[#8A9A5B] scale-105 shadow-[0_0_12px_#8A9A5B] ring-2 ring-[#8A9A5B]/40 opacity-100'
                      : 'border-white/20 hover:border-white/60 opacity-60 hover:opacity-100'
                  }`}
                  title={`${idx + 1}. ${item.entry.title}`}
                >
                  <img
                    src={item.media.url}
                    alt={item.media.caption || item.entry.title}
                    className="w-full h-full object-cover"
                  />
                  {isSelected && (
                    <div className="absolute bottom-0 inset-x-0 h-1 bg-[#8A9A5B]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
