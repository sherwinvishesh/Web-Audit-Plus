import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import type { RunRecord } from '../../src/shared/run';
import { createRunStore, MAX_RUNS } from '../../src/shared/storage';

function record(id: string, minute: number, overrides: Partial<RunRecord> = {}): RunRecord {
  const url = overrides.url ?? 'https://example.com/';
  return {
    id,
    url,
    origin: new URL(url).origin,
    startedAt: new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString(),
    durationMs: 1200,
    options: { formFactor: 'desktop', categories: ['agentic'] },
    scores: { agentic: 50 + minute },
    overall: 50 + minute,
    errors: {},
    environment: { extensionVersion: '0.1.0', userAgent: 'test' },
    ...overrides,
  };
}

describe('run store', () => {
  it('round-trips a full record', async () => {
    const store = createRunStore(new IDBFactory());
    const saved = record('a', 1);
    await store.put(saved);
    expect(await store.get('a')).toEqual(saved);
    expect(await store.get('missing')).toBeUndefined();
  });

  it('lists summaries newest first, filtered by URL or origin', async () => {
    const store = createRunStore(new IDBFactory());
    await store.put(record('a', 1));
    await store.put(record('b', 3, { url: 'https://example.com/docs' }));
    await store.put(record('c', 2, { url: 'https://other.dev/' }));
    expect((await store.list()).map((run) => run.id)).toEqual(['b', 'c', 'a']);
    expect((await store.list({ url: 'https://example.com/' })).map((run) => run.id)).toEqual(['a']);
    expect((await store.list({ origin: 'https://example.com' })).map((run) => run.id)).toEqual(['b', 'a']);
    expect((await store.list({ limit: 1 })).map((run) => run.id)).toEqual(['b']);
    const [summary] = await store.list({ limit: 1 });
    expect(summary).not.toHaveProperty('agentic');
    expect(summary).toMatchObject({ formFactor: 'desktop', overall: 53 });
  });

  it('finds the previous run of the same URL and form factor', async () => {
    const store = createRunStore(new IDBFactory());
    await store.put(record('old', 1));
    await store.put(record('mobile', 2, { options: { formFactor: 'mobile', categories: ['agentic'] } }));
    await store.put(record('elsewhere', 3, { url: 'https://example.com/other' }));
    const latest = record('new', 4);
    await store.put(latest);
    expect((await store.previous(latest))?.id).toBe('old');
    expect(await store.previous(record('old', 1))).toBeUndefined();
  });

  it('deletes a run and its summary', async () => {
    const store = createRunStore(new IDBFactory());
    await store.put(record('a', 1));
    await store.delete('a');
    expect(await store.get('a')).toBeUndefined();
    expect(await store.list()).toEqual([]);
  });

  it(`keeps only the newest ${MAX_RUNS} runs`, async () => {
    const store = createRunStore(new IDBFactory());
    for (let minute = 0; minute < MAX_RUNS + 3; minute += 1) await store.put(record(`r${minute}`, minute));
    const runs = await store.list();
    expect(runs).toHaveLength(MAX_RUNS);
    expect(runs.at(-1)?.id).toBe('r3');
    expect(await store.get('r0')).toBeUndefined();
    expect(await store.get('r3')).toBeDefined();
  });

  it('drops runs saved in the version 1 format', async () => {
    const factory = new IDBFactory();
    await new Promise<void>((resolve, reject) => {
      const req = factory.open('webauditplus', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('runs', { keyPath: 'id' }).put(record('old', 1));
        db.createObjectStore('summaries', { keyPath: 'id' }).createIndex('startedAt', 'startedAt');
      };
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error ?? new Error('open failed'));
    });
    const store = createRunStore(factory);
    expect(await store.get('old')).toBeUndefined();
    await store.put(record('new', 2));
    expect((await store.list()).map((run) => run.id)).toEqual(['new']);
  });
});

/**
 * An IndexedDB that fails to open the way Chrome's does under pressure: asynchronously, with a
 * DOMException that may carry no message. With `then`, every open after the first is real.
 */
function failingFactory(error: DOMException, then?: IDBFactory): IDBFactory {
  let calls = 0;
  return {
    open(name: string, version?: number) {
      calls += 1;
      if (then && calls > 1) return then.open(name, version);
      const req = { error, onerror: null as ((event: Event) => void) | null };
      setTimeout(() => req.onerror?.(new Event('error')), 0);
      return req as unknown as IDBOpenDBRequest;
    },
  } as unknown as IDBFactory;
}

describe('run store failures', () => {
  it('explains a full quota, which Chrome reports with no message', async () => {
    const store = createRunStore(failingFactory(new DOMException('', 'QuotaExceededError')));
    await expect(store.put(record('a', 1))).rejects.toThrow(/storage for this extension is full/);
  });

  it('names a message-less failure instead of saying nothing', async () => {
    const store = createRunStore(failingFactory(new DOMException('', 'UnknownError')));
    await expect(store.list()).rejects.toThrow('Could not open the run database (UnknownError)');
  });

  it('explains a context that refuses IndexedDB outright', async () => {
    const refused = {
      open() {
        throw new DOMException('', 'SecurityError');
      },
    } as unknown as IDBFactory;
    await expect(createRunStore(refused).get('a')).rejects.toThrow('Could not open the run database (SecurityError)');
  });

  it('opens again after a failed open, rather than staying broken', async () => {
    const store = createRunStore(failingFactory(new DOMException('', 'UnknownError'), new IDBFactory()));
    await expect(store.put(record('a', 1))).rejects.toThrow(/UnknownError/);
    await store.put(record('a', 1));
    expect((await store.list()).map((summary) => summary.id)).toEqual(['a']);
  });

  it('deletes one run and leaves the others, so history and comparisons no longer see it', async () => {
    const store = createRunStore(new IDBFactory());
    await store.put(record('a', 1));
    await store.put(record('b', 2));
    await store.put(record('c', 3));
    expect((await store.previous(record('c', 3)))?.id).toBe('b');
    await store.delete('b');
    expect(await store.get('b')).toBeUndefined();
    expect((await store.list()).map((summary) => summary.id)).toEqual(['c', 'a']);
    expect((await store.previous(record('c', 3)))?.id).toBe('a');
    // Deleting a run that is already gone is not an error.
    await store.delete('b');
    expect(await store.list()).toHaveLength(2);
  });
});
