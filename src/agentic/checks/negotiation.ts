import { header } from '../http';
import type { Evidence, ProbeResponse } from '../types';
import { q } from './helpers';

/**
 * Whether a negotiated response reached its markdown by redirect, which breaks the same-URL
 * contract. Compared with where the browser's request landed rather than with the target, so a site
 * that redirects every request (a trailing slash, say) is not blamed for the markdown following suit.
 */
export function redirectedAway(response: ProbeResponse, e: Evidence): boolean {
  return response.redirected && response.finalUrl !== e.html.finalUrl;
}

/** The Content-Type a probe came back with, quoted, or "no Content-Type". */
export function describeContentType(response: ProbeResponse): string {
  const value = header(response, 'content-type');
  return value ? q(value) : 'no Content-Type';
}
