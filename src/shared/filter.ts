import { stripCodeSpans } from '../agentic/quote';
import type { CategoryId } from './categories';
import type { AuditItem, AuditStatus } from './report-model';

/** The report's search box and its two filters. */

export type StatusFilter = 'all' | 'needs-work' | 'fail' | 'partial' | 'pass' | 'na' | 'other' | 'changed';

export interface AuditFilter {
  query: string;
  status: StatusFilter;
  category: CategoryId | 'all';
}

export const NO_FILTER: AuditFilter = { query: '', status: 'all', category: 'all' };

export function isFiltering(filter: AuditFilter): boolean {
  return filter.query.trim() !== '' || filter.status !== 'all' || filter.category !== 'all';
}

const STATUS_SETS: Readonly<Record<Exclude<StatusFilter, 'all' | 'changed'>, ReadonlySet<AuditStatus>>> = {
  'needs-work': new Set(['fail', 'partial']),
  fail: new Set(['fail']),
  partial: new Set(['partial']),
  pass: new Set(['pass']),
  na: new Set(['na']),
  other: new Set(['locked', 'info', 'manual', 'error']),
};

export function matchesStatus(audit: AuditItem, status: StatusFilter, changed?: ReadonlySet<string>): boolean {
  if (status === 'all') return true;
  if (status === 'changed') return changed?.has(audit.key) ?? false;
  return STATUS_SETS[status].has(audit.status);
}

/** Every word of the query must appear in the audit's id, title, group, value, finding or evidence. */
export function matchesQuery(audit: AuditItem, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [audit.id, audit.title, audit.group, audit.displayValue, audit.reason, audit.detail, ...(audit.evidence ?? [])]
    .filter((part): part is string => typeof part === 'string')
    .map((part) => stripCodeSpans(part))
    .join('\n')
    .toLowerCase();
  return words.every((word) => haystack.includes(word));
}

export function matchesFilter(audit: AuditItem, filter: AuditFilter, changed?: ReadonlySet<string>): boolean {
  return (filter.category === 'all' || audit.category === filter.category) && matchesStatus(audit, filter.status, changed) && matchesQuery(audit, filter.query);
}

export function filterAudits(audits: readonly AuditItem[], filter: AuditFilter, changed?: ReadonlySet<string>): AuditItem[] {
  return audits.filter((audit) => matchesFilter(audit, filter, changed));
}

export const STATUS_FILTER_LABEL: Readonly<Record<StatusFilter, string>> = {
  all: 'All statuses',
  'needs-work': 'Needs work',
  fail: 'Failed',
  partial: 'Partial or warning',
  pass: 'Passed',
  na: 'Not applicable',
  other: 'Locked or manual',
  changed: 'Changed',
};
