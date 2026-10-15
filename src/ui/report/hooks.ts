import { useEffect, useRef, useState, type RefObject } from 'react';
import { compareModels, type Comparison } from '../../shared/compare';
import { buildReportModel, type ReportModel } from '../../shared/report-model';
import type { RunRecord, RunSummary } from '../../shared/run';
import { runStore } from '../lib/saved-run';

/** Read and write one query parameter of the page, without a navigation. */
export function readParam(name: string): string | null {
  return new URLSearchParams(location.search).get(name);
}

export function writeParam(name: string, value: string | undefined): void {
  const url = new URL(location.href);
  if (value === undefined) url.searchParams.delete(name);
  else url.searchParams.set(name, value);
  history.replaceState(history.state, '', url);
}

/** Other runs of the same URL on the same device, newest first: the runs this one can be compared with. */
export function useComparableRuns(record: RunRecord): RunSummary[] | undefined {
  const [runs, setRuns] = useState<RunSummary[] | undefined>();
  useEffect(() => {
    let disposed = false;
    runStore()
      .list({ url: record.url })
      .then((list) => !disposed && setRuns(list.filter((run) => run.id !== record.id && run.formFactor === record.options.formFactor)))
      .catch(() => !disposed && setRuns([]));
    return () => {
      disposed = true;
    };
  }, [record]);
  return runs;
}

/** The latest run before this one, the comparison a report starts with. */
export function defaultComparison(record: RunRecord, runs: readonly RunSummary[]): string | undefined {
  return runs.find((run) => run.startedAt < record.startedAt)?.id;
}

/** The comparison with another saved run, once that run has loaded. */
export function useComparison(model: ReportModel, otherId: string | undefined): Comparison | undefined {
  const [comparison, setComparison] = useState<Comparison | undefined>();
  useEffect(() => {
    setComparison(undefined);
    if (!otherId) return;
    let disposed = false;
    runStore()
      .get(otherId)
      .then((other) => {
        if (!disposed && other) setComparison(compareModels(model, buildReportModel(other)));
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, [model, otherId]);
  return comparison;
}

/** Which category section the reader is in: the last one whose top has scrolled past the toolbar. */
export function useScrollSpy(ids: readonly string[], offset: number): string | undefined {
  const [active, setActive] = useState<string | undefined>();
  const key = ids.join(' ');
  useEffect(() => {
    let frame = 0;
    const update = (): void => {
      frame = 0;
      let current: string | undefined;
      for (const id of key.split(' ')) {
        const element = document.getElementById(`category-${id}`);
        if (element && element.getBoundingClientRect().top <= offset) current = id;
      }
      setActive(current);
    };
    const schedule = (): void => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [key, offset]);
  return active;
}

interface KeyHandlers {
  search: RefObject<HTMLInputElement>;
  onClearSearch(): void;
  onCopy(key: string): void;
}

/**
 * The report's keyboard: `/` searches, Enter goes from the search to the first result, Escape clears
 * and leaves the search, `j` and `k` move between the
 * visible audits, `c` copies the focused audit's fix prompt. Enter and Space open a row, as on any
 * button. Keys typed into a field, or with a modifier, are left alone.
 */
export function useReportKeys({ search, onClearSearch, onCopy }: KeyHandlers): void {
  const latest = useRef({ onClearSearch, onCopy });
  latest.current = { onClearSearch, onCopy };

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (event.key === 'Escape' && target === search.current) {
        latest.current.onClearSearch();
        search.current?.blur();
        return;
      }
      if (event.key === 'Enter' && target === search.current) {
        event.preventDefault();
        search.current?.blur();
        moveFocus(1, true);
        return;
      }
      if (target && (target.isContentEditable || target.closest('input, textarea, select, [role="menu"]'))) return;
      if (event.key === '/') {
        event.preventDefault();
        search.current?.focus();
        search.current?.select();
      } else if (event.key === 'j' || event.key === 'k') {
        event.preventDefault();
        moveFocus(event.key === 'j' ? 1 : -1);
      } else if (event.key === 'c') {
        const key = document.activeElement?.closest('[data-audit]')?.getAttribute('data-audit');
        if (key) {
          event.preventDefault();
          latest.current.onCopy(key);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [search]);
}

function moveFocus(step: 1 | -1, fromTop = false): void {
  const rows = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-audit] > button')).filter((row) => row.checkVisibility());
  if (rows.length === 0) return;
  const active = document.activeElement;
  const current = rows.findIndex((row) => row === active || (active !== null && row.parentElement?.contains(active)));
  let next: HTMLButtonElement | undefined;
  if (fromTop) {
    next = rows[0];
  } else if (current === -1) {
    // Start from the first row on screen, rather than the top of the page.
    const below = rows.findIndex((row) => row.getBoundingClientRect().top >= 120);
    next = step === 1 ? rows[below === -1 ? 0 : below] : rows[below <= 0 ? rows.length - 1 : below - 1];
  } else {
    next = rows[Math.min(rows.length - 1, Math.max(0, current + step))];
  }
  next?.focus({ preventScroll: true });
  next?.scrollIntoView({ block: fromTop ? 'center' : 'nearest' });
}
