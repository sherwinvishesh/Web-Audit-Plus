import { summarize, type RunRecord, type RunSummary } from './run';

/**
 * Saved runs live in IndexedDB: an engine result is several megabytes, and chrome.storage.local
 * has a 10 MB quota without the `unlimitedStorage` permission. Two stores keep listing cheap:
 * `summaries` holds the few hundred bytes a history list needs, `runs` the full record, written in
 * one transaction so they never disagree. The extension's pages and its worker share the origin, so
 * they share the database.
 *
 * Version 2 changed the record format; version 1 runs are dropped on upgrade rather than shown broken.
 */

const DB_NAME = 'webauditplus';
const DB_VERSION = 2;
const RUNS = 'runs';
const SUMMARIES = 'summaries';

/** Older runs are deleted past this many. */
export const MAX_RUNS = 200;

export interface RunStore {
  put(record: RunRecord): Promise<void>;
  get(id: string): Promise<RunRecord | undefined>;
  /** Newest first. */
  list(filter?: { url?: string; origin?: string; limit?: number }): Promise<RunSummary[]>;
  /** The newest run of the same URL and form factor that started before this one. */
  previous(record: Pick<RunRecord, 'id' | 'url' | 'startedAt' | 'options'>): Promise<RunSummary | undefined>;
  delete(id: string): Promise<void>;
}

/**
 * The error to reject with. A `DOMException` from IndexedDB can carry no message at all (Chrome's
 * `QuotaExceededError` is one), and the UI shows the message, so it gets one here.
 */
function failure(error: DOMException | null, fallback: string): Error {
  if (!error) return new Error(fallback);
  if (error.name === 'QuotaExceededError') {
    return new Error('The browser’s storage for this extension is full. Delete some runs from the history and try again.');
  }
  return error.message ? error : new Error(`${fallback} (${error.name})`);
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(failure(req.error, 'IndexedDB request failed'));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(failure(tx.error, 'IndexedDB transaction failed'));
    tx.onabort = () => reject(failure(tx.error, 'IndexedDB transaction aborted'));
  });
}

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = factory.open(DB_NAME, DB_VERSION);
    } catch (error) {
      // A context that refuses IndexedDB outright throws here (a SecurityError, often with no message).
      reject(error instanceof DOMException ? failure(error, 'Could not open the run database') : error);
      return;
    }
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (event.oldVersion < 2) {
        for (const name of [RUNS, SUMMARIES]) if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
      }
      if (!db.objectStoreNames.contains(RUNS)) db.createObjectStore(RUNS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SUMMARIES)) {
        const summaries = db.createObjectStore(SUMMARIES, { keyPath: 'id' });
        summaries.createIndex('startedAt', 'startedAt');
        summaries.createIndex('url', ['url', 'startedAt']);
        summaries.createIndex('origin', ['origin', 'startedAt']);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(failure(req.error, 'Could not open the run database'));
    req.onblocked = () => reject(new Error('The run database is blocked by another open version'));
  });
}

/** Collect summaries from a cursor, newest first. */
function collect(source: IDBObjectStore | IDBIndex, range: IDBKeyRange | null, limit: number): Promise<RunSummary[]> {
  return new Promise((resolve, reject) => {
    const out: RunSummary[] = [];
    const req = source.openCursor(range, 'prev');
    req.onerror = () => reject(failure(req.error, 'IndexedDB cursor failed'));
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || out.length >= limit) return resolve(out);
      out.push(cursor.value as RunSummary);
      cursor.continue();
    };
  });
}

/** Every key of a compound [key, startedAt] index for one key. */
function forKey(key: string): IDBKeyRange {
  return IDBKeyRange.bound([key, ''], [key, '￿']);
}

export function createRunStore(factory: IDBFactory = indexedDB): RunStore {
  let db: Promise<IDBDatabase> | undefined;
  const database = (): Promise<IDBDatabase> => {
    db ??= open(factory).catch((error: unknown) => {
      db = undefined;
      throw error;
    });
    return db;
  };

  return {
    async put(record) {
      const handle = await database();
      const tx = handle.transaction([RUNS, SUMMARIES], 'readwrite');
      tx.objectStore(RUNS).put(record);
      tx.objectStore(SUMMARIES).put(summarize(record));
      // Prune in the same transaction: the oldest summaries past the cap, and their records.
      const index = tx.objectStore(SUMMARIES).index('startedAt');
      const count = await request(tx.objectStore(SUMMARIES).count());
      let excess = count - MAX_RUNS;
      if (excess > 0) {
        await new Promise<void>((resolve, reject) => {
          const req = index.openCursor(null, 'next');
          req.onerror = () => reject(failure(req.error, 'IndexedDB cursor failed'));
          req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor || excess <= 0) return resolve();
            const id = (cursor.value as RunSummary).id;
            tx.objectStore(RUNS).delete(id);
            cursor.delete();
            excess -= 1;
            cursor.continue();
          };
        });
      }
      await done(tx);
    },

    async get(id) {
      const handle = await database();
      const tx = handle.transaction(RUNS, 'readonly');
      return (await request(tx.objectStore(RUNS).get(id))) as RunRecord | undefined;
    },

    async list(filter = {}) {
      const handle = await database();
      const store = handle.transaction(SUMMARIES, 'readonly').objectStore(SUMMARIES);
      const limit = filter.limit ?? MAX_RUNS;
      if (filter.url) return collect(store.index('url'), forKey(filter.url), limit);
      if (filter.origin) return collect(store.index('origin'), forKey(filter.origin), limit);
      return collect(store.index('startedAt'), null, limit);
    },

    async previous(record) {
      const handle = await database();
      const store = handle.transaction(SUMMARIES, 'readonly').objectStore(SUMMARIES);
      const earlier = IDBKeyRange.bound([record.url, ''], [record.url, record.startedAt], false, true);
      const candidates = await collect(store.index('url'), earlier, MAX_RUNS);
      return candidates.find((summary) => summary.id !== record.id && summary.formFactor === record.options.formFactor);
    },

    async delete(id) {
      const handle = await database();
      const tx = handle.transaction([RUNS, SUMMARIES], 'readwrite');
      tx.objectStore(RUNS).delete(id);
      tx.objectStore(SUMMARIES).delete(id);
      await done(tx);
    },
  };
}
