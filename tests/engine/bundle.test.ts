import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { describe, expect, it } from 'vitest';
import { engineBundle, REWRITTEN_FILES, REWRITTEN_TRACE_ENGINE_FILES } from '../../scripts/engine-bundle';

const ENGINE_ROOT = join(import.meta.dirname, '../../packages/engine');
const TRACE_ENGINE = join(import.meta.dirname, '../../node_modules/@paulirish/trace_engine');

type Transform = (code: string, id: string) => { code: string } | null;

function transformer(plugin: Plugin): Transform {
  const hook = plugin.transform;
  const handler = typeof hook === 'function' ? hook : hook?.handler;
  if (!handler) throw new Error('engine-bundle has no transform hook');
  return (code, id) => handler.call({} as never, code, id) as { code: string } | null;
}

function source(file: string): string {
  return readFileSync(join(ENGINE_ROOT, file), 'utf8');
}

/** An engine file, as the bundle will see it. */
function rewritten(file: string): string {
  const id = join(ENGINE_ROOT, file);
  const result = transformer(engineBundle())(source(file), id);
  if (!result) throw new Error(`${file} was not rewritten`);
  return result.code;
}

/** A trace library file, as the bundle will see it. */
function rewrittenTraceEngine(file: string): string {
  const id = join(TRACE_ENGINE, file);
  const result = transformer(engineBundle())(readFileSync(id, 'utf8'), id);
  if (!result) throw new Error(`${file} was not rewritten`);
  return result.code;
}

describe('engine-bundle', () => {
  it('rewrites every file it expects to', () => {
    // Each rewrite throws when its pattern is gone, so this fails on an engine change that moved one.
    for (const file of REWRITTEN_FILES) expect(() => rewritten(file)).not.toThrow();
    for (const file of REWRITTEN_TRACE_ENGINE_FILES) expect(() => rewrittenTraceEngine(file)).not.toThrow();
  });

  it('takes the external docs link out of the preconnect sections', () => {
    const code = rewrittenTraceEngine('models/trace/insights/NetworkDependencyTree.js');
    expect(code).not.toContain('[preconnect](');
    expect(code).toContain("'Preconnect hints help the browser establish a connection earlier");
    expect(code).toContain("'Add preconnect hints to your most important origins");
  });

  it('inlines the directory listings and imports every audit and gatherer', () => {
    expect(rewritten('core/runner.js')).not.toMatch(/fs\.readdirSync/);
    const helpers = rewritten('core/config/config-helpers.js');
    expect(helpers).not.toContain('BUILD_REPLACE_BUNDLED_MODULES');
    expect(helpers).toContain('import * as __engineModule0 from "../audits/');
    expect(helpers).toContain('"../gather/gatherers/agentic/');
  });

  it('replaces import.meta, which a service worker bundle cannot have', () => {
    expect(rewritten('core/runner.js')).not.toContain('import.meta');
    expect(rewritten('shared/root.js')).toContain('file:///engine/shared/root.js');
  });

  it('swaps Node built-ins for the shims, and leaves other modules alone', () => {
    const plugin = engineBundle();
    const resolveId = typeof plugin.resolveId === 'function' ? plugin.resolveId : plugin.resolveId?.handler;
    const resolve = (source: string): unknown => resolveId?.call({} as never, source, undefined, { attributes: {}, isEntry: false });
    expect(resolve('node:fs')).toMatch(/src\/engine\/shims\/fs\.ts$/);
    expect(resolve('puppeteer-core')).toMatch(/shims\/puppeteer\.ts$/);
    expect(resolve('react')).toBeNull();
    expect(transformer(plugin)('export const x = 1;', '/project/src/x.ts')).toBeNull();
  });
});

describe('engine sources', () => {
  it('read nothing from disk at load time', () => {
    expect(source('shared/root.js')).not.toMatch(/readFileSync/);
    expect(source('core/lib/axe.js')).toContain("from 'axe-core/axe.min.js?raw'");
    expect(source('core/gather/gatherers/stacks.js')).toContain("from 'js-library-detector/library/libraries.js?raw'");
    expect(source('shared/localization/format.js')).not.toMatch(/readdirSync/);
  });

  it('send the back/forward cache check to the extension’s own page, not chrome://terms', () => {
    const code = source('core/gather/gatherers/bf-cache-failures.js');
    expect(code).toContain("{url: chrome.runtime.getURL('/bfcache.html')}");
    expect(code).not.toMatch(/Page\.navigate', \{url: 'chrome:/);
  });

  it('inject page functions without a bundler helper prelude', () => {
    expect(source('core/lib/page-functions.js')).not.toContain('esbuildFunctionWrapper');
  });

  it('report no telemetry', () => {
    const sentry = source('core/lib/sentry.js');
    expect(sentry).not.toMatch(/@sentry|dsn/i);
  });
});
