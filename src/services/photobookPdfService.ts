import { jsPDF } from 'jspdf';
import { Trip, JournalEntry, MediaItem, Collaborator } from '../types';
import { CATEGORIES } from '../data/initialData';
import { storage } from './storage';
import { formatWeatherSummary } from './weatherService';

export type PhotobookFormat = 'a4_landscape' | 'a4_portrait' | 'square_210';
export type PhotobookTheme = 'classic' | 'modern' | 'vintage' | 'minimal';

export interface PhotobookOptions {
  format: PhotobookFormat;
  theme: PhotobookTheme;
  includeCover: boolean;
  includeTableOfContents: boolean;
  includeNotes: boolean;
  includeWeather: boolean;
  includeGpsCoords: boolean;
  includeExifCameraInfo: boolean;
  includeComments: boolean;
  includeBackCover: boolean;
  maxPhotosPerStop?: number;
  onProgress?: (progress: number, statusText: string) => void;
}

export interface PhotobookDimensions {
  width: number;
  height: number;
  margin: number;
  contentWidth: number;
  contentHeight: number;
  orientation: 'landscape' | 'portrait';
}

export function getDimensionsForFormat(format: PhotobookFormat): PhotobookDimensions {
  switch (format) {
    case 'a4_landscape':
      return {
        width: 297,
        height: 210,
        margin: 16,
        contentWidth: 297 - 32,
        contentHeight: 210 - 32,
        orientation: 'landscape',
      };
    case 'square_210':
      return {
        width: 210,
        height: 210,
        margin: 14,
        contentWidth: 210 - 28,
        contentHeight: 210 - 28,
        orientation: 'portrait',
      };
    case 'a4_portrait':
    default:
      return {
        width: 210,
        height: 297,
        margin: 16,
        contentWidth: 210 - 32,
        contentHeight: 297 - 32,
        orientation: 'portrait',
      };
  }
}

interface ColorPalette {
  primary: [number, number, number];
  secondary: [number, number, number];
  accent: [number, number, number];
  background: [number, number, number];
  cardBg: [number, number, number];
  text: [number, number, number];
  mutedText: [number, number, number];
  border: [number, number, number];
}

export function getThemeColors(theme: PhotobookTheme): ColorPalette {
  switch (theme) {
    case 'modern':
      return {
        primary: [30, 41, 59], // Slate 800
        secondary: [71, 85, 105], // Slate 600
        accent: [14, 165, 233], // Sky 500
        background: [248, 250, 252], // Slate 50
        cardBg: [255, 255, 255],
        text: [15, 23, 42],
        mutedText: [100, 116, 139],
        border: [226, 232, 240],
      };
    case 'vintage':
      return {
        primary: [92, 61, 46], // Deep sepia
        secondary: [138, 99, 78], // Terracotta brown
        accent: [184, 115, 51], // Copper
        background: [250, 246, 238], // Warm parchment
        cardBg: [255, 253, 249],
        text: [61, 43, 31],
        mutedText: [140, 120, 105],
        border: [224, 212, 196],
      };
    case 'minimal':
      return {
        primary: [20, 20, 20],
        secondary: [80, 80, 80],
        accent: [0, 0, 0],
        background: [255, 255, 255],
        cardBg: [250, 250, 250],
        text: [20, 20, 20],
        mutedText: [120, 120, 120],
        border: [230, 230, 230],
      };
    case 'classic':
    default:
      return {
        primary: [78, 59, 49], // Warm WanderLog brown #4E3B31
        secondary: [138, 154, 91], // Olive #8A9A5B
        accent: [226, 114, 91], // Terracotta #E2725B
        background: [253, 251, 247], // #FDFBF7
        cardBg: [255, 255, 255],
        text: [78, 59, 49],
        mutedText: [140, 130, 115],
        border: [229, 225, 216],
      };
  }
}

/**
 * Loads and converts an image URL into a format suitable for jsPDF
 */
async function loadBase64Image(url: string): Promise<{ dataUrl: string; width: number; height: number; format: 'JPEG' | 'PNG' } | null> {
  if (!url) return null;

  // Handle data URLs directly
  if (url.startsWith('data:image/')) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const isPng = url.startsWith('data:image/png');
        resolve({
          dataUrl: url,
          width: img.naturalWidth || 800,
          height: img.naturalHeight || 600,
          format: isPng ? 'PNG' : 'JPEG',
        });
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  // Handle external or blob URLs via canvas
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxDim = 1600; // Optimal size for high print quality without bloating PDF
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          resolve({
            dataUrl,
            width: w,
            height: h,
            format: 'JPEG',
          });
        } else {
          resolve(null);
        }
      } catch (err) {
        console.warn('Could not convert image to dataUrl:', err);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function generatePhotobookPdf(
  trip: Trip,
  entries: JournalEntry[],
  options: PhotobookOptions
): Promise<{ blob: Blob; filename: string }> {
  const { onProgress } = options;
  const dims = getDimensionsForFormat(options.format);
  const colors = getThemeColors(options.theme);

  onProgress?.(5, 'Initialisiere Fotobuch-Dokument...');

  const doc = new jsPDF({
    orientation: dims.orientation,
    unit: 'mm',
    format: options.format === 'square_210' ? [210, 210] : 'a4',
  });

  const tripEntries = entries
    .filter((e) => e.tripId === trip.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let totalPages = 0;
  const pageRegistry: { stopNumber: number; title: string; pageNumber: number; date: string }[] = [];

  const setPageBackground = () => {
    doc.setFillColor(colors.background[0], colors.background[1], colors.background[2]);
    doc.rect(0, 0, dims.width, dims.height, 'F');
  };

  const drawHeaderFooter = (pageNumber: number, totalEstPages: number, pageTitle?: string) => {
    if (pageNumber === 1 && options.includeCover) return; // No header/footer on cover
    
    // Top subtle bar
    doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
    doc.setLineWidth(0.3);
    doc.line(dims.margin, 10, dims.width - dims.margin, 10);

    // Header text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.mutedText[0], colors.mutedText[1], colors.mutedText[2]);
    doc.text(trip.title.toUpperCase(), dims.margin, 8);
    if (pageTitle) {
      doc.text(pageTitle, dims.width - dims.margin, 8, { align: 'right' });
    }

    // Bottom footer line
    doc.line(dims.margin, dims.height - 10, dims.width - dims.margin, dims.height - 10);

    // Footer text
    doc.text('WANDERLOG REISEFOTOBUCH', dims.margin, dims.height - 6);
    doc.text(`Seite ${pageNumber}`, dims.width - dims.margin, dims.height - 6, { align: 'right' });
  };

  // ----------------------------------------------------
  // 1. COVER PAGE
  // ----------------------------------------------------
  if (options.includeCover) {
    onProgress?.(15, 'Gestalte Titelseite (Cover)...');
    setPageBackground();

    // Decorative outer border
    doc.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.setLineWidth(0.8);
    doc.rect(dims.margin - 4, dims.margin - 4, dims.width - (dims.margin - 4) * 2, dims.height - (dims.margin - 4) * 2);

    doc.setDrawColor(colors.accent[0], colors.accent[1], colors.accent[2]);
    doc.setLineWidth(0.3);
    doc.rect(dims.margin - 2, dims.margin - 2, dims.width - (dims.margin - 2) * 2, dims.height - (dims.margin - 2) * 2);

    // Cover Image
    const coverMedia = trip.coverImage || (tripEntries[0]?.media?.[0]?.url);
    if (coverMedia) {
      const coverImg = await loadBase64Image(coverMedia);
      if (coverImg) {
        const imgHeight = dims.orientation === 'landscape' ? 95 : 120;
        const imgWidth = dims.contentWidth;
        const imgX = dims.margin;
        const imgY = dims.margin + 35;

        try {
          doc.addImage(coverImg.dataUrl, coverImg.format, imgX, imgY, imgWidth, imgHeight, undefined, 'FAST');
          // Image border
          doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
          doc.setLineWidth(0.5);
          doc.rect(imgX, imgY, imgWidth, imgHeight);
        } catch (e) {
          console.warn('Cover image render failed:', e);
        }
      }
    }

    // Trip Title
    doc.setFont('times', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.text(trip.title, dims.width / 2, dims.margin + 16, { align: 'center' });

    // Subtitle / Date range
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2]);
    const dateText = trip.startDate
      ? `${new Date(trip.startDate).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}${
          trip.endDate ? ` – ${new Date(trip.endDate).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}` : ''
        }`
      : 'Reisetagebuch & Fotodokumentation';
    doc.text(dateText, dims.width / 2, dims.margin + 26, { align: 'center' });

    // Bottom details
    const bottomY = dims.height - dims.margin - 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(colors.mutedText[0], colors.mutedText[1], colors.mutedText[2]);
    
    const photoCount = tripEntries.reduce((acc, e) => acc + (e.media?.length || 0), 0);
    const summaryText = `${tripEntries.length} Reiseschritte • ${photoCount} Fotografien • Erstellt mit WanderLog`;
    doc.text(summaryText, dims.width / 2, bottomY, { align: 'center' });

    if (trip.collaborators && trip.collaborators.length > 0) {
      const names = trip.collaborators.map((c) => c.name).join(', ');
      doc.setFontSize(8.5);
      doc.text(`Reiseteam: ${names}`, dims.width / 2, bottomY + 6, { align: 'center' });
    }

    totalPages++;
  }

  // ----------------------------------------------------
  // 2. TABLE OF CONTENTS / SUMMARY PAGE
  // ----------------------------------------------------
  if (options.includeTableOfContents && tripEntries.length > 0) {
    onProgress?.(30, 'Erstelle Reiserouten-Übersicht & Inhaltsverzeichnis...');
    doc.addPage();
    totalPages++;
    setPageBackground();
    drawHeaderFooter(totalPages, 0, 'Reiseübersicht & Etappen');

    doc.setFont('times', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.text('Reiseroute & Inhaltsverzeichnis', dims.margin, dims.margin + 6);

    doc.setDrawColor(colors.accent[0], colors.accent[1], colors.accent[2]);
    doc.setLineWidth(0.8);
    doc.line(dims.margin, dims.margin + 9, dims.margin + 50, dims.margin + 9);

    let startY = dims.margin + 18;
    
    // Stats Summary Box
    doc.setFillColor(colors.cardBg[0], colors.cardBg[1], colors.cardBg[2]);
    doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
    doc.roundedRect(dims.margin, startY, dims.contentWidth, 20, 2, 2, 'FD');

    const totalDistanceKm = trip.tracks?.reduce((acc, t) => acc + (t.summary?.totalDistanceKm || 0), 0) || 0;
    const totalElevationM = trip.tracks?.reduce((acc, t) => acc + (t.summary?.elevationGainM || 0), 0) || 0;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.text(`STATIONEN: ${tripEntries.length}`, dims.margin + 8, startY + 8);
    doc.text(`FOTOS: ${tripEntries.reduce((acc, e) => acc + (e.media?.length || 0), 0)}`, dims.margin + 50, startY + 8);
    if (totalDistanceKm > 0) {
      doc.text(`TRACK-DISTANZ: ${totalDistanceKm.toFixed(1)} km`, dims.margin + 90, startY + 8);
    }
    if (totalElevationM > 0) {
      doc.text(`HÖHENMETER: +${Math.round(totalElevationM)} m`, dims.margin + 145, startY + 8);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.mutedText[0], colors.mutedText[1], colors.mutedText[2]);
    if (trip.description) {
      const descLines = doc.splitTextToSize(trip.description, dims.contentWidth - 16);
      doc.text(descLines.slice(0, 2), dims.margin + 8, startY + 14);
    } else {
      doc.text('Chronologische Übersicht aller Reiseschritte und besuchten Orte.', dims.margin + 8, startY + 14);
    }

    startY += 28;

    // Etappenliste
    const cols = dims.orientation === 'landscape' ? 2 : 1;
    const colWidth = cols === 2 ? (dims.contentWidth - 10) / 2 : dims.contentWidth;

    tripEntries.slice(0, 24).forEach((entry, idx) => {
      const colIndex = cols === 2 ? idx % 2 : 0;
      const rowIndex = cols === 2 ? Math.floor(idx / 2) : idx;
      const currentX = dims.margin + colIndex * (colWidth + 10);
      const currentY = startY + rowIndex * 9;

      if (currentY > dims.height - 25) return;

      const dateStr = entry.date ? new Date(entry.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '';
      const stopNum = String(idx + 1).padStart(2, '0');

      // Stop badge
      doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      doc.roundedRect(currentX, currentY - 3.5, 6, 5, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text(stopNum, currentX + 3, currentY, { align: 'center' });

      // Title & Date
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
      const truncatedTitle = entry.title.length > 28 ? `${entry.title.slice(0, 26)}...` : entry.title;
      doc.text(truncatedTitle, currentX + 8, currentY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(colors.mutedText[0], colors.mutedText[1], colors.mutedText[2]);
      doc.text(dateStr, currentX + colWidth - 8, currentY, { align: 'right' });
    });
  }

  // ----------------------------------------------------
  // 3. STOP PAGES (ONE OR MORE STOPS PER PAGE)
  // ----------------------------------------------------
  const totalEntries = tripEntries.length;
  for (let i = 0; i < totalEntries; i++) {
    const entry = tripEntries[i];
    const progressPct = 35 + Math.round(((i + 1) / totalEntries) * 55);
    onProgress?.(progressPct, `Generiere Fotobuchseite für "${entry.title}" (${i + 1}/${totalEntries})...`);

    doc.addPage();
    totalPages++;
    setPageBackground();
    drawHeaderFooter(totalPages, 0, entry.title);

    pageRegistry.push({
      stopNumber: i + 1,
      title: entry.title,
      pageNumber: totalPages,
      date: entry.date,
    });

    const pageContentTop = dims.margin + 4;

    // Category Info
    const cat = CATEGORIES.find((c) => c.id === entry.category) || CATEGORIES[0];
    const dateFormatted = entry.date
      ? new Date(entry.date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
      : '';

    // Stop Header Banner
    doc.setFillColor(colors.cardBg[0], colors.cardBg[1], colors.cardBg[2]);
    doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
    doc.roundedRect(dims.margin, pageContentTop, dims.contentWidth, 18, 2, 2, 'FD');

    // Stop number circle
    doc.setFillColor(colors.accent[0], colors.accent[1], colors.accent[2]);
    doc.circle(dims.margin + 8, pageContentTop + 9, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(String(i + 1), dims.margin + 8, pageContentTop + 12, { align: 'center' });

    // Stop title
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.text(entry.title, dims.margin + 18, pageContentTop + 8);

    // Meta details (Date, Category, Location)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.mutedText[0], colors.mutedText[1], colors.mutedText[2]);
    let metaText = `${dateFormatted} • ${cat.label}`;
    if (entry.locationName) {
      metaText += ` • ${entry.locationName.split(',')[0]}`;
    }
    doc.text(metaText, dims.margin + 18, pageContentTop + 14);

    // Weather badge in header if enabled
    if (options.includeWeather && entry.weather) {
      const weatherSummary = formatWeatherSummary(entry.weather);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2]);
      doc.text(weatherSummary, dims.width - dims.margin - 4, pageContentTop + 11, { align: 'right' });
    }

    let currentY = pageContentTop + 22;

    // Collect photos for this stop
    const validMedia = (entry.media || [])
      .slice(0, options.maxPhotosPerStop || 4);

    // Load images
    const loadedImages: { img: { dataUrl: string; width: number; height: number; format: 'JPEG' | 'PNG' }; media: MediaItem }[] = [];
    for (const media of validMedia) {
      const urlToLoad = await storage.hydrateMediaUrl(media);
      if (urlToLoad) {
        const loaded = await loadBase64Image(urlToLoad);
        if (loaded) {
          loadedImages.push({ img: loaded, media });
        }
      }
    }

    // Determine layout based on orientation and image count
    const hasImages = loadedImages.length > 0;

    if (dims.orientation === 'landscape') {
      // Landscape: Left side images, Right side text & notes (or full grid)
      const leftColWidth = hasImages ? (dims.contentWidth * 0.58) : 0;
      const rightColWidth = hasImages ? (dims.contentWidth * 0.39) : dims.contentWidth;
      const rightColX = dims.margin + leftColWidth + (hasImages ? dims.contentWidth * 0.03 : 0);

      // Render Images
      if (hasImages) {
        const imgBoxHeight = dims.contentHeight - 35;
        if (loadedImages.length === 1) {
          // 1 Image: Large hero
          const item = loadedImages[0];
          const imgH = Math.min(imgBoxHeight, leftColWidth * (item.img.height / item.img.width));
          try {
            doc.addImage(item.img.dataUrl, item.img.format, dims.margin, currentY, leftColWidth, imgH, undefined, 'FAST');
            doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
            doc.setLineWidth(0.3);
            doc.rect(dims.margin, currentY, leftColWidth, imgH);

            if (item.media.caption) {
              doc.setFont('helvetica', 'italic');
              doc.setFontSize(7.5);
              doc.setTextColor(colors.mutedText[0], colors.mutedText[1], colors.mutedText[2]);
              doc.text(item.media.caption, dims.margin + 2, currentY + imgH + 4);
            }
          } catch (e) {
            console.warn('Error rendering image:', e);
          }
        } else if (loadedImages.length === 2) {
          // 2 Images stacked or side by side
          const halfH = (imgBoxHeight - 6) / 2;
          loadedImages.forEach((item, imgIdx) => {
            const imgY = currentY + imgIdx * (halfH + 6);
            try {
              doc.addImage(item.img.dataUrl, item.img.format, dims.margin, imgY, leftColWidth, halfH, undefined, 'FAST');
              doc.rect(dims.margin, imgY, leftColWidth, halfH);
            } catch (e) {
              console.warn('Error rendering image:', e);
            }
          });
        } else {
          // 3 or 4 Images: 2x2 grid
          const cellW = (leftColWidth - 4) / 2;
          const cellH = (imgBoxHeight - 6) / 2;
          loadedImages.slice(0, 4).forEach((item, imgIdx) => {
            const gx = dims.margin + (imgIdx % 2) * (cellW + 4);
            const gy = currentY + Math.floor(imgIdx / 2) * (cellH + 6);
            try {
              doc.addImage(item.img.dataUrl, item.img.format, gx, gy, cellW, cellH, undefined, 'FAST');
              doc.rect(gx, gy, cellW, cellH);
            } catch (e) {
              console.warn('Error rendering grid image:', e);
            }
          });
        }
      }

      // Right Column: Notes & Details
      let noteY = currentY;
      
      // GPS & EXIF Info Badge
      if (options.includeGpsCoords && entry.coordinates) {
        const { lat, lng } = entry.coordinates;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(colors.mutedText[0], colors.mutedText[1], colors.mutedText[2]);
        doc.text(`GPS: ${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`, rightColX, noteY);
        noteY += 6;
      }

      // Notes text
      if (options.includeNotes && entry.note) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
        const splitNotes = doc.splitTextToSize(entry.note, rightColWidth);
        doc.text(splitNotes, rightColX, noteY);
        noteY += splitNotes.length * 4.5 + 6;
      }

      // Track Activity Info
      if (entry.track?.summary) {
        const summ = entry.track.summary;
        doc.setFillColor(colors.cardBg[0], colors.cardBg[1], colors.cardBg[2]);
        doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
        doc.roundedRect(rightColX, noteY, rightColWidth, 16, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        doc.text(`Aktivität: ${summ.sport || 'Tour'}`, rightColX + 4, noteY + 5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(`Distanz: ${(summ.totalDistanceKm || 0).toFixed(1)} km • Anstieg: +${Math.round(summ.elevationGainM || 0)} m • Zeit: ${Math.round((summ.totalDurationSec || 0) / 60)} min`, rightColX + 4, noteY + 11);
        noteY += 20;
      }

      // Comments from Companions
      if (options.includeComments && entry.comments && entry.comments.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2]);
        doc.text('Notizen & Kommentare von Mitreisenden:', rightColX, noteY);
        noteY += 4;

        entry.comments.slice(0, 3).forEach((comm) => {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(colors.mutedText[0], colors.mutedText[1], colors.mutedText[2]);
          const commText = `• ${comm.author?.name || 'Mitreisender'}: "${comm.text}"`;
          const commLines = doc.splitTextToSize(commText, rightColWidth);
          doc.text(commLines, rightColX, noteY);
          noteY += commLines.length * 3.5 + 2;
        });
      }
    } else {
      // Portrait / Square: Top image area, bottom text area
      let imgAreaHeight = hasImages ? 110 : 0;
      if (options.format === 'square_210') imgAreaHeight = hasImages ? 90 : 0;

      if (hasImages) {
        if (loadedImages.length === 1) {
          const item = loadedImages[0];
          try {
            doc.addImage(item.img.dataUrl, item.img.format, dims.margin, currentY, dims.contentWidth, imgAreaHeight, undefined, 'FAST');
            doc.rect(dims.margin, currentY, dims.contentWidth, imgAreaHeight);
          } catch (e) {
            console.warn('Portrait image render error:', e);
          }
        } else if (loadedImages.length === 2) {
          const halfW = (dims.contentWidth - 4) / 2;
          loadedImages.forEach((item, imgIdx) => {
            const ix = dims.margin + imgIdx * (halfW + 4);
            try {
              doc.addImage(item.img.dataUrl, item.img.format, ix, currentY, halfW, imgAreaHeight, undefined, 'FAST');
              doc.rect(ix, currentY, halfW, imgAreaHeight);
            } catch (e) {
              console.warn('Portrait 2-image render error:', e);
            }
          });
        } else {
          // 3 or 4 images
          const halfW = (dims.contentWidth - 4) / 2;
          const halfH = (imgAreaHeight - 4) / 2;
          loadedImages.slice(0, 4).forEach((item, imgIdx) => {
            const ix = dims.margin + (imgIdx % 2) * (halfW + 4);
            const iy = currentY + Math.floor(imgIdx / 2) * (halfH + 4);
            try {
              doc.addImage(item.img.dataUrl, item.img.format, ix, iy, halfW, halfH, undefined, 'FAST');
              doc.rect(ix, iy, halfW, halfH);
            } catch (e) {
              console.warn('Portrait grid render error:', e);
            }
          });
        }
      }

      let textY = currentY + imgAreaHeight + 8;

      if (options.includeNotes && entry.note) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
        const lines = doc.splitTextToSize(entry.note, dims.contentWidth);
        doc.text(lines.slice(0, 14), dims.margin, textY);
        textY += Math.min(lines.length, 14) * 4.5 + 4;
      }
    }
  }

  // ----------------------------------------------------
  // 4. BACK COVER / CLOSING PAGE
  // ----------------------------------------------------
  if (options.includeBackCover) {
    onProgress?.(95, 'Erstelle Abschlussseite...');
    doc.addPage();
    totalPages++;
    setPageBackground();

    doc.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.setLineWidth(0.6);
    doc.rect(dims.margin, dims.margin, dims.contentWidth, dims.contentHeight);

    doc.setFont('times', 'italic');
    doc.setFontSize(16);
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.text('„Die gefährlichste aller Weltanschauungen ist die Weltanschauung der Leute,', dims.width / 2, dims.height / 2 - 16, { align: 'center' });
    doc.text('die die Welt nicht angeschaut haben.“', dims.width / 2, dims.height / 2 - 8, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2]);
    doc.text('– Alexander von Humboldt', dims.width / 2, dims.height / 2, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(colors.mutedText[0], colors.mutedText[1], colors.mutedText[2]);
    doc.text(`WanderLog Reisefotobuch für "${trip.title}"`, dims.width / 2, dims.height - dims.margin - 16, { align: 'center' });
    doc.text('Erstellt mit modernsten Druckstandards (A4/Square PDF/X kompatibel)', dims.width / 2, dims.height - dims.margin - 10, { align: 'center' });
  }

  onProgress?.(100, 'PDF-Generierung abgeschlossen!');

  const blob = doc.output('blob');
  const safeTitle = (trip.title || 'Reise').toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
  const filename = `Fotobuch_${safeTitle}_${new Date().toISOString().split('T')[0]}.pdf`;

  return { blob, filename };
}
