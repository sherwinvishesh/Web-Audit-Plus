# Web Audit+

A Chrome extension that audits the page you are on: **Performance, Accessibility, Best Practices
and SEO**, scored by the bundled audit engine, plus **Agentic**, a fifth category for how well the page serves
AI agents. Every failing audit comes with a fix prompt you can paste into a coding assistant.

- **Lab-standard scores.** The audit engine (`packages/engine`) runs inside the extension, on your
  tab, with simulated throttling, device emulation and the standard metric weights and thresholds.
  How it runs, and the few things an extension cannot do, are in [docs/ENGINE.md](docs/ENGINE.md).
- **Agentic readiness.** 22 deterministic checks for crawl access, `llms.txt`, sitemaps, markdown
  twins, content negotiation and structured data, scored out of 100. No language model is involved.
  See [docs/CHECKS.md](docs/CHECKS.md).
- **Fix prompts.** Each prompt names the audit and quotes what was found: elements, URLs, measured
  values. It says why the audit matters, how to fix it, and what done looks like. You can copy one
  audit, a category, or everything at once.
- **A report you can work from.** Failed audits come first and passed ones are folded away. You can
  search and filter, and **Fix next** ranks every fix by the points it adds. Compare mode shows
  what changed since the last run of the same URL.
- **Exports.** A print-ready PDF, the full run as JSON (every audit result, as the engine produced
  it), a single-file HTML report that works offline, and a markdown summary to copy. The PDF has a
  cover with every score and a screenshot of the page, the ranked fixes, a page for each category
  with every finding written out, and the fix prompt. Its text is selectable, its links work, its
  headings are bookmarks, and it is tagged for screen readers. It prints on A4 or Letter, whichever
  your locale uses.
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
3. Watch the progress. The Agentic score arrives in seconds, while the audit engine reloads the page
   with its own emulation and throttling.
4. Press **Open full report**.

While an audit runs, Chrome shows a bar saying that Web Audit+ "started debugging this browser".
That bar is how Chrome tells you an extension is using the debugger, which the audit engine needs. It
goes away when the run ends. Pressing **Cancel** on it stops the run. The bar also shows for a
moment when you download a PDF, because Chrome prints the report through the same debugger.

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
| `debugger` | The audit engine drives the tab over the Chrome DevTools Protocol. It loads the page with emulation and throttling, records a trace, and collects network, DOM and accessibility data. The Agentic probe that sends a crawler's User-Agent uses it too, on the extension's own worker, and the PDF export prints the report page through it. |
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
  engine/       the audit engine in the extension: CDP adapter, Node shims, result normalization
  shared/       run records, storage, the report model, fix prompts, compare, filters
  extension/    entrypoints: background worker, side panel, report page
  ui/           React components for the side panel, the report and the HTML and PDF exports
packages/
  engine/       the audit engine: gatherers, audits and scoring (Apache-2.0, see its NOTICE)
scripts/        build plugin that bundles the audit engine for a service worker
tests/          Vitest suites, fixture sites, end-to-end harness
docs/           engine notes, the Agentic check catalog, testing
```

Built with [WXT](https://wxt.dev), React 18, TypeScript and Tailwind CSS 4. The typeface is
[Geist](https://vercel.com/font), bundled with the extension.

## License

`packages/engine` is derived from Apache-2.0 code by Google LLC and keeps that license; see its
[LICENSE](packages/engine/LICENSE) and [NOTICE](packages/engine/NOTICE).
