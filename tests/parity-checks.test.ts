import { describe, expect, it } from 'vitest';
import { AI_BOTS } from '../src/agentic/bots';
import { CHECKS, runChecks, TWIN_LOCKED_IDS } from '../src/agentic/checks';
import { resolveAdvertised } from '../src/agentic/evidence';
import { header, MARKDOWN_CONTENT_TYPE, toHeaderMap } from '../src/agentic/http';
import { childSitemapUrls, MAX_CHILD_SITEMAPS } from '../src/agentic/sitemap';
import type { CheckResult, Evidence, ProbeResponse } from '../src/agentic/types';
import { contentHash } from '../src/agentic/hash';
import { liveExtract } from '../src/agentic/extract';
import { GOOD_HTML, GOOD_TWIN, goodEvidence, probe, SPA_SHELL, unadoptedEvidence } from './helpers/evidence';

/**
 * Edge cases pinned against OpenGEO's `opengeo test` behaviour: the cases where a naive port
 * would score differently from the reference implementation.
 */

function run(id: string, e: Evidence): CheckResult {
  const check = CHECKS.find((entry) => entry.id === id);
  if (!check) throw new Error(`no check ${id}`);
  return check.run(e);
}

function withTwinHeaders(headers: Record<string, string>): Evidence {
  const e = goodEvidence();
  return { ...e, twin: { ...e.twin, headers: { ...e.twin.headers, ...headers } } };
}

function withHtmlHeaders(headers: Record<string, string>): Evidence {
  const e = goodEvidence();
  return { ...e, html: { ...e.html, headers: { ...e.html.headers, ...headers } } };
}

const robots = (body: string): Evidence => ({ ...goodEvidence(), robots: probe({ url: 'https://example.com/robots.txt', body }) });

describe('A1 robots.txt, read as a crawler reads it', () => {
  it('treats an HTML page at /robots.txt as a missing file', () => {
    const result = run('A1', robots(SPA_SHELL));
    expect(result.status).toBe('fail');
    expect(result.reason).toMatch(/HTML page/);
  });

  it('honours * and $ with longest-match, Allow winning a tie', () => {
    expect(run('A1', robots('User-agent: *\nDisallow: /res*\nAllow: /resume$')).status).toBe('pass');
    expect(run('A1', robots('User-agent: *\nDisallow: /*.pdf$')).status).toBe('pass');
    expect(run('A1', robots('User-agent: *\nDisallow: /res*')).status).toBe('fail');
    expect(run('A1', robots('User-agent: *\nDisallow: /resume\nAllow: /resume')).status).toBe('pass');
    expect(run('A1', robots('User-agent: *\nDisallow: /resume$')).status).toBe('fail');
    expect(run('A1', robots('User-agent: *\nDisallow: /resume/$')).status).toBe('pass');
  });

  it('lets a bot with its own empty group ignore the * rules', () => {
    const ownGroups = AI_BOTS.map((bot) => `User-agent: ${bot.robotsToken}`).join('\n');
    expect(run('A1', robots(`User-agent: *\nDisallow: /\n\n${ownGroups}`)).status).toBe('pass');
    // One assistant left to the * group is enough to fail.
    const allButOne = AI_BOTS.filter((bot) => bot.name !== 'ChatGPT-User').map((bot) => `User-agent: ${bot.robotsToken}`).join('\n');
    const result = run('A1', robots(`User-agent: *\nDisallow: /\n\n${allButOne}`));
    expect(result.status).toBe('fail');
    expect(result.reason).toContain('ChatGPT-User');
  });

  it('merges User-agent lines into one group until a rule appears, blank lines or not (RFC 9309)', () => {
    // GPTBot has no rules of its own here: it shares the group with *, so Disallow: / covers it.
    const result = run('A1', robots('User-agent: GPTBot\n\nUser-agent: *\nDisallow: /'));
    expect(result.status).toBe('fail');
    expect(result.reason).toMatch(/Disallow: \/ ` in the ` \* ` group/);
    expect(result.detail).toContain('GPTBot');
  });

  it('matches the page path plus query, case-insensitively on the token', () => {
    const e = { ...robots('User-agent: gptbot\nUser-agent: ccbot\nDisallow: /resume?draft\n\nUser-agent: *\nAllow: /'), target: 'https://example.com/resume?draft=1' };
    const result = run('A1', e);
    expect(result.status).toBe('partial');
    expect(result.earned).toBe(6);
  });
});

describe('A2 llms.txt served by a catch-all', () => {
  it('scores a 200 HTML "not found" page as missing', () => {
    const e = { ...goodEvidence(), llms: probe({ url: 'https://example.com/llms.txt', body: '<!DOCTYPE html><html><body><h1>Not found</h1></body></html>', headers: { 'content-type': 'text/html' } }) };
    const result = run('A2', e);
    expect(result.status).toBe('fail');
    expect(result.earned).toBe(0);
  });
});

describe('A3 sitemap index', () => {
  const urlset = (...paths: string[]): string => `<urlset>${paths.map((path) => `<url><loc>https://example.com${path}</loc></url>`).join('')}</urlset>`;
  const index = (n: number): string => `<sitemapindex>${Array.from({ length: n }, (_, i) => `<sitemap><loc>https://cdn.example.net/s${i}.xml</loc></sitemap>`).join('')}</sitemapindex>`;

  it('fetches only the first 10 children, re-pointed at the audited origin', () => {
    const urls = childSitemapUrls(index(12), 'https://example.com');
    expect(urls).toHaveLength(MAX_CHILD_SITEMAPS);
    expect(urls[0]).toBe('https://example.com/s0.xml');
    expect(urls.every((url) => url.startsWith('https://example.com/'))).toBe(true);
  });

  it('finds the page in the tenth child, and passes with a note when it is beyond the tenth', () => {
    const e = goodEvidence();
    const children = (last: string): ProbeResponse[] => Array.from({ length: 10 }, (_, i) => probe({ url: `https://example.com/s${i}.xml`, body: urlset(i === 9 ? last : `/p${i}`) }));
    const sitemap = (n: number, last: string): Evidence => ({ ...e, sitemap: probe({ url: 'https://example.com/sitemap.xml', body: index(n) }), sitemapChildren: children(last) });
    const found = run('A3', sitemap(10, '/resume'));
    expect(found.status).toBe('pass');
    expect(found.reason).toMatch(/10 sitemaps it lists/);
    const beyond = run('A3', sitemap(12, '/p9'));
    expect(beyond.status).toBe('pass');
    expect(beyond.detail).toMatch(/not in the first 10/);
    expect(run('A3', sitemap(10, '/p9')).earned).toBe(6);
  });
});

describe('A8 HTTPS judged where the page lands', () => {
  const httpTarget = (overrides: Partial<ProbeResponse>): Evidence => {
    const e = goodEvidence();
    return { ...e, target: 'http://example.com/resume', origin: 'http://example.com', html: { ...e.html, url: 'http://example.com/resume', finalUrl: 'http://example.com/resume', ...overrides } };
  };

  it('passes an http:// page that redirects to https:// with HSTS', () => {
    expect(run('A8', httpTarget({ redirected: true, finalUrl: 'https://example.com/resume' })).status).toBe('pass');
  });

  it('is partial when the https:// landing has no HSTS, and fails when nothing upgrades', () => {
    const e = httpTarget({ redirected: true, finalUrl: 'https://example.com/resume' });
    expect(run('A8', { ...e, html: { ...e.html, headers: { 'content-type': 'text/html' } } }).earned).toBe(6);
    expect(run('A8', httpTarget({})).status).toBe('fail');
  });

  it('is n/a on localhost whatever the port', () => {
    const e = goodEvidence();
    const url = 'http://localhost:3000/resume';
    expect(run('A8', { ...e, target: url, origin: 'http://localhost:3000', html: { ...e.html, url, finalUrl: url } }).status).toBe('na');
  });
});

describe('header names and duplicates', () => {
  it('reads header names case-insensitively through the map', () => {
    const headers = toHeaderMap([
      ['Content-Type', MARKDOWN_CONTENT_TYPE],
      ['X-CONTENT-TYPE-OPTIONS', 'NoSniff'],
      ['x-robots-tag', 'NOINDEX'],
    ]);
    const e = goodEvidence();
    const twin = { ...e.twin, headers };
    expect(header(twin, 'Content-Type')).toBe(MARKDOWN_CONTENT_TYPE);
    expect(run('B2', { ...e, twin }).status).toBe('pass');
    expect(run('B5', { ...e, twin }).status).toBe('pass');
    expect(run('B6', { ...e, twin }).status).toBe('pass');
  });

  it('joins duplicate headers the way Headers.get does, and the checks still read them', () => {
    const headers = toHeaderMap([
      ['Vary', 'Accept'],
      ['Vary', 'Accept-Encoding'],
      ['X-Content-Type-Options', 'nosniff'],
      ['X-Content-Type-Options', 'nosniff'],
      ['X-Robots-Tag', 'noindex'],
      ['X-Robots-Tag', 'nofollow'],
    ]);
    expect(headers['vary']).toBe('Accept, Accept-Encoding');
    const e = goodEvidence();
    const twin = { ...e.twin, headers: { ...e.twin.headers, ...headers } };
    expect(run('B7', { ...e, twin }).status).toBe('pass');
    expect(run('B5', { ...e, twin }).status).toBe('pass');
    expect(run('B6', { ...e, twin }).status).toBe('pass');
  });
});

describe('B4 X-Markdown-Tokens', () => {
  it('wants plain digits, tolerating surrounding whitespace', () => {
    expect(run('B4', withTwinHeaders({ 'x-markdown-tokens': '1234' })).status).toBe('pass');
    expect(run('B4', withTwinHeaders({ 'x-markdown-tokens': ' 1234 ' })).status).toBe('pass');
    for (const raw of ['1e3', '+42', '42.0', '0x2a', '-1', 'many']) {
      expect({ raw, status: run('B4', withTwinHeaders({ 'x-markdown-tokens': raw })).status }).toEqual({ raw, status: 'fail' });
    }
  });
});

describe('B5 nosniff', () => {
  it('reads the first token, as a browser does', () => {
    expect(run('B5', withTwinHeaders({ 'x-content-type-options': 'nosniff' })).status).toBe('pass');
    expect(run('B5', withTwinHeaders({ 'x-content-type-options': 'NOSNIFF' })).status).toBe('pass');
    expect(run('B5', withTwinHeaders({ 'x-content-type-options': 'nosniff, nosniff' })).status).toBe('pass');
    expect(run('B5', withTwinHeaders({ 'x-content-type-options': 'sniff, nosniff' })).status).toBe('fail');
    expect(run('B5', withTwinHeaders({ 'x-content-type-options': 'none' })).status).toBe('fail');
  });
});

describe('B7 Vary parsed as tokens on both responses', () => {
  it('fails on Vary: accept-encoding alone, passes on Vary: *', () => {
    const encodingOnly = { ...withHtmlHeaders({ vary: 'accept-encoding' }) };
    encodingOnly.twin = { ...encodingOnly.twin, headers: { ...encodingOnly.twin.headers, vary: 'accept-encoding' } };
    const result = run('B7', encodingOnly);
    expect(result.status).toBe('fail');
    expect(result.detail).toMatch(/accept-encoding/);

    const star = withHtmlHeaders({ vary: '*' });
    star.twin = { ...star.twin, headers: { ...star.twin.headers, vary: '*' } };
    expect(run('B7', star).status).toBe('pass');
  });

  it('gives 2 of 4 when only the twin varies on Accept', () => {
    const result = run('B7', withHtmlHeaders({ vary: 'Accept-Encoding, Cookie' }));
    expect(result.status).toBe('partial');
    expect(result.earned).toBe(2);
    expect(result.reason).toMatch(/the HTML response/);
  });
});

describe('B8 and the advertised twin', () => {
  it('ignores a Link rel=alternate on another origin: reported, never fetched', () => {
    const html = probe({ headers: { link: '<https://cdn.example.net/resume.md>; rel="alternate"; type="text/markdown"' } });
    const resolved = resolveAdvertised(html, new URL('https://example.com/resume'));
    expect(resolved.advertisedTwinUrl).toBeUndefined();
    expect(resolved.foreignTwinUrl).toBe('https://cdn.example.net/resume.md');

    const e = goodEvidence();
    delete e.advertisedTwinUrl;
    const result = run('B8', { ...e, foreignTwinUrl: resolved.foreignTwinUrl });
    expect(result.status).toBe('partial');
    expect(result.earned).toBe(1);
    expect(result.reason).toContain('cdn.example.net');
  });

  it('ignores a non-http(s) alternate and resolves a relative one against the page', () => {
    expect(resolveAdvertised(probe({ headers: { link: '<data:text/markdown,hi>; rel="alternate"; type="text/markdown"' } }), new URL('https://example.com/resume')).advertisedTwinUrl).toBeUndefined();
    expect(resolveAdvertised(probe({ headers: { link: '</resume.md>; rel="alternate"; type="text/markdown"' } }), new URL('https://example.com/resume')).advertisedTwinUrl).toBe('https://example.com/resume.md');
  });

  it('gives 1 of 3 for a Link header with no markdown alternate', () => {
    const e = withHtmlHeaders({ link: '</style.css>; rel="preload"; as="style"' });
    delete e.advertisedTwinUrl;
    expect(run('B8', e).earned).toBe(1);
  });
});

describe('B9 and B10: redirects', () => {
  const markdown = (overrides: Partial<ProbeResponse>): ProbeResponse => probe({ body: GOOD_TWIN, headers: { 'content-type': MARKDOWN_CONTENT_TYPE }, ...overrides });

  it('forgive a trailing-slash redirect the browser request also followed', () => {
    const e = goodEvidence();
    const slashed = { ...e, html: { ...e.html, redirected: true, finalUrl: 'https://example.com/resume/' } };
    const followed = markdown({ redirected: true, finalUrl: 'https://example.com/resume/' });
    expect(run('B9', { ...slashed, acceptMarkdown: followed }).status).toBe('pass');
    expect(run('B10', { ...slashed, botUa: followed }).status).toBe('pass');
  });

  it('fail a redirect to the .md twin, naming where it went', () => {
    const e = goodEvidence();
    const bounced = markdown({ redirected: true, finalUrl: 'https://example.com/resume.md' });
    const b9 = run('B9', { ...e, acceptMarkdown: bounced });
    expect(b9.status).toBe('fail');
    expect(b9.reason).toContain('resume.md');
    expect(run('B10', { ...e, botUa: bounced }).status).toBe('fail');
  });

  it('fail when the redirect lands on a different URL than the browser did, even with markdown', () => {
    const e = goodEvidence();
    const slashed = { ...e, html: { ...e.html, redirected: true, finalUrl: 'https://example.com/resume/' } };
    expect(run('B9', { ...slashed, acceptMarkdown: markdown({ redirected: true, finalUrl: 'https://example.com/resume/index.md' }) }).status).toBe('fail');
  });
});

describe('B14 without a source hash', () => {
  it('prefers the header hash over the frontmatter hash', () => {
    const e = goodEvidence();
    const liveHash = contentHash(liveExtract(e).markdown);
    const twin = { ...e.twin, body: `---\nsource_hash: 0000000000000000\n---\n${GOOD_TWIN}`, headers: { ...e.twin.headers, 'x-markdown-source-hash': liveHash } };
    expect(run('B14', { ...e, twin }).status).toBe('pass');
  });

  it('falls back to comparing numbers, dates and prices one by one', () => {
    const facts = 'Launched on 2024-03-01 at $49 with 12 seats and 3 regions, growing 40% a year.';
    const filler = GOOD_TWIN.split('\n\n')[1] ?? '';
    const page = (text: string): string => `<!doctype html><html><head><title>P</title></head><body><main><h1>Pricing</h1><p>${text}</p><p>${filler}</p></main></body></html>`;
    const e = goodEvidence();
    const twin = { ...e.twin, body: `# Pricing\n\n${facts}\n\n${filler}` };
    const evidence = (text: string): Evidence => ({ ...e, html: { ...e.html, body: page(text) }, twin });
    expect(header(twin, 'x-markdown-source-hash')).toBeUndefined();
    const intact = run('B14', evidence(facts));
    expect(intact.status).toBe('pass');
    expect(intact.reason).toMatch(/no source hash/);
    const oneOff = run('B14', evidence(facts.replace('$49', '$59')));
    expect(oneOff.status).toBe('partial');
    expect(oneOff.earned).toBe(2);
    expect(oneOff.detail).toMatch(/fact by fact/);
    const manyOff = run('B14', evidence(facts.replace('$49', '$59').replace('2024-03-01', '2025-03-01').replace('12 seats', '20 seats')));
    expect(manyOff.status).toBe('fail');
  });
});

describe('partial() clamping, as OpenGEO does it', () => {
  it('never awards 0 or the full weight as a partial, and prices the fix from the clamped value', () => {
    const e = goodEvidence();
    const words = Array.from({ length: 16 }, (_, i) => `w${i}`).join(' ');
    const thin = run('A5', { ...e, html: { ...e.html, body: `<html><body><main><p>${words}</p></main></body></html>` } });
    expect(thin.status).toBe('partial');
    expect(thin.earned).toBe(1);
    expect(thin.fix).toContain('(+8)');
    const slow = run('A6', { ...e, html: { ...e.html, ttfbMs: 1499 } });
    expect(slow.status).toBe('partial');
    expect(slow.earned).toBe(1);
    expect(slow.fix).toContain('(+7)');
    const quick = run('A6', { ...e, html: { ...e.html, ttfbMs: 401 } });
    expect(quick.earned).toBe(7);
  });
});

describe('the twin cascade', () => {
  it('locks a live-URL partial and keeps a live-URL pass; B1 and B13 are never locked', () => {
    const e = unadoptedEvidence();
    const good = goodEvidence();
    const results = runChecks({ ...e, html: { ...e.html, headers: { ...e.html.headers, vary: 'Accept' } }, notAcceptable: good.notAcceptable });
    const byId = new Map(results.map((result) => [result.id, result]));
    expect(byId.get('B7')?.status).toBe('locked');
    expect(byId.get('B11')?.status).toBe('pass');
    expect(byId.get('B1')?.status).toBe('fail');
    expect(byId.get('B13')?.status).toBe('pass');
    expect(byId.get('B2')?.status).toBe('locked');
    expect(byId.get('B2')?.reason).toContain('resume.md');
    for (const id of TWIN_LOCKED_IDS) expect(['locked', 'pass']).toContain(byId.get(id)?.status);
  });

  it('is engaged by an HTML shell at the twin URL, not only a 404', () => {
    const e = goodEvidence();
    const results = runChecks({ ...e, twin: { ...e.twin, body: SPA_SHELL, headers: { 'content-type': 'text/html' } } });
    expect(results.find((result) => result.id === 'B1')?.status).toBe('fail');
    expect(results.filter((result) => result.status === 'locked').length).toBeGreaterThan(0);
  });
});

describe('the registry', () => {
  it('carries the OpenGEO weights, required flags and kinds', () => {
    const table: Record<string, [number, boolean]> = {
      A1: [9, true], A2: [3, false], A3: [9, true], A4: [2, false], A5: [9, true], A6: [8, true], A7: [8, true], A8: [9, true],
      B1: [10, true], B2: [5, true], B3: [5, true], B4: [3, false], B5: [3, false], B6: [3, true], B7: [4, true], B8: [3, false],
      B9: [6, true], B10: [6, true], B11: [2, false], B12: [2, false], B13: [9, true], B14: [4, true],
    };
    expect(Object.fromEntries(CHECKS.map((check) => [check.id, [check.weight, check.required]]))).toEqual(table);
    expect(CHECKS.filter((check) => check.required).reduce((sum, check) => sum + check.weight, 0)).toBe(104);
    expect(CHECKS.filter((check) => !check.required).reduce((sum, check) => sum + check.weight, 0)).toBe(18);
    expect(AI_BOTS).toHaveLength(28);
    expect(AI_BOTS.filter((bot) => bot.kind === 'training').map((bot) => bot.name)).toEqual([
      'GPTBot', 'ClaudeBot', 'anthropic-ai', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Bytespider',
      'meta-externalagent', 'cohere-ai', 'Diffbot', 'Ai2Bot', 'ImagesiftBot', 'Timpibot',
    ]);
  });

  it('matches the GOOD_HTML fixture to the A5 threshold', () => {
    expect(liveExtract(goodEvidence()).wordCount).toBeGreaterThanOrEqual(60);
    expect(GOOD_HTML).toContain('<main>');
  });
});
