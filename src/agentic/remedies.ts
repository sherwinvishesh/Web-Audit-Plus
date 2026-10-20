import type { Framework, FrameworkId } from './types';

/**
 * Background for each Agentic check, for the fix prompt: what "fixed" looks like, written for a
 * coding agent with the site's repository open. A check's own `fix` names the cause it observed;
 * this describes the destination. Adapted from OpenGSO's prompt remedies with every reference to a
 * specific tool removed, so the advice holds for any stack.
 *
 * `{twin}` is replaced with the twin's path.
 */
export const REMEDIES: Readonly<Record<string, string>> = {
  A1: 'Serve a robots.txt that does not disallow AI user agents from the site. If the file is hand-maintained, remove the Disallow rules covering the agents named above; if it is generated, fix the generator config.',
  A2: 'Add /llms.txt: an H1 with the site name, a one-line `>` blockquote summary, then the important pages as markdown links, pointing at their .md twins where they exist. Generate it at build time from the same route list as the sitemap.',
  A3: 'Serve /sitemap.xml as a real `<urlset>` listing every public HTML URL, including this page. Generate it at build time from the route list so it never goes stale.',
  A4: 'Add a Schema.org JSON-LD block (`<script type="application/ld+json">`) in the page head describing what this page is: Organization, Person, Article, Product, as fits. It must parse as JSON and declare an `@type`.',
  A5: 'Move the page content into the server-rendered HTML (SSR, SSG or pre-rendering). An agent that does not run JavaScript sees only the raw response, so client-only rendering makes the page invisible to it.',
  A6: 'Reduce time to first byte for this route: cache the HTML at the edge, render it statically, or move slow work (database calls, API fan-out) out of the request path.',
  A7: 'Remove the noai / noimageai meta tag or X-Robots-Tag directive, unless blocking AI is intentional.',
  A8: 'Serve the site over HTTPS and send `Strict-Transport-Security` on the HTML response. Set it on the host or CDN in front of the app, since that is where TLS terminates.',
  B1: 'Publish a markdown version of each page at its path plus `.md` (this page: `{twin}`): the main content as clean markdown, without navigation or footers. Generate the files at build time from the rendered pages, and serve them as static files or from middleware, ahead of any catch-all route.',
  B2: 'Set Content-Type to exactly `text/markdown; charset=utf-8` on the markdown response. A static file handler usually guesses `text/plain` or `application/octet-stream` for .md, so set it explicitly in the host config or middleware.',
  B3: 'The twin URL answers but the body is empty or far shorter than the page. Regenerate the twin from the current page and confirm it carries the full main content, not just a title.',
  B4: 'Send `X-Markdown-Tokens` with an estimate of the twin body in tokens (characters divided by 4 is fine). Compute it when the twin is generated, so nothing is counted per request.',
  B5: 'Send `X-Content-Type-Options: nosniff` on the markdown response.',
  B6: 'Send `X-Robots-Tag: noindex` on the twin, so search engines do not index it as duplicate content of the HTML page.',
  B7: 'Send `Vary: Accept` on both the HTML and the markdown response. Without it a CDN can serve a cached HTML body to an agent that asked for markdown, or the reverse.',
  B8: 'Send a Link header on the HTML response advertising the twin: `<{twin}>; rel="alternate"; type="text/markdown"`.',
  B9: 'When the request Accept header prefers text/markdown over text/html, serve the twin at the same URL, as an internal rewrite rather than a redirect.',
  B10: 'Serve the twin to known AI user agents (GPTBot, ClaudeBot, PerplexityBot and similar) even when they send no Accept preference, at the same URL, as a rewrite. Most crawlers send `Accept: */*`, so Accept negotiation alone does not reach them.',
  B11: 'Return 406 Not Acceptable when the Accept header allows neither HTML nor markdown, instead of answering with a format that was not asked for.',
  B12: 'Send `X-AEO-Version: 1.0` on the markdown response so an agent can tell which serving convention the site implements.',
  B13: 'A normal browser request must still get the real HTML page, at its own URL. Check the routing logic: only known agents and explicit markdown Accept preferences should be served markdown, and never by redirect.',
  B14: 'Regenerate the twins from the current pages and redeploy. Make twin generation part of the build so a content edit cannot ship without its markdown, and record a hash of the source content (`X-Markdown-Source-Hash` or `source_hash` frontmatter) so drift is detectable.',
};

const EDGE = 'an edge function in front of the site (a Cloudflare Worker, Fastly Compute or a similar CDN rule), since the platform does not expose request middleware';

/** Where request-level changes (headers, negotiation, rewrites) belong, per framework. */
const PLACEMENT: Readonly<Record<FrameworkId, string>> = {
  nextjs: '`middleware.ts` at the project root for routing and headers, with `headers()` in next.config for static ones',
  nuxt: 'a server middleware under `server/middleware/`, with `routeRules` for static headers',
  astro: '`src/middleware.ts` (the `onRequest` hook) on a server adapter, or the host config for a static build',
  sveltekit: '`src/hooks.server.ts`, in the `handle` hook',
  remix: 'the server entry (`entry.server.tsx`) or the platform adapter in front of it',
  gatsby: 'the hosting layer in front of the static output (host config, `_headers`/`_redirects`, or an edge function), since Gatsby builds to static files',
  docusaurus: 'the hosting layer in front of the static output (host config or an edge function), since Docusaurus builds to static files',
  hugo: 'the hosting layer in front of the static output (host config or an edge function), with the twins generated as an extra Hugo output format',
  jekyll: 'the hosting layer in front of the static output (host config or an edge function), since Jekyll builds to static files',
  wordpress: 'a small plugin hooking `template_redirect` for negotiation and `send_headers` for headers, or the CDN in front of the site',
  shopify: EDGE,
  webflow: EDGE,
  wix: EDGE,
  squarespace: EDGE,
  vite: 'the production server or host in front of the build output; a Connect middleware in `vite.config.ts` only covers dev',
  plain: 'the web server or CDN in front of the files (nginx, Apache, a host `_headers` file or an edge function), since there is no application server to add middleware to',
};

export function placementFor(framework: Framework | undefined): string | undefined {
  return framework ? PLACEMENT[framework.id] : undefined;
}

/**
 * The remedy for a check, with `{twin}` filled in. The twin can come from the site's Link header,
 * so only its pathname is used: `URL` percent-encodes backticks, whitespace and control characters
 * there, which keeps the value inert inside the remedy's code span.
 */
export function remedyFor(id: string, twinUrl: string): string | undefined {
  const remedy = REMEDIES[id];
  if (!remedy) return undefined;
  let path = twinUrl;
  try {
    path = new URL(twinUrl).pathname;
  } catch {
    // Not a URL: keep it, minus anything that could close the code span it lands in.
    path = twinUrl.replace(/[`\s]/g, '');
  }
  return remedy.replaceAll('{twin}', path);
}
