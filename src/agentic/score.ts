import type { CheckResult, FixStep, Score, Status } from './types';

/**
 * The 0-100 score, ported from OpenGEO's `test/score.js`.
 *
 * No letter grade. Two statuses are outside the denominator, for different reasons: `na` because
 * the question does not apply here and never will (HSTS on localhost), `locked` because it cannot
 * be asked yet (no twin to read a Content-Type from). Locked points are carried separately so the
 * report can say what is waiting behind the blocker.
 */
export function scoreChecks(results: readonly CheckResult[]): Score {
  let earned = 0;
  let possible = 0;
  const counts: Record<Status, number> = { pass: 0, partial: 0, fail: 0, locked: 0, na: 0 };
  const lost: Score['lost'] = [];
  const lockedBy = new Set<string>();
  let lockedPoints = 0;

  for (const result of results) {
    if (result.status === 'na') {
      counts.na += 1;
      continue;
    }
    if (result.status === 'locked') {
      counts.locked += 1;
      lockedPoints += result.weight;
      if (result.lockedBy) lockedBy.add(result.lockedBy);
      continue;
    }
    possible += result.weight;
    earned += result.earned;
    counts[result.status] += 1;
    // A partial contributes its shortfall, not its weight, so two points still available from a
    // partial never outrank the ten behind a check that earned nothing.
    if (result.status !== 'pass') lost.push({ id: result.id, points: result.weight - result.earned });
  }

  // Rounded once, at the end: rounding each contribution would let a page of near-misses round its
  // way to a score it did not earn.
  const value = possible === 0 ? 0 : Math.round((earned / possible) * 100);
  const score: Score = {
    value,
    earned: Math.round(earned),
    possible,
    counts,
    lost,
    locked: { count: counts.locked, points: lockedPoints, gain: 0, unlockedBy: [...lockedBy] },
  };
  // Measured from where the blocker's own fix leaves the score, since nothing is unlocked before it
  // passes. Otherwise the block and the blocker's line would each claim the same points.
  const blocker = lost.filter((entry) => lockedBy.has(entry.id)).reduce((sum, entry) => sum + entry.points, 0);
  score.locked.gain = lockedPoints === 0 ? 0 : Math.max(0, scoreGain(score, blocker, lockedPoints) - scoreGain(score, blocker));
  return score;
}

/**
 * How far the 0-100 headline moves if `recovered` check weight is earned back and `unlocked` locked
 * weight comes into the denominator, all of it passing. Weights total 122 and the headline is out of
 * 100, so a weight is not a score point; every price the report shows goes through here. Floored at
 * 1 so a real gain never reads as "+0" when rounding swallows it.
 */
export function scoreGain(score: Score, recovered: number, unlocked = 0): number {
  if (recovered <= 0 && unlocked <= 0) return 0;
  // `score.earned` is rounded for display; the unrounded figure is the denominator minus what is lost.
  const earned = score.possible - score.lost.reduce((sum, entry) => sum + entry.points, 0);
  const possible = score.possible + unlocked;
  const after = possible === 0 ? 0 : Math.round(((earned + recovered + unlocked) / possible) * 100);
  return Math.max(1, after - score.value);
}

/** The price a check writes into its `fix`, in check weight, until `priceFixes` restates it. */
const PRICE = /\s*\(\+\d+\)/g;

/** Remove the "(+N)" price from a fix line. */
export function stripPrice(text: string): string {
  return text.replace(PRICE, '');
}

/**
 * Price every fail and partial in score points, and rewrite the "(+N)" its `fix` carries to match.
 * A locked check's price is dropped: it is worth nothing until its blocker passes, and the blocker's
 * own step carries what unlocking it is worth.
 */
export function priceFixes(checks: readonly CheckResult[], score: Score): CheckResult[] {
  return checks.map((check) => {
    if (check.status !== 'fail' && check.status !== 'partial') {
      return check.fix ? { ...check, fix: stripPrice(check.fix) } : check;
    }
    const price = scoreGain(score, check.weight - check.earned);
    const priced: CheckResult = { ...check, price };
    if (check.fix) priced.fix = check.fix.replace(PRICE, ` (+${price})`);
    return priced;
  });
}

/**
 * What to do next, ranked by score points recovered, most first. A check that also holds the locked
 * block is worth its own points plus the block's, said once on the blocker's line rather than as two
 * separate ideas that are the same keystroke. Every step is returned; the UI decides how many to show.
 */
export function fixSteps(checks: readonly CheckResult[], score: Score): FixStep[] {
  const byId = new Map(checks.map((check) => [check.id, check]));
  const steps: FixStep[] = [];
  for (const entry of score.lost) {
    const check = byId.get(entry.id);
    let points = scoreGain(score, entry.points);
    let text = stripPrice(check?.fix ?? check?.title ?? entry.id);
    let unlocks = 0;
    if (score.locked.unlockedBy.includes(entry.id) && score.locked.count > 0) {
      points += score.locked.gain;
      unlocks = score.locked.count;
      text = `${text} That also unlocks ${unlocks} check${unlocks === 1 ? '' : 's'}, worth up to ${score.locked.gain} more points.`;
    }
    steps.push({ id: entry.id, points, text, unlocks });
  }
  // A locked block whose blocker is not itself in `lost` would otherwise go unmentioned.
  if (score.locked.points > 0 && !score.locked.unlockedBy.some((id) => score.lost.some((entry) => entry.id === id))) {
    steps.push({
      id: score.locked.unlockedBy[0] ?? 'locked',
      points: score.locked.gain,
      text: `Serve the markdown twin, which unlocks ${score.locked.count} more checks.`,
      unlocks: score.locked.count,
    });
  }
  return steps.sort((a, b) => b.points - a.points);
}
