import { describe, expect, it, vi } from 'vitest';
import { CdpConnection, pageFor, type CdpSession, type DebuggerApi } from '../../src/engine/cdp';
import { JS_COVERAGE_UNAVAILABLE, LOCAL_COMMANDS } from '../../src/engine/local-commands';

type Listener = (source: chrome.debugger.DebuggerSession, method: string, params?: object) => void;

/** `chrome.debugger`, recorded: commands go into `sent`, and `fire` plays an event from Chrome. */
function fakeDebugger() {
  const listeners = new Set<Listener>();
  const sent: Array<{ target: chrome.debugger.DebuggerSession; method: string; params?: object }> = [];
  const api: DebuggerApi = {
    sendCommand: vi.fn(async (target: chrome.debugger.DebuggerSession, method: string, params?: object) => {
      sent.push(params === undefined ? { target, method } : { target, method, params });
      return { ok: method };
    }),
    onEvent: { addListener: (listener) => listeners.add(listener), removeListener: (listener) => listeners.delete(listener) },
  };
  const fire = (source: chrome.debugger.DebuggerSession, method: string, params?: object): void => {
    for (const listener of [...listeners]) listener(source, method, params);
  };
  return { api, sent, fire, listeners };
}

describe('CdpConnection', () => {
  it('sends root commands to the tab, and child commands to their session', async () => {
    const chrome = fakeDebugger();
    const connection = new CdpConnection(chrome.api, 7);
    await connection.root.send('Page.enable');
    const children: CdpSession[] = [];
    connection.root.on('sessionattached', (child) => children.push(child as CdpSession));
    chrome.fire({ tabId: 7 }, 'Target.attachedToTarget', { sessionId: 'iframe-1', targetInfo: { type: 'iframe' } });
    expect(children).toHaveLength(1);
    expect(children[0]?.id()).toBe('iframe-1');
    await children[0]?.send('Runtime.enable', { foo: 1 });
    expect(chrome.sent).toEqual([
      { target: { tabId: 7 }, method: 'Page.enable' },
      { target: { tabId: 7, sessionId: 'iframe-1' }, method: 'Runtime.enable', params: { foo: 1 } },
    ]);
  });

  it('delivers events by name and to the wildcard, per session and per tab', () => {
    const chrome = fakeDebugger();
    const connection = new CdpConnection(chrome.api, 7);
    const named = vi.fn();
    const wildcard = vi.fn();
    connection.root.on('Network.requestWillBeSent', named);
    connection.root.on('*', wildcard);
    chrome.fire({ tabId: 7 }, 'Network.requestWillBeSent', { requestId: '1' });
    chrome.fire({ tabId: 8 }, 'Network.requestWillBeSent', { requestId: 'other tab' });
    chrome.fire({ tabId: 7, sessionId: 'unknown' }, 'Network.requestWillBeSent', { requestId: 'unknown session' });
    expect(named).toHaveBeenCalledTimes(1);
    expect(named).toHaveBeenCalledWith({ requestId: '1' });
    expect(wildcard).toHaveBeenCalledWith('Network.requestWillBeSent', { requestId: '1' });
    connection.root.off('Network.requestWillBeSent', named);
    chrome.fire({ tabId: 7 }, 'Network.requestWillBeSent', { requestId: '2' });
    expect(named).toHaveBeenCalledTimes(1);
  });

  it('routes a child’s events to the child until it detaches', () => {
    const chrome = fakeDebugger();
    const connection = new CdpConnection(chrome.api, 7);
    let child: CdpSession | undefined;
    connection.root.on('sessionattached', (session) => (child = session as CdpSession));
    chrome.fire({ tabId: 7 }, 'Target.attachedToTarget', { sessionId: 'worker-1' });
    const onChild = vi.fn();
    child?.on('Runtime.consoleAPICalled', onChild);
    chrome.fire({ tabId: 7, sessionId: 'worker-1' }, 'Runtime.consoleAPICalled', { n: 1 });
    chrome.fire({ tabId: 7 }, 'Target.detachedFromTarget', { sessionId: 'worker-1' });
    chrome.fire({ tabId: 7, sessionId: 'worker-1' }, 'Runtime.consoleAPICalled', { n: 2 });
    expect(onChild.mock.calls).toEqual([[{ n: 1 }]]);
  });

  it('answers local commands without the debugger', async () => {
    const chrome = fakeDebugger();
    const connection = new CdpConnection(chrome.api, 7, { 'Browser.getVersion': async () => ({ product: 'Chrome/150.0.0.0' }) });
    expect(await connection.root.send('Browser.getVersion')).toEqual({ product: 'Chrome/150.0.0.0' });
    expect(chrome.sent).toEqual([]);
  });

  it('stops listening and refuses commands once closed', async () => {
    const chrome = fakeDebugger();
    const connection = new CdpConnection(chrome.api, 7);
    connection.close();
    expect(chrome.listeners.size).toBe(0);
    await expect(connection.root.send('Page.enable')).rejects.toThrow(/Target closed/);
  });

  it('gives the engine a page whose session is the tab’s root', async () => {
    const connection = new CdpConnection(fakeDebugger().api, 7);
    const page = pageFor(connection, async () => 'https://site.test/');
    expect(await page.url()).toBe('https://site.test/');
    expect(await page.target().createCDPSession()).toBe(connection.root);
  });
});

describe('LOCAL_COMMANDS', () => {
  it('reports the browser’s version from its user agent', async () => {
    const version = (await LOCAL_COMMANDS['Browser.getVersion']?.()) as { product: string; userAgent: string };
    expect(version.userAgent).toBe(navigator.userAgent);
    expect(version.product).toMatch(/^Chrome\//);
  });

  it('turns the Animation domain into a no-op', async () => {
    await expect(LOCAL_COMMANDS['Animation.enable']?.()).resolves.toEqual({});
    await expect(LOCAL_COMMANDS['Animation.disable']?.()).resolves.toEqual({});
  });

  it('says why JavaScript coverage is unavailable', async () => {
    await expect(LOCAL_COMMANDS['Profiler.enable']?.()).rejects.toThrow(JS_COVERAGE_UNAVAILABLE);
  });
});
