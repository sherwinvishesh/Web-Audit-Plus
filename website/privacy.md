---
title: "Privacy Policy · Web Audit+"
description: "Web Audit+ collects nothing. This policy says exactly what the extension stores on your device, what it sends to the site you audit, and what it never does."
canonical: https://sherwinvishesh.github.io/Web-Audit-Plus/privacy/
last_updated: 2026-10-15
---

# We collect nothing. Here is exactly what that means.

Privacy policy

This policy covers the Web Audit+ Chrome extension and this website. It is written to be read, not skimmed, and every statement in it can be checked against the source code.

Effective October 15, 2026 · Applies to Web Audit+ version 0.1.0 and later

On this page: The short version · What Web Audit+ is · What it stores on your device · What it sends, and to whom · What it never does · Permissions · Exports and fix prompts · This website · Your rights · Children · Changes to this policy · Contact

**Web Audit+ does not collect, transmit, store or sell any personal data. Not the URLs you audit, not your reports, not your name, not an analytics event.**

It has no server, no account system and no telemetry. Everything it produces stays in your browser until you choose to export it. The only network requests it makes go to the website you are auditing, so that it can audit it.

## 1. What Web Audit+ is

Web Audit+ is an open-source Chrome extension that audits the page you are on for Performance, Accessibility, Best Practices, SEO and Agentic readiness, and writes a fix prompt for every failing audit. It is published by Sherwin Vishesh ("we", "us"), and its complete source code is public at [github.com/sherwinvishesh/Web-Audit-Plus](https://github.com/sherwinvishesh/Web-Audit-Plus). When this policy says the extension does not do something, you do not have to take our word for it.

## 2. What it stores on your device

Two things, both inside your own Chrome profile and nowhere else.

- **Audit runs.** Each run (the URL, the time, the settings, the scores, every audit result and the Agentic evidence) is saved in your browser's IndexedDB so the report can be reopened and compared with later runs. The newest 200 runs are kept; older ones are deleted automatically. You can delete any run from the report's history at any time.
- **Settings.** Your device choice (Desktop or Mobile) and the categories you last selected are saved in Chrome's local extension storage so the side panel remembers them.

Nothing is synced to a Google account or to any other device. Uninstalling the extension removes all of it. We cannot see any of it, because it never leaves your machine.

## 3. What it sends, and to whom

Every request Web Audit+ makes goes to the website you are auditing. None goes to us. There is no "us" to send it to: the extension has no backend, no API and no proxy.

When you run an audit on a page, the extension:

- reloads that page in your tab with device emulation and network throttling, which the site sees as a normal page load from your browser;
- fetches, from the same site, its `robots.txt`, `llms.txt` and `sitemap.xml` (and up to 10 children of a sitemap index), the page's markdown twin, and the page itself three more times with different `Accept` and `User-Agent` headers, including GPTBot's, to test content negotiation.

Those extra fetches are sent without cookies and bypass the cache, so the site sees an anonymous visitor, the way it sees an agent. They are limited to the origin of the page you audit. The extension does not fetch from, or report to, any other domain.

## 4. What it never does

- No analytics, usage statistics, crash reporting or telemetry of any kind.
- No accounts, sign-in, licence keys or activation.
- No selling, sharing, renting or transferring of data to anyone, because there is no data on our side to transfer.
- No remote code. Everything the extension runs ships inside the extension package you installed.
- No advertising and no advertising identifiers.
- No reading of pages you have not audited. The host permission exists so the extension can fetch from the site you are auditing; it is not used to observe your browsing.
- No audits without your action. An audit runs only when you press Run audit.

## 5. Permissions

Chrome asks you to grant these when the extension is installed. Here is what each one is for, and nothing else it is used for.

| Permission | Used for |
|---|---|
| `debugger` | The audit engine drives the tab over the Chrome DevTools Protocol to load the page with emulation and throttling, record a trace, and collect network, DOM and accessibility data. One Agentic probe uses it on the extension's own worker to send a crawler's User-Agent. The PDF export prints the report through it. Chrome shows a bar while it is attached, and it is detached when the run ends. |
| `<all_urls>` host access | Fetching `robots.txt`, `llms.txt`, the sitemap and the markdown twin from whatever site you audit, from the extension rather than the page, so the page's Content-Security-Policy cannot block them. |
| `activeTab` | Access to the tab you clicked the icon on, even if you set the extension's site access to "On click". |
| `tabs` | Reading the URL of the tab the side panel is showing, following it as you switch tabs, and opening the report. |
| `sidePanel` | The audit controls live in Chrome's side panel. |
| `storage` | Remembering your device and category choices. |

## 6. Exports and fix prompts

Exports (PDF, HTML, JSON and markdown) are files that you create and that your browser saves where you choose. They contain the audited URL, the scores, the findings and, in the PDF, a screenshot of the audited page. Once you share a file, who sees it is up to you.

Fix prompts are text that you copy. They quote content from the audited page: element snippets, URLs, measured values and response headers. We never see them. If you paste a prompt into a hosted AI assistant, that service's privacy terms apply to what you pasted, so read a prompt about a private page before you send it anywhere.

## 7. This website

This site is static and hosted on GitHub Pages. It sets no cookies, runs no analytics, loads nothing from third parties and serves its fonts itself. GitHub, as the host, may log standard request data such as your IP address and user agent when you load a page here; that is described in [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement), and we do not have access to it.

## 8. Your rights

Privacy laws such as the GDPR and the CCPA give you the right to access, correct, export and delete personal data that a company holds about you. We hold none. Every piece of data Web Audit+ produces is on your device, under your control, and you can view, export or delete it without asking anyone. If you believe we hold data about you despite everything above, contact us and we will show you that we do not, or fix it if we are wrong.

## 9. Children

Web Audit+ is a developer tool and is not directed at children under 13. It collects no data from anyone, of any age.

## 10. Changes to this policy

If the extension ever starts doing something this policy says it does not, this policy will change first, the effective date at the top will move, and the change will be described in the release notes of the version that introduces it. The history of this page is in the repository, so you can see exactly what changed and when.

## 11. Contact

Questions about this policy, or anything about how the extension handles data, are welcome as a public issue at [github.com/sherwinvishesh/Web-Audit-Plus/issues](https://github.com/sherwinvishesh/Web-Audit-Plus/issues). Public, because the answers belong to everyone who uses it.
