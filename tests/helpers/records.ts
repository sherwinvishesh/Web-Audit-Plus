import { buildAgenticReport } from '../../src/agentic/report';
import { categoryScore, type Lhr } from '../../src/lighthouse/lhr';
import { overallOf, type RunRecord } from '../../src/shared/run';
import { flawedDesktopLhr } from '../lighthouse/fixture';
import { unadoptedEvidence } from './evidence';

/** A saved run of the flawed fixture site: real Lighthouse result, Agentic from hand-built evidence. */
export function flawedRecord(overrides: { id?: string; startedAt?: string; lighthouse?: Lhr } = {}): RunRecord {
  const lighthouse = overrides.lighthouse ?? flawedDesktopLhr();
  const agentic = buildAgenticReport(unadoptedEvidence());
  const scores: RunRecord['scores'] = {
    performance: categoryScore(lighthouse, 'performance'),
    accessibility: categoryScore(lighthouse, 'accessibility'),
    'best-practices': categoryScore(lighthouse, 'best-practices'),
    seo: categoryScore(lighthouse, 'seo'),
    agentic: agentic.score.value,
  };
  return {
    id: overrides.id ?? 'run-1',
    url: lighthouse.finalDisplayedUrl,
    origin: new URL(lighthouse.finalDisplayedUrl).origin,
    startedAt: overrides.startedAt ?? lighthouse.fetchTime,
    durationMs: 9_000,
    options: { formFactor: 'desktop', categories: ['performance', 'accessibility', 'best-practices', 'seo', 'agentic'] },
    scores,
    overall: overallOf(scores),
    agentic,
    lighthouse,
    errors: {},
    environment: { extensionVersion: '0.1.0', userAgent: 'test' },
  };
}

/** Set some audits' scores in a Lighthouse result, and recompute the category scores the way Lighthouse does. */
export function withScores(lhr: Lhr, scores: Record<string, number | null>, numeric: Record<string, number> = {}): Lhr {
  const copy = structuredClone(lhr);
  for (const [id, score] of Object.entries(scores)) {
    const audit = copy.audits[id];
    if (!audit) throw new Error(`no audit ${id}`);
    audit.score = score;
    if (score !== null && audit.scoreDisplayMode === 'notApplicable') audit.scoreDisplayMode = 'binary';
  }
  for (const [id, value] of Object.entries(numeric)) {
    const audit = copy.audits[id];
    if (!audit) throw new Error(`no audit ${id}`);
    audit.numericValue = value;
  }
  for (const category of Object.values(copy.categories)) {
    const scored = category.auditRefs.filter((ref) => ref.weight > 0 && typeof copy.audits[ref.id]?.score === 'number');
    const total = scored.reduce((sum, ref) => sum + ref.weight, 0);
    category.score = total > 0 ? scored.reduce((sum, ref) => sum + ref.weight * (copy.audits[ref.id]?.score ?? 0), 0) / total : null;
  }
  return copy;
}
