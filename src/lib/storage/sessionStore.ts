import type { IngestResult } from '@/lib/workbench/types';

const DB_NAME = 'thesis-rag-workbench';
const DB_VERSION = 1;
const SESSION_STORE = 'session';
const FILE_STORE = 'files';
const ACTIVE_SESSION_KEY = 'active';

export type PersistedProcessStepEntry = {
  id: number;
  message: string;
  status: 'running' | 'completed' | 'error';
  startedAt: number;
  completedAt?: number;
};

export type PersistedIngestResult = IngestResult;

export type PersistedFileProcessEntry = {
  path: string;
  displayPath: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  steps: PersistedProcessStepEntry[];
  startedAt?: number;
  completedAt?: number;
  result?: PersistedIngestResult;
  errorMessage?: string;
};

export type PersistedSessionSnapshot = {
  key: string;
  globalContext: string;
  fileOrder: string[];
  processEntries: Record<string, PersistedFileProcessEntry>;
  savedAt: number;
};

export type PersistedFileRecord = {
  path: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  blob: Blob;
};

export type RestorableSession = {
  snapshot: PersistedSessionSnapshot;
  files: PersistedFileRecord[];
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE, { keyPath: 'path' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function wrapRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

async function withDatabase<T>(callback: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openDatabase();

  try {
    return await callback(db);
  } finally {
    db.close();
  }
}

export async function loadRestorableSession(): Promise<RestorableSession | null> {
  return withDatabase(async db => {
    const snapshotTransaction = db.transaction(SESSION_STORE, 'readonly');
    const snapshot = await wrapRequest(
      snapshotTransaction.objectStore(SESSION_STORE).get(ACTIVE_SESSION_KEY),
    ) as PersistedSessionSnapshot | undefined;

    if (!snapshot || snapshot.fileOrder.length === 0) {
      return null;
    }

    const fileTransaction = db.transaction(FILE_STORE, 'readonly');
    const fileStore = fileTransaction.objectStore(FILE_STORE);
    const fileRequests = snapshot.fileOrder.map(path => wrapRequest(fileStore.get(path)) as Promise<PersistedFileRecord | undefined>);
    const files = await Promise.all(
      fileRequests.map(async request => {
        const record = await request;
        return record ?? null;
      }),
    );

    const restoredFiles = files.filter((record): record is PersistedFileRecord => record !== null);

    if (restoredFiles.length === 0) {
      return null;
    }

    return {
      snapshot,
      files: restoredFiles,
    };
  });
}

export async function saveSessionSnapshot(snapshot: Omit<PersistedSessionSnapshot, 'key' | 'savedAt'>): Promise<void> {
  return withDatabase(async db => {
    const transaction = db.transaction(SESSION_STORE, 'readwrite');
    transaction.objectStore(SESSION_STORE).put({
      ...snapshot,
      key: ACTIVE_SESSION_KEY,
      savedAt: Date.now(),
    });

    await waitForTransaction(transaction);
  });
}

export async function syncSessionFiles(records: PersistedFileRecord[]): Promise<void> {
  return withDatabase(async db => {
    const keyTransaction = db.transaction(FILE_STORE, 'readonly');
    const existingKeys = await wrapRequest(keyTransaction.objectStore(FILE_STORE).getAllKeys()) as string[];
    const nextKeys = new Set(records.map(record => record.path));

    const writeTransaction = db.transaction(FILE_STORE, 'readwrite');
    const store = writeTransaction.objectStore(FILE_STORE);

    for (const record of records) {
      store.put(record);
    }

    for (const key of existingKeys) {
      if (!nextKeys.has(key)) {
        store.delete(key);
      }
    }

    await waitForTransaction(writeTransaction);
  });
}

export async function clearStoredSession(): Promise<void> {
  return withDatabase(async db => {
    const transaction = db.transaction([SESSION_STORE, FILE_STORE], 'readwrite');
    transaction.objectStore(SESSION_STORE).delete(ACTIVE_SESSION_KEY);
    transaction.objectStore(FILE_STORE).clear();

    await waitForTransaction(transaction);
  });
}

export function canUseSessionPersistence() {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}