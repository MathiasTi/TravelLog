import React, { useState } from 'react';
import { JournalEntry, Trip, CategoryType, MediaItem } from '../../types';
import { CATEGORIES } from '../../data/initialData';
import { FullScreenSlideshow, GalleryMediaItem } from '../Gallery/FullScreenSlideshow';
import { downloadSingleMediaItem } from '../../services/mediaExportService';
import {
  Image as ImageIcon,
  MapPin,
  Calendar,
  Play,
  Maximize2,
  Filter,
  Layers,
  BookOpen,
  Download,
} from 'lucide-react';

interface GalleryViewProps {
  entries: JournalEntry[];
  activeTrip: Trip | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onOpenExportModal?: () => void;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
  entries,
  activeTrip,
  onSelectEntry,
  onOpenExportModal,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isSlideshowOpen, setIsSlideshowOpen] = useState<boolean>(false);
  const [slideshowStartIndex, setSlideshowStartIndex] = useState<number>(0);

  // Extract all media items with reference to their entry
  const allMediaWithEntry: GalleryMediaItem[] = entries.flatMap((entry) =>
    (entry.media || []).map((media) => ({
      media,
      entry,
    }))
  );

  const filteredMedia = allMediaWithEntry.filter(({ entry }) => {
    if (selectedCategory !== 'all' && entry.category !== selectedCategory) return false;
    return true;
  });

  const handleStartSlideshow = (startIndex = 0) => {
    if (filteredMedia.length === 0) return;
    setSlideshowStartIndex(startIndex);
    setIsSlideshowOpen(true);
  };

  return (
    <div className="w-full h-full overflow-y-auto p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E5E1D8]">
        <div>
          <h2 className="text-2xl font-bold text-[#4E3B31] font-serif flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-[#E2725B]" />
            <span>Fotogalerie</span>
          </h2>
          <p className="text-xs text-[#6B5E55] mt-0.5">
            {filteredMedia.length} von {allMediaWithEntry.length} Fotos aus {entries.length} Reise-Stopps
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Photobook & Media Export Button */}
          {onOpenExportModal && (
            <button
              type="button"
              onClick={onOpenExportModal}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#2A2521] hover:bg-[#F1EDE6] dark:hover:bg-[#342F2A] border border-[#E5E1D8] dark:border-[#3D3630] text-[#4E3B31] dark:text-[#EDE8DF] text-xs font-bold flex items-center gap-2 transition shadow-xs cursor-pointer active:scale-95"
              title="Fotobuch (PDF) erstellen & alle Bilder als ZIP-Archiv exportieren"
            >
              <BookOpen className="w-4 h-4 text-[#E2725B]" />
              <span>Fotobuch & Export</span>
            </button>
          )}

          {/* Start Full-Screen Slideshow Button */}
          <button
            type="button"
            onClick={() => handleStartSlideshow(0)}
            disabled={filteredMedia.length === 0}
            className="px-4 py-2 rounded-xl bg-[#8A9A5B] hover:bg-[#7D8C68] disabled:opacity-40 active:scale-95 text-white font-bold text-xs flex items-center gap-2 transition shadow-sm cursor-pointer shadow-[#8A9A5B]/20"
            title="Interaktive Vollbild-Diashow mit allen gefilterten Fotos starten"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Diashow starten</span>
            <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-mono">
              {filteredMedia.length}
            </span>
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-thin">
        <span className="text-[11px] font-bold text-[#8C8273] uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
          <Filter className="w-3 h-3" />
          <span>Kategorie:</span>
        </span>
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-[#4E3B31] text-white shadow-xs'
              : 'bg-white hover:bg-[#F1EDE6] text-[#6B5E55] border border-[#E5E1D8]'
          }`}
        >
          Alle Kategorien
        </button>
        {CATEGORIES.map((cat) => {
          const count = allMediaWithEntry.filter((m) => m.entry.category === cat.id).length;
          if (count === 0) return null;
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? 'text-white shadow-xs'
                  : 'bg-white hover:bg-[#F1EDE6] text-[#4E3B31] border border-[#E5E1D8]'
              }`}
              style={{
                backgroundColor: isSelected ? cat.color : undefined,
                borderColor: isSelected ? cat.color : undefined,
              }}
            >
              <span>{cat.label}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-black/20 text-white' : 'bg-[#F1EDE6] text-[#6B5E55]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Media Grid */}
      {filteredMedia.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl bg-[#F1EDE6]/50 border border-[#D5CEC2] border-dashed">
          <ImageIcon className="w-12 h-12 text-[#8C8273] mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#4E3B31] mb-1">Keine Fotos gefunden</h3>
          <p className="text-xs text-[#6B5E55] max-w-sm mx-auto">
            {selectedCategory !== 'all'
              ? 'Keine Fotos entsprechen der ausgewählten Kategorie. Wähle eine andere Kategorie oder setze die Filter zurück.'
              : 'Lade in deinen Reiseeinträgen Fotos hoch, um sie hier in der Fotogalerie und Diashow zu bewundern.'}
          </p>
          {selectedCategory !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className="mt-4 px-3.5 py-1.5 rounded-xl bg-[#8A9A5B] text-white text-xs font-bold shadow-sm"
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {filteredMedia.map(({ media, entry }, idx) => {
            const catConfig = CATEGORIES.find((c) => c.id === entry.category) || CATEGORIES[0];
            const entryMediaCount = entry.media?.length || 1;

            return (
              <div
                key={media.id || idx}
                onClick={() => handleStartSlideshow(idx)}
                className="group relative aspect-square rounded-2xl overflow-hidden bg-stone-900 border border-[#E5E1D8] shadow-md cursor-pointer transform hover:scale-[1.02] transition"
                title={`${entry.title} - In Vollbild-Diashow öffnen`}
              >
                <img
                  src={media.url}
                  alt={media.caption || entry.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  loading="lazy"
                />

                {/* Top badges on grid card */}
                <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none">
                  {entryMediaCount > 1 && (
                    <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-bold text-white border border-white/20 flex items-center gap-1 shadow-xs">
                      <Layers className="w-2.5 h-2.5" />
                      <span>{entryMediaCount}</span>
                    </span>
                  )}
                  <span
                    className="ml-auto px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border shadow-xs"
                    style={{
                      backgroundColor: `${catConfig.color}40`,
                      color: '#FFFFFF',
                      borderColor: `${catConfig.color}90`,
                    }}
                  >
                    {catConfig.label}
                  </span>
                </div>

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                  {/* Quick Action Buttons */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="p-1.5 rounded-lg bg-white/20 text-white backdrop-blur-md flex items-center gap-1 text-[10px] font-bold">
                      <Maximize2 className="w-3 h-3" />
                      <span>Diashow</span>
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadSingleMediaItem(media, `${entry.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${idx + 1}`);
                        }}
                        className="p-1.5 rounded-lg bg-white/30 hover:bg-white text-stone-900 hover:text-black flex items-center gap-1 text-[10px] font-bold shadow-sm transition backdrop-blur-md cursor-pointer"
                        title="Dieses Foto in Originalauflösung herunterladen"
                      >
                        <Download className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEntry(entry);
                        }}
                        className="p-1.5 rounded-lg bg-[#8A9A5B] hover:bg-[#7D8C68] text-white flex items-center gap-1 text-[10px] font-bold shadow-sm transition cursor-pointer"
                        title="Tagebucheintrag direkt öffnen"
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>Eintrag</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    {entry.locationName && (
                      <p className="text-[11px] text-[#E2725B] font-bold uppercase tracking-wider line-clamp-1 flex items-center gap-1 mb-0.5">
                        <MapPin className="w-3 h-3 text-[#E2725B] shrink-0" />
                        <span>{entry.locationName.split(',')[0]}</span>
                      </p>
                    )}
                    <h4 className="text-xs font-bold text-white line-clamp-1">{entry.title}</h4>
                    {media.caption && (
                      <p className="text-[10px] text-stone-300 italic line-clamp-1 mt-0.5">
                        "{media.caption}"
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full-Screen Slideshow Lightbox */}
      <FullScreenSlideshow
        items={filteredMedia}
        initialIndex={slideshowStartIndex}
        isOpen={isSlideshowOpen}
        onClose={() => setIsSlideshowOpen(false)}
        onSelectEntry={onSelectEntry}
        activeTrip={activeTrip}
      />
    </div>
  );
};
