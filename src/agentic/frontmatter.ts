/**
 * Minimal YAML frontmatter reader, matching OpenGEO's: a flat map of strings, numbers, booleans
 * and string arrays. B14 reads `source_hash` and `last_updated` from it.
 */

export type FrontmatterValue = string | number | boolean | string[];

export interface ParsedDocument {
  data: Record<string, FrontmatterValue>;
  body: string;
  hasFrontmatter: boolean;
}

export function parseFrontmatter(source: string): ParsedDocument {
  const text = source.replace(/^﻿/, '');
  if (!text.startsWith('---')) return { data: {}, body: text, hasFrontmatter: false };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { data: {}, body: text, hasFrontmatter: false };
  const block = text.slice(text.indexOf('\n') + 1, end);
  const rest = text.slice(end + '\n---'.length).replace(/^[^\n]*\n?/, '');
  const data: Record<string, FrontmatterValue> = {};
  for (const line of block.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const raw = line.slice(colon + 1).trim();
    if (!key) continue;
    data[key] = parseValue(raw);
  }
  return { data, body: rest, hasFrontmatter: true };
}

function parseValue(raw: string): FrontmatterValue {
  if (raw.startsWith('[') && raw.endsWith(']')) {
    const inner = raw.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((part) => unquote(part.trim()));
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw !== '' && !Number.isNaN(Number(raw)) && !/^["']/.test(raw)) return Number(raw);
  return unquote(raw);
}

function unquote(value: string): string {
  if (value.length > 1 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return value;
}
