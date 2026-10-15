import { describe, expect, it } from 'vitest';
import { compareModels, metricDelta, signed } from '../../src/shared/compare';
import { buildReportModel } from '../../src/shared/report-model';
import { flawedDesktopResult } from '../engine/fixture';
import { flawedRecord, withScores } from '../helpers/records';

/** The run before the fixture's: alt text was fine, the title was missing, two insights scored differently, LCP was slower. */
function earlierModel() {
  const engine = withScores(
    flawedDesktopResult(),
    { 'image-alt': 1, 'document-title': 0, 'render-blocking-insight': 0, 'cache-insight': 0.7 },
    { 'largest-contentful-paint': 1400.7164 },
  );
  return buildReportModel(flawedRecord({ id: 'run-0', startedAt: '2026-10-01T10:00:00.000Z', engine }));
}

describe('compareModels', () => {
  const current = buildReportModel(flawedRecord());
  const comparison = compareModels(current, earlierModel());

  it('names the run it compares with', () => {
    expect(comparison.previousId).toBe('run-0');
    expect(comparison.previousStartedAt).toBe('2026-10-01T10:00:00.000Z');
  });

  it('marks new problems and fixed ones', () => {
    expect(comparison.audits['accessibility:image-alt']).toEqual({ kind: 'new', before: 'pass' });
    expect(comparison.audits['seo:image-alt']?.kind).toBe('new');
    expect(comparison.audits['seo:document-title']).toEqual({ kind: 'fixed', before: 'fail' });
  });

  it('marks audits that got better or worse without changing sides', () => {
    expect(comparison.audits['performance:render-blocking-insight']?.kind).toBe('improved');
    expect(comparison.audits['performance:cache-insight']?.kind).toBe('regressed');
  });

  it('leaves unchanged audits out, and counts the rest', () => {
    expect(comparison.audits['accessibility:label']).toBeUndefined();
    expect(comparison.audits['accessibility:html-has-lang']).toBeUndefined();
    const total = Object.values(comparison.counts).reduce((sum, count) => sum + count, 0);
    expect(Object.keys(comparison.audits)).toHaveLength(total);
    expect(comparison.counts.new).toBeGreaterThanOrEqual(2);
    expect(comparison.counts.fixed).toBeGreaterThanOrEqual(1);
  });

  it('gives score deltas only where both runs have a score', () => {
    const before = earlierModel();
    expect(comparison.scores.accessibility).toBe((current.categories[1]?.score ?? 0) - (before.categories[1]?.score ?? 0));
    expect(comparison.scores.accessibility).toBeLessThan(0);
    expect(comparison.scores.agentic).toBe(0);
  });

  it('gives metric deltas in the metric’s unit, lower being better', () => {
    expect(comparison.metrics['largest-contentful-paint']).toEqual({ delta: -1200, unit: 'ms', before: '0.2 s' });
    expect(comparison.metrics['first-contentful-paint']).toBeUndefined();
  });

  it('compares nothing in a category that errored in either run', () => {
    const before = earlierModel();
    const accessibility = before.categories.find((category) => category.id === 'accessibility');
    if (accessibility) accessibility.error = 'The audit engine could not run';
    const result = compareModels(current, before);
    expect(Object.keys(result.audits).some((key) => key.startsWith('accessibility:'))).toBe(false);
  });

  it('compares nothing with itself', () => {
    const same = compareModels(current, buildReportModel(flawedRecord({ id: 'run-0' })));
    expect(same.audits).toEqual({});
    expect(same.metrics).toEqual({});
    expect(same.overall).toBe(0);
  });
});

describe('formatting deltas', () => {
  it('signs whole numbers with a real minus', () => {
    expect(signed(3)).toBe('+3');
    expect(signed(-2)).toBe('−2');
    expect(signed(0.2)).toBe('±0');
    expect(signed(1.25, 1)).toBe('+1.3');
  });

  it('shows metric deltas in their unit', () => {
    expect(metricDelta({ delta: -1200, unit: 'ms' })).toBe('−1.2 s');
    expect(metricDelta({ delta: 40.4, unit: 'ms' })).toBe('+40 ms');
    expect(metricDelta({ delta: 0.05, unit: 'unitless' })).toBe('+0.05');
    expect(metricDelta({ delta: -0.125, unit: 'unitless' })).toBe('−0.125');
  });
});
