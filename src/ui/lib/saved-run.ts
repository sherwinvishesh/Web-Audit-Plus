import { useEffect, useState } from 'react';
import type { RunRecord } from '../../shared/run';
import { createRunStore, type RunStore } from '../../shared/storage';

let store: RunStore | undefined;

/** The extension's run database. Pages and the worker share it (same origin). */
export function runStore(): RunStore {
  store ??= createRunStore();
  return store;
}

export type Loaded<T> = { status: 'loading' } | { status: 'missing' } | { status: 'error'; message: string } | { status: 'ready'; value: T };

/** A saved run, once it exists. */
export function useSavedRun(id: string | undefined): Loaded<RunRecord> {
  const [loaded, setLoaded] = useState<Loaded<RunRecord>>({ status: 'loading' });
  useEffect(() => {
    if (!id) {
      setLoaded({ status: 'missing' });
      return;
    }
    let disposed = false;
    setLoaded({ status: 'loading' });
    runStore()
      .get(id)
      .then((record) => !disposed && setLoaded(record ? { status: 'ready', value: record } : { status: 'missing' }))
      .catch((error: unknown) => !disposed && setLoaded({ status: 'error', message: error instanceof Error ? error.message : String(error) }));
    return () => {
      disposed = true;
    };
  }, [id]);
  return loaded;
}

export function reportUrl(runId?: string, hash?: string): string {
  const url = new URL(chrome.runtime.getURL('/report.html'));
  if (runId) url.searchParams.set('run', runId);
  if (hash) url.hash = hash;
  return url.toString();
}

/** Open the report in a tab, reusing one already showing the same run. */
export async function openReport(runId?: string, hash?: string): Promise<void> {
  const target = reportUrl(runId, hash);
  const base = target.split('#')[0] ?? target;
  const existing = (await chrome.tabs.query({})).find((tab) => tab.url?.split('#')[0] === base);
  if (existing?.id !== undefined) {
    await chrome.tabs.update(existing.id, { active: true, url: target });
    if (existing.windowId !== undefined) await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url: target });
}
