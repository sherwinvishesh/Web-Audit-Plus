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

  it('puts 46 points of weight behind the twin cascade', () => {
    expect(TWIN_LOCKED_IDS.reduce((sum, id) => sum + checkDefinition(id).weight, 0)).toBe(46);
    expect(TWIN_LOCKED_IDS).not.toContain('B1');
    expect(TWIN_LOCKED_IDS).not.toContain('B13');
  });
});

describe('the scale, measured against known sites (OpenGEO calibration)', () => {
  it('puts a site that does everything but the AI conventions at 80, losing exactly A2, A4 and B1', () => {
    const score = scoreChecks(runChecks(unadoptedEvidence()));
    expect(score.value).toBe(80);
    expect(score.lost.map((entry) => entry.id)).toEqual(['A2', 'A4', 'B1']);
  });

  it('gives the same site 100 once it serves a twin', () => {
    expect(scoreChecks(runChecks(goodEvidence())).value).toBe(100);
  });
});

describe('scoreChecks', () => {
  it('takes na and locked out of the denominator', () => {
    const score = scoreChecks([result('A1', 'pass'), result('A8', 'na'), result('B2', 'locked')]);
    expect(score.value).toBe(100);
    expect(score.possible).toBe(checkDefinition('A1').weight);
    expect(score.counts).toMatchObject({ pass: 1, na: 1, locked: 1 });
  });

  it('records a partial by its shortfall', () => {
    const score = scoreChecks([result('A1', 'partial', 6), result('A2', 'pass')]);
    expect(score.lost).toEqual([{ id: 'A1', points: 3 }]);
  });

  it('rounds once, at the end', () => {
    // Three checks at 2/3 each: rounding each to a whole percent first would drift.
    const parts = [result('A1', 'partial', 6), result('A3', 'partial', 6), result('B6', 'partial', 2)];
    const score = scoreChecks(parts);
    expect(score.value).toBe(Math.round((14 / 21) * 100));
  });

  it('is 0 when nothing can be scored', () => {
    expect(scoreChecks([]).value).toBe(0);
    expect(scoreChecks([result('A8', 'na')]).value).toBe(0);
  });

  it('prices a gain in score points, floored at 1', () => {
    const score = scoreChecks(CHECKS.map((check) => result(check.id, check.id === 'B12' ? 'fail' : 'pass')));
    expect(score.value).toBe(Math.round((120 / 122) * 100));
    expect(scoreGain(score, 2)).toBe(100 - score.value);
    expect(scoreGain(score, 0)).toBe(0);
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

  it('reports the locked block with its value measured after the blocker', () => {
    const score = scoreChecks(runChecks(unadoptedEvidence()));
    expect(score.locked.count).toBe(TWIN_LOCKED_IDS.length);
    expect(score.locked.points).toBe(46);
    expect(score.locked.unlockedBy).toEqual(['B1']);
    expect(score.locked.gain).toBeGreaterThan(0);
  });
});

describe('priceFixes and fixSteps', () => {
  it('rewrites each fix price in score points', () => {
    const results = runChecks(unadoptedEvidence());
    const score = scoreChecks(results);
    const priced = priceFixes(results, score);
    const a2 = priced.find((entry) => entry.id === 'A2');
    expect(a2?.price).toBe(scoreGain(score, 3));
    expect(a2?.fix).toContain(`(+${a2?.price})`);
    expect(stripPrice(a2?.fix ?? '')).not.toMatch(/\(\+\d+\)/);
  });

  it('ranks steps by points, the blocker carrying the block it unlocks', () => {
    const results = runChecks(unadoptedEvidence());
    const score = scoreChecks(results);
    const steps = fixSteps(priceFixes(results, score), score);
    expect(steps[0]?.id).toBe('B1');
    expect(steps[0]?.unlocks).toBe(TWIN_LOCKED_IDS.length);
    expect(steps[0]?.text).toMatch(/also unlocks 12 checks/);
    expect(steps.map((step) => step.points)).toEqual([...steps.map((step) => step.points)].sort((a, b) => b - a));
    for (const step of steps) expect(step.text).not.toMatch(/\(\+\d+\)/);
  });
});

describe('buildAgenticReport', () => {
  it('bundles score, priced checks, ranked fixes and probe summaries', () => {
    const report = buildAgenticReport(unadoptedEvidence());
    expect(report.url).toBe('https://example.com/resume');
    expect(report.score.value).toBe(80);
    expect(report.checks).toHaveLength(22);
    expect(report.fixes[0]?.id).toBe('B1');
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
