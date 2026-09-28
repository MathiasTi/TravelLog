// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getTripIdentifierFromUrl,
  findTripByIdentifier,
  getTripShareUrl,
  updateTripUrl,
  copyTripShareLink,
} from './urlTripSync';
import { Trip } from '../types';

const MOCK_TRIPS: Trip[] = [
  {
    id: 'trip-alps-1',
    title: 'Alpenüberquerung 2026',
    description: 'Von Oberstdorf nach Meran',
    startDate: '2026-08-01',
    endDate: '2026-08-10',
    coverImage: 'https://images.unsplash.com/photo-1',
    passwordProtected: false,
    collaborators: [],
    shareToken: 'wander-alps-892f',
    countryCodes: ['DE', 'AT', 'IT'],
    isPublic: true,
    defaultCoordinates: [47.5, 11.5],
    defaultZoom: 7,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 'trip-japan-2',
    title: 'Japan Rundreise',
    description: 'Tokio bis Kyoto',
    startDate: '2026-09-01',
    endDate: '2026-09-20',
    coverImage: 'https://images.unsplash.com/photo-2',
    passwordProtected: true,
    collaborators: [],
    shareToken: 'wander-japan-441a',
    countryCodes: ['JP'],
    isPublic: false,
    defaultCoordinates: [35.68, 139.76],
    defaultZoom: 6,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
];

describe('urlTripSync Utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getTripIdentifierFromUrl', () => {
    it('extracts trip identifier from standard search string', () => {
      expect(getTripIdentifierFromUrl('?trip=wander-alps-892f')).toBe('wander-alps-892f');
      expect(getTripIdentifierFromUrl('trip=wander-japan-441a')).toBe('wander-japan-441a');
    });

    it('extracts trip identifier among multiple query parameters', () => {
      expect(getTripIdentifierFromUrl('?view=gallery&trip=trip-alps-1&mode=dark')).toBe('trip-alps-1');
    });

    it('extracts trip identifier from alternative parameter aliases (tripId, shareToken, share, id)', () => {
      expect(getTripIdentifierFromUrl('?tripId=wander-alps-892f')).toBe('wander-alps-892f');
      expect(getTripIdentifierFromUrl('?shareToken=wander-japan-441a')).toBe('wander-japan-441a');
      expect(getTripIdentifierFromUrl('?share=trip-alps-1')).toBe('trip-alps-1');
      expect(getTripIdentifierFromUrl('?id=trip-japan-2')).toBe('trip-japan-2');
    });

    it('extracts trip identifier from hash fragments', () => {
      window.location.hash = '#trip=wander-alps-892f';
      expect(getTripIdentifierFromUrl()).toBe('wander-alps-892f');
      window.location.hash = '';
    });

    it('returns null when trip parameter is missing or empty', () => {
      window.location.hash = '';
      sessionStorage.clear();
      expect(getTripIdentifierFromUrl('?view=gallery&mode=dark')).toBeNull();
      expect(getTripIdentifierFromUrl('?trip=')).toBeNull();
      expect(getTripIdentifierFromUrl('')).toBeNull();
    });

    it('sanitizes and trims parameter value', () => {
      expect(getTripIdentifierFromUrl('?trip=%20%20wander-alps-892f%20%20')).toBe('wander-alps-892f');
    });
  });

  describe('findTripByIdentifier', () => {
    it('finds trip by exact shareToken', () => {
      const match = findTripByIdentifier(MOCK_TRIPS, 'wander-alps-892f');
      expect(match).toBeDefined();
      expect(match?.id).toBe('trip-alps-1');
    });

    it('finds trip by exact ID', () => {
      const match = findTripByIdentifier(MOCK_TRIPS, 'trip-japan-2');
      expect(match).toBeDefined();
      expect(match?.title).toBe('Japan Rundreise');
    });

    it('finds trip case-insensitively', () => {
      const match = findTripByIdentifier(MOCK_TRIPS, 'WANDER-ALPS-892F');
      expect(match).toBeDefined();
      expect(match?.id).toBe('trip-alps-1');
    });

    it('returns undefined when no trip matches', () => {
      const match = findTripByIdentifier(MOCK_TRIPS, 'non-existent-token');
      expect(match).toBeUndefined();
    });

    it('returns undefined for empty input or empty trips list', () => {
      expect(findTripByIdentifier([], 'wander-alps-892f')).toBeUndefined();
      expect(findTripByIdentifier(MOCK_TRIPS, '')).toBeUndefined();
      expect(findTripByIdentifier(MOCK_TRIPS, null)).toBeUndefined();
    });
  });

  describe('getTripShareUrl', () => {
    it('builds canonical URL using current origin in browser environment', () => {
      const url = getTripShareUrl(MOCK_TRIPS[0]);
      expect(url).toContain('?trip=wander-alps-892f');
    });

    it('supports custom origin parameter', () => {
      const url = getTripShareUrl(MOCK_TRIPS[1], 'https://my-travel-blog.com');
      expect(url).toBe('https://my-travel-blog.com/?trip=wander-japan-441a');
    });

    it('falls back to trip ID if shareToken is not available', () => {
      const tripNoToken: Trip = { ...MOCK_TRIPS[0], shareToken: '' };
      const url = getTripShareUrl(tripNoToken, 'https://wanderlog.app');
      expect(url).toBe('https://wanderlog.app/?trip=trip-alps-1');
    });
  });

  describe('updateTripUrl', () => {
    it('updates URL search parameters without reloading', () => {
      const replaceSpy = vi.spyOn(window.history, 'replaceState');
      updateTripUrl(MOCK_TRIPS[0], { replace: true });
      expect(replaceSpy).toHaveBeenCalled();
      const calledUrl = replaceSpy.mock.calls[0][2];
      expect(calledUrl).toContain('trip=wander-alps-892f');
    });

    it('removes trip query parameter when trip is null', () => {
      window.history.pushState({}, '', '/?trip=wander-alps-892f');
      const replaceSpy = vi.spyOn(window.history, 'replaceState');
      updateTripUrl(null, { replace: true });
      expect(replaceSpy).toHaveBeenCalled();
    });
  });

  describe('copyTripShareLink', () => {
    it('copies URL to navigator.clipboard when available', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const res = await copyTripShareLink(MOCK_TRIPS[0]);
      expect(res.success).toBe(true);
      expect(res.url).toContain('wander-alps-892f');
      expect(writeTextMock).toHaveBeenCalledWith(res.url);
    });
  });
});
