const PROTOCOL_VERSION = '1.3';

/**
 * One `chrome.debugger` attachment. Detaching is idempotent and never throws, so it can sit in a
 * `finally` without masking the error that got us there. Chrome shows its "is debugging this
 * browser" bar while any session is attached; it goes away on detach.
 */
export class DebuggerSession {
  readonly target: chrome.debugger.Debuggee;
  #attached = true;
  /** The detach in flight, so every caller that asks waits for Chrome to actually let go. */
  #detaching: Promise<void> | undefined;
  readonly #listeners = new Set<(reason: string) => void>();
  /** Why Chrome ended the session, for a listener that arrives after it did. */
  #lostReason: string | undefined;
  readonly #onDetach = (source: chrome.debugger.Debuggee, reason: string): void => {
    if (!sameTarget(source, this.target) || !this.#attached) return;
    this.#attached = false;
    this.#lostReason = reason;
    chrome.debugger.onDetach.removeListener(this.#onDetach);
    for (const listener of this.#listeners) listener(reason);
  };

  private constructor(target: chrome.debugger.Debuggee) {
    this.target = target;
    chrome.debugger.onDetach.addListener(this.#onDetach);
  }

  static async attach(target: chrome.debugger.Debuggee): Promise<DebuggerSession> {
    try {
      await chrome.debugger.attach(target, PROTOCOL_VERSION);
    } catch (error) {
      throw new Error(explainAttachError(error));
    }
    return new DebuggerSession(target);
  }

  get attached(): boolean {
    return this.#attached;
  }

  async send<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.#attached) throw new Error(`Debugger detached before ${method}`);
    return (await chrome.debugger.sendCommand(this.target, method, params)) as T;
  }

  /** Called when Chrome ends the session: the user cancelled it from the infobar, or the target closed. */
  onDetached(listener: (reason: string) => void): () => void {
    if (this.#lostReason !== undefined) {
      listener(this.#lostReason);
      return () => undefined;
    }
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async detach(): Promise<void> {
    if (this.#attached) {
      this.#attached = false;
      chrome.debugger.onDetach.removeListener(this.#onDetach);
      this.#listeners.clear();
      this.#detaching = chrome.debugger.detach(this.target).catch(() => undefined);
    }
    await this.#detaching;
  }
}

function sameTarget(a: chrome.debugger.Debuggee, b: chrome.debugger.Debuggee): boolean {
  if (b.tabId !== undefined) return a.tabId === b.tabId;
  if (b.targetId !== undefined) return a.targetId === b.targetId;
  return a.extensionId === b.extensionId;
}

function explainAttachError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/another debugger is already attached/i.test(message)) {
    return 'Another debugger is attached to this tab. Close DevTools for it (or the other extension using it) and run again.';
  }
  if (/cannot access|cannot attach/i.test(message)) {
    return `Chrome does not allow debugging this page (${message}).`;
  }
  return `Could not attach the debugger: ${message}`;
}

/** Run `task` with a session attached, and always detach afterwards. */
export async function withDebugger<T>(target: chrome.debugger.Debuggee, task: (session: DebuggerSession) => Promise<T>): Promise<T> {
  const session = await DebuggerSession.attach(target);
  try {
    return await task(session);
  } finally {
    await session.detach();
  }
}

/** The debug target of this background worker, so its own requests can carry a User-Agent override. */
export async function selfTarget(): Promise<chrome.debugger.Debuggee> {
  const here = globalThis.location.href;
  const targets = await chrome.debugger.getTargets();
  const self = targets.find((target) => target.url === here);
  if (!self) throw new Error('Could not find the background worker among the debug targets');
  return { targetId: self.id };
}
