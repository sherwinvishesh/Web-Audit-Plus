import { describe, expect, it } from 'vitest';
import { CHECKS, runChecks } from '../../src/agentic/checks';
import { TTFB_FAST_MS, TTFB_SLOW_MS } from '../../src/agentic/checks/a6-ttfb';
import { describeAge } from '../../src/agentic/checks/b14-drift';
import { contentHash } from '../../src/agentic/hash';
import { liveExtract } from '../../src/agentic/extract';
import { MARKDOWN_CONTENT_TYPE } from '../../src/agentic/http';
import type { CheckResult, Evidence, ProbeResponse, Status } from '../../src/agentic/types';
import { GOOD_HTML, GOOD_TWIN, goodEvidence, missing, probe, SPA_SHELL } from '../helpers/evidence';

function run(id: string, e: Evidence): CheckResult {
  const check = CHECKS.find((entry) => entry.id === id);
  if (!check) throw new Error(`no check ${id}`);
  return check.run(e);
}

function status(id: string, e: Evidence): Status {
  return run(id, e).status;
}

/** Good evidence with the twin probe replaced, the twin headers merged. */
function withTwin(overrides: Partial<ProbeResponse>): Evidence {
  const e = goodEvidence();
  return { ...e, twin: { ...e.twin, ...overrides, headers: { ...e.twin.headers, ...overrides.headers } } };
}

function withHtmlHeaders(headers: Record<string, string>): Evidence {
  const e = goodEvidence();
  return { ...e, html: { ...e.html, headers } };
}

describe('every check on the good site', () => {
  it('passes, at full weight', () => {
    for (const check of CHECKS) {
      const result = check.run(goodEvidence());
      expect({ id: check.id, status: result.status }).toEqual({ id: check.id, status: 'pass' });
      expect(result.earned).toBe(check.weight);
    }
  });

  it('never leaves a fix on a pass', () => {
    for (const result of runChecks(goodEvidence())) expect(result.fix).toBeUndefined();
  });
});

describe('A1 robots.txt', () => {
  const robots = (body: string): Evidence => ({ ...goodEvidence(), robots: probe({ url: 'https://example.com/robots.txt', body }) });

  it('fails on a missing robots.txt', () => {
    expect(status('A1', { ...goodEvidence(), robots: missing('https://example.com/robots.txt') })).toBe('fail');
  });

  it('fails when a catch-all serves HTML at /robots.txt', () => {
    const result = run('A1', robots(SPA_SHELL));
    expect(result.status).toBe('fail');
    expect(result.reason).toMatch(/HTML page/);
  });

  it('fails when an assistant or search agent is blocked', () => {
    const result = run('A1', robots('User-agent: *\nDisallow: /'));
    expect(result.status).toBe('fail');
    expect(result.reason).toContain('` Disallow: / `');
  });

  it('gives 6 of 9 for a training-only opt-out', () => {
    const result = run('A1', robots('User-agent: GPTBot\nUser-agent: CCBot\nDisallow: /\n\nUser-agent: *\nAllow: /'));
    expect(result.status).toBe('partial');
    expect(result.earned).toBe(6);
  });

  it('reads the rule for this page, not the whole site', () => {
    expect(status('A1', robots('User-agent: *\nDisallow: /private'))).toBe('pass');
    expect(status('A1', robots('User-agent: *\nDisallow: /res'))).toBe('fail');
    expect(status('A1', robots('User-agent: *\nDisallow: /\nAllow: /resume$'))).toBe('pass');
  });
});

describe('A2 llms.txt', () => {
  const llms = (body: string): Evidence => ({ ...goodEvidence(), llms: probe({ url: 'https://example.com/llms.txt', body }) });

  it('tiers: missing, HTML, empty, no links, no title, valid', () => {
    expect(status('A2', { ...goodEvidence(), llms: missing('https://example.com/llms.txt') })).toBe('fail');
    expect(status('A2', llms(SPA_SHELL))).toBe('fail');
    expect(run('A2', llms('')).earned).toBe(1);
    expect(run('A2', llms('# Title\n\nNo links here.')).earned).toBe(1);
    expect(run('A2', llms('- [A](https://example.com/a)')).earned).toBe(2);
    expect(status('A2', llms('# T\n\n- [A](https://example.com/a)'))).toBe('pass');
  });
});

describe('A3 sitemap.xml', () => {
  const sitemap = (body: string, children: ProbeResponse[] = []): Evidence => ({
    ...goodEvidence(),
    sitemap: probe({ url: 'https://example.com/sitemap.xml', body }),
    sitemapChildren: children,
  });
  const urlset = (...paths: string[]): string => `<urlset>${paths.map((path) => `<url><loc>https://example.com${path}</loc></url>`).join('')}</urlset>`;

  it('fails when missing, partial when not XML or empty', () => {
    expect(status('A3', { ...goodEvidence(), sitemap: missing('https://example.com/sitemap.xml') })).toBe('fail');
    expect(status('A3', sitemap(SPA_SHELL))).toBe('partial');
    expect(run('A3', sitemap('<urlset></urlset>')).earned).toBe(3);
  });

  it('is partial when the page is not listed, and tolerates a trailing slash', () => {
    expect(status('A3', sitemap(urlset('/other')))).toBe('partial');
    expect(status('A3', sitemap(urlset('/resume/')))).toBe('pass');
  });

  it('follows a sitemap index into its children', () => {
    const index = '<sitemapindex><sitemap><loc>https://example.com/s1.xml</loc></sitemap><sitemap><loc>https://example.com/s2.xml</loc></sitemap></sitemapindex>';
    const child = (body: string): ProbeResponse => probe({ url: 'https://example.com/s1.xml', body });
    expect(status('A3', sitemap(index, [child(urlset('/a')), child(urlset('/resume'))]))).toBe('pass');
    expect(run('A3', sitemap(index, [child(urlset('/a'))])).earned).toBe(6);
    expect(run('A3', sitemap(index, [])).earned).toBe(3);
  });

  it('passes an index too large to read in full rather than guessing', () => {
    const index = `<sitemapindex>${Array.from({ length: 12 }, (_, i) => `<sitemap><loc>https://example.com/s${i}.xml</loc></sitemap>`).join('')}</sitemapindex>`;
    const result = run('A3', sitemap(index, [probe({ body: urlset('/a') })]));
    expect(result.status).toBe('pass');
    expect(result.detail).toMatch(/not in the first 10/);
  });
});

describe('A4 JSON-LD', () => {
  const html = (head: string): Evidence => {
    const e = goodEvidence();
    return { ...e, html: { ...e.html, body: GOOD_HTML.replace(/<script type="application\/ld\+json">.*?<\/script>/s, head) } };
  };

  it('tiers: none, broken, no @type, valid, @graph', () => {
    expect(status('A4', html(''))).toBe('fail');
    expect(run('A4', html('<script type="application/ld+json">{nope</script>')).earned).toBe(1);
    expect(run('A4', html('<script type="application/ld+json">{"name":"x"}</script>')).earned).toBe(1);
    expect(status('A4', html('<script type="application/ld+json">{"@graph":[{"@type":"WebSite"}]}</script>'))).toBe('pass');
  });
});

describe('A5 content in the raw HTML', () => {
  const body = (html: string): Evidence => {
    const e = goodEvidence();
    return { ...e, html: { ...e.html, body: html } };
  };

  it('fails an SPA shell, passes server-rendered content', () => {
    expect(status('A5', body(SPA_SHELL))).toBe('fail');
    expect(status('A5', goodEvidence())).toBe('pass');
  });

  it('is partial for thin server-rendered content', () => {
    const words = Array.from({ length: 30 }, (_, i) => `w${i}`).join(' ');
    expect(status('A5', body(`<html><body><main><p>${words}</p></main></body></html>`))).toBe('partial');
  });
});

describe('A6 time to first byte', () => {
  const ttfb = (ms: number, measuredFrom: Evidence['measuredFrom'] = 'node'): Evidence => {
    const e = goodEvidence();
    return { ...e, measuredFrom, html: { ...e.html, ttfbMs: ms } };
  };

  it('ramps between the fast and slow thresholds', () => {
    expect(status('A6', ttfb(TTFB_FAST_MS))).toBe('pass');
    expect(status('A6', ttfb(TTFB_SLOW_MS))).toBe('fail');
    const middle = run('A6', ttfb((TTFB_FAST_MS + TTFB_SLOW_MS) / 2));
    expect(middle.status).toBe('partial');
    expect(middle.earned).toBeGreaterThan(0);
    expect(middle.earned).toBeLessThan(middle.weight);
  });

  it('says where it was measured from in the browser', () => {
    expect(run('A6', ttfb(100, 'browser')).reason).toContain('measured from this browser');
  });

  it('is na when the page did not respond', () => {
    expect(status('A6', { ...goodEvidence(), html: missing('https://example.com/resume', 0, '') })).toBe('na');
  });
});

describe('A7 AI opt-out directives', () => {
  it('fails on X-Robots-Tag noai and on a robots meta noimageai', () => {
    expect(status('A7', withHtmlHeaders({ 'content-type': 'text/html', 'x-robots-tag': 'noai' }))).toBe('fail');
    const e = goodEvidence();
    const meta = { ...e, html: { ...e.html, body: GOOD_HTML.replace('<title>', '<meta name="robots" content="index, noimageai"><title>') } };
    expect(status('A7', meta)).toBe('fail');
  });
});

describe('A8 HTTPS and HSTS', () => {
  it('fails plain HTTP, is partial without HSTS', () => {
    const e = goodEvidence();
    expect(status('A8', { ...e, target: 'http://example.com/resume', html: { ...e.html, finalUrl: 'http://example.com/resume' } })).toBe('fail');
    expect(run('A8', withHtmlHeaders({ 'content-type': 'text/html' })).earned).toBe(6);
  });

  it('is na on local development hosts', () => {
    for (const host of ['localhost:3000', '127.0.0.1:8080', '[::1]:5173', 'app.localhost', 'mac.local']) {
      const e = goodEvidence();
      const url = `http://${host}/resume`;
      expect({ host, status: status('A8', { ...e, target: url, origin: new URL(url).origin, html: { ...e.html, url, finalUrl: url } }) }).toEqual({ host, status: 'na' });
    }
  });
});

describe('B1 to B6: the twin response', () => {
  it('B1 fails on 404, on a network error and on an HTML shell', () => {
    expect(status('B1', withTwin({ ok: false, status: 404 }))).toBe('fail');
    expect(run('B1', withTwin({ ok: false, status: 0, error: 'ECONNREFUSED' })).reason).toContain('ECONNREFUSED');
    expect(status('B1', withTwin({ body: SPA_SHELL }))).toBe('fail');
  });

  it('B2 tiers the Content-Type', () => {
    expect(status('B2', withTwin({ headers: { 'content-type': MARKDOWN_CONTENT_TYPE } }))).toBe('pass');
    expect(status('B2', withTwin({ headers: { 'content-type': 'text/markdown' } }))).toBe('partial');
    expect(status('B2', withTwin({ headers: { 'content-type': 'text/plain; charset=utf-8' } }))).toBe('partial');
    expect(status('B2', withTwin({ headers: { 'content-type': 'application/octet-stream' } }))).toBe('fail');
  });

  it('B3 compares the twin with the page', () => {
    expect(status('B3', withTwin({ body: '' }))).toBe('fail');
    expect(status('B3', withTwin({ body: '# Resume\n\nShort stub with a few words in it.' }))).toBe('partial');
  });

  it('B4 wants a positive integer', () => {
    expect(status('B4', withTwin({ headers: { 'x-markdown-tokens': '' } }))).toBe('fail');
    expect(status('B4', withTwin({ headers: { 'x-markdown-tokens': '12.5' } }))).toBe('fail');
    expect(status('B4', withTwin({ headers: { 'x-markdown-tokens': '0' } }))).toBe('fail');
  });

  it('B5 and B6 read their headers', () => {
    expect(status('B5', withTwin({ headers: { 'x-content-type-options': '' } }))).toBe('fail');
    expect(status('B6', withTwin({ headers: { 'x-robots-tag': '' } }))).toBe('fail');
    expect(status('B6', withTwin({ headers: { 'x-robots-tag': 'nofollow' } }))).toBe('partial');
  });
});

describe('B7 Vary: Accept', () => {
  // The twin keeps its own Vary: Accept, so an HTML header that does not parse as Accept leaves
  // exactly one of the two responses right: a partial.
  const cases: Array<[string, Status]> = [
    ['Accept', 'pass'],
    ['accept', 'pass'],
    ['Accept, Accept-Encoding', 'pass'],
    ['*', 'pass'],
    ['Accept-Encoding', 'partial'],
    ['rsc, next-router-state-tree, next-router-prefetch, Accept-Encoding', 'partial'],
    ['', 'partial'],
  ];
  for (const [vary, expected] of cases) {
    it(`Vary: ${JSON.stringify(vary)} is ${expected}`, () => {
      expect(status('B7', withHtmlHeaders({ 'content-type': 'text/html', vary }))).toBe(expected);
    });
  }

  it('fails when neither response varies on Accept', () => {
    const e = withHtmlHeaders({ 'content-type': 'text/html', vary: 'Accept-Encoding' });
    expect(status('B7', { ...e, twin: { ...e.twin, headers: { ...e.twin.headers, vary: 'Accept-Encoding' } } })).toBe('fail');
  });
});

describe('B8 Link rel=alternate', () => {
  it('passes a same-origin advertised twin', () => {
    expect(status('B8', goodEvidence())).toBe('pass');
  });

  it('is partial for a cross-origin twin, which is reported but never fetched', () => {
    const e = goodEvidence();
    delete e.advertisedTwinUrl;
    expect(status('B8', { ...e, foreignTwinUrl: 'https://other.example/resume.md' })).toBe('partial');
  });

  it('fails without a Link header', () => {
    const e = withHtmlHeaders({ 'content-type': 'text/html' });
    delete e.advertisedTwinUrl;
    expect(status('B8', e)).toBe('fail');
  });
});

describe('B9 and B10 negotiation at the same URL', () => {
  const markdown = (overrides: Partial<ProbeResponse>): ProbeResponse =>
    probe({ body: GOOD_TWIN, headers: { 'content-type': MARKDOWN_CONTENT_TYPE }, ...overrides });

  it('pass on a rewrite (markdown at the same URL)', () => {
    expect(status('B9', { ...goodEvidence(), acceptMarkdown: markdown({}) })).toBe('pass');
    expect(status('B10', { ...goodEvidence(), botUa: markdown({}) })).toBe('pass');
  });

  it('fail on a redirect to the .md URL', () => {
    const redirected = markdown({ redirected: true, finalUrl: 'https://example.com/resume.md' });
    expect(status('B9', { ...goodEvidence(), acceptMarkdown: redirected })).toBe('fail');
    expect(status('B10', { ...goodEvidence(), botUa: redirected })).toBe('fail');
  });

  it('fail when HTML comes back', () => {
    const html = probe({ body: GOOD_HTML, headers: { 'content-type': 'text/html' } });
    expect(status('B9', { ...goodEvidence(), acceptMarkdown: html })).toBe('fail');
    expect(run('B10', { ...goodEvidence(), botUa: html }).reason).toContain('GPTBot');
  });

  it('fail on an error status', () => {
    expect(status('B10', { ...goodEvidence(), botUa: missing('https://example.com/resume', 403) })).toBe('fail');
  });
});

describe('B11 to B13', () => {
  it('B11 wants 406 for an Accept it cannot satisfy', () => {
    expect(status('B11', { ...goodEvidence(), notAcceptable: probe({ body: GOOD_HTML }) })).toBe('fail');
  });

  it('B12 is presence-only', () => {
    expect(status('B12', withTwin({ headers: { 'x-aeo-version': 'anything' } }))).toBe('pass');
    expect(status('B12', withTwin({ headers: { 'x-aeo-version': '' } }))).toBe('fail');
  });

  it('B13 fails when a browser is redirected to the twin', () => {
    const e = goodEvidence();
    expect(status('B13', { ...e, html: { ...e.html, redirected: true, finalUrl: 'https://example.com/resume.md' } })).toBe('fail');
  });

  it('B13 fails when a browser gets markdown or an empty body', () => {
    const e = goodEvidence();
    expect(status('B13', { ...e, html: { ...e.html, headers: { 'content-type': MARKDOWN_CONTENT_TYPE } } })).toBe('fail');
    expect(status('B13', { ...e, html: { ...e.html, body: '  ' } })).toBe('fail');
  });
});

describe('B14 drift', () => {
  const liveHash = (): string => contentHash(liveExtract(goodEvidence()).markdown);

  it('passes an exact source hash, from the header or the frontmatter', () => {
    expect(status('B14', withTwin({ headers: { 'x-markdown-source-hash': liveHash() } }))).toBe('pass');
    expect(status('B14', withTwin({ body: `---\nsource_hash: ${liveHash()}\n---\n${GOOD_TWIN}` }))).toBe('pass');
  });

  it('is partial when the hash changed but every fact survived', () => {
    const result = run('B14', withTwin({ headers: { 'x-markdown-source-hash': '0000000000000000' } }));
    expect(result.status).toBe('partial');
    expect(result.earned).toBe(2);
  });

  it('fails when the hash changed and a fact is gone', () => {
    const stale = GOOD_TWIN.replace('2024', '2019').replace('forty-two', 'some').replace('twelve thousand five hundred', 'many');
    const e = goodEvidence();
    const html = { ...e.html, body: GOOD_HTML.replace('2024', '2025').replace('three teams', '17 teams') };
    expect(status('B14', { ...e, html, twin: { ...e.twin, body: stale, headers: { ...e.twin.headers, 'x-markdown-source-hash': '0000000000000000' } } })).toBe('fail');
  });

  it('without a hash, compares facts: one change is partial, several fail', () => {
    const facts = 'Revenue reached $1,250 in 2024 with 12% growth, 42 services, 7 teams and 19 releases. '.repeat(1);
    const filler = GOOD_TWIN.split('\n\n')[1] ?? '';
    const page = (text: string): string => `<!doctype html><html><head><title>R</title></head><body><main><h1>Resume</h1><p>${text}</p><p>${filler}</p></main></body></html>`;
    const twin = `# Resume\n\n${facts}\n\n${filler}`;
    const e = goodEvidence();
    const evidence = (text: string): Evidence => ({ ...e, html: { ...e.html, body: page(text) }, twin: { ...e.twin, body: twin } });
    expect(status('B14', evidence(facts))).toBe('pass');
    expect(status('B14', evidence(facts.replace('19 releases', '23 releases')))).toBe('partial');
    expect(status('B14', evidence(facts.replace('$1,250', '$2,000').replace('2024', '2025').replace('12%', '30%')))).toBe('fail');
  });

  it('measures age from fetchedAt, not the wall clock', () => {
    const now = '2026-10-14T12:00:00.000Z';
    expect(describeAge('2026-10-14T08:00:00.000Z', now)).toBe('today');
    expect(describeAge('2026-10-13T08:00:00.000Z', now)).toBe('yesterday');
    expect(describeAge('2026-10-04T12:00:00.000Z', now)).toBe('10 days ago');
    expect(describeAge('not a date', now)).toBeUndefined();
  });

  it('is na when the live page did not respond', () => {
    expect(status('B14', { ...goodEvidence(), html: missing('https://example.com/resume', 500, '') })).toBe('na');
  });
});

describe('runChecks', () => {
  it('turns a check that throws into na instead of losing the run', () => {
    const e = goodEvidence();
    const broken = { ...e, target: 'not a url' } as Evidence;
    const results = runChecks(broken);
    expect(results).toHaveLength(CHECKS.length);
    const a1 = results.find((result) => result.id === 'A1');
    expect(a1?.status).toBe('na');
    expect(a1?.reason).toMatch(/could not run/);
  });
});
