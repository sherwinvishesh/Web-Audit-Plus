# Testing

```sh
npm run typecheck   # strict TypeScript, no emit
npm run test        # unit and integration tests (Vitest, Node)
npm run build       # production build into .output/chrome-mv3
npm run test:e2e    # builds, then drives the built extension in a real Chrome
```

## Unit and integration tests

`npm run test` covers everything that does not need a browser:

- **Agentic checks** (`tests/agentic/`): every check against hand-built evidence, the scoring and lock
  rules, the URL and header primitives, and an integration suite that runs the whole probe pipeline
  over real HTTP against fixture servers (`tests/fixtures/sites.ts`): a compliant site, a
  client-rendered app with a catch-all route, and a redirect loop.
- **Fetch transport** (`tests/agentic/fetch-transport.test.ts`): the transport the extension uses,
  run on Node's `fetch` against the compliant fixture site, plus its body cap, redirects, timeouts,
  cancellation, and the gate that keeps a User-Agent override from leaking into other probes.
- **Run manager** (`tests/background/run-manager.test.ts`): queueing across tabs, cancellation while
  queued and while running, closed tabs, and what gets saved.
- **Lighthouse** (`tests/lighthouse/`): the CDP adapter over `chrome.debugger` (sessions, events,
  commands answered locally), the build plugin's rewrites of the installed Lighthouse (each one fails
  loudly if an upgrade moved what it patches), the Node shims, progress tracking, the log-normal
  scoring and impact estimates (checked against Lighthouse's own `statistics.js` and `util.js`), and
  how audits become report rows: status, points, evidence lines, remedies and acceptance criteria.
  These run against `tests/fixtures/lhr-flawed-desktop.json`, a trimmed real result for the flawed
  fixture site.
- **Shared modules** (`tests/shared/`): the URL policy, the port protocol, the IndexedDB run store
  (against `fake-indexeddb`), the report model that puts both engines' rows in one order, compare
  mode (which audits are new, fixed, better or worse, and the score and metric deltas), the search
  and filters, the markdown summary and export file names, and the weighted run progress.
- **HTML export** (`tests/ui/export-html.test.ts`): the downloaded report is one complete document
  with a Content-Security-Policy that allows no script, and a URL, title, finding or stylesheet from
  a hostile site cannot add a tag, an event handler or a script to it. Rows and fix prompts work
  without JavaScript.
- **Fix prompts, manifest, docs**: the prompt templates (including that everything quoted from the
  site stays inside code spans), the permissions the manifest asks for, and that `docs/CHECKS.md`
  lists exactly the checks the code implements.

## End-to-end

`npm run test:e2e` launches Chrome with the built extension loaded (Puppeteer, `enableExtensions`),
serves the fixture sites on `127.0.0.1`, and:

- runs an audit over the UI port and checks the saved record (Agentic 100 on the compliant site, with
  A8 not applicable because the host is local);
- runs the same audit against a page that sends `Content-Security-Policy: default-src 'none';
  connect-src 'none'`, which must not change the result;
- runs Lighthouse on the flawed fixture site (desktop) and checks the four category scores against
  the CLI's, the accessibility and SEO audits the site was built to fail, that only the two
  coverage-based audits could not run, that the back/forward cache check ran, and that the tab ends
  up back on the audited page;
- checks that a `chrome://` page is refused with an explanation;
- opens the report page for the saved run, follows a deep link to one audit, and finds the run in the
  history;
- on the report page, presses `/` and types a search, checks that the list narrows, presses Enter to
  reach the first result and `j` to move to the next, then opens the **Fix next** tab;
- clicks **Run audit** in the side panel page and waits for **Open full report**.

It looks for Chrome at the platform's default location; set `CHROME_PATH` to use another build. The
suite skips itself when Chrome or the build output is missing.

## Manual checks

1. `npm run build`, then load `.output/chrome-mv3` from `chrome://extensions` (Developer mode,
   **Load unpacked**).
2. Open a website, click the toolbar icon, and press **Run audit**. Chrome shows its "started
   debugging this browser" bar while the audit runs; it disappears when the run ends.
3. Press **Cancel** on that bar during a run: the run stops and the panel says why.
4. Start a run in one tab, switch to another tab and start a second: the second waits, and says so.
5. Close a tab mid-run: the run stops and nothing is saved.
6. Open the full report, switch themes, and reload: the theme sticks.
7. Run the same page twice. The second report compares with the first: score deltas on the rings,
   a "since" strip with the number of fixed and worse audits, and **Show changes**.
8. In the report, press `/`, search, press Enter, move with `j` and `k`, open a row with Enter, and
   press `c`: the fix prompt is on the clipboard and a toast says so.
9. **Export**: download the HTML report and open it with the network off. It renders with its fonts,
   rows open without JavaScript, and the browser console shows no CSP violation.

## Why the Agentic probes run in the background worker

The probes (`robots.txt`, `llms.txt`, the markdown twin, the content-negotiation requests) are sent
by the extension's background worker, not from inside the audited page. A page's
Content-Security-Policy applies to every script in it, isolated worlds included, so a site with
`connect-src 'self'` or `'none'` would block the probes and score as if it had none of the files.
From the worker, the extension's host permission exempts the requests from CORS and from the page's
policy, and cookies are omitted, so the site answers as it would answer an agent.

`fetch` cannot set `User-Agent`. For the probes that need one (the bot User-Agent check), the worker
attaches the debugger to itself and applies `Network.setUserAgentOverride` for that probe only. Timings
come from the worker's Resource Timing entries, so they are measured from your browser and network.
