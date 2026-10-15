import { readFileSync } from 'node:fs';
import type { Lhr, LhrAudit } from '../../src/lighthouse/lhr';

/**
 * A real desktop run of the flawed fixture site (tests/fixtures/sites.ts), captured from the
 * extension. Large artifacts (network requests, the trace-derived tables, full-size screenshots) and
 * the details of most passing audits are removed; every audit, category and group is still there.
 */
export function flawedDesktopLhr(): Lhr {
  return JSON.parse(readFileSync(new URL('../fixtures/lhr-flawed-desktop.json', import.meta.url), 'utf8')) as Lhr;
}

/** An audit as Lighthouse writes one, with only what a test sets. */
export function lhrAudit(id: string, overrides: Partial<LhrAudit> = {}): LhrAudit {
  return { id, title: `Audit ${id}`, description: `Checks ${id}.`, score: 1, scoreDisplayMode: 'binary', ...overrides };
}

/** A one-category LHR around the given audits, each weighted as listed. */
export function lhrWith(category: string, refs: Array<{ audit: LhrAudit; weight: number; group?: string; acronym?: string }>): Lhr {
  const base = flawedDesktopLhr();
  const audits: Lhr['audits'] = {};
  for (const { audit } of refs) audits[audit.id] = audit;
  return {
    ...base,
    audits,
    categories: {
      [category]: {
        id: category,
        title: category,
        score: null,
        auditRefs: refs.map(({ audit, weight, group, acronym }) => ({ id: audit.id, weight, ...(group ? { group } : {}), ...(acronym ? { acronym } : {}) })),
      },
    },
  };
}
