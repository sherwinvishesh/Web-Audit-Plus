import { describe, expect, it } from 'vitest';
import { allFixItems, buildReportModel, fixNext, groupByStatus, statusLabel, suggestions, worth } from '../../src/shared/report-model';
import { flawedRecord } from '../helpers/records';

const record = flawedRecord;

describe('buildReportModel with an engine result', () => {
  const model = buildReportModel(record());

  it('builds every category from its engine', () => {
    expect(model.categories.map((category) => [category.id, category.score, category.audits.length > 0])).toEqual([
      ['performance', 100, true],
      ['accessibility', 55, true],
      ['best-practices', 92, true],
      ['seo', 75, true],
      ['agentic', 100, true],
    ]);
    expect(model.categories[0]?.metrics).toHaveLength(5);
    expect(model.engine?.formFactor).toBe('desktop');
  });

  it('puts the biggest wins first, across engines', () => {
    const next = fixNext(model);
    expect(next.slice(0, 3).map((audit) => audit.key)).toEqual(['accessibility:button-name', 'accessibility:image-alt', 'accessibility:label']);
    for (let index = 1; index < next.length; index++) expect(worth(next[index - 1]!)).toBeGreaterThanOrEqual(worth(next[index]!));
    expect(next.every((audit) => audit.fixItem)).toBe(true);
    expect(next.some((audit) => audit.category === 'agentic')).toBe(false);
  });

  it('keeps the agent conventions as suggestions: listed with a fix, worth no points, the twin first', () => {
    const suggested = suggestions(model);
    expect(suggested.map((audit) => audit.key)).toEqual(['agentic:B1', 'agentic:A2', 'agentic:A4']);
    expect(suggested.every((audit) => audit.status === 'suggestion' && audit.points === 0 && audit.fixItem?.status === 'suggestion' && audit.fix)).toBe(true);
    const agentic = model.categories.find((category) => category.id === 'agentic');
    expect(agentic?.locked).toEqual({ count: 12, unlockedBy: ['B1'] });
    expect(groupByStatus(agentic?.audits ?? []).map((group) => `${group.status}:${group.audits.length}`)).toEqual(['suggestion:3', 'locked:12', 'pass:7']);
    expect(allFixItems(model, 'agentic').map((item) => item.status)).toEqual([...Array<string>(3).fill('suggestion'), ...Array<string>(12).fill('locked')]);
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

  it('calls in-between scores warnings', () => {
    expect(statusLabel('partial', 'performance')).toBe('Warnings');
    expect(statusLabel('partial', 'agentic')).toBe('Partial');
    expect(statusLabel('suggestion', 'agentic')).toBe('Suggestions');
    expect(statusLabel('error', 'performance')).toBe('Could not run');
  });
});
