/**
 * Quoting text that came from an audited site.
 *
 * Reasons and fix prompts quote headers, robots rules and page text verbatim. A fix prompt is
 * pasted into a coding agent with write access to a repository, so a hostile page must not be able
 * to smuggle instructions into it. Every quoted value becomes one single-line markdown code span:
 * whitespace collapsed (no line can start a new paragraph or heading), control and bidi characters
 * made visible, length capped, and a fence longer than any backtick run inside so the value can
 * never close its own span.
 */

export const MAX_QUOTED_CHARS = 400;

// C0/C1 controls, bidi overrides and isolates, and zero-width characters: anything that could hide
// or reorder text in a terminal or an editor.
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F؜​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

function visible(char: string): string {
  return `\\u{${char.codePointAt(0)!.toString(16).toUpperCase()}}`;
}

/** The value as it will appear inside the span: one line, invisibles shown, capped. */
export function flattenQuoted(value: string, max = MAX_QUOTED_CHARS): string {
  let flat = value.replace(/\s+/g, ' ').trim().replace(INVISIBLE, visible);
  if (flat.length > max) flat = `${flat.slice(0, max)}… [truncated]`;
  return flat;
}

/** Wrap a site-provided value in an inert single-line code span. */
export function codeSpan(value: string | number | null | undefined, max = MAX_QUOTED_CHARS): string {
  const flat = flattenQuoted(String(value ?? ''), max);
  if (!flat) return '(empty)';
  const longestRun = Math.max(0, ...(flat.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longestRun + 1);
  return `${fence} ${flat} ${fence}`;
}

export type InlinePart = { kind: 'text'; value: string } | { kind: 'code'; value: string };

/**
 * Split markdown-lite text into prose and code spans, following CommonMark's code-span rule: a run
 * of N backticks opens a span that closes at the next run of exactly N. One space of padding is
 * stripped from each side when both are present. The UI renders each part as text, never as HTML.
 */
export function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let buffer = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '`') {
      buffer += text[i];
      i += 1;
      continue;
    }
    let runEnd = i;
    while (text[runEnd] === '`') runEnd += 1;
    const run = runEnd - i;
    const close = findClosingRun(text, runEnd, run);
    if (close === -1) {
      buffer += text.slice(i, runEnd);
      i = runEnd;
      continue;
    }
    if (buffer) parts.push({ kind: 'text', value: buffer });
    buffer = '';
    let inner = text.slice(runEnd, close);
    if (inner.length >= 2 && inner.startsWith(' ') && inner.endsWith(' ') && inner.trim()) inner = inner.slice(1, -1);
    parts.push({ kind: 'code', value: inner });
    i = close + run;
  }
  if (buffer) parts.push({ kind: 'text', value: buffer });
  return parts;
}

function findClosingRun(text: string, from: number, length: number): number {
  let i = from;
  while (i < text.length) {
    if (text[i] !== '`') {
      i += 1;
      continue;
    }
    let end = i;
    while (text[end] === '`') end += 1;
    if (end - i === length) return i;
    i = end;
  }
  return -1;
}

/** Plain text with code-span fences removed, for places that cannot render chips (titles, tooltips). */
export function stripCodeSpans(text: string): string {
  return parseInline(text)
    .map((part) => part.value)
    .join('');
}
