import { describe, expect, it } from 'vitest';
import type { RunSummary } from '../../src/shared/run';
import { originOf, overallDelta, previousRuns, splitSiteHistory } from '../../src/ui/lib/history';

function summary(id: string, url: string, startedAt: string, formFactor: 'desktop' | 'mobile' = 'desktop', overall: number | null = 80): RunSummary {
  return { id, url, origin: new URL(url).origin, startedAt, formFactor, scores: { agentic: overall }, overall };
}

// Newest first, as the store lists them.
const RUNS: RunSummary[] = [
  summary('e', 'https://example.com/', '2026-10-15T10:00:00Z', 'desktop', 91),
  summary('d', 'https://example.com/pricing', '2026-10-15T09:00:00Z', 'desktop', 70),
  summary('c', 'https://example.com/', '2026-10-15T08:00:00Z', 'mobile', 60),
  summary('b', 'https://example.com/', '2026-10-15T07:00:00Z', 'desktop', 84),
  summary('a', 'https://example.com/', '2026-10-14T07:00:00Z', 'desktop', 80),
];

describe('previousRuns', () => {
  it('pairs each run with the run of the same URL and device just before it', () => {
    const previous = previousRuns(RUNS);
    expect(previous.get('e')?.id).toBe('b');
    expect(previous.get('b')?.id).toBe('a');
    expect(previous.get('a')).toBeUndefined();
    // A different device or page is not a predecessor.
    expect(previous.get('c')).toBeUndefined();
    expect(previous.get('d')).toBeUndefined();
  });
});

describe('splitSiteHistory', () => {
  it("separates the page's runs from the rest of the site, newest first", () => {
    const history = splitSiteHistory(RUNS, 'https://example.com/');
    expect(history.page.map((run) => run.id)).toEqual(['e', 'c', 'b', 'a']);
    expect(history.elsewhere.map((run) => run.id)).toEqual(['d']);
  });

  it('leaves out the run shown next to the list, but still uses it as a predecessor', () => {
    const history = splitSiteHistory(RUNS, 'https://example.com/', 'e');
    expect(history.page.map((run) => run.id)).toEqual(['c', 'b', 'a']);
    expect(history.previous.get('e')?.id).toBe('b');
  });

  it('is exact about the URL: a query string or a sub-path is another page', () => {
    const runs = [summary('x', 'https://example.com/docs?v=2', '2026-10-15T10:00:00Z'), summary('y', 'https://example.com/docs/api', '2026-10-15T09:00:00Z')];
    const history = splitSiteHistory(runs, 'https://example.com/docs');
    expect(history.page).toEqual([]);
    expect(history.elsewhere.map((run) => run.id)).toEqual(['x', 'y']);
  });

  it('handles a site with no runs', () => {
    const history = splitSiteHistory([], 'https://example.com/');
    expect(history.page).toEqual([]);
    expect(history.elsewhere).toEqual([]);
    expect(history.previous.size).toBe(0);
  });
});

describe('overallDelta', () => {
  const full = (id: string, overall: number): RunSummary => ({
    ...summary(id, 'https://example.com/', '2026-10-15T10:00:00Z', 'desktop', overall),
    scores: { performance: overall, accessibility: overall, 'best-practices': overall, seo: overall, agentic: overall },
  });

  it('is the change since the run before, when both scored the same categories', () => {
    expect(overallDelta(full('b', 84), full('a', 80))).toBe(4);
    expect(overallDelta(full('b', 70), full('a', 80))).toBe(-10);
  });

  it('is nothing without a predecessor, without a score, when flat, or across different category sets', () => {
    expect(overallDelta(full('b', 84), undefined)).toBeUndefined();
    expect(overallDelta(full('b', 84), full('a', 84))).toBeUndefined();
    expect(overallDelta({ ...full('b', 84), overall: null }, full('a', 80))).toBeUndefined();
    // Agentic only against all five: not comparable, whatever the numbers say.
    expect(overallDelta(full('b', 75), summary('a', 'https://example.com/', '2026-10-15T09:00:00Z', 'desktop', 52))).toBeUndefined();
  });
});

describe('originOf', () => {
  it('reads the origin of a URL and gives up on anything else', () => {
    expect(originOf('https://example.com/a/b?c')).toBe('https://example.com');
    expect(originOf('http://127.0.0.1:5500/website/index.html')).toBe('http://127.0.0.1:5500');
    expect(originOf('not a url')).toBeUndefined();
  });
});
