import type { RunStep } from './run';

/**
 * How far a run has got, from 0 to 1. Steps are weighted by how long they usually take: loading the
 * page and collecting its data dominate a Lighthouse run, while each Agentic probe is one request.
 * A running step counts as half done.
 */
const WEIGHT: Readonly<Record<string, number>> = {
  'lh:prepare': 2,
  'lh:load': 6,
  'lh:gather': 8,
  'lh:audit': 4,
  'lh:score': 1,
};
const AGENTIC_WEIGHT = 0.5;

export function runProgress(steps: readonly RunStep[]): number {
  let total = 0;
  let done = 0;
  for (const step of steps) {
    const weight = WEIGHT[step.id] ?? AGENTIC_WEIGHT;
    total += weight;
    if (step.status === 'running') done += weight / 2;
    else if (step.status !== 'pending') done += weight;
  }
  return total === 0 ? 0 : done / total;
}
