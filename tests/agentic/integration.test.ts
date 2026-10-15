import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gatherEvidence, PROBE_ORDER } from '../../src/agentic/evidence';
import { buildAgenticReport } from '../../src/agentic/report';
import { createNodeTransport } from '../../src/agentic/transports/node';
import type { ProbeProgress } from '../../src/agentic/types';
import { compliantSite, redirectLoopSite, spaCatchAllSite, type FixtureSite } from '../fixtures/sites';

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
    expect(report.fixes[0]?.id).toBe('B1');
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
