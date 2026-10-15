/** A Node-compatible `EventEmitter`, covering the API Lighthouse and its logger use. */

type Listener = (...args: never[]) => unknown;

export class EventEmitter {
  static defaultMaxListeners = 10;
  #events = new Map<string | symbol, Listener[]>();
  #maxListeners = EventEmitter.defaultMaxListeners;

  #add(event: string | symbol, listener: Listener, prepend: boolean): this {
    const listeners = this.#events.get(event) ?? [];
    this.#events.set(event, prepend ? [listener, ...listeners] : [...listeners, listener]);
    return this;
  }

  on(event: string | symbol, listener: Listener): this {
    return this.#add(event, listener, false);
  }

  addListener(event: string | symbol, listener: Listener): this {
    return this.#add(event, listener, false);
  }

  prependListener(event: string | symbol, listener: Listener): this {
    return this.#add(event, listener, true);
  }

  once(event: string | symbol, listener: Listener): this {
    const wrapped = Object.assign(
      (...args: never[]) => {
        this.removeListener(event, wrapped);
        return listener(...args);
      },
      { listener },
    );
    return this.#add(event, wrapped, false);
  }

  prependOnceListener(event: string | symbol, listener: Listener): this {
    const wrapped = Object.assign(
      (...args: never[]) => {
        this.removeListener(event, wrapped);
        return listener(...args);
      },
      { listener },
    );
    return this.#add(event, wrapped, true);
  }

  off(event: string | symbol, listener: Listener): this {
    return this.removeListener(event, listener);
  }

  removeListener(event: string | symbol, listener: Listener): this {
    const listeners = this.#events.get(event);
    if (!listeners) return this;
    const index = listeners.findIndex((candidate) => candidate === listener || (candidate as { listener?: Listener }).listener === listener);
    if (index === -1) return this;
    const next = listeners.slice();
    next.splice(index, 1);
    if (next.length === 0) this.#events.delete(event);
    else this.#events.set(event, next);
    return this;
  }

  removeAllListeners(event?: string | symbol): this {
    if (event === undefined) this.#events.clear();
    else this.#events.delete(event);
    return this;
  }

  emit(event: string | symbol, ...args: unknown[]): boolean {
    const listeners = this.#events.get(event);
    if (!listeners || listeners.length === 0) {
      if (event === 'error') throw args[0] instanceof Error ? args[0] : new Error(`Unhandled error event: ${String(args[0])}`);
      return false;
    }
    for (const listener of listeners.slice()) (listener as (...values: unknown[]) => unknown).apply(this, args);
    return true;
  }

  listeners(event: string | symbol): Listener[] {
    return (this.#events.get(event) ?? []).map((listener) => (listener as { listener?: Listener }).listener ?? listener);
  }

  rawListeners(event: string | symbol): Listener[] {
    return (this.#events.get(event) ?? []).slice();
  }

  listenerCount(event: string | symbol): number {
    return this.#events.get(event)?.length ?? 0;
  }

  eventNames(): Array<string | symbol> {
    return [...this.#events.keys()];
  }

  setMaxListeners(count: number): this {
    this.#maxListeners = count;
    return this;
  }

  getMaxListeners(): number {
    return this.#maxListeners;
  }
}

export default EventEmitter;
