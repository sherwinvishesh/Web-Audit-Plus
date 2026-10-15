import { codeSpan } from '../agentic/quote';
import type { CategoryId } from '../shared/categories';
import type { FixPromptItem } from '../shared/fix-prompt';
import type { AuditItem, AuditStatus } from '../shared/report-model';
import { evidenceFrom, formatMs, type Evidence } from './evidence';
import type { Lhr, LhrAudit } from './lhr';
import { REMEDIES } from './remedies';
import { savingsImpact, type ScoringOptions, type WeightedMetric } from './scoring';

/**
 * A Lighthouse result reduced to the report's rows. Statuses follow Lighthouse's own report
 * (`showAsPassed` and `calculateRating`). Points are what the audit's own weight would add to the
 * category score; an unweighted Performance insight carries Lighthouse's estimated impact instead.
 */

type AuditRef = Lhr['categories'][string]['auditRefs'][number];

/** Lighthouse's pass threshold: scores of 0.9 and up show as passed. */
const PASS = 0.9;
/** Scores in [0.5, 0.9) are "average" in Lighthouse: shown as warnings here. */
const AVERAGE = 0.5;

export function lighthouseStatus(audit: Pick<LhrAudit, 'score' | 'scoreDisplayMode'>): AuditStatus {
  switch (audit.scoreDisplayMode) {
    case 'notApplicable':
      return 'na';
    case 'manual':
      return 'manual';
    case 'informative':
      return 'info';
    case 'error':
      return 'error';
    default: {
      const score = audit.score ?? 0;
      if (score >= PASS) return 'pass';
      if (score >= AVERAGE && audit.scoreDisplayMode !== 'binary') return 'partial';
      return 'fail';
    }
  }
}

/** Every audit Lighthouse shows for this category (its hidden group left out), as report rows. */
export function lighthouseAudits(lhr: Lhr, category: CategoryId): AuditItem[] {
  const view = lhr.categories[category];
  if (!view) return [];
  const weightTotal = view.auditRefs.reduce((sum, ref) => sum + ref.weight, 0);
  const metrics = category === 'performance' ? weightedMetrics(lhr) : [];
  const formFactor = lhr.configSettings.formFactor;
  const items: AuditItem[] = [];
  for (const ref of view.auditRefs) {
    if (ref.group === 'hidden') continue;
    const audit = lhr.audits[ref.id];
    if (!audit) continue;
    const status = lighthouseStatus(audit);
    const evidence = evidenceFrom(audit.details);
    const { why, learnMore } = describe(audit.description);
    const points = pointsFor(ref, audit, status, weightTotal);
    const item: AuditItem = { key: `${category}:${ref.id}`, category, id: ref.id, title: plain(audit.title).replace(/\.$/, ''), status, points };
    const reason = reasonFor(audit, status, evidence);
    if (reason) item.reason = reason;
    if (why) item.why = why;
    const fix = REMEDIES[ref.id];
    if (fix) item.fix = fix;
    const displayValue = audit.displayValue ? plain(audit.displayValue) : '';
    if (displayValue) item.displayValue = displayValue;
    if (evidence.lines.length > 0) {
      item.evidence = evidence.lines;
      item.evidenceTotal = evidence.total;
    }
    const group = ref.group ? lhr.categoryGroups?.[ref.group]?.title : undefined;
    if (group) item.group = group;
    if (learnMore) item.learnMore = learnMore;
    const notes = stackNotes(lhr, ref.id);
    if (notes.length > 0) item.stackNotes = notes;
    const impact = needsWork(status) && ref.weight === 0 ? round1(savingsImpact(audit.metricSavings, metrics, weightTotal)) : 0;
    if (impact > 0) item.impact = impact;
    if (needsWork(status)) {
      item.fixItem = fixItemFor(item, status, audit, ref, evidence, formFactor);
    }
    items.push(item);
  }
  return items;
}

export interface MetricView {
  id: string;
  acronym: string;
  title: string;
  displayValue?: string;
  score: number | null;
  status: AuditStatus;
  /** The metric's share of the Performance score, in points. */
  weight: number;
}

/** The Performance category's lab metrics, in Lighthouse's order. */
export function lighthouseMetrics(lhr: Lhr): MetricView[] {
  const performance = lhr.categories.performance;
  if (!performance) return [];
  const weightTotal = performance.auditRefs.reduce((sum, ref) => sum + ref.weight, 0);
  return performance.auditRefs
    .filter((ref) => ref.group === 'metrics')
    .flatMap((ref) => {
      const audit = lhr.audits[ref.id];
      if (!audit) return [];
      const metric: MetricView = {
        id: ref.id,
        acronym: ref.acronym ?? ref.id,
        title: audit.title,
        score: audit.score,
        status: lighthouseStatus(audit),
        weight: weightTotal > 0 ? round1((ref.weight / weightTotal) * 100) : 0,
      };
      if (audit.displayValue) metric.displayValue = plain(audit.displayValue);
      return [metric];
    });
}

function weightedMetrics(lhr: Lhr): WeightedMetric[] {
  const performance = lhr.categories.performance;
  if (!performance) return [];
  return performance.auditRefs
    .filter((ref) => ref.group === 'metrics' && ref.acronym)
    .map((ref) => {
      const audit = lhr.audits[ref.id];
      return { acronym: ref.acronym ?? '', weight: ref.weight, score: audit?.score ?? null, numericValue: audit?.numericValue, scoringOptions: audit?.scoringOptions };
    });
}

/** The score points this audit's own weight is missing. Zero for unweighted audits, whatever they save. */
function pointsFor(ref: AuditRef, audit: LhrAudit, status: AuditStatus, weightTotal: number): number {
  if (!needsWork(status) || weightTotal <= 0 || ref.weight <= 0) return 0;
  return round1(((ref.weight * (1 - (audit.score ?? 0))) / weightTotal) * 100);
}

function needsWork(status: AuditStatus): status is 'fail' | 'partial' {
  return status === 'fail' || status === 'partial';
}

function reasonFor(audit: LhrAudit, status: AuditStatus, evidence: Evidence): string | undefined {
  switch (status) {
    case 'error':
      return `Lighthouse could not run this audit: ${codeSpan(audit.errorMessage ?? 'no reason given')}`;
    case 'na':
      return 'Nothing on this page for this audit to check.';
    case 'manual':
      return 'Lighthouse cannot check this automatically. Review it by hand.';
    default:
      break;
  }
  const metric = metricOf(audit);
  if (metric) {
    const now = formatMetric(metric.value, metric.unit);
    const target = formatMetric(metric.options.p10, metric.unit);
    return status === 'pass' ? `Measured ${now}, within the ${target} target.` : `Measured ${now}. A score of 90 or more needs ${target} or less; ${formatMetric(metric.options.median, metric.unit)} scores 50.`;
  }
  const parts: string[] = [];
  const flagged = needsWork(status);
  if (audit.displayValue) parts.push(plain(audit.displayValue));
  else if (flagged && evidence.countable && evidence.total > 0) parts.push(`${evidence.total} ${plural(evidence.noun, evidence.total)} flagged`);
  if (audit.explanation) parts.push(codeSpan(audit.explanation));
  if (parts.length > 0) return `${parts.join('. ')}.`.replace(/\.\.$/, '.');
  if (!flagged) return undefined;
  return evidence.lines.length > 0 ? 'Lighthouse flagged what is listed below.' : `Lighthouse reports: ${plain(audit.title).replace(/\.$/, '')}.`;
}

interface Metric {
  value: number;
  unit: string;
  options: ScoringOptions;
}

function metricOf(audit: LhrAudit): Metric | undefined {
  if (audit.scoreDisplayMode !== 'numeric' || !audit.scoringOptions || audit.numericValue === undefined || !audit.numericUnit) return undefined;
  return { value: audit.numericValue, unit: audit.numericUnit, options: audit.scoringOptions };
}

function formatMetric(value: number, unit: string): string {
  if (unit === 'millisecond') return formatMs(value);
  return String(Number(value.toFixed(3)));
}

function fixItemFor(item: AuditItem, status: 'fail' | 'partial', audit: LhrAudit, ref: AuditRef, evidence: Evidence, formFactor: string): FixPromptItem {
  const fixItem: FixPromptItem = {
    category: item.category,
    id: item.id,
    title: item.title,
    status,
    points: item.points,
    evidence: item.reason ?? `Lighthouse reports: ${item.title}.`,
    acceptance: acceptanceFor(audit, ref, evidence, formFactor),
  };
  if (item.impact) fixItem.impact = item.impact;
  if (evidence.lines.length > 0) {
    fixItem.evidenceLines = evidence.lines;
    if (evidence.total > evidence.lines.length) fixItem.evidenceMore = evidence.total - evidence.lines.length;
  }
  if (item.fix) fixItem.fix = item.fix;
  if (item.why) fixItem.remedy = item.why;
  if (item.stackNotes) fixItem.stackNotes = item.stackNotes;
  if (item.learnMore) fixItem.learnMore = item.learnMore;
  return fixItem;
}

/** What "fixed" means, in terms Lighthouse will check on the next run. */
function acceptanceFor(audit: LhrAudit, ref: AuditRef, evidence: Evidence, formFactor: string): string {
  const metric = metricOf(audit);
  if (metric) {
    const name = ref.acronym ?? audit.title;
    return `${name} is ${formatMetric(metric.options.p10, metric.unit)} or less on a ${formFactor} run (it measured ${formatMetric(metric.value, metric.unit)})`;
  }
  if (audit.scoreDisplayMode === 'metricSavings') return `${codeSpan(ref.id)} passes with no estimated savings left`;
  if (!evidence.countable) return `${codeSpan(ref.id)} passes`;
  if (evidence.total === 1) return `${codeSpan(ref.id)} passes: the ${evidence.noun} listed is no longer flagged, and nothing new is`;
  if (evidence.total > 1) return `${codeSpan(ref.id)} passes: none of the ${evidence.total} ${plural(evidence.noun, evidence.total)} listed is flagged, and nothing new is`;
  return `${codeSpan(ref.id)} passes`;
}

/**
 * Lighthouse's description as plain "why it matters" text. Markdown links keep their text, except
 * the trailing "Learn more" link, whose URL becomes the row's documentation link.
 */
export function describe(description: string): { why: string; learnMore?: string } {
  let learnMore: string | undefined;
  const why = description
    .replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (_match, text: string, url: string) => {
      if (/^(learn|more|see)\b/i.test(text.trim())) {
        if (!learnMore && /^https:\/\//.test(url)) learnMore = url;
        return '';
      }
      return text;
    })
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/\.(\s*\.)+/g, '.')
    .trim();
  return learnMore ? { why, learnMore } : { why };
}

function stackNotes(lhr: Lhr, id: string): Array<{ title: string; text: string }> {
  return (lhr.stackPacks ?? []).flatMap((pack) => {
    const description = pack.descriptions[id];
    return description ? [{ title: plain(pack.title), text: describe(description).why }] : [];
  });
}

function plural(noun: string, count: number): string {
  return count === 1 ? noun : `${noun}s`;
}

/** Lighthouse's own text on one line, with no backticks to open a code span. */
function plain(text: string): string {
  return text.replace(/`/g, '').replace(/\s+/g, ' ').trim();
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** How the run was set up, and what it saw: for the report footer and the filmstrip. */
export interface LighthouseMeta {
  version: string;
  formFactor: 'mobile' | 'desktop';
  /** "Simulated: 40 ms RTT, 10 Mbps, no CPU slowdown". */
  throttling: string;
  /** "1350 × 940 at 1×", or "No emulation". */
  screen: string;
  userAgent: string;
  benchmarkIndex?: number;
  finalUrl: string;
  fetchTime: string;
  warnings: string[];
  /** Only frames whose data is a base64 image `data:` URL. */
  filmstrip: Array<{ timing: number; data: string }>;
  finalScreenshot?: string;
}

const IMAGE_DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

/** True for an inline base64 image, the only kind of screenshot the report will show. */
export function isImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && IMAGE_DATA_URL.test(value);
}

export function lighthouseMeta(lhr: Lhr): LighthouseMeta {
  const settings = lhr.configSettings;
  const meta: LighthouseMeta = {
    version: lhr.lighthouseVersion,
    formFactor: settings.formFactor === 'mobile' ? 'mobile' : 'desktop',
    throttling: throttlingText(settings),
    screen: settings.screenEmulation.disabled
      ? 'No emulation'
      : `${settings.screenEmulation.width} × ${settings.screenEmulation.height} at ${settings.screenEmulation.deviceScaleFactor}×`,
    userAgent: lhr.environment.networkUserAgent || lhr.userAgent,
    finalUrl: lhr.finalDisplayedUrl,
    fetchTime: lhr.fetchTime,
    warnings: lhr.runWarnings.map(plain),
    filmstrip: [],
  };
  if (lhr.environment.benchmarkIndex) meta.benchmarkIndex = Math.round(lhr.environment.benchmarkIndex);
  const thumbnails = lhr.audits['screenshot-thumbnails']?.details;
  if (thumbnails?.type === 'filmstrip') {
    meta.filmstrip = thumbnails.items.filter((frame) => isImageDataUrl(frame.data)).map((frame) => ({ timing: frame.timing, data: frame.data }));
  }
  const final = lhr.audits['final-screenshot']?.details;
  if (final?.type === 'screenshot' && isImageDataUrl(final.data)) meta.finalScreenshot = final.data;
  return meta;
}

function throttlingText(settings: Lhr['configSettings']): string {
  const { throttling } = settings;
  const cpu = throttling.cpuSlowdownMultiplier && throttling.cpuSlowdownMultiplier > 1 ? `${throttling.cpuSlowdownMultiplier}× CPU slowdown` : 'no CPU slowdown';
  switch (settings.throttlingMethod) {
    case 'simulate':
      return `Simulated: ${throttling.rttMs ?? 0} ms RTT, ${mbps(throttling.throughputKbps ?? 0)}, ${cpu}`;
    case 'devtools':
      return `Applied: ${throttling.requestLatencyMs ?? 0} ms latency, ${mbps(throttling.downloadThroughputKbps ?? 0)} down, ${cpu}`;
    default:
      return 'None (network and CPU as the machine runs them)';
  }
}

function mbps(kbps: number): string {
  if (kbps <= 0) return 'unthrottled';
  const value = kbps / 1024;
  return `${Number(value.toFixed(value >= 10 ? 0 : 1))} Mbps`;
}
