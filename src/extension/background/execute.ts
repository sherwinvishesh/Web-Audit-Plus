import type { CategoryId } from '../../shared/categories';
import type { RunOptions, RunStep } from '../../shared/run';
import type { LighthouseCategory } from '../../lighthouse/engine';
import { categoryScore, trimLhr, type Lhr } from '../../lighthouse/lhr';
import { LighthouseProgress } from '../../lighthouse/progress';
import { agenticSteps, runAgentic } from './agentic';
import { runLighthouse } from './lighthouse';
import type { RunJob, RunResult } from './run-manager';

/** Every step a run with these options will take, for the progress log. */
export function planRun(options: RunOptions): RunStep[] {
  const steps: RunStep[] = [];
  if (options.categories.includes('agentic')) steps.push(...agenticSteps());
  const lighthouse = options.categories.filter((id) => id !== 'agentic');
  if (lighthouse.length > 0) steps.push(...LighthouseProgress.plan());
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

  const lighthouse = job.options.categories.filter((id): id is LighthouseCategory => id !== 'agentic');
  if (lighthouse.length > 0) {
    const progress = new LighthouseProgress(job.step);
    progress.start();
    try {
      const lhr = await runLighthouse({
        tabId: job.tabId,
        url: job.url,
        formFactor: job.options.formFactor,
        categories: lighthouse,
        signal: job.signal,
        onStatus: (message) => progress.status(message),
        onSessionLost: (reason) => job.abort(detachMessage(reason)),
      });
      result.lighthouse = trimLhr(lhr);
      for (const category of lighthouse) {
        const score = categoryScore(lhr, category);
        if (score === null) result.errors[category] = unscoredReason(lhr, category);
        job.score(category, score);
      }
      for (const warning of lhr.runWarnings) job.warn(`Lighthouse: ${warning}`);
      progress.finish();
    } catch (error) {
      progress.fail(error instanceof Error ? error.message : String(error));
      for (const category of lighthouse) fail(category, error);
    }
  }
  return result;
}

/** A category with no score means one of its weighted audits errored; say which. */
function unscoredReason(lhr: Lhr, category: LighthouseCategory): string {
  const errored = (lhr.categories[category]?.auditRefs ?? [])
    .map((ref) => lhr.audits[ref.id])
    .find((audit) => audit?.scoreDisplayMode === 'error');
  return errored ? `Lighthouse could not run “${errored.title}”: ${errored.errorMessage ?? 'unknown error'}` : 'Lighthouse returned no score for this category';
}

function detachMessage(reason: string): string {
  return reason === 'canceled_by_user' ? 'Debugging was cancelled from Chrome’s infobar' : 'The debugger was detached';
}
