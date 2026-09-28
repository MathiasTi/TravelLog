import React, { useState, useRef, useEffect } from 'react';
import { JournalEntry, Trip, Collaborator } from '../../types';
import { CATEGORIES } from '../../data/initialData';
import { canCreateOrEditEntries, canDeleteEntry } from '../../utils/permissions';
import {
  X,
  MapPin,
  Calendar,
  Eye,
  Edit3,
  Trash2,
  Navigation,
  ChevronUp,
  ChevronDown,
  CloudSun,
  Sparkles,
  Share2,
} from 'lucide-react';

interface MapWaypointBottomSheetProps {
  entry: JournalEntry | null;
  activeTrip: Trip | null;
  currentUser: Collaborator;
  indexInRoute?: number;
  onClose: () => void;
  onSelectEntry: (entry: JournalEntry) => void;
  onEditEntry?: (entry: JournalEntry) => void;
  onDeleteEntry?: (entry: JournalEntry) => void;
  onFocusCoordinates?: (coords: { lat: number; lng: number }) => void;
}

export const MapWaypointBottomSheet: React.FC<MapWaypointBottomSheetProps> = ({
  entry,
  activeTrip,
  currentUser,
  indexInRoute = 1,
  onClose,
  onSelectEntry,
  onEditEntry,
  onDeleteEntry,
  onFocusCoordinates,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragCurrentY, setDragCurrentY] = useState<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset state when entry changes
    setIsExpanded(false);
    setActiveMediaIndex(0);
  }, [entry?.id]);

  if (!entry) return null;

  const category = CATEGORIES.find((c) => c.id === entry.category) || CATEGORIES[0];
  const canEdit = canCreateOrEditEntries(activeTrip, currentUser);
  const canDelete = canDeleteEntry(entry, activeTrip, currentUser);
  const photos = entry.media?.filter((m) => m.type === 'photo') || [];
  const currentPhoto = photos[activeMediaIndex] || photos[0];

  // Touch Drag Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStartY(e.touches[0].clientY);
    setDragCurrentY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartY === null) return;
    setDragCurrentY(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (dragStartY === null || dragCurrentY === null) {
      setDragStartY(null);
      setDragCurrentY(null);
      return;
    }

    const deltaY = dragCurrentY - dragStartY;
    // Swipe down > 60px -> close or collapse
    if (deltaY > 60) {
      if (isExpanded) {
        setIsExpanded(false);
      } else {
        onClose();
      }
    } else if (deltaY < -40) {
      // Swipe up > 40px -> expand
      setIsExpanded(true);
    }

    setDragStartY(null);
    setDragCurrentY(null);
  };

  const formattedDate = new Date(entry.date).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      id="map-waypoint-bottom-sheet-backdrop"
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center pointer-events-none md:pb-6"
    >
      <div
        ref={sheetRef}
        id={`waypoint-bottom-sheet-${entry.id}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`pointer-events-auto w-full max-w-lg bg-white/95 dark:bg-[#1E1B18]/95 backdrop-blur-xl border-t md:border border-[#E5E1D8] dark:border-[#38322C] md:rounded-3xl shadow-2xl transition-all duration-300 ease-out overflow-hidden flex flex-col ${
          isExpanded ? 'max-h-[82vh]' : 'max-h-[380px]'
        } pb-[max(1rem,env(safe-area-inset-bottom,1rem))] mb-14 md:mb-0`}
      >
        {/* Drag Handle Bar */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full pt-2.5 pb-1 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none"
        >
          <div className="w-12 h-1.5 rounded-full bg-[#E5E1D8] dark:bg-[#38322C]" />
          <div className="flex items-center gap-1 text-[10px] text-[#8C8273] dark:text-[#9C9182] font-semibold mt-1">
            {isExpanded ? (
              <>
                <ChevronDown className="w-3 h-3" />
                <span>Nach unten wischen zum Minimieren</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3 h-3" />
                <span>Nach oben wischen für Details</span>
              </>
            )}
          </div>
        </div>

        {/* Header Content with Category, Stopp Number, and Close button */}
        <div className="px-4 py-2 flex items-center justify-between border-b border-[#E5E1D8] dark:border-[#38322C]">
          <div className="flex items-center gap-2">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-xs"
              style={{ backgroundColor: category.color }}
            >
              {indexInRoute}
            </span>
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase shadow-2xs"
              style={{
                backgroundColor: `${category.color}15`,
                color: category.color,
                border: `1px solid ${category.color}40`,
              }}
            >
              {category.label}
            </span>
            {entry.weather && (
              <span className="flex items-center gap-1 text-xs text-[#6B5E55] dark:text-[#C4B9AA] bg-[#F1EDE6] dark:bg-[#2A2622] px-2 py-0.5 rounded-full border border-[#E5E1D8] dark:border-[#38322C]">
                <CloudSun className="w-3 h-3 text-amber-500" />
                <span>
                  {entry.weather.temp !== undefined ? `${entry.weather.temp}°C` : entry.weather.label}
                </span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#8C8273] hover:text-[#4E3B31] dark:text-[#9C9182] dark:hover:text-[#EDE8DF] hover:bg-[#F1EDE6] dark:hover:bg-[#2E2A26] transition"
            aria-label="Stopp-Vorschau schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body Area */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* Main Info */}
          <div>
            <h3 className="text-lg font-bold text-[#4E3B31] dark:text-[#EDE8DF] font-serif leading-tight">
              {entry.title}
            </h3>
            {entry.locationName && (
              <p className="flex items-center gap-1 text-xs text-[#E2725B] font-semibold mt-1">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{entry.locationName}</span>
              </p>
            )}
          </div>

          {/* Media preview banner / thumbnails */}
          {photos.length > 0 && (
            <div className="relative rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-900 border border-[#E5E1D8] dark:border-[#38322C]">
              <img
                src={currentPhoto.url}
                alt={entry.title}
                className="w-full h-40 object-cover"
                loading="lazy"
              />
              {photos.length > 1 && (
                <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5 z-10">
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveMediaIndex(i)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        activeMediaIndex === i
                          ? 'w-5 bg-white shadow-sm'
                          : 'bg-white/60 hover:bg-white/90'
                      }`}
                      aria-label={`Foto ${i + 1} ansehen`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Note preview / description */}
          {entry.note && (
            <div className="bg-[#FDFBF7] dark:bg-[#24201D] p-3 rounded-2xl border border-[#E5E1D8] dark:border-[#38322C]">
              <p
                className={`text-xs text-[#6B5E55] dark:text-[#C4B9AA] leading-relaxed ${
                  !isExpanded && 'line-clamp-3'
                }`}
              >
                {entry.note}
              </p>
            </div>
          )}

          {/* Author & Timestamp */}
          <div className="flex items-center justify-between text-[11px] text-[#8C8273] dark:text-[#9C9182] pt-1">
            <div className="flex items-center gap-1.5">
              <img
                src={entry.author.avatar}
                alt={entry.author.name}
                className="w-4 h-4 rounded-full object-cover border border-[#E5E1D8] dark:border-[#38322C]"
              />
              <span className="font-medium text-[#4E3B31] dark:text-[#EDE8DF]">
                {entry.author.name}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>

        {/* Action Button Bar */}
        <div className="px-4 pt-2 border-t border-[#E5E1D8] dark:border-[#38322C] flex items-center gap-2">
          {/* Primary View Story / Detail button */}
          <button
            type="button"
            id={`btn-sheet-view-${entry.id}`}
            onClick={() => onSelectEntry(entry)}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#E2725B] hover:bg-[#D46049] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#E2725B]/20 active:scale-98 transition"
          >
            <Eye className="w-4 h-4" />
            <span>Erinnerung öffnen</span>
          </button>

          {/* Focus on map center */}
          {onFocusCoordinates && (
            <button
              type="button"
              onClick={() => onFocusCoordinates(entry.coordinates)}
              className="p-2.5 rounded-xl bg-[#F1EDE6] dark:bg-[#2A2622] hover:bg-[#E5E1D8] dark:hover:bg-[#38322C] text-[#4E3B31] dark:text-[#EDE8DF] border border-[#E5E1D8] dark:border-[#38322C] transition shadow-xs"
              title="Auf der Karte zentrieren"
              aria-label="Auf der Karte zentrieren"
            >
              <Navigation className="w-4 h-4 text-[#8A9A5B]" />
            </button>
          )}

          {/* Edit Button */}
          {canEdit && onEditEntry && (
            <button
              type="button"
              id={`btn-sheet-edit-${entry.id}`}
              onClick={() => onEditEntry(entry)}
              className="p-2.5 rounded-xl bg-[#F1EDE6] dark:bg-[#2A2622] hover:bg-[#E5E1D8] dark:hover:bg-[#38322C] text-[#4E3B31] dark:text-[#EDE8DF] border border-[#E5E1D8] dark:border-[#38322C] transition shadow-xs"
              title="Stopp bearbeiten"
              aria-label="Stopp bearbeiten"
            >
              <Edit3 className="w-4 h-4 text-[#8A9A5B]" />
            </button>
          )}

          {/* Delete Button */}
          {canDelete && onDeleteEntry && (
            <button
              type="button"
              id={`btn-sheet-delete-${entry.id}`}
              onClick={() => onDeleteEntry(entry)}
              className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 transition shadow-xs"
              title="Stopp löschen"
              aria-label="Stopp löschen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
