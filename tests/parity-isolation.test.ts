import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The Agentic engine must run in Node (tests, a CLI) and in the extension alike, so nothing under
 * `src/agentic` may touch `chrome.*`, wxt, or the extension and engine layers that sit above it.
 */

const ROOT = new URL('../src/agentic', import.meta.url).pathname;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const FORBIDDEN_SPECIFIERS = [
  /^wxt(\/|$)/,
  /^#imports$/,
  /(^|\/)src\/extension(\/|$)/,
  /(^|\/)src\/engine(\/|$)/,
  /(^|\/)extension(\/|$)/,
  /(^|\/)engine(\/|$)/,
];

/** Every module specifier in static imports, re-exports and dynamic imports. */
function specifiers(source: string): string[] {
  const out: string[] = [];
  for (const match of source.matchAll(/\b(?:import|export)\b[^'";]*?\bfrom\s*['"]([^'"]+)['"]/g)) out.push(match[1] ?? '');
  for (const match of source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(match[1] ?? '');
  for (const match of source.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm)) out.push(match[1] ?? '');
  return out;
}

const files = walk(ROOT).filter((path) => /\.(ts|tsx|js|mjs)$/.test(path));

describe('src/agentic is isolated from the browser and the extension', () => {
  it('has files to check', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const path of files) {
    const name = relative(ROOT, path);
    it(`${name} never mentions chrome.* and imports nothing from wxt, src/extension or src/engine`, () => {
      const source = readFileSync(path, 'utf8');
      expect(source).not.toMatch(/\bchrome\./);
      expect(source).not.toMatch(/\bglobalThis\.chrome\b/);
      const offending = specifiers(source).filter((spec) => FORBIDDEN_SPECIFIERS.some((pattern) => pattern.test(spec)));
      expect(offending).toEqual([]);
    });
  }
});
