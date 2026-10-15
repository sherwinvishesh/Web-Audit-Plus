import { header, headerTokens } from '../http';
import { defineCheck, fail, pass, q } from './helpers';

/** B5. `X-Content-Type-Options: nosniff` on the twin, so no browser renders it as HTML. */
export const b5Nosniff = defineCheck(
  { id: 'B5', category: 'B', required: false, weight: 3, title: 'X-Content-Type-Options: nosniff is present' },
  (e, self) => {
    const value = header(e.twin, 'x-content-type-options');
    // Read as a browser does (Fetch's "determine nosniff"): the first token decides, so a header a
    // CDN duplicated ("nosniff, nosniff") still counts and a stray first value does not.
    if (headerTokens(value)[0] === 'nosniff') return pass(self, '`X-Content-Type-Options: nosniff` is set on the markdown response.');
    return fail(
      self,
      value ? `X-Content-Type-Options is ${q(value)}, not \`nosniff\`.` : 'No X-Content-Type-Options header on the markdown response.',
      { fix: 'Add `X-Content-Type-Options: nosniff` to the twin response (+3).' },
    );
  },
);
