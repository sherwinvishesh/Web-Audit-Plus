import { servesFile } from '../sniff';
import { defineCheck, fail, httpStatus, partial, pass, plural, q } from './helpers';

/** A2. /llms.txt: markdown with an `# H1` and at least one link. */
export const a2LlmsTxt = defineCheck(
  { id: 'A2', category: 'A', required: false, weight: 3, title: 'llms.txt is present and valid' },
  (e, self) => {
    if (!e.llms.ok) {
      return fail(self, `No llms.txt at ${q(e.llms.url)} (${httpStatus(e.llms.status)}).`, {
        fix: 'Serve /llms.txt with a `# Title` line and your key pages as markdown links (+3).',
      });
    }
    if (!servesFile(e.llms)) {
      return fail(self, `${q(e.llms.url)} answered with an HTML page, not an llms.txt. A catch-all route is handling it.`, {
        fix: 'Serve a real /llms.txt ahead of the catch-all route (+3).',
      });
    }
    const body = e.llms.body.trim();
    const links = (body.match(/\[[^\]]+\]\([^)]+\)/g) ?? []).length;
    const hasTitle = /^#\s+\S/m.test(body);

    if (!body) {
      return partial(self, 1, 'llms.txt exists but is empty. The file is being served, which is most of the plumbing.', {
        fix: 'Add a `# Title` line and a list of your key pages as markdown links (+2).',
      });
    }
    if (links === 0) {
      return partial(self, 1, 'llms.txt lists no links, so an agent reading it learns nothing about the site.', {
        fix: 'List your key pages as markdown links under a `## Pages` heading (+2).',
      });
    }
    if (!hasTitle) {
      return partial(self, 2, `llms.txt lists ${plural(links, 'link')} but has no \`# Title\` heading, which the convention requires as its first line.`, {
        fix: 'Add a `# Site name` first line, and a one-line `> description` under it (+1).',
      });
    }
    return pass(self, `llms.txt is present and valid, with a title and ${plural(links, 'link')}.`);
  },
);
