import type { CategoryId } from '../../shared/categories';
import type { RunOptions, RunStep } from '../../shared/run';
import { agenticSteps, runAgentic } from './agentic';
import type { RunJob, RunResult } from './run-manager';

/** Every step a run with these options will take, for the progress log. */
export function planRun(options: RunOptions): RunStep[] {
  const steps: RunStep[] = [];
  if (options.categories.includes('agentic')) steps.push(...agenticSteps());
  const lighthouse = options.categories.filter((id) => id !== 'agentic');
  if (lighthouse.length > 0) {
    steps.push({ id: 'lighthouse', group: 'lighthouse', label: 'Lighthouse', status: 'pending' });
  }
  return steps;
}

/**
 * Run the selected categories against one URL. Agentic goes first: it never touches the tab, and it
 * finishes in seconds, so its score is on screen while Lighthouse is still loading the page.
 */
export async function executeRun(job: RunJob): Promise<RunResult> {
  const result: RunResult = { errors: {} };
  const fail = (category: CategoryId, error: unknown): void => {
    if (job.signal.aborted) throw job.signal.reason;
    const message = error instanceof Error ? error.message : String(error);
    result.errors[category] = message;
    job.score(category, null);
  };

  if (job.options.categories.includes('agentic')) {
    try {
      const report = await runAgentic({ url: job.url, signal: job.signal, step: job.step, onSessionLost: (reason) => job.abort(detachMessage(reason)) });
      result.agentic = report;
      job.score('agentic', report.score.value);
    } catch (error) {
      fail('agentic', error);
      job.warn(`Agentic: ${result.errors.agentic ?? 'failed'}`);
    }
  }

  const lighthouse = job.options.categories.filter((id) => id !== 'agentic');
  if (lighthouse.length > 0) {
    job.step({ id: 'lighthouse', group: 'lighthouse', label: 'Lighthouse', status: 'skipped', detail: 'Not available in this build' });
    for (const category of lighthouse) fail(category, new Error('Lighthouse is not available in this build'));
  }
  return result;
}

function detachMessage(reason: string): string {
  return reason === 'canceled_by_user' ? 'Debugging was cancelled from Chrome’s infobar' : 'The debugger was detached';
}
