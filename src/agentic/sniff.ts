import type { ProbeResponse } from './types';

/**
 * Never trust a status code: a catch-all route or SPA answers /robots.txt, /llms.txt and /x.md
 * with 200 and its HTML shell. These sniff the body instead.
 */

/** The body opens like an HTML document. */
export function looksLikeHtml(body: string): boolean {
  return /^\s*(<!doctype html|<html[\s>])/i.test(body.slice(0, 400));
}

/** A 2xx that is the file it claims to be, rather than an HTML page standing in for it. */
export function servesFile(response: ProbeResponse): boolean {
  return response.ok && !looksLikeHtml(response.body);
}
