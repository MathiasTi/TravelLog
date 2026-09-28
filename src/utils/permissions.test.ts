import { describe, it, expect } from 'vitest';
import {
  getUserRoleInTrip,
  isTripOwner,
  canManageCollaborators,
  canEditTripSettings,
  canCreateOrEditEntries,
  canDeleteEntry,
  ROLE_DEFINITIONS,
} from './permissions';
import { Trip, Collaborator, JournalEntry } from '../types';

const mockOwner: Collaborator = {
  id: 'user-owner',
  name: 'Alice Owner',
  avatar: 'https://avatar.url/1',
  color: '#E2725B',
  role: 'owner',
};

const mockEditor: Collaborator = {
  id: 'user-editor',
  name: 'Bob Editor',
  avatar: 'https://avatar.url/2',
  color: '#8A9A5B',
  role: 'editor',
};

const mockViewer: Collaborator = {
  id: 'user-viewer',
  name: 'Charlie Viewer',
  avatar: 'https://avatar.url/3',
  color: '#D4A373',
  role: 'viewer',
};

const mockStranger: Collaborator = {
  id: 'user-stranger',
  name: 'Dave Stranger',
  avatar: 'https://avatar.url/4',
  color: '#4E3B31',
  role: 'viewer',
};

const mockTrip: Trip = {
  id: 'trip-test-1',
  title: 'Alps Roadtrip',
  description: 'Exploring scenic routes',
  coverImage: 'https://example.com/cover.jpg',
  startDate: '2025-06-01',
  collaborators: [mockOwner, mockEditor, mockViewer],
  countryCodes: ['DE', 'AT'],
  passwordProtected: false,
  isPublic: true,
  shareToken: 'test-token-123',
  defaultCoordinates: [47.5, 11.2],
  defaultZoom: 8,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const mockEntry: JournalEntry = {
  id: 'entry-1',
  tripId: 'trip-test-1',
  title: 'Summit View',
  note: 'Amazing panorama',
  coordinates: { lat: 47.5, lng: 11.2 },
  locationName: 'Zugspitze',
  category: 'nature',
  date: '2025-06-02T10:00:00Z',
  author: mockEditor,
  media: [],
  comments: [],
  likes: [],
  syncStatus: 'synced',
  createdAt: '2025-06-02T10:00:00Z',
  updatedAt: '2025-06-02T10:00:00Z',
};

describe('Role-Based Access Control (RBAC) Permissions', () => {
  describe('ROLE_DEFINITIONS', () => {
    it('defines metadata for owner, editor, and viewer roles', () => {
      expect(ROLE_DEFINITIONS.owner).toBeDefined();
      expect(ROLE_DEFINITIONS.editor).toBeDefined();
      expect(ROLE_DEFINITIONS.viewer).toBeDefined();
      expect(ROLE_DEFINITIONS.owner.badgeLabel).toBe('Besitzer');
      expect(ROLE_DEFINITIONS.editor.badgeLabel).toBe('Editor');
      expect(ROLE_DEFINITIONS.viewer.badgeLabel).toBe('Nur Lesen');
    });
  });

  describe('getUserRoleInTrip', () => {
    it('returns "owner" for the registered owner collaborator', () => {
      expect(getUserRoleInTrip(mockTrip, mockOwner)).toBe('owner');
    });

    it('returns "editor" for the registered editor collaborator', () => {
      expect(getUserRoleInTrip(mockTrip, mockEditor)).toBe('editor');
    });

    it('returns "viewer" for the registered read-only viewer collaborator', () => {
      expect(getUserRoleInTrip(mockTrip, mockViewer)).toBe('viewer');
    });

    it('returns "viewer" for unlisted guest users in a collaborative trip', () => {
      expect(getUserRoleInTrip(mockTrip, mockStranger)).toBe('viewer');
    });

    it('returns "owner" if no trip is passed (e.g. creating new trip)', () => {
      expect(getUserRoleInTrip(null, mockStranger)).toBe('owner');
    });
  });

  describe('isTripOwner & canManageCollaborators & canEditTripSettings', () => {
    it('allows only the owner to manage collaborators and trip settings', () => {
      expect(isTripOwner(mockTrip, mockOwner)).toBe(true);
      expect(canManageCollaborators(mockTrip, mockOwner)).toBe(true);
      expect(canEditTripSettings(mockTrip, mockOwner)).toBe(true);

      expect(isTripOwner(mockTrip, mockEditor)).toBe(false);
      expect(canManageCollaborators(mockTrip, mockEditor)).toBe(false);
      expect(canEditTripSettings(mockTrip, mockEditor)).toBe(false);

      expect(isTripOwner(mockTrip, mockViewer)).toBe(false);
      expect(canManageCollaborators(mockTrip, mockViewer)).toBe(false);
      expect(canEditTripSettings(mockTrip, mockViewer)).toBe(false);
    });
  });

  describe('canCreateOrEditEntries', () => {
    it('permits owner and editor to create or edit journal entries', () => {
      expect(canCreateOrEditEntries(mockTrip, mockOwner)).toBe(true);
      expect(canCreateOrEditEntries(mockTrip, mockEditor)).toBe(true);
    });

    it('denies read-only viewers from creating or editing entries', () => {
      expect(canCreateOrEditEntries(mockTrip, mockViewer)).toBe(false);
      expect(canCreateOrEditEntries(mockTrip, mockStranger)).toBe(false);
    });
  });

  describe('canDeleteEntry', () => {
    it('allows trip owner and entry editor to delete entries', () => {
      expect(canDeleteEntry(mockEntry, mockTrip, mockOwner)).toBe(true);
      expect(canDeleteEntry(mockEntry, mockTrip, mockEditor)).toBe(true);
    });

    it('denies read-only viewers from deleting entries', () => {
      expect(canDeleteEntry(mockEntry, mockTrip, mockViewer)).toBe(false);
      expect(canDeleteEntry(mockEntry, mockTrip, mockStranger)).toBe(false);
    });
  });
});
