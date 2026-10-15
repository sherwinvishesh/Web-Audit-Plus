import type { AgenticReport } from '../agentic/types';
import { CATEGORY_IDS, isCategoryId, overallScore, type CategoryId } from './categories';

/**
 * The run schema: what an audit was asked to do, how it is going, and what it found. Everything here
 * is plain JSON, because it crosses message ports and is persisted.
 */

export type FormFactor = 'desktop' | 'mobile';

export interface RunOptions {
  formFactor: FormFactor;
  /** In display order. Never empty. */
  categories: CategoryId[];
}

export const DEFAULT_RUN_OPTIONS: RunOptions = { formFactor: 'desktop', categories: [...CATEGORY_IDS] };

/** Validate options that arrived over a port or from storage, falling back to the defaults. */
export function normalizeRunOptions(value: unknown): RunOptions {
  if (!value || typeof value !== 'object') return { ...DEFAULT_RUN_OPTIONS, categories: [...DEFAULT_RUN_OPTIONS.categories] };
  const record = value as { formFactor?: unknown; categories?: unknown };
  const formFactor: FormFactor = record.formFactor === 'mobile' ? 'mobile' : 'desktop';
  const requested = Array.isArray(record.categories) ? record.categories.filter(isCategoryId) : [];
  const categories = CATEGORY_IDS.filter((id) => requested.includes(id));
  return { formFactor, categories: categories.length > 0 ? categories : [...CATEGORY_IDS] };
}

export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

/** One line in the live progress log. */
export interface RunStep {
  id: string;
  group: 'agentic' | 'lighthouse';
  label: string;
  status: StepStatus;
  /** A short result: "200 · 84 ms", or why it failed. */
  detail?: string;
}

export type RunPhase = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

/** The live state of one tab's run, broadcast on every change. */
export interface RunState {
  runId: string;
  tabId: number;
  url: string;
  options: RunOptions;
  phase: RunPhase;
  /** Epoch ms. */
  startedAt: number;
  finishedAt?: number;
  steps: RunStep[];
  /** Scores as they arrive; null for a category that ran but could not be scored. */
  scores: Partial<Record<CategoryId, number | null>>;
  /** Why the whole run failed or was cancelled. */
  error?: string;
  /** Category-level problems in a run that otherwise finished. */
  warnings: string[];
  /** Set once the run is saved: the report page can open it. */
  saved?: boolean;
}

export function isFinished(phase: RunPhase): boolean {
  return phase === 'done' || phase === 'failed' || phase === 'cancelled';
}

/** A saved audit. The report page renders one of these and nothing else. */
export interface RunRecord {
  id: string;
  url: string;
  origin: string;
  /** ISO timestamp. */
  startedAt: string;
  durationMs: number;
  options: RunOptions;
  scores: Partial<Record<CategoryId, number | null>>;
  overall: number | null;
  agentic?: AgenticReport;
  /** Per-category failures, for categories that were asked for but produced nothing. */
  errors: Partial<Record<CategoryId, string>>;
  environment: { extensionVersion: string; userAgent: string };
}

/** The small part of a record that history lists need. */
export interface RunSummary {
  id: string;
  url: string;
  origin: string;
  startedAt: string;
  formFactor: FormFactor;
  scores: Partial<Record<CategoryId, number | null>>;
  overall: number | null;
}

export function summarize(record: RunRecord): RunSummary {
  return {
    id: record.id,
    url: record.url,
    origin: record.origin,
    startedAt: record.startedAt,
    formFactor: record.options.formFactor,
    scores: record.scores,
    overall: record.overall,
  };
}

/** The overall score of a record's categories, in display order. */
export function overallOf(scores: RunRecord['scores']): number | null {
  return overallScore(CATEGORY_IDS.map((id) => scores[id]));
}

/** A sortable, unique-enough run id: time first, so ids order like their runs. */
export function newRunId(now: number, random: () => number = Math.random): string {
  const suffix = Math.floor(random() * 36 ** 6)
    .toString(36)
    .padStart(6, '0');
  return `${now.toString(36)}-${suffix}`;
}
