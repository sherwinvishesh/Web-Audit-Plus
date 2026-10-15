import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { runNavigation } from '../src/engine/engine';
import { executeRun, planRun } from '../src/extension/background/execute';
import { RunManager } from '../src/extension/background/run-manager';
import type { RunOptions } from '../src/shared/run';
import { createRunStore, type RunStore } from '../src/shared/storage';
import { flawedDesktopResult } from './engine/fixture';
import { compliantSite, type FixtureSite } from './fixtures/sites';

vi.mock('../src/engine/engine', () => ({ runNavigation: vi.fn() }));
const engine = vi.mocked(runNavigation);

const WORKER_URL = 'chrome-extension://webauditplus/background.js';
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const settle = async (ticks = 3): Promise<void> => {
  for (let i = 0; i < ticks; i += 1) await tick();
};

type Debuggee = chrome.debugger.Debuggee;
type DetachListener = (source: Debuggee, reason: string) => void;

/** The part of `chrome` the background worker uses, with one attachment per target. */
function fakeChrome(pageUrl: string) {
  const attached = new Set<string>();
  const key = (target: Debuggee): string => (target.tabId !== undefined ? `tab:${target.tabId}` : `target:${target.targetId}`);
  const detachListeners = new Set<DetachListener>();
  const tabs = new Map<number, { id: number; url: string }>([
    [1, { id: 1, url: pageUrl }],
    [2, { id: 2, url: pageUrl }],
  ]);
  let refuseAttach: string | undefined;
  const api = {
    debugger: {
      attach: vi.fn(async (target: Debuggee) => {
        if (refuseAttach) throw new Error(refuseAttach);
        if (attached.has(key(target))) throw new Error('Another debugger is already attached');
        attached.add(key(target));
      }),
      detach: vi.fn(async (target: Debuggee) => {
        if (!attached.has(key(target))) throw new Error('Debugger is not attached');
        attached.delete(key(target));
      }),
      sendCommand: vi.fn(async (target: Debuggee) => {
        if (!attached.has(key(target))) throw new Error(`Debugger is not attached to the tab with id: ${target.tabId}.`);
        return {};
      }),
      getTargets: vi.fn(async () => [{ id: 'worker-1', url: WORKER_URL, type: 'worker', attached: false, title: 'worker' }]),
      onDetach: { addListener: (l: DetachListener) => detachListeners.add(l), removeListener: (l: DetachListener) => detachListeners.delete(l) },
      onEvent: { addListener: () => undefined, removeListener: () => undefined },
    },
    tabs: {
      get: vi.fn(async (id: number) => {
        const tab = tabs.get(id);
        if (!tab) throw new Error(`No tab with id: ${id}.`);
        return tab;
      }),
      update: vi.fn(async (id: number, props: { active?: boolean; url?: string }) => {
        const tab = tabs.get(id);
        if (!tab) throw new Error(`No tab with id: ${id}.`);
        if (props.url) tab.url = props.url;
        return tab;
      }),
    },
    runtime: { getURL: (path: string) => `chrome-extension://webauditplus${path}`, getManifest: () => ({ version: '0.1.0' }) },
  };
  const chromeDetaches = (target: Debuggee, reason: string): void => {
    attached.delete(key(target));
    for (const listener of [...detachListeners]) listener(target, reason);
  };
  return {
    api,
    attached,
    tabs,
    detachListeners,
    chromeDetaches,
    refuseAttach: (message: string) => void (refuseAttach = message),
  };
}

const MIXED: RunOptions = { formFactor: 'desktop', categories: ['agentic', 'performance'] };
const ENGINE_ONLY: RunOptions = { formFactor: 'desktop', categories: ['performance'] };

let site: FixtureSite;
let fake: ReturnType<typeof fakeChrome>;
let store: RunStore;
let manager: RunManager;

beforeAll(async () => {
  site = await compliantSite();
});
afterAll(() => site.close());

beforeEach(() => {
  fake = fakeChrome(`${site.origin}/resume`);
  Object.defineProperty(globalThis, 'chrome', { value: fake.api, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'location', { value: { href: WORKER_URL }, configurable: true, writable: true });
  engine.mockReset();
  store = createRunStore(new IDBFactory());
  // Wired exactly as src/extension/background/index.ts wires the real one.
  manager = new RunManager({
    tabUrl: async (tabId) => (await fake.api.tabs.get(tabId).catch(() => undefined))?.url,
    plan: planRun,
    execute: executeRun,
    save: (record) => store.put(record),
    environment: { extensionVersion: '0.1.0', userAgent: 'test' },
  });
});

/** An engine that finishes with a real result after one round trip to the tab. */
function engineThatFinishes(): void {
  engine.mockImplementation(async (page) => {
    const session = await page.target().createCDPSession();
    await session.send('Page.enable');
    return flawedDesktopResult() as unknown as Awaited<ReturnType<typeof runNavigation>>;
  });
}

/** An engine that keeps talking to the tab until a command fails, as the real one does after the page loads. */
function engineThatKeepsGathering(): void {
  engine.mockImplementation(async (page) => {
    const session = await page.target().createCDPSession();
    for (;;) {
      await session.send('Runtime.evaluate', { expression: '1' });
      await tick();
    }
  });
}

async function waitUntilFinished(tabId: number, max = 200): Promise<void> {
  for (let i = 0; i < max; i += 1) {
    const phase = manager.state(tabId)?.phase;
    if (phase === undefined || phase === 'done' || phase === 'failed' || phase === 'cancelled') return;
    await tick();
  }
  throw new Error(`run on tab ${tabId} still ${manager.state(tabId)?.phase} after ${max} ticks`);
}

async function waitUntilEngineRuns(): Promise<void> {
  for (let i = 0; i < 200 && engine.mock.calls.length === 0; i += 1) await tick();
  await tick();
  expect(fake.attached.has('tab:1')).toBe(true);
}

describe('a run’s debugger sessions and state, end to end', () => {
  it('success: scores both categories, saves the record, and leaves nothing attached', async () => {
    engineThatFinishes();
    const queued = await manager.start(1, MIXED);
    await waitUntilFinished(1);
    const state = manager.state(1)!;
    expect(state).toMatchObject({ phase: 'done', saved: true, runId: queued.runId });
    expect(typeof state.scores.agentic).toBe('number');
    expect(typeof state.scores.performance).toBe('number');
    expect(fake.attached.size).toBe(0);
    expect(fake.detachListeners.size).toBe(0);
    expect((await store.get(queued.runId))?.scores).toEqual(state.scores);
    expect(await store.list()).toHaveLength(1);
  });

  it('engine throws: the run still ends, with the agentic score kept and the engine error on record', async () => {
    engine.mockImplementation(async () => {
      fake.tabs.get(1)!.url = 'about:blank';
      throw new Error('NO_FCP');
    });
    const queued = await manager.start(1, MIXED);
    await waitUntilFinished(1);
    const state = manager.state(1)!;
    expect(state.phase).toBe('done');
    expect(state.scores).toMatchObject({ performance: null });
    expect(typeof state.scores.agentic).toBe('number');
    expect(fake.attached.size).toBe(0);
    expect(fake.tabs.get(1)?.url).toBe(`${site.origin}/resume`);
    expect((await store.get(queued.runId))?.errors).toEqual({ performance: 'NO_FCP' });
  });

  it('engine throws with nothing else to score: the run fails with the engine’s message, and nothing is saved', async () => {
    engine.mockRejectedValue(new Error('PROTOCOL_TIMEOUT'));
    await manager.start(1, ENGINE_ONLY);
    await waitUntilFinished(1);
    expect(manager.state(1)).toMatchObject({ phase: 'failed', error: 'PROTOCOL_TIMEOUT' });
    expect(fake.attached.size).toBe(0);
    expect(await store.list()).toHaveLength(0);
  });

  it('user cancel while the engine is gathering: detaches at once, nothing saved', async () => {
    engineThatKeepsGathering();
    await manager.start(1, ENGINE_ONLY);
    await waitUntilEngineRuns();
    manager.cancel(1);
    await waitUntilFinished(1);
    expect(manager.state(1)).toMatchObject({ phase: 'cancelled', error: 'Cancelled' });
    expect(fake.attached.size).toBe(0);
    expect(fake.api.debugger.detach).toHaveBeenCalledTimes(1);
    expect(await store.list()).toHaveLength(0);
  });

  it('tab closed mid-run: the state is dropped once the run unwinds, nothing attached or saved', async () => {
    engineThatKeepsGathering();
    await manager.start(1, ENGINE_ONLY);
    await waitUntilEngineRuns();
    // Chrome reports a closed tab twice: tabs.onRemoved (→ forget) and debugger.onDetach.
    fake.tabs.delete(1);
    manager.forget(1);
    fake.chromeDetaches({ tabId: 1 }, 'target_closed');
    await waitUntilFinished(1);
    await settle();
    expect(manager.state(1)).toBeNull();
    expect(fake.attached.size).toBe(0);
    expect(fake.detachListeners.size).toBe(0);
    expect(await store.list()).toHaveLength(0);
    // The manager is free again.
    engineThatFinishes();
    await manager.start(2, ENGINE_ONLY);
    await waitUntilFinished(2);
    expect(manager.state(2)?.phase).toBe('done');
  });

  it('tab navigated mid-run: the engine sees the new URL and its failure ends the run cleanly', async () => {
    engine.mockImplementation(async (page) => {
      fake.tabs.get(1)!.url = 'https://elsewhere.test/';
      throw new Error(`Navigated to ${await page.url()}`);
    });
    await manager.start(1, ENGINE_ONLY);
    await waitUntilFinished(1);
    expect(manager.state(1)).toMatchObject({ phase: 'failed', error: 'Navigated to https://elsewhere.test/' });
    expect(fake.attached.size).toBe(0);
  });

  it('DevTools already attached: the run fails with advice, and there is nothing to detach', async () => {
    fake.refuseAttach('Another debugger is already attached to the tab with id: 1.');
    engineThatFinishes();
    await manager.start(1, ENGINE_ONLY);
    await waitUntilFinished(1);
    expect(manager.state(1)?.phase).toBe('failed');
    expect(manager.state(1)?.error).toMatch(/Another debugger is attached to this tab\. Close DevTools/);
    expect(engine).not.toHaveBeenCalled();
    expect(fake.api.debugger.detach).not.toHaveBeenCalled();
    expect(fake.attached.size).toBe(0);
  });

  it('Cancel on Chrome’s infobar: the run is cancelled with that reason, no double detach', async () => {
    engineThatKeepsGathering();
    await manager.start(1, ENGINE_ONLY);
    await waitUntilEngineRuns();
    fake.chromeDetaches({ tabId: 1 }, 'canceled_by_user');
    await waitUntilFinished(1);
    expect(manager.state(1)).toMatchObject({ phase: 'cancelled', error: 'Debugging was cancelled from Chrome’s infobar' });
    expect(fake.api.debugger.detach).not.toHaveBeenCalled();
    expect(fake.attached.size).toBe(0);
    expect(await store.list()).toHaveLength(0);
  });

  it('a second Run on the same tab while one is in progress is the same run, never a second session', async () => {
    engineThatKeepsGathering();
    const first = await manager.start(1, ENGINE_ONLY);
    await waitUntilEngineRuns();
    const second = await manager.start(1, ENGINE_ONLY);
    expect(second.runId).toBe(first.runId);
    expect(second.phase).toBe('running');
    await tick();
    expect(fake.api.debugger.attach).toHaveBeenCalledTimes(1);
    expect(engine).toHaveBeenCalledTimes(1);
    manager.cancel(1);
    await waitUntilFinished(1);
    expect(fake.attached.size).toBe(0);
  });

  it('a Run on another tab waits its turn rather than attaching alongside', async () => {
    engineThatKeepsGathering();
    await manager.start(1, ENGINE_ONLY);
    await waitUntilEngineRuns();
    const other = await manager.start(2, ENGINE_ONLY);
    expect(other.phase).toBe('queued');
    await settle();
    expect(fake.attached.size).toBe(1);
    expect(fake.api.debugger.attach).toHaveBeenCalledTimes(1);
    manager.cancel(2);
    manager.cancel(1);
    await waitUntilFinished(1);
    expect(fake.attached.size).toBe(0);
  });

  it('a saved-storage failure ends the run as failed, with the scores still on screen', async () => {
    engineThatFinishes();
    store.put = async () => {
      throw new DOMException('', 'QuotaExceededError');
    };
    await manager.start(1, MIXED);
    await waitUntilFinished(1);
    const state = manager.state(1)!;
    expect(state.phase).toBe('failed');
    expect(state.error).toMatch(/could not be saved: .*QuotaExceededError/);
    expect(typeof state.scores.agentic).toBe('number');
    expect(state.saved).toBeUndefined();
    expect(fake.attached.size).toBe(0);
  });
});
