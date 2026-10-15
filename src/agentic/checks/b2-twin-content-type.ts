import { header, MARKDOWN_CONTENT_TYPE } from '../http';
import { defineCheck, fail, httpStatus, partial, pass, q } from './helpers';

/** B2. The twin's Content-Type, exactly `text/markdown; charset=utf-8`. */
export const b2TwinContentType = defineCheck(
  { id: 'B2', category: 'B', scored: false, required: true, weight: 5, title: 'Content-Type is exactly text/markdown; charset=utf-8' },
  (e, self) => {
    if (!e.twin.ok) {
      return fail(self, `No markdown twin response to inspect (${httpStatus(e.twin.status)}).`, {
        fix: 'Fix B1 first: there is no twin response to read a Content-Type from (+5).',
      });
    }
    const actual = header(e.twin, 'content-type');
    if (!actual) {
      return fail(self, 'The markdown twin response has no Content-Type header at all.', {
        fix: `Send \`Content-Type: ${MARKDOWN_CONTENT_TYPE}\` on the twin response (+5).`,
      });
    }
    const normalized = actual.toLowerCase().replace(/\s*;\s*/g, '; ').trim();
    if (normalized === MARKDOWN_CONTENT_TYPE) return pass(self, `Content-Type is exactly ${q(actual)}.`);
    // The type is right and only the charset is missing. Every agent that matches on the media type
    // is already satisfied; what is left is the one that has to guess the encoding.
    if (normalized.startsWith('text/markdown')) {
      return partial(self, 3, `Content-Type is ${q(actual)}: the media type is right, but it does not declare \`charset=utf-8\`, so the encoding is left to be guessed.`, {
        fix: `Send exactly \`${MARKDOWN_CONTENT_TYPE}\` (+2).`,
      });
    }
    // text/plain at least stops a browser rendering the markdown as HTML, so it is a smaller error
    // than text/html, but no agent selects on it and none will treat the body as markdown.
    if (normalized.startsWith('text/plain')) {
      return partial(
        self,
        2,
        `Content-Type is ${q(actual)}, not \`${MARKDOWN_CONTENT_TYPE}\`. The body will be read as plain text, so nothing selecting on the markdown type will find it.`,
        { fix: `Send \`${MARKDOWN_CONTENT_TYPE}\` (+3).` },
      );
    }
    return fail(
      self,
      `Content-Type is ${q(actual)}, not \`${MARKDOWN_CONTENT_TYPE}\`. Agents sniffing the type may treat the body as HTML or plain text.`,
      { fix: `Send \`${MARKDOWN_CONTENT_TYPE}\` on the twin response (+5).` },
    );
  },
);
