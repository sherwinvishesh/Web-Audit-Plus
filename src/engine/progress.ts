import type { RunStep, StepStatus } from '../shared/run';

/**
 * The engine's own status log ("Getting artifact: Accessibility", "Auditing: Uses HTTPS", …) mapped
 * onto five steps, so the progress log says which gatherer or audit is running right now.
 */

export const ENGINE_STEPS = [
  { id: 'engine:prepare', label: 'Prepare the browser' },
  { id: 'engine:load', label: 'Load the page' },
  { id: 'engine:gather', label: 'Collect page data' },
  { id: 'engine:audit', label: 'Run audits' },
  { id: 'engine:score', label: 'Score' },
] as const;

export type EngineStepId = (typeof ENGINE_STEPS)[number]['id'];

const ORDER: readonly EngineStepId[] = ENGINE_STEPS.map((step) => step.id);

/** The step a status line belongs to, and what to show beside it. Undefined: it belongs to whichever step is running. */
export function classifyStatus(message: string): { step: EngineStepId; detail?: string } | undefined {
  const navigating = /^Navigating to (.+)$/.exec(message);
  if (navigating) return navigating[1] === 'about:blank' ? { step: 'engine:prepare' } : { step: 'engine:load', detail: 'Reloading with device emulation and throttling' };
  const artifact = /^Getting artifact: (.+)$/.exec(message);
  if (artifact) return { step: 'engine:gather', detail: artifact[1] };
  const audit = /^Auditing: (.+)$/.exec(message);
  if (audit) return { step: 'engine:audit', detail: audit[1] };
  if (/^(Audit phase|Analyzing and running audits)/.test(message)) return { step: 'engine:audit' };
  if (/^Generating results/.test(message)) return { step: 'engine:score' };
  if (/^(Initialize config|Resolve artifact definitions|Gather phase|Connecting to browser|Benchmarking|Preparing|Cleaning)/.test(message)) {
    return { step: 'engine:prepare' };
  }
  return undefined;
}

/**
 * Turns the stream of status lines into step updates. Steps only move forward: a "Computing
 * artifact" line during the audit phase does not send the log back to gathering.
 */
export class EngineProgress {
  readonly #emit: (step: RunStep) => void;
  #current = -1;

  constructor(emit: (step: RunStep) => void) {
    this.#emit = emit;
  }

  static plan(): RunStep[] {
    return ENGINE_STEPS.map((step) => ({ id: step.id, group: 'engine', label: step.label, status: 'pending' }));
  }

  start(): void {
    this.#advance(0);
  }

  status(message: string): void {
    const match = classifyStatus(message);
    if (!match) return;
    const index = ORDER.indexOf(match.step);
    if (index < this.#current) return;
    this.#advance(index, match.detail);
  }

  /** Every step done. */
  finish(): void {
    for (let index = Math.max(this.#current, 0); index < ORDER.length; index++) this.#set(index, 'done');
    this.#current = ORDER.length;
  }

  /** The running step failed with this message; the rest did not happen. */
  fail(message: string): void {
    const failed = Math.max(this.#current, 0);
    this.#set(failed, 'failed', message);
    for (let index = failed + 1; index < ORDER.length; index++) this.#set(index, 'skipped');
    this.#current = ORDER.length;
  }

  #advance(index: number, detail?: string): void {
    for (let earlier = Math.max(this.#current, 0); earlier < index; earlier++) this.#set(earlier, 'done');
    this.#current = index;
    this.#set(index, 'running', detail);
  }

  #set(index: number, status: StepStatus, detail?: string): void {
    const step = ENGINE_STEPS[index];
    if (!step) return;
    const next: RunStep = { id: step.id, group: 'engine', label: step.label, status };
    if (detail) next.detail = detail;
    this.#emit(next);
  }
}
