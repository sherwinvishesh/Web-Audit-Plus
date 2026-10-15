import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GPTBOT_UA, WEBAUDIT_UA } from '../src/agentic/http';
import { runAgentic, type AgenticJob } from '../src/extension/background/agentic';
import { DebuggerSession, selfTarget, withDebugger } from '../src/extension/background/debugger';
import { runEngine, type EngineJob } from '../src/extension/background/engine';
import { runNavigation } from '../src/engine/engine';
import type { EngineResult } from '../src/engine/result';
import { flawedDesktopResult } from './engine/fixture';
import { compliantSite, type FixtureSite } from './fixtures/sites';

vi.mock('../src/engine/engine', () => ({ runNavigation: vi.fn() }));
const engine = vi.mocked(runNavigation);

const WORKER_URL = 'chrome-extension://webauditplus/background.js';
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

type Debuggee = chrome.debugger.Debuggee;
type DetachListener = (source: Debuggee, reason: string) => void;

/**
 * `chrome.debugger` and `chrome.tabs`, as the worker sees them: one attachment per target, commands
 * that fail once a target is detached, and Chrome-initiated detaches (the infobar, a closed tab).
 */
function fakeChrome() {
  const attached = new Set<string>();
  const key = (target: Debuggee): string => (target.tabId !== undefined ? `tab:${target.tabId}` : `target:${target.targetId}`);
  const detachListeners = new Set<DetachListener>();
  const eventListeners = new Set<(source: Debuggee, method: string, params?: object) => void>();
  const commands: Array<{ target: Debuggee; method: string; params?: object }> = [];
  const tabs = new Map<number, { id: number; url: string }>([[1, { id: 1, url: 'https://site.test/page' }]]);
  let refuseAttach: string | undefined;
  let detachDelayMs = 0;
  const api = {
    debugger: {
      attach: vi.fn(async (target: Debuggee) => {
        if (refuseAttach) throw new Error(refuseAttach);
        if (attached.has(key(target))) throw new Error(`Another debugger is already attached to the tab with id: ${target.tabId}.`);
        attached.add(key(target));
      }),
      detach: vi.fn(async (target: Debuggee) => {
        if (!attached.has(key(target))) throw new Error('Debugger is not attached');
        if (detachDelayMs) await new Promise((resolve) => setTimeout(resolve, detachDelayMs));
        attached.delete(key(target));
      }),
      sendCommand: vi.fn(async (target: Debuggee, method: string, params?: object) => {
        if (!attached.has(key(target))) throw new Error(`Debugger is not attached to the tab with id: ${target.tabId}.`);
        commands.push(params === undefined ? { target, method } : { target, method, params });
        return {};
      }),
      getTargets: vi.fn(async () => [{ id: 'worker-1', url: WORKER_URL, type: 'worker', attached: false, title: 'worker' }]),
      onDetach: { addListener: (l: DetachListener) => detachListeners.add(l), removeListener: (l: DetachListener) => detachListeners.delete(l) },
      onEvent: {
        addListener: (l: (source: Debuggee, method: string, params?: object) => void) => eventListeners.add(l),
        removeListener: (l: (source: Debuggee, method: string, params?: object) => void) => eventListeners.delete(l),
      },
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
  /** Chrome ends a session on its own: the infobar's Cancel, or the target went away. */
  const chromeDetaches = (target: Debuggee, reason: string): void => {
    attached.delete(key(target));
    for (const listener of [...detachListeners]) listener(target, reason);
  };
  const closeTab = (id: number): void => {
    tabs.delete(id);
    chromeDetaches({ tabId: id }, 'target_closed');
  };
  const fireEvent = (source: Debuggee, method: string, params?: object): void => {
    for (const listener of [...eventListeners]) listener(source, method, params);
  };
  return {
    api,
    attached,
    commands,
    tabs,
    detachListeners,
    chromeDetaches,
    closeTab,
    fireEvent,
    refuseAttach: (message: string | undefined) => void (refuseAttach = message),
    slowDetach: (ms: number) => void (detachDelayMs = ms),
  };
}

type Fake = ReturnType<typeof fakeChrome>;
let fake: Fake;

beforeEach(() => {
  fake = fakeChrome();
  Object.defineProperty(globalThis, 'chrome', { value: fake.api, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'location', { value: { href: WORKER_URL }, configurable: true, writable: true });
  engine.mockReset();
});

describe('DebuggerSession', () => {
  it('detaches after the task, whether it returns or throws', async () => {
    expect(await withDebugger({ tabId: 1 }, async () => 'ok')).toBe('ok');
    expect(fake.attached.size).toBe(0);
    await expect(withDebugger({ tabId: 1 }, async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(fake.attached.size).toBe(0);
    expect(fake.api.debugger.detach).toHaveBeenCalledTimes(2);
    expect(fake.detachListeners.size).toBe(0);
  });

  it('explains an attach refused because DevTools has the tab, and leaves nothing behind', async () => {
    fake.refuseAttach('Another debugger is already attached to the tab with id: 1.');
    const task = vi.fn();
    await expect(withDebugger({ tabId: 1 }, task)).rejects.toThrow(/Another debugger is attached to this tab\. Close DevTools/);
    expect(task).not.toHaveBeenCalled();
    expect(fake.api.debugger.detach).not.toHaveBeenCalled();
    expect(fake.detachListeners.size).toBe(0);
    expect(fake.attached.size).toBe(0);
  });

  it('notices Chrome ending the session from the infobar, and does not detach twice', async () => {
    const session = await DebuggerSession.attach({ tabId: 1 });
    const reasons: string[] = [];
    session.onDetached((reason) => reasons.push(reason));
    fake.chromeDetaches({ tabId: 2 }, 'canceled_by_user');
    expect(session.attached).toBe(true);
    fake.chromeDetaches({ tabId: 1 }, 'canceled_by_user');
    expect(reasons).toEqual(['canceled_by_user']);
    expect(session.attached).toBe(false);
    await expect(session.send('Page.enable')).rejects.toThrow('Debugger detached before Page.enable');
    await session.detach();
    expect(fake.api.debugger.detach).not.toHaveBeenCalled();
    expect(fake.detachListeners.size).toBe(0);
  });

  it('tells a listener that arrives after Chrome already ended the session', async () => {
    const session = await DebuggerSession.attach({ tabId: 1 });
    fake.chromeDetaches({ tabId: 1 }, 'target_closed');
    const reasons: string[] = [];
    session.onDetached((reason) => reasons.push(reason));
    expect(reasons).toEqual(['target_closed']);
  });

  it('makes every caller of detach wait for Chrome to let go', async () => {
    fake.slowDetach(20);
    const session = await DebuggerSession.attach({ tabId: 1 });
    const first = session.detach();
    const second = session.detach();
    expect(fake.attached.size).toBe(1);
    await Promise.all([first, second]);
    expect(fake.attached.size).toBe(0);
    expect(fake.api.debugger.detach).toHaveBeenCalledTimes(1);
  });

  it('finds this worker among the debug targets', async () => {
    expect(await selfTarget()).toEqual({ targetId: 'worker-1' });
  });
});

describe('runEngine', () => {
  function job(overrides: Partial<EngineJob> = {}): EngineJob & { lost: string[]; controller: AbortController } {
    const controller = new AbortController();
    const lost: string[] = [];
    return {
      tabId: 1,
      url: 'https://site.test/page',
      formFactor: 'desktop',
      categories: ['performance'],
      signal: controller.signal,
      onStatus: () => undefined,
      onSessionLost: (reason) => lost.push(reason),
      lost,
      controller,
      ...overrides,
    };
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

  it('activates the tab, runs, and detaches on success', async () => {
    const result = flawedDesktopResult();
    engine.mockImplementation(async (page) => {
      const session = await page.target().createCDPSession();
      await session.send('Page.enable');
      return result as unknown as Awaited<ReturnType<typeof runNavigation>>;
    });
    const current = job();
    expect(await runEngine(current)).toBe(result);
    expect(fake.api.tabs.update).toHaveBeenCalledWith(1, { active: true });
    expect(fake.commands).toEqual([{ target: { tabId: 1 }, method: 'Page.enable' }]);
    expect(fake.attached.size).toBe(0);
    expect(fake.detachListeners.size).toBe(0);
  });

  it('detaches when the engine throws, and puts a tab left on about:blank back on the page', async () => {
    engine.mockImplementation(async () => {
      fake.tabs.get(1)!.url = 'about:blank';
      throw new Error('NO_FCP');
    });
    await expect(runEngine(job())).rejects.toThrow('NO_FCP');
    expect(fake.attached.size).toBe(0);
    expect(fake.tabs.get(1)?.url).toBe('https://site.test/page');
  });

  it('ends a cancelled run at once, even while the engine is gathering', async () => {
    engineThatKeepsGathering();
    const current = job();
    const pending = runEngine(current);
    await tick();
    await tick();
    expect(fake.attached.size).toBe(1);
    current.controller.abort(new Error('Cancelled'));
    await expect(pending).rejects.toThrow(/not attached/);
    expect(fake.attached.size).toBe(0);
    expect(fake.api.debugger.detach).toHaveBeenCalledTimes(1);
  });

  it('does not attach at all for a run cancelled before it started', async () => {
    engineThatKeepsGathering();
    const current = job();
    current.controller.abort(new Error('Cancelled'));
    await expect(runEngine(current)).rejects.toThrow('Cancelled');
    expect(fake.api.debugger.attach).not.toHaveBeenCalled();
    expect(engine).not.toHaveBeenCalled();
  });

  it('reports the infobar’s Cancel and stops', async () => {
    engineThatKeepsGathering();
    const current = job();
    const pending = runEngine(current);
    await tick();
    fake.chromeDetaches({ tabId: 1 }, 'canceled_by_user');
    await expect(pending).rejects.toThrow(/not attached/);
    expect(current.lost).toEqual(['canceled_by_user']);
    expect(fake.attached.size).toBe(0);
    expect(fake.api.debugger.detach).not.toHaveBeenCalled();
  });

  it('stops when the tab closes mid-run, with nothing left attached', async () => {
    engineThatKeepsGathering();
    const current = job();
    const pending = runEngine(current);
    await tick();
    fake.closeTab(1);
    await expect(pending).rejects.toThrow(/not attached/);
    expect(current.lost).toEqual(['target_closed']);
    expect(fake.attached.size).toBe(0);
  });

  it('fails before attaching when the tab is already gone', async () => {
    engineThatKeepsGathering();
    fake.tabs.delete(1);
    await expect(runEngine(job())).rejects.toThrow('No tab with id: 1.');
    expect(fake.api.debugger.attach).not.toHaveBeenCalled();
  });

  it('refuses a tab DevTools is attached to, with the reason, and nothing to detach', async () => {
    fake.refuseAttach('Another debugger is already attached to the tab with id: 1.');
    engineThatKeepsGathering();
    await expect(runEngine(job())).rejects.toThrow(/Another debugger is attached to this tab/);
    expect(engine).not.toHaveBeenCalled();
    expect(fake.api.debugger.detach).not.toHaveBeenCalled();
  });

  it('gives the engine the tab’s current URL, so a navigated tab is visible to it', async () => {
    engine.mockImplementation(async (page) => {
      fake.tabs.get(1)!.url = 'https://elsewhere.test/';
      throw new Error(`Navigated away to ${await page.url()}`);
    });
    await expect(runEngine(job())).rejects.toThrow('Navigated away to https://elsewhere.test/');
    expect(fake.attached.size).toBe(0);
  });
});

describe('runAgentic', () => {
  let site: FixtureSite;
  const realFetch = globalThis.fetch;
  beforeAll(async () => {
    site = await compliantSite();
  });
  afterAll(() => site.close());
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const overrides = (): Array<string | undefined> =>
    fake.commands.filter((command) => command.method === 'Network.setUserAgentOverride').map((command) => (command.params as { userAgent: string }).userAgent);

  function job(controller = new AbortController()): AgenticJob & { lost: string[]; controller: AbortController } {
    const lost: string[] = [];
    return { url: `${site.origin}/resume`, signal: controller.signal, step: () => undefined, onSessionLost: (reason: string) => lost.push(reason), lost, controller };
  }

  it('sets the crawler User-Agent on the worker’s own session, restores it, and detaches', async () => {
    const report = await runAgentic(job());
    // The fake session cannot change Node's own User-Agent, so B10 sees HTML here; the override calls are the point.
    expect(report.probes.find((probe) => probe.label === 'botUa')?.status).toBe(200);
    expect(fake.api.debugger.attach).toHaveBeenCalledWith({ targetId: 'worker-1' }, '1.3');
    expect(overrides()).toEqual([WEBAUDIT_UA, '', GPTBOT_UA, '']);
    expect(fake.attached.size).toBe(0);
    expect(fake.detachListeners.size).toBe(0);
  });

  it('restores the User-Agent and detaches when the crawler probe throws', async () => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      if (overrides().at(-1) === GPTBOT_UA) throw new TypeError('Failed to fetch');
      return realFetch(input, init);
    }) as typeof fetch;
    const report = await runAgentic(job());
    expect(report.probes.find((probe) => probe.label === 'botUa')).toMatchObject({ status: 0, error: expect.stringMatching(/Network error/) });
    expect(overrides()).toEqual([WEBAUDIT_UA, '', GPTBOT_UA, '']);
    expect(fake.attached.size).toBe(0);
  });

  it('stops at the next step when the run is cancelled, and detaches', async () => {
    const controller = new AbortController();
    const current = job(controller);
    current.step = () => controller.abort(new Error('Cancelled by the panel'));
    await expect(runAgentic(current)).rejects.toThrow('Cancelled by the panel');
    expect(fake.attached.size).toBe(0);
    expect(overrides().at(-1) ?? '').toBe('');
  });

  it('reports the infobar’s Cancel on its own session', async () => {
    const controller = new AbortController();
    const current = job(controller);
    current.onSessionLost = (reason) => controller.abort(new Error(`Session lost: ${reason}`));
    current.step = () => fake.chromeDetaches({ targetId: 'worker-1' }, 'canceled_by_user');
    await expect(runAgentic(current)).rejects.toThrow('Session lost: canceled_by_user');
    expect(fake.attached.size).toBe(0);
    expect(fake.api.debugger.detach).not.toHaveBeenCalled();
  });
});

/** Keep the fixture's type in use: the result the engine mock returns is the real one. */
export type _Result = EngineResult;
