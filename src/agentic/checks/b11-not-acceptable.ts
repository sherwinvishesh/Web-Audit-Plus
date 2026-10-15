import { HOSTILE_ACCEPT } from '../http';
import { defineCheck, fail, httpStatus, pass } from './helpers';

/** B11. An Accept header that rules out both HTML and markdown is refused with 406. */
export const b11NotAcceptable = defineCheck(
  { id: 'B11', category: 'B', required: false, weight: 2, title: 'An Accept header excluding HTML and markdown returns 406' },
  (e, self) => {
    if (e.notAcceptable.status === 406) {
      return pass(self, 'An Accept header excluding both HTML and markdown correctly returned 406 Not Acceptable.');
    }
    return fail(self, `A request with \`Accept: ${HOSTILE_ACCEPT}\` returned ${httpStatus(e.notAcceptable.status)} instead of 406 Not Acceptable.`, {
      fix: 'Return 406 when the Accept header asks for a format the page cannot produce (+2).',
    });
  },
);
