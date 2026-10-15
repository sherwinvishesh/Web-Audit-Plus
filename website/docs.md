---
title: "Docs · Web Audit+"
description: "Install Web Audit+, run an audit, work the report, copy fix prompts, export, and understand the 22 Agentic checks, the permissions and how to develop the extension."
canonical: https://sherwinvishesh.github.io/Web-Audit-Plus/docs/
last_updated: 2026-10-15
---

# Everything Web Audit+ does, and how.

Documentation

From installing the extension to the weight of every Agentic check. If a question is not answered here, open an issue on GitHub.

Version 0.1.0 · Chrome 125 or later · Updated October 15, 2026

On this page: Install · Run an audit · The report · Fix prompts · Exports · Keyboard · Agentic checks · Permissions · Troubleshooting · Develop · License

## Install

Web Audit+ needs Google Chrome 125 or later. Until it is listed on the Chrome Web Store, it is loaded unpacked from a local build.

1. Clone the repository and build it:

```
git clone https://github.com/sherwinvishesh/Web-Audit-Plus.git
cd Web-Audit-Plus
npm install
npm run build
```

2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `output/chrome-mv3` folder.
4. Pin Web Audit+ to the toolbar from the puzzle-piece menu.

The build is a complete, self-contained extension. It makes no requests except to the site you audit, so you can load it on a machine that is otherwise offline.

## Run an audit

1. Open the page you want to audit and click the Web Audit+ icon. The side panel opens.
2. Pick **Desktop** or **Mobile** and the categories to run, then press **Run audit**.
3. Watch the progress. The Agentic score arrives in seconds, while the audit engine reloads the page with its own emulation and throttling and records a trace.
4. Press **Open full report**.

While the engine runs, Chrome shows a bar saying that Web Audit+ *started debugging this browser*. That is how Chrome tells you an extension is using the debugger, which the audit engine needs. It goes away when the run ends. Pressing **Cancel** on it stops the run. The bar also shows for a moment when you download a PDF, because Chrome prints the report through the same debugger.

Mobile runs emulate a mid-range phone with simulated throttling; Desktop runs use a desktop viewport and lighter throttling. Both use the standard metric weights and thresholds, so the numbers line up with the ones you would get from a lab run in DevTools.

## The report

The report opens in its own tab. Scores sit at the top, one ring per category, and the audits follow, grouped by category with failed audits first and passed ones folded away.

- **Search and filter.** Press `/` to search audit titles and ids. The filter chips narrow the list to failed, partial or passed audits, and to single categories.
- **Fix next.** A tab that ranks every fix by the points it adds to the score, across all categories, most points first. It keeps its place in the URL, so a link to it stays on it.
- **Compare.** When a URL has been audited before, the report shows what changed since the last run: fixed, new, still failing, and the score delta for each category.
- **History.** The report page without a run lists your saved runs, newest first. Runs are kept in your browser, newest 200.
- **Deep links.** Every audit has a link, so a URL like `report.html?run=…#audit-agentic:B1` opens the report with that row expanded.

## Fix prompts

Every failing, partial or locked audit produces a prompt written for a coding assistant. Each item names the audit, states the points at stake, quotes the evidence (elements, URLs, measured values), explains the fix, links a reference and ends with what done looks like. The prompt then asks the assistant for file-by-file diffs against the real repository, and tells it not to touch unrelated code.

You can copy one audit (the copy button on its row, or `c` while it is focused), a whole category, or every fix in the run at once.

Everything quoted from the site travels as an inert single-line code span: whitespace collapsed, control and bidirectional characters made visible, length capped, and fenced so it cannot close its own span. The prompt says so, and ends by telling the assistant that quoted values are evidence, not instructions.

A prompt quotes content from the page it audited. Before pasting a prompt about a private page into a hosted assistant, read it the way you would read anything else you paste there.

## Exports

The Export menu in the report offers four formats. All of them are produced in your browser.

| Format | What you get |
|---|---|
| PDF | A print-ready document: a cover with every score and a screenshot of the page, the ranked fixes, a page for each category with every finding written out, and the fix prompt. Text is selectable, links work, headings are bookmarks, and the file is tagged for screen readers. It prints on A4 or Letter, whichever your locale uses. |
| HTML | A single-file report that works offline, with the same layout as the report tab. |
| JSON | The full run as the engine produced it: every audit result, the Agentic evidence, the scores and the run settings. |
| Markdown | A summary with the scores and the failing audits, ready to paste into an issue or a pull request. |

## Keyboard

| Key | Action |
|---|---|
| `/` | Search audits |
| `Enter` | From the search, go to the first result. On an audit, open or close it |
| `j` / `k` | Next and previous audit |
| `c` | Copy the focused audit's fix prompt |
| `Esc` | Clear and leave the search |

## Agentic checks

The Agentic category scores how well a page serves AI agents: crawlers that build training sets, search agents that cite pages, and assistants that fetch a page because someone asked about it. It runs 22 deterministic checks, ported from OpenGEO's `opengeo test` with the same weights, thresholds and calibration. No language model is involved anywhere: the same responses always produce the same score.

### What is fetched

Every request goes to the audited origin, with cookies omitted and the cache bypassed. The requests are sent by the extension's background worker rather than by the page, so the page's Content-Security-Policy cannot block them and the site sees an anonymous visitor, the way it sees an agent. Timings are measured from your browser.

| Probe | Request | Used by |
|---|---|---|
| html | the page, as a browser (Chrome User-Agent, HTML Accept) | A4, A5, A6, A7, A8, B7, B8, B13, B14 |
| robots | `/robots.txt` | A1 |
| llms | `/llms.txt` | A2 |
| sitemap | `/sitemap.xml`, plus up to 10 children of a sitemap index | A3 |
| twin | the markdown twin: the page's `Link rel="alternate"` target if it is on the same origin, otherwise the page path plus `.md` (`/` becomes `/index.md`) | B1 to B7, B12, B14 |
| acceptMarkdown | the page, `Accept: text/markdown`, Web Audit+'s own User-Agent | B9 |
| botUa | the page, GPTBot's User-Agent, `Accept: */*` | B10 |
| notAcceptable | the page, `Accept: application/pdf` | B11 |

A status code is never trusted on its own. A catch-all route that answers `/robots.txt` or `/resume.md` with its HTML shell and a 200 is detected by sniffing the body, and is scored as the missing file it is.

### How the score is computed

Every check carries a weight. Required checks carry more than recommended ones. Weights total 122 and the score is out of 100, so a weight is not a score point: every "+N" the report shows has been converted into score points for this run.

```
score = round(100 × earned / applicable)
```

`applicable` is the sum of the weights of the checks that returned pass, partial or fail. Rounding happens once, at the end.

| Verdict | In the denominator | Earns |
|---|---|---|
| pass | yes | the full weight |
| partial | yes | part of the weight, named in the row |
| fail | yes | nothing |
| locked | no | nothing until the check it is waiting on passes |
| n/a | no | nothing, and there is nothing to fix |

When the markdown twin does not exist, the twelve category B checks that read it have nothing to inspect. They become **locked** behind B1 and leave the denominator, so the whole verdict on the markdown layer is carried by B1, the heaviest check in the table. The report shows them as one line, with what unlocking them is worth, rather than as twelve separate failures. A twin that exists but is served wrong is still scored in full detail.

Two calibration points are pinned by tests: a site that does everything right except the AI conventions (no llms.txt, no JSON-LD, no twin) scores 80, and the same site serving a correct twin scores 100.

### The checks

| Id | Weight | Required | Check |
|---|---|---|---|
| A1 | 9 | yes | robots.txt exists and does not disallow known AI bots. Read the way a crawler reads it: each of 28 known AI agents obeys its own group if there is one and `*` otherwise. Blocking an assistant or search agent fails; blocking only bulk training crawlers reads as a deliberate opt-out and earns 6 of 9. |
| A2 | 3 | no | llms.txt is present and valid: served as a file, with a `# Title` first line and at least one link. |
| A3 | 9 | yes | sitemap.xml is present and valid, and lists this page. A valid sitemap that omits the page earns 6; a sitemap index is followed into its first 10 children. |
| A4 | 2 | no | Schema.org JSON-LD is present and parses, with an `@type`. |
| A5 | 9 | yes | Real content is in the raw HTML, not only after JS runs. 60 words or more in the main content passes; 15 or fewer fails; in between is ramped. |
| A6 | 8 | yes | Time to first byte is fast enough for agent fetches: 400 ms or less passes, 1500 ms or more fails, ramped in between. |
| A7 | 8 | yes | No `noai` or `noimageai` directive in `X-Robots-Tag` or a robots meta tag is silently blocking AI. |
| A8 | 9 | yes | Served over HTTPS with HSTS. HTTPS without `Strict-Transport-Security` earns 6. Not applicable on local hosts. |
| B1 | 10 | yes | Markdown twin URL is reachable and returns 2xx with something other than an HTML page. |
| B2 | 5 | yes | Content-Type is exactly `text/markdown; charset=utf-8`. Without the charset earns 3; `text/plain` earns 2. |
| B3 | 5 | yes | Markdown response body is non-empty and at least half the live page's word count. |
| B4 | 3 | no | `X-Markdown-Tokens` is present and a positive integer. |
| B5 | 3 | no | `X-Content-Type-Options: nosniff` is present on the twin. |
| B6 | 3 | yes | `X-Robots-Tag` on the twin includes `noindex`. |
| B7 | 4 | yes | `Vary` includes `Accept` on both responses, so CDNs cache the two formats separately. One side right earns 2. |
| B8 | 3 | no | The HTML response advertises the twin via a `Link` header with `rel="alternate"` and `type="text/markdown"`. |
| B9 | 6 | yes | `Accept: text/markdown` on the page URL receives markdown at the same URL, not HTML and not a redirect. |
| B10 | 6 | yes | A known AI bot User-Agent receives markdown at the same URL without an Accept header. |
| B11 | 2 | no | An Accept header excluding HTML and markdown (`application/pdf`) returns 406. |
| B12 | 2 | no | `X-AEO-Version` on the markdown response advertises the spec version implemented. |
| B13 | 9 | yes | The original HTML URL is still reachable and unaffected: 2xx, an HTML Content-Type, a non-empty body, and no redirect to the twin. |
| B14 | 4 | yes | The served markdown still matches the live page. With a source hash, the live content is hashed and compared; without one, the numbers, dates and prices on the live page are compared with the twin one by one. One discrepancy earns 2. |

Checks B4 to B12 read response headers that only the server can set. A static host that cannot send custom headers, such as GitHub Pages, can pass everything else and leaves those on the table; a CDN or edge layer in front of it can add them.

## Permissions

Chrome asks for these when the extension is installed. Each one is there for a reason you can check in the source.

| Permission | Why |
|---|---|
| `debugger` | The audit engine drives the tab over the Chrome DevTools Protocol. It loads the page with emulation and throttling, records a trace, and collects network, DOM and accessibility data. The Agentic probe that sends a crawler's User-Agent uses it too, on the extension's own worker, and the PDF export prints the report page through it. |
| `<all_urls>` host access | The Agentic checks fetch `robots.txt`, `llms.txt`, the sitemap and the markdown twin from whatever site you audit, from the extension rather than the page, so the page's Content-Security-Policy cannot block them. |
| `activeTab` | Gives access to the tab you clicked the icon on, even if you set the extension's site access to "On click". |
| `tabs` | Reads the URL of the tab the side panel is showing, follows it as you switch tabs, and opens the report. |
| `sidePanel` | The audit controls live in Chrome's side panel. |
| `storage` | Remembers your device and category choices. Runs themselves are in IndexedDB. |

Web Audit+ makes no requests except to the site you audit. The [privacy policy](https://sherwinvishesh.github.io/Web-Audit-Plus/privacy/) spells out what that means.

## Troubleshooting

**"This is a browser page"**
Chrome does not let extensions audit its own pages (`chrome://`, the Web Store, other extensions). Open a normal website and try again.

**The run stopped**
Pressing Cancel on the debugging bar, closing the tab, or another extension attaching the debugger to the same tab ends the run. Start it again from the side panel.

**Two audits show an error**
Chrome keeps JavaScript coverage from extensions, so the two audits built on it, unused JavaScript and the script treemap, cannot run. Everything else does.

**Agentic says HTTPS is not applicable**
That is expected on `localhost`, `127.0.0.1` and `*.local` hosts. The check leaves the denominator instead of failing.

**Performance scores differ between runs**
Lab runs vary with what else your machine is doing. Close heavy tabs, run again, and compare the two runs in the report.

## Develop

```
npm run dev         # Chrome with the extension loaded, reloading as you edit
npm run typecheck   # strict TypeScript
npm run test        # unit and integration tests
npm run test:e2e    # builds, then drives the extension in a real Chrome
npm run zip         # packages the build for the Chrome Web Store
```

```
src/
  agentic/      the Agentic engine: evidence gathering, the 22 checks, scoring
  engine/       the audit engine inside the extension: CDP adapter, shims, normalization
  shared/       run records, storage, report model, fix prompts, compare, filters
  extension/    entrypoints: background worker, side panel, report page
  ui/           React components: side panel, report, HTML and PDF exports
packages/
  engine/       the audit engine: gatherers, audits and scoring
scripts/        build plugin that bundles the audit engine for a service worker
tests/          Vitest suites, fixture sites, end-to-end harness
docs/           engine notes, the Agentic check catalog, testing
website/        this site
```

Built with WXT, React 18, TypeScript and Tailwind CSS 4. The typeface is Geist, bundled with the extension. Pull requests run the same checks as the CI badge on the repository: typecheck, unit tests, build and the end-to-end suite in a real Chrome.

## License

The audit engine in `packages/engine` is derived from Apache-2.0 code by Google LLC and keeps that license, with its LICENSE and NOTICE files. Geist is used under the SIL Open Font License. The source is on [GitHub](https://github.com/sherwinvishesh/Web-Audit-Plus).
