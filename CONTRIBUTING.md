# Contributing to Web Audit+

Thanks for looking under the hood. This page covers how to get a working build, what the checks
expect, and how to land a change. If anything here is wrong or missing, that is a bug too.

## Ground rules

- Be kind. The [code of conduct](CODE_OF_CONDUCT.md) applies everywhere in this project.
- Security problems go through [SECURITY.md](SECURITY.md), not the issue tracker.
- Open an issue before a large change, so the design can be discussed before the code exists.
  Small fixes can go straight to a pull request.
- Nothing may leave the user's browser. A change that adds a request to anything but the audited
  site, or any kind of telemetry, will not be merged. The
  [privacy policy](https://sherwinvishesh.github.io/Web-Audit-Plus/privacy/) is a contract.

## Setup

You need Node 22 and Google Chrome 125 or later.

```sh
git clone https://github.com/sherwinvishesh/Web-Audit-Plus.git
cd Web-Audit-Plus
npm install          # also runs `wxt prepare`
npm run dev          # starts Chrome with the extension loaded, reloads as you edit
```

`npm run build` writes the production extension to `output/chrome-mv3`, which you can load unpacked
from `chrome://extensions`. `npm run zip` packages it for the Chrome Web Store.

## Checks

Every pull request runs the same three gates as the **CI** badge on the README. Run them locally
before you push:

```sh
npm run typecheck    # strict TypeScript, no emit
npm run test         # Vitest: unit and integration suites, no browser needed
npm run test:e2e     # builds, then drives the extension in a real headless Chrome
```

`npm run test:watch` keeps Vitest running while you work. [docs/TESTING.md](docs/TESTING.md)
explains what each suite covers and lists the manual checks that no suite can replace.

There is no linter beyond TypeScript. The style is the one you see: small modules, named exports,
comments that explain *why*, and no new dependencies without a reason stated in the pull request.

## Where things live

```
src/agentic/     the Agentic engine: evidence gathering, the 22 checks, scoring
src/engine/      the audit engine inside the extension: CDP adapter, shims, normalization
src/shared/      run records, storage, the report model, fix prompts, compare, filters
src/extension/   entrypoints: background worker, side panel, report page
src/ui/          React components for the side panel, the report and the exports
packages/engine/ the audit engine itself (Apache-2.0, derived from code by Google LLC)
tests/           Vitest suites, fixture sites, the end-to-end harness
docs/            ENGINE.md, CHECKS.md, TESTING.md
website/         the GitHub Pages site, plain HTML with a markdown twin per page
```

## Kinds of change

### Fixing a bug

Add a failing test first when you can. Most of the code base is pure functions over plain data
(evidence in, results out), so a regression test is usually a fixture and an assertion. Then fix it,
and say in the pull request what was wrong and how you know it is fixed.

### Changing an Agentic check

The Agentic checks are a port of OpenGEO's `opengeo test`, with the same ids, weights, thresholds
and calibration, and the parity suites (`tests/parity-*.test.ts`) pin that. A change to a check's
behaviour must either match a change upstream or be argued on its own merits in the pull request.
Whatever you change, keep these in step:

1. the check in `src/agentic/checks/`,
2. its tests,
3. [docs/CHECKS.md](docs/CHECKS.md), which `tests/docs-sync.test.ts` verifies against the registry,
4. the check table on the website (`website/index.html`, `website/docs/index.html`) and the
   markdown twins next to them, which `tests/website` verifies.

### Proposing a new Agentic check

Use the **New Agentic check** issue template. A check needs an id, a weight, whether it is required
or recommended, a precise pass/partial/fail rule, the evidence it reads, and a fix prompt. Checks
must be deterministic: the same responses always produce the same verdict, and no language model
is involved anywhere.

### Changing the audit engine

`packages/engine` is derived from Apache-2.0 code by Google LLC and modified to run inside a
service worker. Keep the original copyright headers, keep the changes minimal and described in
[docs/ENGINE.md](docs/ENGINE.md), and remember that the build
plugin in `scripts/engine-bundle.ts` asserts each rewrite it makes. If your change moves one of
those spots, the build will tell you.

### Changing the website

`website/` has no build step. Every page has a markdown twin (`index.md`, `docs.md`,
`privacy.md`) and the tests check that the twin carries the page's words and every number on it, so
edit both. Bump `last_updated` in the twin's front matter and `<lastmod>` in `sitemap.xml`.

### Adding a permission

Please do not, unless there is no other way. Every permission is justified in the README's
permissions table and pinned by `tests/manifest.test.ts`. A new one needs a reason users will
accept when Chrome shows them the prompt.

## Pull requests

- One change per pull request. Keep refactors separate from behaviour changes.
- Fill in the pull request template. The "how I tested it" part matters most.
- Commit messages are short, in the imperative, and may carry a scope, for example
  `fix(agentic): B5 reads nosniff the way browsers do` or `docs: describe the release workflow`.
- The CI must be green. A pull request also builds the extension as a downloadable artifact, so
  reviewers can load exactly what you built.
- Commits are expected to be yours. Please do not add tooling trailers such as
  `Co-Authored-By` for assistants; mention the tools you used in the pull request description
  if you like.

## Releasing

Maintainers only. Bump `version` in `package.json`, update the version wherever the README shows
it, commit, and push a matching tag:

```sh
git tag v0.1.1
git push origin v0.1.1
```

The **Release** workflow checks that the tag matches `package.json`, runs the typecheck and the
tests, builds the store zip, verifies its manifest, and attaches the zip to a GitHub release. The
zip is then uploaded to the Chrome Web Store by hand.

## License

Web Audit+ is licensed under the [Apache License, Version 2.0](LICENSE). By contributing you agree
that your contributions are licensed under the same terms, as the license's section 5 says, and
that you have the right to submit them. The audit engine in `packages/engine` keeps its own
Apache-2.0 LICENSE and NOTICE; keep the original copyright headers on any file you touch there and
note the change in the file, as section 4(b) asks.
