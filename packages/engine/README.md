# @webauditplus/engine

The audit engine behind Web Audit+. It loads a page over the Chrome DevTools Protocol, gathers
artifacts (trace, network records, DOM, accessibility tree), runs the audits and scores
Performance, Accessibility, Best Practices and SEO.

It is not published; the extension bundles it from this workspace. How it runs inside a service
worker, and what differs from a headless run, is in [docs/ENGINE.md](../../docs/ENGINE.md).

| Path | Contents |
| --- | --- |
| `core/` | Config, gatherers, audits, computed artifacts, scoring and the runner |
| `shared/` | Statistics, utilities and en-US messages |
| `logger/` | Status events the extension shows as progress |
| `stack-packs/` | Framework-specific advice |
| `third-party/` | axe-core's language list and an AI agent catalog validator |
| `types/` | TypeScript declarations for the result and artifacts |

Apache-2.0. Derived from software by Google LLC; see [NOTICE](NOTICE).
