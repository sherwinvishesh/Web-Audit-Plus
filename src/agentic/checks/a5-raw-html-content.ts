import { liveExtract, SSR_MIN_WORDS } from '../extract';
import { defineCheck, fail, httpStatus, partial, pass, q, ramp } from './helpers';

/** Under this, there is so little text that partial credit would be flattery rather than measurement. */
export const SSR_FLOOR_WORDS = 15;

/**
 * A5. Real content in the HTML as served, read without running scripts, the way most AI crawlers
 * read it. Ramped between 15 and 60 extracted words.
 */
export const a5RawHtmlContent = defineCheck(
  { id: 'A5', category: 'A', required: true, weight: 9, title: 'Real content is in the raw HTML, not only after JS runs' },
  (e, self) => {
    if (!e.html.ok || !e.html.body) {
      return fail(self, `The page did not return usable HTML (${httpStatus(e.html.status)}).`, {
        fix: 'Get the URL returning a 2xx HTML response (+9). Nothing else on this report can be measured properly until it does.',
      });
    }
    const extracted = liveExtract(e);
    const root = q(`<${extracted.contentRoot}>`);
    if (extracted.wordCount >= SSR_MIN_WORDS) {
      return pass(
        self,
        `${extracted.wordCount} words of real content are present in the raw HTML, so agents that do not run JavaScript still see the page.`,
        `Extracted from ${root}.`,
      );
    }
    const emptyRoot = /<div[^>]+id=["'](root|app|__next)["'][^>]*>\s*<\/div>/i.test(e.html.body);
    if (emptyRoot || extracted.wordCount <= SSR_FLOOR_WORDS) {
      return fail(
        self,
        emptyRoot
          ? `The raw HTML contains an empty mount element and ${extracted.wordCount} words of text: this page is client-rendered, so agents that do not execute JavaScript see nothing.`
          : `Only ${extracted.wordCount} words of extractable content in the raw HTML (need ${SSR_MIN_WORDS}). Agents that do not run JavaScript will see close to nothing.`,
        { fix: 'Server-render the page content, or pre-render it at build time (+9). There is no header that fixes this one.' },
      );
    }
    // Partly server-rendered: a heading and a paragraph in the HTML, the substance behind hydration.
    const earned = ramp(extracted.wordCount, SSR_FLOOR_WORDS, SSR_MIN_WORDS, self.weight);
    return partial(
      self,
      earned,
      `Only ${extracted.wordCount} words of extractable content in the raw HTML, against the ${SSR_MIN_WORDS} a page needs to read as substantive. Agents that do not run JavaScript see a fragment of the page.`,
      { detail: `Extracted from ${root}.`, fix: 'Server-render the rest of the body, not just the shell (+9).' },
    );
  },
);
