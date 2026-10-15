/**
 * The engine drives the browser through a Puppeteer `Page`, but only touches two things on it:
 * `page.url()` and `page.target().createCDPSession()`. From the session it needs `send`, `id`,
 * protocol events (by name and as a `'*'` wildcard), and `'sessionattached'` for the iframes and
 * workers it auto-attaches to. This file provides exactly that over `chrome.debugger`, so the engine
 * runs on the tab the user is looking at without Puppeteer's transport.
 *
 * Child targets use flat sessions: `chrome.debugger` (Chrome 125+) tags their events with
 * `source.sessionId` and accepts `{tabId, sessionId}` as a command target.
 *
 * `chrome.debugger` only opens the tab-level protocol domains. The one browser-level command
 * the engine sends, `Browser.getVersion`, and the few closed domains it touches are answered by the
 * caller's `LocalCommands` instead (see ./local-commands.ts).
 */

type Handler = (...args: unknown[]) => void;

export interface DebuggerApi {
  sendCommand(target: chrome.debugger.DebuggerSession, method: string, params?: object): Promise<unknown>;
  onEvent: {
    addListener(listener: (source: chrome.debugger.DebuggerSession, method: string, params?: object) => void): void;
    removeListener(listener: (source: chrome.debugger.DebuggerSession, method: string, params?: object) => void): void;
  };
}

interface AttachedToTargetEvent {
  sessionId: string;
}

export class CdpSession {
  readonly #connection: CdpConnection;
  readonly #sessionId: string | undefined;
  readonly #handlers = new Map<string, Set<Handler>>();

  constructor(connection: CdpConnection, sessionId: string | undefined) {
    this.#connection = connection;
    this.#sessionId = sessionId;
  }

  /** The engine keys its targets by this; the root has no protocol session id of its own. */
  id(): string {
    return this.#sessionId ?? ROOT_SESSION_ID;
  }

  /** `options` carries Puppeteer's per-command timeout; the engine enforces its own, so it is unused. */
  send(method: string, params?: object, _options?: { timeout?: number }): Promise<unknown> {
    return this.#connection.send(this.#sessionId, method, params);
  }

  on(event: string, handler: Handler): this {
    let handlers = this.#handlers.get(event);
    if (!handlers) this.#handlers.set(event, (handlers = new Set()));
    handlers.add(handler);
    return this;
  }

  off(event: string, handler: Handler): this {
    this.#handlers.get(event)?.delete(handler);
    return this;
  }

  /** The run owns the debugger attachment and ends it in one place; the engine's detach is a no-op. */
  async detach(): Promise<void> {}

  /** @internal Deliver a protocol event the way Puppeteer does: by name, then to `'*'` with the name. */
  dispatch(method: string, params: unknown): void {
    for (const handler of [...(this.#handlers.get(method) ?? [])]) handler(params);
    for (const handler of [...(this.#handlers.get('*') ?? [])]) handler(method, params);
  }

  /** @internal */
  emitAttached(child: CdpSession): void {
    for (const handler of [...(this.#handlers.get('sessionattached') ?? [])]) handler(child);
  }
}

const ROOT_SESSION_ID = 'webauditplus-root';

/** Commands answered without the debugger, for protocol domains `chrome.debugger` does not expose. */
export type LocalCommands = Readonly<Record<string, (params?: object) => Promise<unknown>>>;

/** The root session of one tab plus every child session Chrome attaches under it. */
export class CdpConnection {
  readonly root: CdpSession;
  readonly #api: DebuggerApi;
  readonly #tabId: number;
  readonly #local: LocalCommands;
  readonly #children = new Map<string, CdpSession>();
  #closed = false;

  readonly #onEvent = (source: chrome.debugger.DebuggerSession, method: string, params?: object): void => {
    if (this.#closed || source.tabId !== this.#tabId) return;
    const session = source.sessionId === undefined ? this.root : this.#children.get(source.sessionId);
    if (!session) return;
    if (method === 'Target.attachedToTarget') {
      const { sessionId } = params as AttachedToTargetEvent;
      const child = new CdpSession(this, sessionId);
      this.#children.set(sessionId, child);
      session.dispatch(method, params);
      session.emitAttached(child);
      return;
    }
    if (method === 'Target.detachedFromTarget') {
      const { sessionId } = params as AttachedToTargetEvent;
      this.#children.delete(sessionId);
    }
    session.dispatch(method, params);
  };

  constructor(api: DebuggerApi, tabId: number, localCommands: LocalCommands = {}) {
    this.#api = api;
    this.#tabId = tabId;
    this.#local = localCommands;
    this.root = new CdpSession(this, undefined);
    api.onEvent.addListener(this.#onEvent);
  }

  send(sessionId: string | undefined, method: string, params?: object): Promise<unknown> {
    if (this.#closed) return Promise.reject(new Error(`Target closed: ${method} after the run ended`));
    const local = this.#local[method];
    if (local) return local(params);
    const target: chrome.debugger.DebuggerSession = sessionId === undefined ? { tabId: this.#tabId } : { tabId: this.#tabId, sessionId };
    return this.#api.sendCommand(target, method, params);
  }

  close(): void {
    this.#closed = true;
    this.#children.clear();
    this.#api.onEvent.removeListener(this.#onEvent);
  }
}

/** The slice of Puppeteer's `Page` the engine calls. */
export interface EnginePage {
  url(): Promise<string>;
  target(): { createCDPSession(): Promise<CdpSession> };
}

export function pageFor(connection: CdpConnection, currentUrl: () => Promise<string>): EnginePage {
  return {
    url: currentUrl,
    target: () => ({ createCDPSession: async () => connection.root }),
  };
}
