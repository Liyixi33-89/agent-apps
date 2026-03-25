import type { VibeHistoryItem, FavoritePrompt } from './types';

const DB_NAME = 'vibe-coding-db';
const DB_VERSION = 2;

const STORES = {
  history:   'history',
  favorites: 'favorites',
} as const;

// ─── 打开数据库 ───────────────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORES.history)) {
        const hs = db.createObjectStore(STORES.history, { keyPath: 'id' });
        hs.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.favorites)) {
        const fs = db.createObjectStore(STORES.favorites, { keyPath: 'id' });
        fs.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
};

// ─── 通用 CRUD ────────────────────────────────────────────────────────────────

const put = async <T>(store: string, item: T): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const getAll = async <T>(store: string): Promise<T[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
};

const remove = async (store: string, id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const clear = async (store: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// ─── 历史记录 API ─────────────────────────────────────────────────────────────

export const historyDB = {
  save:   (item: VibeHistoryItem) => put(STORES.history, item),
  getAll: () => getAll<VibeHistoryItem>(STORES.history),
  remove: (id: string) => remove(STORES.history, id),
  clear:  () => clear(STORES.history),
};

// ─── 收藏提示词 API ───────────────────────────────────────────────────────────

export const favoriteDB = {
  save:   (item: FavoritePrompt) => put(STORES.favorites, item),
  getAll: () => getAll<FavoritePrompt>(STORES.favorites),
  remove: (id: string) => remove(STORES.favorites, id),
};
