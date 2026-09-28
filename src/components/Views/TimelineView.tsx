import React, { useState } from 'react';
import { JournalEntry, Trip, Collaborator, EntrySortMode } from '../../types';
import { CATEGORIES } from '../../data/initialData';
import { ConfirmDeleteModal } from '../Modals/ConfirmDeleteModal';
import { ReorderEntriesModal } from '../Modals/ReorderEntriesModal';
import { sortJournalEntries, moveEntryInList } from '../../utils/entrySorting';
import { canCreateOrEditEntries, canDeleteEntry, ROLE_DEFINITIONS } from '../../utils/permissions';
import {
  MapPin,
  Calendar,
  Heart,
  MessageCircle,
  Navigation,
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  Snowflake,
  Wind,
  Plus,
  Edit,
  Trash2,
  ListOrdered,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  SlidersHorizontal,
  Crown,
  Eye,
  Edit3
} from 'lucide-react';

interface TimelineViewProps {
  entries: JournalEntry[];
  activeTrip: Trip | null;
  currentUser: Collaborator;
  onSelectEntry: (entry: JournalEntry) => void;
  onFocusOnMap: (entry: JournalEntry) => void;
  onAddEntry: () => void;
  onEditEntry?: (entry: JournalEntry) => void;
  onDeleteEntry?: (entryId: string) => void;
  onReorderEntries?: (orderedEntries: JournalEntry[]) => void;
  sortMode?: EntrySortMode;
  onChangeSortMode?: (mode: EntrySortMode) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  entries,
  activeTrip,
  currentUser,
  onSelectEntry,
  onFocusOnMap,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  onReorderEntries,
  sortMode: controlledSortMode,
  onChangeSortMode,
}) => {
  const [internalSortMode, setInternalSortMode] = useState<EntrySortMode>('date_asc');
  const activeSortMode = controlledSortMode || internalSortMode;

  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);

  const canWrite = canCreateOrEditEntries(activeTrip, currentUser);

  const handleSortChange = (mode: EntrySortMode) => {
    if (onChangeSortMode) {
      onChangeSortMode(mode);
    } else {
      setInternalSortMode(mode);
    }
  };

  // Sort entries according to chosen sortMode
  const sortedEntries = sortJournalEntries(entries, activeSortMode);

  // Quick move single entry up or down
  const handleQuickMove = (entryId: string, direction: 'up' | 'down') => {
    if (!canWrite) return;
    const reordered = moveEntryInList(sortedEntries, entryId, direction);
    handleSortChange('custom');
    if (onReorderEntries) {
      onReorderEntries(reordered);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      {/* Trip Hero Header */}
      {activeTrip && (
        <div className="relative rounded-3xl overflow-hidden border border-[#E5E1D8] shadow-md bg-white mb-6">
          <div className="h-48 sm:h-60 w-full relative">
            <img
              src={activeTrip.coverImage}
              alt={activeTrip.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#4E3B31] via-[#4E3B31]/50 to-transparent"></div>
          </div>
          <div className="p-6 -mt-20 relative z-10">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-[#8A9A5B] text-white shadow-sm">
              Reisechronik
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-white font-serif mt-2 mb-1 drop-shadow-sm">
              {activeTrip.title}
            </h1>
            <p className="text-xs sm:text-sm text-stone-200 max-w-2xl leading-relaxed">
              {activeTrip.description}
            </p>

            <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-white/20 text-xs text-stone-300">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#D4A373]" />
                <span>
                  {new Date(activeTrip.startDate).toLocaleDateString('de-DE')}
                  {activeTrip.endDate ? ` – ${new Date(activeTrip.endDate).toLocaleDateString('de-DE')}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#E2725B]" />
                <span>{entries.length} Reise-Stopps</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-stone-300">Mitreisende:</span>
                <div className="flex -space-x-2">
                  {activeTrip.collaborators.map((c) => {
                    const roleInfo = ROLE_DEFINITIONS[c.role] || ROLE_DEFINITIONS.editor;
                    return (
                      <img
                        key={c.id}
                        src={c.avatar}
                        title={`${c.name} (${roleInfo.shortLabel})`}
                        alt={c.name}
                        className="w-6 h-6 rounded-full object-cover border-2 border-white shadow-sm"
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sorting & Order Controls Bar */}
      {entries.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-white border border-[#E5E1D8] shadow-sm">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#8A9A5B]" />
            <span className="text-xs font-bold text-[#4E3B31]">Sortierung:</span>
            <div className="relative inline-block">
              <select
                value={activeSortMode}
                onChange={(e) => handleSortChange(e.target.value as EntrySortMode)}
                className="appearance-none pl-3 pr-8 py-1.5 rounded-xl bg-[#F7F4EE] border border-[#E5E1D8] text-xs font-bold text-[#4E3B31] focus:outline-none focus:border-[#8A9A5B] cursor-pointer"
              >
                <option value="date_asc">📅 Reisedatum (Start → Ziel)</option>
                <option value="date_desc">⏱️ Neueste zuerst</option>
                <option value="custom">✏️ Eigene Reihenfolge</option>
                <option value="title_asc">🔤 Alphabetisch (A → Z)</option>
              </select>
              <ArrowUpDown className="w-3 h-3 text-[#8C8273] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canWrite && (
              <button
                type="button"
                onClick={() => setIsReorderModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-[#8A9A5B]/15 hover:bg-[#8A9A5B]/25 text-[#8A9A5B] border border-[#8A9A5B]/30 text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                title="Alle Stopps per Schnell-Reihung oder Pfeiltasten ordnen"
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>Reihenfolge anpassen</span>
              </button>
            )}

            <button
              type="button"
              onClick={onAddEntry}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm ${
                canWrite
                  ? 'bg-[#E2725B] hover:bg-[#D46049] text-white shadow-[#E2725B]/20'
                  : 'bg-[#F1EDE6] text-[#8C8273] border border-[#E5E1D8]'
              }`}
            >
              {canWrite ? <Plus className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-[#8C8273]" />}
              <span>{canWrite ? 'Stopp hinzufügen' : 'Nur Lesen'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {sortedEntries.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl bg-white/70 border border-[#E5E1D8] border-dashed shadow-sm">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#8A9A5B]/15 text-[#8A9A5B] flex items-center justify-center">
            <MapPin className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-[#4E3B31] font-serif mb-1">Noch keine Einträge vorhanden</h3>
          <p className="text-xs text-[#6B5E55] max-w-md mx-auto mb-4">
            Beginne deine Reise, indem du den ersten Stopp auf der Weltkarte markierst oder hier einen Eintrag verfasst.
          </p>
          <button
            type="button"
            onClick={onAddEntry}
            className="px-5 py-2.5 rounded-xl bg-[#E2725B] hover:bg-[#D46049] text-white font-bold text-xs inline-flex items-center gap-2 shadow-md shadow-[#E2725B]/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Ersten Reise-Stopp anlegen</span>
          </button>
        </div>
      ) : (
        /* Timeline Items */
        <div className="relative pl-6 sm:pl-8 border-l-2 border-[#DCD7CC] space-y-8 my-6">
          {sortedEntries.map((entry, index) => {
            const catConfig = CATEGORIES.find((c) => c.id === entry.category) || CATEGORIES[0];
            const hasMedia = entry.media && entry.media.length > 0;
            const hasLiked = entry.likes?.includes(currentUser.id);
            const isFirst = index === 0;
            const isLast = index === sortedEntries.length - 1;

            return (
              <div key={entry.id} className="relative group">
                {/* Timeline Pin Indicator */}
                <div
                  className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white shadow-md transform group-hover:scale-110 transition"
                  style={{ backgroundColor: catConfig.color }}
                >
                  {index + 1}
                </div>

                {/* Entry Card */}
                <div
                  onClick={() => onSelectEntry(entry)}
                  className="bg-white border border-[#E5E1D8] rounded-3xl overflow-hidden shadow-sm hover:shadow-md hover:border-[#D5CEC2] transition cursor-pointer transform hover:-translate-y-0.5"
                >
                  {/* Photo Grid */}
                  {hasMedia && (
                    <div className="relative aspect-video max-h-72 w-full overflow-hidden bg-stone-900">
                      <img
                        src={entry.media[0].url}
                        alt={entry.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />

                      {/* Multiple media counter */}
                      {entry.media.length > 1 && (
                        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-[#4E3B31]/80 backdrop-blur-md text-[11px] font-semibold text-white border border-white/20 shadow-sm">
                          +{entry.media.length - 1} {entry.media.length === 2 ? 'weiteres Foto' : 'weitere Fotos'}
                        </span>
                      )}

                      <span
                        className="absolute bottom-3 left-3 px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider backdrop-blur-md border shadow-sm"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.9)',
                          color: catConfig.color,
                          borderColor: `${catConfig.color}40`,
                        }}
                      >
                        {catConfig.label}
                      </span>
                    </div>
                  )}

                  {/* Card Content */}
                  <div className="p-5 sm:p-6 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#8C8273]">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#E2725B]" />
                          <span>
                            {new Date(entry.date).toLocaleDateString('de-DE', {
                              weekday: 'short',
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        {entry.weather && (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E2725B]/10 text-[#E2725B] text-[11px] font-medium border border-[#E2725B]/20">
                            {entry.weather.icon === 'cloud-rain' ? (
                              <CloudRain className="w-3 h-3" />
                            ) : entry.weather.icon === 'cloud-sun' ? (
                              <CloudSun className="w-3 h-3" />
                            ) : entry.weather.icon === 'cloud' ? (
                              <Cloud className="w-3 h-3" />
                            ) : entry.weather.icon === 'snowflake' ? (
                              <Snowflake className="w-3 h-3" />
                            ) : entry.weather.icon === 'wind' ? (
                              <Wind className="w-3 h-3" />
                            ) : (
                              <Sun className="w-3 h-3" />
                            )}
                            <span>{entry.weather.temp !== undefined ? `${entry.weather.temp}°C` : entry.weather.label}</span>
                          </div>
                        )}
                        {entry.mood && (
                          <>
                            <span>·</span>
                            <span>{entry.mood}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Quick Up/Down Move Buttons (write permission only) */}
                        {canWrite && (
                          <div className="flex items-center mr-1 bg-[#F1EDE6] rounded-lg p-0.5 border border-[#E5E1D8]">
                            <button
                              type="button"
                              disabled={isFirst}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickMove(entry.id, 'up');
                              }}
                              className={`p-1 rounded-md transition ${
                                isFirst
                                  ? 'opacity-25 cursor-not-allowed text-[#8C8273]'
                                  : 'text-[#4E3B31] hover:bg-white hover:text-[#8A9A5B] shadow-sm'
                              }`}
                              title="Eins nach oben verschieben"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isLast}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickMove(entry.id, 'down');
                              }}
                              className={`p-1 rounded-md transition ${
                                isLast
                                  ? 'opacity-25 cursor-not-allowed text-[#8C8273]'
                                  : 'text-[#4E3B31] hover:bg-white hover:text-[#8A9A5B] shadow-sm'
                              }`}
                              title="Eins nach unten verschieben"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onFocusOnMap(entry);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#8A9A5B]/15 text-[#8A9A5B] hover:bg-[#8A9A5B]/25 border border-[#8A9A5B]/30 text-xs font-semibold flex items-center gap-1 transition"
                          title="Auf Weltkarte zentrieren"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>Karte</span>
                        </button>

                        {onEditEntry && canWrite && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditEntry(entry);
                            }}
                            className="p-1 rounded-lg text-[#6B5E55] hover:text-[#4E3B31] hover:bg-[#E5E1D8] transition"
                            title="Eintrag bearbeiten"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {onDeleteEntry && canDeleteEntry(entry, activeTrip, currentUser) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEntryToDelete(entry);
                            }}
                            className="p-1 rounded-lg text-[#6B5E55] hover:text-red-600 hover:bg-red-50 transition"
                            title="Eintrag löschen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Location Heading & Title */}
                    <div>
                      {entry.locationName && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#E2725B] uppercase tracking-wider mb-1">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{entry.locationName}</span>
                        </div>
                      )}

                      <h3 className="text-xl font-bold text-[#4E3B31] font-serif group-hover:text-[#E2725B] transition">
                        {entry.title}
                      </h3>
                    </div>

                    {/* Note */}
                    {entry.note && (
                      <p className="text-xs sm:text-sm text-[#6B5E55] line-clamp-3 leading-relaxed">
                        {entry.note}
                      </p>
                    )}

                    {/* Card Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#E5E1D8] text-xs text-[#8C8273]">
                      {/* Author */}
                      <div className="flex items-center gap-2">
                        <img
                          src={entry.author.avatar}
                          alt={entry.author.name}
                          className="w-5 h-5 rounded-full object-cover border border-[#E5E1D8]"
                        />
                        <span className="text-[#4E3B31] font-medium">{entry.author.name}</span>
                      </div>

                      {/* Likes & Comments Count */}
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                          <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'text-[#E2725B] fill-[#E2725B]' : 'text-[#8C8273]'}`} />
                          <span className="text-[#4E3B31]">{entry.likes?.length || 0}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MessageCircle className="w-3.5 h-3.5 text-[#8C8273]" />
                          <span className="text-[#4E3B31]">{entry.comments?.length || 0}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Entry Deletion */}
      <ConfirmDeleteModal
        isOpen={!!entryToDelete}
        onClose={() => setEntryToDelete(null)}
        itemName={entryToDelete?.title}
        title="Reiseeintrag löschen?"
        description={`Möchtest du die Erinnerung an "${entryToDelete?.title || 'diesen Ort'}" wirklich unwiderruflich aus deiner Chronik entfernen?`}
        confirmText="Eintrag löschen"
        onConfirm={() => {
          if (entryToDelete && onDeleteEntry) {
            onDeleteEntry(entryToDelete.id);
            setEntryToDelete(null);
          }
        }}
      />

      {/* Reorder Entries Modal */}
      <ReorderEntriesModal
        isOpen={isReorderModalOpen}
        onClose={() => setIsReorderModalOpen(false)}
        entries={sortedEntries}
        activeTrip={activeTrip}
        onSaveOrder={(reordered) => {
          handleSortChange('custom');
          if (onReorderEntries) {
            onReorderEntries(reordered);
          }
        }}
      />
    </div>
  );
};
