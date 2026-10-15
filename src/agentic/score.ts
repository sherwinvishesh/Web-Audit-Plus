import type { CheckResult, FixStep, Score, Status } from "./types";

/**
 * The 0-100 score, derived from OpenGEO's `test/score.js`, over the scored checks only.
 *
 * No letter grade. Three kinds of check stay outside the denominator, for different reasons: `na`
 * because the question does not apply here and never will (HSTS on localhost), `locked` because it
 * cannot be asked yet (no twin to read a Content-Type from), and a suggestion because it is a
 * convention the best-served sites have not adopted either, so not having it is not a defect. The
 * suggestions are counted separately so the report can say where the page stands on them.
 */
export function scoreChecks(results: readonly CheckResult[]): Score {
  let earned = 0;
  let possible = 0;
  const counts: Record<Status, number> = {
    pass: 0,
    partial: 0,
    fail: 0,
    locked: 0,
    na: 0,
  };
  const lost: Score["lost"] = [];
  const suggestions: Score["suggestions"] = {
    count: 0,
    adopted: 0,
    open: 0,
    locked: 0,
  };
  const lockedBy = new Set<string>();

  for (const result of results) {
    counts[result.status] += 1;
    if (result.status === "na") continue;
    if (result.status === "locked") {
      if (result.lockedBy) lockedBy.add(result.lockedBy);
      if (!result.scored) {
        suggestions.count += 1;
        suggestions.locked += 1;
      }
      continue;
    }
    if (!result.scored) {
      suggestions.count += 1;
      if (result.status === "pass") suggestions.adopted += 1;
      else suggestions.open += 1;
      continue;
    }
    possible += result.weight;
    earned += result.earned;
    // A partial contributes its shortfall, not its weight, so two points still available from a
    // partial never outrank the ten behind a check that earned nothing.
    if (result.status !== "pass")
      lost.push({ id: result.id, points: result.weight - result.earned });
  }

  // Rounded once, at the end: rounding each contribution would let a page of near-misses round its
  // way to a score it did not earn.
  const value = possible === 0 ? 0 : Math.round((earned / possible) * 100);
  return {
    value,
    earned: Math.round(earned),
    possible,
    counts,
    lost,
    suggestions,
    locked: { count: counts.locked, unlockedBy: [...lockedBy] },
  };
}

/**
 * How far the 0-100 headline moves if `recovered` check weight is earned back, all of it passing.
 * The scored weights total 61 and the headline is out of 100, so a weight is not a score point;
 * every price the report shows goes through here. Floored at 1 so a real gain never reads as "+0"
 * when rounding swallows it.
 */
export function scoreGain(score: Score, recovered: number): number {
  if (recovered <= 0) return 0;
  // `score.earned` is rounded for display; the unrounded figure is the denominator minus what is lost.
  const earned =
    score.possible - score.lost.reduce((sum, entry) => sum + entry.points, 0);
  const after =
    score.possible === 0
      ? 0
      : Math.round(((earned + recovered) / score.possible) * 100);
  return Math.max(1, after - score.value);
}

/** The price a check writes into its `fix`, in check weight, until `priceFixes` restates it. */
const PRICE = /\s*\(\+\d+\)/g;

/** Remove the "(+N)" price from a fix line. */
export function stripPrice(text: string): string {
  return text.replace(PRICE, "");
}

/**
 * Price every scored fail and partial in score points, and rewrite the "(+N)" its `fix` carries to
 * match. A suggestion's fix keeps its step and loses its price: adopting it moves no score. A locked
 * check's price is dropped too: nothing can be said about it until its blocker passes.
 */
export function priceFixes(
  checks: readonly CheckResult[],
  score: Score,
): CheckResult[] {
  return checks.map((check) => {
    if (
      !check.scored ||
      (check.status !== "fail" && check.status !== "partial")
    ) {
      return check.fix ? { ...check, fix: stripPrice(check.fix) } : check;
    }
    const price = scoreGain(score, check.weight - check.earned);
    const priced: CheckResult = { ...check, price };
    if (check.fix) priced.fix = check.fix.replace(PRICE, ` (+${price})`);
    return priced;
  });
}

/**
 * What to do next: the scored fixes ranked by score points recovered, most first, then the open
 * suggestions by weight, so the markdown twin (the one that unlocks the rest) leads them. Every step
 * is returned; the UI decides how many to show.
 */
export function fixSteps(
  checks: readonly CheckResult[],
  score: Score,
): FixStep[] {
  const byId = new Map(checks.map((check) => [check.id, check]));
  const unlocks = (id: string): number =>
    score.locked.unlockedBy.includes(id) ? score.locked.count : 0;

  const fixes: FixStep[] = score.lost.map((entry) => {
    const check = byId.get(entry.id);
    return {
      id: entry.id,
      points: scoreGain(score, entry.points),
      text: stripPrice(check?.fix ?? check?.title ?? entry.id),
      unlocks: unlocks(entry.id),
    };
  });
  fixes.sort((a, b) => b.points - a.points);

  const suggestions: FixStep[] = checks
    .filter(
      (check) =>
        !check.scored &&
        (check.status === "fail" || check.status === "partial"),
    )
    .sort((a, b) => b.weight - a.weight)
    .map((check) => {
      const count = unlocks(check.id);
      let text = stripPrice(check.fix ?? check.title);
      if (count > 0)
        text = `${text} That also makes ${count} more suggestion${count === 1 ? "" : "s"} measurable.`;
      return {
        id: check.id,
        points: 0,
        text,
        unlocks: count,
        suggestion: true,
      };
    });

  return [...fixes, ...suggestions];
}
