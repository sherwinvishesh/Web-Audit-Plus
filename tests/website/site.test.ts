import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TWIN_FULL_RATIO } from '../../src/agentic/checks/b3-twin-body';
import { SSR_MIN_WORDS, extractPage } from '../../src/agentic/extract';
import { verifyFidelity } from '../../src/agentic/fidelity';
import { parseFrontmatter } from '../../src/agentic/frontmatter';
import { countWords } from '../../src/agentic/tokens';
import { WEBSITE_BASE, WEBSITE_ROOT } from '../helpers/website-server';

/**
 * The website is audited by the extension it promotes, so its static files are held to the same
 * rules the Agentic checks apply: a markdown twin for every page that carries the page's words and
 * facts, a sitemap that lists every page, a valid llms.txt, and a robots.txt that points at the
 * sitemap. The end-to-end suite runs the full audit; this one runs the parts that need no browser.
 */
const PAGES = [
  { path: '/', html: 'index.html', twin: 'index.md' },
  { path: '/docs/', html: 'docs/index.html', twin: 'docs.md' },
  { path: '/privacy/', html: 'privacy/index.html', twin: 'privacy.md' },
];
// The same options B14 uses when there is no source hash.
const DRIFT_OPTIONS = { minWordRatio: 0.4, rejectInvented: false } as const;

const read = (file: string): string => readFileSync(join(WEBSITE_ROOT, file), 'utf8');

describe('the website', () => {
  for (const page of PAGES) {
    const url = `${WEBSITE_BASE}${page.path}`;

    describe(page.path, () => {
      const html = read(page.html);
      const live = extractPage(html, { url });

      it('is a complete page with one heading, a description and a canonical', () => {
        expect(html).toMatch(/^<!doctype html>\s*<html lang="en">/i);
        expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(html).toMatch(/<title>[^<]+<\/title>/);
        expect(html).toMatch(/<meta name="description" content="[^"]{50,}">/);
        expect(live.canonical).toBe(url);
        expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
      });

      it('has its real content in the raw HTML, with structured data', () => {
        expect(live.wordCount).toBeGreaterThanOrEqual(SSR_MIN_WORDS);
        expect(live.jsonLd.length).toBeGreaterThanOrEqual(1);
        expect(live.warnings.filter((warning) => /json-ld/i.test(warning))).toEqual([]);
      });

      it('has a markdown twin that carries the page', () => {
        const twin = parseFrontmatter(read(page.twin));
        expect(twin.hasFrontmatter).toBe(true);
        expect(twin.data['canonical']).toBe(url);
        expect(twin.data['last_updated']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        // B3: at least half the live page's words.
        expect(countWords(twin.body)).toBeGreaterThanOrEqual(live.wordCount * TWIN_FULL_RATIO);
        // B14: every number, date and price on the live page appears in the twin.
        const drift = verifyFidelity(live.markdown, twin.body, DRIFT_OPTIONS);
        expect(drift.errors).toEqual([]);
        expect(drift.ok).toBe(true);
      });

      it('links only to places that exist', () => {
        const base = dirname(resolve(WEBSITE_ROOT, page.html));
        const targets = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((match) => match[1] ?? '');
        const broken = targets.filter((target) => {
          if (/^(?:https?:|mailto:|#|data:)/.test(target)) return false;
          const clean = target.replace(/[#?].*$/, '');
          if (clean === '') return false;
          const file = resolve(base, clean.endsWith('/') ? `${clean}index.html` : clean);
          return !existsSync(file);
        });
        expect(broken).toEqual([]);
        const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
        const missingAnchors = targets.filter((target) => target.startsWith('#') && target.length > 1 && !ids.has(target.slice(1)));
        expect(missingAnchors).toEqual([]);
      });
    });
  }

  it('lists every page in the sitemap, once, with a modification date', () => {
    const sitemap = read('sitemap.xml');
    expect(sitemap).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    expect(locs).toEqual(PAGES.map((page) => `${WEBSITE_BASE}${page.path}`));
    expect(sitemap.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g)).toHaveLength(PAGES.length);
  });

  it('points robots at the sitemap and allows everyone', () => {
    const robots = read('robots.txt');
    expect(robots).toContain('User-agent: *\nAllow: /');
    expect(robots).toContain(`Sitemap: ${WEBSITE_BASE}/sitemap.xml`);
    expect(robots).not.toMatch(/Disallow:\s*\S/);
  });

  it('has an llms.txt with a title, a summary and links to every page and twin', () => {
    const llms = read('llms.txt');
    expect(llms.startsWith('# Web Audit+\n')).toBe(true);
    expect(llms).toMatch(/^> .{40,}/m);
    for (const page of PAGES) {
      expect(llms).toContain(`](${WEBSITE_BASE}${page.path})`);
      expect(llms).toContain(`](${WEBSITE_BASE}/${page.twin})`);
    }
  });

  it('keeps the 404 page out of search results', () => {
    expect(read('404.html')).toContain('<meta name="robots" content="noindex">');
  });

  it('disables Jekyll so files and folders are published as they are', () => {
    expect(existsSync(join(WEBSITE_ROOT, '.nojekyll'))).toBe(true);
  });
});
