import type { Framework, FrameworkId, HeaderMap } from './types';

/**
 * Framework detection: fingerprint matching on the HTML and response headers, ported from OpenGEO's
 * `shared/framework.js` and extended with the hosted builders a browser extension meets often.
 *
 * A courtesy, never a dependency: no check's result changes based on it, and every caller handles
 * `undefined`. Each signal is something only that framework emits, because a wrong guess sends the
 * user editing the wrong file.
 */

interface Signature {
  id: FrameworkId;
  name: string;
  /** Ordered: the first match wins. */
  html?: Array<{ pattern: RegExp; evidence: string }>;
  header?: Array<{ name: string; pattern?: RegExp; evidence: string }>;
}

const SIGNATURES: Signature[] = [
  {
    // Before Next.js: a Docusaurus site is a React site and carries some of the same markers.
    id: 'docusaurus',
    name: 'Docusaurus',
    html: [
      { pattern: /<meta[^>]+name=["']generator["'][^>]+content=["']Docusaurus/i, evidence: 'the generator meta tag names Docusaurus' },
      { pattern: /id=["']__docusaurus["']/, evidence: 'the page has a __docusaurus root element' },
    ],
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    html: [
      { pattern: /\/_next\/static\//, evidence: 'assets are served from /_next/static/' },
      { pattern: /id=["']__NEXT_DATA__["']/, evidence: 'the page carries a __NEXT_DATA__ script' },
      { pattern: /self\.__next_f\b/, evidence: 'the page carries an App Router flight payload' },
    ],
    header: [{ name: 'x-powered-by', pattern: /next\.js/i, evidence: 'X-Powered-By names Next.js' }],
  },
  {
    id: 'nuxt',
    name: 'Nuxt',
    html: [
      { pattern: /\/_nuxt\//, evidence: 'assets are served from /_nuxt/' },
      { pattern: /id=["']__NUXT_DATA__["']|window\.__NUXT__/, evidence: 'the page carries a Nuxt payload' },
    ],
  },
  {
    id: 'astro',
    name: 'Astro',
    html: [
      { pattern: /<meta[^>]+name=["']generator["'][^>]+content=["']Astro/i, evidence: 'the generator meta tag names Astro' },
      { pattern: /\/_astro\//, evidence: 'assets are served from /_astro/' },
      { pattern: /astro-island|data-astro-cid-/, evidence: 'the markup carries Astro island attributes' },
    ],
  },
  {
    id: 'sveltekit',
    name: 'SvelteKit',
    html: [
      { pattern: /__sveltekit_/, evidence: 'the page carries a SvelteKit hydration payload' },
      { pattern: /\/_app\/immutable\//, evidence: 'assets are served from /_app/immutable/' },
    ],
  },
  {
    id: 'remix',
    name: 'Remix or React Router',
    html: [{ pattern: /window\.__remixContext|__reactRouterContext/, evidence: 'the page carries a Remix or React Router context payload' }],
  },
  {
    id: 'gatsby',
    name: 'Gatsby',
    html: [
      { pattern: /id=["']___gatsby["']/, evidence: 'the page has a ___gatsby root element' },
      { pattern: /\/page-data\/[^"']*app-data\.json/, evidence: 'the page loads Gatsby page-data' },
    ],
  },
  {
    id: 'hugo',
    name: 'Hugo',
    html: [{ pattern: /<meta[^>]+name=["']generator["'][^>]+content=["']Hugo/i, evidence: 'the generator meta tag names Hugo' }],
  },
  {
    id: 'jekyll',
    name: 'Jekyll',
    html: [{ pattern: /<meta[^>]+name=["']generator["'][^>]+content=["']Jekyll/i, evidence: 'the generator meta tag names Jekyll' }],
  },
  {
    id: 'wordpress',
    name: 'WordPress',
    html: [
      { pattern: /<meta[^>]+name=["']generator["'][^>]+content=["']WordPress/i, evidence: 'the generator meta tag names WordPress' },
      { pattern: /\/wp-content\//, evidence: 'assets are served from /wp-content/' },
    ],
  },
  {
    id: 'shopify',
    name: 'Shopify',
    html: [
      { pattern: /cdn\.shopify\.com\//, evidence: 'assets are served from cdn.shopify.com' },
      { pattern: /\bShopify\.theme\b/, evidence: 'the page defines Shopify.theme' },
    ],
    header: [{ name: 'x-shopid', evidence: 'the response carries an X-ShopId header' }],
  },
  {
    id: 'webflow',
    name: 'Webflow',
    html: [
      { pattern: /<meta[^>]+name=["']generator["'][^>]+content=["']Webflow/i, evidence: 'the generator meta tag names Webflow' },
      { pattern: /<html[^>]+data-wf-page=/i, evidence: 'the html element carries data-wf-page' },
    ],
  },
  {
    id: 'wix',
    name: 'Wix',
    html: [
      { pattern: /<meta[^>]+name=["']generator["'][^>]+content=["']Wix\.com/i, evidence: 'the generator meta tag names Wix' },
      { pattern: /static\.parastorage\.com\//, evidence: 'assets are served from static.parastorage.com' },
    ],
  },
  {
    id: 'squarespace',
    name: 'Squarespace',
    html: [
      { pattern: /<!-- This is Squarespace\. -->/, evidence: 'the page carries the Squarespace banner comment' },
      { pattern: /static1\.squarespace\.com\//, evidence: 'assets are served from static1.squarespace.com' },
    ],
  },
  {
    // Last of the real frameworks: everything above is built on Vite, so this only fires for a
    // site that shows Vite's own fingerprints and nobody else's.
    id: 'vite',
    name: 'Vite',
    html: [
      { pattern: /\/@vite\/client/, evidence: 'the page loads the Vite dev client' },
      {
        pattern: /<script[^>]+type=["']module["'][^>]+src=["'][^"']*\/assets\/index-[A-Za-z0-9_-]{8}\.js/,
        evidence: 'assets follow the Vite hashed build naming',
      },
    ],
  },
];

export function detectFramework(html: string, headers?: HeaderMap): Framework | undefined {
  for (const signature of SIGNATURES) {
    for (const rule of signature.html ?? []) {
      if (rule.pattern.test(html)) return { id: signature.id, name: signature.name, evidence: rule.evidence };
    }
    for (const rule of signature.header ?? []) {
      const value = headers?.[rule.name];
      if (!value) continue;
      if (!rule.pattern || rule.pattern.test(value)) return { id: signature.id, name: signature.name, evidence: rule.evidence };
    }
  }
  if (html && looksStatic(html)) return { id: 'plain', name: 'plain HTML', evidence: 'the page loads no JavaScript bundle' };
  return undefined;
}

/** A page with no bundle at all: the fix is files next to the HTML plus host configuration. */
function looksStatic(html: string): boolean {
  const scripts = html.match(/<script\b[^>]*>/gi) ?? [];
  return !scripts.some((tag) => /\bsrc=/i.test(tag) || /type=["']module["']/i.test(tag));
}
