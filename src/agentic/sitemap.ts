/** sitemap.xml helpers, matching OpenGEO's discover module. */

/** A sitemap index can list thousands of children; this many are fetched. */
export const MAX_CHILD_SITEMAPS = 10;

export function isSitemapIndex(body: string): boolean {
  return /<sitemapindex[\s>]/i.test(body);
}

/** Every parseable `<loc>` in a sitemap or sitemap index, entity-decoded and resolved against `base`. */
export function sitemapLocs(body: string, base: string): URL[] {
  const out: URL[] = [];
  for (const match of body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
    try {
      out.push(new URL(decodeEntities(match[1] ?? ''), base));
    } catch {
      // A malformed <loc> is skipped, as a crawler would.
    }
  }
  return out;
}

/** The raw `<loc>` strings, undecoded, as A3 counts them. */
export function rawLocs(body: string): string[] {
  return Array.from(body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi), (match) => match[1] ?? '');
}

/**
 * The child sitemaps to fetch for an index: the first `MAX_CHILD_SITEMAPS`, each re-pointed at its
 * path on the audited origin so the audit never requests a third party.
 */
export function childSitemapUrls(body: string, origin: string): string[] {
  if (!isSitemapIndex(body)) return [];
  return sitemapLocs(body, origin)
    .slice(0, MAX_CHILD_SITEMAPS)
    .map((url) => new URL(`${url.pathname}${url.search}`, origin).toString());
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
