import { isMarkdownResponse } from '../http';
import { defineCheck, fail, httpStatus, pass, q } from './helpers';
import { describeContentType, redirectedAway } from './negotiation';

/** B10. A known AI crawler's User-Agent gets markdown with no Accept header to go on. */
export const b10BotUaNegotiation = defineCheck(
  { id: 'B10', category: 'B', scored: false, required: true, weight: 6, title: 'A known AI bot User-Agent receives markdown without an Accept header' },
  (e, self) => {
    const response = e.botUa;
    const bot = e.botName || 'GPTBot';
    if (!response.ok) {
      return fail(self, `A request identifying as ${bot} returned ${httpStatus(response.status)}.`, {
        fix: 'Answer 2xx to a known AI bot User-Agent (+6). Check nothing upstream is rate limiting or blocking it.',
      });
    }
    if (isMarkdownResponse(response) && redirectedAway(response, e)) {
      return fail(
        self,
        `A ${bot} User-Agent was redirected to ${q(response.finalUrl)} for its markdown. A crawler that follows it indexes that URL instead of the page.`,
        { fix: 'Rewrite known AI bot User-Agents to the twin instead of redirecting them, so the markdown is served at the same URL (+6).' },
      );
    }
    if (isMarkdownResponse(response)) {
      return pass(self, `A ${bot} User-Agent received markdown at the same URL without needing to send an Accept header.`);
    }
    return fail(
      self,
      `A ${bot} User-Agent received ${describeContentType(response)}. Most AI crawlers never send \`Accept: text/markdown\`, so User-Agent routing is what actually reaches them.`,
      { fix: 'Route known AI bot User-Agents to the twin as well, not only Accept headers (+6). Match them in your server or edge middleware.' },
    );
  },
);
