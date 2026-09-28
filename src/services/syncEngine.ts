import { storage } from './storage';
import { Trip, JournalEntry, SyncState } from '../types';
import { firestoreService } from './firebase';
import { syncLogger } from './syncLogger';

type SyncListener = (state: SyncState) => void;
type DataListener = (data: { trips: Trip[]; entries: JournalEntry[] }) => void;

class SyncEngine {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private syncListeners: Set<SyncListener> = new Set();
  private dataListeners: Set<DataListener> = new Set();
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private unsubFirestoreTrips: (() => void) | null = null;
  private unsubFirestoreEntries: (() => void) | null = null;
  private eventSource: EventSource | null = null;
  private sseReconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));

      // Periodic smart sync check every 6 seconds if online to guarantee instant multi-user consistency
      this.pollInterval = setInterval(() => {
        if (this.isOnline && !this.isSyncing) {
          const queue = storage.getSyncQueue();
          if (queue.length > 0) {
            this.syncNow();
          } else {
            this.fetchLatestSilently();
          }
        }
      }, 6000);

      // Start live Firestore listeners for real-time multi-user synchronization
      this.initFirestoreLiveSubscriptions();

      // Start Server-Sent Events (SSE) stream for instant server broadcasts
      this.initSSELiveSubscription();
    }
  }

  private initSSELiveSubscription() {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    try {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }

      const es = new EventSource('/api/live-stream');
      this.eventSource = es;

      es.onmessage = (event) => {
        if (!event.data) return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && Array.isArray(parsed.trips) && Array.isArray(parsed.entries)) {
            this.handleLiveTripsUpdate(parsed.trips, 'sse-live');
            this.handleLiveEntriesUpdate(parsed.entries, 'sse-live');
          }
        } catch (_e) {
          // ignore non-json messages (like ping)
        }
      };

      es.onerror = () => {
        es.close();
        this.eventSource = null;
        // Auto-reconnect after 3 seconds
        clearTimeout(this.sseReconnectTimeout);
        this.sseReconnectTimeout = setTimeout(() => {
          if (this.isOnline) {
            this.initSSELiveSubscription();
          }
        }, 3000);
      };
    } catch (err) {
      console.warn('[SyncEngine] SSE setup warning:', err);
    }
  }

  private initFirestoreLiveSubscriptions() {
    try {
      this.unsubFirestoreTrips = firestoreService.subscribeTripsLive((remoteTrips) => {
        if (!remoteTrips) return;
        this.handleLiveTripsUpdate(remoteTrips, 'firestore-live');
      });

      this.unsubFirestoreEntries = firestoreService.subscribeEntriesLive((remoteEntries) => {
        if (!remoteEntries) return;
        this.handleLiveEntriesUpdate(remoteEntries, 'firestore-live');
      });
    } catch (err) {
      console.warn('[SyncEngine] Firestore live subscription warning:', err);
    }
  }

  private handleLiveTripsUpdate(remoteTrips: Trip[], sourceTag: string = 'live') {
    const localTrips = storage.getTrips();
    const queue = storage.getSyncQueue();
    const pendingTripCreations = new Set(
      queue.filter((q) => q.action === 'create_trip' || q.action === 'update_trip').map((q) => q.payload?.id)
    );
    const pendingTripDeletions = new Set(
      queue.filter((q) => q.action === 'delete_trip').map((q) => q.payload?.id)
    );

    const tripsMap = new Map<string, Trip>();

    // 1. Add remote trips (filtering out locally pending deletions)
    remoteTrips.forEach((t) => {
      if (!pendingTripDeletions.has(t.id)) {
        tripsMap.set(t.id, t);
      }
    });

    // 2. Overlay locally pending changes
    localTrips.forEach((local) => {
      if (pendingTripCreations.has(local.id)) {
        tripsMap.set(local.id, local);
      }
    });

    const mergedTrips = Array.from(tripsMap.values());
    storage.setTrips(mergedTrips);
    const currentEntries = storage.getEntries();
    this.notifyDataListeners(mergedTrips, currentEntries, `${sourceTag}:trips`);
  }

  private mergeEntriesWithMediaProtection(
    primaryEntries: JournalEntry[],
    fallbackSources: JournalEntry[][]
  ): JournalEntry[] {
    const fallbackMaps = fallbackSources.map((source) => new Map<string, JournalEntry>(source.map((e) => [e.id, e])));
    
    return primaryEntries.map((entry) => {
      if (!entry.media || entry.media.length === 0) {
        // Look in fallbacks for media
        for (const map of fallbackMaps) {
          const fallback = map.get(entry.id);
          if (fallback?.media && fallback.media.length > 0) {
            return { ...entry, media: fallback.media };
          }
        }
        return entry;
      }

      return entry;
    });
  }

  private handleLiveEntriesUpdate(remoteEntries: JournalEntry[], sourceTag: string = 'live') {
    const localEntries = storage.getEntries();
    const queue = storage.getSyncQueue();
    const pendingEntryCreations = new Set(
      queue.filter((q) => q.action === 'create_entry' || q.action === 'update_entry').map((q) => q.payload?.id)
    );
    const pendingEntryDeletions = new Set(
      queue.filter((q) => q.action === 'delete_entry').map((q) => q.payload?.id)
    );

    const protectedRemoteEntries = this.mergeEntriesWithMediaProtection(remoteEntries, [localEntries]);
    const entriesMap = new Map<string, JournalEntry>();

    // 1. Add protected remote entries (filtering out locally pending deletions)
    protectedRemoteEntries.forEach((e) => {
      if (!pendingEntryDeletions.has(e.id)) {
        entriesMap.set(e.id, e);
      }
    });

    // 2. Overlay locally pending entries
    localEntries.forEach((local) => {
      if (pendingEntryCreations.has(local.id)) {
        entriesMap.set(local.id, local);
      }
    });

    const mergedEntries = Array.from(entriesMap.values());
    storage.setEntries(mergedEntries);
    const currentTrips = storage.getTrips();
    this.notifyDataListeners(currentTrips, mergedEntries, `${sourceTag}:entries`);
  }

  // Silent background fetch to ensure state parity
  private async fetchLatestSilently() {
    try {
      const [tripsRes, entriesRes] = await Promise.all([
        fetch('/api/trips').catch(() => null),
        fetch('/api/entries').catch(() => null),
      ]);

      if (tripsRes && tripsRes.ok && entriesRes && entriesRes.ok) {
        const trips: Trip[] = await tripsRes.json().catch(() => []);
        const entries: JournalEntry[] = await entriesRes.json().catch(() => []);
        if (Array.isArray(trips) && Array.isArray(entries)) {
          this.handleLiveTripsUpdate(trips, 'poll');
          this.handleLiveEntriesUpdate(entries, 'poll');
        }
      }
    } catch (_e) {
      // Ignore background poll errors
    }
  }

  private handleNetworkChange(online: boolean) {
    this.isOnline = online;
    this.notifySyncListeners();
    if (online) {
      this.syncNow();
    }
  }

  public subscribeSync(listener: SyncListener) {
    this.syncListeners.add(listener);
    listener(this.getSyncState());
    return () => {
      this.syncListeners.delete(listener);
    };
  }

  public subscribeData(listener: DataListener) {
    this.dataListeners.add(listener);
    syncLogger.logSubscribeDataRegistered(this.dataListeners.size);

    return () => {
      this.dataListeners.delete(listener);
      syncLogger.logSubscribeDataUnregistered(this.dataListeners.size);
    };
  }

  public getSyncState(): SyncState {
    const queue = storage.getSyncQueue();
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: queue.length,
      lastSyncedAt: storage.getLastSyncedAt(),
    };
  }

  private notifySyncListeners() {
    const state = this.getSyncState();
    this.syncListeners.forEach((l) => l(state));
  }

  private notifyDataListeners(trips: Trip[], entries: JournalEntry[], source: string = 'internal') {
    syncLogger.logDataDispatched(source, trips, entries, this.dataListeners.size);
    this.dataListeners.forEach((l) => l({ trips, entries }));
  }

  // Perform full two-way synchronization
  public async syncNow(): Promise<{ success: boolean; message?: string }> {
    if (this.isSyncing) return { success: false, message: 'Synchronisierung läuft bereits.' };
    if (!this.isOnline) return { success: false, message: 'Keine Internetverbindung (Offline-Modus aktiv).' };

    this.isSyncing = true;
    this.notifySyncListeners();

    try {
      const queue = storage.getSyncQueue();

      // Process queue items to Firestore directly for guaranteed multi-user sync
      for (const item of queue) {
        try {
          if (item.action === 'create_entry' || item.action === 'update_entry') {
            await firestoreService.saveEntry(item.payload);
          } else if (item.action === 'delete_entry') {
            await firestoreService.deleteEntry(item.payload.id);
          } else if (item.action === 'create_trip' || item.action === 'update_trip') {
            await firestoreService.saveTrip(item.payload);
          } else if (item.action === 'delete_trip') {
            await firestoreService.deleteTrip(item.payload.id);
          }
        } catch (fErr) {
          console.warn('[SyncEngine] Firestore item sync warning:', fErr);
        }
      }

      // Also process with server backend
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const result = await response.json();

      // Clear processed queue
      storage.setSyncQueue([]);

      // Smart merge server state with local state and Firestore
      if (result.trips && result.entries) {
        const localEntries = storage.getEntries();
        const serverEntriesProtected = this.mergeEntriesWithMediaProtection(result.entries as JournalEntry[], [localEntries]);
        const mergedEntriesMap = new Map<string, JournalEntry>();
        serverEntriesProtected.forEach((e) => mergedEntriesMap.set(e.id, e));
        localEntries.forEach((e) => {
          if (!mergedEntriesMap.has(e.id)) {
            mergedEntriesMap.set(e.id, e);
          }
        });
        const mergedEntries = Array.from(mergedEntriesMap.values());

        const localTrips = storage.getTrips();
        const mergedTripsMap = new Map<string, Trip>();
        (result.trips as Trip[]).forEach((t) => mergedTripsMap.set(t.id, t));
        localTrips.forEach((t) => {
          if (!mergedTripsMap.has(t.id)) {
            mergedTripsMap.set(t.id, t);
          }
        });
        const mergedTrips = Array.from(mergedTripsMap.values());

        storage.setTrips(mergedTrips);
        storage.setEntries(mergedEntries);
        this.notifyDataListeners(mergedTrips, mergedEntries, 'syncNow:merged');
      }

      const now = new Date().toISOString();
      storage.setLastSyncedAt(now);

      return { success: true, message: 'Erfolgreich synchronisiert!' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Netzwerkfehler';
      console.warn('[SyncEngine] Sync failed, maintaining offline queue:', err);
      return { success: false, message: 'Sync fehlgeschlagen: ' + message };
    } finally {
      this.isSyncing = false;
      this.notifySyncListeners();
    }
  }

  // Fetch latest data from Firestore and server backend (with offline fallback)
  public async fetchInitialData(targetTripToken?: string): Promise<{ trips: Trip[]; entries: JournalEntry[] }> {
    try {
      if (this.isOnline) {
        // Fetch from Firestore and server concurrently
        const [firestoreTrips, firestoreEntries, tripsRes, entriesRes] = await Promise.all([
          firestoreService.getTrips().catch(() => []),
          firestoreService.getEntries().catch(() => []),
          fetch('/api/trips').catch(() => null),
          fetch('/api/entries').catch(() => null),
        ]);

        let serverTrips: Trip[] = [];
        let serverEntries: JournalEntry[] = [];

        if (tripsRes && tripsRes.ok) {
          serverTrips = await tripsRes.json().catch(() => []);
        }
        if (entriesRes && entriesRes.ok) {
          serverEntries = await entriesRes.json().catch(() => []);
        }

        const localTrips = storage.getTrips();
        const localEntries = storage.getEntries();

        // Merge entries from all three sources (Firestore > Server > Local) with media protection
        const protectedFirestoreEntries = this.mergeEntriesWithMediaProtection(firestoreEntries, [serverEntries, localEntries]);
        const protectedServerEntries = this.mergeEntriesWithMediaProtection(serverEntries, [localEntries]);

        const entriesMap = new Map<string, JournalEntry>();
        protectedServerEntries.forEach((e) => entriesMap.set(e.id, e));
        protectedFirestoreEntries.forEach((e) => entriesMap.set(e.id, e));
        localEntries.forEach((e) => {
          if (!entriesMap.has(e.id)) entriesMap.set(e.id, e);
        });
        const mergedEntries = Array.from(entriesMap.values());

        // Merge trips from all three sources
        const tripsMap = new Map<string, Trip>();
        serverTrips.forEach((t) => tripsMap.set(t.id, t));
        firestoreTrips.forEach((t) => tripsMap.set(t.id, t));
        localTrips.forEach((t) => {
          if (!tripsMap.has(t.id)) tripsMap.set(t.id, t);
        });

        // If a specific target shared trip token was requested and not yet in the map, try direct targeted fetch
        if (targetTripToken) {
          const cleanToken = targetTripToken.trim();
          const lowerToken = cleanToken.toLowerCase();
          const hasTarget = Array.from(tripsMap.values()).some(
            (t) => t.id === cleanToken || t.shareToken === cleanToken || t.id.toLowerCase() === lowerToken || (t.shareToken && t.shareToken.toLowerCase() === lowerToken)
          );

          if (!hasTarget) {
            try {
              const directTrip = await firestoreService.getTripByIdOrToken(cleanToken);
              if (directTrip) {
                tripsMap.set(directTrip.id, directTrip);
              } else {
                const directRes = await fetch(`/api/trips/${encodeURIComponent(cleanToken)}`);
                if (directRes.ok) {
                  const fetchedTrip = await directRes.json();
                  if (fetchedTrip && fetchedTrip.id) {
                    tripsMap.set(fetchedTrip.id, fetchedTrip);
                  }
                }
              }
            } catch (targetErr) {
              console.warn('[SyncEngine] Direct targeted trip fetch warning:', targetErr);
            }
          }
        }

        const mergedTrips = Array.from(tripsMap.values());

        storage.setTrips(mergedTrips);
        storage.setEntries(mergedEntries);
        storage.setLastSyncedAt(new Date().toISOString());

        return { trips: mergedTrips, entries: mergedEntries };
      }
    } catch (err) {
      console.warn('[SyncEngine] Failed to fetch remote data, using local storage:', err);
    }

    return {
      trips: storage.getTrips(),
      entries: storage.getEntries(),
    };
  }

  // Geocoding helper with Nominatim (OpenStreetMap) with fallback
  public async searchLocation(query: string): Promise<{ name: string; lat: number; lng: number }[]> {
    if (!query.trim()) return [];
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'de, en' },
      });
      if (res.ok) {
        interface NominatimSearchResult {
          display_name: string;
          lat: string;
          lon: string;
        }
        const data = (await res.json()) as NominatimSearchResult[];
        return data.map((item) => ({
          name: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        }));
      }
    } catch (e) {
      console.warn('Geocoding error:', e);
    }
    return [];
  }

  // Reverse Geocoding helper
  public async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'de, en' },
      });
      if (res.ok) {
        const data = await res.json();
        return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
    } catch (e) {
      console.warn('Reverse geocoding error:', e);
    }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

export const syncEngine = new SyncEngine();
