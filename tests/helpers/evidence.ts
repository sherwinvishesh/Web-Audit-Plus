import { MARKDOWN_CONTENT_TYPE } from '../../src/agentic/http';
import type { Evidence, HeaderMap, ProbeResponse } from '../../src/agentic/types';

/** A 200 probe of https://example.com/resume, overridable field by field. */
export function probe(overrides: Partial<ProbeResponse> = {}): ProbeResponse {
  const url = overrides.url ?? 'https://example.com/resume';
  return {
    url,
    ok: true,
    status: 200,
    headers: {},
    body: '',
    ttfbMs: 40,
    totalMs: 80,
    redirected: false,
    finalUrl: url,
    ...overrides,
  };
}

/** A non-2xx probe. */
export function missing(url: string, status = 404, body = 'Not found'): ProbeResponse {
  return probe({ url, ok: false, status, body, headers: { 'content-type': 'text/plain' } });
}

export const GOOD_HTML = `<!doctype html><html><head><title>Resume</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Person","name":"A"}</script>
</head><body><main><h1>Resume</h1>
<p>Shipped four projects in 2024 across three teams, including a platform migration that moved
forty-two services onto a shared runtime, and a pricing change worth twelve thousand five hundred
dollars a month to the business. Earlier work covered data pipelines and developer tooling, with a
long stretch owning the build system and the release process for a codebase of roughly two hundred
thousand lines. Before that, three years on an internal analytics product used by every team in the
company, where the work was mostly about making slow queries fast and making failures legible.</p>
</main></body></html>`;

export const GOOD_TWIN = `# Resume

Shipped four projects in 2024 across three teams, including a platform migration that moved
forty-two services onto a shared runtime, and a pricing change worth twelve thousand five hundred
dollars a month to the business. Earlier work covered data pipelines and developer tooling, with a
long stretch owning the build system and the release process for a codebase of roughly two hundred
thousand lines. Before that, three years on an internal analytics product used by every team in the
company, where the work was mostly about making slow queries fast and making failures legible.`;

export const SPA_SHELL = '<!doctype html><html><head><title>App</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>';

const TWIN_HEADERS: HeaderMap = {
  'content-type': MARKDOWN_CONTENT_TYPE,
  'x-markdown-tokens': '42',
  'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex',
  vary: 'Accept',
  'x-aeo-version': '1.0',
};

/** A site that does everything right: every check passes. */
export function goodEvidence(): Evidence {
  const target = 'https://example.com/resume';
  const markdownAtPage = (overrides: Partial<ProbeResponse> = {}): ProbeResponse =>
    probe({ body: GOOD_TWIN, headers: { ...TWIN_HEADERS }, ...overrides });
  return {
    target,
    origin: 'https://example.com',
    fetchedAt: '2026-10-14T12:00:00.000Z',
    measuredFrom: 'node',
    html: probe({
      body: GOOD_HTML,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        vary: 'Accept',
        link: '</resume.md>; rel="alternate"; type="text/markdown"',
        'strict-transport-security': 'max-age=63072000',
        'x-aeo-version': '1.0',
      },
    }),
    robots: probe({
      url: 'https://example.com/robots.txt',
      body: 'User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml\n',
      headers: { 'content-type': 'text/plain' },
    }),
    llms: probe({
      url: 'https://example.com/llms.txt',
      body: '# Example\n\n> A site.\n\n## Pages\n\n- [Resume](https://example.com/resume.md)\n',
      headers: { 'content-type': 'text/plain' },
    }),
    sitemap: probe({
      url: 'https://example.com/sitemap.xml',
      body: '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/resume</loc></url></urlset>',
      headers: { 'content-type': 'application/xml' },
    }),
    sitemapChildren: [],
    twin: probe({ url: 'https://example.com/resume.md', body: GOOD_TWIN, headers: { ...TWIN_HEADERS } }),
    twinUrl: 'https://example.com/resume.md',
    advertisedTwinUrl: 'https://example.com/resume.md',
    acceptMarkdown: markdownAtPage(),
    botUa: markdownAtPage(),
    botName: 'GPTBot',
    notAcceptable: probe({ ok: false, status: 406, body: 'Not Acceptable', headers: { 'content-type': 'text/plain' } }),
  };
}

/**
 * The calibration site: everything right except the AI conventions. No llms.txt, no JSON-LD, no
 * twin, no negotiation. OpenGEO pins this at 80, losing exactly A2, A4 and B1.
 */
export function unadoptedEvidence(): Evidence {
  const e = goodEvidence();
  const html = GOOD_HTML.replace(/<script type="application\/ld\+json">.*?<\/script>\n/s, '');
  const htmlHeaders: HeaderMap = { 'content-type': 'text/html; charset=utf-8', 'strict-transport-security': 'max-age=63072000' };
  const page = (overrides: Partial<ProbeResponse> = {}): ProbeResponse => probe({ body: html, headers: { ...htmlHeaders }, ...overrides });
  const notFound = (url: string): ProbeResponse =>
    probe({ url, ok: false, status: 404, body: '<!doctype html><html><body>Not found</body></html>', headers: { 'content-type': 'text/html' } });
  const result: Evidence = {
    ...e,
    html: page(),
    llms: notFound('https://example.com/llms.txt'),
    twin: notFound('https://example.com/resume.md'),
    acceptMarkdown: page(),
    botUa: page(),
    notAcceptable: page(),
  };
  delete result.advertisedTwinUrl;
  return result;
}

/** Deep-ish clone with overrides, so a test can change one probe without touching the fixture. */
export function withEvidence(overrides: Partial<Evidence>, base: Evidence = goodEvidence()): Evidence {
  return { ...base, ...overrides };
}
