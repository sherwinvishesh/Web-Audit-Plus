/**
 * Types for the Agentic engine. Everything here is plain JSON-serialisable data, because evidence
 * and results cross the extension's message ports and are persisted with each run.
 *
 * The engine has three strictly separated layers (docs/SPEC.md §4.1):
 *   evidence = await gatherEvidence(url, transport)  // all network I/O, once
 *   results  = runChecks(evidence)                   // pure
 *   score    = scoreChecks(results)                  // arithmetic only
 */

export type Status = 'pass' | 'partial' | 'fail' | 'locked' | 'na';
export type CheckCategory = 'A' | 'B';

/** Response headers, keys lower-cased. Repeated headers are joined with ", " as `Headers.get` does. */
export type HeaderMap = Record<string, string>;

export interface ProbeRequest {
  url: string;
  /** Sent as the `Accept` header. Omitted means the transport's default (`*\/*`). */
  accept?: string;
  /** Sent as the `User-Agent` header. Omitted means the transport's default. */
  userAgent?: string;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface ProbeResponse {
  /** The URL that was requested. */
  url: string;
  ok: boolean;
  /** 0 when the request never produced a response (network error, timeout). */
  status: number;
  headers: HeaderMap;
  body: string;
  /** Milliseconds from request start to the response head. */
  ttfbMs: number;
  totalMs: number;
  redirected: boolean;
  /** Where the request landed after redirects. Equals `url` when nothing redirected. */
  finalUrl: string;
  /** Every URL visited, in order, when the transport can see the chain. */
  redirectChain?: string[];
  /** The body stopped at the byte cap; `body` is its start. */
  truncated?: boolean;
  /** Network error or timeout. Recorded, never thrown. */
  error?: string;
}

export interface Transport {
  /** Never rejects: failures come back as a response with `status: 0` and `error`. */
  probe(request: ProbeRequest): Promise<ProbeResponse>;
}

/** Which probe a progress event is about. */
export type ProbeLabel =
  | 'html'
  | 'robots'
  | 'llms'
  | 'sitemap'
  | 'sitemapChild'
  | 'twin'
  | 'acceptMarkdown'
  | 'botUa'
  | 'notAcceptable';

export interface ProbeProgress {
  phase: 'start' | 'done';
  label: ProbeLabel;
  url: string;
  /** Present on `done`. */
  status?: number;
  ttfbMs?: number;
  error?: string;
}

export interface Evidence {
  /** The audited page URL, as a string so the object stays serialisable. */
  target: string;
  origin: string;
  /** ISO timestamp of when the evidence was gathered. Checks that talk about age read this, never the clock. */
  fetchedAt: string;
  /** Where timings were measured from, for the A6 reason. */
  measuredFrom: 'node' | 'browser';
  /** Probe 1: the page as a browser. */
  html: ProbeResponse;
  robots: ProbeResponse;
  llms: ProbeResponse;
  sitemap: ProbeResponse;
  /** When the sitemap is a `<sitemapindex>`, its first children, fetched on the audited origin. */
  sitemapChildren: ProbeResponse[];
  /** The markdown twin, at `twinUrl`. */
  twin: ProbeResponse;
  twinUrl: string;
  /** A same-origin http(s) twin the HTML's Link header advertised. */
  advertisedTwinUrl?: string;
  /** A twin advertised on another origin or scheme. Reported, never fetched. */
  foreignTwinUrl?: string;
  /** Probe 6: same URL, `Accept: text/markdown`, Web Audit+'s own User-Agent. */
  acceptMarkdown: ProbeResponse;
  /** Probe 7: same URL as GPTBot, `Accept: *\/*`. */
  botUa: ProbeResponse;
  botName: string;
  /** Probe 8: same URL, `Accept: application/pdf`. */
  notAcceptable: ProbeResponse;
}

export interface CheckDefinition {
  id: string;
  category: CheckCategory;
  /** A label only; weight carries importance. */
  required: boolean;
  /** Maximum points. */
  weight: number;
  /** What the check verifies, in plain language. */
  title: string;
}

/**
 * One entry in the check registry: its definition plus a pure function over the evidence. Adding a
 * check means one new file in `checks/` exporting one of these, and one line in the registry array.
 */
export interface AgenticCheck extends CheckDefinition {
  run(evidence: Evidence): CheckResult;
}

/**
 * A check's verdict.
 *
 * `reason`, `detail` and `fix` are markdown-lite: plain prose plus inline code spans. Every value
 * that came from the audited site is wrapped in a code span by `codeSpan()`, so the UI can render
 * it as an inert chip and a fix prompt can quote it without letting it act as instructions.
 */
export interface CheckResult extends CheckDefinition {
  status: Status;
  /** 0..weight. */
  earned: number;
  /** One specific sentence naming the exact header, rule, bot or value found. */
  reason: string;
  detail?: string;
  /** The next step, for anything short of a pass. Carries its price as "(+N)" in score points once scored. */
  fix?: string;
  /** Score points (of 100) this check would add if it passed. Set on fail/partial by `priceFixes`. */
  price?: number;
  /** For `locked`: the check that has to pass first. */
  lockedBy?: string;
}

export interface Score {
  /** 0..100, rounded once. */
  value: number;
  earned: number;
  /** Σ weight over pass | partial | fail. */
  possible: number;
  counts: Record<Status, number>;
  /** Weight lost per check (weight − earned), for fail and partial. */
  lost: Array<{ id: string; points: number }>;
  /** What is waiting behind a failed prerequisite. */
  locked: { count: number; points: number; gain: number; unlockedBy: string[] };
}

export interface Framework {
  id: FrameworkId;
  name: string;
  /** What gave it away. */
  evidence: string;
}

export type FrameworkId =
  | 'nextjs'
  | 'nuxt'
  | 'astro'
  | 'sveltekit'
  | 'remix'
  | 'gatsby'
  | 'docusaurus'
  | 'hugo'
  | 'jekyll'
  | 'wordpress'
  | 'shopify'
  | 'webflow'
  | 'wix'
  | 'squarespace'
  | 'vite'
  | 'plain';

/** One ranked entry in the "do this next" list, in score points. */
export interface FixStep {
  id: string;
  points: number;
  /** The check's fix line, price stripped. */
  text: string;
  /** Number of checks this step also unlocks. */
  unlocks: number;
}

export interface AgenticReport {
  url: string;
  twinUrl: string;
  fetchedAt: string;
  framework?: Framework;
  score: Score;
  checks: CheckResult[];
  /** Ranked, most points first. */
  fixes: FixStep[];
  /** Summary of the probes, without bodies. */
  probes: ProbeSummary[];
}

export interface ProbeSummary {
  label: ProbeLabel;
  url: string;
  status: number;
  ttfbMs: number;
  contentType?: string;
  redirected: boolean;
  finalUrl: string;
  bytes: number;
  truncated?: boolean;
  error?: string;
}
