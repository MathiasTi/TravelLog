import React from 'react';
import { JournalEntry, Trip, Collaborator } from '../../types';
import { CATEGORIES } from '../../data/initialData';
import {
  BarChart3,
  MapPin,
  Camera,
  Heart,
  Navigation,
  Download
} from 'lucide-react';

interface StatsViewProps {
  entries: JournalEntry[];
  activeTrip: Trip | null;
  currentUser: Collaborator;
}

// Calculate Haversine distance in km between coordinate pairs
function calculateTotalDistance(entries: JournalEntry[]): number {
  if (entries.length < 2) return 0;

  const toRad = (x: number) => (x * Math.PI) / 180;
  let totalKm = 0;

  for (let i = 0; i < entries.length - 1; i++) {
    const lat1 = entries[i].coordinates.lat;
    const lon1 = entries[i].coordinates.lng;
    const lat2 = entries[i + 1].coordinates.lat;
    const lon2 = entries[i + 1].coordinates.lng;

    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalKm += R * c;
  }

  return Math.round(totalKm);
}

export const StatsView: React.FC<StatsViewProps> = ({ entries, activeTrip }) => {
  const totalStops = entries.length;
  const totalMedia = entries.reduce((acc, e) => acc + (e.media?.length || 0), 0);
  const totalComments = entries.reduce((acc, e) => acc + (e.comments?.length || 0), 0);
  const totalLikes = entries.reduce((acc, e) => acc + (e.likes?.length || 0), 0);
  const totalDistanceKm = calculateTotalDistance(entries);

  // Category counts
  const categoryCounts = CATEGORIES.map((cat) => ({
    ...cat,
    count: entries.filter((e) => e.category === cat.id).length,
  }));

  // Author breakdown
  const authorMap = new Map<string, { author: Collaborator; count: number }>();
  entries.forEach((e) => {
    const existing = authorMap.get(e.author.id);
    if (existing) {
      existing.count += 1;
    } else {
      authorMap.set(e.author.id, { author: e.author, count: 1 });
    }
  });
  const authorsList = Array.from(authorMap.values());

  // Export as JSON backup
  const handleExportJSON = () => {
    const exportData = {
      trip: activeTrip,
      entries,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTrip?.title || 'reisetagebuch'}-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full h-full overflow-y-auto p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E1D8]">
        <div>
          <h2 className="text-2xl font-bold text-[#4E3B31] font-serif flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#E2725B]" />
            <span>Reisestatistik & Auswertung</span>
          </h2>
          <p className="text-xs text-[#6B5E55] mt-0.5">
            Zusammenfassung für {activeTrip?.title || 'deine Reisen'}
          </p>
        </div>

        {/* Export JSON Button */}
        <button
          type="button"
          onClick={handleExportJSON}
          className="px-4 py-2 rounded-xl bg-white hover:bg-[#F1EDE6] border border-[#E5E1D8] text-[#4E3B31] text-xs font-semibold flex items-center gap-2 transition shadow-sm"
        >
          <Download className="w-4 h-4 text-[#8A9A5B]" />
          <span>Reisedaten als JSON exportieren</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-5 rounded-3xl bg-white border border-[#E5E1D8] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#6B5E55]">Erfasste Stopps</span>
            <div className="p-2 rounded-xl bg-[#E2725B]/15 text-[#E2725B]">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#4E3B31] font-serif">{totalStops}</div>
          <span className="text-[11px] text-[#8C8273]">Orte auf der Weltkarte</span>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-[#E5E1D8] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#6B5E55]">Zurückgelegte Route</span>
            <div className="p-2 rounded-xl bg-[#8A9A5B]/15 text-[#8A9A5B]">
              <Navigation className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#4E3B31] font-serif">~{totalDistanceKm} km</div>
          <span className="text-[11px] text-[#8C8273]">Distanz zwischen Stopps</span>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-[#E5E1D8] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#6B5E55]">Fotos</span>
            <div className="p-2 rounded-xl bg-[#8A9A5B]/15 text-[#8A9A5B]">
              <Camera className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#4E3B31] font-serif">{totalMedia}</div>
          <span className="text-[11px] text-[#8C8273]">Gespeicherte Fotos</span>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-[#E5E1D8] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#6B5E55]">Reaktionen & Notizen</span>
            <div className="p-2 rounded-xl bg-[#E2725B]/15 text-[#E2725B]">
              <Heart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#4E3B31] font-serif">
            {totalLikes + totalComments}
          </div>
          <span className="text-[11px] text-[#8C8273]">{totalComments} Kommentare, {totalLikes} Likes</span>
        </div>
      </div>

      {/* Categories & Authors Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Categories Distribution */}
        <div className="p-6 rounded-3xl bg-white border border-[#E5E1D8] shadow-sm space-y-4">
          <h3 className="text-base font-bold text-[#4E3B31] font-serif">Kategorien & Aktivitäten</h3>
          <div className="space-y-3">
            {categoryCounts.map((cat) => {
              const percentage = totalStops > 0 ? Math.round((cat.count / totalStops) * 100) : 0;
              return (
                <div key={cat.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6B5E55] flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                      {cat.label}
                    </span>
                    <span className="text-[#8C8273] font-mono">
                      {cat.count} ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#F1EDE6] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%`, backgroundColor: cat.color }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Companion Contributions */}
        <div className="p-6 rounded-3xl bg-white border border-[#E5E1D8] shadow-sm space-y-4">
          <h3 className="text-base font-bold text-[#4E3B31] font-serif">Mitreisende & Beiträge</h3>
          <div className="space-y-3">
            {authorsList.map(({ author, count }) => (
              <div
                key={author.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-[#FDFBF7] border border-[#E5E1D8]"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={author.avatar}
                    alt={author.name}
                    className="w-8 h-8 rounded-full object-cover border border-[#E5E1D8]"
                  />
                  <div>
                    <div className="text-xs font-bold text-[#4E3B31]">{author.name}</div>
                    <span className="text-[10px] text-[#8C8273] capitalize">{author.role}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-[#8A9A5B] font-mono">{count}</span>
                  <p className="text-[10px] text-[#8C8273]">Erinnerungen</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
