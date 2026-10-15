<!-- Thanks. One change per pull request keeps review quick. See CONTRIBUTING.md. -->

## What this changes

<!-- One or two sentences. Link the issue it closes: "Closes #12". -->

## Why

<!-- The problem it solves, or the behaviour it corrects. For an Agentic check, say whether this matches opengeo upstream. -->

## How I tested it

<!-- Commands you ran and what you saw. Screenshots for anything visual (both themes, if the report changed). -->

- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run test:e2e` (or: I could not run it locally because ...)
- [ ] Loaded the built extension in Chrome and tried it on a real page

## Checklist

- [ ] No request leaves the browser except to the audited site, and no telemetry was added
- [ ] No new permission in `wxt.config.ts` (or: justified in the README table and in this description)
- [ ] Docs kept in step: `docs/CHECKS.md`, `docs/ENGINE.md`, `docs/TESTING.md`, README, and the website page plus its markdown twin where relevant
- [ ] New or changed behaviour has a test
