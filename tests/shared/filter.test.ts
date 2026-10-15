import { describe, expect, it } from 'vitest';
import { filterAudits, isFiltering, matchesQuery, NO_FILTER } from '../../src/shared/filter';
import { buildReportModel } from '../../src/shared/report-model';
import { flawedRecord } from '../helpers/records';

const audits = buildReportModel(flawedRecord()).categories.flatMap((category) => category.audits);
const keys = (filter: Partial<typeof NO_FILTER>, changed?: ReadonlySet<string>): string[] =>
  filterAudits(audits, { ...NO_FILTER, ...filter }, changed).map((audit) => audit.key);

describe('filterAudits', () => {
  it('lets everything through with no filter', () => {
    expect(keys({})).toHaveLength(audits.length);
    expect(isFiltering(NO_FILTER)).toBe(false);
    expect(isFiltering({ ...NO_FILTER, query: '  ' })).toBe(false);
    expect(isFiltering({ ...NO_FILTER, status: 'fail' })).toBe(true);
  });

  it('finds audits by title, id, group and finding, every word', () => {
    expect(keys({ query: 'image alt' })).toEqual(['accessibility:image-alt', 'accessibility:input-image-alt', 'accessibility:image-redundant-alt', 'seo:image-alt']);
    expect(keys({ query: 'image alt', status: 'fail' })).toEqual(['accessibility:image-alt', 'seo:image-alt']);
    expect(keys({ query: 'HTML-HAS-LANG' })).toEqual(['accessibility:html-has-lang']);
    expect(keys({ query: 'names labels', category: 'accessibility', status: 'fail' })).toEqual(
      expect.arrayContaining(['accessibility:button-name', 'accessibility:image-alt', 'accessibility:label']),
    );
    expect(keys({ query: 'no such audit anywhere' })).toEqual([]);
  });

  it('searches what was quoted from the site, not the code fences around it', () => {
    const audit = { key: 'x:y', category: 'seo' as const, id: 'y', title: 'Y', status: 'fail' as const, points: 1, evidence: ['`` <img src="/hero.png"> ``'] };
    expect(matchesQuery(audit, 'hero.png')).toBe(true);
    expect(matchesQuery(audit, '``')).toBe(false);
  });

  it('filters by status and category', () => {
    const failing = keys({ status: 'needs-work', category: 'seo' });
    expect(failing.sort()).toEqual(['seo:image-alt', 'seo:link-text', 'seo:meta-description']);
    expect(keys({ status: 'pass', category: 'agentic' }).every((key) => key.startsWith('agentic:'))).toBe(true);
    expect(keys({ status: 'other', category: 'agentic' }).length).toBeGreaterThan(0);
  });

  it('shows only changed audits when asked, and none without a comparison', () => {
    expect(keys({ status: 'changed' })).toEqual([]);
    expect(keys({ status: 'changed' }, new Set(['seo:image-alt']))).toEqual(['seo:image-alt']);
  });
});
