import React, { useState } from 'react';
import { Trip, Collaborator, SyncState, ViewMode, AuthUser, AuthModalTab, ThemeMode } from '../types';
import { ROLE_DEFINITIONS, getUserRoleInTrip, canCreateOrEditEntries } from '../utils/permissions';
import {
  Compass,
  Map,
  Clock,
  Image as ImageIcon,
  BarChart3,
  Plus,
  Wifi,
  WifiOff,
  RefreshCw,
  Lock,
  ChevronDown,
  Settings,
  UserCheck,
  Share2,
  LogIn,
  User as UserIcon,
  LogOut,
  ShieldCheck,
  Sparkles,
  Smartphone,
  QrCode,
  Tag,
  Crown,
  Edit3,
  Eye,
  Moon,
  Sun,
  BookOpen,
  Database,
  Download,
  Upload,
} from 'lucide-react';

interface HeaderProps {
  trips: Trip[];
  activeTrip: Trip | null;
  onSelectTrip: (tripId: string) => void;
  onOpenTripModal: (trip?: Trip) => void;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  syncState: SyncState;
  onManualSync: () => void;
  currentUser: Collaborator;
  onChangeCurrentUser: (user: Collaborator) => void;
  onOpenAddEntry: () => void;
  authUser: AuthUser | null;
  onOpenAuthModal: (tab?: AuthModalTab) => void;
  onOpenAccountModal: () => void;
  onSignOut: () => void;
  onOpenMobileSyncQr?: () => void;
  onOpenChangelog?: () => void;
  onOpenTrackUpload?: () => void;
  onOpenFitUpload?: () => void;
  onOpenExportModal?: () => void;
  onOpenBackupModal?: (tab?: 'backup' | 'restore') => void;
  onCopyTripLink?: (trip?: Trip) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  trips,
  activeTrip,
  onSelectTrip,
  onOpenTripModal,
  viewMode,
  onChangeViewMode,
  syncState,
  onManualSync,
  currentUser,
  onChangeCurrentUser,
  onOpenAddEntry,
  authUser,
  onOpenAuthModal,
  onOpenAccountModal,
  onSignOut,
  onOpenMobileSyncQr,
  onOpenChangelog,
  onOpenTrackUpload,
  onOpenFitUpload,
  onOpenExportModal,
  onOpenBackupModal,
  onCopyTripLink,
  theme,
  onToggleTheme,
}) => {
  const [isTripMenuOpen, setIsTripMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [copiedTripId, setCopiedTripId] = useState<string | null>(null);

  const handleOpenTrackModal = onOpenTrackUpload || onOpenFitUpload;

  const handleCopyLink = (e: React.MouseEvent, tripToCopy?: Trip | null) => {
    e.stopPropagation();
    const target = tripToCopy || activeTrip;
    if (!target) return;
    if (onCopyTripLink) {
      onCopyTripLink(target);
    }
    setCopiedTripId(target.id);
    setTimeout(() => setCopiedTripId(null), 2000);
  };

  const currentTripRole = activeTrip ? getUserRoleInTrip(activeTrip, currentUser) : 'owner';
  const roleMeta = ROLE_DEFINITIONS[currentTripRole] || ROLE_DEFINITIONS.editor;
  const canWrite = canCreateOrEditEntries(activeTrip, currentUser);

  return (
    <header className="h-16 bg-[#FDFBF7]/95 backdrop-blur-md border-b border-[#E5E1D8] px-3 sm:px-6 flex items-center justify-between gap-2 z-30 shrink-0 select-none">
      {/* Left: App Logo & Trip Selector */}
      <div className="flex items-center gap-2.5">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-[#8A9A5B] text-white flex items-center justify-center shadow-md shadow-[#8A9A5B]/20 font-bold">
            <Compass className="w-5 h-5" />
          </div>
          <span className="font-serif font-bold text-lg text-[#4E3B31] hidden md:inline tracking-tight">
            WanderLog
          </span>
        </div>

        {/* Version Tag with Changelog Modal Trigger */}
        {onOpenChangelog && (
          <button
            type="button"
            onClick={onOpenChangelog}
            className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#8A9A5B]/10 hover:bg-[#8A9A5B]/20 border border-[#8A9A5B]/30 text-[#8A9A5B] text-[10px] font-bold font-mono transition shadow-2xs"
            title="Changelog & Versionen anzeigen"
          >
            <Tag className="w-2.5 h-2.5" />
            <span>v1.9.8</span>
          </button>
        )}

        {/* Trip Switcher Dropdown */}
        <div className="relative flex items-center gap-1">
          <button
            type="button"
            data-testid="trip-switcher-button"
            aria-label="Reise auswählen"
            onClick={() => setIsTripMenuOpen(!isTripMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-[#F1EDE6] border border-[#E5E1D8] text-xs text-[#4E3B31] font-medium transition shadow-sm cursor-pointer"
          >
            <span className="truncate max-w-[110px] sm:max-w-[160px]">
              {activeTrip?.title || 'Reise wählen'}
            </span>
            {activeTrip?.passwordProtected && <Lock className="w-3 h-3 text-[#E2725B] shrink-0" />}
            <ChevronDown className="w-3.5 h-3.5 text-[#8C8273] shrink-0" />
          </button>

          {/* Direct Trip Link Quick Copy Button */}
          {activeTrip && (
            <button
              type="button"
              data-testid="trip-share-quick-btn"
              onClick={(e) => handleCopyLink(e, activeTrip)}
              className="p-1.5 rounded-xl bg-white hover:bg-[#F1EDE6] border border-[#E5E1D8] text-[#8C8273] hover:text-[#4E3B31] transition shadow-xs cursor-pointer"
              title={`Direktlink zur Reise "${activeTrip.title}" in die Zwischenablage kopieren`}
            >
              {copiedTripId === activeTrip.id ? (
                <ShieldCheck className="w-3.5 h-3.5 text-[#8A9A5B]" />
              ) : (
                <Share2 className="w-3.5 h-3.5 text-[#8A9A5B]" />
              )}
            </button>
          )}

          {/* Trip Dropdown Menu */}
          {isTripMenuOpen && (
            <div className="absolute left-0 top-full mt-2 w-72 bg-[#FDFBF7] dark:bg-[#25201C] backdrop-blur-md border border-[#E5E1D8] dark:border-[#3D3630] rounded-2xl shadow-2xl p-2 flex flex-col gap-1 z-50 divide-y divide-[#E5E1D8] dark:divide-[#3D3630]">
              <div className="space-y-1 pb-1">
                <span className="text-[10px] font-bold text-[#8C8273] uppercase tracking-wider px-2 pt-1 block">
                  Deine Reisen
                </span>
                {trips.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-[#8C8273] dark:text-[#A89F91] italic">
                    Noch keine Reisen vorhanden
                  </div>
                ) : (
                  trips.map((t) => (
                    <div
                      key={t.id}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition ${
                        activeTrip?.id === t.id
                          ? 'bg-[#8A9A5B] text-white'
                          : 'text-[#4E3B31] dark:text-[#EDE8DF] hover:bg-[#F1EDE6] dark:hover:bg-[#342F2A]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTrip(t.id);
                          setIsTripMenuOpen(false);
                        }}
                        className="truncate flex-1 text-left flex items-center gap-1.5 cursor-pointer py-0.5"
                      >
                        <span className="truncate">{t.title}</span>
                        {t.passwordProtected && (
                          <Lock className={`w-3 h-3 shrink-0 ${activeTrip?.id === t.id ? 'text-white' : 'text-[#E2725B]'}`} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleCopyLink(e, t)}
                        className={`p-1 rounded-lg transition shrink-0 cursor-pointer ${
                          activeTrip?.id === t.id
                            ? 'hover:bg-white/20 text-white'
                            : 'hover:bg-[#E5E1D8] dark:hover:bg-[#3D3630] text-[#8C8273] hover:text-[#4E3B31] dark:hover:text-white'
                        }`}
                        title={`Direktlink zu "${t.title}" kopieren`}
                      >
                        {copiedTripId === t.id ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                        ) : (
                          <Share2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Actions */}
              <div className="pt-1.5 space-y-1">
                {activeTrip && (
                  <button
                    type="button"
                    onClick={(e) => {
                      handleCopyLink(e, activeTrip);
                    }}
                    className="w-full px-3 py-2 rounded-xl text-left text-xs text-[#8A9A5B] hover:bg-[#8A9A5B]/10 font-bold flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Reise-Link kopieren</span>
                    </div>
                    {copiedTripId === activeTrip.id && (
                      <span className="text-[10px] bg-[#8A9A5B] text-white px-1.5 py-0.2 rounded font-mono">
                        Kopiert!
                      </span>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsTripMenuOpen(false);
                    onOpenTripModal();
                  }}
                  className="w-full px-3 py-2 rounded-xl text-left text-xs text-[#E2725B] hover:bg-[#E2725B]/10 font-bold flex items-center gap-2 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Neue Reise anlegen</span>
                </button>

                {activeTrip && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsTripMenuOpen(false);
                      onOpenTripModal(activeTrip);
                    }}
                    className="w-full px-3 py-2 rounded-xl text-left text-xs text-[#6B5E55] dark:text-[#9C9182] hover:bg-[#F1EDE6] dark:hover:bg-[#342F2A] flex items-center gap-2 transition cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#8C8273]" />
                    <span>Reise verwalten & Rollen</span>
                  </button>
                )}

                {activeTrip && onOpenExportModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsTripMenuOpen(false);
                      onOpenExportModal();
                    }}
                    className="w-full px-3 py-2 rounded-xl text-left text-xs text-[#8A9A5B] dark:text-[#A7B97B] hover:bg-[#8A9A5B]/10 font-bold flex items-center gap-2 transition cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Fotobuch & Bilder exportieren</span>
                  </button>
                )}

                {onOpenBackupModal && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsTripMenuOpen(false);
                        onOpenBackupModal('backup');
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs text-[#6B5E55] dark:text-[#C5BCAD] hover:bg-[#F1EDE6] dark:hover:bg-[#342F2A] font-semibold flex items-center gap-2 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#8A9A5B]" />
                      <span>Lokale Sicherung (Backup .json)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsTripMenuOpen(false);
                        onOpenBackupModal('restore');
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs text-[#6B5E55] dark:text-[#C5BCAD] hover:bg-[#F1EDE6] dark:hover:bg-[#342F2A] font-semibold flex items-center gap-2 transition cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#E2725B]" />
                      <span>Reisedaten wiederherstellen</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Current User Trip Role Badge */}
        {activeTrip && (
          <button
            type="button"
            onClick={() => onOpenTripModal(activeTrip)}
            className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition shadow-2xs ${roleMeta.badgeBg} ${roleMeta.badgeText} ${roleMeta.badgeBorder}`}
            title={`Deine Rolle in dieser Reise: ${roleMeta.label} - Klicken zum Öffnen der Reiseverwaltung`}
          >
            {currentTripRole === 'owner' ? (
              <Crown className="w-3 h-3 text-[#E2725B]" />
            ) : currentTripRole === 'editor' ? (
              <Edit3 className="w-3 h-3 text-[#8A9A5B]" />
            ) : (
              <Eye className="w-3 h-3 text-sky-600" />
            )}
            <span>{roleMeta.badgeLabel}</span>
          </button>
        )}
      </div>

      {/* Center: View Mode Nav (Map, Timeline, Gallery, Stats) - Desktop Only */}
      <div className="hidden md:flex items-center bg-[#F1EDE6] dark:bg-[#24201D] p-1 rounded-2xl border border-[#E5E1D8] dark:border-[#38322C]">
        <button
          type="button"
          onClick={() => onChangeViewMode('map')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
            viewMode === 'map'
              ? 'bg-white dark:bg-[#342F2A] text-[#4E3B31] dark:text-[#EDE8DF] shadow-sm font-bold'
              : 'text-[#6B5E55] dark:text-[#9C9182] hover:text-[#4E3B31] dark:hover:text-[#EDE8DF]'
          }`}
          title="Weltkarte"
        >
          <Map className="w-4 h-4" />
          <span>Karte</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeViewMode('timeline')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
            viewMode === 'timeline'
              ? 'bg-white dark:bg-[#342F2A] text-[#4E3B31] dark:text-[#EDE8DF] shadow-sm font-bold'
              : 'text-[#6B5E55] dark:text-[#9C9182] hover:text-[#4E3B31] dark:hover:text-[#EDE8DF]'
          }`}
          title="Chronik & Reisetagebuch"
        >
          <Clock className="w-4 h-4" />
          <span>Chronik</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeViewMode('gallery')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
            viewMode === 'gallery'
              ? 'bg-white dark:bg-[#342F2A] text-[#4E3B31] dark:text-[#EDE8DF] shadow-sm font-bold'
              : 'text-[#6B5E55] dark:text-[#9C9182] hover:text-[#4E3B31] dark:hover:text-[#EDE8DF]'
          }`}
          title="Fotogalerie"
        >
          <ImageIcon className="w-4 h-4" />
          <span>Galerie</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeViewMode('stats')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
            viewMode === 'stats'
              ? 'bg-white dark:bg-[#342F2A] text-[#4E3B31] dark:text-[#EDE8DF] shadow-sm font-bold'
              : 'text-[#6B5E55] dark:text-[#9C9182] hover:text-[#4E3B31] dark:hover:text-[#EDE8DF]'
          }`}
          title="Statistik & Auswertung"
        >
          <BarChart3 className="w-4 h-4" />
          <span>Statistik</span>
        </button>
      </div>

      {/* Right: Sync Status & Smartphone QR & User Profile & Add Button */}
      <div className="flex items-center gap-2">
        {/* GPS Track (.GPX / .FIT) Button (Desktop / Tablet) */}
        {handleOpenTrackModal && (
          <button
            type="button"
            onClick={handleOpenTrackModal}
            className="hidden sm:flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-[#8A9A5B]/10 hover:bg-[#8A9A5B]/20 text-[#677740] dark:text-[#A8BA76] border border-[#8A9A5B]/30 text-xs font-bold transition shadow-xs hover:scale-105 active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
            title="GPS-Track (.gpx oder .fit) von Garmin, Wahoo, Strava, Komoot importieren"
          >
            <span className="text-sm shrink-0">📍</span>
            <span className="hidden xl:inline">Track (.GPX / .FIT)</span>
            <span className="hidden sm:inline xl:hidden">Track</span>
          </button>
        )}

        {/* Photobook & Export Button */}
        {onOpenExportModal && activeTrip && (
          <button
            type="button"
            onClick={onOpenExportModal}
            className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white hover:bg-[#F1EDE6] dark:bg-[#2A2521] dark:hover:bg-[#342F2A] border border-[#E5E1D8] dark:border-[#3D3630] text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF] transition shadow-xs hover:scale-105 active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
            title="Fotobuch (PDF) & Bilder-Archiv (ZIP, GeoJSON, CSV, Markdown) exportieren"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#E2725B]" />
            <span className="hidden lg:inline">Fotobuch & Export</span>
          </button>
        )}

        {/* Local Backup & Restore Button */}
        {onOpenBackupModal && (
          <button
            type="button"
            onClick={() => onOpenBackupModal('backup')}
            className="hidden xl:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white hover:bg-[#F1EDE6] dark:bg-[#2A2521] dark:hover:bg-[#342F2A] border border-[#E5E1D8] dark:border-[#3D3630] text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF] transition shadow-xs hover:scale-105 active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
            title="Lokale Sicherung (Backup) auf Festplatte speichern & wiederherstellen"
          >
            <Database className="w-3.5 h-3.5 text-[#8A9A5B]" />
            <span>Sicherung</span>
          </button>
        )}

        {/* Smartphone Connect / Upload QR Button */}
        {onOpenMobileSyncQr && (
          <button
            type="button"
            onClick={onOpenMobileSyncQr}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#F1EDE6] border border-[#E5E1D8] text-xs font-semibold text-[#4E3B31] transition shadow-sm"
            title="Fotos direkt vom iPhone & Android übertragen per QR-Code"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#8A9A5B]" />
            <span className="hidden xl:inline">Handy-Upload</span>
          </button>
        )}

        {/* Offline / Cloud Sync Status Indicator */}
        <button
          type="button"
          onClick={onManualSync}
          className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
            !syncState.isOnline
              ? 'bg-[#E2725B]/15 border-[#E2725B]/30 text-[#E2725B]'
              : syncState.isSyncing
              ? 'bg-[#8A9A5B]/15 border-[#8A9A5B]/30 text-[#8A9A5B]'
              : syncState.pendingCount > 0
              ? 'bg-[#D4A373]/15 border-[#D4A373]/30 text-[#C88A58]'
              : 'bg-[#8A9A5B]/10 border-[#8A9A5B]/30 text-[#8A9A5B]'
          }`}
          title="Klicken für manuelle Synchronisierung mit Firestore"
        >
          {!syncState.isOnline ? (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline ({syncState.pendingCount})</span>
            </>
          ) : syncState.isSyncing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Syncing...</span>
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5" />
              <span>Cloud Sync OK</span>
            </>
          )}
        </button>

        {/* Authentication / User Profile & Role Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-white hover:bg-[#F1EDE6] dark:bg-[#2A2521] dark:hover:bg-[#342F2A] border border-[#E5E1D8] dark:border-[#3D3630] transition shadow-sm cursor-pointer"
            title={`Angemeldet als ${currentUser.name} (${currentUser.role === 'owner' ? 'Admin / Edition' : 'Nur Schauen'})`}
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className={`w-6 h-6 rounded-full object-cover border-2 ${
                currentUser.role === 'owner' ? 'border-[#8A9A5B]' : 'border-sky-400'
              }`}
            />
            <div className="hidden lg:flex flex-col text-left leading-tight">
              <span className="text-xs text-[#4E3B31] dark:text-[#EDE8DF] font-bold max-w-[100px] truncate">
                {currentUser.name}
              </span>
              <span className={`text-[9px] font-medium ${
                currentUser.role === 'owner' ? 'text-[#8A9A5B]' : 'text-sky-500'
              }`}>
                {currentUser.role === 'owner' ? 'Admin / Edition' : 'Nur Schauen'}
              </span>
            </div>
            <ChevronDown className="w-3 h-3 text-[#8C8273]" />
          </button>

          {/* User Dropdown Menu */}
          {isUserMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-[#FDFBF7] dark:bg-[#25201C] backdrop-blur-md border border-[#E5E1D8] dark:border-[#3D3630] rounded-2xl shadow-2xl p-2 flex flex-col gap-1 z-50 divide-y divide-[#E5E1D8] dark:divide-[#3D3630]">
              {/* Account Details Header */}
              <div className="p-2 space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className={`w-9 h-9 rounded-full object-cover border-2 ${
                      currentUser.role === 'owner' ? 'border-[#8A9A5B]' : 'border-sky-400'
                    }`}
                  />
                  <div className="truncate flex-1">
                    <div className="text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF] truncate">
                      {currentUser.name}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        currentUser.role === 'owner'
                          ? 'bg-[#8A9A5B]/20 text-[#687740] dark:text-[#A8BA76]'
                          : 'bg-sky-500/20 text-sky-600 dark:text-sky-400'
                      }`}>
                        {currentUser.role === 'owner' ? (
                          <>
                            <ShieldCheck className="w-3 h-3" />
                            <span>Admin & Editionen</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" />
                            <span>Nur Schauen</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onOpenAccountModal();
                  }}
                  className="w-full mt-1 px-3 py-1.5 rounded-xl bg-[#8A9A5B]/10 hover:bg-[#8A9A5B]/20 text-[#8A9A5B] font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Name & Profil anpassen</span>
                </button>
              </div>

              {/* Theme Toggle row inside user dropdown */}
              <div className="pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onToggleTheme();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-medium text-[#4E3B31] dark:text-[#EDE8DF] hover:bg-[#F1EDE6] dark:hover:bg-[#342F2A] flex items-center justify-between transition cursor-pointer"
                  title="Zwischen hellem und dunklem Erscheinungsbild wechseln"
                >
                  <div className="flex items-center gap-2">
                    {theme === 'dark' ? (
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Moon className="w-3.5 h-3.5 text-[#8C8273]" />
                    )}
                    <span>{theme === 'dark' ? 'Heller Modus' : 'Dunkelmodus (Nacht)'}</span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    theme === 'dark' ? 'bg-[#8A9A5B]/20 text-[#8A9A5B]' : 'bg-[#E5E1D8] text-[#6B5E55]'
                  }`}>
                    {theme === 'dark' ? 'AKTIV' : 'AUS'}
                  </span>
                </button>
              </div>

              {/* Photobook & Media Export inside user dropdown */}
              {onOpenExportModal && activeTrip && (
                <div className="pt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenExportModal();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-bold text-[#E2725B] hover:bg-[#E2725B]/10 flex items-center gap-2 transition cursor-pointer"
                    title="Fotobuch (PDF) & Bilder-Archiv exportieren"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Fotobuch & Export (PDF / ZIP)</span>
                  </button>
                </div>
              )}

              {/* Backup & Restore inside user dropdown */}
              {onOpenBackupModal && (
                <div className="pt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenBackupModal('backup');
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-bold text-[#8A9A5B] hover:bg-[#8A9A5B]/10 flex items-center gap-2 transition cursor-pointer"
                    title="Lokales Backup auf Festplatte sichern & wiederherstellen"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Sicherung & Wiederherstellung (Backup)</span>
                  </button>
                </div>
              )}

              {/* Changelog & Version in User Dropdown (Always accessible on Mobile) */}
              {onOpenChangelog && (
                <div className="pt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenChangelog();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-medium text-[#4E3B31] dark:text-[#EDE8DF] hover:bg-[#F1EDE6] dark:hover:bg-[#342F2A] flex items-center justify-between transition cursor-pointer"
                    title="Changelog & Versionen anzeigen"
                  >
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-[#8A9A5B]" />
                      <span>Changelog & Updates</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#8A9A5B]/15 text-[#8A9A5B] border border-[#8A9A5B]/30">
                      v1.9.8
                    </span>
                  </button>
                </div>
              )}

              {/* Sign Out / Password Switch */}
              <div className="pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onSignOut();
                  }}
                  className="w-full px-3 py-2 rounded-xl text-left text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 font-bold flex items-center gap-2 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Abmelden / Passwort wechseln</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Global Dark / Light Theme Toggle Button */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="p-2 rounded-xl bg-white hover:bg-[#F1EDE6] border border-[#E5E1D8] text-[#4E3B31] transition shadow-sm hover:scale-105 active:scale-95 shrink-0"
          title={theme === 'dark' ? 'Hellen Modus aktivieren (Tag)' : 'Dunkelmodus aktivieren (Nacht / Augenschonend)'}
          aria-label={theme === 'dark' ? 'Hellen Modus aktivieren' : 'Dunkelmodus aktivieren'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 animate-pulse" />
          ) : (
            <Moon className="w-4 h-4 text-[#6B5E55]" />
          )}
        </button>

        {/* Primary Add Memory Button */}
        <button
          type="button"
          onClick={onOpenAddEntry}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs transition transform active:scale-95 shrink-0 ${
            canWrite
              ? 'bg-[#E2725B] hover:bg-[#D46049] text-white shadow-md shadow-[#E2725B]/20'
              : 'bg-[#8C8273]/20 hover:bg-[#8C8273]/30 text-[#6B5E55] border border-[#E5E1D8]'
          }`}
          title={canWrite ? 'Neuen Tagebucheintrag erstellen' : 'Nur Lese-Rechte: Du kannst Stopps und Fotos in dieser Reise nur ansehen'}
        >
          {canWrite ? <Plus className="w-4 h-4" /> : <Eye className="w-4 h-4 text-[#8C8273]" />}
          <span className="hidden sm:inline">{canWrite ? 'Erinnerung' : 'Nur Lesen'}</span>
        </button>
      </div>
    </header>
  );
};

