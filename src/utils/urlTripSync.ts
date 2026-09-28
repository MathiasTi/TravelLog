/**
 * Utility functions to synchronize the active trip with the browser URL (query parameter ?trip=...),
 * generate shareable trip links, parse shared trip tokens and invited collaborators on page load,
 * and seamlessly navigate to the target trip upon successful authentication.
 */

import { Trip, Collaborator } from '../types';

const PENDING_TRIP_KEY = 'wanderlog_pending_shared_trip';
const PENDING_USER_KEY = 'wanderlog_pending_user_data';

export interface PendingUserData {
  name: string;
  role?: 'owner' | 'editor' | 'viewer';
  uid?: string;
  tripToken?: string;
}

export interface TripShareOptions {
  customOrigin?: string;
  user?: string | Collaborator;
  userId?: string;
  role?: string;
}

/**
 * Stores a target shared trip identifier in session storage to persist across login/reload screens.
 */
export function setPendingShareToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token && token.trim().length > 0) {
      sessionStorage.setItem(PENDING_TRIP_KEY, token.trim());
    } else {
      sessionStorage.removeItem(PENDING_TRIP_KEY);
    }
  } catch (e) {
    // Ignore storage restrictions
  }
}

/**
 * Retrieves the pending shared trip identifier from session storage.
 */
export function getPendingShareToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(PENDING_TRIP_KEY);
    return stored && stored.trim().length > 0 ? stored.trim() : null;
  } catch (e) {
    return null;
  }
}

/**
 * Clears the pending shared trip identifier once successfully activated.
 */
export function clearPendingShareToken(): void {
  setPendingShareToken(null);
}

/**
 * Consumes the pending trip token in one atomic operation (retrieves and clears it).
 */
export function consumePendingTrip(): string | null {
  const token = getPendingShareToken();
  if (token) {
    clearPendingShareToken();
  }
  return token;
}

/**
 * Checks if a pending shared trip is waiting to be opened after login.
 */
export function hasPendingSharedTrip(): boolean {
  return Boolean(getPendingShareToken());
}

/**
 * Stores pending user metadata in session storage.
 */
export function setPendingUserData(data: PendingUserData | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (data && data.name && data.name.trim().length > 0) {
      sessionStorage.setItem(PENDING_USER_KEY, JSON.stringify(data));
    } else {
      sessionStorage.removeItem(PENDING_USER_KEY);
    }
  } catch (e) {
    // Ignore storage restrictions
  }
}

/**
 * Retrieves pending user metadata from session storage.
 */
export function getPendingUserData(): PendingUserData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PENDING_USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.name === 'string' && parsed.name.trim().length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    // Ignore
  }
  return null;
}

/**
 * Clears the pending user metadata.
 */
export function clearPendingUserData(): void {
  setPendingUserData(null);
}

/**
 * Helper to safely sanitize and decode URL parameter values.
 */
function sanitizeUrlParam(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value.replace(/\+/g, ' ')).trim();
    return decoded.length > 0 ? decoded : null;
  } catch (_e) {
    const fallback = value.replace(/\+/g, ' ').trim();
    return fallback.length > 0 ? fallback : null;
  }
}

/**
 * Extracts personalized user information from URL search or hash.
 */
export function getUserFromUrl(searchString?: string): PendingUserData | null {
  if (typeof window === 'undefined' && !searchString) {
    return null;
  }

  try {
    const rawSearch = searchString !== undefined
      ? searchString
      : (typeof window !== 'undefined' ? window.location.search : '');

    if (rawSearch) {
      const cleanSearch = rawSearch.startsWith('?') ? rawSearch : `?${rawSearch}`;
      const params = new URLSearchParams(cleanSearch);
      const rawUserName =
        params.get('user') ||
        params.get('name') ||
        params.get('collab') ||
        params.get('member');

      const userName = sanitizeUrlParam(rawUserName);

      if (userName && userName.length > 0) {
        const rawRole = sanitizeUrlParam(params.get('role'));
        const role = (rawRole === 'owner' || rawRole === 'editor' || rawRole === 'viewer') ? rawRole : undefined;
        const uid = sanitizeUrlParam(params.get('uid') || params.get('userId')) || undefined;
        const tripToken = sanitizeUrlParam(params.get('trip') || params.get('tripId')) || undefined;

        const data: PendingUserData = {
          name: userName.slice(0, 100),
          role,
          uid,
          tripToken,
        };

        setPendingUserData(data);
        return data;
      }
    }

    // Check hash fragments (e.g. #user=Alex or #/trip/123?user=Alex)
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash.includes('user=') || hash.includes('name=') || hash.includes('collab=') || hash.includes('member=')) {
        const match = hash.match(/(?:user|name|collab|member)=([^&?#]+)/);
        if (match && match[1]) {
          const userName = sanitizeUrlParam(match[1]);
          if (userName && userName.length > 0) {
            const data: PendingUserData = { name: userName.slice(0, 100) };
            setPendingUserData(data);
            return data;
          }
        }
      }
    }

    return getPendingUserData();
  } catch (err) {
    console.warn('[urlTripSync] Error parsing user from URL:', err);
    return getPendingUserData();
  }
}

/**
 * Checks if the current URL query or hash contains a trip parameter.
 */
export function hasUrlTripParam(searchString?: string): boolean {
  if (typeof window === 'undefined' && !searchString) {
    return false;
  }

  try {
    const rawSearch = searchString !== undefined
      ? searchString
      : (typeof window !== 'undefined' ? window.location.search : '');

    if (rawSearch) {
      const params = new URLSearchParams(rawSearch.startsWith('?') ? rawSearch : `?${rawSearch}`);
      const tripParam =
        params.get('trip') ||
        params.get('tripId') ||
        params.get('shareToken') ||
        params.get('share') ||
        params.get('id');

      if (tripParam && tripParam.trim().length > 0) {
        return true;
      }
    }

    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash.includes('trip=') || hash.includes('share=') || hash.startsWith('trip/') || hash.startsWith('share/')) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Extracts and sanitizes the trip identifier from search string, hash, or window location.
 * Persists the parsed identifier in session storage so it survives auth/login prompts.
 */
export function getTripIdentifierFromUrl(searchString?: string): string | null {
  if (typeof window === 'undefined' && !searchString) {
    return null;
  }

  try {
    const rawSearch = searchString !== undefined
      ? searchString
      : (typeof window !== 'undefined' ? window.location.search : '');

    // 1. Check standard query parameters (?trip=..., ?tripId=..., ?shareToken=..., ?share=..., ?id=...)
    if (rawSearch) {
      const cleanSearch = rawSearch.startsWith('?') ? rawSearch : `?${rawSearch}`;
      const params = new URLSearchParams(cleanSearch);
      const rawTrip =
        params.get('trip') ||
        params.get('tripId') ||
        params.get('shareToken') ||
        params.get('share') ||
        params.get('id');

      const tripParam = sanitizeUrlParam(rawTrip);

      if (tripParam && tripParam.length > 0) {
        const sanitized = tripParam.slice(0, 100);
        setPendingShareToken(sanitized);
        return sanitized;
      }
    }

    // 2. Check hash fragments (e.g. #trip=wander-xyz, #/trip/wander-xyz, #share=wander-xyz)
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace(/^#\/?/, '');
      
      // Match ?trip= or &trip= or #trip=
      if (hash.includes('trip=') || hash.includes('share=')) {
        const match = hash.match(/(?:trip|share|shareToken)=([^&?#]+)/);
        if (match && match[1]) {
          const sanitized = sanitizeUrlParam(match[1]);
          if (sanitized && sanitized.length > 0) {
            const cleanToken = sanitized.slice(0, 100);
            setPendingShareToken(cleanToken);
            return cleanToken;
          }
        }
      }

      // Match path-based hash formats like #/trip/wander-123 or #trip/wander-123
      const pathMatch = hash.match(/(?:trip|share)\/([^&?#]+)/);
      if (pathMatch && pathMatch[1]) {
        const sanitized = sanitizeUrlParam(pathMatch[1]);
        if (sanitized && sanitized.length > 0) {
          const cleanToken = sanitized.slice(0, 100);
          setPendingShareToken(cleanToken);
          return cleanToken;
        }
      }
    }

    // 3. Fallback to pending token saved in session storage
    const pending = getPendingShareToken();
    if (pending && pending.length > 0) {
      return pending;
    }

    return null;
  } catch (error) {
    console.warn('[urlTripSync] Error parsing trip identifier from URL:', error);
    return getPendingShareToken();
  }
}

/**
 * Finds a matching trip from a list of trips by ID, shareToken, or case-insensitive shareToken/ID.
 */
export function findTripByIdentifier(trips: Trip[], identifier: string | null | undefined): Trip | undefined {
  if (!identifier || !trips || trips.length === 0) {
    return undefined;
  }

  const cleanId = identifier.trim();
  const lowerId = cleanId.toLowerCase();

  // 1. Exact match on ID or shareToken
  const exact = trips.find((t) => t.id === cleanId || t.shareToken === cleanId);
  if (exact) return exact;

  // 2. Case-insensitive match on ID or shareToken
  const caseInsensitive = trips.find(
    (t) => t.id.toLowerCase() === lowerId || (t.shareToken && t.shareToken.toLowerCase() === lowerId)
  );
  if (caseInsensitive) return caseInsensitive;

  return undefined;
}

/**
 * Builds the canonical shareable URL for a given trip (optionally personalized for a specific collaborator).
 */
export function getTripShareUrl(trip: Trip, options?: TripShareOptions | string): string {
  const customOrigin = typeof options === 'string' ? options : options?.customOrigin;
  const user = typeof options === 'object' ? options?.user : undefined;
  const userName = typeof user === 'object' ? user?.name : user;
  const userRole = typeof user === 'object' ? user?.role : (typeof options === 'object' ? options?.role : undefined);
  const userId = typeof user === 'object' ? user?.id : (typeof options === 'object' ? options?.userId : undefined);

  const token = trip.shareToken || trip.id;
  const params = new URLSearchParams();
  params.set('trip', token);

  if (userName && userName.trim()) {
    params.set('user', userName.trim());
  }
  if (userRole) {
    params.set('role', userRole);
  }
  if (userId) {
    params.set('uid', userId);
  }

  const queryString = params.toString();

  if (customOrigin) {
    const cleanOrigin = customOrigin.replace(/\/+$/, '');
    return `${cleanOrigin}/?${queryString}`;
  }

  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    const pathname = window.location.pathname || '/';
    return `${origin}${pathname}?${queryString}`;
  }

  return `https://wanderlog.app/?${queryString}`;
}

/**
 * Synchronizes the active trip to the browser's address bar without reloading the page.
 */
export function updateTripUrl(trip: Trip | null, options: { replace?: boolean } = { replace: true }): void {
  if (typeof window === 'undefined' || !window.history || !window.location) {
    return;
  }

  try {
    const currentUrl = new URL(window.location.href);
    const currentTripParam = currentUrl.searchParams.get('trip');

    if (trip) {
      const targetToken = trip.shareToken || trip.id;
      if (currentTripParam === targetToken) {
        return; // Already up-to-date
      }
      currentUrl.searchParams.set('trip', targetToken);
    } else {
      if (!currentTripParam) {
        return;
      }
      currentUrl.searchParams.delete('trip');
    }

    const newUrl = currentUrl.pathname + currentUrl.search + currentUrl.hash;

    if (options.replace) {
      window.history.replaceState({ tripId: trip?.id, shareToken: trip?.shareToken }, '', newUrl);
    } else {
      window.history.pushState({ tripId: trip?.id, shareToken: trip?.shareToken }, '', newUrl);
    }
  } catch (error) {
    // In restricted iframe environments or sandboxes, pushState / replaceState might throw SecurityError
    console.debug('[urlTripSync] Safe catch while updating URL:', error);
  }
}

/**
 * Copies the shareable trip URL to the clipboard.
 */
export async function copyTripShareLink(trip: Trip, options?: TripShareOptions): Promise<{ success: boolean; url: string }> {
  const url = getTripShareUrl(trip, options);

  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(url);
      return { success: true, url };
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback copy implementation for older browsers or restricted iframe environments
  try {
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (successful) {
        return { success: true, url };
      }
    }
  } catch (err) {
    console.warn('[urlTripSync] Fallback clipboard copy failed:', err);
  }

  return { success: false, url };
}
