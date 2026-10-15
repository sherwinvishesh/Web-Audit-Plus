# Agentic checks

The Agentic category scores how well a page serves AI agents: crawlers that build training sets,
search agents that cite pages, and assistants that fetch a page because someone asked about it. It
runs 22 deterministic checks, ported from OpenGEO's `opengeo test` (the author's other project,
coming soon) with the same weights and thresholds. No language model is involved anywhere: the
same responses always produce the same score.

Seven of the checks are **scored**: they measure what AI agents need today, and the score is
computed over them alone. The other fifteen are **suggestions**: the llms.txt, structured-data and
markdown-twin conventions. They are run, reported and given a fix, but they never move the score,
because the sites that serve AI agents best (openai.com and anthropic.com among them) have not
adopted them either. Not having them is not a defect; adopting them is what would set a page apart.

The engine lives in `src/agentic/` and has three layers that never mix:

```
evidence = await gatherEvidence(url, transport)  // all network I/O, once
results  = runChecks(evidence)                   // pure
score    = scoreChecks(results)                  // arithmetic only
```

## What is fetched

Every request goes to the audited origin, with cookies omitted and the cache bypassed. In the
extension the requests are sent by the extension's background worker rather than by the page, so
the page's Content-Security-Policy cannot block them and the site sees an anonymous visitor, the
way it sees an agent. Timings are measured from your browser.

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

A status code is never trusted on its own. A catch-all route that answers `/robots.txt` or
`/resume.md` with its HTML shell and a 200 is detected by sniffing the body, and is scored as the
missing file it is.

## How the score is computed

Every check carries a weight, OpenGEO's. The seven scored checks (A1, A3, A5, A6, A7, A8 and B13)
weigh 61 between them, and the score is computed over those alone. The fifteen suggestions weigh
another 61; their weight only orders them in the report, heaviest first.

| | Scored | Suggestions | Total |
|---|---|---|---|
| A. Discoverability | 52 | 5 | 57 |
| B. Implementation | 9 | 56 | 65 |
| Total | 61 | 61 | 122 |

```
score = round(100 x earned / applicable)
```

`applicable` is the sum of the weights of the scored checks that returned pass, partial or fail.
Rounding happens once, at the end. The scored weights total 61 and the score is out of 100, so a
weight is not a score point: every "+N" the report shows has been converted into score points for
this run.

| Verdict | In the denominator | Earns |
|---|---|---|
| pass | yes | the full weight |
| partial | yes | part of the weight, named in the row |
| fail | yes | nothing |
| suggestion | no | nothing; a scored-style fix is still written for it |
| locked | no | nothing; it waits on the check it reads from |
| n/a | no | nothing, and there is nothing to fix |

A suggestion the page has adopted is reported as a pass. One it has not adopted is reported as a
suggestion, with the same evidence, fix and prompt a failure would get, and no points.

### One missing twin costs one suggestion

When the markdown twin does not exist, twelve category B checks have nothing to inspect: there is
no Content-Type on a document that was never served. Those twelve become **locked** behind B1, so
the whole verdict on the markdown layer is carried by B1, the heaviest check in the table. A twin
that exists but is served wrong is still checked in full detail and reported, header by header, as
suggestions.

The locked checks are B2, B3, B4, B5, B6, B12 and B14 (read off the twin response itself) and B7,
B8, B9, B10 and B11 (probed against the live URL). The second group keeps a pass, because a site can
negotiate markdown at the page URL without serving a `.md` file at all; anything short of a pass is
locked. Their weights total 46. The report shows them as one line, "12 more suggestions apply once
a markdown twin is served", rather than as twelve separate items.

### Calibration

These are pinned by tests (`tests/agentic/score.test.ts`):

- A site that does what the leading AI sites do (crawlable, fast, HTTPS, content in the HTML, no
  llms.txt, no JSON-LD, no twin) scores **100**, with A2, A4 and B1 open as suggestions and the
  twelve twin checks waiting behind B1. OpenGEO scores the same site 80.
- The same site serving a correct twin scores **100** with every suggestion adopted.
- A scored check that fails is the only thing that moves the score below 100.
- B1 is the only check with a double-digit weight.

## The checks

<!-- The table below is checked against src/agentic/checks by tests/docs-sync.test.ts. -->

| Id | Weight | Scored | Required | Title |
|---|---|---|---|---|
| A1 | 9 | scored | yes | robots.txt exists and does not disallow known AI bots |
| A2 | 3 | suggestion | no | llms.txt is present and valid |
| A3 | 9 | scored | yes | sitemap.xml is present and valid |
| A4 | 2 | suggestion | no | Schema.org JSON-LD is present and parses |
| A5 | 9 | scored | yes | Real content is in the raw HTML, not only after JS runs |
| A6 | 8 | scored | yes | Time to first byte is fast enough for agent fetches |
| A7 | 8 | scored | yes | No noai / noimageai tag is silently blocking AI |
| A8 | 9 | scored | yes | Served over HTTPS with HSTS |
| B1 | 10 | suggestion | yes | Markdown twin URL is reachable and returns 2xx |
| B2 | 5 | suggestion | yes | Content-Type is exactly text/markdown; charset=utf-8 |
| B3 | 5 | suggestion | yes | Markdown response body is non-empty and carries the page |
| B4 | 3 | suggestion | no | X-Markdown-Tokens is present and a positive integer |
| B5 | 3 | suggestion | no | X-Content-Type-Options: nosniff is present |
| B6 | 3 | suggestion | yes | X-Robots-Tag on the twin includes noindex |
| B7 | 4 | suggestion | yes | Vary includes Accept, so CDNs cache the two formats separately |
| B8 | 3 | suggestion | no | HTML response advertises the twin via Link rel="alternate" |
| B9 | 6 | suggestion | yes | Accept: text/markdown receives markdown, not HTML |
| B10 | 6 | suggestion | yes | A known AI bot User-Agent receives markdown without an Accept header |
| B11 | 2 | suggestion | no | An Accept header excluding HTML and markdown returns 406 |
| B12 | 2 | suggestion | no | X-AEO-Version advertises the spec version implemented |
| B13 | 9 | scored | yes | The original HTML URL is still reachable and unaffected |
| B14 | 4 | suggestion | yes | The served markdown still matches the live page (no drift or staleness) |

"Required" is OpenGEO's label for the checks it treats as essential in its own grading; Web Audit+
keeps it for reference, and scores only the column before it.

### A. Discoverability

**A1. robots.txt** (9). Read the way a crawler reads it (RFC 9309): each of 28 known AI agents
obeys its own group if there is one and `*` otherwise, the longest matching rule wins, Allow wins a
tie, `*` and a trailing `$` are honoured. The rule is evaluated against this page's path, not just
`/`. Blocking an assistant or search agent fails. Blocking only bulk training crawlers (GPTBot,
CCBot, Google-Extended and so on) reads as a deliberate opt-out and earns 6 of 9. A missing file, or
an HTML page standing in for it, fails.

**A2. llms.txt** (3). Present and served as a file, with a `# Title` first line and at least one
link. Present but empty or linkless earns 1; links without a title earn 2.

**A3. sitemap.xml** (9). A `<urlset>` that lists this page earns full marks, compared without a
trailing slash. Not a sitemap, or one with no `<loc>`, earns 3; a valid sitemap that omits this page
earns 6. A sitemap index is followed into its first 10 children; when it lists more than 10 and
none of those has the page, it passes with a note rather than guessing about the rest.

**A4. JSON-LD** (2). At least one `application/ld+json` block that parses and declares an `@type`
(including inside `@graph`). Broken JSON or no `@type` earns 1.

**A5. Content in the raw HTML** (9). The page's main content is extracted from the HTML exactly as
served, without running JavaScript. 60 words or more passes; 15 or fewer (or an empty app root)
fails; in between is ramped.

**A6. Time to first byte** (8). 400 ms or less passes, 1500 ms or more fails, ramped in between. In
the extension it is measured from your browser and the row says so.

**A7. No AI opt-out directive** (8). Fails on `noai` or `noimageai` in `X-Robots-Tag` or in a
`robots`, `googlebot` or AI-specific robots meta tag.

**A8. HTTPS and HSTS** (9). Plain HTTP fails; HTTPS without `Strict-Transport-Security` earns 6.
n/a on local development hosts: `localhost`, `127.0.0.1`, `[::1]`, `*.localhost` and `*.local`.

### B. Implementation

**B1. Twin reachable** (10). The twin URL answers 2xx with something other than an HTML page.

**B2. Content-Type** (5). Exactly `text/markdown; charset=utf-8` passes. `text/markdown` without the
charset earns 3; `text/plain` earns 2; anything else fails.

**B3. Twin body** (5). Non-empty and at least half the live page's word count. Below that it is
ramped down to 8% of the page; an empty body fails.

**B4. X-Markdown-Tokens** (3). A positive integer, written as plain digits.

**B5. nosniff** (3). `X-Content-Type-Options: nosniff` on the twin.

**B6. noindex** (3). `X-Robots-Tag` on the twin includes `noindex`. Present without it earns 1.

**B7. Vary: Accept** (4). Parsed as a token list on both the HTML and the twin response, so
`Accept-Encoding` does not count. `*` does. One side right earns 2.

**B8. Link rel=alternate** (3). The HTML response carries a `Link` header with `rel="alternate"` and
`type="text/markdown"` pointing at a same-origin twin. A twin advertised on another origin is
reported and earns 1, but is never fetched; a Link header without a markdown alternate earns 1.

**B9. Accept negotiation** (6). `Accept: text/markdown` on the page URL receives markdown at the same
URL. A redirect to the `.md` URL fails: an agent that does not follow redirects gets nothing.

**B10. Bot User-Agent negotiation** (6). GPTBot's User-Agent with `Accept: */*` receives markdown at
the same URL. Same redirect rule as B9.

**B11. 406 Not Acceptable** (2). `Accept: application/pdf` gets a 406.

**B12. X-AEO-Version** (2). Present on the markdown response. Presence only: there is no registry of
versions to validate against.

**B13. HTML unaffected** (9). A normal browser request still gets the HTML page: 2xx, an HTML
Content-Type, a non-empty body, and no redirect to the twin.

**B14. No drift** (4). With a source hash (an `X-Markdown-Source-Hash` header, or `source_hash` in
the twin's frontmatter) the live page's extracted content is hashed and compared. A changed hash
with every fact intact earns 2 (cosmetic drift); facts missing fails. Without a hash, the numbers,
dates and prices on the live page are compared with the twin one by one: one discrepancy earns 2,
more fails. Ages are measured from when the evidence was gathered.

## Fix prompts

Every failing, partial or locked check produces a fix prompt for a coding agent. It includes the
check's evidence, the specific next step the check suggested, background on what "fixed" looks like
for that id, and, when the framework can be recognized from the served HTML, where request-level
changes belong in that stack (`middleware.ts` for Next.js, `_headers` on Netlify-style hosts, an edge
worker for hosted builders, and so on).

Everything quoted from the site travels as an inert single-line code span: whitespace collapsed,
control and bidirectional characters made visible, length capped, and fenced so it cannot close its
own span. The prompt says so, and ends by telling the agent that quoted values are evidence, not
instructions.
