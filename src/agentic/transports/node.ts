import { MAX_PROBE_BYTES, PROBE_TIMEOUT_MS, toHeaderMap } from '../http';
import type { ProbeRequest, ProbeResponse, Transport } from '../types';

const MAX_REDIRECTS = 20;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * A `fetch`-based transport for Node (tests and scripts). Redirects are followed by hand so the
 * chain is visible to the checks, bodies are streamed and capped, and failures come back as a
 * response with `status: 0` rather than a rejection.
 */
export function createNodeTransport(defaults: { userAgent?: string } = {}): Transport {
  return { probe: (request) => nodeProbe(request, defaults.userAgent) };
}

async function nodeProbe(request: ProbeRequest, defaultUserAgent: string | undefined): Promise<ProbeResponse> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), request.timeoutMs ?? PROBE_TIMEOUT_MS);
  const headers: Record<string, string> = { Accept: request.accept ?? '*/*' };
  const userAgent = request.userAgent ?? defaultUserAgent;
  if (userAgent) headers['User-Agent'] = userAgent;

  const chain = [request.url];
  let current = request.url;
  try {
    for (let hop = 0; ; hop += 1) {
      const response = await fetch(current, { headers, redirect: 'manual', signal: controller.signal });
      const location = response.headers.get('location');
      if (REDIRECT_STATUSES.has(response.status) && location) {
        await response.body?.cancel();
        if (hop >= MAX_REDIRECTS) throw new Error(`more than ${MAX_REDIRECTS} redirects`);
        current = new URL(location, current).toString();
        chain.push(current);
        continue;
      }
      const ttfbMs = performance.now() - started;
      const { body, truncated } = await readCapped(response, request.maxBytes ?? MAX_PROBE_BYTES);
      const result: ProbeResponse = {
        url: request.url,
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        headers: toHeaderMap(response.headers.entries()),
        body,
        ttfbMs,
        totalMs: performance.now() - started,
        redirected: chain.length > 1,
        finalUrl: current,
        redirectChain: chain,
      };
      if (truncated) result.truncated = true;
      return result;
    }
  } catch (error) {
    const elapsed = performance.now() - started;
    return {
      url: request.url,
      ok: false,
      status: 0,
      headers: {},
      body: '',
      ttfbMs: elapsed,
      totalMs: elapsed,
      redirected: chain.length > 1,
      finalUrl: current,
      redirectChain: chain,
      error: describeError(error, controller.signal),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(response: Response, maxBytes: number): Promise<{ body: string; truncated: boolean }> {
  if (!response.body) return { body: '', truncated: false };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let body = '';
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const room = maxBytes - received;
    if (value.byteLength >= room) {
      body += decoder.decode(value.subarray(0, room));
      await reader.cancel();
      return { body, truncated: true };
    }
    received += value.byteLength;
    body += decoder.decode(value, { stream: true });
  }
  return { body: body + decoder.decode(), truncated: false };
}

function describeError(error: unknown, signal: AbortSignal): string {
  if (signal.aborted) return 'Timed out waiting for a response';
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause && typeof cause === 'object' && 'code' in cause && typeof cause.code === 'string') return `${cause.code}: ${error.message}`;
    return error.message;
  }
  return String(error);
}
