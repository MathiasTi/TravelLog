import React, { useState } from 'react';
import { Trip, JournalEntry } from '../../types';
import {
  X,
  BookOpen,
  FileDown,
  Download,
  FolderArchive,
  Layers,
  Sparkles,
  MapPin,
  Camera,
  CloudSun,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  Loader2,
  Info,
  ExternalLink,
  Sliders,
  Globe,
  FileType,
  Share2,
  Database,
} from 'lucide-react';
import {
  generatePhotobookPdf,
  PhotobookFormat,
  PhotobookTheme,
  PhotobookOptions,
} from '../../services/photobookPdfService';
import {
  exportTripMediaZip,
  MediaFolderStructure,
  MediaExportOptions,
  triggerBlobDownload,
  generateTripGeoJson,
  generateExifCsvCatalog,
  generateMarkdownJournal,
  generateStandaloneHtmlBook,
  generateCewePhotobookManifest,
} from '../../services/mediaExportService';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip | null;
  entries: JournalEntry[];
  onShowToast: (message: string, type: 'success' | 'info' | 'error') => void;
  onOpenBackupModal?: (tab?: 'backup' | 'restore') => void;
}

type ActiveTab = 'photobook' | 'photos_zip' | 'standards';

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  trip,
  entries,
  onShowToast,
  onOpenBackupModal,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('photobook');

  // Photobook options
  const [pdfFormat, setPdfFormat] = useState<PhotobookFormat>('a4_landscape');
  const [pdfTheme, setPdfTheme] = useState<PhotobookTheme>('classic');
  const [includeCover, setIncludeCover] = useState<boolean>(true);
  const [includeTableOfContents, setIncludeTableOfContents] = useState<boolean>(true);
  const [includeNotes, setIncludeNotes] = useState<boolean>(true);
  const [includeWeather, setIncludeWeather] = useState<boolean>(true);
  const [includeGpsCoords, setIncludeGpsCoords] = useState<boolean>(true);
  const [includeComments, setIncludeComments] = useState<boolean>(true);
  const [includeBackCover, setIncludeBackCover] = useState<boolean>(true);

  // Media ZIP options
  const [folderStructure, setFolderStructure] = useState<MediaFolderStructure>('by_stop');
  const [includeMetadataJson, setIncludeMetadataJson] = useState<boolean>(true);
  const [includeExifCsv, setIncludeExifCsv] = useState<boolean>(true);
  const [includeGeoJson, setIncludeGeoJson] = useState<boolean>(true);
  const [includeMarkdown, setIncludeMarkdown] = useState<boolean>(true);
  const [includeCeweManifest, setIncludeCeweManifest] = useState<boolean>(true);
  const [includeStandaloneHtmlBook, setIncludeStandaloneHtmlBook] = useState<boolean>(true);

  // Processing state
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [progressStatus, setProgressStatus] = useState<string>('');

  if (!isOpen || !trip) return null;

  const tripEntries = entries.filter((e) => e.tripId === trip.id);
  const totalPhotos = tripEntries.reduce(
    (acc, e) => acc + (e.media?.filter((m) => m.type === 'photo').length || 0),
    0
  );

  // Calculate estimated page count
  let estPages = tripEntries.length;
  if (includeCover) estPages += 1;
  if (includeTableOfContents) estPages += 1;
  if (includeBackCover) estPages += 1;

  // Handle Photobook PDF Generation
  const handleGeneratePdf = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportProgress(5);
    setProgressStatus('Starte Fotobuch-Generierung...');

    try {
      const options: PhotobookOptions = {
        format: pdfFormat,
        theme: pdfTheme,
        includeCover,
        includeTableOfContents,
        includeNotes,
        includeWeather,
        includeGpsCoords,
        includeExifCameraInfo: true,
        includeComments,
        includeBackCover,
        maxPhotosPerStop: 4,
        onProgress: (p, status) => {
          setExportProgress(p);
          setProgressStatus(status);
        },
      };

      const { blob, filename } = await generatePhotobookPdf(trip, entries, options);
      triggerBlobDownload(blob, filename);
      onShowToast(`Fotobuch "${filename}" erfolgreich als druckfertiges PDF exportiert! 📖`, 'success');
    } catch (err) {
      console.error('PDF Generation failed:', err);
      onShowToast('Fehler bei der PDF-Erstellung. Bitte versuche es erneut.', 'error');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setProgressStatus('');
    }
  };

  // Handle ZIP Media Export
  const handleGenerateZip = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportProgress(5);
    setProgressStatus('Starte Medien-Export...');

    try {
      const options: MediaExportOptions = {
        folderStructure,
        includeMetadataJson,
        includeExifCsv,
        includeGeoJson,
        includeMarkdown,
        includeCeweManifest,
        includeStandaloneHtmlBook,
        onProgress: (p, status) => {
          setExportProgress(p);
          setProgressStatus(status);
        },
      };

      const { blob, filename } = await exportTripMediaZip(trip, entries, options);
      triggerBlobDownload(blob, filename);
      onShowToast(`ZIP-Archiv mit ${totalPhotos} Fotos & Metadaten heruntergeladen! 📦`, 'success');
    } catch (err) {
      console.error('ZIP Generation failed:', err);
      onShowToast('Fehler beim Packen des ZIP-Archivs.', 'error');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setProgressStatus('');
    }
  };

  // Direct single-format downloads
  const handleDownloadGeoJson = () => {
    const geoJson = generateTripGeoJson(trip, tripEntries);
    const blob = new Blob([geoJson], { type: 'application/geo+json;charset=utf-8' });
    triggerBlobDownload(blob, `reiseroute_${trip.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.geojson`);
    onShowToast('Standard GeoJSON (RFC 7946) heruntergeladen!', 'success');
  };

  const handleDownloadCsv = () => {
    const csv = generateExifCsvCatalog(trip, tripEntries);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    triggerBlobDownload(blob, `exif_katalog_${trip.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.csv`);
    onShowToast('EXIF & Stopp-Katalog (CSV) für Excel/Lightroom heruntergeladen!', 'success');
  };

  const handleDownloadMarkdown = () => {
    const md = generateMarkdownJournal(trip, tripEntries);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    triggerBlobDownload(blob, `reisetagebuch_${trip.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.md`);
    onShowToast('Reisebericht (Markdown) für Obsidian/Notion heruntergeladen!', 'success');
  };

  const handleDownloadHtmlBook = () => {
    const html = generateStandaloneHtmlBook(trip, tripEntries);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    triggerBlobDownload(blob, `web_fotobuch_${trip.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.html`);
    onShowToast('Interaktives Offline Web-Fotobuch (HTML5) heruntergeladen!', 'success');
  };

  const handleDownloadCeweManifest = () => {
    const manifest = generateCewePhotobookManifest(trip, tripEntries);
    const blob = new Blob([manifest], { type: 'application/json;charset=utf-8' });
    triggerBlobDownload(blob, `cewe_saal_manifest_${trip.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`);
    onShowToast('CEWE / Saal Digital Druckvorlagen-Manifest heruntergeladen!', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#4E3B31]/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#FDFBF7] dark:bg-[#1E1B18] border border-[#E5E1D8] dark:border-[#38322C] rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E1D8] dark:border-[#38322C] bg-[#F1EDE6]/80 dark:bg-[#28231F]/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#E2725B]/15 border border-[#E2725B]/30 text-[#E2725B] shadow-xs">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#4E3B31] dark:text-[#EDE8DF] font-serif flex items-center gap-2">
                <span>Fotobuch & Medien-Export</span>
                <span className="text-[10px] uppercase font-sans font-bold px-2 py-0.5 rounded-full bg-[#8A9A5B]/20 text-[#8A9A5B] dark:text-[#A7B97B]">
                  Druckstandards
                </span>
              </h3>
              <p className="text-xs text-[#6B5E55] dark:text-[#A89F91]">
                Reise „{trip.title}“ • {tripEntries.length} Stationen • {totalPhotos} Fotos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="p-2 rounded-xl text-[#6B5E55] hover:text-[#4E3B31] hover:bg-[#E5E1D8] dark:hover:bg-[#342F2A] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 bg-[#FAF8F5] dark:bg-[#221E1B] border-b border-[#E5E1D8] dark:border-[#38322C] text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('photobook')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'photobook'
                ? 'bg-[#8A9A5B] text-white shadow-sm font-bold'
                : 'text-[#6B5E55] dark:text-[#A89F91] hover:bg-[#E5E1D8] dark:hover:bg-[#2C2723]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Automatisches Fotobuch (PDF)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('photos_zip')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'photos_zip'
                ? 'bg-[#8A9A5B] text-white shadow-sm font-bold'
                : 'text-[#6B5E55] dark:text-[#A89F91] hover:bg-[#E5E1D8] dark:hover:bg-[#2C2723]'
            }`}
          >
            <FolderArchive className="w-4 h-4" />
            <span>Bilder-Archiv (ZIP)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('standards')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'standards'
                ? 'bg-[#8A9A5B] text-white shadow-sm font-bold'
                : 'text-[#6B5E55] dark:text-[#A89F91] hover:bg-[#E5E1D8] dark:hover:bg-[#2C2723]'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Standards & Formate</span>
          </button>

          {onOpenBackupModal && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenBackupModal('backup');
              }}
              className="ml-auto hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#28231F] border border-[#8A9A5B]/40 text-xs font-bold text-[#63723E] dark:text-[#A8BA76] hover:bg-[#8A9A5B]/10 transition cursor-pointer"
              title="Komplette Reisedatenbank als .json auf Festplatte sichern oder wiederherstellen"
            >
              <Database className="w-3.5 h-3.5 text-[#8A9A5B]" />
              <span>💾 Backup & Wiederherstellung</span>
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* ------------------------------------------- */}
          {/* TAB 1: AUTOMATISCHES FOTOBUCH (PDF) */}
          {/* ------------------------------------------- */}
          {activeTab === 'photobook' && (
            <div className="space-y-6">
              {/* Format selection */}
              <div>
                <label className="text-xs font-bold text-[#8C8273] dark:text-[#A89F91] uppercase tracking-wider block mb-2">
                  1. Fotobuch-Format (Druck-Standard)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setPdfFormat('a4_landscape')}
                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      pdfFormat === 'a4_landscape'
                        ? 'border-[#8A9A5B] bg-[#8A9A5B]/10 shadow-sm ring-2 ring-[#8A9A5B]/30'
                        : 'border-[#E5E1D8] dark:border-[#38322C] bg-white dark:bg-[#28231F] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs text-[#4E3B31] dark:text-[#EDE8DF]">A4 Querformat</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#8A9A5B] text-white font-mono">Empfohlen</span>
                    </div>
                    <p className="text-[11px] text-[#6B5E55] dark:text-[#A89F91]">
                      297 × 210 mm • Ideal für Reise-Panoramen & 2-Spalten-Layouts.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPdfFormat('square_210')}
                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      pdfFormat === 'square_210'
                        ? 'border-[#8A9A5B] bg-[#8A9A5B]/10 shadow-sm ring-2 ring-[#8A9A5B]/30'
                        : 'border-[#E5E1D8] dark:border-[#38322C] bg-white dark:bg-[#28231F] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs text-[#4E3B31] dark:text-[#EDE8DF]">Quadratisch</span>
                      <span className="text-[10px] text-[#8C8273] dark:text-[#A89F91]">CEWE / Saal</span>
                    </div>
                    <p className="text-[11px] text-[#6B5E55] dark:text-[#A89F91]">
                      210 × 210 mm (8×8") • Moderner Hardcover-Fotobuch-Standard.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPdfFormat('a4_portrait')}
                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      pdfFormat === 'a4_portrait'
                        ? 'border-[#8A9A5B] bg-[#8A9A5B]/10 shadow-sm ring-2 ring-[#8A9A5B]/30'
                        : 'border-[#E5E1D8] dark:border-[#38322C] bg-white dark:bg-[#28231F] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs text-[#4E3B31] dark:text-[#EDE8DF]">A4 Hochformat</span>
                    </div>
                    <p className="text-[11px] text-[#6B5E55] dark:text-[#A89F91]">
                      210 × 297 mm • Klassisches Reisejournal- & Magazin-Format.
                    </p>
                  </button>
                </div>
              </div>

              {/* Theme selection */}
              <div>
                <label className="text-xs font-bold text-[#8C8273] dark:text-[#A89F91] uppercase tracking-wider block mb-2">
                  2. Design-Thema & Farbwelt
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'classic', label: 'WanderLog Klassik', desc: 'Warmes Beige & Terrakotta', sample: '#8A9A5B' },
                    { id: 'modern', label: 'Modern Slate', desc: 'Klares Schiefergrau & Azur', sample: '#0EA5E9' },
                    { id: 'vintage', label: 'Vintage Sepia', desc: 'Parchment & Kupfer', sample: '#B87333' },
                    { id: 'minimal', label: 'Minimal Monochrome', desc: 'Reines Schwarz & Weiß', sample: '#1E293B' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPdfTheme(t.id as PhotobookTheme)}
                      className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                        pdfTheme === t.id
                          ? 'border-[#8A9A5B] bg-[#8A9A5B]/10 ring-2 ring-[#8A9A5B]/30 font-bold'
                          : 'border-[#E5E1D8] dark:border-[#38322C] bg-white dark:bg-[#28231F]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.sample }} />
                        <span className="text-xs text-[#4E3B31] dark:text-[#EDE8DF]">{t.label}</span>
                      </div>
                      <p className="text-[10px] text-[#6B5E55] dark:text-[#A89F91]">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout Content Toggles */}
              <div>
                <label className="text-xs font-bold text-[#8C8273] dark:text-[#A89F91] uppercase tracking-wider block mb-2">
                  3. Inhalte & Seitenstruktur
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white dark:bg-[#28231F] p-4 rounded-2xl border border-[#E5E1D8] dark:border-[#38322C]">
                  <label className="flex items-center gap-2.5 text-xs text-[#4E3B31] dark:text-[#EDE8DF] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeCover}
                      onChange={(e) => setIncludeCover(e.target.checked)}
                      className="rounded accent-[#8A9A5B] w-4 h-4 cursor-pointer"
                    />
                    <span>Titelseite (Cover mit Hero-Bild & Datum)</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-[#4E3B31] dark:text-[#EDE8DF] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeTableOfContents}
                      onChange={(e) => setIncludeTableOfContents(e.target.checked)}
                      className="rounded accent-[#8A9A5B] w-4 h-4 cursor-pointer"
                    />
                    <span>Reiserouten-Übersicht & Inhaltsverzeichnis</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-[#4E3B31] dark:text-[#EDE8DF] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeNotes}
                      onChange={(e) => setIncludeNotes(e.target.checked)}
                      className="rounded accent-[#8A9A5B] w-4 h-4 cursor-pointer"
                    />
                    <span>Reiseberichte & Tagebuch-Notizen</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-[#4E3B31] dark:text-[#EDE8DF] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeWeather}
                      onChange={(e) => setIncludeWeather(e.target.checked)}
                      className="rounded accent-[#8A9A5B] w-4 h-4 cursor-pointer"
                    />
                    <span>Wetter- und Temperatur-Badges</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-[#4E3B31] dark:text-[#EDE8DF] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeGpsCoords}
                      onChange={(e) => setIncludeGpsCoords(e.target.checked)}
                      className="rounded accent-[#8A9A5B] w-4 h-4 cursor-pointer"
                    />
                    <span>GPS-Koordinaten & Adressangaben</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-[#4E3B31] dark:text-[#EDE8DF] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeComments}
                      onChange={(e) => setIncludeComments(e.target.checked)}
                      className="rounded accent-[#8A9A5B] w-4 h-4 cursor-pointer"
                    />
                    <span>Kommentare & Zitate von Mitreisenden</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-[#4E3B31] dark:text-[#EDE8DF] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeBackCover}
                      onChange={(e) => setIncludeBackCover(e.target.checked)}
                      className="rounded accent-[#8A9A5B] w-4 h-4 cursor-pointer"
                    />
                    <span>Abschlussseite (Rückseite / Zitat)</span>
                  </label>
                </div>
              </div>

              {/* Summary Banner */}
              <div className="p-4 rounded-2xl bg-[#8A9A5B]/10 border border-[#8A9A5B]/25 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-[#8A9A5B]" />
                  <div>
                    <div className="text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF]">
                      Geschätzter Umfang: ca. {estPages} Seiten
                    </div>
                    <div className="text-[11px] text-[#6B5E55] dark:text-[#A89F91]">
                      Hochwertige Vektor-Typografie & 300 DPI Bildaufbereitung
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGeneratePdf}
                  disabled={isExporting || tripEntries.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-[#8A9A5B] hover:bg-[#7D8C68] disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-[#8A9A5B]/20 transition cursor-pointer"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Erstelle PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Fotobuch herunterladen (PDF)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------- */}
          {/* TAB 2: BILDER & MEDIEN (ZIP) */}
          {/* ------------------------------------------- */}
          {activeTab === 'photos_zip' && (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-[#8C8273] dark:text-[#A89F91] uppercase tracking-wider block mb-2">
                  1. Ordner- und Namensstruktur im ZIP-Archiv
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setFolderStructure('by_stop')}
                    className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                      folderStructure === 'by_stop'
                        ? 'border-[#8A9A5B] bg-[#8A9A5B]/10 ring-2 ring-[#8A9A5B]/30'
                        : 'border-[#E5E1D8] dark:border-[#38322C] bg-white dark:bg-[#28231F]'
                    }`}
                  >
                    <div className="font-bold text-xs text-[#4E3B31] dark:text-[#EDE8DF] mb-1">
                      📁 Nach Reise-Stopps
                    </div>
                    <div className="text-[10px] text-[#6B5E55] dark:text-[#A89F91] font-mono">
                      Fotos/01_Neuschwanstein/01_Burg.jpg
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFolderStructure('by_date')}
                    className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                      folderStructure === 'by_date'
                        ? 'border-[#8A9A5B] bg-[#8A9A5B]/10 ring-2 ring-[#8A9A5B]/30'
                        : 'border-[#E5E1D8] dark:border-[#38322C] bg-white dark:bg-[#28231F]'
                    }`}
                  >
                    <div className="font-bold text-xs text-[#4E3B31] dark:text-[#EDE8DF] mb-1">
                      📅 Nach Reisetag
                    </div>
                    <div className="text-[10px] text-[#6B5E55] dark:text-[#A89F91] font-mono">
                      Fotos/2024-08-15/01_Foto.jpg
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFolderStructure('flat')}
                    className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                      folderStructure === 'flat'
                        ? 'border-[#8A9A5B] bg-[#8A9A5B]/10 ring-2 ring-[#8A9A5B]/30'
                        : 'border-[#E5E1D8] dark:border-[#38322C] bg-white dark:bg-[#28231F]'
                    }`}
                  >
                    <div className="font-bold text-xs text-[#4E3B31] dark:text-[#EDE8DF] mb-1">
                      📄 Flache Liste (Chronologisch)
                    </div>
                    <div className="text-[10px] text-[#6B5E55] dark:text-[#A89F91] font-mono">
                      Fotos/01_2024-08-15_Stopp_01.jpg
                    </div>
                  </button>
                </div>
              </div>

              {/* Auxiliary Files & Standards included in ZIP */}
              <div>
                <label className="text-xs font-bold text-[#8C8273] dark:text-[#A89F91] uppercase tracking-wider block mb-2">
                  2. Zusätzliche Standard- & Katalogdateien beilegen
                </label>
                <div className="space-y-2.5 bg-white dark:bg-[#28231F] p-4 rounded-2xl border border-[#E5E1D8] dark:border-[#38322C]">
                  <label className="flex items-center justify-between text-xs text-[#4E3B31] dark:text-[#EDE8DF] cursor-pointer">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span><strong>exif_katalog.csv</strong> (Excel / Lightroom / Apple Fotos Import)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={includeExifCsv}
                      onChange={(e) => setIncludeExifCsv(e.target.checked)}
                      className="rounded accent-[#8A9A5B] w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-[#4E3B31] dark:text-[#EDE8DF] cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-sky-600" />
                      <span><strong>reiseroute.geojson</strong> (RFC 7946 für Google Earth, Komoot & GIS)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={includeGeoJson}
                      onChange={(e) => setIncludeGeoJson(e.target.checked)}
                      className="rounded accent-[#8A9A5B] w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-[#4E3B31] dark:text-[#EDE8DF] cursor-pointer">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-amber-600" />
                      <span><strong>cewe_saal_manifest.json</strong> (Struktur für Fotobuch-Druckereien)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={includeCeweManifest}
                      onChange={(e) => setIncludeCeweManifest(e.target.checked)}
                      className="rounded accent-[#8A9A5B] w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-[#4E3B31] dark:text-[#EDE8DF] cursor-pointer">
                    <div className="flex items-center gap-2">
                      <FileType className="w-4 h-4 text-purple-600" />
                      <span><strong>REISEBERICHT.md</strong> (Markdown für Notion, Obsidian & Archiv)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={includeMarkdown}
                      onChange={(e) => setIncludeMarkdown(e.target.checked)}
                      className="rounded accent-[#8A9A5B] w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-[#4E3B31] dark:text-[#EDE8DF] cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-[#8A9A5B]" />
                      <span><strong>Web_Fotobuch/index.html</strong> (Eigenständiges interaktives Web-Buch)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={includeStandaloneHtmlBook}
                      onChange={(e) => setIncludeStandaloneHtmlBook(e.target.checked)}
                      className="rounded accent-[#8A9A5B] w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Action */}
              <div className="p-4 rounded-2xl bg-[#E2725B]/10 border border-[#E2725B]/25 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF]">
                    {totalPhotos} Fotografien in Originalauflösung
                  </div>
                  <div className="text-[11px] text-[#6B5E55] dark:text-[#A89F91]">
                    Vollständige EXIF-Metadaten & standardisierte Kataloge
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateZip}
                  disabled={isExporting || totalPhotos === 0}
                  className="px-5 py-2.5 rounded-xl bg-[#E2725B] hover:bg-[#D45E47] disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-[#E2725B]/20 transition cursor-pointer"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Packe ZIP...</span>
                    </>
                  ) : (
                    <>
                      <FolderArchive className="w-4 h-4" />
                      <span>ZIP-Archiv herunterladen</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------- */}
          {/* TAB 3: STANDARDS & DIREKT-EXPORTE */}
          {/* ------------------------------------------- */}
          {activeTab === 'standards' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-[#8A9A5B]/10 border border-[#8A9A5B]/20 text-xs text-[#4E3B31] dark:text-[#EDE8DF] leading-relaxed">
                <strong>Unterstützte Branchen- & Austauschstandards:</strong>
                <p className="mt-1 text-[11px] text-[#6B5E55] dark:text-[#A89F91]">
                  WanderLog exportiert alle Reisedaten in offene, zukunftssichere Standardformate. Du kannst diese Daten direkt in Fotobuch-Druckereien (CEWE, Saal Digital, Blurb), GIS-Software (Google Earth, QGIS, Garmin) oder Notiz-Apps (Notion, Obsidian) importieren.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* GeoJSON */}
                <div className="p-4 rounded-2xl bg-white dark:bg-[#28231F] border border-[#E5E1D8] dark:border-[#38322C] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-xs text-[#4E3B31] dark:text-[#EDE8DF] mb-1">
                      <Globe className="w-4 h-4 text-sky-600" />
                      <span>GeoJSON (RFC 7946)</span>
                    </div>
                    <p className="text-[11px] text-[#6B5E55] dark:text-[#A89F91] mb-3">
                      Offener OGC-Geodatenstandard für Google Earth, Mapbox, QGIS und GPS-Tracking.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadGeoJson}
                    className="w-full py-2 rounded-xl bg-[#F1EDE6] dark:bg-[#342F2A] hover:bg-[#8A9A5B] hover:text-white text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF] transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.geojson herunterladen</span>
                  </button>
                </div>

                {/* CSV Catalog */}
                <div className="p-4 rounded-2xl bg-white dark:bg-[#28231F] border border-[#E5E1D8] dark:border-[#38322C] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-xs text-[#4E3B31] dark:text-[#EDE8DF] mb-1">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>EXIF & Stopp-Katalog (CSV)</span>
                    </div>
                    <p className="text-[11px] text-[#6B5E55] dark:text-[#A89F91] mb-3">
                      Tabellarischer Metadatenkatalog mit GPS, Zeitstempeln und Notizen für Excel & Apple Fotos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadCsv}
                    className="w-full py-2 rounded-xl bg-[#F1EDE6] dark:bg-[#342F2A] hover:bg-[#8A9A5B] hover:text-white text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF] transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.csv herunterladen</span>
                  </button>
                </div>

                {/* Markdown */}
                <div className="p-4 rounded-2xl bg-white dark:bg-[#28231F] border border-[#E5E1D8] dark:border-[#38322C] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-xs text-[#4E3B31] dark:text-[#EDE8DF] mb-1">
                      <FileType className="w-4 h-4 text-purple-600" />
                      <span>Markdown Reisetagebuch (.md)</span>
                    </div>
                    <p className="text-[11px] text-[#6B5E55] dark:text-[#A89F91] mb-3">
                      Strukturierter Reisebericht mit Verlinkungen für Obsidian, Notion, Bear & Text-Archive.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadMarkdown}
                    className="w-full py-2 rounded-xl bg-[#F1EDE6] dark:bg-[#342F2A] hover:bg-[#8A9A5B] hover:text-white text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF] transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.md herunterladen</span>
                  </button>
                </div>

                {/* Standalone HTML */}
                <div className="p-4 rounded-2xl bg-white dark:bg-[#28231F] border border-[#E5E1D8] dark:border-[#38322C] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-xs text-[#4E3B31] dark:text-[#EDE8DF] mb-1">
                      <Globe className="w-4 h-4 text-amber-600" />
                      <span>Interaktives HTML-Buch</span>
                    </div>
                    <p className="text-[11px] text-[#6B5E55] dark:text-[#A89F91] mb-3">
                      Einzelne, in sich geschlossene Web-Seite zum offline Blättern ohne spezielle Software.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadHtmlBook}
                    className="w-full py-2 rounded-xl bg-[#F1EDE6] dark:bg-[#342F2A] hover:bg-[#8A9A5B] hover:text-white text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF] transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.html herunterladen</span>
                  </button>
                </div>

                {/* CEWE / Saal Manifest */}
                <div className="p-4 rounded-2xl bg-white dark:bg-[#28231F] border border-[#E5E1D8] dark:border-[#38322C] sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-xs text-[#4E3B31] dark:text-[#EDE8DF] mb-1">
                      <FileCode className="w-4 h-4 text-[#8A9A5B]" />
                      <span>CEWE & Saal Digital Druckvorlagen-Manifest (.json)</span>
                    </div>
                    <p className="text-[11px] text-[#6B5E55] dark:text-[#A89F91]">
                      Enthält standardisierte Seitenlayouts, Bildzuordnungen, Schnittrandangaben und Beschriftungen.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadCeweManifest}
                    className="px-4 py-2 rounded-xl bg-[#F1EDE6] dark:bg-[#342F2A] hover:bg-[#8A9A5B] hover:text-white text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF] transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Manifest herunterladen</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Progress Overlay / Footer Status */}
        {isExporting && (
          <div className="px-6 py-4 bg-[#8A9A5B]/15 border-t border-[#8A9A5B]/30 flex flex-col gap-2 animate-fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-[#4E3B31] dark:text-[#EDE8DF]">
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8A9A5B]" />
                <span>{progressStatus || 'Verarbeite Export...'}</span>
              </span>
              <span>{exportProgress}%</span>
            </div>
            <div className="w-full bg-white/60 dark:bg-black/40 rounded-full h-2 overflow-hidden border border-[#8A9A5B]/30">
              <div
                className="bg-[#8A9A5B] h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.max(exportProgress, 5)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
