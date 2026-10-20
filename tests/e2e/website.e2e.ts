import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveWebsite, type WebsiteServer } from '../helpers/website-server';
import type { RunRecord } from '../../src/shared/run';
import { canRun, launch, type Harness } from './chrome';

/**
 * The website audited by the extension it promotes. Accessibility, Best Practices and SEO must be
 * perfect; Performance is a lab measurement, so it gets a little room for a slow CI machine.
 * The Agentic checks that need response headers cannot pass on a static host, and the list below
 * is exactly that set: anything else not passing is a regression in the site or its twins.
 */
const STATIC_HOST_LIMITS = ['A8 na', 'B4 fail', 'B5 fail', 'B6 fail', 'B7 fail', 'B8 fail', 'B9 fail', 'B10 fail', 'B11 fail', 'B12 fail'];
const PAGES = ['/', '/docs/', '/privacy/'];
const ALL = ['performance', 'accessibility', 'best-practices', 'seo', 'agentic'] as const;

/** Names the category in a failed score check and, if it has no score, says why: the run's error or the audits that did not score. */
function scoreContext(record: RunRecord | undefined, category: keyof RunRecord['errors']): string {
  const engine = record?.engine;
  const unscored = (engine?.categories[category]?.auditRefs ?? [])
    .filter((ref) => ref.weight > 0)
    .flatMap((ref) => {
      const audit = engine?.audits[ref.id];
      return audit && audit.score === null ? [`${audit.id} (${audit.scoreDisplayMode})${audit.errorMessage ? `: ${audit.errorMessage}` : ''}`] : [];
    });
  return [category, record?.errors[category], ...unscored].filter(Boolean).join('; ');
}

describe.skipIf(!canRun)('the website, audited by the extension', () => {
  let harness: Harness;
  let site: WebsiteServer;

  beforeAll(async () => {
    [site, harness] = await Promise.all([serveWebsite(), launch()]);
  });
  afterAll(async () => {
    await harness?.close();
    await site?.close();
  });

  for (const path of PAGES) {
    it(`scores ${path} as it promises`, async () => {
      const { tabId } = await harness.openTab(`${site.origin}${path}`);
      const state = await harness.run(tabId, { formFactor: 'mobile', categories: [...ALL] });
      const record = await harness.record(state.runId);
      expect(state.error).toBeUndefined();
      expect(state.phase).toBe('done');
      expect(state.scores.accessibility, scoreContext(record, 'accessibility')).toBe(100);
      expect(state.scores['best-practices'], scoreContext(record, 'best-practices')).toBe(100);
      expect(state.scores.seo, scoreContext(record, 'seo')).toBe(100);
      expect(state.scores.performance, scoreContext(record, 'performance')).toBeGreaterThanOrEqual(90);

      const notPassing = record?.agentic?.checks.filter((check) => check.status !== 'pass').map((check) => `${check.id} ${check.status}`);
      expect(notPassing).toEqual(STATIC_HOST_LIMITS);
    });
  }

  it('serves the markdown twins as markdown and the 404 page as a 404', async () => {
    const twin = await fetch(`${site.origin}/docs.md`);
    expect(twin.status).toBe(200);
    expect(twin.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    const missing = await fetch(`${site.origin}/nowhere/`);
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain('That page does not exist');
  });
});
