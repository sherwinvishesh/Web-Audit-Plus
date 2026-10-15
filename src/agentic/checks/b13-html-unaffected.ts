import { header, parseUrl } from '../http';
import { isMarkdownPath } from '../routes';
import { defineCheck, fail, httpStatus, pass, q } from './helpers';

const HTML_TYPES = ['text/html', 'application/xhtml+xml'];

/** B13. A normal browser request still gets the real HTML page, at the page's own URL. */
export const b13HtmlUnaffected = defineCheck(
  { id: 'B13', category: 'B', required: true, weight: 9, title: 'The original HTML URL is still reachable and unaffected' },
  (e, self) => {
    if (!e.html.ok) {
      return fail(self, `The original HTML URL returned ${httpStatus(e.html.status)} to a normal browser request.`, {
        fix: 'Get the HTML URL answering 2xx to a normal browser again (+9). Serving agents must never cost human visitors the page.',
      });
    }
    // Markdown routing done as a redirect that catches browsers too: the page "works", but every
    // human visitor is bounced onto the markdown.
    const landed = e.html.redirected ? parseUrl(e.html.finalUrl) : undefined;
    if (landed && (e.html.finalUrl === e.twinUrl || isMarkdownPath(landed.pathname))) {
      return fail(self, `A normal browser request was redirected to ${q(e.html.finalUrl)}, the markdown twin, instead of staying on the page.`, {
        fix: 'Send browsers the HTML page; route only requests that ask for markdown, and rewrite rather than redirect (+9).',
      });
    }
    const contentType = header(e.html, 'content-type') ?? '';
    if (!HTML_TYPES.some((type) => contentType.toLowerCase().includes(type))) {
      return fail(
        self,
        `A normal browser request received ${contentType ? q(contentType) : 'no Content-Type'} instead of HTML. Human visitors are being served the wrong format.`,
        { fix: 'Serve markdown only to requests that asked for it (+9). A browser Accept header must still get HTML.' },
      );
    }
    if (!e.html.body.trim()) {
      return fail(self, 'The original HTML URL returned an empty body to a normal browser request.', {
        fix: 'Return the real HTML page to a normal browser request (+9).',
      });
    }
    return pass(self, 'A normal browser request still receives the real HTML page, unchanged.');
  },
);
