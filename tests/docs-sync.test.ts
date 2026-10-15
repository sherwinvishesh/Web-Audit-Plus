import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AI_BOTS } from '../src/agentic/bots';
import { CHECKS, TWIN_LOCKED_IDS } from '../src/agentic/checks';

const doc = readFileSync(new URL('../docs/CHECKS.md', import.meta.url), 'utf8');

describe('docs/CHECKS.md', () => {
  it('lists every check with the registry weight, required flag and title', () => {
    const rows = [...doc.matchAll(/^\| ([AB]\d+) \| (\d+) \| (yes|no) \| (.+?) \|$/gm)].map((match) => ({
      id: match[1],
      weight: Number(match[2]),
      required: match[3] === 'yes',
      title: match[4],
    }));
    expect(rows).toEqual(CHECKS.map((check) => ({ id: check.id, weight: check.weight, required: check.required, title: check.title })));
  });

  it('states the totals the registry adds up to', () => {
    const sum = (filter: (check: (typeof CHECKS)[number]) => boolean): number => CHECKS.filter(filter).reduce((total, check) => total + check.weight, 0);
    const a = [sum((c) => c.category === 'A' && c.required), sum((c) => c.category === 'A' && !c.required), sum((c) => c.category === 'A')];
    const b = [sum((c) => c.category === 'B' && c.required), sum((c) => c.category === 'B' && !c.required), sum((c) => c.category === 'B')];
    expect(doc).toContain(`| A. Discoverability | ${a.join(' | ')} |`);
    expect(doc).toContain(`| B. Implementation | ${b.join(' | ')} |`);
    expect(doc).toContain(`| Total | ${a[0]! + b[0]!} | ${a[1]! + b[1]!} | ${a[2]! + b[2]!} |`);
  });

  it('names the locked checks and their weight', () => {
    const lockedWeight = TWIN_LOCKED_IDS.reduce((total, id) => total + (CHECKS.find((check) => check.id === id)?.weight ?? 0), 0);
    expect(doc).toContain(`Their weights total ${lockedWeight}.`);
    expect(doc).toContain(`${TWIN_LOCKED_IDS.length === 12 ? 'twelve' : TWIN_LOCKED_IDS.length} category B checks`);
  });

  it('counts the known AI agents correctly', () => {
    expect(doc).toContain(`each of ${AI_BOTS.length} known AI agents`);
  });
});
