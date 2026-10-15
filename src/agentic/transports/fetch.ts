import { MAX_PROBE_BYTES, PROBE_TIMEOUT_MS, toHeaderMap } from '../http';
import type { ProbeRequest, ProbeResponse, Transport } from '../types';
import { describeError, readCapped } from './body';

/**
 * Sets the User-Agent for every request the current context sends. In the extension this is
 * `Network.setUserAgentOverride` on a debugger session attached to the background worker itself:
 * `fetch()` cannot set `User-Agent` (Chrome drops it as a forbidden header), so the override is the
 * only way to send GPTBot's.
 */
export interface UserAgentControl {
  /** `undefined` restores the browser's own User-Agent. */
  set(userAgent: string | undefined): Promise<void>;
}

export interface FetchTransportOptions {
  fetch?: typeof fetch;
  /**
   * Without one, a requested User-Agent is sent as a header, which works in Node. With one, it is set
   * through the control, and those probes run alone: the override applies to every request in flight.
   */
  userAgent?: UserAgentControl;
  /** Requests for this User-Agent use the browser's own instead, which is a real browser's. */
  nativeUserAgent?: string;
  /** Aborts every probe in flight; they come back as errors, never rejections. */
  signal?: AbortSignal;
  /**
   * Time to first byte from the platform's resource timing, for a request to `url` that started at
   * `startedAt` (on the `performance.now()` clock). When it returns undefined, the time until `fetch`
   * resolved is used, which is the same moment seen a little later.
   */
  measure?: (url: string, startedAt: number) => number | undefined;
}

/**
 * A `fetch`-based transport for browsers: redirects are followed by the platform (only the start and
 * end of the chain are visible), cookies are omitted and the HTTP cache is bypassed, so every probe
 * sees what a first-time agent sees.
 */
export function createFetchTransport(options: FetchTransportOptions = {}): Transport {
  const gate = new ReadWriteGate();
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);

  return {
    probe(request) {
      const userAgent = request.userAgent === options.nativeUserAgent ? undefined : request.userAgent;
      if (!userAgent || !options.userAgent) {
        return gate.shared(() => fetchProbe(fetchImpl, request, userAgent, options));
      }
      const control = options.userAgent;
      return gate.exclusive(async () => {
        try {
          await control.set(userAgent);
        } catch (error) {
          return failed(request, 0, `Could not set the User-Agent: ${describeError(error, false)}`);
        }
        try {
          return await fetchProbe(fetchImpl, request, undefined, options);
        } finally {
          await control.set(undefined).catch(() => undefined);
        }
      });
    },
  };
}

async function fetchProbe(
  fetchImpl: typeof fetch,
  request: ProbeRequest,
  headerUserAgent: string | undefined,
  options: FetchTransportOptions,
): Promise<ProbeResponse> {
  const started = performance.now();
  if (options.signal?.aborted) return failed(request, 0, 'Cancelled');
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), request.timeoutMs ?? PROBE_TIMEOUT_MS);
  const signal = options.signal ? anySignal([timeout.signal, options.signal]) : timeout.signal;
  const headers: Record<string, string> = { Accept: request.accept ?? '*/*' };
  if (headerUserAgent) headers['User-Agent'] = headerUserAgent;

  try {
    const response = await fetchImpl(request.url, { headers, redirect: 'follow', credentials: 'omit', cache: 'no-store', signal });
    const headAt = performance.now();
    const { body, truncated } = await readCapped(response, request.maxBytes ?? MAX_PROBE_BYTES);
    const finalUrl = response.url || request.url;
    const result: ProbeResponse = {
      url: request.url,
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      headers: toHeaderMap(response.headers.entries()),
      body,
      ttfbMs: options.measure?.(request.url, started) ?? headAt - started,
      totalMs: performance.now() - started,
      redirected: response.redirected,
      finalUrl,
      redirectChain: response.redirected ? [request.url, finalUrl] : [request.url],
    };
    if (truncated) result.truncated = true;
    return result;
  } catch (error) {
    const reason = options.signal?.aborted ? 'Cancelled' : describeError(error, timeout.signal.aborted);
    return failed(request, performance.now() - started, reason);
  } finally {
    clearTimeout(timer);
  }
}

function failed(request: ProbeRequest, elapsed: number, error: string): ProbeResponse {
  return {
    url: request.url,
    ok: false,
    status: 0,
    headers: {},
    body: '',
    ttfbMs: elapsed,
    totalMs: elapsed,
    redirected: false,
    finalUrl: request.url,
    redirectChain: [request.url],
    error,
  };
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(signals);
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) return AbortSignal.abort(signal.reason);
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

/**
 * Many readers or one writer, first come first served. Probes that set a User-Agent hold it
 * exclusively, so the override can never leak into a probe that did not ask for it, and a probe
 * queued behind an exclusive one waits its turn rather than slipping in alongside it.
 */
export class ReadWriteGate {
  #readers = 0;
  #writer = false;
  readonly #queue: Array<{ exclusive: boolean; resolve: () => void }> = [];

  async shared<T>(task: () => Promise<T>): Promise<T> {
    await this.#acquire(false);
    try {
      return await task();
    } finally {
      this.#readers -= 1;
      this.#drain();
    }
  }

  async exclusive<T>(task: () => Promise<T>): Promise<T> {
    await this.#acquire(true);
    try {
      return await task();
    } finally {
      this.#writer = false;
      this.#drain();
    }
  }

  #acquire(exclusive: boolean): Promise<void> {
    return new Promise((resolve) => {
      this.#queue.push({ exclusive, resolve });
      this.#drain();
    });
  }

  #drain(): void {
    while (!this.#writer) {
      const next = this.#queue[0];
      if (!next) return;
      if (next.exclusive) {
        if (this.#readers > 0) return;
        this.#writer = true;
      } else {
        this.#readers += 1;
      }
      this.#queue.shift();
      next.resolve();
    }
  }
}
