import { Trip, JournalEntry, SyncQueueItem, Collaborator, MediaItem } from '../types';
import { INITIAL_TRIPS, INITIAL_ENTRIES, CURRENT_USER } from '../data/initialData';
import { getStoredAppSession, createCollaboratorFromSession } from '../utils/appAuth';
import { indexedDbStorage } from './indexedDbStorage';

const STORAGE_KEYS = {
  TRIPS: 'wanderlog_trips_v1',
  ENTRIES: 'wanderlog_entries_v1',
  ACTIVE_TRIP_ID: 'wanderlog_active_trip_id_v1',
  CURRENT_USER: 'wanderlog_current_user_v1',
  SYNC_QUEUE: 'wanderlog_sync_queue_v1',
  UNLOCKED_TRIPS: 'wanderlog_unlocked_trips_v1',
  LAST_SYNC: 'wanderlog_last_sync_v1',
};

const DEMO_TRIP_IDS = new Set(['trip-alps-2025', 'trip-japan-2024', 'trip-iceland-2024']);
const DEMO_ENTRY_IDS = new Set(['entry-1', 'entry-2', 'entry-3', 'entry-4', 'entry-jp-1', 'entry-jp-2', 'entry-is-1']);

// Safe LocalStorage helpers with in-memory fallback cache
let memoryTrips: Trip[] | null = null;
let memoryEntries: JournalEntry[] | null = null;
let memorySyncQueue: SyncQueueItem[] = [];

export const storage = {
  getTrips(): Trip[] {
    if (memoryTrips !== null) return memoryTrips;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRIPS);
      if (data) {
        const parsed: Trip[] = JSON.parse(data);
        const cleaned = parsed.filter((t) => !DEMO_TRIP_IDS.has(t.id));
        memoryTrips = cleaned;
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(cleaned));
        }
        return memoryTrips;
      }
    } catch (e) {
      console.warn('Storage getTrips error:', e);
    }
    memoryTrips = [];
    return memoryTrips;
  },

  setTrips(trips: Trip[]) {
    memoryTrips = trips;
    try {
      localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(trips));
    } catch (e) {
      console.warn('Storage setTrips quota or error:', e);
    }
  },

  getEntries(): JournalEntry[] {
    if (memoryEntries !== null) return memoryEntries;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ENTRIES);
      if (data) {
        const parsed: JournalEntry[] = JSON.parse(data);
        const cleaned = parsed.filter((e) => !DEMO_ENTRY_IDS.has(e.id) && !DEMO_TRIP_IDS.has(e.tripId));
        memoryEntries = cleaned;
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(cleaned));
        }
        return memoryEntries;
      }
    } catch (e) {
      console.warn('Storage getEntries error:', e);
    }
    memoryEntries = [];
    return memoryEntries;
  },

  setEntries(entries: JournalEntry[]) {
    memoryEntries = entries;
    try {
      localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
    } catch (e) {
      console.warn('Storage setEntries quota exceeded in LocalStorage:', e);
    }
  },

  getActiveTripId(): string {
    try {
      const id = localStorage.getItem(STORAGE_KEYS.ACTIVE_TRIP_ID);
      if (id && !DEMO_TRIP_IDS.has(id)) return id;
    } catch (e) {
      console.warn('Storage getActiveTripId error:', e);
    }
    const trips = storage.getTrips();
    return trips[0]?.id || '';
  },

  setActiveTripId(id: string) {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TRIP_ID, id);
    } catch (e) {
      console.warn('Storage setActiveTripId error:', e);
    }
  },

  getCurrentUser(): Collaborator {
    const session = getStoredAppSession();
    if (session) {
      return createCollaboratorFromSession(session);
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Storage getCurrentUser error:', e);
    }
    return CURRENT_USER;
  },

  setCurrentUser(user: Collaborator) {
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } catch (e) {
      console.warn('Storage setCurrentUser error:', e);
    }
  },

  getSyncQueue(): SyncQueueItem[] {
    if (memorySyncQueue && memorySyncQueue.length > 0) return memorySyncQueue;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
      if (data) {
        memorySyncQueue = JSON.parse(data);
        return memorySyncQueue;
      }
    } catch (e) {
      console.warn('Storage getSyncQueue error:', e);
    }
    return memorySyncQueue || [];
  },

  setSyncQueue(queue: SyncQueueItem[]) {
    memorySyncQueue = queue;
    try {
      localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
    } catch (e) {
      console.warn('Storage setSyncQueue error:', e);
    }
  },

  addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp'>) {
    const queue = storage.getSyncQueue();
    const newItem: SyncQueueItem = {
      ...item,
      id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
    };
    const updatedQueue = [...queue, newItem];
    storage.setSyncQueue(updatedQueue);
    return newItem;
  },

  getUnlockedTrips(): string[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.UNLOCKED_TRIPS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Storage getUnlockedTrips error:', e);
    }
    return [];
  },

  addUnlockedTrip(tripId: string) {
    const unlocked = storage.getUnlockedTrips();
    if (!unlocked.includes(tripId)) {
      unlocked.push(tripId);
      try {
        localStorage.setItem(STORAGE_KEYS.UNLOCKED_TRIPS, JSON.stringify(unlocked));
      } catch (e) {
        console.warn('Storage addUnlockedTrip error:', e);
      }
    }
  },

  getLastSyncedAt(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    } catch {
      return null;
    }
  },

  setLastSyncedAt(timestamp: string) {
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, timestamp);
    } catch {
      // ignore
    }
  },

  async hydrateMediaUrl(media: MediaItem): Promise<string> {
    if (media.url && (media.url.startsWith('data:') || media.url.startsWith('blob:') || media.url.startsWith('http'))) {
      return media.url;
    }
    try {
      const cached = await indexedDbStorage.getCachedMedia(media.id);
      if (cached && (cached.startsWith('data:') || cached.startsWith('blob:') || cached.startsWith('http'))) {
        return cached;
      }
    } catch {
      // ignore
    }
    return media.url || '';
  },
};
