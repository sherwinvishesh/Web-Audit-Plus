import { describe, expect, it } from 'vitest';
// The engine's own implementations: the port must agree with them exactly.
import { getLogNormalScore } from '../../packages/engine/shared/statistics.js';
import { Util } from '../../packages/engine/shared/util.js';
import { engineAudits } from '../../src/engine/normalize';
import { logNormalScore, metricScore, savingsImpact, type ScoringOptions } from '../../src/engine/scoring';
import { flawedDesktopResult, resultAudit, resultWith } from './fixture';

const CURVES: ScoringOptions[] = [
  { p10: 1800, median: 3000 }, // mobile FCP
  { p10: 2500, median: 4000 }, // mobile LCP
  { p10: 200, median: 600 }, // mobile TBT
  { p10: 0.1, median: 0.25 }, // CLS
  { p10: 934, median: 1600 }, // desktop FCP
];

describe('scoring', () => {
  it('matches the engine’s log-normal curve and metric score across the range', () => {
    for (const curve of CURVES) {
      for (let step = 0; step <= 200; step++) {
        const value = (curve.median * 4 * step) / 200;
        expect(logNormalScore(curve, value)).toBeCloseTo(getLogNormalScore(curve, value), 12);
        expect(metricScore(curve, value)).toBe(Util.computeLogNormalScore(curve, value));
      }
    }
  });

  it('scores 0.9 at p10 and 0.5 at the median', () => {
    const curve = { p10: 200, median: 600 };
    expect(metricScore(curve, 200)).toBe(0.9);
    expect(metricScore(curve, 600)).toBe(0.5);
    expect(metricScore(curve, 0)).toBe(1);
  });

  it('is zero without savings or weight', () => {
    expect(savingsImpact(undefined, [], 100)).toBe(0);
    expect(savingsImpact({ LCP: 500 }, [], 0)).toBe(0);
  });

  it('agrees with the overall impact the report renderer computes', () => {
    const metrics = [
      { audit: resultAudit('first-contentful-paint', { score: 0.2, scoreDisplayMode: 'numeric', numericValue: 4300, numericUnit: 'millisecond', scoringOptions: CURVES[0] }), weight: 10, acronym: 'FCP' },
      { audit: resultAudit('largest-contentful-paint', { score: 0.05, scoreDisplayMode: 'numeric', numericValue: 9100, numericUnit: 'millisecond', scoringOptions: CURVES[1] }), weight: 25, acronym: 'LCP' },
      { audit: resultAudit('total-blocking-time', { score: 0.31, scoreDisplayMode: 'numeric', numericValue: 820, numericUnit: 'millisecond', scoringOptions: CURVES[2] }), weight: 30, acronym: 'TBT' },
      { audit: resultAudit('cumulative-layout-shift', { score: 1, scoreDisplayMode: 'numeric', numericValue: 0.01, numericUnit: 'unitless', scoringOptions: CURVES[3] }), weight: 25, acronym: 'CLS' },
    ];
    const savings = { FCP: 900, LCP: 2600, TBT: 300, CLS: 0 };
    const insight = resultAudit('render-blocking-insight', { score: 0, scoreDisplayMode: 'metricSavings', metricSavings: savings });
    const engineResult = resultWith('performance', [...metrics.map((metric) => ({ ...metric, group: 'metrics' })), { audit: insight, weight: 0, group: 'insights' }]);

    // The report renderer's `overallImpact`, written out with its own score function.
    let expected = 0;
    for (const metric of metrics) {
      const saved = savings[metric.acronym as keyof typeof savings];
      const { numericValue = 0, scoringOptions, score } = metric.audit;
      if (!saved || !scoringOptions || score === null) continue;
      expected += (Util.computeLogNormalScore(scoringOptions, numericValue - saved) - score) * metric.weight;
    }
    const weightTotal = metrics.reduce((sum, metric) => sum + metric.weight, 0);
    const row = engineAudits(engineResult, 'performance').find((item) => item.id === 'render-blocking-insight');
    expect(row?.impact).toBe(Math.round((expected / weightTotal) * 1000) / 10);
  });

  it('finds no impact on a page whose metrics already pass', () => {
    const rows = engineAudits(flawedDesktopResult(), 'performance');
    expect(rows.every((row) => !row.impact)).toBe(true);
  });
});
