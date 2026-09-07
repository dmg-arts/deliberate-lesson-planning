/*
 * storage.js — everything the app remembers, all of it on the user's device.
 *
 * Drafts live in IndexedDB; small preferences live in localStorage. There is no
 * server, no account, and nothing leaves the browser unless the user exports a
 * PDF themselves.
 *
 * Every access is wrapped, because storage genuinely fails in the wild: private
 * windows, cleared site data, and browsers configured to block it all throw.
 * The app must stay usable — just forgetful — when that happens.
 */

const DB_NAME = 'deliberate-lesson-planning';
const DB_VERSION = 1;
const STORE = 'plans';
const PREFIX = 'dlp:';

/*
 * IndexedDB can hang rather than fail: some privacy modes and locked profiles
 * open a request that never fires onsuccess *or* onerror. Every access is
 * therefore time-boxed, so a wedged database degrades into "not saved" instead
 * of freezing the export button behind an await that never settles.
 */
const TIMEOUT_MS = 4000;

let dbPromise = null;

function timeboxed(promise, label) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`storage timed out: ${label}`)), TIMEOUT_MS);
    })
  ]);
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  dbPromise = timeboxed(dbPromise, 'open').catch((error) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

function tx(mode, run) {
  return openDb().then((db) => timeboxed(new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve(request && request.result);
  }), mode));
}

export function newId() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export async function listPlans() {
  try {
    const all = await tx('readonly', (store) => store.getAll());
    return (all || []).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  } catch {
    return [];
  }
}

export async function getPlan(id) {
  try {
    return (await tx('readonly', (store) => store.get(id))) || null;
  } catch {
    return null;
  }
}

export async function savePlan(record) {
  const now = new Date().toISOString();
  const full = {
    id: record.id || newId(),
    data: record.data,
    createdAt: record.createdAt || now,
    updatedAt: now
  };
  try {
    await tx('readwrite', (store) => store.put(full));
    return { ...full, persisted: true };
  } catch {
    /* Storage refused or hung. The form keeps working in memory, but the
       caller must be able to warn the user that nothing is being kept. */
    return { ...full, persisted: false };
  }
}

export async function deletePlan(id) {
  try {
    await tx('readwrite', (store) => store.delete(id));
    return true;
  } catch {
    return false;
  }
}

/* ---- small preferences (the saved drive link, last-used settings) ---- */

export function getPref(key, fallback = '') {
  try {
    const value = localStorage.getItem(PREFIX + key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function setPref(key, value) {
  try {
    localStorage.setItem(PREFIX + key, value);
    return true;
  } catch {
    return false;
  }
}
