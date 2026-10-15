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
});
