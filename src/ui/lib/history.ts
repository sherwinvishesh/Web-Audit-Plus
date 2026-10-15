import { useEffect, useState } from 'react';
import type { RunSummary } from '../../shared/run';
import { runStore } from './saved-run';

/** For each run, the run of the same URL on the same device just before it. `runs` is newest first. */
export function previousRuns(runs: readonly RunSummary[]): Map<string, RunSummary> {
  const result = new Map<string, RunSummary>();
  runs.forEach((run, index) => {
    const before = runs.slice(index + 1).find((candidate) => candidate.url === run.url && candidate.formFactor === run.formFactor);
    if (before) result.set(run.id, before);
  });
  return result;
}

/**
 * The change in the overall score since `before`, or nothing when the two runs scored different
 * categories: a five-category 75 is not 23 points better than an Agentic-only 52.
 */
export function overallDelta(run: RunSummary, before: RunSummary | undefined): number | undefined {
  if (!before || typeof run.overall !== 'number' || typeof before.overall !== 'number') return undefined;
  const keys = (summary: RunSummary): string => Object.keys(summary.scores).sort().join(' ');
  if (keys(run) !== keys(before) || run.overall === before.overall) return undefined;
  return run.overall - before.overall;
}

/** A site's saved runs, split into the ones of one page and the ones of its other pages. */
export interface SiteHistory {
  /** Runs of the page itself, newest first. */
  page: RunSummary[];
  /** Runs of other pages on the same site, newest first. */
  elsewhere: RunSummary[];
  /** The run of the same URL and device before each run, for the change it brought. */
  previous: Map<string, RunSummary>;
}

/**
 * Splits a site's runs (newest first) around one page. `exclude` leaves out the run being shown
 * next to the list, so it is not listed as its own predecessor.
 */
export function splitSiteHistory(runs: readonly RunSummary[], url: string, exclude?: string): SiteHistory {
  const page: RunSummary[] = [];
  const elsewhere: RunSummary[] = [];
  for (const run of runs) {
    if (run.id === exclude) continue;
    (run.url === url ? page : elsewhere).push(run);
  }
  return { page, elsewhere, previous: previousRuns(runs) };
}

export function originOf(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

/**
 * The saved runs of the site a URL belongs to, around that URL. Reloaded when the URL changes,
 * when `version` changes (a run was just saved) and when the panel regains focus, which is when a
 * run deleted from the history page would otherwise still be listed.
 */
export function useSiteHistory(url: string | undefined, exclude: string | undefined, version: unknown): SiteHistory | undefined {
  const [history, setHistory] = useState<SiteHistory | undefined>();
  const origin = url ? originOf(url) : undefined;

  useEffect(() => {
    setHistory(undefined);
    if (!url || !origin) return;
    let disposed = false;
    const load = (): void => {
      runStore()
        .list({ origin })
        .then((runs) => !disposed && setHistory(splitSiteHistory(runs, url, exclude)))
        .catch(() => !disposed && setHistory({ page: [], elsewhere: [], previous: new Map() }));
    };
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') load();
    };
    load();
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [url, origin, exclude, version]);

  return history;
}
