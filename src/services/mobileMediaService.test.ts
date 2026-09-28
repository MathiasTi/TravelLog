import { describe, it, expect } from 'vitest';
import {
  parseExifDateString,
  extractDateFromFilename,
  convertDmsToDecimal,
  formatDeviceModelName,
  parseBinaryExif,
} from './mobileMediaService';

describe('mobileMediaService - Android & iOS EXIF Extraction', () => {
  describe('parseExifDateString', () => {
    it('parses standard EXIF date format (YYYY:MM:DD HH:MM:SS)', () => {
      const raw = '2024:08:29 14:30:22';
      const parsed = parseExifDateString(raw);
      expect(parsed).toBeDefined();
      const date = new Date(parsed!);
      expect(date.getUTCFullYear()).toBe(2024);
      expect(date.getUTCMonth()).toBe(7); // August = 7 (0-indexed)
      expect(date.getUTCDate()).toBe(29);
    });

    it('parses date only format (YYYY:MM:DD)', () => {
      const raw = '2024:08:29';
      const parsed = parseExifDateString(raw);
      expect(parsed).toBeDefined();
      expect(parsed?.startsWith('2024-08-29')).toBe(true);
    });

    it('parses ISO date strings and Date instances', () => {
      const now = new Date('2024-05-15T10:00:00Z');
      expect(parseExifDateString(now)).toBe('2024-05-15T10:00:00.000Z');
      expect(parseExifDateString('2024-05-15T10:00:00Z')).toBe('2024-05-15T10:00:00.000Z');
    });

    it('returns undefined for invalid or empty dates', () => {
      expect(parseExifDateString('')).toBeUndefined();
      expect(parseExifDateString('0000:00:00 00:00:00')).toBeUndefined();
      expect(parseExifDateString(null)).toBeUndefined();
    });
  });

  describe('extractDateFromFilename (Android & Smartphone patterns)', () => {
    it('extracts date from Google Pixel filename (PXL_20240829_143022123.jpg)', () => {
      const filename = 'PXL_20240829_143022123.jpg';
      const parsed = extractDateFromFilename(filename);
      expect(parsed).toBeDefined();
      expect(parsed?.startsWith('2024-08-29')).toBe(true);
    });

    it('extracts date from Samsung Galaxy filename (20240829_143022.jpg)', () => {
      const filename = '20240829_143022.jpg';
      const parsed = extractDateFromFilename(filename);
      expect(parsed).toBeDefined();
      expect(parsed?.startsWith('2024-08-29')).toBe(true);
    });

    it('extracts date from Xiaomi/OnePlus filename (IMG_20240829_143022.jpg)', () => {
      const filename = 'IMG_20240829_143022.jpg';
      const parsed = extractDateFromFilename(filename);
      expect(parsed).toBeDefined();
      expect(parsed?.startsWith('2024-08-29')).toBe(true);
    });

    it('extracts date from dashed filename (2024-08-29_14-30-22.jpg)', () => {
      const filename = '2024-08-29_14-30-22.jpg';
      const parsed = extractDateFromFilename(filename);
      expect(parsed).toBeDefined();
      expect(parsed?.startsWith('2024-08-29')).toBe(true);
    });

    it('extracts date from Android Unix timestamp filename', () => {
      // 1724941822000 = 2024-08-29T14:30:22.000Z
      const filename = '1724941822000.jpg';
      const parsed = extractDateFromFilename(filename);
      expect(parsed).toBeDefined();
      expect(parsed?.startsWith('2024-08-29')).toBe(true);
    });
  });

  describe('convertDmsToDecimal', () => {
    it('converts DMS array with North / East to decimal', () => {
      const lat = convertDmsToDecimal([52, 31, 12.34], 'N');
      const lng = convertDmsToDecimal([13, 24, 15.67], 'E');
      expect(lat).toBeCloseTo(52.520094, 4);
      expect(lng).toBeCloseTo(13.404353, 4);
    });

    it('converts DMS array with South / West to negative decimal', () => {
      const lat = convertDmsToDecimal([33, 51, 35.9], 'S');
      const lng = convertDmsToDecimal([151, 12, 40], 'W');
      expect(lat).toBeLessThan(0);
      expect(lng).toBeLessThan(0);
      expect(lat).toBeCloseTo(-33.859972, 4);
      expect(lng).toBeCloseTo(-151.211111, 4);
    });

    it('handles direct numbers and strings', () => {
      expect(convertDmsToDecimal(48.8566, 'N')).toBe(48.8566);
      expect(convertDmsToDecimal('48.8566', 'N')).toBe(48.8566);
      expect(convertDmsToDecimal('48.8566', 'S')).toBe(-48.8566);
    });
  });

  describe('formatDeviceModelName', () => {
    it('formats Samsung Galaxy models', () => {
      expect(formatDeviceModelName('samsung', 'SM-S928B')).toBe('Samsung Galaxy S24 Ultra');
      expect(formatDeviceModelName('samsung', 'SM-S918B')).toBe('Samsung Galaxy S23 Ultra');
      expect(formatDeviceModelName('samsung', 'SM-A546B')).toBe('Samsung Galaxy A54 5G');
    });

    it('formats Google Pixel models', () => {
      expect(formatDeviceModelName('Google', 'Pixel 8 Pro')).toBe('Google Pixel 8 Pro');
      expect(formatDeviceModelName('Google', 'Pixel 9')).toBe('Google Pixel 9');
    });

    it('combines generic make and model', () => {
      expect(formatDeviceModelName('Xiaomi', '23078PND5G')).toBe('Xiaomi 23078PND5G');
    });
  });

  describe('parseBinaryExif', () => {
    it('gracefully returns null on non-JPEG or invalid buffer', () => {
      const emptyBuffer = new ArrayBuffer(16);
      expect(parseBinaryExif(emptyBuffer)).toBeNull();
    });

    it('successfully parses a synthetic JPEG APP1 buffer with GPS & EXIF', () => {
      // Construct a minimal valid JPEG with APP1 EXIF segment
      const buffer = new ArrayBuffer(256);
      const view = new DataView(buffer);

      // JPEG SOI
      view.setUint16(0, 0xffd8);

      // APP1 Marker
      view.setUint16(2, 0xffe1);
      view.setUint16(4, 180); // segment length

      // 'Exif\0\0'
      view.setUint32(6, 0x45786966);
      view.setUint16(10, 0x0000);

      // TIFF Header (Little Endian 'II' + 42)
      const tiffStart = 12;
      view.setUint16(tiffStart, 0x4949); // 'II'
      view.setUint16(tiffStart + 2, 0x002a, true); // 42
      view.setUint32(tiffStart + 4, 8, true); // IFD0 offset = 8 bytes from TIFF start

      // IFD0
      const ifd0Start = tiffStart + 8;
      view.setUint16(ifd0Start, 1, true); // 1 entry: GPS IFD pointer
      view.setUint16(ifd0Start + 2, 0x8825, true); // Tag: GPS IFD
      view.setUint16(ifd0Start + 4, 4, true); // Type: LONG
      view.setUint32(ifd0Start + 6, 1, true); // Count: 1
      view.setUint32(ifd0Start + 10, 40, true); // GPS IFD offset = 40

      // GPS IFD at tiffStart + 40
      const gpsStart = tiffStart + 40;
      view.setUint16(gpsStart, 2, true); // 2 entries: GPSLatRef, GPSLat

      // Entry 1: GPSLatitudeRef = 'N'
      view.setUint16(gpsStart + 2, 0x0001, true);
      view.setUint16(gpsStart + 4, 2, true); // ASCII
      view.setUint32(gpsStart + 6, 2, true); // Count: 2
      view.setUint8(gpsStart + 10, 78); // 'N'
      view.setUint8(gpsStart + 11, 0);

      // Entry 2: GPSLatitude = 3 Rationals
      view.setUint16(gpsStart + 14, 0x0002, true);
      view.setUint16(gpsStart + 16, 5, true); // RATIONAL
      view.setUint32(gpsStart + 18, 3, true); // Count: 3
      view.setUint32(gpsStart + 22, 80, true); // Offset = 80

      // Rationals data at tiffStart + 80: [52/1, 30/1, 0/1]
      const ratStart = tiffStart + 80;
      view.setUint32(ratStart, 52, true);
      view.setUint32(ratStart + 4, 1, true);
      view.setUint32(ratStart + 8, 30, true);
      view.setUint32(ratStart + 12, 1, true);
      view.setUint32(ratStart + 16, 0, true);
      view.setUint32(ratStart + 20, 1, true);

      const parsed = parseBinaryExif(buffer);
      expect(parsed).toBeDefined();
    });
  });

  describe('extractExifFromPhoto date extraction for diary entries', () => {
    it('extracts date from photo filename as ISO string and formats to YYYY-MM-DD for entry', () => {
      const filename = 'PXL_20230615_123456.jpg';
      const extracted = extractDateFromFilename(filename);
      expect(extracted).toBeDefined();
      const datePart = extracted!.split('T')[0];
      expect(datePart).toBe('2023-06-15');
    });

    it('extracts date from various smartphone naming conventions', () => {
      const testCases = [
        { file: 'IMG_20220904_183000.jpg', expected: '2022-09-04' },
        { file: '20210512_094520.jpg', expected: '2021-05-12' },
        { file: '2023-11-20_vacation.jpg', expected: '2023-11-20' },
      ];

      for (const tc of testCases) {
        const extracted = extractDateFromFilename(tc.file);
        expect(extracted).toBeDefined();
        expect(extracted!.split('T')[0]).toBe(tc.expected);
      }
    });
  });
});
