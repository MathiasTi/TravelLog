import React from 'react';
import { ViewMode, Trip, Collaborator } from '../../types';
import { canCreateOrEditEntries } from '../../utils/permissions';
import { Map, Clock, Image as ImageIcon, BarChart3, Plus } from 'lucide-react';

interface MobileBottomNavProps {
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  onAddNewEntry: () => void;
  activeTrip: Trip | null;
  currentUser: Collaborator;
  entriesCount?: number;
  mediaCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  viewMode,
  onChangeViewMode,
  onAddNewEntry,
  activeTrip,
  currentUser,
  entriesCount = 0,
  mediaCount = 0,
}) => {
  const canEdit = canCreateOrEditEntries(activeTrip, currentUser);

  return (
    <nav
      id="mobile-bottom-navigation"
      aria-label="Mobile Hauptnavigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FDFBF7]/95 dark:bg-[#181614]/95 backdrop-blur-lg border-t border-[#E5E1D8] dark:border-[#38322C] px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom,0.5rem))] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)] transition-colors duration-200"
    >
      <div className="max-w-md mx-auto flex items-center justify-around relative">
        {/* Map Tab */}
        <button
          type="button"
          id="mobile-nav-map-btn"
          onClick={() => onChangeViewMode('map')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all relative ${
            viewMode === 'map'
              ? 'text-[#E2725B] font-bold scale-105'
              : 'text-[#8C8273] dark:text-[#9C9182] hover:text-[#4E3B31] dark:hover:text-[#EDE8DF]'
          }`}
        >
          <div className="relative">
            <Map className="w-5 h-5" />
            {entriesCount > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#8A9A5B] text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                {entriesCount > 99 ? '99+' : entriesCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 font-medium">Karte</span>
          {viewMode === 'map' && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#E2725B] mt-0.5 absolute -bottom-1" />
          )}
        </button>

        {/* Timeline / Chronik Tab */}
        <button
          type="button"
          id="mobile-nav-timeline-btn"
          onClick={() => onChangeViewMode('timeline')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all relative ${
            viewMode === 'timeline'
              ? 'text-[#E2725B] font-bold scale-105'
              : 'text-[#8C8273] dark:text-[#9C9182] hover:text-[#4E3B31] dark:hover:text-[#EDE8DF]'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-0.5 font-medium">Chronik</span>
          {viewMode === 'timeline' && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#E2725B] mt-0.5 absolute -bottom-1" />
          )}
        </button>

        {/* Center Quick Add FAB */}
        <div className="flex-1 flex justify-center -mt-5">
          <button
            type="button"
            id="mobile-nav-add-btn"
            onClick={onAddNewEntry}
            disabled={!canEdit}
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 border-2 border-[#FDFBF7] dark:border-[#181614] ${
              canEdit
                ? 'bg-[#E2725B] hover:bg-[#D46049] text-white shadow-[#E2725B]/30 hover:scale-105'
                : 'bg-[#E5E1D8] dark:bg-[#38322C] text-[#8C8273] cursor-not-allowed opacity-60'
            }`}
            title={
              canEdit
                ? 'Neuen Stopp / Erinnerung erfassen'
                : 'Nur Lese-Rechte: Erfassen in dieser Reise nicht gestattet'
            }
            aria-label="Neuen Reiseeintrag hinzufügen"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* Gallery Tab */}
        <button
          type="button"
          id="mobile-nav-gallery-btn"
          onClick={() => onChangeViewMode('gallery')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all relative ${
            viewMode === 'gallery'
              ? 'text-[#E2725B] font-bold scale-105'
              : 'text-[#8C8273] dark:text-[#9C9182] hover:text-[#4E3B31] dark:hover:text-[#EDE8DF]'
          }`}
        >
          <div className="relative">
            <ImageIcon className="w-5 h-5" />
            {mediaCount > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#E2725B] text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                {mediaCount > 99 ? '99+' : mediaCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 font-medium">Galerie</span>
          {viewMode === 'gallery' && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#E2725B] mt-0.5 absolute -bottom-1" />
          )}
        </button>

        {/* Stats Tab */}
        <button
          type="button"
          id="mobile-nav-stats-btn"
          onClick={() => onChangeViewMode('stats')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all relative ${
            viewMode === 'stats'
              ? 'text-[#E2725B] font-bold scale-105'
              : 'text-[#8C8273] dark:text-[#9C9182] hover:text-[#4E3B31] dark:hover:text-[#EDE8DF]'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-0.5 font-medium">Stats</span>
          {viewMode === 'stats' && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#E2725B] mt-0.5 absolute -bottom-1" />
          )}
        </button>
      </div>
    </nav>
  );
};
