import { codeSpan } from '../quote';
import type { AgenticCheck, CheckDefinition, CheckResult, Evidence } from '../types';

/**
 * Building blocks for check results, ported from OpenGEO's `test/checks.js`.
 *
 * Text conventions: `reason`, `detail` and `fix` are prose plus inline code spans. A value that came
 * from the audited site goes through `q()` (an inert single-line code span), never into a template
 * by hand. Backticks typed in a check's own prose are reserved for our literal snippets (header
 * names, config lines) and never wrap an interpolated site value.
 *
 * A `fix` carries its price as "(+N)" in check weight. `priceFixes` restates it in score points once
 * the run is scored, because a check cannot know the denominator.
 */

/**
 * A registry entry. `run` receives its own definition, so a check never has to restate its id or
 * weight, and the function stays safe to pass around unbound.
 */
export function defineCheck(definition: CheckDefinition, run: (e: Evidence, self: CheckDefinition) => CheckResult): AgenticCheck {
  const frozen = Object.freeze({ ...definition });
  return { ...frozen, run: (e) => run(e, frozen) };
}

/** Quote a site-provided value. */
export const q = codeSpan;

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** `a`, `a and b`, `a, b and c`. */
export function list(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function definitionOf(check: CheckDefinition): CheckDefinition {
  return { id: check.id, category: check.category, scored: check.scored, required: check.required, weight: check.weight, title: check.title };
}

export interface ResultOptions {
  detail?: string | undefined;
  fix?: string | undefined;
}

function withOptions(result: CheckResult, options: ResultOptions): CheckResult {
  if (options.detail) result.detail = options.detail;
  if (options.fix) result.fix = options.fix;
  return result;
}

export function pass(check: CheckDefinition, reason: string, detail?: string): CheckResult {
  return withOptions({ ...definitionOf(check), status: 'pass', earned: check.weight, reason }, { detail });
}

export function fail(check: CheckDefinition, reason: string, options: ResultOptions = {}): CheckResult {
  return withOptions({ ...definitionOf(check), status: 'fail', earned: 0, reason }, options);
}

/**
 * Some of the way there. `earned` is clamped into `1..weight - 1`: a partial worth zero is a
 * failure wearing a friendlier word, and one worth full marks is a pass. A "(+N)" in `fix` is
 * restated from the clamped value so a ramp's rounding can never print "(+0)".
 */
export function partial(check: CheckDefinition, earned: number, reason: string, options: ResultOptions = {}): CheckResult {
  const bounded = Math.min(check.weight - 1, Math.max(1, Math.round(earned)));
  const fix = options.fix?.replace(/\(\+\d+\)/g, `(+${check.weight - bounded})`);
  return withOptions({ ...definitionOf(check), status: 'partial', earned: bounded, reason }, { detail: options.detail, fix });
}

/** Cannot be measured until `by` passes. Out of the denominator, and priced as one block by the scorer. */
export function locked(check: CheckDefinition, by: string, reason: string, detail?: string): CheckResult {
  return withOptions({ ...definitionOf(check), status: 'locked', earned: 0, reason, lockedBy: by }, { detail });
}

/** Genuinely cannot apply here, ever (HSTS on localhost). Out of the denominator. */
export function na(check: CheckDefinition, reason: string, detail?: string): CheckResult {
  return withOptions({ ...definitionOf(check), status: 'na', earned: 0, reason }, { detail });
}

/**
 * A linear ramp between a floor and a target, in points: the full weight at or past `target`, zero
 * at or below `floor`, proportional in between. The caller decides whether zero means fail or partial.
 */
export function ramp(value: number, floor: number, target: number, weight: number): number {
  if (target === floor) return value >= target ? weight : 0;
  const ratio = (value - floor) / (target - floor);
  return Math.max(0, Math.min(weight, ratio * weight));
}

/** "HTTP 404", or "no response" when the request never produced one. */
export function httpStatus(status: number): string {
  return status ? `HTTP ${status}` : 'no response';
}
