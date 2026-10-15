import { gatherEvidence } from '../../agentic/evidence';
import { BROWSER_UA, header } from '../../agentic/http';
import { buildAgenticReport } from '../../agentic/report';
import { createFetchTransport } from '../../agentic/transports/fetch';
import type { AgenticReport, ProbeLabel, ProbeProgress } from '../../agentic/types';
import type { RunStep } from '../../shared/run';
import { isPageContentType } from '../../shared/url-policy';
import { selfTarget, withDebugger } from './debugger';

/**
 * The Agentic category, run from the background worker.
 *
 * Probes are sent by this worker's own `fetch`, not from inside the audited page: the extension's
 * host permission makes them exempt from CORS and from the page's Content-Security-Policy (a page
 * with `connect-src 'none'` blocks every in-page fetch, isolated worlds included), and cookies are
 * omitted, so the site answers the way it answers an agent. The only thing `fetch` cannot do is set
 * `User-Agent`; for the probes that need one, a debugger session attached to this worker applies
 * `Network.setUserAgentOverride`, one probe at a time, and restores it after.
 */

export const AGENTIC_STEPS: ReadonlyArray<{ label: ProbeLabel; title: string }> = [
  { label: 'html', title: 'Page, as a browser' },
  { label: 'robots', title: 'robots.txt' },
  { label: 'llms', title: 'llms.txt' },
  { label: 'sitemap', title: 'sitemap.xml' },
  { label: 'twin', title: 'Markdown twin' },
  { label: 'acceptMarkdown', title: 'Accept: text/markdown' },
  { label: 'botUa', title: 'GPTBot user agent' },
  { label: 'notAcceptable', title: 'Accept: application/pdf' },
];

const CHILD_STEP = 'agentic:sitemapChild';

export function agenticSteps(): RunStep[] {
  return AGENTIC_STEPS.map(({ label, title }) => ({ id: `agentic:${label}`, group: 'agentic', label: title, status: 'pending' }));
}

export interface AgenticJob {
  url: string;
  signal: AbortSignal;
  step(step: RunStep): void;
  /** Chrome ended the debugger session (the user pressed Cancel on its bar). */
  onSessionLost(reason: string): void;
}

export async function runAgentic(job: AgenticJob): Promise<AgenticReport> {
  return withDebugger(await selfTarget(), async (session) => {
    const stopWatching = session.onDetached((reason) => job.onSessionLost(reason));
    // A long session fills the default 250-entry buffer, after which timings silently stop.
    performance.clearResourceTimings();
    performance.setResourceTimingBufferSize(1000);
    try {
      const transport = createFetchTransport({
        userAgent: {
          // An empty string clears the override.
          set: async (userAgent) => void (await session.send('Network.setUserAgentOverride', { userAgent: userAgent ?? '' })),
        },
        nativeUserAgent: BROWSER_UA,
        signal: job.signal,
        measure: resourceTtfb,
      });
      const children = { started: 0, done: 0 };
      const evidence = await gatherEvidence(job.url, transport, {
        signal: job.signal,
        measuredFrom: 'browser',
        onProgress: (event) => job.step(stepFor(event, children)),
      });
      const page = evidence.html;
      if (page.status === 0) throw new Error(`Could not load the page: ${page.error ?? 'no response'}`);
      const contentType = header(page, 'content-type');
      if (page.ok && !isPageContentType(contentType)) {
        throw new Error(`This address serves ${contentType ?? 'an unknown type'}, not a web page.`);
      }
      return buildAgenticReport(evidence);
    } finally {
      stopWatching();
      performance.clearResourceTimings();
    }
  });
}

function stepFor(event: ProbeProgress, children: { started: number; done: number }): RunStep {
  if (event.label === 'sitemapChild') {
    if (event.phase === 'start') children.started += 1;
    else children.done += 1;
    const finished = children.done === children.started;
    return {
      id: CHILD_STEP,
      group: 'agentic',
      label: 'Child sitemaps',
      status: finished ? 'done' : 'running',
      detail: `${children.done} of ${children.started}`,
    };
  }
  const title = AGENTIC_STEPS.find((step) => step.label === event.label)?.title ?? event.label;
  const step: RunStep = { id: `agentic:${event.label}`, group: 'agentic', label: title, status: event.phase === 'start' ? 'running' : 'done' };
  if (event.phase === 'done') {
    if (event.error) {
      step.status = 'failed';
      step.detail = event.error;
    } else {
      step.detail = `${event.status} · ${Math.round(event.ttfbMs ?? 0)} ms`;
    }
  }
  return step;
}

/** Time to first byte from this worker's resource timing, for the probe that started at `startedAt`. */
function resourceTtfb(url: string, startedAt: number): number | undefined {
  const entries = performance.getEntriesByName(url, 'resource') as PerformanceResourceTiming[];
  // Probes of the same URL never overlap: the page URL's three are queued behind one another by the
  // User-Agent gate. So the first entry that started after this probe did is this probe's.
  const entry = entries.filter((candidate) => candidate.startTime >= startedAt - 1).sort((a, b) => a.startTime - b.startTime)[0];
  if (!entry || entry.responseStart <= 0) return undefined;
  return entry.responseStart - entry.startTime;
}
