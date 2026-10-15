import { describe, expect, it } from 'vitest';
import { buildAgenticReport } from '../../src/agentic/report';
import { categoryScore } from '../../src/lighthouse/lhr';
import { allFixItems, buildReportModel, fixNext, groupByStatus, statusLabel, worth } from '../../src/shared/report-model';
import { overallOf, type RunRecord } from '../../src/shared/run';
import { unadoptedEvidence } from '../helpers/evidence';
import { flawedDesktopLhr } from '../lighthouse/fixture';

function record(): RunRecord {
  const lighthouse = flawedDesktopLhr();
  const agentic = buildAgenticReport(unadoptedEvidence());
  const scores: RunRecord['scores'] = {
    performance: categoryScore(lighthouse, 'performance'),
    accessibility: categoryScore(lighthouse, 'accessibility'),
    'best-practices': categoryScore(lighthouse, 'best-practices'),
    seo: categoryScore(lighthouse, 'seo'),
    agentic: agentic.score.value,
  };
  return {
    id: 'run-1',
    url: lighthouse.finalDisplayedUrl,
    origin: new URL(lighthouse.finalDisplayedUrl).origin,
    startedAt: lighthouse.fetchTime,
    durationMs: 9_000,
    options: { formFactor: 'desktop', categories: ['performance', 'accessibility', 'best-practices', 'seo', 'agentic'] },
    scores,
    overall: overallOf(scores),
    agentic,
    lighthouse,
    errors: {},
    environment: { extensionVersion: '0.1.0', userAgent: 'test' },
  };
}

describe('buildReportModel with Lighthouse', () => {
  const model = buildReportModel(record());

  it('builds every category from its engine', () => {
    expect(model.categories.map((category) => [category.id, category.score, category.audits.length > 0])).toEqual([
      ['performance', 100, true],
      ['accessibility', 55, true],
      ['best-practices', 92, true],
      ['seo', 75, true],
      ['agentic', 80, true],
    ]);
    expect(model.categories[0]?.metrics).toHaveLength(5);
    expect(model.lighthouse?.formFactor).toBe('desktop');
  });

  it('puts the biggest wins first, across engines', () => {
    const next = fixNext(model);
    expect(next.slice(0, 3).map((audit) => audit.key)).toEqual(['agentic:B1', 'accessibility:button-name', 'accessibility:image-alt']);
    for (let index = 1; index < next.length; index++) expect(worth(next[index - 1]!)).toBeGreaterThanOrEqual(worth(next[index]!));
    expect(next.every((audit) => audit.fixItem)).toBe(true);
  });

  it('offers a fix prompt for every audit that needs work', () => {
    const needsWork = model.categories.flatMap((category) => category.audits).filter((audit) => audit.status === 'fail' || audit.status === 'partial');
    expect(needsWork.every((audit) => audit.fixItem)).toBe(true);
    expect(allFixItems(model, 'seo').map((item) => item.id).sort()).toEqual(['image-alt', 'link-text', 'meta-description']);
  });

  it('groups rows in the spec’s order', () => {
    const accessibility = model.categories.find((category) => category.id === 'accessibility');
    expect(groupByStatus(accessibility?.audits ?? []).map((group) => group.status)).toEqual(['fail', 'manual', 'pass', 'na']);
    const performance = model.categories.find((category) => category.id === 'performance');
    const statuses = groupByStatus(performance?.audits ?? []).map((group) => group.status);
    expect(statuses.indexOf('error')).toBeLessThan(statuses.indexOf('pass'));
  });

  it('calls Lighthouse’s in-between scores warnings', () => {
    expect(statusLabel('partial', 'performance')).toBe('Warnings');
    expect(statusLabel('partial', 'agentic')).toBe('Partial');
    expect(statusLabel('error', 'performance')).toBe('Could not run');
  });
});
