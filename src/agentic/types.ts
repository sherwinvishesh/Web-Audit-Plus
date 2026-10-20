/**
 * Types for the Agentic engine. Everything here is plain JSON-serialisable data, because evidence
 * and results cross the extension's message ports and are persisted with each run.
 *
 * The engine has three strictly separated layers:
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
  /**
   * Whether the check counts toward the score. The scored checks are what AI agents need from a
   * page today: a crawlable, fast, HTTPS page with its content in the HTML and nothing blocking the
   * bots. The rest are suggestions: conventions for agents (llms.txt, structured data, a markdown
   * twin) that even the best-served sites have not adopted yet. They are reported with a fix, and
   * never enter the denominator, so a page that does what the leaders do scores 100.
   */
  scored: boolean;
  /** OpenGSO's label; weight carries importance and `scored` says whether it counts. */
  required: boolean;
  /** Maximum points. Among suggestions, the weight only orders them. */
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
  /** The next step, for anything short of a pass. Carries its price as "(+N)" in score points once scored; a suggestion's has no price. */
  fix?: string;
  /** Score points (of 100) this check would add if it passed. Set on a scored fail/partial by `priceFixes`. */
  price?: number;
  /** For `locked`: the check that has to pass first. */
  lockedBy?: string;
}

export interface Score {
  /** 0..100, rounded once, over the scored checks only. */
  value: number;
  earned: number;
  /** Σ weight over the scored checks that returned pass | partial | fail. */
  possible: number;
  /** Every check's verdict, scored or not. */
  counts: Record<Status, number>;
  /** Weight lost per scored check (weight − earned), for fail and partial. */
  lost: Array<{ id: string; points: number }>;
  /** The suggestions, by where the page stands on them. `count` leaves out the ones that cannot apply. */
  suggestions: { count: number; adopted: number; open: number; locked: number };
  /** What is waiting behind a failed prerequisite: suggestions that cannot be measured until it passes. */
  locked: { count: number; unlockedBy: string[] };
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

/** One ranked entry in the "do this next" list: the scored fixes by points, then the suggestions by weight. */
export interface FixStep {
  id: string;
  /** Score points recovered. 0 for a suggestion. */
  points: number;
  /** The check's fix line, price stripped. */
  text: string;
  /** Number of checks this step also unlocks. */
  unlocks: number;
  /** Outside the score: a convention the page has not adopted. */
  suggestion?: boolean;
}

export interface AgenticReport {
  url: string;
  twinUrl: string;
  fetchedAt: string;
  framework?: Framework;
  score: Score;
  checks: CheckResult[];
  /** Ranked: the scored fixes, most points first, then the suggestions. */
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
