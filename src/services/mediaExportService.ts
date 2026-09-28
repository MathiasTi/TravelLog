import JSZip from 'jszip';
import { Trip, JournalEntry, MediaItem } from '../types';
import { CATEGORIES } from '../data/initialData';
import { storage } from './storage';

export type MediaFolderStructure = 'by_stop' | 'by_date' | 'flat';

export interface MediaExportOptions {
  folderStructure: MediaFolderStructure;
  includeMetadataJson: boolean;
  includeExifCsv: boolean;
  includeGeoJson: boolean;
  includeMarkdown: boolean;
  includeStandaloneHtmlBook: boolean;
  includeCeweManifest: boolean;
  onProgress?: (progress: number, statusText: string) => void;
}

/**
 * Downloads a binary blob in the browser
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Downloads a single media item directly
 */
export async function downloadSingleMediaItem(media: MediaItem, defaultFilename = 'wanderlog_foto.jpg'): Promise<void> {
  const realUrl = await storage.hydrateMediaUrl(media);
  if (!realUrl) return;

  if (realUrl.startsWith('data:')) {
    const res = await fetch(realUrl);
    const blob = await res.blob();
    const ext = 'jpg';
    triggerBlobDownload(blob, `${media.caption || defaultFilename}.${ext}`.replace(/[^a-z0-9._-]/gi, '_'));
  } else {
    try {
      const res = await fetch(realUrl, { mode: 'cors' });
      const blob = await res.blob();
      const ext = 'jpg';
      triggerBlobDownload(blob, `${media.caption || defaultFilename}.${ext}`.replace(/[^a-z0-9._-]/gi, '_'));
    } catch {
      window.open(realUrl, '_blank');
    }
  }
}

/**
 * Generates Standard GeoJSON (RFC 7946) for the trip
 */
export function generateTripGeoJson(trip: Trip, entries: JournalEntry[]): string {
  const tripEntries = entries.filter((e) => e.tripId === trip.id);

  const features = tripEntries
    .filter((e) => e.coordinates && typeof e.coordinates.lat === 'number' && typeof e.coordinates.lng === 'number')
    .map((e, idx) => {
      const { lat, lng } = e.coordinates;
      return {
        type: 'Feature',
        id: e.id,
        geometry: {
          type: 'Point',
          coordinates: [lng, lat], // GeoJSON uses [Longitude, Latitude]
        },
        properties: {
          stopNumber: idx + 1,
          title: e.title,
          date: e.date,
          category: e.category,
          address: e.locationName || '',
          notes: e.note || '',
          weather: e.weather || null,
          photoCount: e.media?.length || 0,
          likesCount: e.likes?.length || 0,
          commentsCount: e.comments?.length || 0,
        },
      };
    });

  // Include line track coordinates if present
  const trackFeatures = (trip.tracks || []).map((t, idx) => ({
    type: 'Feature',
    id: `track-${t.id || idx}`,
    geometry: {
      type: 'LineString',
      coordinates: t.points.map((p) => [p.lng, p.lat, p.altitude || 0]),
    },
    properties: {
      trackName: t.filename || 'GPS Track',
      activityType: t.summary?.sport || 'tour',
      totalDistanceKm: t.summary?.totalDistanceKm || 0,
      elevationGainM: t.summary?.elevationGainM || 0,
      totalDurationSecs: t.summary?.totalDurationSec || 0,
    },
  }));

  const geoJson = {
    type: 'FeatureCollection',
    name: trip.title,
    crs: {
      type: 'name',
      properties: {
        name: 'urn:ogc:def:crs:OGC:1.3:CRS84',
      },
    },
    metadata: {
      generator: 'WanderLog Travel Journal',
      tripId: trip.id,
      tripTitle: trip.title,
      startDate: trip.startDate,
      endDate: trip.endDate,
      totalStops: tripEntries.length,
      exportedAt: new Date().toISOString(),
    },
    features: [...features, ...trackFeatures],
  };

  return JSON.stringify(geoJson, null, 2);
}

/**
 * Generates CSV EXIF & Metadata Catalog (Excel / Lightroom / Apple Photos compatible)
 */
export function generateExifCsvCatalog(trip: Trip, entries: JournalEntry[]): string {
  const tripEntries = entries.filter((e) => e.tripId === trip.id);

  const headers = [
    'Dateiname',
    'Stopp_Nummer',
    'Stopp_Titel',
    'Kategorie',
    'Datum_Uhrzeit',
    'Breitengrad_Latitude',
    'Laengengrad_Longitude',
    'Adresse',
    'Medientyp',
    'Bildunterschrift',
    'Kameramodell',
    'Wetter_Zustand',
    'Temperatur_C',
    'Notizen',
  ];

  const rows: string[][] = [];

  tripEntries.forEach((entry, eIdx) => {
    const stopNum = String(eIdx + 1);
    const cat = CATEGORIES.find((c) => c.id === entry.category)?.label || entry.category;
    const lat = entry.coordinates ? entry.coordinates.lat.toFixed(6) : '';
    const lng = entry.coordinates ? entry.coordinates.lng.toFixed(6) : '';
    const address = (entry.locationName || '').replace(/"/g, '""');
    const weather = entry.weather ? `${entry.weather.label} (${entry.weather.temp}°C)` : '';
    const temp = entry.weather?.temp !== undefined ? String(entry.weather.temp) : '';
    const notes = (entry.note || '').replace(/"/g, '""').replace(/\n/g, ' ');

    (entry.media || []).forEach((m, mIdx) => {
      const safeTitle = entry.title.replace(/[^a-z0-9_-]/gi, '_');
      const filename = `${String(eIdx + 1).padStart(2, '0')}_${safeTitle}_${String(mIdx + 1).padStart(2, '0')}.jpg`;
      const caption = (m.caption || '').replace(/"/g, '""');
      const camera = (m.deviceInfo || '').replace(/"/g, '""');

      rows.push([
        `"${filename}"`,
        `"${stopNum}"`,
        `"${entry.title.replace(/"/g, '""')}"`,
        `"${cat}"`,
        `"${m.timestamp || entry.date}"`,
        `"${lat}"`,
        `"${lng}"`,
        `"${address}"`,
        `"${m.type}"`,
        `"${caption}"`,
        `"${camera}"`,
        `"${weather}"`,
        `"${temp}"`,
        `"${notes}"`,
      ]);
    });
  });

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  return '\uFEFF' + csvContent; // Add UTF-8 BOM for Excel compatibility
}

/**
 * Generates CEWE / Saal Digital compatible Photobook Manifest JSON
 */
export function generateCewePhotobookManifest(trip: Trip, entries: JournalEntry[]): string {
  const tripEntries = entries.filter((e) => e.tripId === trip.id);

  const manifest = {
    standard: 'CEWE_SAAL_PHOTOBOOK_LAYOUT_v1',
    bookTitle: trip.title,
    subtitle: trip.description || 'WanderLog Reisetagebuch',
    createdAt: new Date().toISOString(),
    specifications: {
      targetFormats: ['A4_LANDSCAPE_297x210', 'A4_PORTRAIT_210x297', 'SQUARE_210x210'],
      recommendedDpi: 300,
      colorSpace: 'sRGB',
      bleedMarginMm: 3.0,
    },
    pages: tripEntries.map((e, idx) => ({
      pageNumber: idx + 1,
      stopTitle: e.title,
      date: e.date,
      category: e.category,
      location: e.locationName || '',
      coordinates: e.coordinates || null,
      storyText: e.note || '',
      photos: (e.media || [])
        .map((m, mIdx) => ({
          photoIndex: mIdx + 1,
          caption: m.caption || '',
          timestamp: m.timestamp || e.date,
          device: m.deviceInfo || 'Standard Camera',
        })),
    })),
  };

  return JSON.stringify(manifest, null, 2);
}

/**
 * Generates a full Markdown Journal for Obsidian, Notion, or text archives
 */
export function generateMarkdownJournal(trip: Trip, entries: JournalEntry[]): string {
  const tripEntries = entries.filter((e) => e.tripId === trip.id);

  let md = `# 📖 Reisetagebuch: ${trip.title}\n\n`;
  md += `> **Reisezeitraum:** ${trip.startDate || '–'} bis ${trip.endDate || '–'}\n`;
  md += `> **Stationen:** ${tripEntries.length} Stopps • **Fotos:** ${tripEntries.reduce((acc, e) => acc + (e.media?.length || 0), 0)}\n\n`;

  if (trip.description) {
    md += `### Über die Reise\n${trip.description}\n\n`;
  }

  md += `## Inhaltsverzeichnis\n`;
  tripEntries.forEach((e, idx) => {
    md += `${idx + 1}. [${e.title}](#stopp-${idx + 1}-${e.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}) (${e.date})\n`;
  });
  md += `\n---\n\n`;

  tripEntries.forEach((e, idx) => {
    const cat = CATEGORIES.find((c) => c.id === e.category)?.label || e.category;
    md += `## Stopp ${idx + 1}: ${e.title}\n\n`;
    md += `- **Datum:** ${e.date}\n`;
    md += `- **Kategorie:** ${cat}\n`;
    if (e.locationName) md += `- **Ort:** ${e.locationName}\n`;
    if (e.coordinates) md += `- **GPS:** ${e.coordinates.lat.toFixed(5)}, ${e.coordinates.lng.toFixed(5)}\n`;
    if (e.weather) md += `- **Wetter:** ${e.weather.label}, ${e.weather.temp}°C\n`;
    md += `\n### Reisebericht\n${e.note || '*Keine Notizen erfasst.*'}\n\n`;

    if (e.media && e.media.length > 0) {
      md += `### Aufnahmen (${e.media.length})\n`;
      e.media.forEach((m, mIdx) => {
        const safeTitle = e.title.replace(/[^a-z0-9_-]/gi, '_');
        const filename = `${String(idx + 1).padStart(2, '0')}_${safeTitle}_${String(mIdx + 1).padStart(2, '0')}.jpg`;
        md += `![${m.caption || e.title}](./fotos/${filename})\n`;
        if (m.caption) md += `*${m.caption}*\n\n`;
      });
    }

    if (e.comments && e.comments.length > 0) {
      md += `### Kommentare von Mitreisenden\n`;
      e.comments.forEach((c) => {
        md += `> **${c.author?.name || 'Mitreisender'}:** ${c.text}\n`;
      });
      md += `\n`;
    }

    md += `---\n\n`;
  });

  return md;
}

/**
 * Generates an interactive standalone HTML5 Web-Fotobuch file that can be opened in any browser offline
 */
export function generateStandaloneHtmlBook(trip: Trip, entries: JournalEntry[]): string {
  const tripEntries = entries.filter((e) => e.tripId === trip.id);

  const safeJson = JSON.stringify({
    trip,
    entries: tripEntries,
  }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${trip.title} – WanderLog Reisetagebuch</title>
  <style>
    :root {
      --primary: #4E3B31;
      --accent: #E2725B;
      --secondary: #8A9A5B;
      --bg: #FDFBF7;
      --card-bg: #FFFFFF;
      --border: #E5E1D8;
      --text: #4E3B31;
      --muted: #8C8273;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --primary: #EDE8DF;
        --bg: #1A1715;
        --card-bg: #26211E;
        --border: #3D3630;
        --text: #EDE8DF;
        --muted: #A89F91;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 24px;
    }
    .container { max-width: 960px; margin: 0 auto; }
    header {
      text-align: center;
      padding: 40px 20px;
      border-bottom: 2px solid var(--border);
      margin-bottom: 32px;
    }
    h1 { font-size: 32px; color: var(--primary); margin-bottom: 8px; }
    .subtitle { color: var(--accent); font-weight: bold; font-size: 16px; margin-bottom: 12px; }
    .stats-bar {
      display: flex;
      justify-content: center;
      gap: 20px;
      font-size: 13px;
      color: var(--muted);
      flex-wrap: wrap;
    }
    .stop-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 28px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.03);
    }
    .stop-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 12px;
    }
    .stop-num {
      background: var(--secondary);
      color: white;
      font-weight: bold;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
    }
    .stop-title { font-size: 20px; color: var(--primary); font-weight: bold; }
    .stop-meta { font-size: 12px; color: var(--muted); margin-top: 4px; }
    .notes { margin-top: 16px; font-size: 15px; white-space: pre-line; }
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px;
      margin-top: 20px;
    }
    .media-box {
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--border);
      background: #000;
    }
    .media-box img, .media-box video {
      width: 100%;
      height: 200px;
      object-fit: cover;
      display: block;
    }
    .caption {
      padding: 8px 12px;
      font-size: 12px;
      color: var(--muted);
      background: var(--card-bg);
    }
    footer { text-align: center; padding: 40px; color: var(--muted); font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${trip.title}</h1>
      <div class="subtitle">${trip.startDate || ''} ${trip.endDate ? '– ' + trip.endDate : ''}</div>
      <p style="margin-bottom: 16px; color: var(--text);">${trip.description || ''}</p>
      <div class="stats-bar">
        <span>📍 ${tripEntries.length} Stationen</span>
        <span>📸 ${tripEntries.reduce((acc, e) => acc + (e.media?.length || 0), 0)} Aufnahmen</span>
        <span>👥 WanderLog Reisebuch</span>
      </div>
    </header>

    <main id="stops-container"></main>

    <footer>
      Generiert mit <strong>WanderLog</strong> • Druck- und Web-kompatibles Reiseformat
    </footer>
  </div>

  <script>
    const data = ${safeJson};
    const container = document.getElementById('stops-container');

    data.entries.forEach((entry, idx) => {
      const card = document.createElement('article');
      card.className = 'stop-card';

      let mediaHtml = '';
      if (entry.media && entry.media.length > 0) {
        mediaHtml = '<div class="gallery-grid">' + entry.media.map(m => {
          return '<div class="media-box"><img src="' + (m.url || '') + '" alt="' + (m.caption || entry.title) + '" loading="lazy" /><div class="caption">' + (m.caption || 'Foto') + '</div></div>';
        }).join('') + '</div>';
      }

      card.innerHTML = 
        '<div class="stop-header">' +
          '<div>' +
            '<div class="stop-title">' + (idx + 1) + '. ' + entry.title + '</div>' +
            '<div class="stop-meta">' + (entry.date || '') + (entry.location?.address ? ' • ' + entry.location.address : '') + '</div>' +
          '</div>' +
          '<span class="stop-num">' + (entry.category || 'Stopp') + '</span>' +
        '</div>' +
        '<div class="notes">' + (entry.notes || '') + '</div>' +
        mediaHtml;

      container.appendChild(card);
    });
  </script>
</body>
</html>`;
}

/**
 * Creates and downloads a complete ZIP archive with all photos and standard metadata files
 */
export async function exportTripMediaZip(
  trip: Trip,
  entries: JournalEntry[],
  options: MediaExportOptions
): Promise<{ blob: Blob; filename: string }> {
  const { onProgress } = options;
  const zip = new JSZip();
  const tripEntries = entries.filter((e) => e.tripId === trip.id);

  onProgress?.(5, 'Erstelle ZIP-Archivstruktur...');

  const allMediaItems: { media: MediaItem; entry: JournalEntry; stopIndex: number; mediaIndex: number }[] = [];

  tripEntries.forEach((entry, eIdx) => {
    (entry.media || []).forEach((media, mIdx) => {
      allMediaItems.push({
        media,
        entry,
        stopIndex: eIdx + 1,
        mediaIndex: mIdx + 1,
      });
    });
  });

  const totalMedia = allMediaItems.length;

  // Process all media files
  for (let i = 0; i < totalMedia; i++) {
    const item = allMediaItems[i];
    const pct = 10 + Math.round(((i + 1) / totalMedia) * 70);
    onProgress?.(pct, `Packe Foto ${i + 1} von ${totalMedia} ("${item.entry.title}")...`);

    const realUrl = await storage.hydrateMediaUrl(item.media);
    if (!realUrl) continue;

    const ext = 'jpg';
    const safeStopTitle = item.entry.title.replace(/[^a-z0-9_-]/gi, '_');
    const safeDate = (item.entry.date || 'datum').replace(/[^a-z0-9_-]/gi, '_');
    const stopPrefix = String(item.stopIndex).padStart(2, '0');
    const mediaPrefix = String(item.mediaIndex).padStart(2, '0');

    let filePath = '';
    if (options.folderStructure === 'by_stop') {
      const folderName = `Fotos/${stopPrefix}_${safeStopTitle}`;
      const fileName = `${mediaPrefix}_${item.media.caption ? item.media.caption.replace(/[^a-z0-9_-]/gi, '_') : 'Foto'}.${ext}`;
      filePath = `${folderName}/${fileName}`;
    } else if (options.folderStructure === 'by_date') {
      const folderName = `Fotos/${safeDate}`;
      const fileName = `${stopPrefix}_${mediaPrefix}_${safeStopTitle}.${ext}`;
      filePath = `${folderName}/${fileName}`;
    } else {
      // Flat
      filePath = `Fotos/${stopPrefix}_${safeDate}_${safeStopTitle}_${mediaPrefix}.${ext}`;
    }

    try {
      if (realUrl.startsWith('data:')) {
        const base64Data = realUrl.split(',')[1];
        zip.file(filePath, base64Data, { base64: true });
      } else {
        const response = await fetch(realUrl, { mode: 'cors' });
        const blob = await response.blob();
        zip.file(filePath, blob);
      }
    } catch (err) {
      console.warn(`Could not add media ${filePath} to ZIP:`, err);
    }
  }

  // ----------------------------------------------------
  // Include Standard Metadata & Auxiliary Format Files
  // ----------------------------------------------------
  onProgress?.(85, 'Erstelle standardisierte Metadaten- & Katalogdateien...');

  // 1. JSON Metadata (Dublin Core / Schema.org Standard)
  if (options.includeMetadataJson) {
    const metadataJson = {
      trip,
      entries: tripEntries,
      exportedAt: new Date().toISOString(),
      exportFormat: 'WanderLog_DublinCore_JSON_v1',
    };
    zip.file('Metadaten/metadata.json', JSON.stringify(metadataJson, null, 2));
  }

  // 2. CSV EXIF & Travel Stop Catalog
  if (options.includeExifCsv) {
    const csvContent = generateExifCsvCatalog(trip, tripEntries);
    zip.file('Metadaten/exif_katalog.csv', csvContent);
  }

  // 3. GeoJSON (RFC 7946 Standard)
  if (options.includeGeoJson) {
    const geoJsonContent = generateTripGeoJson(trip, tripEntries);
    zip.file('Geodaten/reiseroute.geojson', geoJsonContent);
  }

  // 4. Markdown Journal
  if (options.includeMarkdown) {
    const markdownContent = generateMarkdownJournal(trip, tripEntries);
    zip.file('REISEBERICHT.md', markdownContent);
  }

  // 5. CEWE / Saal Digital Photobook Manifest
  if (options.includeCeweManifest) {
    const ceweManifest = generateCewePhotobookManifest(trip, tripEntries);
    zip.file('Fotobuch_Druckvorlage/cewe_saal_manifest.json', ceweManifest);
  }

  // 6. Standalone Interactive HTML5 Web Book
  if (options.includeStandaloneHtmlBook) {
    const htmlBook = generateStandaloneHtmlBook(trip, tripEntries);
    zip.file('Web_Fotobuch/index.html', htmlBook);
  }

  onProgress?.(95, 'Komprimiere ZIP-Archiv...');

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  onProgress?.(100, 'Export erfolgreich abgeschlossen!');

  const safeTitle = (trip.title || 'Reise').toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
  const filename = `Fotos_${safeTitle}_${new Date().toISOString().split('T')[0]}.zip`;

  return { blob, filename };
}
