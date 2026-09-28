import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncLogger } from './syncLogger';
import { JournalEntry, Trip } from '../types';

describe('syncLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs firestore saveEntry start, success and error events accurately', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleGroupSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mockEntry: JournalEntry = {
      id: 'test-entry-1',
      tripId: 'test-trip-1',
      title: 'Passo dello Stelvio',
      note: 'Mountain pass ascent',
      locationName: 'Stelvio, Italy',
      date: '2026-08-28',
      category: 'activity',
      coordinates: { lat: 46.528, lng: 10.453 },
      media: [],
      comments: [],
      likes: [],
      author: { id: 'user-1', name: 'Marco', avatar: '', color: '#8A9A5B', role: 'owner' },
      createdAt: '2026-08-28T10:00:00Z',
      updatedAt: '2026-08-28T10:00:00Z',
    };

    const { startTime } = syncLogger.logFirestoreSaveEntryStart(mockEntry);
    expect(startTime).toBeGreaterThan(0);
    expect(consoleGroupSpy).toHaveBeenCalled();

    syncLogger.logFirestoreSaveEntrySuccess(mockEntry, startTime);
    expect(consoleSpy).toHaveBeenCalled();

    const mockError = new Error('Permission denied');
    syncLogger.logFirestoreSaveEntryError(mockEntry, mockError, startTime);
    expect(consoleErrorSpy).toHaveBeenCalled();

    const logs = syncLogger.getRecentLogs();
    expect(logs.length).toBeGreaterThanOrEqual(3);
    const saveEntryLogs = logs.filter((l) => l.action === 'firestoreService.saveEntry');
    expect(saveEntryLogs.length).toBeGreaterThanOrEqual(3);

    consoleSpy.mockRestore();
    consoleGroupSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('logs syncEngine.subscribeData listener registration and data dispatching', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleGroupSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});

    syncLogger.logSubscribeDataRegistered(2);
    expect(consoleSpy).toHaveBeenCalled();

    const mockTrips: Trip[] = [
      {
        id: 'trip-1',
        title: 'Alps 2026',
        description: 'Biking trip',
        coverImage: '',
        startDate: '2026-08-20',
        countryCodes: ['IT', 'AT'],
        passwordProtected: false,
        passwordHash: '',
        isPublic: true,
        shareToken: 'token-1',
        collaborators: [],
        defaultCoordinates: [46.5, 10.5],
        defaultZoom: 8,
        createdAt: '2026-08-20T00:00:00Z',
        updatedAt: '2026-08-20T00:00:00Z',
      },
    ];

    const mockEntries: JournalEntry[] = [
      {
        id: 'entry-1',
        tripId: 'trip-1',
        title: 'Stelvio Pass',
        note: 'High altitude road trip',
        locationName: 'Stelvio, Italy',
        coordinates: { lat: 46.528, lng: 10.453 },
        date: '2026-08-20',
        category: 'activity',
        media: [],
        comments: [],
        likes: [],
        author: { id: 'user-1', name: 'Marco', avatar: '', color: '#8A9A5B', role: 'owner' },
        createdAt: '2026-08-20T00:00:00Z',
        updatedAt: '2026-08-20T00:00:00Z',
      },
    ];

    syncLogger.logDataDispatched('firestore-live:entries', mockTrips, mockEntries, 2);
    expect(consoleGroupSpy).toHaveBeenCalled();

    syncLogger.logSubscribeDataUnregistered(1);
    expect(consoleSpy).toHaveBeenCalled();

    const logs = syncLogger.getRecentLogs();
    const subscribeLogs = logs.filter((l) => l.category === 'syncEngine');
    expect(subscribeLogs.length).toBeGreaterThanOrEqual(3);

    consoleSpy.mockRestore();
    consoleGroupSpy.mockRestore();
  });
});
