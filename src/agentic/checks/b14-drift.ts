import { liveExtract } from '../extract';
import { verifyFidelity } from '../fidelity';
import { parseFrontmatter } from '../frontmatter';
import { contentHash } from '../hash';
import { header } from '../http';
import { defineCheck, fail, httpStatus, na, partial, pass, plural, q } from './helpers';

const DRIFT_OPTIONS = { minWordRatio: 0.4, rejectInvented: false } as const;
const DAY_MS = 86_400_000;

/**
 * B14. Whether the twin still says what the live page says. With a source hash (an
 * `X-Markdown-Source-Hash` header, or `source_hash` in the twin's frontmatter) the comparison is
 * exact; without one, the facts on the live page (numbers, dates, prices) are compared one by one.
 * A changed hash with every fact intact is cosmetic drift and keeps half the weight.
 */
export const b14Drift = defineCheck(
  { id: 'B14', category: 'B', scored: false, required: true, weight: 4, title: 'The served markdown still matches the live page (no drift or staleness)' },
  (e, self) => {
    if (!e.twin.ok || !e.twin.body.trim()) {
      return fail(self, `There is no markdown twin to compare against the live page (${httpStatus(e.twin.status)}).`, {
        fix: 'Fix B1 first: there is no twin to compare against the live page (+4).',
      });
    }
    if (!e.html.ok || !e.html.body.trim()) {
      return na(self, 'The live HTML page did not respond, so there is nothing to compare the twin against.');
    }
    const parsed = parseFrontmatter(e.twin.body);
    // A server that strips frontmatter answers with the hash as a header instead; a twin served
    // straight off a static host keeps its frontmatter. Both are read.
    const frontHash = parsed.data['source_hash'];
    const frontUpdated = parsed.data['last_updated'];
    const sourceHash = header(e.twin, 'x-markdown-source-hash') ?? (typeof frontHash === 'string' ? frontHash : undefined);
    const lastUpdated = header(e.twin, 'last-modified') ?? (typeof frontUpdated === 'string' ? frontUpdated : undefined);
    const age = describeAge(lastUpdated, e.fetchedAt);
    // Extracted content, never raw HTML: a build id or a script nonce changing is not the page
    // changing, and a check that says otherwise on every deploy is a check people learn to ignore.
    const extracted = liveExtract(e);
    const compareFacts = () => verifyFidelity(extracted.markdown, parsed.body, DRIFT_OPTIONS);

    if (sourceHash) {
      const liveHash = contentHash(extracted.markdown);
      if (liveHash === sourceHash.trim()) {
        return pass(
          self,
          `The twin was generated from exactly this version of the page${age ? `, ${age}` : ''}.`,
          `Source hash ${q(sourceHash)} matches the content of the live page.`,
        );
      }
      // A typo fix and a rewritten page both break the hash, and only one of them is serving agents
      // wrong information. Fidelity compares the facts, so it can tell them apart.
      const drift = compareFacts();
      if (drift.ok) {
        return partial(
          self,
          2,
          `The live page has changed since the twin was generated${age ? ` ${age}` : ''}, but every number, date and price on it still appears in the twin, so the drift is cosmetic so far.`,
          {
            detail: `The twin's source hash is ${q(sourceHash)}; the live page's content hashes to ${q(liveHash)}.`,
            fix: 'Regenerate the twin from the current page before the next edit makes it wrong (+2).',
          },
        );
      }
      return fail(
        self,
        `The live page has changed since the twin was generated${age ? ` ${age}` : ''}. AI agents are being served stale content.`,
        {
          detail: `The twin's source hash is ${q(sourceHash)}; the live page's content hashes to ${q(liveHash)}. ${drift.errors[0] ?? ''}`.trim(),
          fix: 'Regenerate the twin from the current page (+4).',
        },
      );
    }

    // No hash anywhere: a hand-written twin, or one built by a tool that does not record one. The
    // facts on the live page are compared against the facts in the twin instead.
    const drift = compareFacts();
    const byFact = 'The twin reports no source hash, so this was compared fact by fact rather than by hash.';
    if (drift.ok) {
      return pass(
        self,
        `The twin reports no source hash, but every number, date and price on the live page still appears in it${age ? ` (twin last updated ${age})` : ''}.`,
      );
    }
    if (drift.errors.length === 1) {
      return partial(self, 2, `The twin has drifted from the live page in one place${age ? `, and was last updated ${age}` : ''}. ${drift.errors[0] ?? ''}`.trim(), {
        detail: byFact,
        fix: 'Regenerate the twin from the current page (+2).',
      });
    }
    return fail(self, `The twin no longer matches the live page${age ? `, and was last updated ${age}` : ''}. ${drift.errors[0] ?? ''}`.trim(), {
      detail: `${byFact} ${plural(drift.errors.length, 'problem')} found.`,
      fix: 'Regenerate the twin from the current page (+4).',
    });
  },
);

/** "today", "yesterday", "3 days ago", "4 months ago", measured from when the evidence was gathered. */
export function describeAge(lastUpdated: string | undefined, now: string): string | undefined {
  if (!lastUpdated) return undefined;
  const then = Date.parse(lastUpdated);
  const at = Date.parse(now);
  if (Number.isNaN(then) || Number.isNaN(at)) return undefined;
  const days = Math.floor((at - then) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 60) return `${days} days ago`;
  return `${Math.floor(days / 30)} months ago`;
}
