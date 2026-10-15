import { servesFile } from '../sniff';
import { defineCheck, fail, httpStatus, pass, q } from './helpers';

const SERVE_FIX = 'Generate a markdown copy of the page and serve it from your server or edge middleware.';

/**
 * B1. The markdown twin answers 2xx with markdown. The heaviest check in the table: when it fails,
 * the twin-dependent checks are locked behind it rather than failed one by one.
 */
export const b1TwinReachable = defineCheck(
  { id: 'B1', category: 'B', required: true, weight: 10, title: 'Markdown twin URL is reachable and returns 2xx' },
  (e, self) => {
    if (e.twin.error) {
      return fail(self, `Could not reach the markdown twin at ${q(e.twinUrl)}: ${q(e.twin.error)}.`, {
        fix: `Serve a markdown twin at ${q(e.twinUrl)} (+10). ${SERVE_FIX}`,
      });
    }
    if (!e.twin.ok) {
      return fail(self, `The markdown twin at ${q(e.twinUrl)} returned ${httpStatus(e.twin.status)}. Agents that follow the .md convention get nothing.`, {
        fix: `Serve a markdown twin at ${q(e.twinUrl)} (+10). ${SERVE_FIX}`,
      });
    }
    if (!servesFile(e.twin)) {
      return fail(
        self,
        `The markdown twin URL ${q(e.twinUrl)} answered HTTP ${e.twin.status} with an HTML page, not markdown. A catch-all route or the page renderer is handling the .md URL.`,
        { fix: `Route ${q(e.twinUrl)} to a markdown copy of the page, ahead of the page renderer (+10).` },
      );
    }
    return pass(self, `The markdown twin at ${q(e.twinUrl)} returned HTTP ${e.twin.status}.`);
  },
);
