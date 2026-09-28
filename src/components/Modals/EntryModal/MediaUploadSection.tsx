import React, { useRef, useState } from 'react';
import { MediaItem, Coordinates } from '../../../types';
import { formatFileSize } from '../../../utils/formatters';
import {
  Image as ImageIcon,
  ImagePlus,
  Camera,
  Upload,
  QrCode,
  Loader2,
  MapPin,
  Trash2,
  Map as MapIcon,
  Plus,
  CheckCircle2,
  X,
  Calendar,
} from 'lucide-react';

interface MediaUploadSectionProps {
  mediaList: MediaItem[];
  isProcessingMedia: boolean;
  processingProgressText: string;
  processingProgressPercent?: number;
  processingCurrentFile?: string;
  processingStats?: { current: number; total: number } | null;
  exifNotice: string | null;
  showMapPicker: boolean;
  onFilesSelected: (files: FileList | null | File[]) => void;
  onRemoveMedia: (mediaId: string) => void;
  onOpenQrModal: () => void;
  onToggleMapPicker: () => void;
  onExifLocationJump: (coords: Coordinates, photoDate?: string) => void;
  onExifDateJump?: (photoDate: string, photoLoc?: Coordinates) => void;
  onClearExifNotice: () => void;
}

export const MediaUploadSection: React.FC<MediaUploadSectionProps> = ({
  mediaList,
  isProcessingMedia,
  processingProgressText,
  processingProgressPercent = 0,
  processingCurrentFile,
  processingStats,
  exifNotice,
  showMapPicker,
  onFilesSelected,
  onRemoveMedia,
  onOpenQrModal,
  onToggleMapPicker,
  onExifLocationJump,
  onExifDateJump,
  onClearExifNotice,
}) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const formatBadgeDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-3">
      {/* HERO: Photo Upload from Mediathek / Gallery */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-[#E5E1D8] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#4E3B31] uppercase tracking-wider flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-[#8A9A5B]" />
            <span>Bilder & Mediathek ({mediaList.length})</span>
          </span>
          <span className="text-[11px] text-[#8A9A5B] font-semibold bg-[#8A9A5B]/10 px-2 py-0.5 rounded-lg border border-[#8A9A5B]/20">
            Auto-GPS & Datum aus EXIF
          </span>
        </div>

        {/* Main Photo Library Selection Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingOver(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              onFilesSelected(e.dataTransfer.files);
            }
          }}
          className={`p-4 sm:p-5 rounded-2xl border-2 border-dashed transition text-center flex flex-col items-center justify-center gap-2 cursor-pointer ${
            isDraggingOver
              ? 'border-[#8A9A5B] bg-[#8A9A5B]/10'
              : 'border-[#8A9A5B]/30 hover:border-[#8A9A5B] bg-[#FDFBF7] hover:bg-[#8A9A5B]/5'
          }`}
          onClick={() => galleryInputRef.current?.click()}
        >
          <div className="flex items-center gap-2">
            <div className="p-3 rounded-2xl bg-[#8A9A5B]/15 text-[#8A9A5B] shadow-sm">
              <ImagePlus className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
          </div>
          <div>
            <span className="text-sm font-bold text-[#4E3B31] block">
              Fotos auswählen oder hierher ziehen
            </span>
            <span className="text-xs text-[#8C8273]">
              Bilder antippen, mit der Kamera aufnehmen oder ablegen (JPG, PNG, HEIC, WebP)
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {/* Direct Camera Button (Mobile First) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                cameraInputRef.current?.click();
              }}
              className="px-3.5 py-2 rounded-xl bg-[#E2725B] hover:bg-[#D46049] text-white text-xs font-bold shadow-md shadow-[#E2725B]/20 transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
              title="Direkt mit der Handykamera fotografieren (GPS & Datum auto-übernehmen)"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Foto aufnehmen</span>
            </button>

            {/* Mediathek Upload Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                galleryInputRef.current?.click();
              }}
              className="px-3.5 py-2 rounded-xl bg-[#8A9A5B] hover:bg-[#7D8C68] text-white text-xs font-bold shadow-md shadow-[#8A9A5B]/20 transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
              title="Aus Galerie/Mediathek wählen (Android Google Fotos / Samsung Galerie / iOS)"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Mediathek</span>
            </button>

            {/* QR Sync - Hidden on Mobile */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenQrModal();
              }}
              className="hidden sm:flex px-3 py-2 rounded-xl bg-white hover:bg-[#F1EDE6] text-[#4E3B31] text-xs font-semibold border border-[#E5E1D8] transition items-center gap-1.5 shadow-sm cursor-pointer"
              title="Vom Handy per QR-Code senden"
            >
              <QrCode className="w-3.5 h-3.5 text-[#8A9A5B]" />
              <span>Smartphone QR-Sync</span>
            </button>
          </div>
        </div>

        {/* Hidden File Input for Native Camera Snapshot */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            onFilesSelected(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
        />

        {/* Hidden File Input for Gallery (Photos) */}
        <input
          ref={galleryInputRef}
          type="file"
          multiple
          accept="image/*,.heic,.heif,.jpg,.jpeg,.png,.webp,.dng,.avif"
          onChange={(e) => {
            onFilesSelected(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
        />

        {/* Processing Progress Indicator & Progress Bar */}
        {isProcessingMedia && (
          <div className="p-3.5 sm:p-4 bg-[#8A9A5B]/10 rounded-2xl border border-[#8A9A5B]/30 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-semibold text-[#4E3B31] truncate">
                <Loader2 className="w-4 h-4 text-[#8A9A5B] animate-spin shrink-0" />
                <span className="truncate">
                  {processingProgressText || 'Verarbeite Fotos & EXIF-Daten...'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {processingStats && processingStats.total > 1 && (
                  <span className="text-[11px] font-bold text-[#6B5E55] bg-white/70 px-2 py-0.5 rounded-md border border-[#E5E1D8]">
                    {processingStats.current}/{processingStats.total}
                  </span>
                )}
                <span className="text-[11px] font-mono font-bold text-[#8A9A5B] bg-white px-2 py-0.5 rounded-md border border-[#8A9A5B]/30 shadow-2xs">
                  {Math.round(processingProgressPercent)}%
                </span>
              </div>
            </div>

            {/* Progress Track */}
            <div className="w-full h-2.5 bg-white/80 rounded-full overflow-hidden border border-[#8A9A5B]/20 p-0.5 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-[#8A9A5B] to-[#607038] rounded-full transition-all duration-300 ease-out shadow-xs"
                style={{ width: `${Math.max(4, Math.min(100, processingProgressPercent))}%` }}
              />
            </div>

            {processingCurrentFile && (
              <div className="flex items-center justify-between text-[11px] text-[#6B5E55]">
                <span className="truncate max-w-[280px]">
                  Datei: <span className="font-mono text-[#4E3B31]">{processingCurrentFile}</span>
                </span>
                <span className="text-[10px] text-[#8C8273]">Bitte kurz warten</span>
              </div>
            )}
          </div>
        )}

        {/* Uploaded Media Previews */}
        {mediaList.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {mediaList.map((m, index) => (
                <div
                  key={m.id}
                  className="relative group rounded-2xl overflow-hidden aspect-[4/3] bg-stone-900 border border-[#E5E1D8] shadow-sm"
                >
                  <img src={m.url} alt={m.caption || 'Reisefoto'} className="w-full h-full object-cover" />

                  {/* First Photo Cover Badge */}
                  {index === 0 && (
                    <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-lg bg-[#E2725B] text-white text-[9px] font-bold shadow-sm">
                      Titelbild
                    </div>
                  )}

                  {/* EXIF / Device / Size Badge */}
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none gap-1">
                    <div className="flex items-center gap-1 pointer-events-auto flex-wrap">
                      {m.exifLocation && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (m.exifLocation) {
                              onExifLocationJump(m.exifLocation, m.exifDate);
                            }
                          }}
                          className="px-1.5 py-0.5 rounded-md bg-black/75 hover:bg-black backdrop-blur-sm text-[9px] text-[#8A9A5B] hover:text-[#A3B86C] font-bold flex items-center gap-0.5 shadow transition cursor-pointer"
                          title="Foto-Position & Reisedatum auf der Karte übernehmen"
                        >
                          <MapPin className="w-2.5 h-2.5" />
                          <span>GPS-Ort</span>
                        </button>
                      )}

                      {m.exifDate && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (m.exifDate) {
                              onExifDateJump?.(m.exifDate, m.exifLocation);
                            }
                          }}
                          className="px-1.5 py-0.5 rounded-md bg-black/75 hover:bg-black backdrop-blur-sm text-[9px] text-[#E2725B] hover:text-[#F39C82] font-bold flex items-center gap-1 shadow transition cursor-pointer"
                          title="Aufnahmedatum für den Eintrag übernehmen"
                        >
                          <Calendar className="w-2.5 h-2.5" />
                          <span>{formatBadgeDate(m.exifDate)}</span>
                        </button>
                      )}

                      {!m.exifLocation && !m.exifDate && (
                        <span className="px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-sm text-[9px] text-white/80 font-medium">
                          {m.size ? formatFileSize(m.size) : 'Foto'}
                        </span>
                      )}
                    </div>

                    {m.deviceInfo && (
                      <span className="px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-sm text-[9px] text-white/90 font-medium truncate max-w-[90px] shrink-0">
                        {m.deviceInfo}
                      </span>
                    )}
                  </div>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveMedia(m.id);
                    }}
                    className="absolute top-1.5 right-1.5 w-8 h-8 rounded-xl bg-red-600/90 hover:bg-red-700 active:scale-95 text-white flex items-center justify-center transition shadow cursor-pointer z-10"
                    title="Foto entfernen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[#8C8273]">
              <div className="flex items-center gap-2">
                <span>{mediaList.length} {mediaList.length === 1 ? 'Foto' : 'Fotos'} angehängt</span>
                <button
                  type="button"
                  onClick={onToggleMapPicker}
                  className="px-2 py-0.5 rounded-lg bg-[#8A9A5B]/15 hover:bg-[#8A9A5B]/25 text-[#8A9A5B] font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <MapIcon className="w-3 h-3" />
                  <span>{showMapPicker ? 'Kartenposition verbergen' : 'Position auf Karte ansehen'}</span>
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="text-[#8A9A5B] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Mehr Fotos</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Smartphone EXIF Notification Banner */}
      {exifNotice && (
        <div className="p-3 bg-[#8A9A5B]/15 border border-[#8A9A5B]/30 rounded-2xl flex items-start gap-2.5 text-xs text-[#4E3B31] animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#8A9A5B] shrink-0 mt-0.5" />
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span className="font-semibold">{exifNotice}</span>
            {!showMapPicker && (
              <button
                type="button"
                onClick={onToggleMapPicker}
                className="text-[#8A9A5B] font-bold hover:underline text-[11px] flex items-center gap-1"
              >
                <span>Auf Karte anzeigen</span>
                <MapIcon className="w-3 h-3" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClearExifNotice}
            className="p-1 text-[#8C8273] hover:text-[#4E3B31]"
            title="Ausblenden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
