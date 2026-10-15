# Security policy

Web Audit+ runs with the `debugger` permission and host access to every site, so a bug in it can
matter more than a bug in a typical extension. Reports are welcome and taken seriously.

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x (current `main` and the latest release) | Yes |
| Anything older | No, please update |

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Use GitHub's private vulnerability reporting instead:
**[Report a vulnerability](https://github.com/sherwinvishesh/Web-Audit-Plus/security/advisories/new)**.
It opens a private thread with the maintainer that nobody else can read.

Include what you can of:

- the version (from `chrome://extensions` or the release tag) and your Chrome version,
- the page or response that triggers it (a minimal fixture is ideal; the test suites under
  `tests/fixtures` show the shape),
- what happens and what you expected,
- whether it needs a hostile site, a hostile network, or only a normal page.

You will get an acknowledgement within 7 days, and a fix or a mitigation plan within 30 days for a
confirmed issue. Fixes ship as a GitHub release and, once the extension is listed, as a Chrome Web
Store update. You will be credited in the release notes unless you ask not to be.

## What counts

Anything that breaks the promises in the [privacy policy](https://sherwinvishesh.github.io/Web-Audit-Plus/privacy/)
or lets an audited site reach outside its sandbox, for example:

- a page, response header or body that runs script in the side panel, the report, or the HTML
  export (every site string is meant to render as text, and the export carries a no-script CSP),
- a way for an audited site to make the extension send requests to a third origin, read another
  tab, or keep the debugger attached after a run,
- a fix prompt that can be made to carry instructions outside its code span (prompt injection
  against the coding assistant the prompt is pasted into),
- saved runs leaking between profiles, or data leaving the browser at all,
- anything in the release pipeline that could ship code that is not in `main`.

The suites `tests/security-*.test.ts` describe the current threat model and are the quickest way to
see what is already covered.

## Out of scope

- The scores themselves being "wrong" for a site. That is a bug, not a vulnerability: please open an
  [issue](https://github.com/sherwinvishesh/Web-Audit-Plus/issues/new/choose).
- Chrome's own "started debugging this browser" bar. It is Chrome's notice, not something the
  extension can or should hide.
- Vulnerabilities in Chrome, in the audited site, or in third-party packages that the extension does
  not actually reach (please report those upstream; a note here is still welcome).
- Denial of service by pointing the extension at a very large or very slow site. Probes are capped
  at 8 MB and 15 seconds each, and a run can be cancelled at any time.
