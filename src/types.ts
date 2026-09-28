export type CategoryType = 'sight' | 'food' | 'stay' | 'nature' | 'transport' | 'activity' | 'general';

export type UserRole = 'owner' | 'editor' | 'viewer';

export interface Collaborator {
  id: string;
  name: string;
  avatar: string;
  color: string;
  role: UserRole;
  email?: string;
}

export interface MediaItem {
  id: string;
  type: 'photo';
  url: string;
  caption?: string;
  timestamp: string;
  size?: number;
  originalSize?: number;
  exifLocation?: Coordinates;
  exifDate?: string;
  deviceInfo?: string;
  width?: number;
  height?: number;
  mimeType?: string;
}

export interface CommentReaction {
  emoji: string;
  count: number;
  users: string[]; // collaborator IDs
}

export interface CommentItem {
  id: string;
  author: Collaborator;
  text: string;
  timestamp: string;
  reactions: CommentReaction[];
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface WeatherInfo {
  icon: string;
  temp?: number;
  label: string;
  tempMin?: number;
  tempMax?: number;
  precipitation?: number; // mm
  windSpeed?: number; // km/h
  humidity?: number; // %
  weatherCode?: number;
  source?: string;
  isHistorical?: boolean;
}

export interface JournalEntry {
  id: string;
  tripId: string;
  title: string;
  note: string;
  coordinates: Coordinates;
  locationName: string;
  country?: string;
  date: string; // ISO String or YYYY-MM-DD
  weather?: WeatherInfo;
  mood?: string;
  category: CategoryType;
  media: MediaItem[];
  track?: GpsTrackData;
  author: Collaborator;
  comments: CommentItem[];
  likes: string[]; // user IDs who liked
  syncStatus?: 'synced' | 'pending' | 'conflict';
  isOfflineCreated?: boolean;
  orderIndex?: number; // Custom sequence order index
  createdAt: string;
  updatedAt: string;
}

export type EntrySortMode = 'date_asc' | 'date_desc' | 'custom' | 'title_asc';

export interface Trip {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  startDate: string;
  endDate?: string;
  countryCodes: string[];
  passwordProtected: boolean;
  passwordHash?: string; // plain or hashed for verification
  isPublic: boolean;
  shareToken: string;
  collaborators: Collaborator[];
  defaultCoordinates: [number, number];
  defaultZoom: number;
  tracks?: GpsTrackData[];
  createdAt: string;
  updatedAt: string;
}

export interface SyncQueueItem {
  id: string;
  action: 'create_trip' | 'update_trip' | 'delete_trip' | 'create_entry' | 'update_entry' | 'delete_entry' | 'add_comment' | 'add_like';
  payload: any;
  timestamp: number;
  retryCount?: number;
}

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
}

export type ViewMode = 'map' | 'timeline' | 'gallery' | 'stats';

export type ThemeMode = 'light' | 'dark';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
  providerId?: string;
  createdAt?: string;
  lastLoginAt?: string;
}

export type AuthModalTab = 'login' | 'register' | 'forgot_password';

export interface GpsTrackPoint {
  lat: number;
  lng: number;
  altitude?: number; // meters
  speed?: number; // km/h
  heartRate?: number; // bpm
  cadence?: number; // rpm
  power?: number; // watts
  temperature?: number; // celsius
  distance?: number; // cumulative distance in km
  timestamp: string; // ISO string
  slope?: number; // gradient in %
}

export interface GpsActivitySummary {
  sport?: string;
  subSport?: string;
  totalDistanceKm: number;
  totalDurationSec: number;
  movingDurationSec: number;
  elevationGainM: number;
  elevationLossM: number;
  maxAltitudeM: number;
  minAltitudeM: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgCadence?: number;
  maxCadence?: number;
  avgPower?: number;
  maxPower?: number;
  totalCalories?: number;
  startTime: string;
  endTime: string;
}

export interface GpsHighlight {
  type: 'summit' | 'max_speed' | 'steep_climb' | 'halfway' | 'sprint' | 'photo';
  title: string;
  description: string;
  pointIndex: number;
  point: GpsTrackPoint;
  metricValue?: string;
}

export interface GpsWaypoint {
  name: string;
  lat: number;
  lng: number;
  altitude?: number;
  description?: string;
}

export interface GpsTrackData {
  id: string;
  filename: string;
  format?: 'gpx' | 'fit';
  title: string;
  description?: string;
  summary: GpsActivitySummary;
  points: GpsTrackPoint[];
  highlights: GpsHighlight[];
  waypoints?: GpsWaypoint[];
  createdAt: string;
}

// Backward-compatibility aliases
export type FitTrackPoint = GpsTrackPoint;
export type FitActivitySummary = GpsActivitySummary;
export type FitHighlight = GpsHighlight;
export type FitTrackData = GpsTrackData;

