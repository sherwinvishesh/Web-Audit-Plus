import { header, varyIncludesAccept } from '../http';
import { defineCheck, fail, partial, pass, q } from './helpers';

/** B7. `Vary: Accept` on both formats, so a CDN never serves one in place of the other. */
export const b7VaryAccept = defineCheck(
  { id: 'B7', category: 'B', scored: false, required: true, weight: 4, title: 'Vary includes Accept, so CDNs cache the two formats separately' },
  (e, self) => {
    const htmlVary = header(e.html, 'vary');
    const twinVary = header(e.twin, 'vary');
    const htmlOk = varyIncludesAccept(htmlVary);
    const twinOk = varyIncludesAccept(twinVary);
    if (htmlOk && twinOk) return pass(self, '`Vary: Accept` is set on both the HTML and the markdown response.');

    const missing = [htmlOk ? undefined : 'the HTML response', twinOk ? undefined : 'the markdown response'].filter(
      (side): side is string => side !== undefined,
    );
    const detail = `HTML Vary: ${htmlVary ? q(htmlVary) : 'absent'}. Markdown Vary: ${twinVary ? q(twinVary) : 'absent'}.`;
    // One side set is a materially better position than neither: that format is cached correctly,
    // and the poisoning risk is one-directional. It is also the permanent state of some framework
    // deployments, where middleware cannot add a header to a response it did not create.
    if (htmlOk || twinOk) {
      return partial(
        self,
        2,
        `Vary does not include Accept on ${missing.join(' or ')}. A CDN can cache that side's response and serve it to a visitor asking for the other format.`,
        {
          detail,
          fix: `Add \`Vary: Accept\` to ${missing.join(' and ')} (+2). If the framework will not let middleware set it, a CDN or proxy rule is the way through.`,
        },
      );
    }
    return fail(self, `Vary does not include Accept on ${missing.join(' or ')}. A CDN will cache one format and serve it to visitors asking for the other.`, {
      detail,
      fix: 'Add `Vary: Accept` to both responses (+4).',
    });
  },
);
