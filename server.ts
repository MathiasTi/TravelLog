import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { INITIAL_TRIPS, INITIAL_ENTRIES } from './src/data/initialData';
import { Trip, JournalEntry, CommentItem } from './src/types';

dotenv.config();

const app = express();
const PORT = 3000;

// High payload limit for photos and tracks (Base64 data URLs)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Persistence file path
const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'travel_journal.json');

const DEMO_TRIP_IDS = new Set(['trip-alps-2025', 'trip-japan-2024', 'trip-iceland-2024']);
const DEMO_ENTRY_IDS = new Set(['entry-1', 'entry-2', 'entry-3', 'entry-4', 'entry-jp-1', 'entry-jp-2', 'entry-is-1']);

interface DatabaseStore {
  trips: Trip[];
  entries: JournalEntry[];
}

let db: DatabaseStore = {
  trips: [],
  entries: [],
};

// Initialize file persistence
function loadData() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.trips) && Array.isArray(parsed.entries)) {
        const cleanedTrips = parsed.trips.filter((t: Trip) => !DEMO_TRIP_IDS.has(t.id));
        const cleanedEntries = parsed.entries.filter((e: JournalEntry) => !DEMO_ENTRY_IDS.has(e.id) && !DEMO_TRIP_IDS.has(e.tripId));
        db = {
          trips: cleanedTrips,
          entries: cleanedEntries,
        };
        console.log(`[Storage] Loaded ${db.trips.length} trips and ${db.entries.length} entries from disk.`);
        saveData();
        return;
      }
    }
  } catch (err) {
    console.error('[Storage] Error loading data from file, fallback to initial data:', err);
  }
  saveData();
}

function saveData() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Storage] Failed to persist data to disk:', err);
  }
}

loadData();

// Lazy Gemini AI initialization
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

// ----------------------------------------------------
// REAL-TIME MULTI-USER LIVE BROADCASTER (SSE)
// ----------------------------------------------------
const liveClients = new Set<express.Response>();

function broadcastLiveUpdate(actionType: string, payload?: any) {
  const eventPayload = JSON.stringify({
    type: actionType,
    trips: db.trips,
    entries: db.entries,
    payload,
    timestamp: new Date().toISOString(),
  });

  liveClients.forEach((client) => {
    try {
      client.write(`data: ${eventPayload}\n\n`);
    } catch (_err) {
      liveClients.delete(client);
    }
  });
}

// Keep-alive heartbeat for SSE connections
setInterval(() => {
  liveClients.forEach((client) => {
    try {
      client.write(': ping\n\n');
    } catch {
      liveClients.delete(client);
    }
  });
}, 20000);

// ----------------------------------------------------
// REST API ROUTES
// ----------------------------------------------------

// Server-Sent Events (SSE) Live Feed for instant real-time multi-user synchronization
app.get('/api/live-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Send initial snapshot immediately
  res.write(
    `data: ${JSON.stringify({
      type: 'initial',
      trips: db.trips,
      entries: db.entries,
      timestamp: new Date().toISOString(),
    })}\n\n`
  );

  liveClients.add(res);

  req.on('close', () => {
    liveClients.delete(res);
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    tripsCount: db.trips.length,
    entriesCount: db.entries.length,
    connectedClients: liveClients.size,
    timestamp: new Date().toISOString(),
  });
});

// GET all trips
app.get('/api/trips', (req, res) => {
  res.json(db.trips);
});

// GET single trip by ID or shareToken
app.get('/api/trips/:id', (req, res) => {
  const { id } = req.params;
  const trip = db.trips.find((t) => t.id === id || t.shareToken === id);
  if (!trip) {
    return res.status(404).json({ error: 'Trip not found' });
  }
  res.json(trip);
});

// Verify Trip Password
app.post('/api/trips/:id/verify-password', (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  const trip = db.trips.find((t) => t.id === id || t.shareToken === id);
  if (!trip) {
    return res.status(404).json({ error: 'Reise nicht gefunden' });
  }
  if (!trip.passwordProtected) {
    return res.json({ valid: true });
  }
  if (trip.passwordHash && trip.passwordHash === password) {
    return res.json({ valid: true });
  }
  return res.status(401).json({ valid: false, error: 'Falsches Passwort' });
});

// CREATE Trip
app.post('/api/trips', (req, res) => {
  const newTrip: Trip = {
    id: req.body.id || `trip-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title: req.body.title || 'Neue Reise',
    description: req.body.description || '',
    coverImage: req.body.coverImage || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&auto=format&fit=crop&q=80',
    startDate: req.body.startDate || new Date().toISOString().split('T')[0],
    endDate: req.body.endDate,
    countryCodes: req.body.countryCodes || [],
    passwordProtected: Boolean(req.body.passwordProtected),
    passwordHash: req.body.passwordHash || '',
    isPublic: req.body.isPublic !== false,
    shareToken: req.body.shareToken || `wander-${Math.random().toString(36).substring(2, 8)}`,
    collaborators: req.body.collaborators || [],
    defaultCoordinates: req.body.defaultCoordinates || [50.1109, 8.6821],
    defaultZoom: req.body.defaultZoom || 6,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.trips.unshift(newTrip);
  saveData();
  broadcastLiveUpdate('trip_created', newTrip);
  res.status(201).json(newTrip);
});

// UPDATE Trip
app.put('/api/trips/:id', (req, res) => {
  const { id } = req.params;
  const index = db.trips.findIndex((t) => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Trip not found' });
  }

  db.trips[index] = {
    ...db.trips[index],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  saveData();
  broadcastLiveUpdate('trip_updated', db.trips[index]);
  res.json(db.trips[index]);
});

// DELETE Trip & its entries
app.delete('/api/trips/:id', (req, res) => {
  const { id } = req.params;
  db.trips = db.trips.filter((t) => t.id !== id);
  db.entries = db.entries.filter((e) => e.tripId !== id);
  saveData();
  broadcastLiveUpdate('trip_deleted', { id });
  res.json({ success: true });
});

// GET all entries (optional ?tripId=...)
app.get('/api/entries', (req, res) => {
  const { tripId } = req.query;
  if (tripId && typeof tripId === 'string') {
    return res.json(db.entries.filter((e) => e.tripId === tripId));
  }
  res.json(db.entries);
});

// CREATE entry
app.post('/api/entries', (req, res) => {
  const newEntry: JournalEntry = {
    id: req.body.id || `entry-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    tripId: req.body.tripId,
    title: req.body.title || 'Neuer Tagebucheintrag',
    note: req.body.note || '',
    coordinates: req.body.coordinates || { lat: 50.1109, lng: 8.6821 },
    locationName: req.body.locationName || 'Unbekannter Ort',
    country: req.body.country || '',
    date: req.body.date || new Date().toISOString(),
    weather: req.body.weather,
    mood: req.body.mood,
    category: req.body.category || 'general',
    media: req.body.media || [],
    author: req.body.author || {
      id: 'user-default',
      name: 'Reisender',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      color: '#3b82f6',
      role: 'editor',
    },
    comments: req.body.comments || [],
    likes: req.body.likes || [],
    orderIndex: req.body.orderIndex,
    syncStatus: 'synced',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.entries.unshift(newEntry);
  saveData();
  broadcastLiveUpdate('entry_created', newEntry);
  res.status(201).json(newEntry);
});

// UPDATE entry
app.put('/api/entries/:id', (req, res) => {
  const { id } = req.params;
  const index = db.entries.findIndex((e) => e.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  db.entries[index] = {
    ...db.entries[index],
    ...req.body,
    syncStatus: 'synced',
    updatedAt: new Date().toISOString(),
  };
  saveData();
  broadcastLiveUpdate('entry_updated', db.entries[index]);
  res.json(db.entries[index]);
});

// DELETE entry
app.delete('/api/entries/:id', (req, res) => {
  const { id } = req.params;
  db.entries = db.entries.filter((e) => e.id !== id);
  saveData();
  broadcastLiveUpdate('entry_deleted', { id });
  res.json({ success: true });
});

// ADD comment to entry
app.post('/api/entries/:id/comments', (req, res) => {
  const { id } = req.params;
  const entry = db.entries.find((e) => e.id === id);
  if (!entry) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  const comment: CommentItem = {
    id: `comment-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    author: req.body.author,
    text: req.body.text || '',
    timestamp: new Date().toISOString(),
    reactions: [],
  };

  if (!entry.comments) entry.comments = [];
  entry.comments.push(comment);
  entry.updatedAt = new Date().toISOString();
  saveData();
  broadcastLiveUpdate('comment_added', { entryId: id, comment, entry });
  res.status(201).json(comment);
});

// TOGGLE like on entry
app.post('/api/entries/:id/like', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  const entry = db.entries.find((e) => e.id === id);
  if (!entry) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  if (!entry.likes) entry.likes = [];
  if (entry.likes.includes(userId)) {
    entry.likes = entry.likes.filter((u) => u !== userId);
  } else {
    entry.likes.push(userId);
  }
  entry.updatedAt = new Date().toISOString();
  saveData();
  broadcastLiveUpdate('like_toggled', { entryId: id, userId, likes: entry.likes, entry });
  res.json({ likes: entry.likes });
});

// BATCH SYNC ENDPOINT (for offline synchronization engine)
app.post('/api/sync', (req, res) => {
  const { queue } = req.body;
  if (!Array.isArray(queue)) {
    return res.json({
      success: true,
      syncedTrips: db.trips,
      syncedEntries: db.entries,
      processedCount: 0,
    });
  }

  let processedCount = 0;
  for (const item of queue) {
    try {
      if (item.action === 'create_trip') {
        const existing = db.trips.find((t) => t.id === item.payload.id);
        if (!existing) {
          db.trips.unshift(item.payload);
        } else {
          Object.assign(existing, item.payload);
        }
        processedCount++;
      } else if (item.action === 'update_trip') {
        const existing = db.trips.find((t) => t.id === item.payload.id);
        if (existing) Object.assign(existing, item.payload);
        processedCount++;
      } else if (item.action === 'delete_trip') {
        db.trips = db.trips.filter((t) => t.id !== item.payload.id);
        db.entries = db.entries.filter((e) => e.tripId !== item.payload.id);
        processedCount++;
      } else if (item.action === 'create_entry') {
        const existing = db.entries.find((e) => e.id === item.payload.id);
        if (!existing) {
          db.entries.unshift({ ...item.payload, syncStatus: 'synced' });
        } else {
          Object.assign(existing, { ...item.payload, syncStatus: 'synced' });
        }
        processedCount++;
      } else if (item.action === 'update_entry') {
        const existing = db.entries.find((e) => e.id === item.payload.id);
        if (existing) {
          Object.assign(existing, { ...item.payload, syncStatus: 'synced' });
        }
        processedCount++;
      } else if (item.action === 'delete_entry') {
        db.entries = db.entries.filter((e) => e.id !== item.payload.id);
        processedCount++;
      } else if (item.action === 'add_comment') {
        const entry = db.entries.find((e) => e.id === item.payload.entryId);
        if (entry) {
          if (!entry.comments) entry.comments = [];
          entry.comments.push(item.payload.comment);
        }
        processedCount++;
      }
    } catch (e) {
      console.error('[Sync] Error processing queue item:', item, e);
    }
  }

  saveData();
  broadcastLiveUpdate('batch_sync', { count: processedCount });
  res.json({
    success: true,
    processedCount,
    trips: db.trips,
    entries: db.entries,
    serverTimestamp: new Date().toISOString(),
  });
});

// BACKUP EXPORT ENDPOINT (Full Canonical Server State)
app.get('/api/backup/export', (_req, res) => {
  const payload = {
    version: '2.0',
    app: 'TravelLog',
    exportedAt: new Date().toISOString(),
    generator: 'WanderLog Server Snapshot Engine',
    meta: {
      tripsCount: db.trips.length,
      entriesCount: db.entries.length,
      mediaCount: db.entries.reduce((acc, e) => acc + (e.media?.length || 0), 0),
      tracksCount: db.entries.filter((e) => Boolean(e.track)).length,
      commentsCount: db.entries.reduce((acc, e) => acc + (e.comments?.length || 0), 0),
      appVersion: '2.0.0',
    },
    trips: db.trips,
    entries: db.entries,
  };
  res.setHeader('Content-Disposition', 'attachment; filename="wanderlog_server_backup.json"');
  res.json(payload);
});

// BACKUP RESTORE ENDPOINT (Merge or Replace)
app.post('/api/backup/restore', (req, res) => {
  const { trips, entries, mode } = req.body;
  if (!Array.isArray(trips) || !Array.isArray(entries)) {
    return res.status(400).json({ error: 'Ungültiges Backup-Format: trips und entries Arrays erwartet' });
  }

  if (mode === 'replace') {
    db.trips = trips;
    db.entries = entries;
  } else {
    // Merge
    const tripMap = new Map<string, Trip>(db.trips.map((t) => [t.id, t]));
    trips.forEach((t: Trip) => tripMap.set(t.id, t));
    db.trips = Array.from(tripMap.values());

    const entryMap = new Map<string, JournalEntry>(db.entries.map((e) => [e.id, e]));
    entries.forEach((e: JournalEntry) => entryMap.set(e.id, e));
    db.entries = Array.from(entryMap.values());
  }

  saveData();
  broadcastLiveUpdate('backup_restored', {
    tripsCount: db.trips.length,
    entriesCount: db.entries.length,
    mode,
  });

  res.json({
    success: true,
    tripsCount: db.trips.length,
    entriesCount: db.entries.length,
    trips: db.trips,
    entries: db.entries,
    timestamp: new Date().toISOString(),
  });
});

// BACKUP FULL EXPORT ENDPOINT
app.get('/api/backup/export', (req, res) => {
  res.json({
    version: '2.0',
    app: 'TravelLog',
    exportedAt: new Date().toISOString(),
    generator: 'TravelLog Server Backup API',
    meta: {
      tripsCount: db.trips.length,
      entriesCount: db.entries.length,
      mediaCount: db.entries.reduce((acc, e) => acc + (e.media?.length || 0), 0),
      tracksCount: db.entries.reduce((acc, e) => acc + (e.track ? 1 : 0), 0),
    },
    trips: db.trips,
    entries: db.entries,
  });
});

// HISTORICAL & REAL-TIME WEATHER PROXY ENDPOINT (Open-Meteo Integration)
app.get('/api/weather/historical', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const dateStr = (req.query.date as string || '').split('T')[0];

    if (isNaN(lat) || isNaN(lng) || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ error: 'Ungültige Parameter. Bitte lat, lng und date (YYYY-MM-DD) angeben.' });
    }

    const selectedDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    let apiUrl = '';
    let isHistorical = true;

    if (selectedDate < fiveDaysAgo) {
      apiUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${dateStr}&end_date=${dateStr}&daily=weather_code,temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max&timezone=auto`;
      isHistorical = true;
    } else {
      apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&start_date=${dateStr}&end_date=${dateStr}&daily=weather_code,temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max&timezone=auto`;
      isHistorical = selectedDate <= today;
    }

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Open-Meteo API returned HTTP ${response.status}`);
    }

    const json: any = await response.json();
    if (!json.daily || !json.daily.time || json.daily.time.length === 0) {
      return res.status(404).json({ error: 'Keine Wetterdaten für diesen Tag und Ort verfügbar.' });
    }

    const weatherCode = json.daily.weather_code?.[0] ?? 0;
    const tempMax = json.daily.temperature_2m_max?.[0] !== undefined ? Math.round(json.daily.temperature_2m_max[0]) : undefined;
    const tempMin = json.daily.temperature_2m_min?.[0] !== undefined ? Math.round(json.daily.temperature_2m_min[0]) : undefined;
    const tempMean = json.daily.temperature_2m_mean?.[0] !== undefined
      ? Math.round(json.daily.temperature_2m_mean[0])
      : tempMax !== undefined && tempMin !== undefined
      ? Math.round((tempMax + tempMin) / 2)
      : tempMax;
    const precipitation = json.daily.precipitation_sum?.[0] !== undefined ? Number(json.daily.precipitation_sum[0].toFixed(1)) : 0;
    const windSpeed = json.daily.wind_speed_10m_max?.[0] !== undefined ? Math.round(json.daily.wind_speed_10m_max[0]) : undefined;

    // Helper map
    const mapCode = (c: number) => {
      if (c === 0) return { label: 'Sonnig & heiter', icon: 'sun' };
      if (c === 1) return { label: 'Überwiegend heiter', icon: 'sun' };
      if (c === 2) return { label: 'Leicht bewölkt', icon: 'cloud-sun' };
      if (c === 3) return { label: 'Bedeckt', icon: 'cloud' };
      if (c === 45 || c === 48) return { label: 'Neblig', icon: 'cloud' };
      if ([51, 53, 55].includes(c)) return { label: 'Leichter Nieselregen', icon: 'cloud-rain' };
      if ([56, 57].includes(c)) return { label: 'Gefrierender Niesel', icon: 'snowflake' };
      if ([61, 63, 65].includes(c)) return { label: 'Regen', icon: 'cloud-rain' };
      if ([66, 67].includes(c)) return { label: 'Gefrierender Regen', icon: 'snowflake' };
      if ([71, 73, 75, 77].includes(c)) return { label: 'Schneefall', icon: 'snowflake' };
      if ([80, 81, 82].includes(c)) return { label: 'Regenschauer', icon: 'cloud-rain' };
      if ([85, 86].includes(c)) return { label: 'Schneeschauer', icon: 'snowflake' };
      if (c >= 95) return { label: 'Gewitter', icon: 'cloud-rain' };
      return { label: 'Sonnig & heiter', icon: 'sun' };
    };

    const mapped = mapCode(weatherCode);

    res.json({
      weather: {
        icon: mapped.icon,
        label: mapped.label,
        temp: tempMean,
        tempMin,
        tempMax,
        precipitation,
        windSpeed,
        weatherCode,
        source: isHistorical ? 'Historische Wetterdaten (Open-Meteo ERA5)' : 'Wetterdienst (Open-Meteo)',
        isHistorical,
      },
      source: isHistorical ? 'Historische Wetterdaten (Open-Meteo ERA5)' : 'Wetterdienst (Open-Meteo)',
      isHistorical,
      date: dateStr,
      coordinates: { lat, lng },
    });
  } catch (error: any) {
    console.error('[API /weather/historical] Error fetching weather:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Wetterdaten: ' + (error.message || 'Unbekannt') });
  }
});

// ----------------------------------------------------
// VITE / STATIC SERVING
// ----------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] WanderLog Travel Journal backend listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
