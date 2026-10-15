import { describe, expect, it } from 'vitest';
import { parseClientMessage, parseServerMessage } from '../../src/shared/messages';
import { DEFAULT_RUN_OPTIONS, isFinished, newRunId, normalizeRunOptions, overallOf, summarize, type RunRecord } from '../../src/shared/run';

describe('normalizeRunOptions', () => {
  it('falls back to the defaults for anything that is not an object', () => {
    expect(normalizeRunOptions(undefined)).toEqual(DEFAULT_RUN_OPTIONS);
    expect(normalizeRunOptions('mobile')).toEqual(DEFAULT_RUN_OPTIONS);
  });

  it('keeps known categories in display order and drops unknown ones', () => {
    expect(normalizeRunOptions({ formFactor: 'mobile', categories: ['agentic', 'seo', 'pwa', 'seo'] })).toEqual({
      formFactor: 'mobile',
      categories: ['seo', 'agentic'],
    });
  });

  it('never returns an empty selection', () => {
    expect(normalizeRunOptions({ categories: [] }).categories).toEqual(DEFAULT_RUN_OPTIONS.categories);
    expect(normalizeRunOptions({ categories: ['nope'] }).categories).toEqual(DEFAULT_RUN_OPTIONS.categories);
  });

  it('treats any form factor but mobile as desktop', () => {
    expect(normalizeRunOptions({ formFactor: 'tablet' }).formFactor).toBe('desktop');
  });

  it('does not share the default array', () => {
    const options = normalizeRunOptions(null);
    options.categories.pop();
    expect(DEFAULT_RUN_OPTIONS.categories).toHaveLength(5);
  });
});

describe('parseClientMessage', () => {
  it('accepts the three message types', () => {
    expect(parseClientMessage({ type: 'watch', tabId: 4 })).toEqual({ type: 'watch', tabId: 4 });
    expect(parseClientMessage({ type: 'cancel', tabId: 4 })).toEqual({ type: 'cancel', tabId: 4 });
    expect(parseClientMessage({ type: 'start', tabId: 4, options: { formFactor: 'mobile', categories: ['agentic'] } })).toEqual({
      type: 'start',
      tabId: 4,
      options: { formFactor: 'mobile', categories: ['agentic'] },
    });
  });

  it('normalizes start options', () => {
    expect(parseClientMessage({ type: 'start', tabId: 1 })).toEqual({ type: 'start', tabId: 1, options: DEFAULT_RUN_OPTIONS });
  });

  it.each([null, 'watch', { type: 'watch' }, { type: 'watch', tabId: -1 }, { type: 'watch', tabId: 1.5 }, { type: 'watch', tabId: '1' }, { type: 'run', tabId: 1 }])(
    'drops %j',
    (message) => {
      expect(parseClientMessage(message)).toBeUndefined();
    },
  );
});

describe('parseServerMessage', () => {
  it('accepts a state or null', () => {
    expect(parseServerMessage({ type: 'state', tabId: 2, state: null })).toEqual({ type: 'state', tabId: 2, state: null });
    expect(parseServerMessage({ type: 'state', tabId: 2, state: { runId: 'x' } })?.state).toEqual({ runId: 'x' });
  });

  it('drops anything else', () => {
    expect(parseServerMessage({ type: 'state', tabId: 2, state: 'done' })).toBeUndefined();
    expect(parseServerMessage({ type: 'state', tabId: 2 })).toBeUndefined();
    expect(parseServerMessage({ type: 'other', tabId: 2, state: null })).toBeUndefined();
  });
});

describe('run helpers', () => {
  it('orders run ids by time', () => {
    const early = newRunId(1_700_000_000_000, () => 0.99);
    const late = newRunId(1_700_000_000_001, () => 0);
    expect(early < late).toBe(true);
    expect(early).toMatch(/^[0-9a-z]+-[0-9a-z]{6}$/);
  });

  it('knows which phases are final', () => {
    expect(['queued', 'running', 'done', 'failed', 'cancelled'].filter((phase) => isFinished(phase as never))).toEqual(['done', 'failed', 'cancelled']);
  });

  it('averages the scores that exist', () => {
    expect(overallOf({ performance: 90, seo: 80, agentic: null })).toBe(85);
    expect(overallOf({})).toBeNull();
  });

  it('summarizes a record for history lists', () => {
    const record: RunRecord = {
      id: 'a',
      url: 'https://example.com/',
      origin: 'https://example.com',
      startedAt: '2026-01-01T00:00:00.000Z',
      durationMs: 1000,
      options: { formFactor: 'mobile', categories: ['agentic'] },
      scores: { agentic: 77 },
      overall: 77,
      errors: {},
      environment: { extensionVersion: '0.1.0', userAgent: 'test' },
    };
    expect(summarize(record)).toEqual({
      id: 'a',
      url: 'https://example.com/',
      origin: 'https://example.com',
      startedAt: '2026-01-01T00:00:00.000Z',
      formFactor: 'mobile',
      scores: { agentic: 77 },
      overall: 77,
    });
  });
});
