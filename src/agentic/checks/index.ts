import { servesFile } from '../sniff';
import type { AgenticCheck, CheckDefinition, CheckResult, Evidence } from '../types';
import { a1Robots } from './a1-robots';
import { a2LlmsTxt } from './a2-llms-txt';
import { a3Sitemap } from './a3-sitemap';
import { a4JsonLd } from './a4-json-ld';
import { a5RawHtmlContent } from './a5-raw-html-content';
import { a6Ttfb } from './a6-ttfb';
import { a7NoAiOptOut } from './a7-no-ai-optout';
import { a8HttpsHsts } from './a8-https-hsts';
import { b1TwinReachable } from './b1-twin-reachable';
import { b2TwinContentType } from './b2-twin-content-type';
import { b3TwinBody } from './b3-twin-body';
import { b4TokensHeader } from './b4-tokens-header';
import { b5Nosniff } from './b5-nosniff';
import { b6TwinNoindex } from './b6-twin-noindex';
import { b7VaryAccept } from './b7-vary-accept';
import { b8LinkAlternate } from './b8-link-alternate';
import { b9AcceptNegotiation } from './b9-accept-negotiation';
import { b10BotUaNegotiation } from './b10-bot-ua-negotiation';
import { b11NotAcceptable } from './b11-not-acceptable';
import { b12AeoVersion } from './b12-aeo-version';
import { b13HtmlUnaffected } from './b13-html-unaffected';
import { b14Drift } from './b14-drift';
import { na, q } from './helpers';

/** The registry, in report order. Adding a check is one file and one line here. */
export const CHECKS: readonly AgenticCheck[] = [
  a1Robots,
  a2LlmsTxt,
  a3Sitemap,
  a4JsonLd,
  a5RawHtmlContent,
  a6Ttfb,
  a7NoAiOptOut,
  a8HttpsHsts,
  b1TwinReachable,
  b2TwinContentType,
  b3TwinBody,
  b4TokensHeader,
  b5Nosniff,
  b6TwinNoindex,
  b7VaryAccept,
  b8LinkAlternate,
  b9AcceptNegotiation,
  b10BotUaNegotiation,
  b11NotAcceptable,
  b12AeoVersion,
  b13HtmlUnaffected,
  b14Drift,
];

export function checkDefinition(id: string): CheckDefinition {
  const check = CHECKS.find((entry) => entry.id === id);
  if (!check) throw new Error(`Unknown check ${id}`);
  return { id: check.id, category: check.category, scored: check.scored, required: check.required, weight: check.weight, title: check.title };
}

/** Every check against the evidence, then the twin cascade. Pure. */
export function runChecks(e: Evidence): CheckResult[] {
  const results = CHECKS.map((check) => {
    try {
      return check.run(e);
    } catch (error) {
      // One check's bug must not cost the other 21 their results. It leaves the denominator, and
      // says so, rather than inventing a verdict about the site.
      const message = error instanceof Error ? error.message : String(error);
      return na(check, `This check could not run on this page (${q(message, 200)}).`);
    }
  });
  return collapseTwinCascade(results, e);
}

/**
 * One missing twin costs one suggestion, not twelve.
 *
 * Without this, a site that has never served a markdown twin fails B1 and then fails a dozen more
 * checks that restate the same fact: there is no Content-Type to inspect on a document that does
 * not exist. So when the twin URL does not serve a file, everything downstream of it becomes
 * `locked` behind B1. The whole twin layer is a set of suggestions, so none of this touches the
 * score; what it changes is the report, which lists one suggestion to start with and says how many
 * more apply once a twin is served, instead of twelve separate findings about the same missing file.
 *
 * A twin that exists but is wrong is a different situation and is reported in full detail.
 */
export function collapseTwinCascade(results: CheckResult[], e: Evidence): CheckResult[] {
  if (servesFile(e.twin)) return results;
  return results.map((result) => {
    const why = LOCKED_ON_TWIN[result.id] ?? (result.status === 'pass' ? undefined : LOCKED_ON_LIVE_URL[result.id]);
    if (!why) return result;
    const { fix: _fix, price: _price, ...rest } = result;
    // What the live URL said is worth keeping: an AI crawler getting a 403 is a real finding even
    // though it is not this check's to score.
    const detail = result.id in LOCKED_ON_LIVE_URL ? (result.detail ?? result.reason) : result.detail;
    const lockedResult: CheckResult = {
      ...rest,
      status: 'locked',
      earned: 0,
      lockedBy: 'B1',
      reason: `No markdown twin at ${q(e.twinUrl)}, so ${why}. The missing twin is scored once, on B1.`,
    };
    if (detail) lockedResult.detail = detail;
    return lockedResult;
  });
}

/**
 * Read off the twin response itself. With no twin there is nothing to read, pass or fail: B5
 * "passing" because a 404 page happened to carry nosniff is noise, not a point earned.
 */
const LOCKED_ON_TWIN: Record<string, string> = {
  B2: 'there is no twin response whose Content-Type could be checked',
  B3: 'there is no twin body to measure',
  B4: 'there is no twin response to carry a token count',
  B5: 'there is no twin response to carry the header',
  B6: 'there is no twin response to keep out of the search index',
  B12: 'there is no markdown response to advertise a spec version on',
  B14: 'there is no twin that could have drifted',
};

/**
 * Probed against the live URL. These can genuinely succeed without a `.md` twin (a site can wire
 * Accept negotiation at the same URL), so a pass is kept and anything short of one is locked.
 */
const LOCKED_ON_LIVE_URL: Record<string, string> = {
  B7: 'there are not two formats for a CDN to cache apart',
  B8: 'there is no twin for the HTML page to advertise',
  B9: 'there is no markdown representation to negotiate for',
  B10: 'there is no markdown to route a crawler to',
  B11: 'a site serving one format has nothing to refuse',
};

/** Every check the cascade can lock. All of them are suggestions: the cascade never touches a scored check. */
export const TWIN_LOCKED_IDS: readonly string[] = [...Object.keys(LOCKED_ON_TWIN), ...Object.keys(LOCKED_ON_LIVE_URL)];
