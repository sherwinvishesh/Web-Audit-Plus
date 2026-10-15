---
title: "Web Audit+ · Audit the page. Ship the fix."
description: "A free, open-source Chrome extension that scores any page on Performance, Accessibility, Best Practices, SEO and Agentic, and writes a fix prompt for every failing audit. Nothing leaves your browser."
canonical: https://sherwinvishesh.github.io/Web-Audit-Plus/
last_updated: 2026-10-15
---

# Audit the page. Ship the fix.

Open-source Chrome extension

Web Audit+ scores the tab you are on for Performance, Accessibility, Best Practices, SEO and a fifth category, Agentic, for how well the page serves AI agents. Every failing audit comes with a fix prompt written for your coding assistant. Nothing leaves your browser.

- [Get the extension](https://sherwinvishesh.github.io/Web-Audit-Plus/docs/#install)
- [See what it does](#what-you-get)

Free · No account · Runs locally · Chrome 125 or later

| | |
|---|---|
| 5 | scores on every run |
| 22 | deterministic Agentic checks |
| 4 | export formats: PDF, HTML, JSON, markdown |
| 0 | servers, accounts or trackers |

## What you get

### A report you can work from, not just read.

Failed audits come first and passed ones are folded away. Every finding quotes what it found on the page, says why it matters, and ends with the fix.

#### A fix prompt for every failing audit

Each prompt names the audit, quotes the evidence (elements, URLs, measured values), explains why it matters, states the fix and says what done looks like. Copy one audit, a whole category, or everything at once, and paste it into the coding assistant you already use.

```
### color-contrast: Background and foreground colors do not have a sufficient contrast ratio (Accessibility)

- Points at stake: +7 on the Accessibility score
- Evidence: 3 elements, including `p.muted` at `#pricing` (2.9:1, needs 4.5:1)
- Fix: raise the text color to at least 4.5:1 against its background
- Reference: https://dequeuniversity.com/rules/axe/4.10/color-contrast
- Done when: every text element meets 4.5:1 (3:1 for large text). Re-run Web Audit+ to confirm.
```

#### Fix next

Every fix ranked by the points it adds to the score, across all five categories. Start at the top.

| | | |
|---|---|---|
| 1 | A5 raw-HTML content | +9 |
| 2 | color-contrast | +7 |
| 3 | meta-description | +6 |

#### Compare runs

Audit the same URL again and the report shows what changed: fixed, new, still failing, and the score delta for each category.

| | | |
|---|---|---|
| Fixed | image-alt, link-text | +9 |
| New | unsized-images | -3 |
| SEO | 75 to 100 | +25 |

#### Exports that hold up

A print-ready PDF with selectable text, working links, bookmarks and tags for screen readers. The full run as JSON. A single-file HTML report that works offline. A markdown summary to paste.

PDF · HTML · JSON · Markdown

#### Built for the keyboard

Search, move and copy without touching the mouse.

- `/` Search audits
- `j` `k` Next and previous audit
- `Enter` Open or close the audit
- `c` Copy its fix prompt
- `Esc` Leave the search

#### Private by default

Runs stay in your browser, newest 200. There is no account, no server and no telemetry. The only requests Web Audit+ makes go to the site you are auditing.

[Read the privacy policy](https://sherwinvishesh.github.io/Web-Audit-Plus/privacy/)

## Five scores

### Lab-standard scores, plus the one nobody else gives you.

The first four categories are scored by the bundled audit engine, running on your tab with simulated throttling, device emulation and the standard metric weights and thresholds. The fifth is new.

#### Performance

Core Web Vitals and the metrics behind them, measured in a lab run on your own tab.

#### Accessibility

Contrast, names, roles, landmarks and keyboard access, checked against axe-core rules.

#### Best Practices

HTTPS, console errors, deprecated APIs, image sizing, security headers and the rest.

#### SEO

Titles, descriptions, canonicals, crawlability, structured data and legible text.

#### Agentic

Whether AI crawlers, search agents and assistants can find, read and trust the page.

## The fifth score

### Your next visitor is an agent. Agentic tells you what it sees.

Crawlers that build training sets, search agents that cite pages, and assistants that fetch a page because someone asked about it. Agentic runs 22 deterministic checks on how a page serves them, from robots.txt to a markdown twin served through content negotiation. No language model is involved: the same responses always produce the same score.

```
score = round(100 × earned / applicable)
```

Seven checks make the score: what AI agents need today. The other fifteen are suggestions, llms.txt, structured data and the markdown twin, reported with a fix each but outside the score, because the sites that serve agents best have not adopted them either. A check that cannot apply, such as HTTPS on localhost, leaves the denominator instead of dragging the score down. When the markdown twin is missing, the twelve checks that read it wait behind B1 and are reported as one line.

| Id | Check | Scored |
|---|---|---|
| A1 | robots.txt exists and does not disallow known AI bots | weight 9 |
| A2 | llms.txt is present and valid | suggestion |
| A3 | sitemap.xml is present and valid | weight 9 |
| A4 | Schema.org JSON-LD is present and parses | suggestion |
| A5 | Real content is in the raw HTML, not only after JS runs | weight 9 |
| A6 | Time to first byte is fast enough for agent fetches | weight 8 |
| A7 | No noai or noimageai tag is silently blocking AI | weight 8 |
| A8 | Served over HTTPS with HSTS | weight 9 |
| B1 | Markdown twin URL is reachable and returns 2xx | suggestion |
| B2 | Content-Type is exactly text/markdown; charset=utf-8 | suggestion |
| B3 | Markdown response body is non-empty and carries the page | suggestion |
| B4 | X-Markdown-Tokens is present and a positive integer | suggestion |
| B5 | X-Content-Type-Options: nosniff is present | suggestion |
| B6 | X-Robots-Tag on the twin includes noindex | suggestion |
| B7 | Vary includes Accept, so CDNs cache the two formats separately | suggestion |
| B8 | HTML response advertises the twin via Link rel="alternate" | suggestion |
| B9 | Accept: text/markdown receives markdown, not HTML | suggestion |
| B10 | A known AI bot User-Agent receives markdown without an Accept header | suggestion |
| B11 | An Accept header excluding HTML and markdown returns 406 | suggestion |
| B12 | X-AEO-Version advertises the spec version implemented | suggestion |
| B13 | The original HTML URL is still reachable and unaffected | weight 9 |
| B14 | The served markdown still matches the live page | suggestion |

Status codes are never trusted on their own. A catch-all route that answers robots.txt with its HTML shell and a 200 is detected by reading the body, and scored as the missing file it is. [How each check is scored](https://sherwinvishesh.github.io/Web-Audit-Plus/docs/#agentic).

## How it works

### Three steps. About a minute.

#### Open the side panel

On any page, click the Web Audit+ icon. Pick Desktop or Mobile and the categories you want, then press Run audit.

#### Watch it run

The Agentic score arrives in seconds. The audit engine then reloads the page in your tab with its own emulation and throttling and records a trace, exactly as a lab run should.

#### Work the report

Failed audits first. Search, filter, copy a fix prompt, export the PDF, and compare with the last run of the same URL.

**While an audit runs, Chrome shows a bar saying that Web Audit+ started debugging this browser.** That is Chrome telling you an extension is using the debugger, which the audit engine needs for emulation, throttling and tracing. It goes away when the run ends, and Cancel on it stops the run.

## Privacy

### Nothing leaves your browser. That is the whole architecture.

There is no backend to leak from. The extension talks to the site you audit and to nobody else.

| | |
|---|---|
| 0 | requests to anyone but the site you are auditing |
| 200 | runs kept on your device, newest first, deletable any time |
| 0 | accounts, analytics, telemetry or remote code |

[The full privacy policy, in plain language](https://sherwinvishesh.github.io/Web-Audit-Plus/privacy/)

## FAQ

### Questions, answered straight.

**Is Web Audit+ free?**

Yes. It is open source, there is no account, no plan and no usage limit. Install it and run as many audits as you like.

**Why does Chrome say that Web Audit+ started debugging this browser?**

That bar is how Chrome tells you an extension is using the debugger. The audit engine needs it to load the page with emulation and throttling and to record a trace, the same way a lab audit does. The bar goes away when the run ends, and pressing Cancel on it stops the run.

**Does Web Audit+ send my pages anywhere?**

No. The only requests it makes go to the site you are auditing. Runs are saved in your browser, there is no server, no account and no telemetry.

**What does the Agentic score measure?**

How well a page serves AI agents: whether crawlers are allowed in, whether a sitemap exists, whether the content is in the raw HTML, whether the page is fast and served over HTTPS. Those seven checks make the score. Another fifteen, llms.txt, structured data and a markdown twin served and negotiated correctly, are reported as suggestions with a fix each, outside the score: the sites that serve agents best have not adopted them either. It is 22 deterministic checks with fixed weights. No language model is involved.

**Can I audit localhost or a staging site?**

Yes. Everything runs from your browser, so anything your browser can open can be audited. The HTTPS check is marked not applicable on local hosts so it does not drag the score down.

**Which browsers are supported?**

Google Chrome 125 or later. The extension uses Chrome's side panel and debugger APIs.

## Try it on this page

### The report is the pitch.

Install the extension, come back to this page and press Run audit. This site was built to pass its own tests, and you can check.

- [Install Web Audit+](https://sherwinvishesh.github.io/Web-Audit-Plus/docs/#install)
- [Read the source](https://github.com/sherwinvishesh/Web-Audit-Plus)
