import { useEffect, useState } from 'react';
import { CATEGORY_IDS, CATEGORY_SHORT_TITLES, CATEGORY_TITLES } from '../../shared/categories';
import type { RunSummary } from '../../shared/run';
import { ScoreRing } from '../components/ScoreRing';
import { DesktopIcon, MobileIcon } from '../components/icons';
import { runStore } from '../lib/saved-run';
import { band, BAND_COLOR, displayUrl, formatDate } from '../lib/score';
import { Centered, Shell } from './Shell';

export function HistoryPage() {
  const [runs, setRuns] = useState<RunSummary[] | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    document.title = 'History · Web Audit+';
    runStore()
      .list()
      .then(setRuns)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

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
        <Centered title="No audits yet">Click the Web Audit+ icon in the toolbar on any website and press Run.</Centered>
      </Shell>
    );
  }

  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-6 pb-24">
        <h1 className="py-8 text-2xl font-semibold tracking-tight">History</h1>
        <ul className="overflow-hidden rounded-lg border border-border bg-surface">
          {runs.map((run) => {
            const { host, path } = displayUrl(run.url);
            return (
              <li key={run.id} className="border-b border-border last:border-b-0">
                <a href={`report.html?run=${encodeURIComponent(run.id)}`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-2">
                  <ScoreRing score={run.overall} size={40} animate={false} label="Overall" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {host}
                      <span className="text-muted">{path === '/' ? '' : path}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-[12px] text-muted">
                      <span className="num">{formatDate(run.startedAt)}</span>
                      {run.formFactor === 'mobile' ? <MobileIcon size={13} /> : <DesktopIcon size={13} />}
                    </span>
                  </span>
                  <span className="hidden gap-4 md:flex">
                    {CATEGORY_IDS.map((id) => {
                      const score = run.scores[id];
                      return (
                        <span key={id} className="flex w-14 flex-col items-center" title={CATEGORY_TITLES[id]}>
                          <span className="num font-mono text-[14px] font-medium" style={{ color: BAND_COLOR[band(score)] }}>
                            {typeof score === 'number' ? score : '–'}
                          </span>
                          <span className="text-[10.5px] text-faint">{CATEGORY_SHORT_TITLES[id]}</span>
                        </span>
                      );
                    })}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </main>
    </Shell>
  );
}
