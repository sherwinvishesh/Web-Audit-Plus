# The audit engine

Performance, Accessibility, Best Practices and SEO are scored by the audit engine in
[`packages/engine`](../packages/engine) (`@webauditplus/engine`). It is bundled into the extension's
service worker and run on the tab you are looking at, with its stock desktop or mobile config, its
own gatherers and audits, and its own scoring: simulated throttling, device emulation, and the
standard metric weights and thresholds.

The engine is derived from Apache-2.0 code by Google LLC and modified for Web Audit+. Its
[LICENSE](../packages/engine/LICENSE) and [NOTICE](../packages/engine/NOTICE) say so, and the
original copyright headers stay on every file.

This page describes how the engine runs inside an extension, and everything that differs from
running it headless from Node.

## How it runs

| Piece | File | What it does |
| --- | --- | --- |
| Engine | `src/engine/engine.ts` | Calls the engine's `navigation()` with the stock `desktopConfig` or default (mobile) config, `onlyCategories` set to the categories you picked. |
| CDP adapter | `src/engine/cdp.ts` | The engine drives the browser through a Puppeteer `Page`, but only calls `page.url()` and `page.target().createCDPSession()`. The adapter gives it exactly that over `chrome.debugger`, including child sessions for iframes and workers (flat sessions, Chrome 125+). |
| Local commands | `src/engine/local-commands.ts` | Answers the protocol commands `chrome.debugger` does not offer extensions (below). |
| Build plugin | `scripts/engine-bundle.ts` | Makes the Node package run in a service worker (below). |
| Run | `src/extension/background/engine.ts` | Activates the tab, attaches the debugger, runs, detaches in `finally`, and puts the tab back on the audited page if a run stops while the engine has it elsewhere. |

### Commands answered locally

`chrome.debugger` only opens the tab-level protocol domains.

- **`Browser.getVersion`**: the extension runs in the same Chrome as the tab, so it answers from its
  own `navigator.userAgent` and `userAgentData`. The engine reads the Chrome milestone from it.
- **`Animation.enable` / `Animation.disable`**: no-ops. The engine enables the domain only to learn
  animation names for the "non-composited animations" audit. The animations themselves come from
  the trace, so that audit and every trace insight still run; only the names are missing.
- **`Profiler.enable`**: rejected with a clear reason. JavaScript coverage has no other source, so
  the two audits built on it, `unused-javascript` and `script-treemap-data`, report an error instead
  of a result (see below).

### Built for a service worker

The engine's sources are written so that nothing is read from disk at run time: the axe-core and
library-detector scripts it injects into the page are imported as text, its version comes from its
own `package.json`, and only en-US messages ship. What is left for the build is in
`scripts/engine-bundle.ts`:

| File | Build step |
| --- | --- |
| `core/runner.js` | The audit and gatherer directory listings, inlined instead of `readdirSync`. |
| `core/config/config-helpers.js` | Static imports of every audit and gatherer, keyed the way the engine looks them up. |
| Every engine file | `import.meta` becomes a fixed placeholder URL; a worker bundle has none. |
| Node built-ins | `fs`, `path`, `url`, `module`, `events` and `process` resolve to the small shims in `src/engine/shims/`; `puppeteer-core` to a stub, since the engine is always handed a page. |

Each step asserts that it matched, so an engine change that moves one of these spots fails the build
rather than a run.

The engine identifies its computed artifacts and page functions by `Function.name`. The extension
build sets `keepNames` (`wxt.config.ts`) so the minifier renames none of them.

### Changed in the engine sources

- **No telemetry.** The error-reporting hooks are no-ops; nothing is sent anywhere.
- **No external documentation links.** Audit descriptions explain the audit in place.
- **Back/forward cache check.** The engine briefly navigates away and back to see whether the page
  is restored from the cache. An extension's debugger is not allowed on `chrome://` pages, so it
  steps out to the extension's own empty `bfcache.html`. The audit runs and scores normally.
- **No HTML report renderer.** The extension draws its own report.

## Differences from a headless run

### By design

- **The tab is reloaded and brought to the front.** The audit reloads the page with the engine's
  emulation and throttling. A background tab does not paint, and the engine fails a page that never
  paints (`NO_FCP`), so the tab is activated for the run.
- **Storage reset uses the engine's defaults.** Before loading, the engine clears the origin's file
  systems, shader cache, service workers and Cache Storage (`clearStorageTypes`). Cookies,
  `localStorage` and IndexedDB are kept. The engine warns when stored data may have affected
  loading; the report shows that warning.
- **en-US only.** Titles, descriptions and display values are English.
- **What a saved run keeps.** The full-page screenshot (often several MB, used only for element
  thumbnails in a full-page report) and the translation map are dropped. The filmstrip and final
  screenshot stay.

### Not available to extensions

- **`unused-javascript` and `script-treemap-data`** need JavaScript coverage from the `Profiler`
  domain, which Chrome does not expose to `chrome.debugger`. They appear as "could not run" with
  that reason. Both carry no score weight (a diagnostic and a hidden data audit), so no category
  score changes. "Reduce unused CSS", which does not need coverage, runs normally.

### Environment, not the extension

- **Favicon requests.** A fresh headless Chrome profile requests `/favicon.ico` while the page loads.
  A site without one logs a 404, and Best Practices fails `errors-in-console`. In a real tab, Chrome
  has already requested the favicon, so the extension does not see that error.
- **Performance varies between runs.** The engine uses simulated throttling (Lantern), so the
  variance is smaller than with real throttling. It is not zero.

## Known scores

The fixture sites are in `tests/fixtures/sites.ts`. On a normal tab, desktop:

| Page | Perf / A11y / BP / SEO | Audits that could not run |
| --- | --- | --- |
| Flawed fixture | 100 / 55 / 92 / 75 | `unused-javascript`, `script-treemap-data` (coverage) |

The end-to-end suite (`tests/e2e/extension.e2e.ts`) runs the engine on the flawed fixture and checks
for exactly these scores. It also checks the failing audits, that only the two coverage audits
errored, that the back/forward cache check ran, and that the tab ends up back on the page.

## Changing the engine

1. Edit the sources in `packages/engine`.
2. `npm run build`. A build step that no longer matches fails here and names the file.
3. `npm run test`. `tests/engine/bundle.test.ts` checks every build step against the sources, and
   the normalizer tests run on a real result.
4. `npm run test:e2e` for the end-to-end check above.
