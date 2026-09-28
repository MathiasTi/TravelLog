import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getSystemTheme,
  getStoredTheme,
  getInitialTheme,
  applyThemeToDOM,
  setStoredTheme,
  toggleThemeMode,
  THEME_STORAGE_KEY,
} from './theme';

describe('Dark Mode Theme Engine', () => {
  let mockStore: Record<string, string> = {};
  let mockClasses = new Set<string>();
  let mockAttributes: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    mockClasses.clear();
    mockAttributes = {};

    // Mock localStorage
    const localStorageMock = {
      getItem: (key: string) => mockStore[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStore[key] = String(val);
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
    };
    vi.stubGlobal('localStorage', localStorageMock);

    // Mock document
    const documentMock = {
      documentElement: {
        classList: {
          add: (cls: string) => mockClasses.add(cls),
          remove: (cls: string) => mockClasses.delete(cls),
          contains: (cls: string) => mockClasses.has(cls),
        },
        setAttribute: (k: string, v: string) => {
          mockAttributes[k] = v;
        },
        getAttribute: (k: string) => mockAttributes[k] ?? null,
        removeAttribute: (k: string) => {
          delete mockAttributes[k];
        },
      },
      querySelector: vi.fn().mockReturnValue(null),
    };
    vi.stubGlobal('document', documentMock);
    vi.stubGlobal('window', {
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('toggleThemeMode', () => {
    it('toggles from light to dark', () => {
      expect(toggleThemeMode('light')).toBe('dark');
    });

    it('toggles from dark to light', () => {
      expect(toggleThemeMode('dark')).toBe('light');
    });
  });

  describe('getStoredTheme & setStoredTheme', () => {
    it('returns null when no theme is stored', () => {
      expect(getStoredTheme()).toBeNull();
    });

    it('saves and retrieves theme in localStorage', () => {
      setStoredTheme('dark');
      expect(getStoredTheme()).toBe('dark');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

      setStoredTheme('light');
      expect(getStoredTheme()).toBe('light');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    });
  });

  describe('applyThemeToDOM', () => {
    it('adds dark class and data-theme="dark" when theme is dark', () => {
      applyThemeToDOM('dark');
      expect(mockClasses.has('dark')).toBe(true);
      expect(mockAttributes['data-theme']).toBe('dark');
    });

    it('removes dark class and sets data-theme="light" when theme is light', () => {
      applyThemeToDOM('dark');
      applyThemeToDOM('light');
      expect(mockClasses.has('dark')).toBe(false);
      expect(mockAttributes['data-theme']).toBe('light');
    });
  });

  describe('getInitialTheme', () => {
    it('prioritizes stored theme over system preference', () => {
      mockStore[THEME_STORAGE_KEY] = 'dark';
      expect(getInitialTheme()).toBe('dark');
    });

    it('falls back to default when no storage is set', () => {
      const theme = getInitialTheme();
      expect(['light', 'dark']).toContain(theme);
    });
  });
});
