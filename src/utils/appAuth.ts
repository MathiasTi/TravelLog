import { Collaborator, UserRole } from '../types';

export const ADMIN_PASSWORD = 'AlpenGravel2026A';
export const VIEWER_PASSWORD = 'AlpenGravel2026';

export const APP_AUTH_STORAGE_KEY = 'alpengravel_auth_session_v2';

export interface AppAuthSession {
  userName: string;
  role: 'owner' | 'viewer';
  avatar: string;
  color: string;
  unlockedAt: string;
  rememberMe: boolean;
}

export const AVATAR_PRESETS = [
  {
    id: 'summit',
    label: 'Berggipfel',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=150&auto=format&fit=crop&q=80',
    color: '#8A9A5B'
  },
  {
    id: 'gravelbike',
    label: 'Gravelbike',
    url: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=150&auto=format&fit=crop&q=80',
    color: '#E2725B'
  },
  {
    id: 'lake',
    label: 'Bergsee',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=150&auto=format&fit=crop&q=80',
    color: '#457B9D'
  },
  {
    id: 'forest',
    label: 'Bergwald',
    url: 'https://images.unsplash.com/photo-1511497584788-87676104235f?w=150&auto=format&fit=crop&q=80',
    color: '#283618'
  },
  {
    id: 'compass',
    label: 'Kompass',
    url: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=150&auto=format&fit=crop&q=80',
    color: '#D4A373'
  },
  {
    id: 'camp',
    label: 'Alpencamp',
    url: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=150&auto=format&fit=crop&q=80',
    color: '#6B8E8E'
  }
];

/**
 * Validates the entered password against the configured access tiers.
 * - 'AlpenGravel2026A' -> 'owner' (Admin & Editionen)
 * - 'AlpenGravel2026' -> 'viewer' (Nur Schauen)
 * - any other -> null (Zugriff verweigert)
 */
export function validateAppPassword(password: string): 'owner' | 'viewer' | null {
  const trimmed = password.trim();
  if (trimmed === ADMIN_PASSWORD) {
    return 'owner';
  }
  if (trimmed === VIEWER_PASSWORD) {
    return 'viewer';
  }
  return null;
}

/**
 * Gets the current active session from LocalStorage or SessionStorage
 */
export function getStoredAppSession(): AppAuthSession | null {
  try {
    const rawLocal = localStorage.getItem(APP_AUTH_STORAGE_KEY);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal) as AppAuthSession;
      if (parsed && parsed.userName && (parsed.role === 'owner' || parsed.role === 'viewer')) {
        return parsed;
      }
    }

    const rawSession = sessionStorage.getItem(APP_AUTH_STORAGE_KEY);
    if (rawSession) {
      const parsed = JSON.parse(rawSession) as AppAuthSession;
      if (parsed && parsed.userName && (parsed.role === 'owner' || parsed.role === 'viewer')) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading app auth session:', e);
  }
  return null;
}

/**
 * Stores the app session
 */
export function storeAppSession(session: AppAuthSession): void {
  try {
    const serialized = JSON.stringify(session);
    if (session.rememberMe) {
      localStorage.setItem(APP_AUTH_STORAGE_KEY, serialized);
      sessionStorage.removeItem(APP_AUTH_STORAGE_KEY);
    } else {
      sessionStorage.setItem(APP_AUTH_STORAGE_KEY, serialized);
      localStorage.removeItem(APP_AUTH_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('Error saving app auth session:', e);
  }
}

/**
 * Clears the session upon logout
 */
export function clearAppSession(): void {
  try {
    localStorage.removeItem(APP_AUTH_STORAGE_KEY);
    sessionStorage.removeItem(APP_AUTH_STORAGE_KEY);
  } catch (e) {
    console.warn('Error clearing app auth session:', e);
  }
}

/**
 * Creates or updates a Collaborator object from the auth session
 */
export function createCollaboratorFromSession(session: AppAuthSession): Collaborator {
  const idSlug = session.userName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 20);

  return {
    id: `user-${idSlug || 'current'}`,
    name: session.userName,
    avatar: session.avatar || AVATAR_PRESETS[0].url,
    color: session.color || '#8A9A5B',
    role: session.role,
    email: undefined
  };
}
