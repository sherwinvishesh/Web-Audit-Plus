import { useEffect, useMemo, useState } from 'react';
import { CATEGORY_IDS, CATEGORY_SHORT_TITLES, CATEGORY_TITLES } from '../../shared/categories';
import type { RunSummary } from '../../shared/run';
import { ScoreDelta } from '../components/Change';
import { ScoreRing } from '../components/ScoreRing';
import { DesktopIcon, MobileIcon, SearchIcon, TrashIcon } from '../components/icons';
import { runStore } from '../lib/saved-run';
import { band, BAND_COLOR, displayUrl, formatDate } from '../lib/score';
import { Centered, Shell } from './Shell';

/** Every saved run, grouped by site, newest first, with the change since the run before it. */
export function HistoryPage() {
  const [runs, setRuns] = useState<RunSummary[] | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [query, setQuery] = useState('');
  const [confirming, setConfirming] = useState<string | undefined>();

  useEffect(() => {
    document.title = 'History · Web Audit+';
    runStore()
      .list()
      .then(setRuns)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  const previous = useMemo(() => previousRuns(runs ?? []), [runs]);
  const groups = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matching = (runs ?? []).filter((run) => words.every((word) => run.url.toLowerCase().includes(word)));
    const byOrigin = new Map<string, RunSummary[]>();
    for (const run of matching) byOrigin.set(run.origin, [...(byOrigin.get(run.origin) ?? []), run]);
    return [...byOrigin.entries()];
  }, [runs, query]);

  const remove = async (id: string): Promise<void> => {
    setConfirming(undefined);
    try {
      await runStore().delete(id);
      setRuns((current) => current?.filter((run) => run.id !== id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  if (error) {
    return (
      <Shell>
        <Centered title="Could not read the run history">{error}</Centered>
      </Shell>
    );
  }
  if (!runs) return <Shell>{null}</Shell>;
  if (runs.length === 0) {
    return (
      <Shell>
        <Centered title="No audits yet">Click the Web Audit+ icon in the toolbar on any website and press Run audit.</Centered>
      </Shell>
    );
  }

  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-6 pb-24">
        <div className="flex flex-wrap items-end justify-between gap-4 pt-9 pb-6">
          <div>
            <h1 className="text-[26px] leading-tight font-semibold tracking-tight">History</h1>
            <p className="mt-1 text-[13px] text-muted">
              <span className="num">{runs.length}</span> {runs.length === 1 ? 'run' : 'runs'} across <span className="num">{new Set(runs.map((run) => run.origin)).size}</span>{' '}
              {new Set(runs.map((run) => run.origin)).size === 1 ? 'site' : 'sites'}, kept in this browser
            </p>
          </div>
          <label className="relative flex items-center">
            <span className="sr-only">Filter by URL</span>
            <SearchIcon size={14} className="pointer-events-none absolute left-2.5 text-faint" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by URL"
              spellCheck={false}
              className="h-8 w-60 rounded-md border border-border bg-surface pr-3 pl-8 text-[13px] placeholder:text-faint focus:border-accent focus:outline-none"
            />
          </label>
        </div>

        {groups.length === 0 && <p className="rounded-xl border border-dashed border-border-strong px-6 py-10 text-center text-muted">No run matches that URL.</p>}

        {groups.map(([origin, list]) => (
          <section key={origin} className="mt-8 first:mt-0" aria-label={displayUrl(origin).host}>
            <h2 className="mb-2 flex items-baseline gap-2 text-[13px] font-medium">
              {displayUrl(origin).host}
              <span className="num font-mono text-[12px] text-faint">{list.length}</span>
            </h2>
            <ul className="overflow-hidden rounded-xl border border-border bg-surface">
              {list.map((run) => {
                const { path } = displayUrl(run.url);
                const before = previous.get(run.id);
                return (
                  <li key={run.id} className="group relative flex items-center border-b border-border last:border-b-0">
                    <a
                      href={`report.html?run=${encodeURIComponent(run.id)}`}
                      className="flex min-w-0 flex-1 items-center gap-4 py-3 pr-14 pl-4 transition-colors outline-none hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:shadow-[inset_2px_0_0_var(--accent)]"
                    >
                      <ScoreRing score={run.overall} size={40} animate={false} label="Overall" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{path}</span>
                        <span className="mt-0.5 flex items-center gap-2 text-[12px] text-muted">
                          <span className="num">{formatDate(run.startedAt)}</span>
                          <span className="flex items-center gap-1">
                            {run.formFactor === 'mobile' ? <MobileIcon size={13} /> : <DesktopIcon size={13} />}
                            {run.formFactor === 'mobile' ? 'Mobile' : 'Desktop'}
                          </span>
                          {before && typeof run.overall === 'number' && typeof before.overall === 'number' && run.overall !== before.overall && (
                            <ScoreDelta delta={run.overall - before.overall} className="text-[11.5px]" />
                          )}
                        </span>
                      </span>
                      <span className="hidden gap-2 md:flex">
                        {CATEGORY_IDS.map((id) => {
                          const score = run.scores[id];
                          const earlier = before?.scores[id];
                          return (
                            <span key={id} className="flex w-16 flex-col items-center" title={CATEGORY_TITLES[id]}>
                              <span className="num font-mono text-[14px] font-medium" style={{ color: BAND_COLOR[band(score)] }}>
                                {typeof score === 'number' ? score : '–'}
                              </span>
                              <span className="flex h-4 items-center gap-1 text-[10.5px] text-faint">
                                {CATEGORY_SHORT_TITLES[id]}
                                {typeof score === 'number' && typeof earlier === 'number' && score !== earlier && <ScoreDelta delta={score - earlier} className="text-[10.5px]" />}
                              </span>
                            </span>
                          );
                        })}
                      </span>
                    </a>
                    {confirming === run.id ? (
                      <span className="absolute inset-y-0 right-0 flex items-center gap-1.5 bg-surface-2 px-3 shadow-[-12px_0_12px_-4px_var(--surface-2)]" role="group" aria-label="Delete this run?">
                        <span className="mr-1 text-[12.5px] text-muted">Delete this run?</span>
                        <button
                          type="button"
                          onClick={() => void remove(run.id)}
                          className="h-7 rounded-md bg-bad px-2.5 text-[12.5px] font-medium text-white transition-[filter] hover:brightness-110"
                        >
                          Delete
                        </button>
                        <button type="button" autoFocus onClick={() => setConfirming(undefined)} className="h-7 rounded-md border border-border-strong px-2.5 text-[12.5px] hover:bg-surface">
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirming(run.id)}
                        aria-label={`Delete the run of ${formatDate(run.startedAt)}`}
                        title="Delete this run"
                        className="absolute right-3 grid size-8 place-items-center rounded-md text-faint opacity-0 transition-[opacity,color,background-color] group-hover:opacity-100 hover:bg-surface hover:text-bad focus-visible:opacity-100"
                      >
                        <TrashIcon size={15} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
    </Shell>
  );
}

/** For each run, the run of the same URL on the same device just before it. `runs` is newest first. */
function previousRuns(runs: readonly RunSummary[]): Map<string, RunSummary> {
  const result = new Map<string, RunSummary>();
  runs.forEach((run, index) => {
    const before = runs.slice(index + 1).find((candidate) => candidate.url === run.url && candidate.formFactor === run.formFactor);
    if (before) result.set(run.id, before);
  });
  return result;
}
