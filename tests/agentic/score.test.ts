import { describe, expect, it } from 'vitest';
import { CHECKS, checkDefinition, collapseTwinCascade, runChecks, TWIN_LOCKED_IDS } from '../../src/agentic/checks';
import { buildAgenticReport } from '../../src/agentic/report';
import { fixSteps, priceFixes, scoreChecks, scoreGain, stripPrice } from '../../src/agentic/score';
import type { CheckResult } from '../../src/agentic/types';
import { goodEvidence, unadoptedEvidence } from '../helpers/evidence';

function result(id: string, status: CheckResult['status'], earned?: number): CheckResult {
  const definition = checkDefinition(id);
  return { ...definition, status, earned: earned ?? (status === 'pass' ? definition.weight : 0), reason: 'r' };
}

describe('the weight table', () => {
  const weight = (category: 'A' | 'B'): number => CHECKS.filter((check) => check.category === category).reduce((sum, check) => sum + check.weight, 0);

  it('totals 122: A 57, B 65', () => {
    expect(weight('A')).toBe(57);
    expect(weight('B')).toBe(65);
  });

  it('scores what agents need today, 61 points over seven checks, and keeps the other 61 as suggestions', () => {
    const scored = CHECKS.filter((check) => check.scored);
    expect(scored.map((check) => check.id)).toEqual(['A1', 'A3', 'A5', 'A6', 'A7', 'A8', 'B13']);
    expect(scored.reduce((sum, check) => sum + check.weight, 0)).toBe(61);
    expect(CHECKS.filter((check) => !check.scored).reduce((sum, check) => sum + check.weight, 0)).toBe(61);
    // The conventions: llms.txt, structured data, and the whole markdown-twin layer.
    expect(CHECKS.filter((check) => !check.scored).map((check) => check.id)).toEqual(['A2', 'A4', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B14']);
  });

  it('has 22 unique ids in report order', () => {
    expect(CHECKS.map((check) => check.id)).toEqual([
      'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8',
      'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14',
    ]);
  });

  it('leaves the markdown twin as the only double-digit weight', () => {
    const heaviest = [...CHECKS].sort((a, b) => b.weight - a.weight);
    expect(heaviest[0]?.id).toBe('B1');
    expect(heaviest.slice(1).every((check) => check.weight < 10)).toBe(true);
  });

  it('puts 46 points of weight behind the twin cascade, all of it suggestions', () => {
    expect(TWIN_LOCKED_IDS.reduce((sum, id) => sum + checkDefinition(id).weight, 0)).toBe(46);
    expect(TWIN_LOCKED_IDS.every((id) => !checkDefinition(id).scored)).toBe(true);
    expect(TWIN_LOCKED_IDS).not.toContain('B1');
    expect(TWIN_LOCKED_IDS).not.toContain('B13');
  });
});

describe('the scale, measured against known sites', () => {
  it('puts a site that does what the leading AI sites do at 100, with A2, A4 and B1 left as suggestions', () => {
    // openai.com and anthropic.com: crawlable, fast, HTTPS, content in the HTML, no llms.txt, no
    // JSON-LD, no markdown twin. OpenGSO scores that 80; here it is the top of the scale.
    const score = scoreChecks(runChecks(unadoptedEvidence()));
    expect(score.value).toBe(100);
    expect(score.lost).toEqual([]);
    expect(score.suggestions).toEqual({ count: 15, adopted: 0, open: 3, locked: 12 });
    expect(score.counts).toEqual({ pass: 7, partial: 0, fail: 3, locked: 12, na: 0 });
  });

  it('gives the same site 100 once it serves a twin, with every suggestion adopted', () => {
    const score = scoreChecks(runChecks(goodEvidence()));
    expect(score.value).toBe(100);
    expect(score.suggestions).toEqual({ count: 15, adopted: 15, open: 0, locked: 0 });
  });

  it('drops below 100 only for what agents need today', () => {
    const results = runChecks(unadoptedEvidence()).map((entry) => (entry.id === 'A6' ? { ...entry, status: 'fail' as const, earned: 0 } : entry));
    const score = scoreChecks(results);
    expect(score.value).toBe(Math.round((53 / 61) * 100));
    expect(score.lost).toEqual([{ id: 'A6', points: 8 }]);
  });
});

describe('scoreChecks', () => {
  it('takes na, locked and the suggestions out of the denominator', () => {
    const score = scoreChecks([result('A1', 'pass'), result('A8', 'na'), result('B2', 'locked'), result('A2', 'fail')]);
    expect(score.value).toBe(100);
    expect(score.possible).toBe(checkDefinition('A1').weight);
    expect(score.counts).toMatchObject({ pass: 1, na: 1, locked: 1, fail: 1 });
    expect(score.suggestions).toEqual({ count: 2, adopted: 0, open: 1, locked: 1 });
    expect(score.locked).toEqual({ count: 1, unlockedBy: [] });
  });

  it('counts a passing suggestion as adopted and a partial one as open', () => {
    const score = scoreChecks([result('A1', 'pass'), result('A2', 'pass'), result('A4', 'partial', 1)]);
    expect(score.suggestions).toEqual({ count: 2, adopted: 1, open: 1, locked: 0 });
    expect(score.lost).toEqual([]);
  });

  it('records a partial by its shortfall', () => {
    const score = scoreChecks([result('A1', 'partial', 6), result('A3', 'pass')]);
    expect(score.lost).toEqual([{ id: 'A1', points: 3 }]);
  });

  it('rounds once, at the end', () => {
    // Three checks at 2/3 each: rounding each to a whole percent first would drift.
    const parts = [result('A1', 'partial', 6), result('A3', 'partial', 6), result('B13', 'partial', 6)];
    const score = scoreChecks(parts);
    expect(score.value).toBe(Math.round((18 / 27) * 100));
  });

  it('is 0 when nothing can be scored', () => {
    expect(scoreChecks([]).value).toBe(0);
    expect(scoreChecks([result('A8', 'na')]).value).toBe(0);
  });

  it('prices a gain in score points, floored at 1', () => {
    const score = scoreChecks(CHECKS.map((check) => result(check.id, check.id === 'B13' ? 'fail' : 'pass')));
    expect(score.value).toBe(Math.round((52 / 61) * 100));
    expect(scoreGain(score, 9)).toBe(100 - score.value);
    expect(scoreGain(score, 0)).toBe(0);
    // A tiny shortfall that rounding would swallow still prices as a point.
    const near = scoreChecks(CHECKS.map((check) => (check.id === 'A6' ? result(check.id, 'partial', 7.9) : result(check.id, 'pass'))));
    expect(scoreGain(near, 0.1)).toBe(1);
  });

  it('is unmoved by a suggestion the page has not adopted', () => {
    const score = scoreChecks(CHECKS.map((check) => result(check.id, check.id === 'B12' ? 'fail' : 'pass')));
    expect(score.value).toBe(100);
    expect(score.suggestions.open).toBe(1);
  });
});

describe('the twin cascade', () => {
  it('locks everything that reads the twin behind B1, once', () => {
    const results = runChecks(unadoptedEvidence());
    const locked = results.filter((entry) => entry.status === 'locked');
    expect(locked.map((entry) => entry.id).sort()).toEqual([...TWIN_LOCKED_IDS].sort());
    for (const entry of locked) {
      expect(entry.lockedBy).toBe('B1');
      expect(entry.fix).toBeUndefined();
      expect(entry.price).toBeUndefined();
      expect(entry.reason).toMatch(/scored once, on B1/);
    }
  });

  it('keeps a live-URL pass (Accept negotiation without a .md file)', () => {
    const e = unadoptedEvidence();
    const good = goodEvidence();
    const results = runChecks({ ...e, acceptMarkdown: good.acceptMarkdown });
    expect(results.find((entry) => entry.id === 'B9')?.status).toBe('pass');
  });

  it('keeps what the live URL said as detail', () => {
    const e = unadoptedEvidence();
    const results = runChecks(e);
    expect(results.find((entry) => entry.id === 'B10')?.detail).toMatch(/GPTBot/);
  });

  it('does nothing when the twin is served', () => {
    const results = CHECKS.map((check) => check.run(goodEvidence()));
    expect(collapseTwinCascade(results, goodEvidence())).toBe(results);
  });

  it('reports the locked block as suggestions waiting on the blocker', () => {
    const score = scoreChecks(runChecks(unadoptedEvidence()));
    expect(score.locked).toEqual({ count: TWIN_LOCKED_IDS.length, unlockedBy: ['B1'] });
    expect(score.suggestions.locked).toBe(TWIN_LOCKED_IDS.length);
  });
});

describe('priceFixes and fixSteps', () => {
  /** The unadopted site with A6 failing too: one scored fix next to the three open suggestions. */
  function slowUnadopted(): CheckResult[] {
    return runChecks(unadoptedEvidence()).map((entry) => (entry.id === 'A6' ? { ...entry, status: 'fail' as const, earned: 0, fix: 'Cut the time to first byte (+8).' } : entry));
  }

  it('rewrites each scored fix price in score points, and strips the price from a suggestion', () => {
    const results = slowUnadopted();
    const score = scoreChecks(results);
    const priced = priceFixes(results, score);
    const a6 = priced.find((entry) => entry.id === 'A6');
    expect(a6?.price).toBe(scoreGain(score, 8));
    expect(a6?.fix).toBe(`Cut the time to first byte (+${a6?.price}).`);
    expect(stripPrice(a6?.fix ?? '')).not.toMatch(/\(\+\d+\)/);
    const a2 = priced.find((entry) => entry.id === 'A2');
    expect(a2?.price).toBeUndefined();
    expect(a2?.fix).not.toMatch(/\(\+\d+\)/);
    expect(a2?.fix).toMatch(/llms\.txt/);
  });

  it('ranks the scored steps by points, then the suggestions by weight, the twin naming what it makes measurable', () => {
    const results = slowUnadopted();
    const score = scoreChecks(results);
    const steps = fixSteps(priceFixes(results, score), score);
    expect(steps.map((step) => step.id)).toEqual(['A6', 'B1', 'A2', 'A4']);
    expect(steps[0]).toMatchObject({ points: 100 - score.value, unlocks: 0 });
    expect(steps[0]?.suggestion).toBeUndefined();
    expect(steps[1]).toMatchObject({ id: 'B1', points: 0, unlocks: TWIN_LOCKED_IDS.length, suggestion: true });
    expect(steps[1]?.text).toMatch(/That also makes 12 more suggestions measurable\.$/);
    expect(steps.slice(2).every((step) => step.points === 0 && step.suggestion && step.unlocks === 0)).toBe(true);
    for (const step of steps) expect(step.text).not.toMatch(/\(\+\d+\)/);
  });

  it('lists only suggestions for a site that does what the leaders do', () => {
    const results = runChecks(unadoptedEvidence());
    const steps = fixSteps(results, scoreChecks(results));
    expect(steps.map((step) => step.id)).toEqual(['B1', 'A2', 'A4']);
    expect(steps.every((step) => step.suggestion && step.points === 0)).toBe(true);
  });
});

describe('buildAgenticReport', () => {
  it('bundles score, priced checks, ranked fixes and probe summaries', () => {
    const report = buildAgenticReport(unadoptedEvidence());
    expect(report.url).toBe('https://example.com/resume');
    expect(report.score.value).toBe(100);
    expect(report.checks).toHaveLength(22);
    expect(report.checks.every((check) => typeof check.scored === 'boolean')).toBe(true);
    expect(report.fixes[0]).toMatchObject({ id: 'B1', suggestion: true, points: 0 });
    expect(report.probes.map((entry) => entry.label)).toEqual(['html', 'robots', 'llms', 'sitemap', 'twin', 'acceptMarkdown', 'botUa', 'notAcceptable']);
    expect(report.framework?.id).toBe('plain');
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });

  it('counts probe bytes as UTF-8', () => {
    const e = goodEvidence();
    const report = buildAgenticReport({ ...e, robots: { ...e.robots, body: 'é' } });
    expect(report.probes.find((entry) => entry.label === 'robots')?.bytes).toBe(2);
  });
});
