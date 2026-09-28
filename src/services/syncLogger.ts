import { JournalEntry, Trip } from '../types';

export interface SyncLogEvent {
  id: string;
  timestamp: string;
  category: 'firestore' | 'syncEngine';
  action: string;
  status: 'start' | 'success' | 'error' | 'info';
  message: string;
  details?: Record<string, any>;
  durationMs?: number;
}

// In-memory ring buffer of recent sync logs for debugging in browser console
const MAX_LOGS = 100;
const syncLogBuffer: SyncLogEvent[] = [];

if (typeof window !== 'undefined') {
  (window as any).__TRAVEL_SYNC_LOGS__ = syncLogBuffer;
}

function pushLog(event: Omit<SyncLogEvent, 'id' | 'timestamp'>): SyncLogEvent {
  const fullEvent: SyncLogEvent = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...event,
  };

  syncLogBuffer.unshift(fullEvent);
  if (syncLogBuffer.length > MAX_LOGS) {
    syncLogBuffer.pop();
  }

  return fullEvent;
}

export const syncLogger = {
  /**
   * Log firestoreService.saveEntry calls with detailed metadata
   */
  logFirestoreSaveEntryStart(entry: JournalEntry): { startTime: number; logId: string } {
    const startTime = performance.now();
    const summary = {
      entryId: entry.id,
      tripId: entry.tripId,
      title: entry.title,
      author: entry.author ? `${entry.author.name} (${entry.author.id})` : 'Unknown',
      location: entry.locationName || (entry.coordinates ? `${entry.coordinates.lat}, ${entry.coordinates.lng}` : 'None'),
      category: entry.category,
      date: entry.date,
      mediaCount: entry.media?.length || 0,
      commentsCount: entry.comments?.length || 0,
      likesCount: entry.likes?.length || 0,
    };

    const event = pushLog({
      category: 'firestore',
      action: 'firestoreService.saveEntry',
      status: 'start',
      message: `[Firestore:saveEntry] ⏳ Starting save for entry "${entry.title || entry.id}"`,
      details: summary,
    });

    console.groupCollapsed(
      `%c[Firestore:saveEntry] ⏳ START [${new Date().toLocaleTimeString()}] "${entry.title || entry.id}" (Trip: ${entry.tripId})`,
      'color: #0284c7; font-weight: bold; background: #e0f2fe; padding: 2px 6px; border-radius: 4px;'
    );
    console.log('📌 Entry Metadata:', summary);
    console.log('📦 Full Entry Payload:', entry);
    console.groupEnd();

    return { startTime, logId: event.id };
  },

  logFirestoreSaveEntrySuccess(entry: JournalEntry, startTime: number): void {
    const durationMs = Math.round(performance.now() - startTime);
    pushLog({
      category: 'firestore',
      action: 'firestoreService.saveEntry',
      status: 'success',
      message: `[Firestore:saveEntry] ✅ Successfully saved entry "${entry.title || entry.id}" in ${durationMs}ms`,
      durationMs,
      details: { entryId: entry.id, tripId: entry.tripId, title: entry.title },
    });

    console.log(
      `%c[Firestore:saveEntry] ✅ SUCCESS (${durationMs}ms) "${entry.title || entry.id}" (ID: ${entry.id}, Trip: ${entry.tripId})`,
      'color: #16a34a; font-weight: bold; background: #dcfce7; padding: 2px 6px; border-radius: 4px;'
    );
  },

  logFirestoreSaveEntryError(entry: JournalEntry, error: unknown, startTime: number): void {
    const durationMs = Math.round(performance.now() - startTime);
    let errorCode = 'UNKNOWN_ERROR';
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const codeVal = (error as { code: unknown }).code;
      if (typeof codeVal === 'string') errorCode = codeVal;
    }
    const errorDetails = {
      code: errorCode,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };

    pushLog({
      category: 'firestore',
      action: 'firestoreService.saveEntry',
      status: 'error',
      message: `[Firestore:saveEntry] ❌ FAILED to save entry "${entry.title || entry.id}" after ${durationMs}ms: ${errorDetails.message}`,
      durationMs,
      details: { entryId: entry.id, tripId: entry.tripId, error: errorDetails, entryPayload: entry },
    });

    console.group(
      `%c[Firestore:saveEntry] ❌ ERROR (${durationMs}ms) "${entry.title || entry.id}" (ID: ${entry.id})`,
      'color: #dc2626; font-weight: bold; background: #fee2e2; padding: 2px 6px; border-radius: 4px;'
    );
    console.error('Error Object:', error);
    console.error('Error Details:', errorDetails);
    console.log('Failed Payload:', entry);
    console.groupEnd();
  },

  /**
   * Log syncEngine.subscribeData lifecycle and dispatched payloads
   */
  logSubscribeDataRegistered(subscriberCount: number): void {
    pushLog({
      category: 'syncEngine',
      action: 'syncEngine.subscribeData',
      status: 'info',
      message: `[SyncEngine:subscribeData] 📡 New listener subscribed (Active listeners: ${subscriberCount})`,
      details: { totalSubscribers: subscriberCount },
    });

    console.log(
      `%c[SyncEngine:subscribeData] 📡 Listener Registered (Active subscribers: ${subscriberCount})`,
      'color: #7c3aed; font-weight: bold; background: #f3e8ff; padding: 2px 6px; border-radius: 4px;'
    );
  },

  logSubscribeDataUnregistered(subscriberCount: number): void {
    pushLog({
      category: 'syncEngine',
      action: 'syncEngine.subscribeData',
      status: 'info',
      message: `[SyncEngine:subscribeData] 🔌 Listener unregistered (Remaining active listeners: ${subscriberCount})`,
      details: { totalSubscribers: subscriberCount },
    });

    console.log(
      `%c[SyncEngine:subscribeData] 🔌 Listener Unregistered (Remaining active: ${subscriberCount})`,
      'color: #6b7280; font-weight: bold; background: #f3f4f6; padding: 2px 6px; border-radius: 4px;'
    );
  },

  logDataDispatched(
    source: string,
    trips: Trip[],
    entries: JournalEntry[],
    subscriberCount: number
  ): void {
    const tripSummaries = trips.map((t) => ({ id: t.id, title: t.title, collabs: t.collaborators?.length || 0 }));
    const entrySummaries = entries.map((e) => ({ id: e.id, tripId: e.tripId, title: e.title, author: e.author?.name }));

    pushLog({
      category: 'syncEngine',
      action: 'syncEngine.subscribeData:notify',
      status: 'info',
      message: `[SyncEngine:subscribeData] 🚀 Broadcast from [${source}] -> ${trips.length} trips, ${entries.length} entries to ${subscriberCount} listener(s)`,
      details: {
        source,
        tripsCount: trips.length,
        entriesCount: entries.length,
        subscriberCount,
        tripSummaries,
        entrySummaries,
      },
    });

    console.groupCollapsed(
      `%c[SyncEngine:subscribeData] 🚀 BROADCAST [${source}] → ${trips.length} Trips | ${entries.length} Entries (${subscriberCount} subscribers)`,
      'color: #8a9a5b; font-weight: bold; background: #f4f7ee; padding: 2px 6px; border-radius: 4px;'
    );
    console.log('📌 Source:', source);
    console.log(`🗺️ Trips (${trips.length}):`, tripSummaries);
    console.log(`📖 Entries (${entries.length}):`, entrySummaries);
    console.log('📦 Raw Data Payload:', { trips, entries });
    console.groupEnd();
  },

  getRecentLogs(): SyncLogEvent[] {
    return [...syncLogBuffer];
  },
};
