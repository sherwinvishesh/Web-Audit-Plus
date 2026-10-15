import { CdpConnection, pageFor } from '../../engine/cdp';
import { runNavigation, type EngineCategory } from '../../engine/engine';
import type { EngineResult } from '../../engine/result';
import { LOCAL_COMMANDS } from '../../engine/local-commands';
import type { FormFactor } from '../../shared/run';
import { withDebugger } from './debugger';

export interface EngineJob {
  tabId: number;
  url: string;
  formFactor: FormFactor;
  categories: readonly EngineCategory[];
  signal: AbortSignal;
  onStatus(message: string): void;
  /** Chrome ended the debugger session (the user pressed Cancel on its bar, or the tab went away). */
  onSessionLost(reason: string): void;
}

/** The empty page the engine's back/forward cache check steps out to (see bf-cache-failures.js in packages/engine). */
const TEMPORARY_PAGE = '/bfcache.html';

/**
 * The audit engine, run on the audited tab over `chrome.debugger`. The page is reloaded with the
 * engine's own device emulation and throttling.
 */
export async function runEngine(job: EngineJob): Promise<EngineResult> {
  // A background tab does not paint, and the engine fails a page that never paints (NO_FCP).
  await chrome.tabs.update(job.tabId, { active: true });
  try {
    return await withDebugger({ tabId: job.tabId }, async (session) => {
      const stopWatching = session.onDetached((reason) => job.onSessionLost(reason));
      const connection = new CdpConnection(chrome.debugger, job.tabId, LOCAL_COMMANDS);
      try {
        const page = pageFor(connection, async () => (await chrome.tabs.get(job.tabId)).url ?? job.url);
        return await runNavigation(page, job.url, {
          formFactor: job.formFactor,
          categories: job.categories,
          signal: job.signal,
          onStatus: job.onStatus,
        });
      } finally {
        connection.close();
        stopWatching();
      }
    });
  } catch (error) {
    await returnToPage(job.tabId, job.url);
    throw error;
  }
}

/**
 * The engine leaves the page twice (for `about:blank` before loading it, and for an empty page during
 * the back/forward cache check). A run that stops at either moment would strand the tab there.
 */
async function returnToPage(tabId: number, url: string): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    const current = tab.url ?? tab.pendingUrl ?? '';
    if (current === 'about:blank' || current === chrome.runtime.getURL(TEMPORARY_PAGE)) await chrome.tabs.update(tabId, { url });
  } catch {
    // The tab is gone.
  }
}
