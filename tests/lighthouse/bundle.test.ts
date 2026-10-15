import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';
import { describe, expect, it } from 'vitest';
import { lighthouseBundle, REWRITTEN_FILES } from '../../scripts/lighthouse-bundle';

const require = createRequire(import.meta.url);
const LH_ROOT = dirname(require.resolve('lighthouse/package.json'));

type Transform = (code: string, id: string) => { code: string } | null;

function transformer(plugin: Plugin): Transform {
  const hook = plugin.transform;
  const handler = typeof hook === 'function' ? hook : hook?.handler;
  if (!handler) throw new Error('lighthouse-bundle has no transform hook');
  return (code, id) => handler.call({} as never, code, id) as { code: string } | null;
}

/** The installed Lighthouse file, as the bundle will see it. */
function rewritten(file: string): string {
  const id = join(LH_ROOT, file);
  const result = transformer(lighthouseBundle())(readFileSync(id, 'utf8'), id);
  if (!result) throw new Error(`${file} was not rewritten`);
  return result.code;
}

describe('lighthouse-bundle', () => {
  it('rewrites every file it expects to, against the installed Lighthouse', () => {
    // Each rewrite throws when its pattern is gone, so this fails on a Lighthouse upgrade that moved one.
    for (const file of REWRITTEN_FILES) expect(() => rewritten(file)).not.toThrow();
  });

  it('inlines what Lighthouse reads from disk', () => {
    expect(rewritten('shared/root.js')).not.toMatch(/readFileSync/);
    expect(rewritten('core/lib/axe.js')).toContain('axe.run');
    expect(rewritten('core/gather/gatherers/stacks.js')).not.toMatch(/require\.resolve/);
    expect(rewritten('core/runner.js')).not.toMatch(/fs\.readdirSync/);
    expect(rewritten('core/config/config-helpers.js')).not.toContain('BUILD_REPLACE_BUNDLED_MODULES');
  });

  it('sends the back/forward cache check to the extension’s own page, not chrome://terms', () => {
    const code = rewritten('core/gather/gatherers/bf-cache-failures.js');
    expect(code).toContain("session.sendCommand('Page.navigate', {url: chrome.runtime.getURL('/bfcache.html')})");
    expect(code).not.toContain("{url: 'chrome://terms'}");
  });

  it('injects page functions without esbuild’s helper', () => {
    expect(rewritten('core/lib/page-functions.js')).toContain("const esbuildFunctionWrapperString = '';");
  });

  it('replaces import.meta, which a service worker bundle cannot have', () => {
    expect(rewritten('core/runner.js')).not.toContain('import.meta');
  });

  it('swaps Node built-ins for the shims, and leaves other modules alone', () => {
    const plugin = lighthouseBundle();
    const resolveId = typeof plugin.resolveId === 'function' ? plugin.resolveId : plugin.resolveId?.handler;
    const resolve = (source: string): unknown => resolveId?.call({} as never, source, undefined, { attributes: {}, isEntry: false });
    expect(resolve('node:fs')).toMatch(/src\/lighthouse\/shims\/fs\.ts$/);
    expect(resolve('puppeteer-core')).toMatch(/shims\/puppeteer\.ts$/);
    expect(resolve('react')).toBeNull();
    expect(transformer(plugin)('export const x = 1;', '/project/src/x.ts')).toBeNull();
  });
});
