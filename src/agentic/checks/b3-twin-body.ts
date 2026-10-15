import { liveExtract } from '../extract';
import { countWords } from '../tokens';
import { defineCheck, fail, httpStatus, partial, pass, plural, ramp } from './helpers';

/**
 * How much shorter than the live page a twin may be and still count as complete. Markdown is denser
 * than rendered text and a good twin drops navigation and footers, so half is generous on purpose:
 * this check is looking for a stub, not auditing prose.
 */
export const TWIN_FULL_RATIO = 0.5;
export const TWIN_FLOOR_RATIO = 0.08;

/** B3. The twin has a body, and that body carries the page rather than its title. */
export const b3TwinBody = defineCheck(
  { id: 'B3', category: 'B', required: true, weight: 5, title: 'Markdown response body is non-empty and carries the page' },
  (e, self) => {
    if (!e.twin.ok) {
      return fail(self, `No markdown twin response to inspect (${httpStatus(e.twin.status)}).`, {
        fix: 'Fix B1 first: there is no twin response to read a body from (+5).',
      });
    }
    const body = e.twin.body.trim();
    if (!body) {
      return fail(self, 'The markdown twin responded 2xx with an empty body.', {
        fix: 'Regenerate the twin from the current page: the route answers, but with nothing in it (+5).',
      });
    }
    // Non-empty is the letter of the check; complete is the point of it. A twin holding a title and
    // nothing else is useless to the agent that fetched it, so credit slides with how much of the
    // page actually made it across.
    const twinWords = countWords(body);
    const liveWords = e.html.ok && e.html.body ? liveExtract(e).wordCount : 0;
    if (liveWords === 0 || twinWords >= liveWords * TWIN_FULL_RATIO) {
      const against = liveWords > 0 ? ` against the live page's ${liveWords}` : '';
      return pass(self, `The markdown twin returned ${plural(twinWords, 'word')} of markdown${against}.`);
    }
    const ratio = twinWords / liveWords;
    const earned = ramp(ratio, TWIN_FLOOR_RATIO, TWIN_FULL_RATIO, self.weight);
    return partial(
      self,
      earned,
      `The twin is ${plural(twinWords, 'word')} against the live page's ${liveWords}, so most of the page did not make it into the markdown.`,
      {
        detail: `${Math.round(ratio * 100)}% of the extractable text.`,
        fix: 'Regenerate the twin from the current page so it carries the whole body (+5).',
      },
    );
  },
);
