/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Trip, JournalEntry, Collaborator, ViewMode, Coordinates, SyncState, AuthUser, AuthModalTab, EntrySortMode, ThemeMode, CategoryType } from './types';
import { storage } from './services/storage';
import { syncEngine } from './services/syncEngine';
import { authService, authUserToCollaborator, firestoreService } from './services/firebase';
import { Header } from './components/Header';
import { TravelMap } from './components/Map/TravelMap';
import { TimelineView } from './components/Views/TimelineView';
import { GalleryView } from './components/Views/GalleryView';
import { StatsView } from './components/Views/StatsView';
import { EntryModal } from './components/Modals/EntryModal';
import { EntryDetailModal } from './components/Modals/EntryDetailModal';
import { TripModal } from './components/Modals/TripModal';
import { PasswordLockModal } from './components/Modals/PasswordLockModal';
import { AuthModal } from './components/Modals/AuthModal';
import { AccountManagementModal } from './components/Modals/AccountManagementModal';
import { MobileSyncQrModal } from './components/Modals/MobileSyncQrModal';
import { ChangelogModal } from './components/Modals/ChangelogModal';
import { TrackUploadModal } from './components/Tracks/TrackUploadModal';
import { ExportModal } from './components/Modals/ExportModal';
import { BackupRestoreModal } from './components/Modals/BackupRestoreModal';
import { MobileBottomNav } from './components/Mobile/MobileBottomNav';
import { Toast } from './components/Toast';
import { canCreateOrEditEntries } from './utils/permissions';
import { getInitialTheme, setStoredTheme, applyThemeToDOM, toggleThemeMode } from './utils/theme';
import {
  getTripIdentifierFromUrl,
  findTripByIdentifier,
  updateTripUrl,
  copyTripShareLink,
  clearPendingShareToken,
  getPendingShareToken,
  getUserFromUrl,
} from './utils/urlTripSync';
import { formatTourDuration } from './services/trackParser';
import { GpsTrackData } from './types';
import { ImagePlus, Plus } from 'lucide-react';
import { AppGateScreen } from './components/Auth/AppGateScreen';
import {
  getStoredAppSession,
  storeAppSession,
  clearAppSession,
  createCollaboratorFromSession,
  AppAuthSession,
} from './utils/appAuth';

export default function App() {
  const [appAuthSession, setAppAuthSession] = useState<AppAuthSession | null>(() => {
    const userFromUrl = getUserFromUrl();
    const stored = getStoredAppSession();
    // If a personalized link for a specific user was opened that differs from current stored user, prompt login for them
    if (userFromUrl && userFromUrl.name && stored && stored.userName.toLowerCase() !== userFromUrl.name.toLowerCase()) {
      return null;
    }
    return stored;
  });
  const targetSharedTokenRef = useRef<string | null>(getTripIdentifierFromUrl());
  const [trips, setTrips] = useState<Trip[]>(() => storage.getTrips());
  const [entries, setEntries] = useState<JournalEntry[]>(() => storage.getEntries());
  const [activeTripId, setActiveTripId] = useState<string>(() => {
    const tripTokenFromUrl = getTripIdentifierFromUrl();
    if (tripTokenFromUrl) {
      const storedTrips = storage.getTrips();
      const matched = findTripByIdentifier(storedTrips, tripTokenFromUrl);
      if (matched) return matched.id;
    }
    return storage.getActiveTripId();
  });
  const [currentUser, setCurrentUser] = useState<Collaborator>(() => {
    const session = getStoredAppSession();
    if (session) return createCollaboratorFromSession(session);
    return storage.getCurrentUser();
  });
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [syncState, setSyncState] = useState<SyncState>(() => syncEngine.getSyncState());
  const [unlockedTrips, setUnlockedTrips] = useState<string[]>(() => storage.getUnlockedTrips());
  const [sortMode, setSortMode] = useState<EntrySortMode>('date_asc');
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  // Authentication State
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => authService.getCurrentAuthUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<AuthModalTab>('login');
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isMobileSyncQrOpen, setIsMobileSyncQrOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);

  // Apply Theme on change / mount
  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  const handleToggleTheme = () => {
    const nextTheme = toggleThemeMode(theme);
    setTheme(nextTheme);
    setStoredTheme(nextTheme);
    showToast(
      nextTheme === 'dark'
        ? 'Dunkelmodus (Nachtansicht) aktiviert 🌙'
        : 'Heller Modus aktiviert ☀️',
      'info'
    );
  };

  // Modal States
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [initialCoordsForEntry, setInitialCoordsForEntry] = useState<Coordinates | null>(null);
  const [initialAddressForEntry, setInitialAddressForEntry] = useState<string | undefined>(undefined);
  const [initialTitleForEntry, setInitialTitleForEntry] = useState<string | undefined>(undefined);
  const [initialNoteForEntry, setInitialNoteForEntry] = useState<string | undefined>(undefined);
  const [initialDateForEntry, setInitialDateForEntry] = useState<string | undefined>(undefined);
  const [initialCategoryForEntry, setInitialCategoryForEntry] = useState<CategoryType | undefined>(undefined);

  const [selectedEntryDetail, setSelectedEntryDetail] = useState<JournalEntry | null>(null);
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [tripToUnlock, setTripToUnlock] = useState<Trip | null>(null);

  const [isTrackUploadModalOpen, setIsTrackUploadModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupModalTab, setBackupModalTab] = useState<'backup' | 'restore'>('backup');

  const [focusedEntryIdOnMap, setFocusedEntryIdOnMap] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Auth State Listener
  useEffect(() => {
    const unsubscribeAuth = authService.onAuthStateChange((user) => {
      setAuthUser(user);
      if (user) {
        const mappedCollab = authUserToCollaborator(user);
        setCurrentUser(mappedCollab);
        storage.setCurrentUser(mappedCollab);
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // Initialize data and sync engine subscriptions
  useEffect(() => {
    // 1. Subscribe to Sync Engine updates
    const unsubSync = syncEngine.subscribeSync((state) => {
      setSyncState(state);
    });

    const unsubData = syncEngine.subscribeData(({ trips: remoteTrips, entries: remoteEntries }) => {
      setTrips(remoteTrips);
      setEntries(remoteEntries);

      // Keep open entry detail view live-synchronized with incoming changes (e.g. comments, likes, edits from others)
      setSelectedEntryDetail((prevDetail) => {
        if (!prevDetail) return null;
        const fresh = remoteEntries.find((e) => e.id === prevDetail.id);
        return fresh || null;
      });

      // Check if we have a pending target trip token from link that we haven't selected yet
      const pendingToken = targetSharedTokenRef.current || getTripIdentifierFromUrl();
      if (pendingToken) {
        const matched = findTripByIdentifier(remoteTrips, pendingToken);
        if (matched) {
          setActiveTripId(matched.id);
          storage.setActiveTripId(matched.id);
          clearPendingShareToken();
          targetSharedTokenRef.current = null;
          updateTripUrl(matched, { replace: true });
        }
      }
    });

    // 2. Fetch initial data from server or local
    const targetToken = targetSharedTokenRef.current || getTripIdentifierFromUrl();
    syncEngine.fetchInitialData(targetToken || undefined).then(({ trips: loadedTrips, entries: loadedEntries }) => {
      setTrips(loadedTrips);
      setEntries(loadedEntries);

      // Check URL / pending token for shared trip link (e.g. ?trip=wander-alps-892f)
      const tokenToResolve = targetSharedTokenRef.current || targetToken;
      if (tokenToResolve) {
        const matched = findTripByIdentifier(loadedTrips, tokenToResolve);
        if (matched) {
          checkAndSelectTrip(matched, loadedTrips);
          clearPendingShareToken();
          targetSharedTokenRef.current = null;
          showToast(`Reise „${matched.title}“ geöffnet! 🎒`, 'info');
        }
      }
    });

    return () => {
      unsubSync();
      unsubData();
    };
  }, []);

  // Show Toast Helper
  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Find currently active trip
  const activeTrip = trips.find((t) => t.id === activeTripId) || trips[0] || null;

  // Filter entries for active trip
  const activeEntries = entries.filter((e) => e.tripId === activeTrip?.id);

  // Synchronize active trip with URL query parameter (?trip=...)
  useEffect(() => {
    // Prevent overwriting URL if we are actively waiting for remote target trip resolution
    if (targetSharedTokenRef.current && !findTripByIdentifier(trips, targetSharedTokenRef.current)) {
      return;
    }
    if (activeTrip) {
      updateTripUrl(activeTrip, { replace: true });
    }
  }, [activeTrip?.id, activeTrip?.shareToken, trips]);

  // Browser navigation (Back / Forward buttons popstate)
  useEffect(() => {
    const handlePopState = () => {
      const token = getTripIdentifierFromUrl();
      if (token) {
        const matched = findTripByIdentifier(trips, token);
        if (matched && matched.id !== activeTripId) {
          checkAndSelectTrip(matched, trips);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [trips, activeTripId, unlockedTrips]);

  // 1-Click Copy Trip Share Link handler
  const handleCopyTripShareLink = async (targetTrip?: Trip | null) => {
    const tripToShare = targetTrip || activeTrip;
    if (!tripToShare) return;

    const result = await copyTripShareLink(tripToShare);
    if (result.success) {
      showToast(`Link zur Reise "${tripToShare.title}" in Zwischenablage kopiert!`, 'success');
    } else {
      showToast(`Link zur Reise: ${result.url}`, 'info');
    }
  };

  // Trip Selection with Password Protection Check
  const checkAndSelectTrip = (targetTrip: Trip, currentTripsList: Trip[] = trips) => {
    if (targetTrip.passwordProtected && !unlockedTrips.includes(targetTrip.id)) {
      setTripToUnlock(targetTrip);
      setIsPasswordModalOpen(true);
      return;
    }

    setActiveTripId(targetTrip.id);
    storage.setActiveTripId(targetTrip.id);
    updateTripUrl(targetTrip, { replace: false });
  };

  const handleSelectTrip = (tripId: string) => {
    const target = trips.find((t) => t.id === tripId);
    if (target) {
      checkAndSelectTrip(target);
    }
  };

  // Password Unlock verification
  const handleUnlockPassword = async (password: string): Promise<boolean> => {
    if (!tripToUnlock) return false;

    // Try server verification or local hash match
    let isValid = false;
    if (tripToUnlock.passwordHash && tripToUnlock.passwordHash === password) {
      isValid = true;
    } else {
      try {
        const res = await fetch(`/api/trips/${tripToUnlock.id}/verify-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        if (res.ok) {
          const data = await res.json();
          isValid = Boolean(data.valid);
        }
      } catch (e) {
        console.warn('Verify password network error:', e);
      }
    }

    if (isValid) {
      storage.addUnlockedTrip(tripToUnlock.id);
      setUnlockedTrips((prev) => [...prev, tripToUnlock.id]);
      setActiveTripId(tripToUnlock.id);
      storage.setActiveTripId(tripToUnlock.id);
      showToast(`Reise "${tripToUnlock.title}" erfolgreich entsperrt!`, 'success');
      return true;
    }

    return false;
  };

  // Ensure logged-in user is automatically registered as a collaborator on active trip
  useEffect(() => {
    if (!activeTrip || !currentUser || !currentUser.id) return;
    const userId = currentUser.id;
    const userEmail = currentUser.email || '';

    const alreadyCollaborator = activeTrip.collaborators?.some(
      (c) => (c.id && c.id === userId) || (c.email && userEmail && c.email.toLowerCase() === userEmail.toLowerCase())
    );

    if (!alreadyCollaborator) {
      const isFirst = !activeTrip.collaborators || activeTrip.collaborators.length === 0;
      const newCollab: Collaborator = {
        id: userId,
        name: currentUser.name || 'Reisender',
        email: currentUser.email,
        avatar: currentUser.avatar,
        color: currentUser.color || '#8A9A5B',
        role: isFirst ? 'owner' : 'editor',
      };

      const updatedCollaborators = [...(activeTrip.collaborators || []), newCollab];
      const updatedTrip: Trip = {
        ...activeTrip,
        collaborators: updatedCollaborators,
        updatedAt: new Date().toISOString(),
      };

      const updatedTrips = trips.map((t) => (t.id === updatedTrip.id ? updatedTrip : t));
      setTrips(updatedTrips);
      storage.setTrips(updatedTrips);

      firestoreService.saveTrip(updatedTrip).catch((err) => console.warn('Firestore collab save warning:', err));
      fetch(`/api/trips/${updatedTrip.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTrip),
      }).catch((err) => console.warn('REST collab save warning:', err));
    }
  }, [activeTrip?.id, currentUser?.id]);

  // Save / Update Entry
  const handleSaveEntry = (entryData: Partial<JournalEntry>) => {
    if (editingEntry) {
      // Update
      const updatedEntry: JournalEntry = {
        ...editingEntry,
        ...entryData,
        updatedAt: new Date().toISOString(),
      } as JournalEntry;

      const updatedEntries = entries.map((e) => (e.id === updatedEntry.id ? updatedEntry : e));
      setEntries(updatedEntries);
      storage.setEntries(updatedEntries);
      storage.addToSyncQueue({
        action: 'update_entry',
        payload: updatedEntry,
      });

      // Direct Firestore & REST call
      firestoreService.saveEntry(updatedEntry).catch((err) => console.warn('Firestore entry PUT warning:', err));
      fetch(`/api/entries/${updatedEntry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedEntry),
      }).catch((err) => console.warn('Direct entry PUT warning:', err));

      setFocusedEntryIdOnMap(updatedEntry.id);
      showToast('Erinnerung erfolgreich aktualisiert!', 'success');
    } else {
      // Create
      let targetTripId = entryData.tripId || activeTrip?.id;
      if (!targetTripId) {
        // Automatically provision a default trip if none exists yet
        const initialTrip: Trip = {
          id: `trip-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          title: 'Meine erste Reise',
          description: 'Mein persönliches Reisetagebuch',
          coverImage: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&auto=format&fit=crop&q=80',
          startDate: new Date().toISOString().split('T')[0],
          countryCodes: [],
          passwordProtected: false,
          passwordHash: '',
          isPublic: true,
          shareToken: `wander-${Math.random().toString(36).substring(2, 7)}`,
          collaborators: [currentUser],
          defaultCoordinates: entryData.coordinates ? [entryData.coordinates.lat, entryData.coordinates.lng] : [48.137, 11.576],
          defaultZoom: 7,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const updatedTrips = [initialTrip, ...trips];
        setTrips(updatedTrips);
        storage.setTrips(updatedTrips);
        setActiveTripId(initialTrip.id);
        storage.setActiveTripId(initialTrip.id);
        storage.addToSyncQueue({
          action: 'create_trip',
          payload: initialTrip,
        });

        firestoreService.saveTrip(initialTrip).catch((err) => console.warn('Firestore trip save warning:', err));
        fetch('/api/trips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(initialTrip),
        }).catch((err) => console.warn('Direct trip POST warning:', err));

        targetTripId = initialTrip.id;
      }

      const newEntry: JournalEntry = {
        id: `entry-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        tripId: targetTripId,
        title: entryData.title || 'Reiseerinnerung',
        note: entryData.note || '',
        coordinates: entryData.coordinates || { lat: 48.137, lng: 11.576 },
        locationName: entryData.locationName || 'Unbekannter Ort',
        date: entryData.date || new Date().toISOString(),
        weather: entryData.weather,
        mood: entryData.mood,
        category: entryData.category || 'sight',
        media: entryData.media || [],
        author: currentUser,
        comments: [],
        likes: [],
        syncStatus: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedEntries = [newEntry, ...entries];
      setEntries(updatedEntries);
      storage.setEntries(updatedEntries);
      storage.addToSyncQueue({
        action: 'create_entry',
        payload: newEntry,
      });

      // Direct Firestore & REST call
      firestoreService.saveEntry(newEntry).catch((err) => console.warn('Firestore entry save warning:', err));
      fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntry),
      }).catch((err) => console.warn('Direct entry POST warning:', err));

      if (activeTrip && activeTrip.id !== targetTripId) {
        setActiveTripId(targetTripId);
        storage.setActiveTripId(targetTripId);
      }

      setFocusedEntryIdOnMap(newEntry.id);
      showToast('Neuer Reise-Stopp erfolgreich hinzugefügt!', 'success');
    }

    // Trigger background sync
    syncEngine.syncNow().catch((e) => console.warn('Background sync warning:', e));
  };

  // Delete Entry
  const handleDeleteEntry = (entryId: string) => {
    const updatedEntries = entries.filter((e) => e.id !== entryId);
    setEntries(updatedEntries);
    storage.setEntries(updatedEntries);
    if (selectedEntryDetail?.id === entryId) {
      setSelectedEntryDetail(null);
    }
    storage.addToSyncQueue({
      action: 'delete_entry',
      payload: { id: entryId },
    });

    firestoreService.deleteEntry(entryId).catch((err) => console.warn('Firestore entry delete warning:', err));
    fetch(`/api/entries/${entryId}`, {
      method: 'DELETE',
    }).catch((err) => console.warn('Direct entry DELETE warning:', err));
    showToast('Eintrag erfolgreich gelöscht', 'info');
    syncEngine.syncNow().catch((e) => console.warn('Background sync warning:', e));
  };

  // Reorder Entries Handler
  const handleReorderEntries = (reorderedEntries: JournalEntry[]) => {
    // Assign orderIndex to each entry in the provided sequence
    const reorderedWithIndex = reorderedEntries.map((entry, index) => ({
      ...entry,
      orderIndex: index,
      updatedAt: new Date().toISOString(),
    }));

    const reorderedMap = new Map(reorderedWithIndex.map((e) => [e.id, e]));
    const newAllEntries = entries.map((e) => reorderedMap.get(e.id) || e);

    setEntries(newAllEntries);
    storage.setEntries(newAllEntries);
    setSortMode('custom');

    // Update locally selected detail view if open
    if (selectedEntryDetail && reorderedMap.has(selectedEntryDetail.id)) {
      setSelectedEntryDetail(reorderedMap.get(selectedEntryDetail.id)!);
    }

    // Push updates to sync queue, Firestore and backend
    reorderedWithIndex.forEach((entry) => {
      storage.addToSyncQueue({
        action: 'update_entry',
        payload: entry,
      });

      firestoreService.saveEntry(entry).catch((err) => console.warn('Firestore reorder entry warning:', err));
      fetch(`/api/entries/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      }).catch((err) => console.warn('Sync reorder entry PUT warning:', err));
    });

    showToast('Reihenfolge der Stopps erfolgreich gespeichert!', 'success');
    syncEngine.syncNow().catch((e) => console.warn('Background sync warning:', e));
  };

  // Add Comment to Entry
  const handleAddComment = (entryId: string, text: string) => {
    const comment = {
      id: `comment-${Date.now()}`,
      author: currentUser,
      text,
      timestamp: new Date().toISOString(),
      reactions: [],
    };

    let updatedTargetEntry: JournalEntry | null = null;
    const updatedEntries = entries.map((e) => {
      if (e.id === entryId) {
        const item: JournalEntry = {
          ...e,
          comments: [...(e.comments || []), comment],
          updatedAt: new Date().toISOString(),
        };
        updatedTargetEntry = item;
        return item;
      }
      return e;
    });

    setEntries(updatedEntries);
    storage.setEntries(updatedEntries);

    // Update opened detail view if open
    if (selectedEntryDetail?.id === entryId) {
      setSelectedEntryDetail((prev) => (prev ? { ...prev, comments: [...(prev.comments || []), comment] } : null));
    }

    if (updatedTargetEntry) {
      firestoreService.saveEntry(updatedTargetEntry).catch((err) => console.warn('Firestore comment sync warning:', err));
    }

    storage.addToSyncQueue({
      action: 'add_comment',
      payload: { entryId, comment },
    });

    syncEngine.syncNow();
  };

  // Toggle Like on Entry
  const handleToggleLike = (entryId: string) => {
    let updatedTargetEntry: JournalEntry | null = null;
    const updatedEntries = entries.map((e) => {
      if (e.id === entryId) {
        const likes = e.likes || [];
        const hasLiked = likes.includes(currentUser.id);
        const newLikes = hasLiked ? likes.filter((id) => id !== currentUser.id) : [...likes, currentUser.id];
        const item: JournalEntry = {
          ...e,
          likes: newLikes,
          updatedAt: new Date().toISOString(),
        };
        updatedTargetEntry = item;
        return item;
      }
      return e;
    });

    setEntries(updatedEntries);
    storage.setEntries(updatedEntries);

    if (selectedEntryDetail?.id === entryId) {
      setSelectedEntryDetail((prev) => {
        if (!prev) return null;
        const likes = prev.likes || [];
        const hasLiked = likes.includes(currentUser.id);
        return {
          ...prev,
          likes: hasLiked ? likes.filter((id) => id !== currentUser.id) : [...likes, currentUser.id],
        };
      });
    }

    if (updatedTargetEntry) {
      firestoreService.saveEntry(updatedTargetEntry).catch((err) => console.warn('Firestore like sync warning:', err));
    }

    storage.addToSyncQueue({
      action: 'add_like',
      payload: { entryId, userId: currentUser.id },
    });

    syncEngine.syncNow();
  };

  // Save / Create / Update Trip
  const handleSaveTrip = (tripData: Partial<Trip>) => {
    const targetTrip = editingTrip || (tripData.id ? trips.find((t) => t.id === tripData.id) : null);
    if (targetTrip) {
      // Update
      const updated: Trip = {
        ...targetTrip,
        ...tripData,
        updatedAt: new Date().toISOString(),
      } as Trip;

      const updatedTrips = trips.map((t) => (t.id === updated.id ? updated : t));
      setTrips(updatedTrips);
      storage.setTrips(updatedTrips);
      storage.addToSyncQueue({
        action: 'update_trip',
        payload: updated,
      });

      firestoreService.saveTrip(updated).catch((err) => console.warn('Firestore trip update warning:', err));
      fetch(`/api/trips/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch((err) => console.warn('REST trip PUT warning:', err));

      syncEngine.syncNow().catch((e) => console.warn('Sync error:', e));
      showToast('Reise-Einstellungen gespeichert!', 'success');
    } else {
      // Create new trip
      const newTrip: Trip = {
        id: `trip-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: tripData.title || 'Neue Reise',
        description: tripData.description || '',
        coverImage:
          tripData.coverImage ||
          'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&auto=format&fit=crop&q=80',
        startDate: tripData.startDate || new Date().toISOString().split('T')[0],
        endDate: tripData.endDate,
        countryCodes: [],
        passwordProtected: Boolean(tripData.passwordProtected),
        passwordHash: tripData.passwordHash || '',
        isPublic: true,
        shareToken: `wander-${Math.random().toString(36).substring(2, 7)}`,
        collaborators: tripData.collaborators || [currentUser],
        defaultCoordinates: [48.137, 11.576],
        defaultZoom: 7,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedTrips = [newTrip, ...trips];
      setTrips(updatedTrips);
      storage.setTrips(updatedTrips);
      setActiveTripId(newTrip.id);
      storage.setActiveTripId(newTrip.id);

      storage.addToSyncQueue({
        action: 'create_trip',
        payload: newTrip,
      });

      firestoreService.saveTrip(newTrip).catch((err) => console.warn('Firestore trip create warning:', err));
      fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTrip),
      }).catch((err) => console.warn('REST trip POST warning:', err));

      showToast(`Reise "${newTrip.title}" erfolgreich erstellt!`, 'success');
      syncEngine.syncNow().catch((e) => console.warn('Sync error:', e));
    }
  };

  // Delete Trip
  const handleDeleteTrip = (tripId: string) => {
    const updatedTrips = trips.filter((t) => t.id !== tripId);
    const updatedEntries = entries.filter((e) => e.tripId !== tripId);

    setTrips(updatedTrips);
    setEntries(updatedEntries);
    storage.setTrips(updatedTrips);
    storage.setEntries(updatedEntries);

    if (updatedTrips.length > 0) {
      setActiveTripId(updatedTrips[0].id);
      storage.setActiveTripId(updatedTrips[0].id);
    }

    storage.addToSyncQueue({
      action: 'delete_trip',
      payload: { id: tripId },
    });

    firestoreService.deleteTrip(tripId).catch((err) => console.warn('Firestore trip delete warning:', err));
    fetch(`/api/trips/${tripId}`, {
      method: 'DELETE',
    }).catch((err) => console.warn('REST trip DELETE warning:', err));

    showToast('Reise und zugehörige Einträge wurden gelöscht', 'info');
    syncEngine.syncNow();
  };

  // Map coordinate click handler
  const handleMapAddAtCoords = (
    coords: Coordinates,
    address?: string,
    extra?: {
      title?: string;
      note?: string;
      date?: string;
      category?: CategoryType;
    }
  ) => {
    setEditingEntry(null);
    setInitialCoordsForEntry(coords);
    setInitialAddressForEntry(address);
    setInitialTitleForEntry(extra?.title);
    setInitialNoteForEntry(extra?.note);
    setInitialDateForEntry(extra?.date);
    setInitialCategoryForEntry(extra?.category);
    setIsEntryModalOpen(true);
  };

  // Save parsed GPX / FIT track as journal entry in active trip
  const handleSaveTrackAsEntry = (track: GpsTrackData) => {
    const currentActiveTrip = activeTrip || trips[0];
    if (!currentActiveTrip) {
      showToast('Bitte wähle zuerst eine Reise aus, um den Track zu speichern.', 'info');
      return;
    }

    const startPt = track.points[0];
    const summary = track.summary;

    const noteLines = [
      `🚴 GPS-Tour: ${track.title}`,
      `📏 Distanz: ${summary.totalDistanceKm} km`,
      `⛰️ Höhenmeter: +${summary.elevationGainM} hm (Passhöhe / Max: ${summary.maxAltitudeM} m)`,
      `⏱️ Fahrzeit: ${formatTourDuration(summary.totalDurationSec)}`,
      `⚡ Tempo: Ø ${summary.avgSpeedKmh} km/h (Top: ${summary.maxSpeedKmh} km/h)`,
    ];

    if (summary.avgHeartRate) {
      noteLines.push(`❤️ Puls: Ø ${summary.avgHeartRate} bpm (Max: ${summary.maxHeartRate} bpm)`);
    }
    if (summary.avgPower) {
      noteLines.push(`⚡ Leistung: Ø ${summary.avgPower} Watt (Max: ${summary.maxPower} Watt)`);
    }
    if (summary.totalCalories) {
      noteLines.push(`🔥 Energie: ${summary.totalCalories} kcal`);
    }

    const newEntry: JournalEntry = {
      id: `entry-track-${Date.now()}`,
      tripId: currentActiveTrip.id,
      title: `🚴 ${track.title}`,
      note: noteLines.join('\n'),
      coordinates: { lat: startPt.lat, lng: startPt.lng },
      locationName: `${track.title} (${summary.totalDistanceKm} km, +${summary.elevationGainM} hm)`,
      date: summary.startTime ? summary.startTime.split('T')[0] : new Date().toISOString().split('T')[0],
      category: 'activity',
      track,
      media: [
        {
          id: `media-${Date.now()}`,
          type: 'photo',
          url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1200&auto=format&fit=crop&q=80',
          caption: `GPS Tour: ${track.title}`,
          timestamp: summary.startTime || new Date().toISOString(),
        },
      ],
      author: currentUser,
      comments: [],
      likes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    handleSaveEntry(newEntry);
    showToast(`Track "${track.title}" als Tagebucheintrag angelegt!`, 'success');
  };

  // Attach GPS Track directly to Trip's route layer
  const handleAttachTrackToTrip = (track: GpsTrackData) => {
    const currentActiveTrip = activeTrip || trips[0];
    if (!currentActiveTrip) {
      showToast('Bitte wähle zuerst eine Reise aus.', 'info');
      return;
    }

    const currentTracks = currentActiveTrip.tracks || [];
    const updatedTracks = [...currentTracks.filter((t) => t.id !== track.id), track];
    const updatedTrip: Trip = {
      ...currentActiveTrip,
      tracks: updatedTracks,
      updatedAt: new Date().toISOString(),
    };

    const updatedTrips = trips.map((t) => (t.id === updatedTrip.id ? updatedTrip : t));
    setTrips(updatedTrips);
    storage.setTrips(updatedTrips);
    storage.addToSyncQueue({
      action: 'update_trip',
      payload: updatedTrip,
    });
    syncEngine.syncNow().catch((e) => console.warn('Sync error:', e));

    setViewMode('map');
    showToast(`GPS-Track "${track.title}" erfolgreich als Route auf der Karte angeheftet! 🗺️`, 'success');
  };

  // Remove attached GPS track from Trip
  const handleRemoveTrackFromTrip = (trackId: string) => {
    const currentActiveTrip = activeTrip || trips[0];
    if (!currentActiveTrip) return;

    const currentTracks = currentActiveTrip.tracks || [];
    const targetTrack = currentTracks.find((t) => t.id === trackId);
    const updatedTracks = currentTracks.filter((t) => t.id !== trackId);
    const updatedTrip: Trip = {
      ...currentActiveTrip,
      tracks: updatedTracks,
      updatedAt: new Date().toISOString(),
    };

    const updatedTrips = trips.map((t) => (t.id === updatedTrip.id ? updatedTrip : t));
    setTrips(updatedTrips);
    storage.setTrips(updatedTrips);
    storage.addToSyncQueue({
      action: 'update_trip',
      payload: updatedTrip,
    });
    syncEngine.syncNow().catch((e) => console.warn('Sync error:', e));

    showToast(`GPS-Track "${targetTrack?.title || 'Route'}" von der Karte gelöst.`, 'info');
  };

  // Focus Entry on Map
  const handleFocusOnMap = (entry: JournalEntry) => {
    setFocusedEntryIdOnMap(entry.id);
    setViewMode('map');
  };

  // App Unlock & Auth Gatekeeper Handlers
  const handleUnlockApp = async (session: AppAuthSession) => {
    storeAppSession(session);
    setAppAuthSession(session);
    const userCollab = createCollaboratorFromSession(session);
    setCurrentUser(userCollab);
    storage.setCurrentUser(userCollab);

    const pendingToken = targetSharedTokenRef.current || getTripIdentifierFromUrl() || getPendingShareToken();
    if (pendingToken) {
      // 1. Try resolving from current trips
      const matched = findTripByIdentifier(trips, pendingToken);
      if (matched) {
        checkAndSelectTrip(matched, trips);
        clearPendingShareToken();
        targetSharedTokenRef.current = null;
        showToast(`Willkommen, ${userCollab.name}! Reise „${matched.title}“ wurde geöffnet.`, 'success');
      } else {
        // 2. Fetch from Firestore / Backend if not yet present in local memory
        try {
          const { trips: loadedTrips } = await syncEngine.fetchInitialData(pendingToken);
          const remoteMatched = findTripByIdentifier(loadedTrips, pendingToken);
          if (remoteMatched) {
            checkAndSelectTrip(remoteMatched, loadedTrips);
            clearPendingShareToken();
            targetSharedTokenRef.current = null;
            showToast(`Willkommen, ${userCollab.name}! Reise „${remoteMatched.title}“ wurde geöffnet.`, 'success');
          }
        } catch (err) {
          console.warn('[App] Error resolving target trip after login:', err);
        }
      }
    }
  };

  const handleSignOutApp = async () => {
    clearAppSession();
    setAppAuthSession(null);
    try {
      await authService.signOutUser();
    } catch (e) {
      console.warn('Firebase signout warning:', e);
    }
    showToast('Erfolgreich abgemeldet. Bitte gib das Passwort ein.', 'info');
  };

  // If not unlocked with password, render the Gatekeeper Screen
  if (!appAuthSession) {
    return <AppGateScreen onUnlock={handleUnlockApp} />;
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#FDFBF7] text-[#4E3B31] overflow-hidden font-sans">
      {/* Top Header Navigation */}
      <Header
        trips={trips}
        activeTrip={activeTrip}
        onSelectTrip={handleSelectTrip}
        onOpenTripModal={(trip) => {
          if (!canCreateOrEditEntries(activeTrip, currentUser) && !trip) {
            showToast('Nur-Schauen-Modus: Keine Berechtigung zum Erstellen neuer Reisen.', 'info');
            return;
          }
          setEditingTrip(trip || null);
          setIsTripModalOpen(true);
        }}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        syncState={syncState}
        onManualSync={async () => {
          const res = await syncEngine.syncNow();
          showToast(res.message || 'Synchronisierung abgeschlossen', res.success ? 'success' : 'error');
        }}
        currentUser={currentUser}
        onChangeCurrentUser={(u) => {
          setCurrentUser(u);
          storage.setCurrentUser(u);
          showToast(`Aktives Profil gewechselt zu ${u.name}`, 'info');
        }}
        onOpenAddEntry={() => {
          if (!canCreateOrEditEntries(activeTrip, currentUser)) {
            showToast('Nur Lese-Rechte: Du kannst Stopps und Fotos in dieser Reise nur ansehen.', 'info');
            return;
          }
          setEditingEntry(null);
          setInitialCoordsForEntry(null);
          setInitialAddressForEntry(undefined);
          setIsEntryModalOpen(true);
        }}
        authUser={authUser}
        onOpenAuthModal={(tab = 'login') => {
          setAuthModalTab(tab);
          setIsAuthModalOpen(true);
        }}
        onOpenAccountModal={() => {
          setIsAccountModalOpen(true);
        }}
        onSignOut={handleSignOutApp}
        onOpenMobileSyncQr={() => setIsMobileSyncQrOpen(true)}
        onOpenChangelog={() => setIsChangelogOpen(true)}
        onOpenTrackUpload={() => {
          if (!canCreateOrEditEntries(activeTrip, currentUser)) {
            showToast('Nur-Schauen-Modus: Track-Upload ist im Lese-Modus nicht verfügbar.', 'info');
            return;
          }
          setIsTrackUploadModalOpen(true);
        }}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenBackupModal={(tab = 'backup') => {
          setBackupModalTab(tab);
          setIsBackupModalOpen(true);
        }}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onCopyTripLink={handleCopyTripShareLink}
      />

      {/* Main Content Area based on active view mode */}
      <main className="flex-1 relative overflow-hidden bg-[#FDFBF7] dark:bg-[#12161A] pb-14 md:pb-0">
        {viewMode === 'map' && (
          <TravelMap
            entries={activeEntries}
            activeTrip={activeTrip}
            allTrips={trips}
            currentUser={currentUser}
            onSelectEntry={(e) => setSelectedEntryDetail(e)}
            onAddEntryAtCoordinates={(coords, address, extra) => {
              if (!canCreateOrEditEntries(activeTrip, currentUser)) {
                showToast('Nur Lese-Rechte: In dieser Reise können nur Inhaber und Bearbeiter Stopps anlegen.', 'info');
                return;
              }
              handleMapAddAtCoords(coords, address, extra);
            }}
            onEditEntry={(entry) => {
              if (!canCreateOrEditEntries(activeTrip, currentUser)) {
                showToast('Nur Lese-Rechte: Bearbeiten von Einträgen ist nicht gestattet.', 'info');
                return;
              }
              setEditingEntry(entry);
              setIsEntryModalOpen(true);
            }}
            onDeleteEntry={handleDeleteEntry}
            onReorderEntries={handleReorderEntries}
            sortMode={sortMode}
            focusedEntryId={focusedEntryIdOnMap}
            theme={theme}
            onOpenTrackUpload={() => setIsTrackUploadModalOpen(true)}
            onRemoveTrackFromTrip={handleRemoveTrackFromTrip}
          />
        )}

        {viewMode === 'timeline' && (
          <TimelineView
            entries={activeEntries}
            activeTrip={activeTrip}
            currentUser={currentUser}
            onSelectEntry={(e) => setSelectedEntryDetail(e)}
            onFocusOnMap={handleFocusOnMap}
            onAddEntry={() => {
              if (!canCreateOrEditEntries(activeTrip, currentUser)) {
                showToast('Nur Lese-Rechte: In dieser Reise können nur Inhaber und Bearbeiter Stopps anlegen.', 'info');
                return;
              }
              setEditingEntry(null);
              setInitialCoordsForEntry(null);
              setIsEntryModalOpen(true);
            }}
            onEditEntry={(entry) => {
              if (!canCreateOrEditEntries(activeTrip, currentUser)) {
                showToast('Nur Lese-Rechte: Bearbeiten von Einträgen ist nicht gestattet.', 'info');
                return;
              }
              setEditingEntry(entry);
              setIsEntryModalOpen(true);
            }}
            onDeleteEntry={handleDeleteEntry}
            onReorderEntries={handleReorderEntries}
            sortMode={sortMode}
            onChangeSortMode={setSortMode}
          />
        )}

        {viewMode === 'gallery' && (
          <GalleryView
            entries={activeEntries}
            activeTrip={activeTrip}
            onSelectEntry={(e) => setSelectedEntryDetail(e)}
            onOpenExportModal={() => setIsExportModalOpen(true)}
          />
        )}

        {viewMode === 'stats' && (
          <StatsView
            entries={activeEntries}
            activeTrip={activeTrip}
            currentUser={currentUser}
          />
        )}
      </main>

      {/* Mobile Ergonomic Bottom Navigation Bar with Thumb-Zone FAB */}
      <MobileBottomNav
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        onAddNewEntry={() => {
          if (!canCreateOrEditEntries(activeTrip, currentUser)) {
            showToast('Nur Lese-Rechte: In dieser Reise können nur Inhaber und Bearbeiter Stopps anlegen.', 'info');
            return;
          }
          setEditingEntry(null);
          setInitialCoordsForEntry(null);
          setInitialAddressForEntry(undefined);
          setIsEntryModalOpen(true);
        }}
        activeTrip={activeTrip}
        currentUser={currentUser}
        entriesCount={activeEntries.length}
        mediaCount={activeEntries.reduce((acc, e) => acc + (e.media?.length || 0), 0)}
      />

      {/* Entry Editor Modal (Add/Edit) */}
      <EntryModal
        isOpen={isEntryModalOpen}
        onClose={() => {
          setIsEntryModalOpen(false);
          setEditingEntry(null);
          setInitialCoordsForEntry(null);
          setInitialAddressForEntry(undefined);
          setInitialTitleForEntry(undefined);
          setInitialNoteForEntry(undefined);
          setInitialDateForEntry(undefined);
          setInitialCategoryForEntry(undefined);
        }}
        onSave={handleSaveEntry}
        onDelete={handleDeleteEntry}
        initialCoords={initialCoordsForEntry}
        initialAddress={initialAddressForEntry}
        initialTitle={initialTitleForEntry}
        initialNote={initialNoteForEntry}
        initialDate={initialDateForEntry}
        initialCategory={initialCategoryForEntry}
        tripDefaultCoords={
          activeTrip?.defaultCoordinates
            ? { lat: activeTrip.defaultCoordinates[0], lng: activeTrip.defaultCoordinates[1] }
            : activeEntries.length > 0
            ? activeEntries[activeEntries.length - 1].coordinates
            : undefined
        }
        tripStartDate={activeTrip?.startDate}
        tripId={activeTrip?.id || ''}
        currentUser={currentUser}
        editingEntry={editingEntry}
      />

      {/* Entry Detail Drawer / Modal */}
      <EntryDetailModal
        isOpen={Boolean(selectedEntryDetail)}
        entry={selectedEntryDetail}
        onClose={() => setSelectedEntryDetail(null)}
        currentUser={currentUser}
        onEdit={(entry) => {
          setSelectedEntryDetail(null);
          setEditingEntry(entry);
          setIsEntryModalOpen(true);
        }}
        onDelete={handleDeleteEntry}
        onAddComment={handleAddComment}
        onToggleLike={handleToggleLike}
        onFocusOnMap={handleFocusOnMap}
      />

      {/* Trip Settings Modal */}
      <TripModal
        isOpen={isTripModalOpen}
        onClose={() => {
          setIsTripModalOpen(false);
          setEditingTrip(null);
        }}
        trip={editingTrip}
        onSave={handleSaveTrip}
        onDelete={handleDeleteTrip}
        currentUser={currentUser}
      />

      {/* Password Lock Modal */}
      <PasswordLockModal
        isOpen={isPasswordModalOpen}
        trip={tripToUnlock}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setTripToUnlock(null);
        }}
        onUnlock={handleUnlockPassword}
      />

      {/* Firebase Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialTab={authModalTab}
        onSuccess={(user) => {
          setAuthUser(user);
          const mapped = authUserToCollaborator(user);
          setCurrentUser(mapped);
          storage.setCurrentUser(mapped);
          showToast(`Willkommen zurück, ${mapped.name}!`, 'success');
        }}
      />

      {/* Account & Profile Management Modal */}
      <AccountManagementModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        currentUser={currentUser}
        authUser={authUser}
        activeTripId={activeTripId}
        onProfileUpdated={(updatedUser) => {
          const mapped = authUserToCollaborator(updatedUser);
          setCurrentUser(mapped);
          storage.setCurrentUser(mapped);
          showToast('Profildaten erfolgreich aktualisiert!', 'success');
        }}
        onUpdateUser={(updatedCollab) => {
          setCurrentUser(updatedCollab);
          storage.setCurrentUser(updatedCollab);
          showToast('Profildaten erfolgreich aktualisiert!', 'success');
        }}
        onUpdateTrip={(updatedTrip) => {
          const updatedTrips = trips.map((t) => (t.id === updatedTrip.id ? updatedTrip : t));
          setTrips(updatedTrips);
          storage.setTrips(updatedTrips);
          storage.addToSyncQueue({
            action: 'update_trip',
            payload: updatedTrip,
          });
          syncEngine.syncNow().catch((e) => console.warn('Background sync warning:', e));
        }}
        onSignOut={async () => {
          setIsAccountModalOpen(false);
          await handleSignOutApp();
        }}
        trips={trips}
        entries={entries}
        syncState={syncState}
        onTriggerSync={async () => {
          const res = await syncEngine.syncNow();
          showToast(res.message || 'Sync ausgeführt', res.success ? 'success' : 'error');
        }}
        onManualSync={async () => {
          const res = await syncEngine.syncNow();
          showToast(res.message || 'Sync ausgeführt', res.success ? 'success' : 'error');
        }}
        onOpenBackupModal={(tab = 'backup') => {
          setBackupModalTab(tab);
          setIsBackupModalOpen(true);
        }}
      />

      {/* Mobile QR Companion & Upload Modal */}
      <MobileSyncQrModal
        isOpen={isMobileSyncQrOpen}
        onClose={() => setIsMobileSyncQrOpen(false)}
        trip={activeTrip}
      />

      {/* Version Changelog Modal */}
      <ChangelogModal
        isOpen={isChangelogOpen}
        onClose={() => setIsChangelogOpen(false)}
      />

      {/* GPS Track (.GPX / .FIT) Upload & Analysis Modal */}
      <TrackUploadModal
        isOpen={isTrackUploadModalOpen}
        onClose={() => setIsTrackUploadModalOpen(false)}
        onAddTrackAsEntry={handleSaveTrackAsEntry}
        onAttachTrackToTrip={handleAttachTrackToTrip}
        activeTrip={activeTrip}
        currentUser={currentUser}
        theme={theme}
      />

      {/* Photobook (PDF) & Media (ZIP) Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        trip={activeTrip}
        entries={entries}
        onShowToast={(msg, type) => showToast(msg, type)}
        onOpenBackupModal={(tab = 'backup') => {
          setBackupModalTab(tab);
          setIsBackupModalOpen(true);
        }}
      />

      {/* Local Backup & Restore Modal */}
      <BackupRestoreModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        trips={trips}
        entries={entries}
        activeTrip={activeTrip}
        currentUserName={currentUser?.name}
        onRestoreSuccess={(restoredTrips, restoredEntries) => {
          setTrips(restoredTrips);
          setEntries(restoredEntries);
          if (restoredTrips.length > 0) {
            const firstTripId = restoredTrips[0].id;
            setActiveTripId(firstTripId);
            storage.setActiveTripId(firstTripId);
          }
        }}
        onShowToast={(msg, type) => showToast(msg, type)}
        defaultTab={backupModalTab}
      />

      {/* Toast Notifications */}
      {toastMessage && (
        <Toast
          message={toastMessage.text}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
