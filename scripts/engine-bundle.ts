import { readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/**
 * Bundles the audit engine (packages/engine, written for Node) into the extension's service worker.
 *
 * The engine finds its audits and gatherers by listing directories at run time, and loads them by
 * dynamic import. A worker has no file system, so this plugin inlines those directory listings and
 * imports every audit and gatherer statically. It also swaps Node built-ins for the small shims in
 * src/engine/shims.
 *
 * Every rewrite asserts that it matched, so an engine change that moves one of these spots fails
 * the build here instead of failing at run time inside the worker.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHIMS = join(ROOT, 'src/engine/shims');
const ENGINE_ROOT = join(ROOT, 'packages/engine');
const ENGINE_CORE = join(ENGINE_ROOT, 'core');
const TRACE_ENGINE = join(ROOT, 'node_modules/@paulirish/trace_engine');

const BUILTIN_SHIMS: Readonly<Record<string, string>> = {
  fs: 'fs.ts',
  'fs/promises': 'fs.ts',
  path: 'path.ts',
  url: 'url.ts',
  module: 'module.ts',
  events: 'events.ts',
  process: 'process.ts',
  zlib: 'unavailable.ts',
  stream: 'unavailable.ts',
  // The engine imports Puppeteer to connect to a browser when it is not handed a page. We always
  // hand it one, so Puppeteer's Node transport (`ws`) stays out of the bundle.
  'puppeteer-core': 'puppeteer.ts',
};

/** Audit and gatherer directories, exactly as `Runner.getAuditList` / `getGathererList` walk them. */
const AUDIT_DIRS = ['', 'dobetterweb', 'metrics', 'seo', 'seo/manual', 'accessibility', 'accessibility/manual', 'byte-efficiency', 'manual', 'insights', 'agentic'];
const GATHERER_DIRS = ['', 'seo', 'dobetterweb', 'agentic'];

function jsFiles(dir: string, prefix: string): string[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.js'))
    .map((file) => (prefix ? `${prefix}/${file}` : file));
}

/** `import * as` every audit and gatherer, keyed the way `requireWrapper` looks them up. */
function bundledModules(): { imports: string; entries: string } {
  const imports: string[] = [];
  const entries: string[] = [];
  const add = (specifier: string): void => {
    const name = `__engineModule${imports.length}`;
    imports.push(`import * as ${name} from ${JSON.stringify(specifier)};`);
    const key = specifier.replace(/\.js$/, '');
    entries.push(`[${JSON.stringify(key)}, Promise.resolve(${name})]`, `[${JSON.stringify(specifier)}, Promise.resolve(${name})]`);
  };
  for (const dir of AUDIT_DIRS) {
    for (const file of jsFiles(join(ENGINE_CORE, 'audits', dir), dir)) add(`../audits/${file}`);
  }
  for (const dir of GATHERER_DIRS) {
    for (const file of jsFiles(join(ENGINE_CORE, 'gather/gatherers', dir), dir)) add(`../gather/gatherers/${file}`);
  }
  return { imports: imports.join('\n'), entries: entries.join(',\n') };
}

type Rewrite = (code: string) => string;

function replaceOnce(code: string, file: string, search: string, replacement: string): string {
  if (!code.includes(search)) throw new Error(`engine-bundle: expected ${JSON.stringify(search)} in ${file}.`);
  return code.replace(search, () => replacement);
}

const REWRITES: Readonly<Record<string, Rewrite>> = {
  'core/runner.js': (code) => {
    let count = 0;
    const next = code.replace(/fs\.readdirSync\(path\.join\(moduleDir, '\.\/([^']+)'\)\)/g, (_match, dir: string) => {
      count++;
      return JSON.stringify(readdirSync(join(ENGINE_CORE, dir)).sort());
    });
    const expected = AUDIT_DIRS.length + GATHERER_DIRS.length;
    if (count !== expected) throw new Error(`engine-bundle: inlined ${count} directory listings in core/runner.js, expected ${expected}.`);
    return next;
  },
  'core/config/config-helpers.js': (code) => {
    const { imports, entries } = bundledModules();
    return `${imports}\n${replaceOnce(code, 'core/config/config-helpers.js', '/* BUILD_REPLACE_BUNDLED_MODULES */', `[\n${entries}\n]`)}`;
  },
};

/** The engine files this plugin rewrites, relative to packages/engine. */
export const REWRITTEN_FILES: readonly string[] = Object.keys(REWRITES);

function replacePattern(code: string, file: string, pattern: RegExp, replacement: string): string {
  if (!pattern.test(code)) throw new Error(`engine-bundle: expected ${String(pattern)} in ${file}.`);
  return code.replace(pattern, replacement);
}

/**
 * Text the engine shows from Chrome's trace library, relative to its package. Audit descriptions
 * explain themselves in place, so the two preconnect sections lose their external docs link.
 */
const TRACE_ENGINE_REWRITES: Readonly<Record<string, Rewrite>> = {
  'models/trace/insights/NetworkDependencyTree.js': (code) => {
    const file = 'NetworkDependencyTree.js';
    const next = replacePattern(code, file, /'\[preconnect\]\([^)]*\) hints help/, "'Preconnect hints help");
    return replacePattern(next, file, /'Add \[preconnect\]\([^)]*\) hints/, "'Add preconnect hints");
  },
};

/** The trace library files this plugin rewrites, relative to its package. */
export const REWRITTEN_TRACE_ENGINE_FILES: readonly string[] = Object.keys(TRACE_ENGINE_REWRITES);

function packagePath(id: string, root: string): string | undefined {
  const file = id.split('?')[0] ?? id;
  if (!file.startsWith(root + sep)) return undefined;
  return relative(root, file).split(sep).join('/');
}

export function engineBundle(): Plugin {
  return {
    name: 'webauditplus:engine-bundle',
    enforce: 'pre',
    resolveId(source) {
      const shim = BUILTIN_SHIMS[source.replace(/^node:/, '')];
      return shim ? join(SHIMS, shim) : null;
    },
    transform(code, id) {
      const traceFile = packagePath(id, TRACE_ENGINE);
      const traceRewrite = traceFile ? TRACE_ENGINE_REWRITES[traceFile] : undefined;
      if (traceRewrite) return { code: traceRewrite(code), map: null };
      const file = packagePath(id, ENGINE_ROOT);
      if (!file || !file.endsWith('.js')) return null;
      const rewrite = REWRITES[file];
      let next = rewrite ? rewrite(code) : code;
      // A service worker bundle has no `import.meta`. The engine only uses it to name its message
      // files and find its own directory, so a stable placeholder URL is enough.
      if (next.includes('import.meta')) next = next.replaceAll('import.meta', JSON.stringify({ url: `file:///engine/${file}` }));
      return next === code ? null : { code: next, map: null };
    },
  };
}
