import type { CategoryId } from './categories';
import { worth, type AuditItem, type AuditStatus, type ReportModel } from './report-model';

/**
 * What changed between two runs of the same page: score deltas, and for each audit whether it is a
 * new problem, fixed, or better or worse than before. Only audits measured both times are compared;
 * one that was locked, errored or missing in either run has no change, rather than a made-up one.
 */

export type ChangeKind = 'new' | 'fixed' | 'regressed' | 'improved';

export const CHANGE_KINDS: readonly ChangeKind[] = ['fixed', 'improved', 'regressed', 'new'];

export const CHANGE_LABEL: Readonly<Record<ChangeKind, string>> = {
  new: 'New',
  fixed: 'Fixed',
  regressed: 'Worse',
  improved: 'Better',
};

export interface AuditChange {
  kind: ChangeKind;
  /** The audit's status in the earlier run. */
  before: AuditStatus;
  /** Its measured value then ("3.1 s"), when it had one. */
  beforeValue?: string;
}

export interface MetricChange {
  /** Current minus earlier, in the metric's unit. Lower is better for every lab metric. */
  delta: number;
  unit: 'ms' | 'unitless';
  before?: string;
}

export interface Comparison {
  previousId: string;
  previousStartedAt: string;
  /** Current minus earlier, for categories scored both times. */
  scores: Partial<Record<CategoryId, number>>;
  overall?: number;
  /** By audit key. Audits without a change are absent. */
  audits: Record<string, AuditChange>;
  /** By metric audit id. */
  metrics: Record<string, MetricChange>;
  counts: Record<ChangeKind, number>;
}

/** Movements smaller than these are noise, not a change: in an audit's own 0–1 score, or in points at stake. */
const SCORE_THRESHOLD = 0.05;
const POINTS_THRESHOLD = 1;
const METRIC_THRESHOLD: Readonly<Record<'ms' | 'unitless', number>> = { ms: 10, unitless: 0.001 };

const NEEDS_WORK: ReadonlySet<AuditStatus> = new Set(['fail', 'partial']);
const RESOLVED: ReadonlySet<AuditStatus> = new Set(['pass', 'na']);

export function compareModels(current: ReportModel, previous: ReportModel): Comparison {
  const comparison: Comparison = {
    previousId: previous.record.id,
    previousStartedAt: previous.record.startedAt,
    scores: {},
    audits: {},
    metrics: {},
    counts: { new: 0, fixed: 0, regressed: 0, improved: 0 },
  };

  for (const category of current.categories) {
    const before = previous.categories.find((candidate) => candidate.id === category.id);
    if (!before) continue;
    if (typeof category.score === 'number' && typeof before.score === 'number') comparison.scores[category.id] = category.score - before.score;
    if (before.error || category.error) continue;
    const earlier = new Map(before.audits.map((audit) => [audit.key, audit]));
    for (const audit of category.audits) {
      const then = earlier.get(audit.key);
      if (!then) continue;
      const kind = changeOf(audit, then);
      if (!kind) continue;
      const change: AuditChange = { kind, before: then.status };
      if (then.displayValue) change.beforeValue = then.displayValue;
      comparison.audits[audit.key] = change;
      comparison.counts[kind] += 1;
    }
    for (const metric of category.metrics ?? []) {
      const then = before.metrics?.find((candidate) => candidate.id === metric.id);
      if (metric.value === undefined || then?.value === undefined || !metric.unit || metric.unit !== then.unit) continue;
      const delta = metric.value - then.value;
      if (Math.abs(delta) < METRIC_THRESHOLD[metric.unit]) continue;
      const change: MetricChange = { delta, unit: metric.unit };
      if (then.displayValue) change.before = then.displayValue;
      comparison.metrics[metric.id] = change;
    }
  }

  if (typeof current.record.overall === 'number' && typeof previous.record.overall === 'number') {
    comparison.overall = current.record.overall - previous.record.overall;
  }
  return comparison;
}

function changeOf(now: AuditItem, then: AuditItem): ChangeKind | undefined {
  if (NEEDS_WORK.has(now.status)) {
    if (RESOLVED.has(then.status) || then.status === 'info' || then.status === 'manual') return 'new';
    if (!NEEDS_WORK.has(then.status)) return undefined;
    if (then.status === 'partial' && now.status === 'fail') return 'regressed';
    if (then.status === 'fail' && now.status === 'partial') return 'improved';
    if (now.score !== undefined && then.score !== undefined) {
      const moved = now.score - then.score;
      if (moved >= SCORE_THRESHOLD) return 'improved';
      if (moved <= -SCORE_THRESHOLD) return 'regressed';
      return undefined;
    }
    const moved = worth(now) - worth(then);
    if (moved >= POINTS_THRESHOLD) return 'regressed';
    if (moved <= -POINTS_THRESHOLD) return 'improved';
    return undefined;
  }
  if (RESOLVED.has(now.status) && NEEDS_WORK.has(then.status)) return 'fixed';
  return undefined;
}

/** "+3", "−2", "±0": a signed whole-number delta, with a real minus sign. */
export function signed(delta: number, digits = 0): string {
  const rounded = Number(delta.toFixed(digits));
  if (rounded === 0) return '±0';
  const text = Math.abs(rounded).toFixed(digits);
  return rounded > 0 ? `+${text}` : `−${text}`;
}

/** A metric delta in its own unit: "−1.2 s", "+40 ms", "+0.05". */
export function metricDelta(change: MetricChange): string {
  if (change.unit === 'unitless') return signed(change.delta, 3).replace(/0+$/, '').replace(/\.$/, '');
  const ms = Math.abs(change.delta);
  const sign = change.delta > 0 ? '+' : '−';
  if (ms < 1000) return `${sign}${Math.round(ms)} ms`;
  return `${sign}${(ms / 1000).toFixed(1)} s`;
}
