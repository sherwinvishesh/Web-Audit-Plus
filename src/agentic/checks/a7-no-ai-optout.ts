import { rawDocument } from '../extract';
import { header } from '../http';
import { defineCheck, fail, pass, q, unique } from './helpers';

const OPT_OUT = /\bnoai\b|\bnoimageai\b/i;

/** A7. No `noai` / `noimageai` directive in `X-Robots-Tag` or a robots meta tag. */
export const a7NoAiOptOut = defineCheck(
  { id: 'A7', category: 'A', required: true, weight: 8, title: 'No noai / noimageai tag is silently blocking AI' },
  (e, self) => {
    const found: string[] = [];
    const robotsTag = header(e.html, 'x-robots-tag') ?? '';
    if (OPT_OUT.test(robotsTag)) found.push(`X-Robots-Tag: ${robotsTag}`);

    if (e.html.body) {
      for (const meta of Array.from(rawDocument(e).querySelectorAll('meta[name], meta[property]'))) {
        const name = (meta.getAttribute('name') ?? meta.getAttribute('property') ?? '').toLowerCase();
        const content = meta.getAttribute('content') ?? '';
        if (!['robots', 'googlebot'].includes(name) && !name.includes('ai')) continue;
        if (OPT_OUT.test(content) || OPT_OUT.test(name)) found.push(`<meta name="${name}" content="${content}">`);
      }
    }

    const first = unique(found)[0];
    if (first !== undefined) {
      return fail(
        self,
        `An AI opt-out directive is set on this page: ${q(first)}. It tells AI tools to skip the page entirely.`,
        { fix: `Remove ${q(first)} unless the opt-out is deliberate (+8).` },
      );
    }
    return pass(self, 'No noai or noimageai opt-out directive is set in X-Robots-Tag or a robots meta tag.');
  },
);
