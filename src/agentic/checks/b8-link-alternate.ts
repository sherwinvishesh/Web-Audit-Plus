import { header } from '../http';
import { defineCheck, fail, partial, pass, q } from './helpers';

/** B8. The HTML advertises its twin with `Link: <...>; rel="alternate"; type="text/markdown"`. */
export const b8LinkAlternate = defineCheck(
  { id: 'B8', category: 'B', scored: false, required: false, weight: 3, title: 'HTML response advertises the twin via Link rel="alternate"' },
  (e, self) => {
    const linkValue = q(`<${new URL(e.twinUrl).pathname}>; rel="alternate"; type="text/markdown"`);
    if (e.advertisedTwinUrl) {
      return pass(self, `The HTML response advertises its markdown twin with Link rel="alternate": ${q(e.advertisedTwinUrl)}.`);
    }
    if (e.foreignTwinUrl) {
      return partial(
        self,
        1,
        `The HTML response advertises a markdown twin at ${q(e.foreignTwinUrl)}, which is not on this site's origin, so Web Audit+ did not fetch it and checked ${q(e.twinUrl)} instead.`,
        { fix: `Point the Link header at the twin on this origin: ${linkValue} (+2).` },
      );
    }
    const link = header(e.html, 'link');
    if (link) {
      return partial(
        self,
        1,
        `The HTML response has a Link header (${q(link)}) but no rel="alternate" entry of type text/markdown, so an agent still has to guess the twin URL.`,
        { fix: `Add ${linkValue} to the existing Link header (+2).` },
      );
    }
    return fail(self, 'The HTML response has no Link rel="alternate" header, so an agent has to guess the markdown twin URL.', {
      fix: `Add a \`Link\` header with the value ${linkValue} to the HTML response (+3).`,
    });
  },
);
