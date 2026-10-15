import { header } from '../http';
import { defineCheck, fail, pass, q } from './helpers';

/** B12. `X-AEO-Version` names the serving convention the site implements. Presence only. */
export const b12AeoVersion = defineCheck(
  { id: 'B12', category: 'B', scored: false, required: false, weight: 2, title: 'X-AEO-Version advertises the spec version implemented' },
  (e, self) => {
    const value = header(e.twin, 'x-aeo-version') ?? header(e.acceptMarkdown, 'x-aeo-version');
    if (value) return pass(self, `X-AEO-Version advertises ${q(value)}.`);
    return fail(self, 'No X-AEO-Version header, so an agent cannot tell which serving convention this site implements.', {
      fix: 'Add `X-AEO-Version: 1.0` to the twin response (+2).',
    });
  },
);
