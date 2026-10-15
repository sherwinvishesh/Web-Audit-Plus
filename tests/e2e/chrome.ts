import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { PORT_NAME } from '../../src/shared/messages';
import type { RunOptions, RunRecord, RunState } from '../../src/shared/run';

/** Where Chrome lives. `CHROME_PATH` overrides; the suite skips itself when neither exists. */
export const CHROME_PATH =
  process.env.CHROME_PATH ??
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : process.platform === 'win32'
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : '/usr/bin/google-chrome');

export const EXTENSION_PATH = resolve('.output/chrome-mv3');

export const canRun = existsSync(CHROME_PATH) && existsSync(resolve(EXTENSION_PATH, 'manifest.json'));

export interface Harness {
  browser: Browser;
  extensionId: string;
  /** An extension page, for calling extension APIs. */
  page(path: string): Promise<Page>;
  /** Open `url` in a new tab and return the tab's id. */
  openTab(url: string): Promise<{ page: Page; tabId: number }>;
  /** Start a run on a tab over the UI port and wait for it to finish. */
  run(tabId: number, options: RunOptions): Promise<RunState>;
  /** Read a saved run from the extension's IndexedDB. */
  record(runId: string): Promise<RunRecord | undefined>;
  close(): Promise<void>;
}

export async function launch(): Promise<Harness> {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    pipe: true,
    enableExtensions: [EXTENSION_PATH],
    args: ['--no-first-run', '--no-default-browser-check'],
  });
  const worker = await browser.waitForTarget((target) => target.type() === 'service_worker' && target.url().startsWith('chrome-extension://'));
  const extensionId = new URL(worker.url()).host;

  const page = async (path: string): Promise<Page> => {
    const tab = await browser.newPage();
    await tab.goto(`chrome-extension://${extensionId}/${path}`);
    return tab;
  };

  let control: Page | undefined;
  const controlPage = async (): Promise<Page> => (control ??= await page('report.html'));

  return {
    browser,
    extensionId,
    page,
    async openTab(url) {
      const ui = await controlPage();
      const tabIds = (): Promise<number[]> => ui.evaluate(async () => (await chrome.tabs.query({})).flatMap((tab) => (tab.id === undefined ? [] : [tab.id])));
      const before = new Set(await tabIds());
      const tab = await browser.newPage();
      await tab.goto(url);
      // Several tabs may show the same URL, so find this one as the tab that was not there before.
      const tabId = (await tabIds()).find((id) => !before.has(id));
      if (tabId === undefined) throw new Error(`No tab found for ${url}`);
      return { page: tab, tabId };
    },
    async run(tabId, options) {
      const ui = await controlPage();
      return ui.evaluate(
        (portName, id, runOptions) =>
          new Promise<RunState>((resolve) => {
            const port = chrome.runtime.connect({ name: portName });
            let started = false;
            port.onMessage.addListener((message: { state: RunState | null }) => {
              const { state } = message;
              if (!state) return;
              if (state.phase === 'queued' || state.phase === 'running') started = true;
              const finished = state.phase === 'failed' || state.phase === 'cancelled' || (state.phase === 'done' && state.saved);
              if (started && finished) {
                port.disconnect();
                resolve(state);
              } else if (!started && finished && state.phase === 'failed') {
                // Refused before it was queued (an unauditable page).
                port.disconnect();
                resolve(state);
              }
            });
            port.postMessage({ type: 'start', tabId: id, options: runOptions });
          }),
        PORT_NAME,
        tabId,
        options,
      );
    },
    async record(runId) {
      const ui = await controlPage();
      return ui.evaluate(
        (id) =>
          new Promise<RunRecord | undefined>((resolve, reject) => {
            const open = indexedDB.open('webauditplus');
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const request = open.result.transaction('runs').objectStore('runs').get(id);
              request.onsuccess = () => resolve(request.result as RunRecord | undefined);
              request.onerror = () => reject(request.error);
            };
          }),
        runId,
      );
    },
    close: () => browser.close(),
  };
}
