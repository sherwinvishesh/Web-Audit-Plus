import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/**
 * Bundles Lighthouse (npm `lighthouse`, which ships for Node) into the extension's service worker.
 *
 * Lighthouse reads a handful of files from disk at module load: its own package.json, the axe-core
 * and library-detector sources it injects into the page, and directory listings it uses to find its
 * audits and gatherers. This plugin inlines those reads at build time, the same way Lighthouse's
 * own DevTools bundle does, and swaps Node built-ins for the small shims in src/lighthouse/shims.
 *
 * Every rewrite asserts that it matched. A Lighthouse upgrade that changes one of these files fails
 * the build here instead of failing at run time inside the worker.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHIMS = join(ROOT, 'src/lighthouse/shims');
const require = createRequire(join(ROOT, 'package.json'));
const LH_ROOT = dirname(require.resolve('lighthouse/package.json'));
const LH_CORE = join(LH_ROOT, 'core');

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
  // Lighthouse imports Puppeteer to connect to a browser when it is not handed a page. We always
  // hand it one, so its Node transport (`ws`) stays out of the bundle.
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

function listDir(dir: string): string[] {
  return readdirSync(dir).sort();
}

/** `import * as` every audit and gatherer, keyed the way `requireWrapper` looks them up. */
function bundledModules(): { imports: string; entries: string } {
  const imports: string[] = [];
  const entries: string[] = [];
  const add = (specifier: string): void => {
    const name = `__lhModule${imports.length}`;
    imports.push(`import * as ${name} from ${JSON.stringify(specifier)};`);
    const key = specifier.replace(/\.js$/, '');
    entries.push(`[${JSON.stringify(key)}, Promise.resolve(${name})]`, `[${JSON.stringify(specifier)}, Promise.resolve(${name})]`);
  };
  for (const dir of AUDIT_DIRS) {
    for (const file of jsFiles(join(LH_CORE, 'audits', dir), dir)) add(`../audits/${file}`);
  }
  for (const dir of GATHERER_DIRS) {
    for (const file of jsFiles(join(LH_CORE, 'gather/gatherers', dir), dir)) add(`../gather/gatherers/${file}`);
  }
  return { imports: imports.join('\n'), entries: entries.join(',\n') };
}

type Rewrite = (code: string) => string;

function replaceOnce(code: string, file: string, search: string | RegExp, replacement: string | ((...match: string[]) => string)): string {
  let matched = false;
  const next = code.replace(search, (...match: string[]) => {
    matched = true;
    return typeof replacement === 'string' ? replacement : replacement(...match);
  });
  if (!matched) throw new Error(`lighthouse-bundle: expected ${String(search)} in ${file}. Did Lighthouse change?`);
  return next;
}

function inlineSource(specifier: string): string {
  return JSON.stringify(readFileSync(require.resolve(specifier), 'utf8'));
}

const REWRITES: Readonly<Record<string, Rewrite>> = {
  'shared/root.js': (code) => {
    const pkg = JSON.parse(readFileSync(join(LH_ROOT, 'package.json'), 'utf8')) as { name: string; version: string };
    return replaceOnce(code, 'shared/root.js', /JSON\.parse\(fs\.readFileSync\(`\$\{LH_ROOT\}\/package\.json`, 'utf-8'\)\)/, JSON.stringify({ name: pkg.name, version: pkg.version }));
  },
  // Only en-US ships: every message carries its English default, so the 2 MB of translations go.
  'shared/localization/locales.js': () => 'export const locales = {};\n',
  'shared/localization/format.js': (code) =>
    replaceOnce(code, 'shared/localization/format.js', "fs.readdirSync(moduleDir + '/locales/')", JSON.stringify(listDir(join(LH_ROOT, 'shared/localization/locales')))),
  'core/lib/axe.js': (code) =>
    replaceOnce(code, 'core/lib/axe.js', "fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')", inlineSource('axe-core/axe.min.js')),
  'core/gather/gatherers/stacks.js': (code) =>
    replaceOnce(
      code,
      'core/gather/gatherers/stacks.js',
      /fs\.readFileSync\(\s*require\.resolve\('js-library-detector\/library\/libraries\.js'\), 'utf8'\)/,
      inlineSource('js-library-detector/library/libraries.js'),
    ),
  'core/runner.js': (code) => {
    let next = code;
    let count = 0;
    next = next.replace(/fs\.readdirSync\(path\.join\(moduleDir, '\.\/([^']+)'\)\)/g, (_match, dir: string) => {
      count++;
      return JSON.stringify(listDir(join(LH_CORE, dir)));
    });
    const expected = AUDIT_DIRS.length + GATHERER_DIRS.length;
    if (count !== expected) throw new Error(`lighthouse-bundle: inlined ${count} directory listings in core/runner.js, expected ${expected}. Did Lighthouse change?`);
    return next;
  },
  'core/config/config-helpers.js': (code) => {
    const { imports, entries } = bundledModules();
    return `${imports}\n${replaceOnce(code, 'core/config/config-helpers.js', '/* BUILD_REPLACE_BUNDLED_MODULES */', `[\n${entries}\n]`)}`;
  },
  // The HTML report templates: only the `html` output reads them, and the extension renders its own.
  'report/generator/report-assets.js': () => 'export const reportAssets = {};\n',
  // Lighthouse assumes any bundle of it is built by esbuild with `keepNames`, and prepends esbuild's
  // `__name` helper to the functions it injects into the page. This bundle has no such helper (and
  // no calls to one), so the prelude is empty.
  'core/lib/page-functions.js': (code) =>
    replaceOnce(code, 'core/lib/page-functions.js', 'const esbuildFunctionWrapperString = createEsbuildFunctionWrapper();', "const esbuildFunctionWrapperString = '';"),
  // The back/forward cache check leaves the page for a moment and comes back. Lighthouse leaves for
  // `chrome://terms` (as DevTools does), but an extension's debugger is not allowed on `chrome://`
  // pages: Chrome would end the session there. An empty page of this extension does the same job.
  'core/gather/gatherers/bf-cache-failures.js': (code) =>
    replaceOnce(code, 'core/gather/gatherers/bf-cache-failures.js', "{url: 'chrome://terms'}", "{url: chrome.runtime.getURL('/bfcache.html')}"),
  // Error reporting is off unless a flag turns it on; keep the Sentry Node SDK out of the bundle.
  'core/lib/sentry.js': (code) =>
    replaceOnce(code, 'core/lib/sentry.js', "await import('@sentry/node')", "await Promise.reject(new Error('Sentry is not bundled'))"),
};

/** The Lighthouse files this plugin rewrites, relative to the package root. */
export const REWRITTEN_FILES: readonly string[] = Object.keys(REWRITES);

function lighthousePath(id: string): string | undefined {
  const file = id.split('?')[0] ?? id;
  if (!file.startsWith(LH_ROOT + sep)) return undefined;
  return relative(LH_ROOT, file).split(sep).join('/');
}

export function lighthouseBundle(): Plugin {
  return {
    name: 'webauditplus:lighthouse-bundle',
    enforce: 'pre',
    resolveId(source) {
      const shim = BUILTIN_SHIMS[source.replace(/^node:/, '')];
      return shim ? join(SHIMS, shim) : null;
    },
    transform(code, id) {
      const file = lighthousePath(id);
      if (!file) return null;
      const rewrite = REWRITES[file];
      let next = rewrite ? rewrite(code) : code;
      // A service worker bundle has no `import.meta`. Lighthouse only uses it to find its own files,
      // and those reads are inlined above, so a stable placeholder URL is enough.
      if (next.includes('import.meta')) next = next.replaceAll('import.meta', JSON.stringify({ url: `file:///lighthouse/${file}` }));
      return next === code ? null : { code: next, map: null };
    },
  };
}
