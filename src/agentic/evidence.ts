import {
  BROWSER_ACCEPT,
  BROWSER_UA,
  GPTBOT_UA,
  header,
  HOSTILE_ACCEPT,
  MARKDOWN_ACCEPT,
  parseLinkAlternate,
  TWIN_ACCEPT,
  WEBAUDIT_UA,
} from './http';
import { twinUrl } from './routes';
import { childSitemapUrls } from './sitemap';
import type { Evidence, ProbeLabel, ProbeProgress, ProbeRequest, ProbeResponse, Transport } from './types';

/**
 * Everything the checks need, gathered in one pass. Probing is kept apart from checking so the
 * checks stay pure and are tested against synthetic evidence, with no network in the unit tests.
 *
 * Each live-URL probe is built so only one lever can explain a markdown answer:
 *  - B9 sends Web Audit+'s own User-Agent (on no bot list) with `Accept: text/markdown`;
 *  - B10 sends GPTBot's User-Agent with `Accept: *\/*`, which expresses no preference;
 *  - B11 sends `Accept: application/pdf`, which allows neither HTML nor markdown.
 */
export const PROBE_HEADERS = {
  acceptMarkdown: { userAgent: WEBAUDIT_UA, accept: MARKDOWN_ACCEPT },
  botUa: { userAgent: GPTBOT_UA, accept: '*/*' },
  notAcceptable: { accept: HOSTILE_ACCEPT },
} as const;

export interface GatherOptions {
  onProgress?: (event: ProbeProgress) => void;
  /** Where timings are measured from, for the A6 wording. */
  measuredFrom?: Evidence['measuredFrom'];
  signal?: AbortSignal;
  /** The clock, for tests. */
  now?: () => Date;
}

/** The order probes run in, for progress UIs that want to draw every step up front. */
export const PROBE_ORDER: readonly ProbeLabel[] = ['html', 'robots', 'llms', 'sitemap', 'twin', 'acceptMarkdown', 'botUa', 'notAcceptable'];

export async function gatherEvidence(url: string, transport: Transport, options: GatherOptions = {}): Promise<Evidence> {
  const target = new URL(url);
  target.hash = '';
  const origin = target.origin;
  const page = target.toString();
  const signal = options.signal;
  const fetchedAt = (options.now?.() ?? new Date()).toISOString();

  const run = async (label: ProbeLabel, request: ProbeRequest): Promise<ProbeResponse> => {
    signal?.throwIfAborted();
    options.onProgress?.({ phase: 'start', label, url: request.url });
    const response = await transport.probe(request);
    const done: ProbeProgress = { phase: 'done', label, url: request.url, status: response.status, ttfbMs: response.ttfbMs };
    if (response.error) done.error = response.error;
    options.onProgress?.(done);
    return response;
  };

  const html = await run('html', { url: page, userAgent: BROWSER_UA, accept: BROWSER_ACCEPT });
  signal?.throwIfAborted();
  const { advertisedTwinUrl, foreignTwinUrl } = resolveAdvertised(html, target);
  const canonicalTwinUrl = advertisedTwinUrl ?? twinUrl(page);

  const [robots, llms, sitemap, twin, acceptMarkdown, botUa, notAcceptable] = await Promise.all([
    run('robots', { url: new URL('/robots.txt', origin).toString() }),
    run('llms', { url: new URL('/llms.txt', origin).toString() }),
    run('sitemap', { url: new URL('/sitemap.xml', origin).toString() }),
    run('twin', { url: canonicalTwinUrl, accept: TWIN_ACCEPT }),
    run('acceptMarkdown', { url: page, ...PROBE_HEADERS.acceptMarkdown }),
    run('botUa', { url: page, ...PROBE_HEADERS.botUa }),
    run('notAcceptable', { url: page, ...PROBE_HEADERS.notAcceptable }),
  ]);
  signal?.throwIfAborted();

  const children = sitemap.ok ? childSitemapUrls(sitemap.body, origin) : [];
  const sitemapChildren = await Promise.all(children.map((child) => run('sitemapChild', { url: child })));
  signal?.throwIfAborted();

  const evidence: Evidence = {
    target: page,
    origin,
    fetchedAt,
    measuredFrom: options.measuredFrom ?? 'node',
    html,
    robots,
    llms,
    sitemap,
    sitemapChildren,
    twin,
    twinUrl: canonicalTwinUrl,
    acceptMarkdown,
    botUa,
    botName: 'GPTBot',
    notAcceptable,
  };
  if (advertisedTwinUrl) evidence.advertisedTwinUrl = advertisedTwinUrl;
  if (foreignTwinUrl) evidence.foreignTwinUrl = foreignTwinUrl;
  return evidence;
}

/**
 * The twin the HTML's Link header advertises: fetched if it is on this origin over http(s),
 * otherwise only reported. A Link header is not permission to request a third party's URL, or to
 * read a `data:` body as if the site had served it.
 */
export function resolveAdvertised(html: ProbeResponse, target: URL): { advertisedTwinUrl?: string; foreignTwinUrl?: string } {
  const advertised = parseLinkAlternate(header(html, 'link'));
  if (!advertised) return {};
  let resolved: URL;
  try {
    resolved = new URL(advertised, html.finalUrl || target);
  } catch {
    return {};
  }
  const sameSite = (resolved.protocol === 'http:' || resolved.protocol === 'https:') && resolved.origin === target.origin;
  return sameSite ? { advertisedTwinUrl: resolved.toString() } : { foreignTwinUrl: advertised };
}
