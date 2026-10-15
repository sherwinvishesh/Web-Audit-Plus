import { isSitemapIndex, MAX_CHILD_SITEMAPS, rawLocs, sitemapLocs } from '../sitemap';
import type { CheckDefinition, CheckResult, Evidence } from '../types';
import { defineCheck, fail, httpStatus, partial, pass, plural, q } from './helpers';

/**
 * A3. /sitemap.xml: a `<urlset>` whose `<loc>`s include this page. The page under test is the one
 * URL known for certain to exist, so a sitemap that omits it is demonstrably incomplete.
 */
export const a3Sitemap = defineCheck(
  { id: 'A3', category: 'A', required: true, weight: 9, title: 'sitemap.xml is present and valid' },
  (e, self) => {
    if (!e.sitemap.ok) {
      return fail(self, `No sitemap.xml at ${q(e.sitemap.url)} (${httpStatus(e.sitemap.status)}).`, {
        fix: 'Serve a /sitemap.xml listing every page (+9).',
      });
    }
    const body = e.sitemap.body;
    if (!/<(urlset|sitemapindex)[\s>]/i.test(body)) {
      return partial(
        self,
        3,
        `Something answers at ${q(e.sitemap.url)}, but it has no \`<urlset>\` or \`<sitemapindex>\` root element, so no crawler will read it as a sitemap.`,
        {
          detail: `It starts with ${q(body.slice(0, 80))}.`,
          fix: 'Serve a real sitemap: `<urlset>` with one `<url><loc>` per page (+6).',
        },
      );
    }
    if (isSitemapIndex(body)) return checkSitemapIndex(e, self);
    const listed = rawLocs(body);
    if (listed.length === 0) {
      return partial(self, 3, 'sitemap.xml parses but contains no `<loc>` entries, so it advertises nothing.', {
        fix: 'Add one `<url><loc>` per page (+6).',
      });
    }
    // Compared as parsed paths, not as a substring of the document: the homepage's path is "/", and
    // every sitemap ever written contains a slash.
    const target = new URL(e.target);
    const wanted = locPath(target.pathname, target);
    if (!listed.some((loc) => locPath(loc, target) === wanted)) {
      return partial(
        self,
        6,
        `sitemap.xml is valid and lists ${plural(listed.length, 'URL')}, but ${q(target.pathname)} is not one of them, so at least one real page is missing from it.`,
        { fix: `Add ${q(target.pathname)} and any other pages the sitemap is missing (+3).` },
      );
    }
    return pass(self, `sitemap.xml is present and valid, listing ${plural(listed.length, 'URL')} including ${q(target.pathname)}.`);
  },
);

/**
 * A3 for a `<sitemapindex>`, whose `<loc>`s are other sitemaps. The page can only be in one of the
 * children, so the fetched children are read. When the index lists more than were fetched and none
 * of those lists the page, nothing true can be said about the rest, so it passes with the limit in
 * the detail rather than charging for a page that may be in sitemap number eleven.
 */
function checkSitemapIndex(e: Evidence, self: CheckDefinition): CheckResult {
  const declared = sitemapLocs(e.sitemap.body, e.origin).length;
  const children = e.sitemapChildren.filter((child) => child.ok && /<urlset[\s>]/i.test(child.body));
  const target = new URL(e.target);
  if (children.length === 0) {
    return partial(
      self,
      3,
      `sitemap.xml is a sitemap index listing ${plural(declared, 'sitemap')}, but none that was fetched answered with a \`<urlset>\`, so it advertises no pages.`,
      { fix: 'Serve each sitemap the index lists, as a `<urlset>` with one `<url><loc>` per page (+6).' },
    );
  }
  const pages = children.flatMap((child) => sitemapLocs(child.body, e.origin));
  const wanted = locPath(target.pathname, target);
  const read = `${plural(children.length, 'sitemap')} it lists`;
  if (pages.some((loc) => locPath(loc.toString(), target) === wanted)) {
    return pass(self, `sitemap.xml is a sitemap index, and ${q(target.pathname)} is listed in the ${read}.`);
  }
  if (declared > MAX_CHILD_SITEMAPS) {
    return pass(
      self,
      `sitemap.xml is a valid sitemap index listing ${plural(declared, 'sitemap')}.`,
      `${q(target.pathname)} is not in the first ${MAX_CHILD_SITEMAPS}, and the rest were not fetched.`,
    );
  }
  return partial(
    self,
    6,
    `sitemap.xml is a sitemap index, and none of the ${read} include ${q(target.pathname)}, so at least one real page is missing from them.`,
    { fix: `Add ${q(target.pathname)} and any other missing pages to one of the sitemaps the index lists (+3).` },
  );
}

/** The path a `<loc>` points at, tolerant of a relative entry, compared without a trailing slash. */
function locPath(loc: string, base: URL): string {
  try {
    return new URL(loc, base).pathname.replace(/\/+$/, '') || '/';
  } catch {
    return loc.replace(/\/+$/, '') || '/';
  }
}
