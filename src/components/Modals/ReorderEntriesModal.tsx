import React, { useState, useEffect } from 'react';
import { JournalEntry, Trip } from '../../types';
import { CATEGORIES } from '../../data/initialData';
import {
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpToLine,
  ArrowDownToLine,
  RotateCcw,
  Check,
  ListOrdered,
  Calendar,
  MapPin,
  Sparkles,
  ArrowUpDown,
} from 'lucide-react';

interface ReorderEntriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: JournalEntry[];
  activeTrip: Trip | null;
  onSaveOrder: (orderedEntries: JournalEntry[]) => void;
}

export const ReorderEntriesModal: React.FC<ReorderEntriesModalProps> = ({
  isOpen,
  onClose,
  entries,
  activeTrip,
  onSaveOrder,
}) => {
  const [items, setItems] = useState<JournalEntry[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Initialize with copy of entries
      setItems([...entries]);
    }
  }, [isOpen, entries]);

  if (!isOpen) return null;

  const moveItem = (index: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    const updated = [...items];
    const item = updated[index];

    if (direction === 'up' && index > 0) {
      updated.splice(index, 1);
      updated.splice(index - 1, 0, item);
    } else if (direction === 'down' && index < updated.length - 1) {
      updated.splice(index, 1);
      updated.splice(index + 1, 0, item);
    } else if (direction === 'top' && index > 0) {
      updated.splice(index, 1);
      updated.unshift(item);
    } else if (direction === 'bottom' && index < updated.length - 1) {
      updated.splice(index, 1);
      updated.push(item);
    }

    setItems(updated);
  };

  const sortByDateAsc = () => {
    const sorted = [...items].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    setItems(sorted);
  };

  const sortByDateDesc = () => {
    const sorted = [...items].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    setItems(sorted);
  };

  const sortByAlphabetical = () => {
    const sorted = [...items].sort((a, b) =>
      (a.title || a.locationName).localeCompare(b.title || b.locationName, 'de')
    );
    setItems(sorted);
  };

  const handleSave = () => {
    // Assign orderIndex to each entry according to current list position
    const orderedWithIndex = items.map((entry, idx) => ({
      ...entry,
      orderIndex: idx,
      updatedAt: new Date().toISOString(),
    }));
    onSaveOrder(orderedWithIndex);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#4E3B31]/60 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] bg-[#FDFBF7] border border-[#E5E1D8] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E1D8] bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#8A9A5B]/15 text-[#8A9A5B] flex items-center justify-center">
              <ListOrdered className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#4E3B31] font-serif">
                Reihenfolge der Stopps anpassen
              </h3>
              <p className="text-xs text-[#8C8273]">
                {activeTrip ? activeTrip.title : 'Reise'} · {items.length} Einträge ordnen
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#8C8273] hover:text-[#4E3B31] hover:bg-[#E5E1D8] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick presets toolbar */}
        <div className="px-6 py-2.5 bg-[#F7F4EE] border-b border-[#E5E1D8] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] font-bold text-[#6B5E55] uppercase tracking-wider">
            Schnell-Sortierung:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={sortByDateAsc}
              className="px-2.5 py-1 rounded-lg bg-white border border-[#E5E1D8] hover:bg-[#EAE5DC] text-[11px] font-semibold text-[#4E3B31] flex items-center gap-1 transition"
              title="Chronologisch nach Datum sortieren"
            >
              <Calendar className="w-3 h-3 text-[#8A9A5B]" />
              <span>Datum (Start → Ziel)</span>
            </button>
            <button
              type="button"
              onClick={sortByDateDesc}
              className="px-2.5 py-1 rounded-lg bg-white border border-[#E5E1D8] hover:bg-[#EAE5DC] text-[11px] font-semibold text-[#4E3B31] flex items-center gap-1 transition"
              title="Neueste Einträge nach oben"
            >
              <RotateCcw className="w-3 h-3 text-[#E2725B]" />
              <span>Neueste zuerst</span>
            </button>
            <button
              type="button"
              onClick={sortByAlphabetical}
              className="px-2.5 py-1 rounded-lg bg-white border border-[#E5E1D8] hover:bg-[#EAE5DC] text-[11px] font-semibold text-[#4E3B31] flex items-center gap-1 transition"
              title="Alphabetisch nach Ort / Titel sortieren"
            >
              <ArrowUpDown className="w-3 h-3 text-[#D4A373]" />
              <span>A → Z</span>
            </button>
          </div>
        </div>

        {/* Reorderable Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
          {items.length === 0 ? (
            <div className="text-center py-12 text-[#8C8273] text-xs">
              Keine Einträge in dieser Reise vorhanden.
            </div>
          ) : (
            items.map((entry, index) => {
              const cat = CATEGORIES.find((c) => c.id === entry.category) || CATEGORIES[0];
              const hasPhoto = entry.media && entry.media.length > 0 && entry.media[0].type === 'photo';
              const photoUrl = hasPhoto ? entry.media[0].url : null;
              const isFirst = index === 0;
              const isLast = index === items.length - 1;

              return (
                <div
                  key={entry.id}
                  className="group flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl bg-white border border-[#E5E1D8] hover:border-[#8A9A5B]/50 hover:shadow-md transition bg-opacity-90"
                >
                  {/* Position Badge */}
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm"
                    style={{ backgroundColor: cat.color }}
                  >
                    {index + 1}
                  </div>

                  {/* Thumbnail / Category Icon */}
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#F1EDE6] shrink-0 border border-[#E5E1D8] flex items-center justify-center">
                    {photoUrl ? (
                      <img src={photoUrl} alt={entry.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-base">📍</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-xs sm:text-sm text-[#4E3B31] truncate font-serif">
                        {entry.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[#8C8273] truncate">
                      {entry.locationName && (
                        <span className="truncate flex items-center gap-0.5">
                          <MapPin className="w-3 h-3 text-[#E2725B] shrink-0" />
                          <span className="truncate">{entry.locationName.split(',')[0]}</span>
                        </span>
                      )}
                      <span>·</span>
                      <span>{new Date(entry.date).toLocaleDateString('de-DE')}</span>
                    </div>
                  </div>

                  {/* Reorder Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => moveItem(index, 'top')}
                      className={`p-1.5 rounded-lg border transition ${
                        isFirst
                          ? 'opacity-30 cursor-not-allowed text-[#8C8273] border-transparent'
                          : 'text-[#4E3B31] hover:bg-[#F1EDE6] border-[#E5E1D8] hover:text-[#8A9A5B]'
                      }`}
                      title="Ganz nach oben"
                    >
                      <ArrowUpToLine className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => moveItem(index, 'up')}
                      className={`p-1.5 rounded-lg border transition ${
                        isFirst
                          ? 'opacity-30 cursor-not-allowed text-[#8C8273] border-transparent'
                          : 'text-[#4E3B31] hover:bg-[#F1EDE6] border-[#E5E1D8] hover:text-[#8A9A5B]'
                      }`}
                      title="Eins nach oben"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => moveItem(index, 'down')}
                      className={`p-1.5 rounded-lg border transition ${
                        isLast
                          ? 'opacity-30 cursor-not-allowed text-[#8C8273] border-transparent'
                          : 'text-[#4E3B31] hover:bg-[#F1EDE6] border-[#E5E1D8] hover:text-[#8A9A5B]'
                      }`}
                      title="Eins nach unten"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => moveItem(index, 'bottom')}
                      className={`p-1.5 rounded-lg border transition ${
                        isLast
                          ? 'opacity-30 cursor-not-allowed text-[#8C8273] border-transparent'
                          : 'text-[#4E3B31] hover:bg-[#F1EDE6] border-[#E5E1D8] hover:text-[#8A9A5B]'
                      }`}
                      title="Ganz nach unten"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-[#E5E1D8] flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-[#8C8273] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#D4A373]" />
            <span>Änderungen wirken sich auf Timeline & Weltkarten-Route aus.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#6B5E55] hover:bg-[#F1EDE6] transition"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-[#8A9A5B] hover:bg-[#78884E] text-white text-xs font-bold shadow-md shadow-[#8A9A5B]/20 transition flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Reihenfolge speichern</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
