/**
 * Lighthouse's metric scoring curve, and the "overall impact" its report uses to rank performance
 * insights. Insights carry no weight in the Performance score, so Lighthouse estimates what each is
 * worth from its metric savings: apply the savings to each metric it affects, re-score that metric,
 * and sum the weighted gains. Ported from `shared/statistics.js`, `shared/util.js` and
 * `report/renderer/performance-category-renderer.js` so the numbers match Lighthouse's own report.
 */

// The exact doubles Lighthouse clamps each rating band to.
const MIN_PASSING_SCORE = 0.90000000000000002220446049250313080847263336181640625;
const MAX_AVERAGE_SCORE = 0.899999999999999911182158029987476766109466552734375;
const MIN_AVERAGE_SCORE = 0.5;
const MAX_FAILING_SCORE = 0.499999999999999944488848768742172978818416595458984375;

// Closest double to `erfc⁻¹(1/5)`.
const INVERSE_ERFC_ONE_FIFTH = 0.9061938024368232;

export interface ScoringOptions {
  p10: number;
  median: number;
}

function erf(value: number): number {
  const sign = Math.sign(value);
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return sign * (1 - y * Math.exp(-x * x));
}

/** 0–1: 0.9 at `p10`, 0.5 at `median`, on a log-normal curve. */
export function logNormalScore({ p10, median }: ScoringOptions, value: number): number {
  if (median <= 0 || p10 <= 0 || p10 >= median) return value <= p10 ? 1 : 0;
  if (value <= 0) return 1;
  const xLogRatio = Math.log(Math.max(Number.MIN_VALUE, value / median));
  const p10LogRatio = -Math.log(Math.max(Number.MIN_VALUE, p10 / median));
  const percentile = (1 - erf((xLogRatio * INVERSE_ERFC_ONE_FIFTH) / p10LogRatio)) / 2;
  if (value <= p10) return Math.max(MIN_PASSING_SCORE, Math.min(1, percentile));
  if (value <= median) return Math.max(MIN_AVERAGE_SCORE, Math.min(MAX_AVERAGE_SCORE, percentile));
  return Math.max(0, Math.min(MAX_FAILING_SCORE, percentile));
}

/** A metric's score as Lighthouse reports it: boosted above 0.9 and floored to two digits. */
export function metricScore(options: ScoringOptions, value: number): number {
  let percentile = logNormalScore(options, value);
  if (percentile > 0.9) percentile += 0.05 * (percentile - 0.9);
  return Math.floor(percentile * 100) / 100;
}

export interface WeightedMetric {
  acronym: string;
  weight: number;
  score: number | null;
  numericValue?: number | undefined;
  scoringOptions?: ScoringOptions | undefined;
}

/**
 * The Performance score points (0–100) an audit's metric savings would add, the way Lighthouse's
 * report estimates them. `weightTotal` is the sum of the category's weights.
 */
export function savingsImpact(savings: Readonly<Record<string, number | undefined>> | undefined, metrics: readonly WeightedMetric[], weightTotal: number): number {
  if (!savings || weightTotal <= 0) return 0;
  let impact = 0;
  for (const [acronym, saved] of Object.entries(savings)) {
    if (!saved) continue;
    const metric = metrics.find((candidate) => candidate.acronym === acronym);
    if (!metric || metric.score === null || !metric.numericValue || !metric.scoringOptions) continue;
    const improved = metricScore(metric.scoringOptions, metric.numericValue - saved);
    impact += (improved - metric.score) * metric.weight;
  }
  return (Math.max(0, impact) / weightTotal) * 100;
}
