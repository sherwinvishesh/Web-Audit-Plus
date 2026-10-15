import type { AgenticReport } from '../../agentic/types';
import type { EngineResult } from '../../engine/result';
import type { CategoryId } from '../../shared/categories';
import { newRunId, overallOf, type RunOptions, type RunRecord, type RunState, type RunStep } from '../../shared/run';
import { auditability } from '../../shared/url-policy';

/** What one run produces before it is saved. */
export interface RunResult {
  agentic?: AgenticReport;
  engine?: EngineResult;
  errors: Partial<Record<CategoryId, string>>;
}

/** Everything a run's executor can do: report progress, post scores, and notice cancellation. */
export interface RunJob {
  runId: string;
  tabId: number;
  url: string;
  options: RunOptions;
  signal: AbortSignal;
  /** Add a progress step, or replace the one with the same id. */
  step(step: RunStep): void;
  score(category: CategoryId, value: number | null): void;
  warn(message: string): void;
  /** End the run from inside, for reasons Chrome reports (debugger cancelled, tab closed). */
  abort(reason: string): void;
}

export interface RunManagerDeps {
  tabUrl(tabId: number): Promise<string | undefined>;
  /** Draw the full plan up front, so the log shows every step before it runs. */
  plan(options: RunOptions): RunStep[];
  execute(job: RunJob): Promise<RunResult>;
  save(record: RunRecord): Promise<void>;
  environment: RunRecord['environment'];
  now?: () => number;
}

type Listener = (tabId: number, state: RunState | null) => void;

class RunAborted extends Error {
  override name = 'RunAborted';
}

/**
 * One run per tab, one at a time across the browser: concurrent engine runs would distort each
 * other's timings, and the User-Agent override is shared by every request the worker sends. A second
 * tab's run waits in a queue and says so.
 */
export class RunManager {
  readonly #deps: RunManagerDeps;
  readonly #now: () => number;
  readonly #states = new Map<number, RunState>();
  readonly #controllers = new Map<number, AbortController>();
  readonly #queue: number[] = [];
  readonly #listeners = new Set<Listener>();
  /** Closed tabs whose run is still unwinding; their state is dropped when it ends. */
  readonly #forgotten = new Set<number>();
  #active: number | undefined;

  constructor(deps: RunManagerDeps) {
    this.#deps = deps;
    this.#now = deps.now ?? Date.now;
  }

  state(tabId: number): RunState | null {
    return this.#states.get(tabId) ?? null;
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Start a run on a tab, unless one is already queued or running there. */
  async start(tabId: number, options: RunOptions): Promise<RunState> {
    const existing = this.#states.get(tabId);
    if (existing && (existing.phase === 'queued' || existing.phase === 'running')) return existing;

    const runId = newRunId(this.#now());
    const policy = auditability(await this.#deps.tabUrl(tabId));
    // A second start for the same tab may have arrived while the URL was being read.
    const raced = this.#states.get(tabId);
    if (raced && (raced.phase === 'queued' || raced.phase === 'running')) return raced;
    const base: RunState = {
      runId,
      tabId,
      url: policy.ok ? policy.url : '',
      options,
      phase: 'queued',
      startedAt: this.#now(),
      steps: [],
      scores: {},
      warnings: [],
    };
    if (!policy.ok) {
      return this.#set({ ...base, phase: 'failed', finishedAt: this.#now(), error: `${policy.title}. ${policy.message}` });
    }
    const state = this.#set({ ...base, steps: this.#deps.plan(options) });
    this.#controllers.set(tabId, new AbortController());
    this.#queue.push(tabId);
    void this.#pump();
    return state;
  }

  cancel(tabId: number, reason = 'Cancelled'): void {
    const state = this.#states.get(tabId);
    if (!state) return;
    if (state.phase === 'queued') {
      const position = this.#queue.indexOf(tabId);
      if (position !== -1) this.#queue.splice(position, 1);
      this.#controllers.delete(tabId);
      this.#set({ ...state, phase: 'cancelled', finishedAt: this.#now(), error: reason, steps: settle(state.steps) });
      return;
    }
    if (state.phase === 'running') this.#controllers.get(tabId)?.abort(new RunAborted(reason));
  }

  /** The tab is gone: stop its run and drop its state. */
  forget(tabId: number): void {
    this.cancel(tabId, 'The tab was closed');
    if (this.#active === tabId) {
      this.#forgotten.add(tabId);
      return;
    }
    this.#states.delete(tabId);
    this.#emit(tabId, null);
  }

  async #pump(): Promise<void> {
    if (this.#active !== undefined) return;
    const tabId = this.#queue.shift();
    if (tabId === undefined) return;
    this.#active = tabId;
    try {
      await this.#run(tabId);
    } finally {
      this.#active = undefined;
      if (this.#forgotten.delete(tabId)) {
        this.#states.delete(tabId);
        this.#emit(tabId, null);
      }
      void this.#pump();
    }
  }

  async #run(tabId: number): Promise<void> {
    const controller = this.#controllers.get(tabId) ?? new AbortController();
    let state = this.#states.get(tabId);
    if (!state) return;
    const startedAt = this.#now();
    state = this.#set({ ...state, phase: 'running', startedAt });
    const update = (change: (current: RunState) => RunState): void => {
      const current = this.#states.get(tabId);
      if (current && current.runId === state?.runId) this.#set(change(current));
    };

    const job: RunJob = {
      runId: state.runId,
      tabId,
      url: state.url,
      options: state.options,
      signal: controller.signal,
      step: (step) => update((current) => ({ ...current, steps: upsert(current.steps, step) })),
      score: (category, value) => update((current) => ({ ...current, scores: { ...current.scores, [category]: value } })),
      warn: (message) => update((current) => ({ ...current, warnings: [...current.warnings, message] })),
      abort: (reason) => controller.abort(new RunAborted(reason)),
    };

    try {
      const result = await this.#deps.execute(job);
      if (controller.signal.aborted) throw controller.signal.reason;
      const current = this.#states.get(tabId) ?? state;
      const ran = current.options.categories.filter((id) => typeof current.scores[id] === 'number');
      if (ran.length === 0) {
        const reasons = Object.values(result.errors).filter(Boolean);
        throw new Error(reasons[0] ?? 'No category produced a score');
      }
      const record: RunRecord = {
        id: current.runId,
        url: current.url,
        origin: new URL(current.url).origin,
        startedAt: new Date(startedAt).toISOString(),
        durationMs: this.#now() - startedAt,
        options: current.options,
        scores: current.scores,
        overall: overallOf(current.scores),
        errors: result.errors,
        environment: this.#deps.environment,
      };
      if (result.agentic) record.agentic = result.agentic;
      if (result.engine) record.engine = result.engine;
      try {
        await this.#deps.save(record);
      } catch (error) {
        // The scores stay in the state for the panel; only the saved report is missing.
        throw new Error(`The audit finished, but the result could not be saved: ${describe(error)}`);
      }
      update((latest) => ({ ...latest, phase: 'done', finishedAt: this.#now(), saved: true, steps: settle(latest.steps) }));
    } catch (error) {
      const cancelled = controller.signal.aborted;
      const message = cancelled ? reasonOf(controller.signal.reason) : describe(error);
      update((latest) => ({ ...latest, phase: cancelled ? 'cancelled' : 'failed', finishedAt: this.#now(), error: message, steps: settle(latest.steps) }));
    } finally {
      this.#controllers.delete(tabId);
    }
  }

  #set(state: RunState): RunState {
    this.#states.set(state.tabId, state);
    this.#emit(state.tabId, state);
    return state;
  }

  #emit(tabId: number, state: RunState | null): void {
    for (const listener of this.#listeners) listener(tabId, state);
  }
}

function upsert(steps: RunStep[], step: RunStep): RunStep[] {
  const index = steps.findIndex((existing) => existing.id === step.id);
  if (index === -1) return [...steps, step];
  const next = steps.slice();
  next[index] = step;
  return next;
}

/** Steps still pending or running when a run ends did not happen. */
function settle(steps: RunStep[]): RunStep[] {
  return steps.map((step) => (step.status === 'pending' || step.status === 'running' ? { ...step, status: 'skipped' } : step));
}

function reasonOf(reason: unknown): string {
  if (reason instanceof RunAborted) return reason.message;
  if (reason instanceof Error && reason.message) return reason.message;
  return 'Cancelled';
}

/** An error as a sentence the panel can show; a DOMException with no message is named instead. */
function describe(error: unknown): string {
  if (error instanceof Error) return error.message || error.name || 'Unknown error';
  return String(error);
}
