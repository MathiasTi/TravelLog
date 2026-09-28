import React, { useState, useRef, useEffect } from 'react';
import { Trip, JournalEntry } from '../../types';
import {
  X,
  Database,
  Download,
  Upload,
  FolderArchive,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Info,
  Layers,
  MapPin,
  Camera,
  Calendar,
  Sparkles,
  RefreshCw,
  FileCheck,
  ShieldCheck,
  ArrowRight,
  HardDrive,
  CloudUpload,
  RotateCcw,
} from 'lucide-react';
import {
  exportJsonBackup,
  exportZipBackupArchive,
  parseAndValidateBackupFile,
  executeRestore,
  getLatestSafetySnapshot,
  rollbackSafetySnapshot,
  BackupPayload,
  BackupSummary,
  RestoreMode,
  SafetySnapshot,
} from '../../services/backupService';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  trips: Trip[];
  entries: JournalEntry[];
  activeTrip: Trip | null;
  currentUserName?: string;
  onRestoreSuccess: (trips: Trip[], entries: JournalEntry[], message: string) => void;
  onShowToast: (message: string, type: 'success' | 'info' | 'error') => void;
  defaultTab?: 'backup' | 'restore';
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  trips,
  entries,
  activeTrip,
  currentUserName,
  onRestoreSuccess,
  onShowToast,
  defaultTab = 'backup',
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore'>(defaultTab);

  // Backup state
  const [backupScope, setBackupScope] = useState<'all' | 'active'>('all');
  const [backupFormat, setBackupFormat] = useState<'json' | 'zip'>('json');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');

  // Restore state
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [backupData, setBackupData] = useState<BackupPayload | null>(null);
  const [backupSummary, setBackupSummary] = useState<BackupSummary | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('merge');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreStatus, setRestoreStatus] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [safetySnapshot, setSafetySnapshot] = useState<SafetySnapshot | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      getLatestSafetySnapshot().then(setSafetySnapshot).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const targetTrips = backupScope === 'active' && activeTrip ? [activeTrip] : trips;
  const targetTripIds = new Set(targetTrips.map((t) => t.id));
  const targetEntries = entries.filter((e) => targetTripIds.has(e.tripId));
  const totalPhotos = targetEntries.reduce(
    (acc, e) => acc + (e.media?.filter((m) => m.type === 'photo').length || 0),
    0
  );
  const totalTracks = targetEntries.reduce((acc, e) => acc + (e.track ? 1 : 0), 0);

  // Trigger Backup Download
  const handleStartBackup = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportProgress(10);
    setExportStatus('Bereite Daten vor...');

    try {
      if (backupFormat === 'json') {
        setExportProgress(50);
        setExportStatus('Generiere JSON-Sicherungsdatei...');
        const result = exportJsonBackup(trips, entries, {
          targetTripId: backupScope === 'active' && activeTrip ? activeTrip.id : undefined,
          userName: currentUserName,
        });
        setExportProgress(100);
        setExportStatus('Download gestartet!');
        onShowToast(`Sicherung „${result.filename}“ erfolgreich heruntergeladen! 💾`, 'success');
        setTimeout(() => {
          setIsExporting(false);
          setExportProgress(0);
          setExportStatus('');
        }, 1500);
      } else {
        // ZIP Complete Archive
        await exportZipBackupArchive(trips, entries, {
          targetTripId: backupScope === 'active' && activeTrip ? activeTrip.id : undefined,
          userName: currentUserName,
          onProgress: (pct, msg) => {
            setExportProgress(pct);
            setExportStatus(msg);
          },
        });
        onShowToast('Sicherungs-Archiv (ZIP) erfolgreich heruntergeladen! 📦', 'success');
        setTimeout(() => {
          setIsExporting(false);
          setExportProgress(0);
          setExportStatus('');
        }, 1500);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unbekannt';
      console.error('Backup error:', err);
      onShowToast(`Fehler beim Erstellen der Sicherung: ${message}`, 'error');
      setIsExporting(false);
    }
  };

  // Handle file selection / drop for restore
  const handleProcessFile = async (file: File) => {
    setSelectedFile(file);
    setIsAnalyzing(true);
    setValidationError(null);
    setBackupData(null);
    setBackupSummary(null);

    const result = await parseAndValidateBackupFile(file);
    setIsAnalyzing(false);

    if (!result.valid || !result.data || !result.summary) {
      setValidationError(result.error || 'Ungültige Sicherungsdatei.');
    } else {
      setBackupData(result.data);
      setBackupSummary(result.summary);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
    }
  };

  // Trigger Restore Execution
  const handleStartRestore = async () => {
    if (!backupData || isRestoring) return;

    if (restoreMode === 'replace' && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }

    setIsRestoring(true);
    setRestoreProgress(10);
    setRestoreStatus('Starte Wiederherstellung...');

    try {
      const result = await executeRestore(backupData, restoreMode, {
        onProgress: (pct, msg) => {
          setRestoreProgress(pct);
          setRestoreStatus(msg);
        },
      });

      if (result.success) {
        onRestoreSuccess(backupData.trips, backupData.entries, result.message);
        onShowToast(result.message, 'success');
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        onShowToast(result.message, 'error');
        setIsRestoring(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unbekannt';
      onShowToast(`Wiederherstellung fehlgeschlagen: ${message}`, 'error');
      setIsRestoring(false);
    }
  };

  const handleRollback = async () => {
    if (!safetySnapshot || isRollingBack) return;
    setIsRollingBack(true);
    try {
      const res = await rollbackSafetySnapshot();
      if (res.success) {
        onShowToast(`Vorheriger Zustand (${res.tripsCount} Reisen) erfolgreich wiederhergestellt! 🔄`, 'success');
        onRestoreSuccess(res.trips || [], res.entries || [], res.message);
        setSafetySnapshot(null);
      } else {
        onShowToast(res.message, 'error');
      }
    } catch {
      onShowToast('Fehler beim Rollback des Sicherheits-Snapshots.', 'error');
    } finally {
      setIsRollingBack(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-[#FDFBF7] dark:bg-[#1E1B18] border border-[#E5E1D8] dark:border-[#38322C] rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-labelledby="backup-modal-title"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E5E1D8] dark:border-[#38322C] flex items-center justify-between bg-white dark:bg-[#25211D] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#8A9A5B]/15 text-[#8A9A5B] flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 id="backup-modal-title" className="text-base sm:text-lg font-serif font-bold text-[#4E3B31] dark:text-[#EDE8DF]">
                Sicherung & Wiederherstellung
              </h2>
              <p className="text-xs text-[#8C8273] dark:text-[#A89F91]">
                Lokale Backups erstellen, auf Festplatte sichern & jederzeit wiederherstellen
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#8C8273] hover:text-[#4E3B31] hover:bg-[#F1EDE6] dark:hover:bg-[#342F2A] transition"
            aria-label="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-6 pt-3 pb-1 border-b border-[#E5E1D8] dark:border-[#38322C] bg-[#F8F5EE] dark:bg-[#221E1A] flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'backup'
                ? 'bg-white dark:bg-[#2E2924] text-[#8A9A5B] shadow-sm border border-[#E5E1D8] dark:border-[#3D3630]'
                : 'text-[#6B5E55] dark:text-[#A89F91] hover:text-[#4E3B31]'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>1. Lokale Sicherung (Backup)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('restore')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'restore'
                ? 'bg-white dark:bg-[#2E2924] text-[#E2725B] shadow-sm border border-[#E5E1D8] dark:border-[#3D3630]'
                : 'text-[#6B5E55] dark:text-[#A89F91] hover:text-[#4E3B31]'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>2. Wiederherstellung (Restore)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: BACKUP */}
          {activeTab === 'backup' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Info explanation */}
              <div className="p-4 rounded-2xl bg-[#8A9A5B]/10 border border-[#8A9A5B]/25 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#8A9A5B] shrink-0 mt-0.5" />
                <div className="text-xs text-[#4E3B31] dark:text-[#EDE8DF] space-y-1">
                  <p className="font-bold">Deine Reisedaten sicher auf deiner Festplatte</p>
                  <p className="text-[#6B5E55] dark:text-[#A89F91] leading-relaxed">
                    Sichere all deine Reisetagebücher, Fotos, GPS-Tracks, Koordinaten und Notizen als lokale Datei.
                    Vor jedem Applet-Republish oder Browserwechsel kannst du hier mit 1 Klick ein Backup speichern.
                  </p>
                </div>
              </div>

              {/* Scope Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF] block uppercase tracking-wider">
                  Umfang der Sicherung
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBackupScope('all')}
                    className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition cursor-pointer ${
                      backupScope === 'all'
                        ? 'border-[#8A9A5B] bg-[#8A9A5B]/10 ring-2 ring-[#8A9A5B]/20'
                        : 'border-[#E5E1D8] dark:border-[#38322C] bg-white dark:bg-[#25211D] hover:bg-[#F8F5EE] dark:hover:bg-[#2E2924]'
                    }`}
                  >
                    <Layers className={`w-5 h-5 shrink-0 mt-0.5 ${backupScope === 'all' ? 'text-[#8A9A5B]' : 'text-[#8C8273]'}`} />
                    <div>
                      <div className="text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF]">
                        Alle Reisen ({trips.length})
                      </div>
                      <div className="text-[11px] text-[#8C8273] dark:text-[#A89F91]">
                        Komplette Reisedatenbank mit allen Stopps und Medien
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBackupScope('active')}
                    disabled={!activeTrip}
                    className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition cursor-pointer ${
                      !activeTrip
                        ? 'opacity-50 cursor-not-allowed border-[#E5E1D8] bg-gray-50'
                        : backupScope === 'active'
                        ? 'border-[#8A9A5B] bg-[#8A9A5B]/10 ring-2 ring-[#8A9A5B]/20'
                        : 'border-[#E5E1D8] dark:border-[#38322C] bg-white dark:bg-[#25211D] hover:bg-[#F8F5EE] dark:hover:bg-[#2E2924]'
                    }`}
                  >
                    <MapPin className={`w-5 h-5 shrink-0 mt-0.5 ${backupScope === 'active' ? 'text-[#8A9A5B]' : 'text-[#8C8273]'}`} />
                    <div className="truncate">
                      <div className="text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF] truncate">
                        Nur „{activeTrip?.title || 'Aktive Reise'}“
                      </div>
                      <div className="text-[11px] text-[#8C8273] dark:text-[#A89F91]">
                        Nur diese ausgewählte Reise mit ihren Stopps
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Format Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF] block uppercase tracking-wider">
                  Sicherungs-Format
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBackupFormat('json')}
                    className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition cursor-pointer ${
                      backupFormat === 'json'
                        ? 'border-[#8A9A5B] bg-[#8A9A5B]/10 ring-2 ring-[#8A9A5B]/20'
                        : 'border-[#E5E1D8] dark:border-[#38322C] bg-white dark:bg-[#25211D] hover:bg-[#F8F5EE] dark:hover:bg-[#2E2924]'
                    }`}
                  >
                    <FileJson className={`w-6 h-6 shrink-0 ${backupFormat === 'json' ? 'text-[#8A9A5B]' : 'text-[#8C8273]'}`} />
                    <div>
                      <div className="text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF] flex items-center gap-1.5">
                        <span>JSON-Sicherungsdatei (.json)</span>
                        <span className="px-1.5 py-0.2 bg-[#8A9A5B] text-white text-[9px] font-bold rounded-md uppercase">
                          Empfohlen
                        </span>
                      </div>
                      <div className="text-[11px] text-[#8C8273] dark:text-[#A89F91] mt-0.5">
                        Kompakte Datenbank-Datei, blitzschnell generiert und 100% wiederherstellbar.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBackupFormat('zip')}
                    className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition cursor-pointer ${
                      backupFormat === 'zip'
                        ? 'border-[#8A9A5B] bg-[#8A9A5B]/10 ring-2 ring-[#8A9A5B]/20'
                        : 'border-[#E5E1D8] dark:border-[#38322C] bg-white dark:bg-[#25211D] hover:bg-[#F8F5EE] dark:hover:bg-[#2E2924]'
                    }`}
                  >
                    <FolderArchive className={`w-6 h-6 shrink-0 ${backupFormat === 'zip' ? 'text-[#8A9A5B]' : 'text-[#8C8273]'}`} />
                    <div>
                      <div className="text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF]">
                        Komplettes ZIP-Archiv (.zip)
                      </div>
                      <div className="text-[11px] text-[#8C8273] dark:text-[#A89F91] mt-0.5">
                        Inklusive Original-Bilddateien in Ordnern, GPS-Tracks (.GPX) und Backup-Manifest.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Statistics Preview Card */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#25211D] border border-[#E5E1D8] dark:border-[#38322C] flex items-center justify-around text-center">
                <div>
                  <div className="text-base font-bold text-[#4E3B31] dark:text-[#EDE8DF] font-mono">
                    {targetTrips.length}
                  </div>
                  <div className="text-[11px] text-[#8C8273] dark:text-[#A89F91]">Reisen</div>
                </div>
                <div className="h-8 w-px bg-[#E5E1D8] dark:bg-[#38322C]" />
                <div>
                  <div className="text-base font-bold text-[#4E3B31] dark:text-[#EDE8DF] font-mono">
                    {targetEntries.length}
                  </div>
                  <div className="text-[11px] text-[#8C8273] dark:text-[#A89F91]">Stopps & Notizen</div>
                </div>
                <div className="h-8 w-px bg-[#E5E1D8] dark:bg-[#38322C]" />
                <div>
                  <div className="text-base font-bold text-[#4E3B31] dark:text-[#EDE8DF] font-mono">
                    {totalPhotos}
                  </div>
                  <div className="text-[11px] text-[#8C8273] dark:text-[#A89F91]">Fotos</div>
                </div>
                <div className="h-8 w-px bg-[#E5E1D8] dark:bg-[#38322C]" />
                <div>
                  <div className="text-base font-bold text-[#4E3B31] dark:text-[#EDE8DF] font-mono">
                    {totalTracks}
                  </div>
                  <div className="text-[11px] text-[#8C8273] dark:text-[#A89F91]">GPS-Tracks</div>
                </div>
              </div>

              {/* Progress status */}
              {isExporting && (
                <div className="p-4 rounded-2xl bg-[#8A9A5B]/10 border border-[#8A9A5B]/30 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-[#8A9A5B]">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {exportStatus}
                    </span>
                    <span>{exportProgress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#E5E1D8] dark:bg-[#38322C] overflow-hidden">
                    <div
                      className="h-full bg-[#8A9A5B] transition-all duration-300 rounded-full"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={handleStartBackup}
                disabled={isExporting || targetTrips.length === 0}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#8A9A5B] hover:bg-[#78874E] text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Erstelle Sicherung...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Jetzt Sicherungsdatei herunterladen</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: RESTORE */}
          {activeTab === 'restore' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Info explanation */}
              <div className="p-4 rounded-2xl bg-[#E2725B]/10 border border-[#E2725B]/25 flex items-start gap-3">
                <Upload className="w-5 h-5 text-[#E2725B] shrink-0 mt-0.5" />
                <div className="text-xs text-[#4E3B31] dark:text-[#EDE8DF] space-y-1">
                  <p className="font-bold">Reisedaten aus einer Sicherung wiederherstellen</p>
                  <p className="text-[#6B5E55] dark:text-[#A89F91] leading-relaxed">
                    Lade eine zuvor erstellte <code className="font-mono bg-white/60 dark:bg-black/40 px-1 py-0.5 rounded">.json</code>-Datei oder ein <code className="font-mono bg-white/60 dark:bg-black/40 px-1 py-0.5 rounded">.zip</code>-Sicherungsarchiv hoch.
                    Die Reisen, Fotos und Stopps werden sofort wieder in die Karte, Chronik und Cloud geladen.
                  </p>
                </div>
              </div>

              {/* Transactional Safety Snapshot Banner */}
              {safetySnapshot && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
                  <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold block">Sicherheits-Snapshot verfügbar</span>
                      <span className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                        Stand vor letzter Wiederherstellung ({new Date(safetySnapshot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, {safetySnapshot.trips.length} Reisen, {safetySnapshot.entries.length} Stopps)
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRollback}
                    disabled={isRollingBack}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm shrink-0 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    {isRollingBack ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    <span>Rückgängig (Rollback)</span>
                  </button>
                </div>
              )}

              {/* File Dropzone */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                accept=".json,.zip,application/json,application/zip,application/x-zip-compressed"
                className="hidden"
              />

              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 border-2 border-dashed rounded-3xl text-center cursor-pointer transition flex flex-col items-center justify-center gap-2.5 ${
                  dragActive
                    ? 'border-[#8A9A5B] bg-[#8A9A5B]/10 scale-[1.01]'
                    : selectedFile
                    ? 'border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : 'border-[#E5E1D8] dark:border-[#38322C] bg-white dark:bg-[#25211D] hover:bg-[#F8F5EE] dark:hover:bg-[#2E2924]'
                }`}
              >
                {isAnalyzing ? (
                  <div className="py-4 space-y-2 flex flex-col items-center">
                    <Loader2 className="w-8 h-8 text-[#8A9A5B] animate-spin" />
                    <span className="text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF]">
                      Prüfe und analysiere Sicherungsdatei...
                    </span>
                  </div>
                ) : selectedFile && backupSummary ? (
                  <div className="py-2 space-y-1 flex flex-col items-center">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center">
                      <FileCheck className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF]">
                      {selectedFile.name}
                    </span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Gültiges Backup ({Math.round(selectedFile.size / 1024)} KB) • Klicken zum Ändern
                    </span>
                  </div>
                ) : (
                  <div className="py-2 space-y-2 flex flex-col items-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#E2725B]/10 text-[#E2725B] flex items-center justify-center">
                      <CloudUpload className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF] block">
                        Backup-Datei (.json oder .zip) hier hineinziehen oder klicken
                      </span>
                      <span className="text-[11px] text-[#8C8273] dark:text-[#A89F91]">
                        Unterstützt: .json und .zip Sicherungsarchive mit Fotos & GPS-Tracks
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Validation Error Banner */}
              {validationError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Backup Content Preview */}
              {backupSummary && (
                <div className="space-y-3.5 animate-in fade-in duration-200">
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#25211D] border border-[#E5E1D8] dark:border-[#38322C] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF] uppercase tracking-wider">
                        Inhalt der Sicherung
                      </span>
                      <div className="flex items-center gap-2">
                        {backupSummary.checksum && (
                          <span
                            className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-mono text-[9px] font-bold"
                            title={`SHA-256: ${backupSummary.checksum}`}
                          >
                            SHA-256 verifiziert
                          </span>
                        )}
                        <span className="text-[10px] text-[#8C8273] font-mono">
                          Erstellt: {new Date(backupSummary.exportedAt).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-[#E5E1D8] dark:border-[#38322C]">
                      <div className="p-2 rounded-xl bg-[#F8F5EE] dark:bg-[#1E1B18]">
                        <div className="text-sm font-bold text-[#4E3B31] dark:text-[#EDE8DF] font-mono">
                          {backupSummary.tripsCount}
                        </div>
                        <div className="text-[10px] text-[#8C8273]">Reisen</div>
                      </div>
                      <div className="p-2 rounded-xl bg-[#F8F5EE] dark:bg-[#1E1B18]">
                        <div className="text-sm font-bold text-[#4E3B31] dark:text-[#EDE8DF] font-mono">
                          {backupSummary.entriesCount}
                        </div>
                        <div className="text-[10px] text-[#8C8273]">Stopps & Notizen</div>
                      </div>
                      <div className="p-2 rounded-xl bg-[#F8F5EE] dark:bg-[#1E1B18]">
                        <div className="text-sm font-bold text-[#4E3B31] dark:text-[#EDE8DF] font-mono">
                          {backupSummary.mediaCount}
                        </div>
                        <div className="text-[10px] text-[#8C8273]">Medien</div>
                      </div>
                    </div>

                    {/* Trips list in backup */}
                    <div className="space-y-1.5 pt-1 max-h-36 overflow-y-auto">
                      {backupSummary.trips.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-[#FDFBF7] dark:bg-[#1E1B18] text-xs border border-[#E5E1D8]/60 dark:border-[#38322C]"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-2 h-2 rounded-full bg-[#8A9A5B]" />
                            <span className="font-bold text-[#4E3B31] dark:text-[#EDE8DF] truncate">
                              {t.title}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#8C8273] shrink-0 font-mono">
                            {t.entriesCount} Stopps • {t.dateRange}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Restore Mode Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF] block uppercase tracking-wider">
                      Wiederherstellungs-Modus
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setRestoreMode('merge');
                          setConfirmReplace(false);
                        }}
                        className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition cursor-pointer ${
                          restoreMode === 'merge'
                            ? 'border-[#8A9A5B] bg-[#8A9A5B]/10 ring-2 ring-[#8A9A5B]/20'
                            : 'border-[#E5E1D8] dark:border-[#38322C] bg-white dark:bg-[#25211D]'
                        }`}
                      >
                        <ShieldCheck className={`w-5 h-5 shrink-0 mt-0.5 ${restoreMode === 'merge' ? 'text-[#8A9A5B]' : 'text-[#8C8273]'}`} />
                        <div>
                          <div className="text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF] flex items-center gap-1">
                            <span>Zusammenführen (Merge)</span>
                            <span className="px-1.5 py-0.2 bg-[#8A9A5B] text-white text-[9px] font-bold rounded">
                              Sicher
                            </span>
                          </div>
                          <div className="text-[11px] text-[#8C8273] dark:text-[#A89F91] mt-0.5">
                            Fügt die gesicherten Daten hinzu. Bestehende Reisen bleiben erhalten.
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRestoreMode('replace');
                          setConfirmReplace(false);
                        }}
                        className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition cursor-pointer ${
                          restoreMode === 'replace'
                            ? 'border-[#E2725B] bg-[#E2725B]/10 ring-2 ring-[#E2725B]/20'
                            : 'border-[#E5E1D8] dark:border-[#38322C] bg-white dark:bg-[#25211D]'
                        }`}
                      >
                        <RefreshCw className={`w-5 h-5 shrink-0 mt-0.5 ${restoreMode === 'replace' ? 'text-[#E2725B]' : 'text-[#8C8273]'}`} />
                        <div>
                          <div className="text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF]">
                            Vollständig Ersetzen
                          </div>
                          <div className="text-[11px] text-[#8C8273] dark:text-[#A89F91] mt-0.5">
                            Setzt die gesamte Datenbank exakt auf den Stand des Backups zurück.
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Replace Confirmation Warning */}
                  {restoreMode === 'replace' && confirmReplace && (
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1.5 animate-in fade-in duration-150">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Sicherheitsabfrage: Daten überschreiben?</span>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Alle aktuell im Browser und in der Cloud vorhandenen Reisen werden durch die {backupSummary.tripsCount} Reisen aus der Sicherungsdatei ersetzt.
                      </p>
                    </div>
                  )}

                  {/* Restore Progress bar */}
                  {isRestoring && (
                    <div className="p-4 rounded-2xl bg-[#E2725B]/10 border border-[#E2725B]/30 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-[#E2725B]">
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          {restoreStatus}
                        </span>
                        <span>{restoreProgress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#E5E1D8] dark:bg-[#38322C] overflow-hidden">
                        <div
                          className="h-full bg-[#E2725B] transition-all duration-300 rounded-full"
                          style={{ width: `${restoreProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Restore Submit Button */}
                  <button
                    type="button"
                    onClick={handleStartRestore}
                    disabled={isRestoring}
                    className={`w-full py-3.5 px-4 rounded-2xl text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${
                      restoreMode === 'replace'
                        ? confirmReplace
                          ? 'bg-rose-600 hover:bg-rose-700'
                          : 'bg-[#E2725B] hover:bg-[#D46049]'
                        : 'bg-[#8A9A5B] hover:bg-[#78874E]'
                    }`}
                  >
                    {isRestoring ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Stelle Daten wieder her...</span>
                      </>
                    ) : restoreMode === 'replace' && confirmReplace ? (
                      <>
                        <AlertTriangle className="w-4 h-4" />
                        <span>Ja, jetzt vollständig überschreiben & wiederherstellen</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Wiederherstellung jetzt starten ({backupSummary.tripsCount} Reisen)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#E5E1D8] dark:border-[#38322C] bg-[#F8F5EE] dark:bg-[#221E1A] flex items-center justify-between text-xs text-[#8C8273] shrink-0">
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-[#8A9A5B]" />
            <span>Lokaler Browser- & Cloud-Sync aktiv</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#2E2924] border border-[#E5E1D8] dark:border-[#3D3630] font-bold text-[#4E3B31] dark:text-[#EDE8DF] hover:bg-[#F1EDE6] transition"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
