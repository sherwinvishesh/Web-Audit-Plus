import type { HeaderMap, ProbeResponse } from './types';

/** User-Agent constants. Web Audit+'s own UA is on no bot list, so B9 isolates the Accept header. */
export const WEBAUDIT_UA = 'WebAuditPlus/0.1 (+https://github.com/sherwinvishesh/Web-Audit-Plus)';
export const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
export const BROWSER_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
/** A realistic GPTBot User-Agent, for B10. */
export const GPTBOT_UA = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot';
export const TWIN_ACCEPT = 'text/markdown,*/*;q=0.5';
export const MARKDOWN_ACCEPT = 'text/markdown';
/** Accepts neither HTML nor markdown: the only case that should be answered with 406. */
export const HOSTILE_ACCEPT = 'application/pdf';
export const MARKDOWN_CONTENT_TYPE = 'text/markdown; charset=utf-8';

export const PROBE_TIMEOUT_MS = 15_000;
export const MAX_PROBE_BYTES = 8 * 1024 * 1024;

/** Case-insensitive header lookup. */
export function header(response: { headers: HeaderMap }, name: string): string | undefined {
  return response.headers[name.toLowerCase()];
}

/** Lower-case the keys of any header source into a `HeaderMap`. */
export function toHeaderMap(entries: Iterable<[string, string]>): HeaderMap {
  const out: HeaderMap = {};
  for (const [key, value] of entries) {
    const name = key.toLowerCase();
    out[name] = out[name] === undefined ? value : `${out[name]}, ${value}`;
  }
  return out;
}

/** A comma-separated header as lower-cased, trimmed tokens. */
export function headerTokens(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

/** `Vary` names `Accept` (or `*`) as a whole token. `Accept-Encoding` does not count. */
export function varyIncludesAccept(value: string | undefined): boolean {
  return headerTokens(value).some((token) => token === 'accept' || token === '*');
}

/** Whether a probe came back as markdown, by Content-Type. Parameters do not change the answer. */
export function isMarkdownResponse(response: ProbeResponse): boolean {
  return (header(response, 'content-type') ?? '').toLowerCase().includes('text/markdown');
}

/** An http(s) URL, or undefined. */
export function parseUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
}

/** The markdown alternate a `Link` header advertises, as written (unresolved). */
export function parseLinkAlternate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  for (const part of splitLinkHeader(value)) {
    const url = /<([^>]+)>/.exec(part)?.[1];
    if (!url) continue;
    const lowered = part.toLowerCase();
    if (!lowered.includes('rel="alternate"') && !lowered.includes('rel=alternate')) continue;
    if (lowered.includes('text/markdown')) return url;
  }
  return undefined;
}

/** Split on commas that separate link-values, not commas inside `<...>` or quotes. */
export function splitLinkHeader(value: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inAngle = false;
  let inQuote = false;
  for (const ch of value) {
    if (ch === '<') inAngle = true;
    else if (ch === '>') inAngle = false;
    else if (ch === '"') inQuote = !inQuote;
    if (ch === ',' && !inAngle && !inQuote) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}
