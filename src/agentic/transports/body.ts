/**
 * Read a response body up to `maxBytes`, decoding as UTF-8. The stream is cancelled at the cap
 * rather than drained, so a multi-gigabyte response costs at most the cap.
 */
export async function readCapped(response: Response, maxBytes: number): Promise<{ body: string; truncated: boolean }> {
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

/** A one-line description of a failed request, for `ProbeResponse.error`. */
export function describeError(error: unknown, timedOut: boolean): string {
  if (timedOut) return 'Timed out waiting for a response';
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause && typeof cause === 'object' && 'code' in cause && typeof cause.code === 'string') return `${cause.code}: ${error.message}`;
    // Browsers report every network-level failure (DNS, refused, TLS, blocked) as this one TypeError.
    if (error.name === 'TypeError' && /failed to fetch|networkerror|load failed/i.test(error.message)) {
      return 'Network error: the request did not get a response (DNS, connection, TLS or a blocked request)';
    }
    return error.message;
  }
  return String(error);
}
