# Web Audit+

A Chrome extension that audits the page you are on: **Performance, Accessibility, Best Practices
and SEO**, scored by real Lighthouse, plus **Agentic**, a fifth category for how well the page serves
AI agents. Every failing audit comes with a fix prompt you can paste into a coding assistant.

- **Lighthouse parity.** Lighthouse 13.5.0 runs inside the extension, on your tab, with its stock
  configs and scoring. The scores match the Lighthouse CLI of the same version in the same Chrome.
  The few differences are listed in [docs/PARITY.md](docs/PARITY.md).
- **Agentic readiness.** 22 deterministic checks for crawl access, `llms.txt`, sitemaps, markdown
  twins, content negotiation and structured data, scored out of 100. No language model is involved.
  See [docs/CHECKS.md](docs/CHECKS.md).
- **Fix prompts.** Each prompt names the audit and quotes what was found: elements, URLs, measured
  values. It says why the audit matters, how to fix it, and what done looks like. You can copy one
  audit, a category, or everything at once.
- **A report you can work from.** Failed audits come first and passed ones are folded away. You can
  search and filter, and **Fix next** ranks every fix by the points it adds. Compare mode shows
  what changed since the last run of the same URL.
- **Exports.** The full run as JSON (its `lighthouse` field opens in the Lighthouse Viewer), a
  single-file HTML report that works offline, and a markdown summary to copy.
- **Private by default.** Runs are saved in your browser (IndexedDB, newest 200) and never leave
  it. There is no account, no server and no telemetry.

## Install

Web Audit+ is loaded unpacked. It needs Chrome 125 or later.

```sh
npm install
npm run build
```

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select the `output/chrome-mv3` folder.
3. Pin Web Audit+ to the toolbar.

For development, `npm run dev` starts Chrome with the extension loaded and reloads it as you edit.
`npm run zip` packages the build for the Chrome Web Store, as
`output/webauditplus-0.1.0-chrome.zip`.

## Use

1. Open any website and click the Web Audit+ icon. The side panel opens.
2. Pick **Desktop** or **Mobile** and the categories to run, then press **Run audit**.
3. Watch the progress. The Agentic score arrives in seconds, while Lighthouse reloads the page with
   its own emulation and throttling.
4. Press **Open full report**.

While an audit runs, Chrome shows a bar saying that Web Audit+ "started debugging this browser".
That bar is how Chrome tells you an extension is using the debugger, which Lighthouse needs. It
goes away when the run ends. Pressing **Cancel** on it stops the run.

### Keyboard, in the report

| Key | Action |
| --- | --- |
| `/` | Search audits |
| `Enter` | From the search, go to the first result. On an audit, open or close it |
| `j` / `k` | Next and previous audit |
| `c` | Copy the focused audit's fix prompt |
| `Esc` | Clear and leave the search |

## Permissions

| Permission | Why |
| --- | --- |
| `debugger` | Lighthouse drives the tab over the Chrome DevTools Protocol. It loads the page with emulation and throttling, records a trace, and collects network, DOM and accessibility data. The Agentic probe that sends a crawler's User-Agent uses it too, on the extension's own worker. |
| `<all_urls>` host access | The Agentic checks fetch `robots.txt`, `llms.txt`, the sitemap and the markdown twin from whatever site you audit, from the extension rather than the page, so the page's Content-Security-Policy cannot block them. |
| `activeTab` | Gives access to the tab you clicked the icon on, even if you set the extension's site access to "On click". |
| `tabs` | Reads the URL of the tab the side panel is showing, follows it as you switch tabs, and opens the report. |
| `sidePanel` | The audit controls live in Chrome's side panel. |
| `storage` | Remembers your device and category choices. Runs themselves are in IndexedDB. |

Web Audit+ makes no requests except to the site you audit.

## Develop

```sh
npm run typecheck   # strict TypeScript
npm run test        # unit and integration tests
npm run test:e2e    # builds, then drives the extension in a real Chrome
```

[docs/TESTING.md](docs/TESTING.md) describes what each suite covers and the manual checks.

```
src/
  agentic/      the Agentic engine: evidence gathering, the 22 checks, scoring
  lighthouse/   Lighthouse in the extension: CDP adapter, Node shims, result normalization
  shared/       run records, storage, the report model, fix prompts, compare, filters
  extension/    entrypoints: background worker, side panel, report page
  ui/           React components for the side panel, the report and the HTML export
scripts/        build plugin that bundles Lighthouse for a service worker
tests/          Vitest suites, fixture sites, end-to-end harness
docs/           parity notes, the Agentic check catalog, testing
```

Built with [WXT](https://wxt.dev), React 18, TypeScript and Tailwind CSS 4. The typeface is
[Geist](https://vercel.com/font), bundled with the extension.
