import { buildAgenticReport } from '../../src/agentic/report';
import { categoryScore, type EngineResult } from '../../src/engine/result';
import { overallOf, type RunRecord } from '../../src/shared/run';
import { flawedDesktopResult } from '../engine/fixture';
import { unadoptedEvidence } from './evidence';

/** A saved run of the flawed fixture site: real engine result, Agentic from hand-built evidence. */
export function flawedRecord(overrides: { id?: string; startedAt?: string; engine?: EngineResult } = {}): RunRecord {
  const engine = overrides.engine ?? flawedDesktopResult();
  const agentic = buildAgenticReport(unadoptedEvidence());
  const scores: RunRecord['scores'] = {
    performance: categoryScore(engine, 'performance'),
    accessibility: categoryScore(engine, 'accessibility'),
    'best-practices': categoryScore(engine, 'best-practices'),
    seo: categoryScore(engine, 'seo'),
    agentic: agentic.score.value,
  };
  return {
    id: overrides.id ?? 'run-1',
    url: engine.finalDisplayedUrl,
    origin: new URL(engine.finalDisplayedUrl).origin,
    startedAt: overrides.startedAt ?? engine.fetchTime,
    durationMs: 9_000,
    options: { formFactor: 'desktop', categories: ['performance', 'accessibility', 'best-practices', 'seo', 'agentic'] },
    scores,
    overall: overallOf(scores),
    agentic,
    engine,
    errors: {},
    environment: { extensionVersion: '0.1.0', userAgent: 'test' },
  };
}

/** Set some audits' scores in an engine result, and recompute the category scores the way the engine does. */
export function withScores(engineResult: EngineResult, scores: Record<string, number | null>, numeric: Record<string, number> = {}): EngineResult {
  const copy = structuredClone(engineResult);
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
