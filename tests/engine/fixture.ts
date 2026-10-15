import { readFileSync } from 'node:fs';
import type { EngineResult, ResultAudit } from '../../src/engine/result';

/**
 * A real desktop run of the flawed fixture site (tests/fixtures/sites.ts), captured from the
 * extension. Large artifacts (network requests, the trace-derived tables, full-size screenshots) and
 * the details of most passing audits are removed; every audit, category and group is still there.
 */
export function flawedDesktopResult(): EngineResult {
  return JSON.parse(readFileSync(new URL('../fixtures/result-flawed-desktop.json', import.meta.url), 'utf8')) as EngineResult;
}

/** An audit as the engine writes one, with only what a test sets. */
export function resultAudit(id: string, overrides: Partial<ResultAudit> = {}): ResultAudit {
  return { id, title: `Audit ${id}`, description: `Checks ${id}.`, score: 1, scoreDisplayMode: 'binary', ...overrides };
}

/** A one-category engine result around the given audits, each weighted as listed. */
export function resultWith(category: string, refs: Array<{ audit: ResultAudit; weight: number; group?: string; acronym?: string }>): EngineResult {
  const base = flawedDesktopResult();
  const audits: EngineResult['audits'] = {};
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
