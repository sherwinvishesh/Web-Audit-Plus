import { header } from '../http';
import { defineCheck, fail, partial, pass, q } from './helpers';

/** B6. `X-Robots-Tag: noindex` on the twin, so it never competes with the page in search. */
export const b6TwinNoindex = defineCheck(
  { id: 'B6', category: 'B', required: true, weight: 3, title: 'X-Robots-Tag on the twin includes noindex' },
  (e, self) => {
    const value = header(e.twin, 'x-robots-tag');
    if (!value) {
      return fail(self, 'No X-Robots-Tag on the markdown twin, so search engines may index it as duplicate content alongside the HTML page.', {
        fix: 'Add `X-Robots-Tag: noindex` to the twin response (+3).',
      });
    }
    if (!/\bnoindex\b/i.test(value)) {
      return partial(self, 1, `X-Robots-Tag is ${q(value)} and does not include \`noindex\`, so the twin can still be indexed alongside the HTML page as duplicate content.`, {
        fix: "Add `noindex` to the twin's X-Robots-Tag (+2).",
      });
    }
    return pass(self, `X-Robots-Tag includes noindex: ${q(value)}.`);
  },
);
