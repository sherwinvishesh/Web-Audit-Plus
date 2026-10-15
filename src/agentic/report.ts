import { runChecks } from './checks';
import { detectFramework } from './framework';
import { header } from './http';
import { fixSteps, priceFixes, scoreChecks } from './score';
import type { AgenticReport, Evidence, ProbeLabel, ProbeResponse, ProbeSummary } from './types';

/** Evidence in, a scored and priced report out. Pure. */
export function buildAgenticReport(e: Evidence): AgenticReport {
  const results = runChecks(e);
  const score = scoreChecks(results);
  const checks = priceFixes(results, score);
  const report: AgenticReport = {
    url: e.target,
    twinUrl: e.twinUrl,
    fetchedAt: e.fetchedAt,
    score,
    checks,
    fixes: fixSteps(checks, score),
    probes: summarizeProbes(e),
  };
  const framework = e.html.body ? detectFramework(e.html.body, e.html.headers) : undefined;
  if (framework) report.framework = framework;
  return report;
}

const encoder = new TextEncoder();

export function summarizeProbe(label: ProbeLabel, response: ProbeResponse): ProbeSummary {
  const summary: ProbeSummary = {
    label,
    url: response.url,
    status: response.status,
    ttfbMs: Math.round(response.ttfbMs),
    redirected: response.redirected,
    finalUrl: response.finalUrl,
    bytes: encoder.encode(response.body).byteLength,
  };
  const contentType = header(response, 'content-type');
  if (contentType) summary.contentType = contentType;
  if (response.truncated) summary.truncated = true;
  if (response.error) summary.error = response.error;
  return summary;
}

function summarizeProbes(e: Evidence): ProbeSummary[] {
  return [
    summarizeProbe('html', e.html),
    summarizeProbe('robots', e.robots),
    summarizeProbe('llms', e.llms),
    summarizeProbe('sitemap', e.sitemap),
    ...e.sitemapChildren.map((child) => summarizeProbe('sitemapChild', child)),
    summarizeProbe('twin', e.twin),
    summarizeProbe('acceptMarkdown', e.acceptMarkdown),
    summarizeProbe('botUa', e.botUa),
    summarizeProbe('notAcceptable', e.notAcceptable),
  ];
}
