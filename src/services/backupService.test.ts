// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildBackupPayload,
  parseAndValidateBackupFile,
  executeRestore,
  calculatePayloadChecksum,
  createPreRestoreSnapshot,
  getLatestSafetySnapshot,
  rollbackSafetySnapshot,
  BackupDomainError,
  BackupPayload,
} from './backupService';
import { storage } from './storage';
import { Trip, JournalEntry } from '../types';

vi.mock('./firebase', () => ({
  firestoreService: {
    saveTrip: vi.fn().mockResolvedValue(undefined),
    saveEntry: vi.fn().mockResolvedValue(undefined),
  },
}));

let mockIndexedDbCache: Record<string, unknown> = {};

vi.mock('./indexedDbStorage', () => ({
  indexedDbStorage: {
    cacheMedia: vi.fn().mockResolvedValue(true),
    getCachedMedia: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockImplementation((key: string, val: unknown) => {
      mockIndexedDbCache[key] = val;
      return Promise.resolve(true);
    }),
    getItem: vi.fn().mockImplementation((key: string) => {
      return Promise.resolve(mockIndexedDbCache[key] || null);
    }),
  },
}));

const mockTrip: Trip = {
  id: 'trip-test-1',
  title: 'Alpenüberquerung',
  description: 'Wanderung von Oberstdorf nach Meran',
  startDate: '2026-07-10',
  endDate: '2026-07-18',
  coverImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b',
  countryCodes: ['DE', 'AT', 'IT'],
  passwordProtected: false,
  shareToken: 'test-share-token',
  isPublic: true,
  collaborators: [],
  defaultCoordinates: [47.3194, 10.3188],
  defaultZoom: 10,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
};

const mockEntry: JournalEntry = {
  id: 'entry-test-1',
  tripId: 'trip-test-1',
  title: 'Kemptner Hütte',
  date: '2026-07-11T14:30:00.000Z',
  locationName: 'Kemptner Hütte, Allgäu',
  coordinates: { lat: 47.3194, lng: 10.3188 },
  category: 'nature',
  note: 'Schöne Etappe bei bestem Wetter.',
  author: {
    id: 'user-1',
    name: 'Max',
    avatar: '',
    color: '#8A9A5B',
    role: 'owner',
  },
  comments: [],
  likes: [],
  media: [
    {
      id: 'media-1',
      type: 'photo',
      url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
      caption: 'Aussicht auf die Gipfel',
      timestamp: '2026-07-11T14:35:00.000Z',
    },
  ],
  track: {
    id: 'track-1',
    filename: 'etappe1.gpx',
    title: 'Etappe 1 GPX',
    points: [{ lat: 47.3194, lng: 10.3188, altitude: 1844, timestamp: '2026-07-11T14:30:00.000Z' }],
    summary: {
      totalDistanceKm: 14.5,
      totalDurationSec: 18000,
      movingDurationSec: 16200,
      elevationGainM: 980,
      elevationLossM: 420,
      maxAltitudeM: 1844,
      minAltitudeM: 850,
      avgSpeedKmh: 3.2,
      maxSpeedKmh: 5.8,
      startTime: '2026-07-11T08:00:00.000Z',
      endTime: '2026-07-11T13:00:00.000Z',
    },
    highlights: [],
    createdAt: '2026-07-11T14:30:00.000Z',
  },
  createdAt: '2026-07-11T14:30:00.000Z',
  updatedAt: '2026-07-11T14:30:00.000Z',
};

describe('backupService Domain & Hexagonal Layer', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    } as Response);
  });

  describe('buildBackupPayload', () => {
    it('constructs a standardized, valid BackupPayload DTO', () => {
      const payload = buildBackupPayload([mockTrip], [mockEntry], undefined, 'Max Mustermann');

      expect(payload.version).toBe('2.0');
      expect(payload.app).toBe('TravelLog');
      expect(payload.meta.tripsCount).toBe(1);
      expect(payload.meta.entriesCount).toBe(1);
      expect(payload.meta.mediaCount).toBe(1);
      expect(payload.meta.tracksCount).toBe(1);
      expect(payload.meta.exportedBy).toBe('Max Mustermann');
      expect(payload.trips).toEqual([mockTrip]);
      expect(payload.entries).toEqual([mockEntry]);
    });

    it('filters properly when a specific targetTripId is requested', () => {
      const otherTrip: Trip = { ...mockTrip, id: 'trip-other-2', title: 'Norwegen' };
      const otherEntry: JournalEntry = { ...mockEntry, id: 'entry-other-2', tripId: 'trip-other-2' };

      const payload = buildBackupPayload([mockTrip, otherTrip], [mockEntry, otherEntry], 'trip-test-1');

      expect(payload.meta.tripsCount).toBe(1);
      expect(payload.trips[0].id).toBe('trip-test-1');
      expect(payload.entries.length).toBe(1);
      expect(payload.entries[0].tripId).toBe('trip-test-1');
    });
  });

  describe('parseAndValidateBackupFile', () => {
    it('rejects unsupported file formats with INVALID_FORMAT error code', async () => {
      const invalidFile = new File(['dummy content'], 'document.pdf', { type: 'application/pdf' });
      const res = await parseAndValidateBackupFile(invalidFile);
      const { result } = res;

      expect(res.valid).toBe(false);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(BackupDomainError);
        expect(result.error.code).toBe('INVALID_FORMAT');
      }
    });

    it('handles corrupted JSON with CORRUPTED_FILE domain error', async () => {
      const corruptFile = new File(['{ invalid_json: '], 'backup.json', { type: 'application/json' });
      const res = await parseAndValidateBackupFile(corruptFile);
      const { result } = res;

      expect(res.valid).toBe(false);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CORRUPTED_FILE');
      }
    });

    it('rejects empty payloads with EMPTY_DATA domain error', async () => {
      const emptyPayload = JSON.stringify({ trips: [], entries: [] });
      const file = new File([emptyPayload], 'backup.json', { type: 'application/json' });
      const res = await parseAndValidateBackupFile(file);
      const { result } = res;

      expect(res.valid).toBe(false);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('EMPTY_DATA');
      }
    });

    it('successfully parses and normalizes a valid backup JSON', async () => {
      const validPayload: BackupPayload = {
        version: '2.0',
        app: 'TravelLog',
        exportedAt: new Date().toISOString(),
        generator: 'Test Generator',
        meta: {
          tripsCount: 1,
          entriesCount: 1,
          mediaCount: 1,
          tracksCount: 1,
          commentsCount: 0,
          appVersion: '2.0.0',
        },
        trips: [mockTrip],
        entries: [mockEntry],
      };

      const file = new File([JSON.stringify(validPayload)], 'backup.json', { type: 'application/json' });
      const res = await parseAndValidateBackupFile(file);
      const { result } = res;

      expect(res.valid).toBe(true);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.trips.length).toBe(1);
        expect(result.value.entries.length).toBe(1);
        expect(res.summary?.tripsCount).toBe(1);
      }
    });
  });

  describe('executeRestore', () => {
    it('merges new trips and entries with existing storage without duplicates', async () => {
      storage.setTrips([mockTrip]);
      storage.setEntries([mockEntry]);

      const newTrip: Trip = { ...mockTrip, id: 'trip-new-2', title: 'Island Roadtrip' };
      const newEntry: JournalEntry = { ...mockEntry, id: 'entry-new-2', tripId: 'trip-new-2', title: 'Reykjavik' };

      const payload: BackupPayload = {
        version: '2.0',
        app: 'TravelLog',
        exportedAt: new Date().toISOString(),
        generator: 'Test',
        meta: {
          tripsCount: 2,
          entriesCount: 2,
          mediaCount: 0,
          tracksCount: 0,
          commentsCount: 0,
          appVersion: '2.0.0',
        },
        trips: [mockTrip, newTrip],
        entries: [mockEntry, newEntry],
      };

      const res = await executeRestore(payload, 'merge');

      expect(res.success).toBe(true);
      expect(res.tripsCount).toBe(2);
      expect(res.entriesCount).toBe(2);

      const storedTrips = storage.getTrips();
      const storedEntries = storage.getEntries();
      expect(storedTrips.length).toBe(2);
      expect(storedEntries.length).toBe(2);
    });

    it('completely replaces existing storage when restoreMode is replace', async () => {
      storage.setTrips([mockTrip]);
      storage.setEntries([mockEntry]);

      const replacementTrip: Trip = { ...mockTrip, id: 'trip-replacement', title: 'Neuseeland' };
      const replacementEntry: JournalEntry = { ...mockEntry, id: 'entry-replacement', tripId: 'trip-replacement' };

      const payload: BackupPayload = {
        version: '2.0',
        app: 'TravelLog',
        exportedAt: new Date().toISOString(),
        generator: 'Test',
        meta: {
          tripsCount: 1,
          entriesCount: 1,
          mediaCount: 0,
          tracksCount: 0,
          commentsCount: 0,
          appVersion: '2.0.0',
        },
        trips: [replacementTrip],
        entries: [replacementEntry],
      };

      const res = await executeRestore(payload, 'replace');

      expect(res.success).toBe(true);
      expect(res.tripsCount).toBe(1);
      expect(res.entriesCount).toBe(1);

      const storedTrips = storage.getTrips();
      expect(storedTrips.length).toBe(1);
      expect(storedTrips[0].id).toBe('trip-replacement');
    });

    it('creates safety snapshot before restore and allows 1-click rollback', async () => {
      storage.setTrips([mockTrip]);
      storage.setEntries([mockEntry]);

      // Take a snapshot
      const snapshot = await createPreRestoreSnapshot('Test Snapshot');
      expect(snapshot).not.toBeNull();
      expect(snapshot?.trips.length).toBe(1);
      expect(snapshot?.entries.length).toBe(1);

      // Verify snapshot can be retrieved
      const latest = await getLatestSafetySnapshot();
      expect(latest).not.toBeNull();
      expect(latest?.trips[0].id).toBe(mockTrip.id);

      // Mutate storage as if a bad restore happened
      storage.setTrips([]);
      storage.setEntries([]);
      expect(storage.getTrips().length).toBe(0);

      // Execute rollback
      const rollbackResult = await rollbackSafetySnapshot();
      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.tripsCount).toBe(1);
      expect(rollbackResult.entriesCount).toBe(1);

      // Storage should be restored to initial state
      expect(storage.getTrips().length).toBe(1);
      expect(storage.getTrips()[0].id).toBe(mockTrip.id);
    });
  });

  describe('calculatePayloadChecksum', () => {
    it('produces a consistent deterministic hash string for a payload', async () => {
      const payload: BackupPayload = {
        version: '2.0',
        app: 'TravelLog',
        exportedAt: '2026-07-10T10:00:00Z',
        generator: 'Test',
        meta: {
          tripsCount: 1,
          entriesCount: 1,
          mediaCount: 0,
          tracksCount: 0,
          commentsCount: 0,
          appVersion: '2.0.0',
        },
        trips: [mockTrip],
        entries: [mockEntry],
      };

      const checksum1 = await calculatePayloadChecksum(JSON.stringify(payload));
      const checksum2 = await calculatePayloadChecksum(JSON.stringify(payload));

      expect(typeof checksum1).toBe('string');
      expect(checksum1.length).toBeGreaterThan(0);
      expect(checksum1).toBe(checksum2);
    });
  });
});
