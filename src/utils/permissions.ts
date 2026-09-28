import { Trip, Collaborator, UserRole, AuthUser, JournalEntry } from '../types';

export interface RoleMeta {
  role: UserRole;
  label: string;
  shortLabel: string;
  badgeLabel: string;
  description: string;
  permissionsSummary: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleMeta> = {
  owner: {
    role: 'owner',
    label: 'Inhaber / Besitzer (Owner)',
    shortLabel: 'Inhaber',
    badgeLabel: 'Besitzer',
    description: 'Volle Administrationsrechte für diese Reise. Kann Mitreisende einladen, Rollen (Editor / Nur Lesen) zuweisen, Passwörter verwalten und die Reise löschen.',
    permissionsSummary: 'Voller Lese- & Schreibzugriff + Rollen- & Reiseverwaltung',
    badgeBg: 'bg-[#E2725B]/10',
    badgeText: 'text-[#E2725B]',
    badgeBorder: 'border-[#E2725B]/30',
  },
  editor: {
    role: 'editor',
    label: 'Bearbeiter (Editor)',
    shortLabel: 'Bearbeiter',
    badgeLabel: 'Editor',
    description: 'Kann neue Reisetagebuch-Einträge verfassen, bestehende Stopps bearbeiten, Fotos hochladen sowie Kommentare und Reaktionen hinterlassen.',
    permissionsSummary: 'Einträge erstellen, bearbeiten & Medien hochladen',
    badgeBg: 'bg-[#8A9A5B]/10',
    badgeText: 'text-[#8A9A5B]',
    badgeBorder: 'border-[#8A9A5B]/30',
  },
  viewer: {
    role: 'viewer',
    label: 'Nur Lesen (Read-Only / Betrachter)',
    shortLabel: 'Nur Lesen',
    badgeLabel: 'Nur Lesen',
    description: 'Kann die Reiseroute auf der Weltkarte, die Chronik, Fotos und Statistiken ansehen. Keine Berechtigung zum Bearbeiten von Inhalten oder Einstellungen.',
    permissionsSummary: 'Reise ansehen, Route erkunden & Fotos betrachten',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-700',
    badgeBorder: 'border-sky-200',
  },
};

/**
 * Returns the effective role of a given user for a specific trip.
 */
export function getUserRoleInTrip(
  trip: Trip | null | undefined,
  user: Collaborator | AuthUser | null | undefined
): UserRole {
  if (!trip) return 'owner'; // default when creating new trip
  if (!user) return 'viewer';

  // If user is explicitly in view-only guest mode
  if ('role' in user && user.role === 'viewer') {
    return 'viewer';
  }

  const userId = 'uid' in user ? user.uid : user.id;
  const userEmail = ('email' in user ? user.email : undefined) || '';

  // Look for exact ID match or email match in trip collaborators
  const match = trip?.collaborators?.find(
    (c) => (c.id && c.id === userId) || (c.email && userEmail && c.email.toLowerCase() === userEmail.toLowerCase())
  );

  if (match) {
    return match.role || 'editor';
  }

  // If the trip has no collaborators configured, or user matches first collaborator
  if (!trip?.collaborators || trip.collaborators.length === 0) {
    return 'owner';
  }

  // If user is the creator / first collaborator
  if (trip.collaborators[0]?.id === userId) {
    return 'owner';
  }

  // Collaborating users on the same trip have editor rights to record and save travel entries
  return 'editor';
}

/**
 * Checks whether the user is the owner/admin of the trip.
 */
export function isTripOwner(
  trip: Trip | null | undefined,
  user: Collaborator | AuthUser | null | undefined
): boolean {
  if (!trip) return true; // Creator of new trip is owner
  const role = getUserRoleInTrip(trip, user);
  return role === 'owner';
}

/**
 * Checks whether the user can manage collaborators and assign roles.
 */
export function canManageCollaborators(
  trip: Trip | null | undefined,
  user: Collaborator | AuthUser | null | undefined
): boolean {
  return isTripOwner(trip, user);
}

/**
 * Checks whether the user can edit general trip settings (title, dates, password).
 */
export function canEditTripSettings(
  trip: Trip | null | undefined,
  user: Collaborator | AuthUser | null | undefined
): boolean {
  return isTripOwner(trip, user);
}

/**
 * Checks whether the user has write access to create or modify memories/entries.
 */
export function canCreateOrEditEntries(
  trip: Trip | null | undefined,
  user: Collaborator | AuthUser | null | undefined
): boolean {
  const role = getUserRoleInTrip(trip, user);
  return role === 'owner' || role === 'editor';
}

/**
 * Checks whether the user can delete an entry.
 */
export function canDeleteEntry(
  entry: JournalEntry | null | undefined,
  trip: Trip | null | undefined,
  user: Collaborator | AuthUser | null | undefined
): boolean {
  const role = getUserRoleInTrip(trip, user);
  if (role === 'owner') return true;
  if (role === 'editor') {
    if (!entry || !user) return true;
    const userId = 'uid' in user ? user.uid : user.id;
    // Editors can delete their own entries or any entry in the trip they edit
    return entry.author?.id === userId || true;
  }
  return false;
}
