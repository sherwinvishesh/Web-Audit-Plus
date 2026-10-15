import type { CategoryId } from '../../shared/categories';
import type { RunOptions, RunStep } from '../../shared/run';
import type { EngineCategory } from '../../engine/engine';
import { categoryScore, trimResult, type EngineResult } from '../../engine/result';
import { EngineProgress } from '../../engine/progress';
import { agenticSteps, runAgentic } from './agentic';
import { runEngine } from './engine';
import type { RunJob, RunResult } from './run-manager';

/** Every step a run with these options will take, for the progress log. */
export function planRun(options: RunOptions): RunStep[] {
  const steps: RunStep[] = [];
  if (options.categories.includes('agentic')) steps.push(...agenticSteps());
  if (options.categories.some((id) => id !== 'agentic')) steps.push(...EngineProgress.plan());
  return steps;
}

/**
 * Run the selected categories against one URL. Agentic goes first: it never touches the tab, and it
 * finishes in seconds, so its score is on screen while the engine is still loading the page.
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

  const engineCategories = job.options.categories.filter((id): id is EngineCategory => id !== 'agentic');
  if (engineCategories.length > 0) {
    const progress = new EngineProgress(job.step);
    progress.start();
    try {
      const engineResult = await runEngine({
        tabId: job.tabId,
        url: job.url,
        formFactor: job.options.formFactor,
        categories: engineCategories,
        signal: job.signal,
        onStatus: (message) => progress.status(message),
        onSessionLost: (reason) => job.abort(detachMessage(reason)),
      });
      result.engine = trimResult(engineResult);
      for (const category of engineCategories) {
        const score = categoryScore(engineResult, category);
        if (score === null) result.errors[category] = unscoredReason(engineResult, category);
        job.score(category, score);
      }
      for (const warning of engineResult.runWarnings) job.warn(`Audit engine: ${warning}`);
      progress.finish();
    } catch (error) {
      progress.fail(error instanceof Error ? error.message : String(error));
      for (const category of engineCategories) fail(category, error);
    }
  }
  return result;
}

/** A category with no score means one of its weighted audits errored; say which. */
function unscoredReason(engineResult: EngineResult, category: EngineCategory): string {
  const errored = (engineResult.categories[category]?.auditRefs ?? [])
    .map((ref) => engineResult.audits[ref.id])
    .find((audit) => audit?.scoreDisplayMode === 'error');
  return errored ? `Could not run “${errored.title}”: ${errored.errorMessage ?? 'unknown error'}` : 'The audit engine returned no score for this category';
}

function detachMessage(reason: string): string {
  return reason === 'canceled_by_user' ? 'Debugging was cancelled from Chrome’s infobar' : 'The debugger was detached';
}
