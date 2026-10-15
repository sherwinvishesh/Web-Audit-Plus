# Lighthouse parity

Performance, Accessibility, Best Practices and SEO are not reimplemented: they are produced by
**Lighthouse 13.5.0 itself**. It is bundled into the extension's service worker and run on the tab
you are looking at, with Lighthouse's own config, gatherers, audits and scoring. The scores are the
ones the Lighthouse CLI of the same version gives the same page in the same Chrome, and an exported
run's `lighthouse` field is a standard Lighthouse result (LHR) that opens in the
[Lighthouse Viewer](https://googlechrome.github.io/lighthouse/viewer/).

This page lists everything that is different from running Lighthouse yourself, and why.

## How it runs

| Piece | File | What it does |
| --- | --- | --- |
| Engine | `src/lighthouse/engine.ts` | Calls Lighthouse's `navigation()` with the stock `desktopConfig` or default (mobile) config, `onlyCategories` set to the categories you picked. |
| CDP adapter | `src/lighthouse/cdp.ts` | Lighthouse drives the browser through a Puppeteer `Page`, but only calls `page.url()` and `page.target().createCDPSession()`. The adapter gives it exactly that over `chrome.debugger`, including child sessions for iframes and workers (flat sessions, Chrome 125+). |
| Local commands | `src/lighthouse/local-commands.ts` | Answers the protocol commands `chrome.debugger` does not offer extensions (below). |
| Build plugin | `scripts/lighthouse-bundle.ts` | Makes the Node package run in a service worker (below). |
| Run | `src/extension/background/lighthouse.ts` | Activates the tab, attaches the debugger, runs, detaches in `finally`, and puts the tab back on the audited page if a run stops while Lighthouse has it elsewhere. |

### Commands answered locally

`chrome.debugger` only opens the tab-level protocol domains.

- **`Browser.getVersion`**: the extension runs in the same Chrome as the tab, so it answers from its
  own `navigator.userAgent` and `userAgentData`. Lighthouse reads the Chrome milestone from it.
- **`Animation.enable` / `Animation.disable`**: no-ops. Lighthouse enables the domain only to learn
  animation names for the "non-composited animations" audit. The animations themselves come from
  the trace, so that audit and every trace insight still run; only the names are missing.
- **`Profiler.enable`**: rejected with a clear reason. JavaScript coverage has no other source, so
  the two audits built on it, `unused-javascript` and `script-treemap-data`, report an error instead
  of a result (see below).

### Build rewrites

Lighthouse reads a few files from disk while its modules load. `scripts/lighthouse-bundle.ts`
inlines those reads at build time, the way Lighthouse's own DevTools bundle does, and replaces Node
built-ins (`fs`, `path`, `url`, `module`, `events`, `process`) with the small shims in
`src/lighthouse/shims/`. Each rewrite asserts that it matched, so a Lighthouse upgrade that moves
something fails the build rather than a run.

| File | Rewrite |
| --- | --- |
| `shared/root.js` | The package's name and version, instead of reading `package.json`. |
| `core/runner.js` | The audit and gatherer directory listings, instead of `readdirSync`. |
| `core/config/config-helpers.js` | Static imports of every audit and gatherer, keyed as Lighthouse looks them up. |
| `core/lib/axe.js`, `core/gather/gatherers/stacks.js` | The axe-core and library-detector sources Lighthouse injects into the page. |
| `shared/localization/*` | Only en-US ships; every message carries its English default. Saves about 2 MB. |
| `report/generator/report-assets.js` | Emptied: the extension renders its own report. |
| `core/lib/page-functions.js` | No esbuild `__name` prelude for functions injected into the page (see `keepNames` below). |
| `core/gather/gatherers/bf-cache-failures.js` | Steps out to the extension's empty `bfcache.html` instead of `chrome://terms`. |
| `core/lib/sentry.js` | The Sentry Node SDK is not bundled; error reporting is off by default anyway. |

Lighthouse identifies its computed artifacts and page functions by `Function.name`, and its own
bundles keep names. The extension build sets `keepNames` (`wxt.config.ts`) so the minifier renames
none of them.

## Differences from running Lighthouse yourself

### By design

- **The tab is reloaded and brought to the front.** Like DevTools' Lighthouse panel, the audit reloads
  the page with Lighthouse's emulation and throttling. A background tab does not paint, and
  Lighthouse fails a page that never paints (`NO_FCP`), so the tab is activated for the run.
- **Storage reset uses Lighthouse's defaults.** Before loading, Lighthouse clears the origin's file
  systems, shader cache, service workers and Cache Storage (`clearStorageTypes`). Cookies,
  `localStorage` and IndexedDB are kept, as in the CLI. Lighthouse warns when stored data may have
  affected loading; the report shows that warning.
- **Back/forward cache check.** Lighthouse briefly navigates away and back to see whether the page
  is restored from the cache. It normally uses `chrome://terms`, where an extension's debugger is not
  allowed, so it uses the extension's own empty page. The audit runs and scores normally.
- **en-US only.** Titles, descriptions and display values are English.
- **What a saved run keeps.** The full-page screenshot (often several MB, used only for element
  thumbnails in Lighthouse's own report) and the translation map are dropped. The filmstrip and
  final screenshot stay.

### Not available to extensions

- **`unused-javascript` and `script-treemap-data`** need JavaScript coverage from the `Profiler`
  domain, which Chrome does not expose to `chrome.debugger`. They appear as "could not run" with
  that reason. Both carry no score weight (a diagnostic and a hidden data audit), so no category
  score changes. "Reduce unused CSS", which does not need coverage, runs normally.

### Environment, not the extension

- **Favicon requests.** A fresh Chrome profile, like the one the CLI launches, requests
  `/favicon.ico` while the page loads. A site without one logs a 404, and Best Practices fails
  `errors-in-console`. In a real tab, Chrome has already requested the favicon, so the extension
  does not see that error. The compliant fixture page shows this: the CLI gives Best Practices 96,
  the extension 100.
- **Performance varies between runs**, in the extension as in any Lighthouse. Both use simulated
  throttling (Lantern), so the variance is smaller than with real throttling. It is not zero.

## Measured parity

Same Chrome (155), same machine, Lighthouse 13.5.0, simulated throttling. The CLI ran headless with
its desktop preset or its mobile default. The extension ran on a normal tab. The fixture sites are
in `tests/fixtures/sites.ts`.

| Page | Device | CLI (Perf / A11y / BP / SEO) | Extension | Audits that differ |
| --- | --- | --- | --- | --- |
| Flawed fixture | Desktop | 100 / 55 / 92 / 75 | 100 / 55 / 92 / 75 | `unused-javascript` (coverage) |
| Flawed fixture | Mobile | 100 / 55 / 92 / 75 | 100 / 55 / 92 / 75 | `unused-javascript`; `speed-index` 0.99 vs 1 |
| Compliant fixture | Desktop | 100 / 81 / 96 / 91 | 100 / 81 / 100 / 91 | `errors-in-console` (favicon, above); `unused-javascript` |
| example.com | Desktop | 100 / 96 / 100 / 80 | 100 / 96 / 100 / 80 | `unused-javascript` |

The end-to-end suite (`tests/e2e/extension.e2e.ts`) runs Lighthouse on the flawed fixture and checks
for exactly 100 / 55 / 92 / 75. It also checks the failing audits, that only the two coverage audits
errored, that the back/forward cache check ran, and that the tab ends up back on the page.

## Upgrading Lighthouse

1. Bump `lighthouse` in `package.json` and install.
2. `npm run build`. A rewrite that no longer matches fails here and names the file.
3. `npm run test`. `tests/lighthouse/bundle.test.ts` checks every rewrite against the installed
   package, and the normalizer tests run on a real result.
4. `npm run test:e2e` for the end-to-end parity check above.
5. Update the version and table on this page.
