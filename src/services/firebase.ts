import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  sendPasswordResetEmail,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AuthUser, Collaborator, Trip, JournalEntry } from '../types';
import { syncLogger } from './syncLogger';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Firestore with robust connection settings (force long-polling immediately to eliminate 10s backend connection timeout warnings in iframe/proxy environments)
export const db = (() => {
  const customDbId = firebaseConfig.firestoreDatabaseId;
  try {
    return initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
        ignoreUndefinedProperties: true,
      },
      customDbId && customDbId !== '(default)' ? customDbId : undefined
    );
  } catch (_err) {
    return customDbId && customDbId !== '(default)'
      ? getFirestore(app, customDbId)
      : getFirestore(app);
  }
})();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

// Provider instance
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Format Firebase user to AuthUser
export const formatAuthUser = (user: User | null): AuthUser | null => {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || (user.isAnonymous ? 'Gast-Reisender' : user.email?.split('@')[0] || 'Reisender'),
    photoURL:
      user.photoURL ||
      `https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=150&auto=format&fit=crop&q=80`,
    isAnonymous: user.isAnonymous,
    providerId: user.providerData[0]?.providerId || (user.isAnonymous ? 'anonymous' : 'password'),
    createdAt: user.metadata.creationTime,
    lastLoginAt: user.metadata.lastSignInTime,
  };
};

// Map AuthUser to Collaborator for UI compatibility
export const authUserToCollaborator = (authUser: AuthUser): Collaborator => {
  return {
    id: authUser.uid,
    name: authUser.displayName || 'Reisender',
    avatar:
      authUser.photoURL ||
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=150&auto=format&fit=crop&q=80',
    color: '#8A9A5B',
    role: 'owner',
    email: authUser.email || undefined,
  };
};

// Sync user document to Firestore
export const saveUserToFirestore = async (authUser: AuthUser): Promise<void> => {
  try {
    const userRef = doc(db, 'users', authUser.uid);
    await setDoc(
      userRef,
      {
        uid: authUser.uid,
        email: authUser.email,
        displayName: authUser.displayName,
        photoURL: authUser.photoURL,
        isAnonymous: authUser.isAnonymous,
        role: 'owner',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('Firestore user save warning (can be offline):', error);
  }
};

// Authentication Services
export const authService = {
  // Google Sign In
  async signInWithGoogle(): Promise<AuthUser> {
    const result = await signInWithPopup(auth, googleProvider);
    const authUser = formatAuthUser(result.user)!;
    await saveUserToFirestore(authUser);
    return authUser;
  },

  // Email & Password Sign In
  async signInWithEmail(email: string, pass: string): Promise<AuthUser> {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    const authUser = formatAuthUser(result.user)!;
    await saveUserToFirestore(authUser);
    return authUser;
  },

  // Email & Password Registration
  async registerWithEmail(
    email: string,
    pass: string,
    displayName: string,
    photoURL?: string
  ): Promise<AuthUser> {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    const finalPhoto =
      photoURL ||
      `https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=150&auto=format&fit=crop&q=80`;

    await updateProfile(result.user, {
      displayName: displayName || email.split('@')[0],
      photoURL: finalPhoto,
    });

    const authUser: AuthUser = {
      uid: result.user.uid,
      email: result.user.email,
      displayName: displayName || email.split('@')[0],
      photoURL: finalPhoto,
      isAnonymous: false,
      providerId: 'password',
      createdAt: result.user.metadata.creationTime,
      lastLoginAt: result.user.metadata.lastSignInTime,
    };

    await saveUserToFirestore(authUser);
    return authUser;
  },

  // Guest / Anonymous Sign In
  async signInAsGuest(): Promise<AuthUser> {
    const result = await signInAnonymously(auth);
    const authUser = formatAuthUser(result.user)!;
    await saveUserToFirestore(authUser);
    return authUser;
  },

  // Send Password Reset
  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  },

  // Update Profile Info
  async updateUserProfile(displayName: string, photoURL?: string): Promise<AuthUser> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Kein Benutzer angemeldet');

    await updateProfile(currentUser, {
      displayName,
      ...(photoURL ? { photoURL } : {}),
    });

    const updatedUser = formatAuthUser(currentUser)!;
    await saveUserToFirestore(updatedUser);
    return updatedUser;
  },

  // Change Password
  async changePassword(newPassword: string): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Kein Benutzer angemeldet');
    await updatePassword(currentUser, newPassword);
  },

  // Sign Out
  async signOutUser(): Promise<void> {
    await signOut(auth);
  },

  // Auth State Listener
  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    return onAuthStateChanged(auth, (user) => {
      const authUser = formatAuthUser(user);
      callback(authUser);
    });
  },

  // Current User getter
  getCurrentAuthUser(): AuthUser | null {
    return formatAuthUser(auth.currentUser);
  },
};

// Firestore Sync Services for Trips & Journal Entries
export const firestoreService = {
  async saveTrip(trip: Trip): Promise<void> {
    try {
      const tripRef = doc(db, 'trips', trip.id);
      await setDoc(tripRef, { ...trip, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      console.warn('Firestore saveTrip error:', err);
      throw err;
    }
  },

  async deleteTrip(tripId: string): Promise<void> {
    try {
      const tripRef = doc(db, 'trips', tripId);
      await deleteDoc(tripRef);
    } catch (err) {
      console.warn('Firestore deleteTrip error:', err);
      throw err;
    }
  },

  async getTrips(): Promise<Trip[]> {
    try {
      const snapshot = await getDocs(collection(db, 'trips'));
      const trips: Trip[] = [];
      snapshot.forEach((docSnap) => {
        trips.push(docSnap.data() as Trip);
      });
      return trips;
    } catch (err) {
      console.warn('Firestore getTrips error:', err);
      return [];
    }
  },

  async getTripByIdOrToken(identifier: string): Promise<Trip | null> {
    if (!identifier) return null;
    const clean = identifier.trim();
    try {
      // 1. Check direct doc by ID
      const tripDoc = await getDoc(doc(db, 'trips', clean));
      if (tripDoc.exists()) {
        return tripDoc.data() as Trip;
      }

      // 2. Scan all trips in collection for matching shareToken or lower case id
      const allTrips = await this.getTrips();
      const lower = clean.toLowerCase();
      const matched = allTrips.find(
        (t) => t.id === clean || t.shareToken === clean || t.id.toLowerCase() === lower || (t.shareToken && t.shareToken.toLowerCase() === lower)
      );
      return matched || null;
    } catch (err) {
      console.warn('Firestore getTripByIdOrToken error:', err);
      return null;
    }
  },

  async saveEntry(entry: JournalEntry): Promise<void> {
    const { startTime } = syncLogger.logFirestoreSaveEntryStart(entry);
    try {
      const entryRef = doc(db, 'entries', entry.id);

      const payloadToSave: JournalEntry = {
        ...entry,
        media: entry.media || [],
        updatedAt: new Date().toISOString(),
      };

      await setDoc(entryRef, payloadToSave, { merge: true });
      syncLogger.logFirestoreSaveEntrySuccess(entry, startTime);
    } catch (err) {
      syncLogger.logFirestoreSaveEntryError(entry, err, startTime);
      throw err;
    }
  },

  async deleteEntry(entryId: string): Promise<void> {
    try {
      const entryRef = doc(db, 'entries', entryId);
      await deleteDoc(entryRef);
    } catch (err) {
      console.warn('Firestore deleteEntry error:', err);
      throw err;
    }
  },

  async getEntries(): Promise<JournalEntry[]> {
    try {
      const snapshot = await getDocs(collection(db, 'entries'));
      const entries: JournalEntry[] = [];
      snapshot.forEach((docSnap) => {
        entries.push(docSnap.data() as JournalEntry);
      });
      return entries;
    } catch (err) {
      console.warn('Firestore getEntries error:', err);
      return [];
    }
  },

  // Real-time live listener for Trips collection across multiple users
  subscribeTripsLive(callback: (trips: Trip[]) => void): () => void {
    try {
      const tripsCol = collection(db, 'trips');
      return onSnapshot(
        tripsCol,
        (snapshot) => {
          const trips: Trip[] = [];
          snapshot.forEach((docSnap) => {
            trips.push(docSnap.data() as Trip);
          });
          callback(trips);
        },
        (error) => {
          console.warn('Firestore trips onSnapshot error (offline mode or permission):', error);
        }
      );
    } catch (err) {
      console.warn('Firestore trips subscribe error:', err);
      return () => {};
    }
  },

  // Real-time live listener for Entries collection across multiple users
  subscribeEntriesLive(callback: (entries: JournalEntry[]) => void): () => void {
    try {
      const entriesCol = collection(db, 'entries');
      return onSnapshot(
        entriesCol,
        (snapshot) => {
          const entries: JournalEntry[] = [];
          snapshot.forEach((docSnap) => {
            entries.push(docSnap.data() as JournalEntry);
          });
          callback(entries);
        },
        (error) => {
          console.warn('Firestore entries onSnapshot error (offline mode or permission):', error);
        }
      );
    } catch (err) {
      console.warn('Firestore entries subscribe error:', err);
      return () => {};
    }
  },
};
