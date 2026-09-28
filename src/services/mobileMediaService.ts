import exifr from 'exifr';
import { Coordinates, MediaItem } from '../types';
import { indexedDbStorage } from './indexedDbStorage';
import { formatFileSize } from '../utils/formatters';

export interface ProcessedMediaResult {
  mediaItem: MediaItem;
  exifGps?: Coordinates;
  exifDate?: string;
  deviceModel?: string;
  hasGps: boolean;
}

export interface DeviceInfo {
  type: 'ios' | 'android' | 'desktop';
  platformName: string;
  isMobile: boolean;
}

/**
 * Detects device OS (iPhone, iPad, Android, Desktop)
 */
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      type: 'desktop',
      platformName: 'Computer / Desktop',
      isMobile: false,
    };
  }

  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isMobile = isIOS || isAndroid || /Mobi|Tablet|Touch/.test(ua);

  let platformName = 'Desktop Browser';
  let type: 'ios' | 'android' | 'desktop' = 'desktop';

  if (isIOS) {
    type = 'ios';
    platformName = /iPhone/.test(ua) ? 'Apple iPhone' : /iPad/.test(ua) ? 'Apple iPad' : 'iOS Gerät';
  } else if (isAndroid) {
    type = 'android';
    platformName = 'Android Smartphone';
  }

  return {
    type,
    platformName,
    isMobile,
  };
}

/**
 * Map known Android model strings (e.g. SM-S928B -> Samsung Galaxy S24 Ultra, Pixel 8...)
 * to clean, readable device descriptions.
 */
export function formatDeviceModelName(make?: string, model?: string): string | undefined {
  if (!model && !make) return undefined;
  const rawModel = (model || '').trim();
  const rawMake = (make || '').trim();

  // Known Samsung SM- Model Mappings
  if (/SM-S938/i.test(rawModel)) return 'Samsung Galaxy S25 Ultra';
  if (/SM-S931/i.test(rawModel)) return 'Samsung Galaxy S25';
  if (/SM-S928/i.test(rawModel)) return 'Samsung Galaxy S24 Ultra';
  if (/SM-S926/i.test(rawModel)) return 'Samsung Galaxy S24+';
  if (/SM-S921/i.test(rawModel)) return 'Samsung Galaxy S24';
  if (/SM-S918/i.test(rawModel)) return 'Samsung Galaxy S23 Ultra';
  if (/SM-S916/i.test(rawModel)) return 'Samsung Galaxy S23+';
  if (/SM-S911/i.test(rawModel)) return 'Samsung Galaxy S23';
  if (/SM-S908/i.test(rawModel)) return 'Samsung Galaxy S22 Ultra';
  if (/SM-G998/i.test(rawModel)) return 'Samsung Galaxy S21 Ultra';
  if (/SM-G991/i.test(rawModel)) return 'Samsung Galaxy S21';
  if (/SM-F946/i.test(rawModel)) return 'Samsung Galaxy Z Fold5';
  if (/SM-F731/i.test(rawModel)) return 'Samsung Galaxy Z Flip5';
  if (/SM-A556/i.test(rawModel)) return 'Samsung Galaxy A55 5G';
  if (/SM-A546/i.test(rawModel)) return 'Samsung Galaxy A54 5G';
  if (/SM-A536/i.test(rawModel)) return 'Samsung Galaxy A53 5G';
  if (/SM-A346/i.test(rawModel)) return 'Samsung Galaxy A34 5G';

  // Google Pixel Models
  if (/Pixel 9 Pro/i.test(rawModel)) return 'Google Pixel 9 Pro';
  if (/Pixel 9/i.test(rawModel)) return 'Google Pixel 9';
  if (/Pixel 8 Pro/i.test(rawModel)) return 'Google Pixel 8 Pro';
  if (/Pixel 8a/i.test(rawModel)) return 'Google Pixel 8a';
  if (/Pixel 8/i.test(rawModel)) return 'Google Pixel 8';
  if (/Pixel 7 Pro/i.test(rawModel)) return 'Google Pixel 7 Pro';
  if (/Pixel 7a/i.test(rawModel)) return 'Google Pixel 7a';
  if (/Pixel 7/i.test(rawModel)) return 'Google Pixel 7';
  if (/Pixel 6 Pro/i.test(rawModel)) return 'Google Pixel 6 Pro';
  if (/Pixel 6/i.test(rawModel)) return 'Google Pixel 6';

  // Combine make and model if model doesn't already contain make
  if (rawModel) {
    if (rawMake && !rawModel.toLowerCase().includes(rawMake.toLowerCase())) {
      // Capitalize make
      const formattedMake = rawMake.charAt(0).toUpperCase() + rawMake.slice(1);
      return `${formattedMake} ${rawModel}`;
    }
    return rawModel;
  }

  return rawMake || undefined;
}

/**
 * Helper to convert Degrees/Minutes/Seconds or various EXIF formats to decimal degrees
 */
export function convertDmsToDecimal(dms: unknown, ref?: string): number | undefined {
  if (dms === null || dms === undefined) return undefined;

  // Direct number
  if (typeof dms === 'number' && !isNaN(dms)) {
    if (ref === 'S' || ref === 'W') return -Math.abs(dms);
    return Number(dms.toFixed(6));
  }

  // Array of numbers or rational objects
  if (Array.isArray(dms) && dms.length > 0) {
    const parsePart = (val: unknown): number => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseFloat(val) || 0;
      if (val && typeof val === 'object') {
        if ('numerator' in val && 'denominator' in val) {
          const rat = val as { numerator: number; denominator: number };
          return rat.denominator !== 0 ? rat.numerator / rat.denominator : 0;
        }
        if (typeof (val as { valueOf?: () => unknown }).valueOf === 'function') {
          const num = Number((val as { valueOf: () => unknown }).valueOf());
          if (!isNaN(num)) return num;
        }
      }
      return 0;
    };

    const deg = parsePart(dms[0]);
    const min = parsePart(dms[1]);
    const sec = parsePart(dms[2]);

    let dd = deg + min / 60 + sec / 3600;
    if (ref === 'S' || ref === 'W') {
      dd = -Math.abs(dd);
    }
    return isNaN(dd) || (deg === 0 && min === 0 && sec === 0) ? undefined : Number(dd.toFixed(6));
  }

  // String format (e.g. "52.5200" or "52/1, 31/1, 12000/1000")
  if (typeof dms === 'string') {
    const clean = dms.trim();
    // Check if it's a comma-separated list of rationals
    if (clean.includes(',')) {
      const parts = clean.split(',').map((p) => {
        const subParts = p.trim().split('/');
        if (subParts.length === 2) {
          const n = parseFloat(subParts[0]);
          const d = parseFloat(subParts[1]);
          return d !== 0 ? n / d : 0;
        }
        return parseFloat(p.trim()) || 0;
      });
      return convertDmsToDecimal(parts, ref);
    }

    const parsed = parseFloat(clean);
    if (!isNaN(parsed)) {
      if (ref === 'S' || ref === 'W') return -Math.abs(parsed);
      return Number(parsed.toFixed(6));
    }
  }

  return undefined;
}

/**
 * Parses EXIF datetime strings robustly.
 * Handles EXIF standard format (YYYY:MM:DD HH:MM:SS), ISO strings, timestamps, and Android specific formats.
 */
export function parseExifDateString(rawDate: unknown): string | undefined {
  if (!rawDate) return undefined;

  // 1. Direct Date object
  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
    return rawDate.toISOString();
  }

  // 2. Numeric timestamp (seconds or milliseconds)
  if (typeof rawDate === 'number' && !isNaN(rawDate) && rawDate > 0) {
    const ts = rawDate < 10000000000 ? rawDate * 1000 : rawDate;
    const d = new Date(ts);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2000) {
      return d.toISOString();
    }
  }

  // 3. String representation
  if (typeof rawDate === 'string') {
    const trimmed = rawDate.trim();
    if (!trimmed || trimmed === '0000:00:00 00:00:00') return undefined;

    // Pattern A: Standard EXIF "YYYY:MM:DD HH:MM:SS" (or with hyphens / slashes / milliseconds / timezone)
    const exifMatch = trimmed.match(
      /^(\d{4})[:/-](\d{2})[:/-](\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?(.*)$/
    );
    if (exifMatch) {
      const [, y, m, d, hh, mm, ss, ms, tz] = exifMatch;
      const cleanIso = `${y}-${m}-${d}T${hh}:${mm}:${ss || '00'}${ms ? `.${ms.slice(0, 3)}` : ''}${tz ? tz.trim() : ''}`;
      const dt = new Date(cleanIso);
      if (!isNaN(dt.getTime())) {
        return dt.toISOString();
      }
      // If timezone format was incompatible, try standard UTC/local
      const dtFallback = new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss || '00'}`);
      if (!isNaN(dtFallback.getTime())) {
        return dtFallback.toISOString();
      }
    }

    // Pattern B: Date only "YYYY:MM:DD"
    const dateOnlyMatch = trimmed.match(/^(\d{4})[:/-](\d{2})[:/-](\d{2})$/);
    if (dateOnlyMatch) {
      const [, y, m, d] = dateOnlyMatch;
      const dt = new Date(`${y}-${m}-${d}T12:00:00.000Z`);
      if (!isNaN(dt.getTime())) {
        return dt.toISOString();
      }
    }

    // Pattern C: Standard ISO date string
    const standardParsed = new Date(trimmed);
    if (!isNaN(standardParsed.getTime()) && standardParsed.getFullYear() >= 2000) {
      return standardParsed.toISOString();
    }
  }

  return undefined;
}

/**
 * Extracts date & time from Android and iOS photo filenames (e.g. PXL_20240829_143022123.jpg, IMG_20240829_143022.jpg, 20240829_143022.jpg, 1724941822000.jpg...)
 */
export function extractDateFromFilename(filename: string): string | undefined {
  if (!filename) return undefined;
  try {
    const clean = filename.trim();

    // 1. Android Camera standard: PXL_20240829_143022, IMG_20240829_143022, 20240829_143022, VID_20240829_143022...
    const fullMatch = clean.match(
      /(?:PXL_|IMG_|VID_|PHOTO_|Screenshot_|WP_|AUD_)?(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[-_T\s]?(?:([01]\d|2[0-3])([0-5]\d)([0-5]\d))?/i
    );
    if (fullMatch) {
      const [, y, m, d, hh, mm, ss] = fullMatch;
      const year = parseInt(y, 10);
      const month = parseInt(m, 10) - 1;
      const day = parseInt(d, 10);
      const hour = hh ? parseInt(hh, 10) : 12;
      const minute = mm ? parseInt(mm, 10) : 0;
      const second = ss ? parseInt(ss, 10) : 0;

      const dateObj = new Date(Date.UTC(year, month, day, hour, minute, second));
      if (!isNaN(dateObj.getTime()) && year >= 2000 && dateObj.getTime() <= Date.now() + 86400000) {
        return dateObj.toISOString();
      }
    }

    // 2. Format with dashes or dots: 2024-08-29 or 2024.08.29 or 2024_08_29 (with optional time)
    const dashedMatch = clean.match(
      /(20\d{2})[-_.](0[1-9]|1[0-2])[-_.](0[1-9]|[12]\d|3[01])(?:[-_.T\s]([01]\d|2[0-3])[-_.:]([0-5]\d)(?:[-_.:]([0-5]\d))?)?/
    );
    if (dashedMatch) {
      const [, y, m, d, hh, mm, ss] = dashedMatch;
      const year = parseInt(y, 10);
      const month = parseInt(m, 10) - 1;
      const day = parseInt(d, 10);
      const hour = hh ? parseInt(hh, 10) : 12;
      const minute = mm ? parseInt(mm, 10) : 0;
      const second = ss ? parseInt(ss, 10) : 0;

      const dateObj = new Date(Date.UTC(year, month, day, hour, minute, second));
      if (!isNaN(dateObj.getTime()) && year >= 2000 && dateObj.getTime() <= Date.now() + 86400000) {
        return dateObj.toISOString();
      }
    }

    // 3. Android Unix timestamp in filename: e.g. 1724941822000 or 1724941822
    const unixMatch = clean.match(/\b(1[5-7]\d{8}(?:\d{3})?)\b/);
    if (unixMatch) {
      let ts = parseInt(unixMatch[1], 10);
      if (ts < 10000000000) ts *= 1000;
      const dateObj = new Date(ts);
      if (!isNaN(dateObj.getTime()) && dateObj.getFullYear() >= 2015 && ts <= Date.now() + 86400000) {
        return dateObj.toISOString();
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Binary JPEG APP1/EXIF parser for ultra-fast and direct metadata extraction.
 * Guarantees extraction of GPS and timestamps on Android even if third-party modules fail.
 */
export function parseBinaryExif(buffer: ArrayBuffer): {
  gps?: Coordinates;
  date?: string;
  deviceModel?: string;
} | null {
  try {
    const dataView = new DataView(buffer);
    const length = buffer.byteLength;

    // Check for JPEG SOI marker (0xFF 0xD8)
    if (length < 12 || dataView.getUint16(0) !== 0xffd8) {
      return null;
    }

    let offset = 2;
    while (offset + 4 < length) {
      const marker = dataView.getUint16(offset);
      offset += 2;

      // SOS (Start of Scan) or EOI (End of Image) -> Stop scanning headers
      if (marker === 0xffda || marker === 0xffd9) {
        break;
      }

      const segmentLength = dataView.getUint16(offset);
      if (segmentLength < 2 || offset + segmentLength > length) {
        break;
      }

      // APP1 Marker (0xFF 0xE1) -> Check for EXIF
      if (marker === 0xffe1) {
        const exifHeader = dataView.getUint32(offset + 2); // 'Exif' = 0x45786966
        const exifZero = dataView.getUint16(offset + 6); // '\0\0' = 0x0000

        if (exifHeader === 0x45786966 && exifZero === 0x0000) {
          const tiffStart = offset + 8;
          const endianMarker = dataView.getUint16(tiffStart);
          const littleEndian = endianMarker === 0x4949; // 'II'

          const ifd0Offset = dataView.getUint32(tiffStart + 4, littleEndian);
          if (tiffStart + ifd0Offset + 2 > length) break;

          let gpsOffset: number | null = null;
          let exifSubIfdOffset: number | null = null;
          let make: string | undefined;
          let model: string | undefined;
          let modifyDate: string | undefined;

          // Read IFD0 entries
          const ifd0Count = dataView.getUint16(tiffStart + ifd0Offset, littleEndian);
          let currentEntryOffset = tiffStart + ifd0Offset + 2;

          for (let i = 0; i < ifd0Count && currentEntryOffset + 12 <= length; i++) {
            const tag = dataView.getUint16(currentEntryOffset, littleEndian);
            const count = dataView.getUint32(currentEntryOffset + 4, littleEndian);
            const valueOffset = currentEntryOffset + 8;

            if (tag === 0x8825) {
              // GPS IFD Pointer
              gpsOffset = dataView.getUint32(valueOffset, littleEndian);
            } else if (tag === 0x8769) {
              // Exif SubIFD Pointer
              exifSubIfdOffset = dataView.getUint32(valueOffset, littleEndian);
            } else if (tag === 0x010f) {
              // Make
              const strOffset = count > 4 ? tiffStart + dataView.getUint32(valueOffset, littleEndian) : valueOffset;
              make = readAsciiString(dataView, strOffset, count);
            } else if (tag === 0x0110) {
              // Model
              const strOffset = count > 4 ? tiffStart + dataView.getUint32(valueOffset, littleEndian) : valueOffset;
              model = readAsciiString(dataView, strOffset, count);
            } else if (tag === 0x0132) {
              // ModifyDate
              const strOffset = count > 4 ? tiffStart + dataView.getUint32(valueOffset, littleEndian) : valueOffset;
              modifyDate = readAsciiString(dataView, strOffset, count);
            }

            currentEntryOffset += 12;
          }

          let dateOriginal: string | undefined;

          // Read Exif SubIFD for DateTimeOriginal & CreateDate
          if (exifSubIfdOffset && tiffStart + exifSubIfdOffset + 2 <= length) {
            const subIfdCount = dataView.getUint16(tiffStart + exifSubIfdOffset, littleEndian);
            let subEntryOffset = tiffStart + exifSubIfdOffset + 2;

            for (let i = 0; i < subIfdCount && subEntryOffset + 12 <= length; i++) {
              const tag = dataView.getUint16(subEntryOffset, littleEndian);
              const count = dataView.getUint32(subEntryOffset + 4, littleEndian);
              const valueOffset = subEntryOffset + 8;

              if (tag === 0x9003 || tag === 0x9004) {
                // DateTimeOriginal or CreateDate
                const strOffset = count > 4 ? tiffStart + dataView.getUint32(valueOffset, littleEndian) : valueOffset;
                const dStr = readAsciiString(dataView, strOffset, count);
                if (dStr && !dateOriginal) {
                  dateOriginal = dStr;
                }
              }
              subEntryOffset += 12;
            }
          }

          let gpsCoords: Coordinates | undefined;

          // Read GPS IFD for Latitude & Longitude
          if (gpsOffset && tiffStart + gpsOffset + 2 <= length) {
            const gpsCount = dataView.getUint16(tiffStart + gpsOffset, littleEndian);
            let gpsEntryOffset = tiffStart + gpsOffset + 2;

            let latRef = 'N';
            let lngRef = 'E';
            let rawLat: number[] | null = null;
            let rawLng: number[] | null = null;

            for (let i = 0; i < gpsCount && gpsEntryOffset + 12 <= length; i++) {
              const tag = dataView.getUint16(gpsEntryOffset, littleEndian);
              const count = dataView.getUint32(gpsEntryOffset + 4, littleEndian);
              const valueOffset = gpsEntryOffset + 8;

              if (tag === 0x0001) {
                // GPSLatitudeRef
                latRef = String.fromCharCode(dataView.getUint8(valueOffset)).toUpperCase();
              } else if (tag === 0x0002) {
                // GPSLatitude (3 Rationals)
                const ratOffset = tiffStart + dataView.getUint32(valueOffset, littleEndian);
                rawLat = readRationals(dataView, ratOffset, count, littleEndian);
              } else if (tag === 0x0003) {
                // GPSLongitudeRef
                lngRef = String.fromCharCode(dataView.getUint8(valueOffset)).toUpperCase();
              } else if (tag === 0x0004) {
                // GPSLongitude (3 Rationals)
                const ratOffset = tiffStart + dataView.getUint32(valueOffset, littleEndian);
                rawLng = readRationals(dataView, ratOffset, count, littleEndian);
              }

              gpsEntryOffset += 12;
            }

            if (rawLat && rawLng && rawLat.length >= 3 && rawLng.length >= 3) {
              const lat = convertDmsToDecimal(rawLat, latRef);
              const lng = convertDmsToDecimal(rawLng, lngRef);
              if (lat !== undefined && lng !== undefined) {
                gpsCoords = { lat, lng };
              }
            }
          }

          const parsedDate = parseExifDateString(dateOriginal || modifyDate);
          const deviceName = formatDeviceModelName(make, model);

          if (gpsCoords || parsedDate || deviceName) {
            return {
              gps: gpsCoords,
              date: parsedDate,
              deviceModel: deviceName,
            };
          }
        }
      }

      offset += segmentLength;
    }
  } catch (err) {
    console.debug('[mobileMediaService] Binary EXIF parse note:', err);
  }
  return null;
}

function readAsciiString(dataView: DataView, offset: number, count: number): string | undefined {
  if (offset + count > dataView.byteLength) return undefined;
  let str = '';
  for (let i = 0; i < count; i++) {
    const charCode = dataView.getUint8(offset + i);
    if (charCode === 0) break;
    str += String.fromCharCode(charCode);
  }
  const clean = str.trim();
  return clean.length > 0 ? clean : undefined;
}

function readRationals(dataView: DataView, offset: number, count: number, littleEndian: boolean): number[] {
  const result: number[] = [];
  for (let i = 0; i < count && offset + (i + 1) * 8 <= dataView.byteLength; i++) {
    const num = dataView.getUint32(offset + i * 8, littleEndian);
    const den = dataView.getUint32(offset + i * 8 + 4, littleEndian);
    result.push(den !== 0 ? num / den : 0);
  }
  return result;
}

/**
 * Gets live high-accuracy GPS coordinates from the device browser if permission is granted.
 */
export async function getLiveDeviceCoordinates(timeoutMs = 6000): Promise<Coordinates | null> {
  if (typeof window === 'undefined' || !navigator || !navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve({
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
          });
        }
      },
      () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(null);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 30000,
      }
    );
  });
}

/**
 * Extract EXIF metadata (GPS Latitude/Longitude, Capture Date, Camera/Phone Model)
 * with robust multi-layer fallbacks for Android, iPhone, file timestamps, and filenames.
 */
export async function extractExifFromPhoto(file: File): Promise<{
  gps?: Coordinates;
  date?: string;
  deviceModel?: string;
  source?: 'exif' | 'binary' | 'file' | 'filename' | 'live-gps';
}> {
  const result: {
    gps?: Coordinates;
    date?: string;
    deviceModel?: string;
    source?: 'exif' | 'binary' | 'file' | 'filename' | 'live-gps';
  } = {};

  let arrayBuffer: ArrayBuffer | null = null;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (err) {
    console.debug('[mobileMediaService] ArrayBuffer read warning:', err);
  }

  // 1. Layer 1: Dedicated Binary JPEG APP1/EXIF parser (Instant, exact, Android resilient)
  if (arrayBuffer) {
    const binaryParsed = parseBinaryExif(arrayBuffer);
    if (binaryParsed) {
      if (binaryParsed.gps) {
        result.gps = binaryParsed.gps;
        result.source = 'binary';
      }
      if (binaryParsed.date) {
        result.date = binaryParsed.date;
        result.source = result.source || 'binary';
      }
      if (binaryParsed.deviceModel) {
        result.deviceModel = binaryParsed.deviceModel;
      }
    }
  }

  // 2. Layer 2: exifr.parse on ArrayBuffer or File (for HEIC, WebP, PNG, XMP, TIFF, Ultra HDR)
  try {
    const targetSource = arrayBuffer || file;
    const exifData = await exifr.parse(targetSource, {
      tiff: true,
      xmp: true,
      icc: false,
      jfif: true,
      ihdr: true,
      exif: true,
      gps: true,
      iptc: true,
      interop: true,
      multiSegment: true,
      firstChunkSize: 512 * 1024,
      chunkSize: 512 * 1024,
      translateKeys: true,
      translateValues: true,
      reviveValues: true,
      mergeOutput: true,
    });

    if (exifData) {
      // GPS extraction
      if (!result.gps) {
        if (
          typeof exifData.latitude === 'number' &&
          typeof exifData.longitude === 'number' &&
          !isNaN(exifData.latitude) &&
          !isNaN(exifData.longitude) &&
          (exifData.latitude !== 0 || exifData.longitude !== 0)
        ) {
          result.gps = {
            lat: Number(exifData.latitude.toFixed(6)),
            lng: Number(exifData.longitude.toFixed(6)),
          };
          result.source = 'exif';
        } else if (exifData.GPSLatitude && exifData.GPSLongitude) {
          const lat = convertDmsToDecimal(exifData.GPSLatitude, exifData.GPSLatitudeRef);
          const lng = convertDmsToDecimal(exifData.GPSLongitude, exifData.GPSLongitudeRef);
          if (lat !== undefined && lng !== undefined) {
            result.gps = { lat, lng };
            result.source = 'exif';
          }
        }
      }

      // Date extraction
      if (!result.date) {
        const rawDate =
          exifData.DateTimeOriginal ||
          exifData.CreateDate ||
          exifData.ModifyDate ||
          exifData.DateCreated ||
          exifData.DateTime;
        const parsed = parseExifDateString(rawDate);
        if (parsed) {
          result.date = parsed;
          result.source = 'exif';
        }
      }

      // Device Make & Model
      if (!result.deviceModel) {
        const make = exifData.Make ? String(exifData.Make) : '';
        const model = exifData.Model ? String(exifData.Model) : '';
        const formatted = formatDeviceModelName(make, model);
        if (formatted) {
          result.deviceModel = formatted;
        }
      }
    }
  } catch (err) {
    console.debug('[mobileMediaService] exifr full parse note:', err);
  }

  // 3. Layer 3: Direct exifr.gps() fallback
  if (!result.gps) {
    try {
      const gpsResult = await exifr.gps(arrayBuffer || file);
      if (
        gpsResult &&
        typeof gpsResult.latitude === 'number' &&
        typeof gpsResult.longitude === 'number' &&
        !isNaN(gpsResult.latitude) &&
        !isNaN(gpsResult.longitude) &&
        (gpsResult.latitude !== 0 || gpsResult.longitude !== 0)
      ) {
        result.gps = {
          lat: Number(gpsResult.latitude.toFixed(6)),
          lng: Number(gpsResult.longitude.toFixed(6)),
        };
        result.source = result.source || 'exif';
      }
    } catch {
      // ignore
    }
  }

  // 4. Layer 4: Fallback Date from filename (Android standard: PXL_20240829_143022, 20240829_143022...)
  if (!result.date) {
    const filenameDate = extractDateFromFilename(file.name);
    if (filenameDate) {
      result.date = filenameDate;
      result.source = result.source || 'filename';
    }
  }

  // 5. Layer 5: Fallback Date from file.lastModified
  if (!result.date && file.lastModified) {
    const fileDate = new Date(file.lastModified);
    if (!isNaN(fileDate.getTime()) && fileDate.getFullYear() >= 2000 && fileDate.getTime() <= Date.now() + 86400000) {
      result.date = fileDate.toISOString();
      result.source = result.source || 'file';
    }
  }

  // 6. Layer 6: Android device info fallback
  if (!result.deviceModel && getDeviceInfo().isMobile) {
    result.deviceModel = getDeviceInfo().platformName;
  }

  return result;
}

/**
 * Compresses an image file using an HTML5 Canvas, resizing to max dimensions while preserving orientation and high visual fidelity.
 */
export async function compressAndFormatImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    // If it's not an image, resolve directly with dataURL
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      // Calculate scaled dimensions
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        // Fallback to original data URL
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      // Smooth resizing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Prefer WebP or JPEG for optimal compression & cross-platform mobile display
      let outputType = 'image/jpeg';
      try {
        if (canvas.toDataURL('image/webp').startsWith('data:image/webp')) {
          outputType = 'image/webp';
        }
      } catch {
        outputType = 'image/jpeg';
      }

      const compressedDataUrl = canvas.toDataURL(outputType, quality);
      resolve(compressedDataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // Fallback to standard reader
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Full pipeline for processing a single photo from iPhone/Android
 */
export async function processMobileMediaFile(
  file: File,
  onProgress?: (stage: string, percent: number) => void
): Promise<ProcessedMediaResult> {
  onProgress?.('EXIF-Daten & GPS auslesen...', 20);

  // 1. Extract EXIF data (GPS, Date, Phone Model) for photos
  const exifData = await extractExifFromPhoto(file);

  // 2. Compress and optimize image
  onProgress?.('Bild komprimieren & optimieren...', 55);
  const finalUrl = await compressAndFormatImage(file);
  // Approximate base64 size
  const finalSize = Math.round((finalUrl.length * 3) / 4);

  const mediaId = `media-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  onProgress?.('Im Offline-Cache speichern...', 85);
  // Cache media into IndexedDB in the background so it survives LocalStorage quota limits
  try {
    if (typeof window !== 'undefined' && window.indexedDB) {
      indexedDbStorage.cacheMedia(mediaId, finalUrl, file.type || 'image/jpeg').catch(() => {});
    }
  } catch {
    // Non-blocking fallback
  }

  const mediaItem: MediaItem = {
    id: mediaId,
    type: 'photo',
    url: finalUrl,
    caption: file.name.replace(/\.[^/.]+$/, ''),
    timestamp: exifData.date || new Date().toISOString(),
    size: finalSize,
    originalSize: file.size,
    exifLocation: exifData.gps,
    exifDate: exifData.date,
    deviceInfo: exifData.deviceModel || (getDeviceInfo().isMobile ? getDeviceInfo().platformName : undefined),
    mimeType: file.type || 'image/jpeg',
  };

  onProgress?.('Fertig', 100);

  return {
    mediaItem,
    exifGps: exifData.gps,
    exifDate: exifData.date,
    deviceModel: exifData.deviceModel,
    hasGps: !!exifData.gps,
  };
}
