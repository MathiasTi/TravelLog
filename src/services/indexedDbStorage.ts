/**
 * Lightweight, zero-dependency IndexedDB storage service
 * Provides resilient offline caching for large media items and cache data.
 */

const DB_NAME = 'wanderlog_idb_v1';
const DB_VERSION = 1;
const STORE_MEDIA = 'media_cache';
const STORE_KV = 'key_val_cache';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB not supported'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_KV)) {
          db.createObjectStore(STORE_KV, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        console.warn('IndexedDB open error:', event);
        reject((event.target as IDBOpenDBRequest).error);
      };
    } catch (err) {
      reject(err);
    }
  });

  return dbPromise;
}

export const indexedDbStorage = {
  /**
   * Store a generic key-value item in IndexedDB
   */
  async setItem<T>(key: string, value: T): Promise<boolean> {
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_KV, 'readwrite');
        const store = tx.objectStore(STORE_KV);
        const req = store.put({ key, value, updatedAt: Date.now() });

        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    } catch (err) {
      console.warn(`IndexedDB setItem error for key "${key}":`, err);
      return false;
    }
  },

  /**
   * Retrieve a generic key-value item from IndexedDB
   */
  async getItem<T>(key: string): Promise<T | null> {
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_KV, 'readonly');
        const store = tx.objectStore(STORE_KV);
        const req = store.get(key);

        req.onsuccess = () => {
          if (req.result && 'value' in req.result) {
            resolve(req.result.value as T);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch (err) {
      console.warn(`IndexedDB getItem error for key "${key}":`, err);
      return null;
    }
  },

  /**
   * Remove an item by key
   */
  async removeItem(key: string): Promise<boolean> {
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_KV, 'readwrite');
        const store = tx.objectStore(STORE_KV);
        const req = store.delete(key);

        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    } catch (err) {
      console.warn(`IndexedDB removeItem error for key "${key}":`, err);
      return false;
    }
  },

  /**
   * Cache media blob or data
   */
  async cacheMedia(id: string, dataUrl: string, mimeType?: string): Promise<boolean> {
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_MEDIA, 'readwrite');
        const store = tx.objectStore(STORE_MEDIA);
        const req = store.put({ id, dataUrl, mimeType, cachedAt: Date.now() });

        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    } catch (err) {
      console.warn(`IndexedDB cacheMedia error for id "${id}":`, err);
      return false;
    }
  },

  /**
   * Retrieve cached media data
   */
  async getCachedMedia(id: string): Promise<string | null> {
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_MEDIA, 'readonly');
        const store = tx.objectStore(STORE_MEDIA);
        const req = store.get(id);

        req.onsuccess = () => {
          if (req.result && 'dataUrl' in req.result) {
            resolve(req.result.dataUrl);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch (err) {
      console.warn(`IndexedDB getCachedMedia error for id "${id}":`, err);
      return null;
    }
  },
};
