import { agenticFixItem, needsWork } from '../agentic/fix-items';
import { placementFor } from '../agentic/remedies';
import { stripPrice } from '../agentic/score';
import type { AgenticReport } from '../agentic/types';
import { WHY } from '../agentic/why';
import { lighthouseAudits, lighthouseMeta, lighthouseMetrics, type LighthouseMeta, type MetricView } from '../lighthouse/normalize';
import { CATEGORY_IDS, CATEGORY_TITLES, type CategoryId } from './categories';
import type { FixPromptContext, FixPromptItem } from './fix-prompt';
import type { RunRecord } from './run';

/**
 * The report as the UI sees it: every category reduced to the same rows, whichever engine produced
 * it. The side panel, the report page, the exports and the fix prompts all read this, so they never
 * disagree about what failed or what it is worth.
 */

export type AuditStatus = 'fail' | 'partial' | 'error' | 'locked' | 'info' | 'manual' | 'pass' | 'na';

/** Display order of the status groups: what needs work first, then what passed, then what did not apply. */
export const STATUS_ORDER: readonly AuditStatus[] = ['fail', 'partial', 'error', 'locked', 'info', 'manual', 'pass', 'na'];

export interface AuditItem {
  /** Unique across the report: `${category}:${id}`. */
  key: string;
  category: CategoryId;
  id: string;
  title: string;
  status: AuditStatus;
  /** Points this audit would add to its category score if it passed. 0 when unknown. */
  points: number;
  /** The audit's own score from 0 to 1 (Lighthouse's, or earned over weight for Agentic), when it has one. */
  score?: number;
  /**
   * For an unweighted Performance insight or diagnostic: Lighthouse's estimate of the Performance
   * points its savings would recover, through the metrics they improve. Estimates overlap with each
   * other and with the metrics' own points, so they rank work but are never added up.
   */
  impact?: number;
  /** What was found. Markdown-lite: prose plus code spans quoting the site. */
  reason?: string;
  detail?: string;
  /** Why it matters. Our own text, or Lighthouse's. */
  why?: string;
  /** The specific next step, markdown-lite. */
  fix?: string;
  /** A measured value to show beside the title ("1.2 s", "3 elements"). */
  displayValue?: string;
  /** For a partial, how far it got, in the audit's own units. */
  earned?: number;
  weight?: number;
  lockedBy?: string;
  /** Documentation for this audit. Always a URL we wrote or Lighthouse ships, never one from the site. */
  learnMore?: string;
  /** One line per flagged element, request or location (Lighthouse audits), markdown-lite. */
  evidence?: string[];
  /** How many there were in all; `evidence` holds at most ten. */
  evidenceTotal?: number;
  /** The Lighthouse group the audit belongs to ("Names and labels"). */
  group?: string;
  /** Framework-specific advice from Lighthouse's stack packs, when it detected a known stack. */
  stackNotes?: Array<{ title: string; text: string }>;
  /** Present when the audit needs work. */
  fixItem?: FixPromptItem;
}

export interface CategoryView {
  id: CategoryId;
  title: string;
  score: number | null;
  /** Why the category produced no score. */
  error?: string;
  audits: AuditItem[];
  /** Checks waiting on a prerequisite, shown as one line. */
  locked?: { count: number; gain: number; unlockedBy: string[] };
  /** Performance only: the lab metrics. */
  metrics?: MetricView[];
}

export interface ReportModel {
  record: RunRecord;
  categories: CategoryView[];
  context: FixPromptContext;
  /** How Lighthouse ran, when it did. */
  lighthouse?: LighthouseMeta;
}

export function buildReportModel(record: RunRecord): ReportModel {
  const categories: CategoryView[] = record.options.categories.map((id) => categoryView(record, id));
  const framework = record.agentic?.framework;
  const context: FixPromptContext = {
    url: record.url,
    framework: framework ? { name: framework.name, evidence: framework.evidence } : undefined,
    overall: record.overall,
    categories: categories.map((category) => ({ id: category.id, score: category.score })),
    placement: placementFor(framework),
  };
  const model: ReportModel = { record, categories, context };
  if (record.lighthouse) model.lighthouse = lighthouseMeta(record.lighthouse);
  return model;
}

function categoryView(record: RunRecord, id: CategoryId): CategoryView {
  const view: CategoryView = { id, title: CATEGORY_TITLES[id], score: record.scores[id] ?? null, audits: [] };
  const error = record.errors[id];
  if (error) view.error = error;
  if (id === 'agentic' && record.agentic) {
    view.audits = agenticAudits(record.agentic);
    const { locked } = record.agentic.score;
    if (locked.count > 0) view.locked = { count: locked.count, gain: locked.gain, unlockedBy: locked.unlockedBy };
  } else if (id !== 'agentic' && record.lighthouse) {
    view.audits = lighthouseAudits(record.lighthouse, id);
    if (id === 'performance') view.metrics = lighthouseMetrics(record.lighthouse);
  }
  return view;
}

export function agenticAudits(report: AgenticReport): AuditItem[] {
  return report.checks.map((check) => {
    const audit: AuditItem = {
      key: `agentic:${check.id}`,
      category: 'agentic',
      id: check.id,
      title: check.title,
      status: check.status,
      points: check.status === 'fail' || check.status === 'partial' ? (check.price ?? 0) : 0,
      reason: check.reason,
      earned: check.earned,
      weight: check.weight,
    };
    if (check.weight > 0 && (check.status === 'pass' || check.status === 'partial' || check.status === 'fail')) audit.score = check.earned / check.weight;
    if (check.detail) audit.detail = check.detail;
    if (check.fix) audit.fix = stripPrice(check.fix);
    if (check.lockedBy) audit.lockedBy = check.lockedBy;
    const why = WHY[check.id];
    if (why) audit.why = why;
    if (needsWork(check)) audit.fixItem = agenticFixItem(check, report.twinUrl);
    return audit;
  });
}

/** Everything that needs work and would raise a score, across categories, most points first. */
export function fixNext(model: ReportModel): AuditItem[] {
  return model.categories
    .flatMap((category) => category.audits)
    .filter((audit) => (audit.status === 'fail' || audit.status === 'partial') && audit.fixItem)
    .sort((a, b) => worth(b) - worth(a) || statusRank(a.status) - statusRank(b.status) || CATEGORY_IDS.indexOf(a.category) - CATEGORY_IDS.indexOf(b.category));
}

/** What fixing an audit is worth, for ordering: its points, or failing those its estimated impact. */
export function worth(audit: Pick<AuditItem, 'points' | 'impact'>): number {
  return audit.points > 0 ? audit.points : (audit.impact ?? 0);
}

function statusRank(status: AuditStatus): number {
  return STATUS_ORDER.indexOf(status);
}

/** Every fix-prompt item in the report: actionable ones by points, then locked ones. */
export function allFixItems(model: ReportModel, category?: CategoryId): FixPromptItem[] {
  return model.categories
    .filter((view) => category === undefined || view.id === category)
    .flatMap((view) => view.audits)
    .map((audit) => audit.fixItem)
    .filter((item): item is FixPromptItem => item !== undefined)
    .sort((a, b) => worth(b) - worth(a));
}

/** Audits grouped by status, in display order, empty groups dropped. */
export function groupByStatus(audits: readonly AuditItem[]): Array<{ status: AuditStatus; audits: AuditItem[] }> {
  return STATUS_ORDER.map((status) => ({
    status,
    audits: audits.filter((audit) => audit.status === status).sort((a, b) => worth(b) - worth(a)),
  })).filter((group) => group.audits.length > 0);
}

export const STATUS_LABEL: Readonly<Record<AuditStatus, string>> = {
  fail: 'Failed',
  partial: 'Partial',
  error: 'Could not run',
  locked: 'Locked',
  info: 'Diagnostics',
  manual: 'Check manually',
  pass: 'Passed',
  na: 'Not applicable',
};

/** A status group's heading. Lighthouse's in-between scores are warnings, not partial passes. */
export function statusLabel(status: AuditStatus, category: CategoryId): string {
  if (status === 'partial' && category !== 'agentic') return 'Warnings';
  return STATUS_LABEL[status];
}
