import { isMarkdownResponse } from '../http';
import { defineCheck, fail, httpStatus, pass, q } from './helpers';
import { describeContentType, redirectedAway } from './negotiation';

/** B9. `Accept: text/markdown` at the page's own URL gets markdown back, by rewrite, not redirect. */
export const b9AcceptNegotiation = defineCheck(
  { id: 'B9', category: 'B', required: true, weight: 6, title: 'Accept: text/markdown receives markdown, not HTML' },
  (e, self) => {
    const response = e.acceptMarkdown;
    if (!response.ok) {
      return fail(self, `A request with \`Accept: text/markdown\` returned ${httpStatus(response.status)}.`, {
        fix: 'Answer 2xx to a request carrying `Accept: text/markdown` (+6).',
      });
    }
    if (isMarkdownResponse(response) && redirectedAway(response, e)) {
      return fail(
        self,
        `A request with \`Accept: text/markdown\` was redirected to ${q(response.finalUrl)} for its markdown. An agent that follows it cites that URL instead of the page.`,
        { fix: 'Rewrite requests that prefer text/markdown to the twin instead of redirecting them, so the markdown is served at the same URL (+6).' },
      );
    }
    if (isMarkdownResponse(response)) return pass(self, 'A request with `Accept: text/markdown` received markdown at the same URL.');
    return fail(
      self,
      `A request with \`Accept: text/markdown\` received ${describeContentType(response)} instead of markdown. Content negotiation is not wired up.`,
      { fix: 'In your server or edge middleware, rewrite requests that prefer text/markdown to the twin, at the same URL (+6).' },
    );
  },
);
