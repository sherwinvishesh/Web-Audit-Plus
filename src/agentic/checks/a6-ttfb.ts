import { defineCheck, fail, na, partial, pass, ramp } from './helpers';

/** At or under this, a first byte is unimprovable from an agent's point of view. */
export const TTFB_FAST_MS = 400;
/** Past this, a crawler with a short timeout is dropping the page. */
export const TTFB_SLOW_MS = 1500;

/** A6. Time to first byte of the HTML, ramped between 400 ms and 1500 ms. */
export const a6Ttfb = defineCheck(
  { id: 'A6', category: 'A', scored: true, required: true, weight: 8, title: 'Time to first byte is fast enough for agent fetches' },
  (e, self) => {
    if (!e.html.ok) return na(self, 'The page did not respond, so there is no time to first byte to measure.');
    const ms = Math.round(e.html.ttfbMs);
    const where = e.measuredFrom === 'browser' ? ', measured from this browser' : '';
    if (ms <= TTFB_FAST_MS) {
      return pass(self, `Time to first byte was ${ms} ms${where}, inside the ${TTFB_FAST_MS} ms an agent fetch wants.`);
    }
    if (ms >= TTFB_SLOW_MS) {
      return fail(
        self,
        `Time to first byte was ${ms} ms${where}, past the ${TTFB_SLOW_MS} ms ceiling. Agents fetching several pages under a short timeout will drop this one.`,
        { fix: `Get first byte under ${TTFB_FAST_MS} ms (+8). Cache the HTML at the edge if the work behind it is slow.` },
      );
    }
    const earned = ramp(TTFB_SLOW_MS - ms, 0, TTFB_SLOW_MS - TTFB_FAST_MS, self.weight);
    return partial(self, earned, `Time to first byte was ${ms} ms${where}. Usable, but past the ${TTFB_FAST_MS} ms an agent fetch wants.`, {
      fix: `Get first byte under ${TTFB_FAST_MS} ms (+8).`,
    });
  },
);
