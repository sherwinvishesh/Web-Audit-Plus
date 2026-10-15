import { codeSpan } from './quote';
import { countWords } from './tokens';

/**
 * Fact fidelity: does a markdown twin still carry every number, date, price and percentage the
 * live page states? Ported from OpenGEO's `generate/fidelity.js`, which B14 uses to tell a cosmetic
 * edit from a twin that is now serving agents wrong information. Messages are reworded for the
 * twin-versus-page comparison (OpenGEO's talk about a model's rewrite).
 *
 * What it does not check: names and other words, and which number sits next to which.
 */

export type FactKind = 'date' | 'currency' | 'percent' | 'number';

export interface FactToken {
  /** As it appeared in the text. */
  value: string;
  /** Comparison form: case-folded, separators removed, dates reduced to yyyy-mm-dd where possible. */
  canonical: string;
  kind: FactKind;
}

export interface FidelityIssue {
  code: 'missing-fact' | 'invented-fact' | 'dropped-occurrences' | 'too-short' | 'missing-heading' | 'empty-output';
  severity: 'error' | 'warning';
  message: string;
}

export interface FidelityReport {
  ok: boolean;
  issues: FidelityIssue[];
  errors: string[];
  warnings: string[];
  sourceFacts: FactToken[];
  missing: FactToken[];
}

export interface FidelityOptions {
  /** Candidate must keep at least this share of the source's word count. */
  minWordRatio?: number;
  /** Candidate must keep at least this share of total fact occurrences (catches dropped tables). */
  minFactOccurrenceRatio?: number;
  /** How many facts to name before saying "and N more". */
  maxReported?: number;
  /** Fail on a fact the candidate states and the source does not. B14 turns it off. */
  rejectInvented?: boolean;
}

const MONTH_NAMES: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const MONTH_ALTERNATION = Object.keys(MONTH_NAMES)
  .sort((a, b) => b.length - a.length)
  .join('|');
// Thousands separators only where they belong, so the trailing comma in "$12,500, a 42% rise" is
// punctuation rather than part of the number.
const NUMBER = String.raw`\d+(?:,\d{3})*(?:\.\d+)?`;
// A minus is part of the fact, but only one that starts a token: the hyphen in 2019-2024 is not a sign.
const SIGN = String.raw`(?:(?<![\w.,\-−])[-−])?`;
// $1.2 million and $1.2 billion are different facts, as are $5M and $5B.
const SCALE = String.raw`(?:\s?(?:thousand|million|billion|trillion|bn)\b|[kmb]\b)?`;
const CURRENCY_CODES = 'USD|EUR|GBP|JPY|CAD|AUD|CHF|SEK|NOK|DKK|ISK|INR|CNY|NZD|BRL|MXN|ZAR|PLN|CZK|SGD|HKD|KRW';

/** Ordered alternation: the first pattern that matches at a position wins. */
const FACT_PATTERNS: Array<{ kind: FactKind; source: string }> = [
  { kind: 'date', source: String.raw`\d{4}-\d{2}-\d{2}` },
  { kind: 'date', source: String.raw`\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}` },
  { kind: 'date', source: String.raw`\d{1,2}(?:st|nd|rd|th)?\s+(?:${MONTH_ALTERNATION})\.?,?\s+\d{4}` },
  { kind: 'date', source: String.raw`(?:${MONTH_ALTERNATION})\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}` },
  { kind: 'date', source: String.raw`(?:${MONTH_ALTERNATION})\.?\s+\d{4}` },
  { kind: 'currency', source: String.raw`${SIGN}[$£€¥₹]\s?${NUMBER}${SCALE}` },
  { kind: 'currency', source: String.raw`${SIGN}${NUMBER}${SCALE}\s?(?:${CURRENCY_CODES})\b` },
  { kind: 'percent', source: String.raw`${SIGN}${NUMBER}\s?%` },
  { kind: 'percent', source: String.raw`${SIGN}${NUMBER}\s?percent\b` },
  { kind: 'number', source: `${SIGN}${NUMBER}${SCALE}` },
];

const FACT_SOURCE = FACT_PATTERNS.map((pattern) => `(${pattern.source})`).join('|');

/** Markdown noise removed before scanning, so `**$12,500**` and `$12,500` produce the same fact. */
export function normalizeForFacts(markdown: string): string {
  return (
    markdown
      .replace(/```[\s\S]*?```/g, (block) => block.replace(/`/g, ' '))
      // Ordered-list numbering is formatting, not a fact.
      .replace(/^[ \t]{0,3}\d{1,3}[.)][ \t]+/gm, '')
      .replace(/[*_~`>#|]/g, ' ')
      .replace(/\\([\\`*_{}[\]()#+\-.!])/g, '$1')
      .replace(/\s+/g, ' ')
  );
}

export function extractFacts(markdown: string): FactToken[] {
  const text = normalizeForFacts(markdown);
  const regex = new RegExp(FACT_SOURCE, 'gi');
  const out: FactToken[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const groupIndex = match.slice(1).findIndex((group) => group !== undefined);
    const pattern = FACT_PATTERNS[groupIndex];
    if (!pattern) continue;
    const value = match[0].trim();
    out.push({ value, canonical: canonicalize(value, pattern.kind), kind: pattern.kind });
  }
  return out;
}

export function canonicalize(value: string, kind: FactKind): string {
  const flat = value.toLowerCase().replace(/\s+/g, ' ').trim();
  if (kind === 'date') {
    const iso = canonicalDate(flat);
    if (iso) return iso;
  }
  return flat.replace(/−/g, '-').replace(/percent/g, '%').replace(/[,\s]/g, '').replace(/\.$/, '');
}

/**
 * `3 March 2024`, `March 3, 2024` and `2024-03-03` are the same day. Purely numeric forms stay raw:
 * day-first and month-first are genuinely ambiguous.
 */
function canonicalDate(value: string): string | undefined {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dayFirst = new RegExp(String.raw`^(\d{1,2})(?:st|nd|rd|th)?\s+(${MONTH_ALTERNATION})\.?,?\s+(\d{4})$`).exec(value);
  if (dayFirst) return formatIso(Number(dayFirst[3]), MONTH_NAMES[dayFirst[2] ?? ''] ?? 0, Number(dayFirst[1]));

  const monthFirst = new RegExp(String.raw`^(${MONTH_ALTERNATION})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$`).exec(value);
  if (monthFirst) return formatIso(Number(monthFirst[3]), MONTH_NAMES[monthFirst[1] ?? ''] ?? 0, Number(monthFirst[2]));

  const monthYear = new RegExp(String.raw`^(${MONTH_ALTERNATION})\.?\s+(\d{4})$`).exec(value);
  if (monthYear) return `${monthYear[2]}-${String(MONTH_NAMES[monthYear[1] ?? ''] ?? 0).padStart(2, '0')}`;

  return undefined;
}

function formatIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function extractHeadings(markdown: string): string[] {
  const out: string[] = [];
  for (const line of markdown.split('\n')) {
    const match = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line);
    if (match) out.push((match[2] ?? '').trim().replace(/[*_`]/g, '').toLowerCase());
  }
  return out;
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Compare a twin (`candidate`) against the extraction of the live page (`source`, ground truth).
 */
export function verifyFidelity(source: string, candidate: string, options: FidelityOptions = {}): FidelityReport {
  const minWordRatio = options.minWordRatio ?? 0.6;
  const minFactOccurrenceRatio = options.minFactOccurrenceRatio ?? 0.8;
  const maxReported = options.maxReported ?? 5;

  const issues: FidelityIssue[] = [];
  const sourceFacts = extractFacts(source);
  const missing: FactToken[] = [];

  if (candidate.trim().length === 0) {
    issues.push({ code: 'empty-output', severity: 'error', message: 'The twin is empty.' });
    return finish(issues, sourceFacts, missing);
  }

  const candidateFacts = extractFacts(candidate);
  const candidateCounts = new Map<string, number>();
  for (const fact of candidateFacts) candidateCounts.set(fact.canonical, (candidateCounts.get(fact.canonical) ?? 0) + 1);

  const sourceFirst = new Map<string, FactToken>();
  const sourceTotals = new Map<string, number>();
  for (const fact of sourceFacts) {
    if (!sourceFirst.has(fact.canonical)) sourceFirst.set(fact.canonical, fact);
    sourceTotals.set(fact.canonical, (sourceTotals.get(fact.canonical) ?? 0) + 1);
  }
  for (const [canonical, fact] of sourceFirst) if (!candidateCounts.has(canonical)) missing.push(fact);

  if (missing.length > 0) {
    issues.push({
      code: 'missing-fact',
      severity: 'error',
      message: `The twin drops or changes ${plural(missing.length, 'fact')} from the page: ${nameList(missing, maxReported)}.`,
    });
  }

  if (options.rejectInvented !== false) {
    const invented = new Map<string, FactToken>();
    for (const fact of candidateFacts) {
      if (!sourceTotals.has(fact.canonical) && !invented.has(fact.canonical)) invented.set(fact.canonical, fact);
    }
    if (invented.size > 0) {
      issues.push({
        code: 'invented-fact',
        severity: 'error',
        message: `The twin states ${plural(invented.size, 'fact')} the page does not: ${nameList([...invented.values()], maxReported)}.`,
      });
    }
  }

  const sourceOccurrences = sourceFacts.length;
  let keptOccurrences = 0;
  for (const [canonical, count] of sourceTotals) keptOccurrences += Math.min(count, candidateCounts.get(canonical) ?? 0);
  if (sourceOccurrences > 0 && keptOccurrences / sourceOccurrences < minFactOccurrenceRatio) {
    const pct = Math.round((keptOccurrences / sourceOccurrences) * 100);
    issues.push({
      code: 'dropped-occurrences',
      severity: 'error',
      message: `Only ${pct}% of the page's ${sourceOccurrences} number, date and price mentions survived. A table or list was probably collapsed.`,
    });
  }

  const sourceWords = countWords(source);
  const candidateWords = countWords(candidate);
  if (sourceWords > 0 && candidateWords / sourceWords < minWordRatio) {
    issues.push({
      code: 'too-short',
      severity: 'error',
      message: `The twin is ${candidateWords} words against the page's ${sourceWords}. That is a summary, not a faithful copy.`,
    });
  }

  // Structure loss is worth saying, but it is not a factual error.
  const candidateHeadings = new Set(extractHeadings(candidate));
  const lostHeadings = extractHeadings(source).filter((heading) => !candidateHeadings.has(heading));
  if (lostHeadings.length > 0) {
    issues.push({
      code: 'missing-heading',
      severity: 'warning',
      message: `${plural(lostHeadings.length, 'heading')} from the page did not make it into the twin: ${lostHeadings
        .slice(0, maxReported)
        .map((heading) => codeSpan(heading, 80))
        .join(', ')}.`,
    });
  }

  return finish(issues, sourceFacts, missing);
}

function nameList(facts: FactToken[], maxReported: number): string {
  const named = facts
    .slice(0, maxReported)
    .map((fact) => codeSpan(fact.value, 80))
    .join(', ');
  return facts.length > maxReported ? `${named} and ${facts.length - maxReported} more` : named;
}

function finish(issues: FidelityIssue[], sourceFacts: FactToken[], missing: FactToken[]): FidelityReport {
  const errors = issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message);
  const warnings = issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.message);
  return { ok: errors.length === 0, issues, errors, warnings, sourceFacts, missing };
}
