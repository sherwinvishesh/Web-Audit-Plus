import { codeSpan } from '../agentic/quote';
import type { LhrDetails } from './lhr';

/**
 * What an audit found, as short evidence lines: one per flagged element, request or location.
 *
 * Details tables mix Lighthouse's own words (column labels, "Style & Layout") with what the site
 * served (markup, URLs, link text, console messages). Labels are ours to show as prose; every value
 * is quoted with `codeSpan()`, so nothing from the site ever reaches a fix prompt outside a code span.
 */

type Table = Extract<LhrDetails, { type: 'table' } | { type: 'opportunity' }>;
type Heading = Table['headings'][number];
type Item = Table['items'][number];
type Value = NonNullable<Item[string]>;
type ValueType = Heading['valueType'];
type ListDetails = Extract<LhrDetails, { type: 'list' }>;
type ListEntry = ListDetails['items'][number];
type NodeChains = Extract<LhrDetails, { type: 'criticalrequestchain' }>['chains'];
type TreeChains = Extract<LhrDetails, { type: 'network-tree' }>['chains'];

export const MAX_EVIDENCE_LINES = 10;
/** Quoted values in evidence are capped tighter than elsewhere: these are list lines, not records. */
const MAX_VALUE_CHARS = 160;

export type EvidenceNoun = 'element' | 'resource' | 'location' | 'request chain' | 'item';

export interface Evidence {
  /** At most `MAX_EVIDENCE_LINES`, markdown-lite. */
  lines: string[];
  /** How many there were in all. */
  total: number;
  /** What one of them is, for "3 elements flagged". */
  noun: EvidenceNoun;
  /** False when the lines mix kinds (a list of sections), so `total` is not a count of one thing. */
  countable: boolean;
}

const EMPTY: Evidence = { lines: [], total: 0, noun: 'item', countable: false };

export function evidenceFrom(details: LhrDetails | undefined): Evidence {
  if (!details) return EMPTY;
  switch (details.type) {
    case 'table':
    case 'opportunity':
      return tableEvidence(details);
    case 'list':
      return listEvidence(details.items);
    case 'checklist': {
      const missing = Object.values(details.items)
        .filter((entry) => !entry.value)
        .map((entry) => `Missing: ${prose(entry.label)}`);
      return capped(missing, 'item');
    }
    case 'criticalrequestchain':
      return capped(requestChains(details.chains), 'request chain');
    case 'network-tree':
      return capped(treeChains(details.chains), 'request chain');
    default:
      return EMPTY;
  }
}

function capped(lines: string[], noun: EvidenceNoun): Evidence {
  return { lines: lines.slice(0, MAX_EVIDENCE_LINES), total: lines.length, noun, countable: true };
}

function tableEvidence(table: Table): Evidence {
  const headings = table.headings.filter((heading) => heading.key && heading.valueType !== 'thumbnail' && heading.valueType !== 'multi');
  const lines = table.items.map((item) => tableLine(item, headings)).filter((line) => line.length > 0);
  return capped(lines, nounFor(headings[0]?.valueType));
}

function nounFor(valueType: ValueType | undefined): EvidenceNoun {
  switch (valueType) {
    case 'node':
      return 'element';
    case 'url':
      return 'resource';
    case 'source-location':
      return 'location';
    default:
      return 'item';
  }
}

/** The first column leads the line; the others follow as "label: value". */
function tableLine(item: Item, headings: readonly Heading[]): string {
  const parts: string[] = [];
  for (const [index, heading] of headings.entries()) {
    const value = heading.key ? item[heading.key] : undefined;
    if (value === undefined || value === null || value === '') continue;
    const shown = formatValue(value, heading);
    if (!shown) continue;
    const label = prose(heading.label);
    parts.push(index === 0 || !label ? shown : `${label}: ${shown}`);
  }
  return parts.join(' · ');
}

function formatValue(value: Value, heading: Pick<Heading, 'valueType' | 'granularity' | 'displayUnit'>): string {
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') {
    if (heading.displayUnit === 'duration') return formatDuration(value);
    return formatNumber(value, heading.valueType, heading.granularity);
  }
  if (typeof value === 'string') return quote(value);
  if (!('type' in value)) return '';
  switch (value.type) {
    case 'node':
      return nodeText(value);
    case 'source-location': {
      // Lines and columns are zero-based; -1 means Lighthouse only knows the file.
      const file = value.url || 'inline script';
      return quote(value.line >= 0 ? `${file}:${value.line + 1}:${Math.max(value.column, 0) + 1}` : file);
    }
    case 'url':
    case 'code':
    case 'text':
      return quote(value.value);
    case 'link':
      return quote(value.text || value.url);
    case 'numeric':
      return formatNumber(value.value, heading.valueType, value.granularity);
    case 'baseline-status':
      return prose(value.displayString);
    default:
      // Sub-item tables and debug data are not evidence lines.
      return '';
  }
}

type NodeValue = Extract<Value, { type: 'node' }>;

/** The markup, where it is, and what axe said about it. */
export function nodeText(node: NodeValue): string {
  const parts: string[] = [];
  if (node.snippet) parts.push(quote(node.snippet));
  if (node.selector) parts.push(`at ${quote(node.selector)}`);
  const label = node.nodeLabel?.trim();
  if (label && label !== node.selector && label !== node.snippet) parts.push(`(${quote(label)})`);
  if (parts.length === 0 && node.path) parts.push(quote(node.path));
  const explanation = node.explanation ? axeFinding(node.explanation) : '';
  if (!explanation) return parts.join(' ');
  return parts.length > 0 ? `${parts.join(' ')}: ${quote(explanation)}` : quote(explanation);
}

/**
 * axe explains a failure as "Fix any of the following:" (or "all") followed by one line per way the
 * element fails. The first line is the finding; the alternatives that follow add little.
 */
function axeFinding(explanation: string): string {
  const lines = explanation
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^Fix (?:any|all) of the following:?$/i.test(line));
  return lines[0] ?? '';
}

function formatNumber(value: number, valueType: ValueType | undefined, granularity?: number): string {
  if (!Number.isFinite(value)) return '';
  switch (valueType) {
    case 'bytes':
      return formatBytes(value);
    case 'ms':
    case 'timespanMs':
      return formatMs(value);
    default: {
      const step = granularity && granularity > 0 ? granularity : 0.01;
      const rounded = Math.round(value / step) * step;
      return Number(rounded.toFixed(Math.max(0, -Math.floor(Math.log10(step))))).toLocaleString('en-US');
    }
  }
}

export function formatBytes(bytes: number): string {
  const kib = bytes / 1024;
  if (kib >= 1024) return `${(kib / 1024).toFixed(1)} MiB`;
  return `${kib >= 10 ? Math.round(kib).toLocaleString('en-US') : kib.toFixed(1)} KiB`;
}

/** A cache lifetime and the like: "None", "15 min", "1 h", "30 d". */
export function formatDuration(ms: number): string {
  if (ms <= 0) return 'None';
  const seconds = ms / 1000;
  if (seconds < 1) return `${Math.round(ms)} ms`;
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${Number((seconds / 3600).toFixed(1))} h`;
  return `${Number((seconds / 86400).toFixed(1))} d`;
}

export function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms).toLocaleString('en-US')} ms`;
}

function listEvidence(entries: readonly ListEntry[]): Evidence {
  const lines: string[] = [];
  for (const entry of entries) {
    const value = entry.type === 'list-section' ? entry.value : entry;
    if (entry.type === 'list-section' && entry.title) lines.push(`${prose(entry.title)}:`);
    switch (value.type) {
      case 'table':
        lines.push(...tableEvidence(value).lines);
        break;
      case 'checklist':
      case 'network-tree':
        lines.push(...evidenceFrom(value).lines);
        break;
      case 'node':
        lines.push(nodeText(value));
        break;
      case 'text':
        lines.push(quote(value.value));
        break;
      default:
        break;
    }
  }
  return { lines: lines.slice(0, MAX_EVIDENCE_LINES), total: lines.length, noun: 'item', countable: false };
}

/** Chains are shown root to leaf; long ones keep their ends, which is where the cost is. */
const CHAIN_URL_CHARS = 100;

function chainLine(urls: readonly string[]): string {
  const shown = urls.length > 4 ? [...urls.slice(0, 2), '…', ...urls.slice(-1)] : urls;
  return shown.map((url) => (url === '…' ? url : codeSpan(url, CHAIN_URL_CHARS))).join(' → ');
}

/** One line per chain, root to leaf. */
function requestChains(chains: NodeChains, prefix: string[] = []): string[] {
  const lines: string[] = [];
  for (const node of Object.values(chains)) {
    const path = [...prefix, node.request.url];
    if (node.children && Object.keys(node.children).length > 0) lines.push(...requestChains(node.children, path));
    else lines.push(chainLine(path));
  }
  return lines;
}

function treeChains(chains: TreeChains, prefix: string[] = []): string[] {
  const lines: string[] = [];
  for (const node of Object.values(chains)) {
    const path = [...prefix, node.url];
    if (node.children && Object.keys(node.children).length > 0) lines.push(...treeChains(node.children, path));
    else lines.push(`${chainLine(path)} (${formatMs(node.navStartToEndTime)})`);
  }
  return lines;
}

function quote(value: string): string {
  return codeSpan(value, MAX_VALUE_CHARS);
}

/** Lighthouse's own words: one line, and no backticks, so they cannot open or close a code span. */
function prose(text: string): string {
  return text.replace(/`/g, '').replace(/\s+/g, ' ').trim();
}
