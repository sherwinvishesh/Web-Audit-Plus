import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gatherEvidence, PROBE_ORDER } from '../../src/agentic/evidence';
import { MAX_CHILD_SITEMAPS } from '../../src/agentic/sitemap';
import { buildAgenticReport } from '../../src/agentic/report';
import { createNodeTransport } from '../../src/agentic/transports/node';
import type { ProbeProgress } from '../../src/agentic/types';
import { compliantSite, hugeSite, redirectLoopSite, spaCatchAllSite, type FixtureSite } from '../fixtures/sites';

const transport = createNodeTransport();

describe('a compliant site, over real HTTP', () => {
  let site: FixtureSite;
  beforeAll(async () => {
    site = await compliantSite();
  });
  afterAll(() => site.close());

  it('scores 100, with A8 na on a local host', async () => {
    const events: ProbeProgress[] = [];
    const evidence = await gatherEvidence(`${site.origin}/resume#section`, transport, { onProgress: (event) => events.push(event) });
    const report = buildAgenticReport(evidence);
    const notPassing = report.checks.filter((check) => check.status !== 'pass').map((check) => `${check.id} ${check.status}: ${check.reason}`);
    expect(notPassing).toEqual([expect.stringMatching(/^A8 na/)]);
    expect(report.score.value).toBe(100);
    expect(report.url).toBe(`${site.origin}/resume`);
    expect(report.twinUrl).toBe(`${site.origin}/resume.md`);
    // Every probe reported a start and a finish, in the declared order for the starts.
    const started = events.filter((event) => event.phase === 'start').map((event) => event.label);
    expect(started).toEqual([...PROBE_ORDER]);
    expect(events.filter((event) => event.phase === 'done')).toHaveLength(PROBE_ORDER.length);
  });

  it('stops between stages when aborted', async () => {
    const controller = new AbortController();
    const pending = gatherEvidence(`${site.origin}/resume`, transport, {
      signal: controller.signal,
      onProgress: (event) => {
        if (event.phase === 'done' && event.label === 'html') controller.abort(new Error('cancelled'));
      },
    });
    await expect(pending).rejects.toThrow('cancelled');
  });
});

describe('an SPA whose catch-all answers every path with its shell', () => {
  let site: FixtureSite;
  beforeAll(async () => {
    site = await spaCatchAllSite();
  });
  afterAll(() => site.close());

  it('fails B1, A2 and A3 on the HTML stand-ins and engages the cascade', async () => {
    const report = buildAgenticReport(await gatherEvidence(`${site.origin}/dashboard`, transport));
    const byId = new Map(report.checks.map((check) => [check.id, check]));
    expect(byId.get('B1')?.status).toBe('fail');
    expect(byId.get('A2')?.status).toBe('fail');
    expect(byId.get('A3')?.status).not.toBe('pass');
    expect(byId.get('A1')?.status).toBe('fail');
    expect(byId.get('A5')?.status).toBe('fail');
    expect(report.score.locked.count).toBeGreaterThan(0);
    expect(report.checks.filter((check) => check.status === 'locked').every((check) => check.lockedBy === 'B1')).toBe(true);
    // The scored failures lead the list; the twin follows as the first suggestion.
    expect(report.fixes[0]?.suggestion).toBeUndefined();
    expect(report.fixes[0]?.points).toBeGreaterThan(0);
    expect(report.fixes.find((fix) => fix.id === 'B1')).toMatchObject({ suggestion: true, points: 0, unlocks: report.score.locked.count });
  });
});

describe('the node transport', () => {
  let site: FixtureSite;
  beforeAll(async () => {
    site = await redirectLoopSite();
  });
  afterAll(() => site.close());

  it('gives up on a redirect loop with a status-0 response, not a rejection', async () => {
    const response = await transport.probe({ url: `${site.origin}/loop` });
    expect(response.status).toBe(0);
    expect(response.ok).toBe(false);
    expect(response.error).toMatch(/redirects/);
  });

  it('reports a refused connection as an error response', async () => {
    const response = await transport.probe({ url: 'http://127.0.0.1:9/', timeoutMs: 2000 });
    expect(response.status).toBe(0);
    expect(response.error).toBeTruthy();
  });

  it('caps the body', async () => {
    const big = await spaCatchAllSite();
    try {
      const response = await transport.probe({ url: big.origin, maxBytes: 16 });
      expect(response.truncated).toBe(true);
      expect(new TextEncoder().encode(response.body).byteLength).toBeLessThanOrEqual(16);
    } finally {
      await big.close();
    }
  });
});

describe('a site with a sitemap index far past any sensible size', () => {
  let site: Awaited<ReturnType<typeof hugeSite>>;
  beforeAll(async () => {
    site = await hugeSite();
  });
  afterAll(() => site.close());

  it('fetches only the first child sitemaps, and still builds a report', async () => {
    const evidence = await gatherEvidence(`${site.origin}/`, transport);
    expect(evidence.robots.status).toBe(200);
    expect(evidence.sitemap.status).toBe(200);
    expect(evidence.sitemapChildren).toHaveLength(MAX_CHILD_SITEMAPS);
    expect(evidence.sitemapChildren.every((child) => child.status === 200)).toBe(true);
    expect([...site.hits.keys()].filter((path) => path.startsWith('/sitemaps/'))).toHaveLength(MAX_CHILD_SITEMAPS);
    const report = buildAgenticReport(evidence);
    expect(typeof report.score.value).toBe('number');
  });
});
