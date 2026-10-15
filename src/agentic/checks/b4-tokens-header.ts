import { header } from '../http';
import { defineCheck, fail, pass, q } from './helpers';

/** B4. `X-Markdown-Tokens`, a positive integer, so an agent can budget before reading. */
export const b4TokensHeader = defineCheck(
  { id: 'B4', category: 'B', scored: false, required: false, weight: 3, title: 'X-Markdown-Tokens is present and a positive integer' },
  (e, self) => {
    const raw = header(e.twin, 'x-markdown-tokens');
    if (!raw) {
      return fail(self, 'No X-Markdown-Tokens header, so an agent cannot gauge the response size before fetching it.', {
        fix: 'Send `X-Markdown-Tokens` with the token count of the twin body (+3). Compute it when the twin is generated and serve it as a header.',
      });
    }
    const value = Number(raw.trim());
    if (!/^\d+$/.test(raw.trim()) || !Number.isSafeInteger(value) || value <= 0) {
      return fail(self, `X-Markdown-Tokens is ${q(raw)}, which is not a positive integer.`, {
        fix: 'Send `X-Markdown-Tokens` as a plain positive integer (+3).',
      });
    }
    return pass(self, `X-Markdown-Tokens is ${q(value)}.`);
  },
);
