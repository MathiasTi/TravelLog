import JSZip from 'jszip';
import { Trip, JournalEntry, Collaborator, CategoryType } from '../types';
import { storage } from './storage';
import { firestoreService } from './firebase';
import { syncEngine } from './syncEngine';
import { indexedDbStorage } from './indexedDbStorage';

export type Result<T, E = BackupDomainError> =
  | { readonly ok: true; readonly value: T; readonly error?: never }
  | { readonly ok: false; readonly error: E; readonly value?: never };

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export type BackupErrorCode =
  | 'INVALID_FORMAT'
  | 'CORRUPTED_FILE'
  | 'EMPTY_DATA'
  | 'RESTORE_CONCURRENT'
  | 'RESTORE_FAILED'
  | 'EXPORT_FAILED';

export class BackupDomainError extends Error {
  constructor(
    message: string,
    public readonly code: BackupErrorCode,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'BackupDomainError';
  }
}

export interface BackupMetadata {
  tripsCount: number;
  entriesCount: number;
  mediaCount: number;
  tracksCount: number;
  commentsCount: number;
  exportedBy?: string;
  appVersion: string;
  checksum?: string;
}

export interface BackupPayload {
  version: string;
  app: string;
  exportedAt: string;
  generator: string;
  meta: BackupMetadata;
  trips: Trip[];
  entries: JournalEntry[];
}

export interface BackupSummary {
  tripsCount: number;
  entriesCount: number;
  mediaCount: number;
  tracksCount: number;
  trips: { id: string; title: string; dateRange: string; entriesCount: number; coverImage?: string }[];
  exportedAt: string;
  version: string;
  checksum?: string;
}

export interface SafetySnapshot {
  timestamp: string;
  trips: Trip[];
  entries: JournalEntry[];
  reason: string;
}

/**
 * Deterministic SHA-256 payload checksum for data integrity verification
 */
export async function calculatePayloadChecksum(content: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // fallback to numeric hash below
    }
  }

  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = (hash << 5) - hash + content.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Creates an offline transactional snapshot of the current state before restore
 */
export async function createPreRestoreSnapshot(reason = 'Vor Wiederherstellung'): Promise<SafetySnapshot> {
  const snapshot: SafetySnapshot = {
    timestamp: new Date().toISOString(),
    trips: storage.getTrips(),
    entries: storage.getEntries(),
    reason,
  };
  await indexedDbStorage.setItem('wanderlog_safety_snapshot', snapshot);
  return snapshot;
}

/**
 * Retrieves the latest transactional safety snapshot if available
 */
export async function getLatestSafetySnapshot(): Promise<SafetySnapshot | null> {
  return indexedDbStorage.getItem<SafetySnapshot>('wanderlog_safety_snapshot');
}

/**
 * Reverts the database state to the pre-restore snapshot
 */
export async function rollbackSafetySnapshot(): Promise<RestoreExecutionResult> {
  const snapshot = await getLatestSafetySnapshot();
  if (!snapshot || !Array.isArray(snapshot.trips)) {
    return {
      success: false,
      tripsCount: 0,
      entriesCount: 0,
      message: 'Kein vorheriger Sicherheits-Snapshot gefunden.',
    };
  }

  const payload: BackupPayload = {
    version: '2.0',
    app: 'TravelLog',
    exportedAt: snapshot.timestamp,
    generator: 'Rollback Engine',
    meta: {
      tripsCount: snapshot.trips.length,
      entriesCount: snapshot.entries.length,
      mediaCount: 0,
      tracksCount: 0,
      commentsCount: 0,
      appVersion: '2.0.0',
    },
    trips: snapshot.trips,
    entries: snapshot.entries,
  };

  return executeRestore(payload, 'replace', { skipSnapshot: true });
}

export type RestoreMode = 'merge' | 'replace';

export interface BackupValidationResult {
  valid: boolean;
  error?: string;
  data?: BackupPayload;
  summary?: BackupSummary;
  result: Result<BackupPayload, BackupDomainError>;
}

export interface RestoreExecutionResult {
  success: boolean;
  tripsCount: number;
  entriesCount: number;
  message: string;
  trips?: Trip[];
  entries?: JournalEntry[];
}

interface RawBackupTrip {
  id?: string;
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  coverImage?: string;
  isPublic?: boolean;
  passwordProtected?: boolean;
  shareToken?: string;
  collaborators?: Trip['collaborators'];
  countryCodes?: string[];
  defaultZoom?: number;
  defaultCoordinates?: [number, number];
  createdAt?: string;
  updatedAt?: string;
}

interface RawBackupEntry {
  id?: string;
  tripId?: string;
  title?: string;
  note?: string;
  date?: string;
  locationName?: string;
  coordinates?: { lat: number; lng: number };
  media?: JournalEntry['media'];
  track?: JournalEntry['track'];
  weather?: JournalEntry['weather'];
  mood?: string;
  category?: JournalEntry['category'];
  author?: JournalEntry['author'];
  tags?: string[];
  likes?: string[];
  comments?: JournalEntry['comments'];
  createdAt?: string;
  updatedAt?: string;
}

interface RawBackupPayload {
  version?: string;
  app?: string;
  exportedAt?: string;
  generator?: string;
  meta?: Partial<BackupMetadata>;
  trips?: RawBackupTrip[];
  entries?: RawBackupEntry[];
}

/**
 * Trigger browser file download from Blob
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Format current timestamp for safe filenames (e.g. 2026-08-29_1430)
 */
function getTimestampSlug(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}_${hh}${min}`;
}

/**
 * Build the standardized JSON backup payload object
 */
export function buildBackupPayload(
  allTrips: Trip[],
  allEntries: JournalEntry[],
  targetTripId?: string,
  userName?: string
): BackupPayload {
  const tripsToExport = targetTripId
    ? allTrips.filter((t) => t.id === targetTripId)
    : allTrips;

  const validTripIds = new Set(tripsToExport.map((t) => t.id));
  const entriesToExport = allEntries.filter((e) => validTripIds.has(e.tripId));

  let mediaCount = 0;
  let tracksCount = 0;
  let commentsCount = 0;

  entriesToExport.forEach((e) => {
    if (e.media) mediaCount += e.media.length;
    if (e.track) tracksCount += 1;
    if (e.comments) commentsCount += e.comments.length;
  });

  return {
    version: '2.0',
    app: 'TravelLog',
    exportedAt: new Date().toISOString(),
    generator: 'TravelLog Backup & Restore Engine',
    meta: {
      tripsCount: tripsToExport.length,
      entriesCount: entriesToExport.length,
      mediaCount,
      tracksCount,
      commentsCount,
      exportedBy: userName || 'Reisender',
      appVersion: '1.9.8',
    },
    trips: tripsToExport,
    entries: entriesToExport,
  };
}

/**
 * Export JSON Backup file (.json)
 */
export function exportJsonBackup(
  allTrips: Trip[],
  allEntries: JournalEntry[],
  options?: { targetTripId?: string; userName?: string }
): { filename: string; sizeBytes: number } {
  const payload = buildBackupPayload(allTrips, allEntries, options?.targetTripId, options?.userName);
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });

  const scopePrefix = options?.targetTripId && payload.trips[0]
    ? `backup_${payload.trips[0].title.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    : 'wanderlog_komplett_backup';

  const filename = `${scopePrefix}_${getTimestampSlug()}.json`;
  downloadBlob(blob, filename);

  return {
    filename,
    sizeBytes: blob.size,
  };
}

/**
 * Export full ZIP Archive with JSON database, media files and instructions
 */
export async function exportZipBackupArchive(
  allTrips: Trip[],
  allEntries: JournalEntry[],
  options?: {
    targetTripId?: string;
    userName?: string;
    onProgress?: (progressPct: number, statusText: string) => void;
  }
): Promise<{ filename: string }> {
  const onProgress = options?.onProgress || (() => {});
  onProgress(5, 'Erstelle Sicherungs-Manifest...');

  const payload = buildBackupPayload(allTrips, allEntries, options?.targetTripId, options?.userName);
  const zip = new JSZip();

  // Compute cryptographic SHA-256 checksum of payload
  const initialJson = JSON.stringify(payload, null, 2);
  const checksum = await calculatePayloadChecksum(initialJson);
  payload.meta.checksum = checksum;

  // 1. Root manifest backup JSON with integrity hash
  zip.file('travel_journal_backup.json', JSON.stringify(payload, null, 2));
  zip.file('checksum.sha256', `${checksum}  travel_journal_backup.json\n`);

  // 2. Readme file with explanation
  const readmeContent = `=======================================================
WANDERLOG / TRAVELLOG REISE-SICHERUNG (BACKUP ARCHIV)
=======================================================
Erstellt am: ${new Date(payload.exportedAt).toLocaleString('de-DE')}
Erstellt von: ${payload.meta.exportedBy || 'Reisender'}
Prüfsumme (SHA-256): ${checksum}
Reisen im Backup: ${payload.meta.tripsCount}
Stopps & Tagebucheinträge: ${payload.meta.entriesCount}
Gesicherte Fotos: ${payload.meta.mediaCount}
GPS-Tracks (.GPX / .FIT): ${payload.meta.tracksCount}

WIEDERHERSTELLUNG:
-----------------
1. Öffne WanderLog im Webbrowser.
2. Klicke in der Menüleiste auf 'Sicherung & Wiederherstellung'.
3. Wähle den Reiter 'Wiederherstellung'.
4. Ziehe dieses ZIP-Archiv oder die darin enthaltene 'travel_journal_backup.json' hinein.
5. Bestätige 'Zusammenführen' oder 'Vollständig Ersetzen'. Fertig!
=======================================================
`;
  zip.file('README.txt', readmeContent);

  // 3. Media folder & GPS tracks
  const mediaFolder = zip.folder('medien');
  const tracksFolder = zip.folder('gps_tracks');

  // Export Trip Cover Images
  if (mediaFolder) {
    for (const t of payload.trips) {
      if (t.coverImage) {
        const coverFileName = `cover_${t.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`;
        try {
          if (t.coverImage.startsWith('data:')) {
            const parts = t.coverImage.split(',');
            if (parts.length === 2) {
              mediaFolder.file(coverFileName, parts[1], { base64: true });
            }
          } else if (t.coverImage.startsWith('http')) {
            const res = await fetch(t.coverImage).catch(() => null);
            if (res && res.ok) {
              const blob = await res.blob();
              mediaFolder.file(coverFileName, blob);
            }
          }
        } catch (cErr) {
          console.warn('Trip cover export warning:', cErr);
        }
      }
    }
  }

  const totalEntries = payload.entries.length;

  for (let i = 0; i < totalEntries; i++) {
    const entry = payload.entries[i];
    const pct = Math.round(10 + (i / Math.max(1, totalEntries)) * 70);
    onProgress(pct, `Sichere Medien für: ${entry.title}...`);

    // Save GPS Tracks
    if (entry.track && tracksFolder) {
      const trackFilename = `${String(i + 1).padStart(2, '0')}_${entry.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.gpx`;
      const points = entry.track.points || [];
      const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TravelLog Backup Engine" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${entry.title}</name>
    <trkseg>
${points.map((p) => `      <trkpt lat="${p.lat}" lon="${p.lng}">${p.altitude !== undefined ? `<ele>${p.altitude}</ele>` : ''}${p.timestamp ? `<time>${p.timestamp}</time>` : ''}</trkpt>`).join('\n')}
    </trkseg>
  </trk>
</gpx>`;
      tracksFolder.file(trackFilename, gpxContent);
    }

    // Save photo media items (with offline IndexedDB resolution fallback)
    if (entry.media && entry.media.length > 0 && mediaFolder) {
      for (let mIdx = 0; mIdx < entry.media.length; mIdx++) {
        const m = entry.media[mIdx];
        const ext = 'jpg';
        const mediaFileName = `${String(i + 1).padStart(2, '0')}_${entry.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${mIdx + 1}.${ext}`;

        try {
          let mediaUrl = m.url;
          // If media URL is missing or not a data URL, check IndexedDB cache
          if (!mediaUrl || !mediaUrl.startsWith('data:')) {
            const cached = await indexedDbStorage.getCachedMedia(m.id);
            if (cached) {
              mediaUrl = cached;
            }
          }

          if (mediaUrl && mediaUrl.startsWith('data:')) {
            const parts = mediaUrl.split(',');
            if (parts.length === 2) {
              mediaFolder.file(mediaFileName, parts[1], { base64: true });
            }
          } else if (mediaUrl && (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://'))) {
            try {
              const res = await fetch(mediaUrl);
              if (res.ok) {
                const blobData = await res.blob();
                mediaFolder.file(mediaFileName, blobData);
              }
            } catch {
              // Ignore fetch error for external CDN placeholder
            }
          }
        } catch (mErr) {
          console.warn('Media zip export warning:', mErr);
        }
      }
    }
  }

  onProgress(85, 'Komprimiere ZIP-Archiv mit Prüfsumme...');
  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      const p = Math.round(85 + (metadata.percent / 100) * 14);
      onProgress(p, `Erstelle ZIP-Archiv (${Math.round(metadata.percent)}%)...`);
    }
  );

  const scopePrefix = options?.targetTripId && payload.trips[0]
    ? `backup_archiv_${payload.trips[0].title.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    : 'wanderlog_komplett_archiv';

  const filename = `${scopePrefix}_${getTimestampSlug()}.zip`;
  downloadBlob(zipBlob, filename);
  onProgress(100, 'Sicherungs-Archiv erfolgreich heruntergeladen!');

  return { filename };
}

let isRestoreInProgress = false;

/**
 * Validate and parse a user uploaded backup JSON or ZIP file
 */
export async function parseAndValidateBackupFile(
  file: File
): Promise<BackupValidationResult> {
  try {
    const isZip = file.name.toLowerCase().endsWith('.zip');
    const isJson = file.name.toLowerCase().endsWith('.json');

    if (!isZip && !isJson) {
      const errorMsg = 'Ungültiges Dateiformat. Bitte wähle eine .json- oder .zip-Sicherungsdatei aus.';
      return {
        valid: false,
        error: errorMsg,
        result: Err(new BackupDomainError(errorMsg, 'INVALID_FORMAT')),
      };
    }

    let parsed: unknown = null;
    const mediaBlobs: Map<string, string> = new Map(); // filename -> dataUrl

    if (isZip) {
      const zip = new JSZip();
      const unzipped = await zip.loadAsync(file);

      // Find backup json in the zip
      let backupJsonFile = unzipped.file('travel_journal_backup.json');
      if (!backupJsonFile) {
        // Find any .json file in root
        const jsonFiles = Object.keys(unzipped.files).filter(
          (k) => k.endsWith('.json') && !k.startsWith('__MACOSX')
        );
        if (jsonFiles.length > 0) {
          backupJsonFile = unzipped.file(jsonFiles[0]);
        }
      }

      if (!backupJsonFile) {
        const errorMsg = 'Das ZIP-Archiv enthält keine gültige Sicherungsdatei (travel_journal_backup.json).';
        return {
          valid: false,
          error: errorMsg,
          result: Err(new BackupDomainError(errorMsg, 'INVALID_FORMAT')),
        };
      }

      const jsonText = await backupJsonFile.async('text');
      try {
        parsed = JSON.parse(jsonText) as unknown;
      } catch (parseErr: unknown) {
        const errorMsg = 'Die im ZIP-Archiv enthaltene Sicherungsdatei ist beschädigt.';
        return {
          valid: false,
          error: errorMsg,
          result: Err(new BackupDomainError(errorMsg, 'CORRUPTED_FILE', parseErr)),
        };
      }

      // Check for media in medien/ folder
      const mediaFiles = Object.keys(unzipped.files).filter(
        (k) => (k.startsWith('medien/') || k.startsWith('media/')) && !unzipped.files[k].dir
      );

      for (const mPath of mediaFiles) {
        try {
          const mFile = unzipped.file(mPath);
          if (mFile) {
            const base64Data = await mFile.async('base64');
            const fileName = mPath.split('/').pop() || '';
            mediaBlobs.set(fileName, `data:image/jpeg;base64,${base64Data}`);
          }
        } catch {
          // ignore
        }
      }
    } else {
      const text = await file.text();
      try {
        parsed = JSON.parse(text) as unknown;
      } catch (parseErr: unknown) {
        const errorMsg = 'Die Datei enthält kein gültiges JSON. Möglicherweise ist sie beschädigt.';
        return {
          valid: false,
          error: errorMsg,
          result: Err(new BackupDomainError(errorMsg, 'CORRUPTED_FILE', parseErr)),
        };
      }
    }

    // Support both structured BackupPayload format and raw { trips: [], entries: [] }
    let rawTrips: RawBackupTrip[] = [];
    let rawEntries: RawBackupEntry[] = [];
    let rawVersion = '2.0';
    let rawApp = 'TravelLog';
    let rawExportedAt: string | undefined;
    let rawGenerator: string | undefined;
    let rawAppVersion: string | undefined;

    if (parsed !== null && typeof parsed === 'object') {
      const parsedRecord = parsed as RawBackupPayload;
      if (Array.isArray(parsedRecord.trips)) {
        rawTrips = parsedRecord.trips;
      }
      if (Array.isArray(parsedRecord.entries)) {
        rawEntries = parsedRecord.entries;
      }
      if (parsedRecord.version) rawVersion = parsedRecord.version;
      if (parsedRecord.app) rawApp = parsedRecord.app;
      if (parsedRecord.exportedAt) rawExportedAt = parsedRecord.exportedAt;
      if (parsedRecord.generator) rawGenerator = parsedRecord.generator;
      if (parsedRecord.meta?.appVersion) rawAppVersion = parsedRecord.meta.appVersion;

      // If file was an array of trips directly
      if (Array.isArray(parsed) && parsed.length > 0 && typeof (parsed[0] as RawBackupTrip).startDate !== 'undefined') {
        rawTrips = parsed as RawBackupTrip[];
      }
    }

    if (rawTrips.length === 0 && rawEntries.length === 0) {
      const errorMsg = 'In der Sicherungsdatei wurden keine Reisen oder Tagebucheinträge gefunden.';
      return {
        valid: false,
        error: errorMsg,
        result: Err(new BackupDomainError(errorMsg, 'EMPTY_DATA')),
      };
    }

    // Sanitize & clean
    const validTrips: Trip[] = rawTrips.map((t) => {
      const coverFileName = `cover_${t.id ? t.id.replace(/[^a-zA-Z0-9_-]/g, '_') : ''}.jpg`;
      const matchedCover = mediaBlobs.get(coverFileName) || t.coverImage;
      return {
        id: t.id || `trip-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: t.title || 'Importierte Reise',
        description: t.description || '',
        startDate: t.startDate || new Date().toISOString().split('T')[0],
        endDate: t.endDate,
        coverImage: matchedCover,
        isPublic: t.isPublic !== false,
        passwordProtected: Boolean(t.passwordProtected),
        shareToken: t.shareToken,
        collaborators: t.collaborators || [],
        countryCodes: t.countryCodes || [],
        defaultZoom: t.defaultZoom,
        defaultCoordinates: t.defaultCoordinates,
        createdAt: t.createdAt || new Date().toISOString(),
        updatedAt: t.updatedAt || new Date().toISOString(),
      };
    });

    const defaultAuthor: Collaborator = {
      id: 'author-default',
      name: 'Reisender',
      avatar: '',
      color: '#8A9A5B',
      role: 'owner',
    };

    const validEntries: JournalEntry[] = rawEntries.map((e, eIdx) => {
      const entryTitleSlug = (e.title || 'stopp').replace(/[^a-zA-Z0-9_-]/g, '_');
      const sanitizedMedia = (e.media || []).map((m, mIdx) => {
        // If we found media in the ZIP archive, attach it
        const possibleFileName = `${String(eIdx + 1).padStart(2, '0')}_${entryTitleSlug}_${mIdx + 1}.jpg`;
        const matchedUrl = mediaBlobs.get(possibleFileName) || m.url;
        return {
          ...m,
          type: 'photo' as const,
          url: matchedUrl,
        };
      });

      return {
        id: e.id || `entry-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        tripId: e.tripId || validTrips[0]?.id || 'trip-default',
        title: e.title || 'Importierter Stopp',
        note: e.note || '',
        date: e.date || new Date().toISOString(),
        locationName: e.locationName || '',
        coordinates: e.coordinates || { lat: 0, lng: 0 },
        media: sanitizedMedia,
        track: e.track,
        weather: e.weather,
        mood: e.mood,
        category: (e.category || 'general') as CategoryType,
        author: e.author || defaultAuthor,
        likes: e.likes || [],
        comments: e.comments || [],
        createdAt: e.createdAt || new Date().toISOString(),
        updatedAt: e.updatedAt || new Date().toISOString(),
      };
    });

    let totalMedia = 0;
    let totalTracks = 0;
    validEntries.forEach((e) => {
      if (e.media) totalMedia += e.media.length;
      if (e.track) totalTracks += 1;
    });

    const tripsSummary = validTrips.map((t) => {
      const tripEntries = validEntries.filter((e) => e.tripId === t.id);
      const dateRange = t.startDate ? `${t.startDate}${t.endDate ? ` bis ${t.endDate}` : ''}` : 'Ohne Datum';
      return {
        id: t.id,
        title: t.title,
        dateRange,
        entriesCount: tripEntries.length,
        coverImage: t.coverImage,
      };
    });

    const payload: BackupPayload = {
      version: rawVersion,
      app: rawApp,
      exportedAt: rawExportedAt || new Date().toISOString(),
      generator: rawGenerator || 'Importierte Sicherung',
      meta: {
        tripsCount: validTrips.length,
        entriesCount: validEntries.length,
        mediaCount: totalMedia,
        tracksCount: totalTracks,
        commentsCount: 0,
        appVersion: rawAppVersion || '2.0.0',
      },
      trips: validTrips,
      entries: validEntries,
    };

    const summary: BackupSummary = {
      tripsCount: validTrips.length,
      entriesCount: validEntries.length,
      mediaCount: totalMedia,
      tracksCount: totalTracks,
      trips: tripsSummary,
      exportedAt: payload.exportedAt,
      version: payload.version,
    };

    return {
      valid: true,
      data: payload,
      summary,
      result: Ok(payload),
    };
  } catch (err: unknown) {
    const errorMsg = `Fehler beim Analysieren der Datei: ${err instanceof Error ? err.message : String(err)}`;
    return {
      valid: false,
      error: errorMsg,
      result: Err(new BackupDomainError(errorMsg, 'CORRUPTED_FILE', err)),
    };
  }
}

/**
 * Execute restore of backup data into all persistence layers (LocalStorage, IndexedDB, Server & Firestore)
 */
export async function executeRestore(
  payload: BackupPayload,
  mode: RestoreMode = 'merge',
  options?: {
    onProgress?: (progressPct: number, statusText: string) => void;
    skipSnapshot?: boolean;
  }
): Promise<RestoreExecutionResult> {
  if (isRestoreInProgress) {
    return {
      success: false,
      tripsCount: 0,
      entriesCount: 0,
      message: 'Eine Wiederherstellung wird bereits ausgeführt. Bitte warten.',
    };
  }

  isRestoreInProgress = true;
  const onProgress = options?.onProgress || (() => {});

  try {
    if (!options?.skipSnapshot) {
      onProgress(5, 'Erstelle Sicherheits-Snapshot des aktuellen Zustands...');
      await createPreRestoreSnapshot(mode === 'replace' ? 'Vor vollständigem Ersetzen' : 'Vor Zusammenführung');
    }

    onProgress(15, 'Bereite Wiederherstellung vor...');

    let finalTrips: Trip[] = [];
    let finalEntries: JournalEntry[] = [];

    if (mode === 'replace') {
      // Complete replacement
      finalTrips = [...payload.trips];
      finalEntries = [...payload.entries];
    } else {
      // Merge with existing data
      const currentTrips = storage.getTrips();
      const currentEntries = storage.getEntries();

      // Merge trips by ID
      const tripMap = new Map<string, Trip>();
      currentTrips.forEach((t) => tripMap.set(t.id, t));
      payload.trips.forEach((t) => tripMap.set(t.id, t));
      finalTrips = Array.from(tripMap.values());

      // Merge entries by ID
      const entryMap = new Map<string, JournalEntry>();
      currentEntries.forEach((e) => entryMap.set(e.id, e));
      payload.entries.forEach((e) => entryMap.set(e.id, e));
      finalEntries = Array.from(entryMap.values());
    }

    onProgress(30, 'Speichere Daten im lokalen Browser-Speicher...');
    // 1. Update LocalStorage
    storage.setTrips(finalTrips);
    storage.setEntries(finalEntries);
    if (finalTrips.length > 0) {
      storage.setActiveTripId(finalTrips[0].id);
    }

    // 2. Cache media into IndexedDB
    onProgress(50, 'Sichere Medien im Offline-Speicher (IndexedDB)...');
    for (const entry of finalEntries) {
      if (entry.media && entry.media.length > 0) {
        for (const m of entry.media) {
          if (m.url && m.url.startsWith('data:')) {
            try {
              await indexedDbStorage.cacheMedia(m.id, m.url);
            } catch {
              // Ignore individual cache errors
            }
          }
        }
      }
    }

    // 3. Sync to Express backend
    onProgress(70, 'Synchronisiere mit dem Server-Backend...');
    try {
      await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trips: finalTrips,
          entries: finalEntries,
          mode,
        }),
      });
    } catch (serverErr: unknown) {
      console.warn('Server restore sync warning:', serverErr);
    }

    // 4. Sync to Firestore Cloud Database
    onProgress(85, 'Synchronisiere mit der Cloud (Firestore)...');
    try {
      // Save all trips to Firestore
      for (const t of payload.trips) {
        await firestoreService.saveTrip(t).catch(() => {});
      }
      // Save all entries to Firestore
      for (const e of payload.entries) {
        await firestoreService.saveEntry(e).catch(() => {});
      }
    } catch (firestoreErr: unknown) {
      console.warn('Firestore restore sync warning:', firestoreErr);
    }

    onProgress(100, 'Wiederherstellung erfolgreich abgeschlossen!');

    // Trigger sync engine to notify all open UI components
    storage.setLastSyncedAt(new Date().toISOString());

    return {
      success: true,
      tripsCount: finalTrips.length,
      entriesCount: finalEntries.length,
      message: `${finalTrips.length} Reisen und ${finalEntries.length} Stopps wurden erfolgreich ${mode === 'replace' ? 'wiederhergestellt' : 'zusammengeführt'}!`,
      trips: finalTrips,
      entries: finalEntries,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Execute restore error:', err);
    return {
      success: false,
      tripsCount: 0,
      entriesCount: 0,
      message: `Fehler bei der Wiederherstellung: ${errorMsg || 'Unbekannter Fehler'}`,
    };
  } finally {
    isRestoreInProgress = false;
  }
}
