import { CdpConnection, pageFor } from '../../lighthouse/cdp';
import { runNavigation, type LighthouseCategory } from '../../lighthouse/engine';
import type { Lhr } from '../../lighthouse/lhr';
import { LOCAL_COMMANDS } from '../../lighthouse/local-commands';
import type { FormFactor } from '../../shared/run';
import { withDebugger } from './debugger';

export interface LighthouseJob {
  tabId: number;
  url: string;
  formFactor: FormFactor;
  categories: readonly LighthouseCategory[];
  signal: AbortSignal;
  onStatus(message: string): void;
  /** Chrome ended the debugger session (the user pressed Cancel on its bar, or the tab went away). */
  onSessionLost(reason: string): void;
}

/** The empty page Lighthouse's back/forward cache check steps out to (see scripts/lighthouse-bundle.ts). */
const TEMPORARY_PAGE = '/bfcache.html';

/**
 * Real Lighthouse, run on the audited tab over `chrome.debugger`. The page is reloaded with
 * Lighthouse's own emulation and throttling, exactly as DevTools' Lighthouse panel does.
 */
export async function runLighthouse(job: LighthouseJob): Promise<Lhr> {
  // A background tab does not paint, and Lighthouse fails a page that never paints (NO_FCP).
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
 * Lighthouse leaves the page twice (for `about:blank` before loading it, and for an empty page during
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
