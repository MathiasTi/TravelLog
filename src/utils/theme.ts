import { ThemeMode } from '../types';

export const THEME_STORAGE_KEY = 'wanderlog_theme_mode';

/**
 * Checks system preference for dark mode
 */
export function getSystemTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

/**
 * Retrieves the stored theme preference from localStorage if available
 */
export function getStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
  } catch {
    // Storage access might be restricted
  }
  return null;
}

/**
 * Resolves initial theme preference from storage, falling back to system preference
 */
export function getInitialTheme(): ThemeMode {
  const stored = getStoredTheme();
  if (stored) return stored;
  return getSystemTheme();
}

/**
 * Applies the dark/light class to <html> and updates the meta theme-color tag
 */
export function applyThemeToDOM(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  
  if (theme === 'dark') {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  }

  // Update mobile browser header color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#181614' : '#FDFBF7');
  }
}

/**
 * Persists theme preference to localStorage and applies it to DOM
 */
export function setStoredTheme(theme: ThemeMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage errors
  }
  applyThemeToDOM(theme);
}

/**
 * Helper to compute the next theme mode
 */
export function toggleThemeMode(currentTheme: ThemeMode): ThemeMode {
  return currentTheme === 'dark' ? 'light' : 'dark';
}
