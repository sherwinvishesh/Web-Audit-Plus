/**
 * The specific next step for each engine audit, in our words. The engine's own description says
 * what an audit checks and why; these say what to change in the source, in the order that usually
 * works. Audits not listed here fall back to the description alone.
 *
 * Markdown-lite: prose plus code spans. Nothing here comes from an audited site.
 */
export const REMEDIES: Readonly<Record<string, string>> = {
  // Performance: metrics
  'first-contentful-paint':
    'Get the first text or image on screen sooner: cut server response time, inline the critical CSS and load the rest with `media` or `preload`, `defer` scripts that are not needed for the first render, and preload the fonts the first view uses.',
  'largest-contentful-paint':
    'Make the largest element above the fold load first. If it is an image, put it in the HTML as an `<img>` with `fetchpriority="high"` (never `loading="lazy"`), serve it in AVIF or WebP at the displayed size, and preconnect to its origin. If it is text, remove render-blocking CSS and scripts and use `font-display: swap`.',
  'total-blocking-time':
    'Shorten long main-thread tasks during load: split large bundles by route, `defer` or lazy-load scripts that are not needed immediately, move heavy computation to a Web Worker, and remove or delay third-party scripts. Break unavoidable work into chunks under 50 ms.',
  'cumulative-layout-shift':
    'Reserve space for everything that loads late: `width` and `height` (or `aspect-ratio`) on images, videos and iframes, fixed-size slots for ads and embeds, and `font-display: optional` or metric-matched fallback fonts. Never insert content above existing content after load, except in response to a user action.',
  'speed-index':
    'Paint visible content progressively and early: server-render the above-the-fold content, inline critical CSS, defer non-critical scripts and styles, and avoid hiding the page until JavaScript runs.',

  // Performance: insights
  'cache-insight':
    'Serve static assets (scripts, styles, images, fonts) with a long `Cache-Control: max-age` (a year, plus `immutable` for fingerprinted file names), and fingerprint file names so a new deploy changes the URL.',
  'cls-culprits-insight':
    'Fix each listed shift at its cause: give images and embeds explicit dimensions, reserve space for injected content, avoid animating layout properties, and make web fonts swap without changing text metrics.',
  'document-latency-insight':
    'Make the HTML document arrive faster: avoid redirects for it, cache it at the edge or server, enable text compression (`br` or `gzip`), and cut server processing time.',
  'dom-size-insight':
    'Render fewer elements: virtualize long lists and tables, paginate or lazy-render content below the fold, and flatten wrapper elements that only exist for styling.',
  'duplicated-javascript-insight':
    'Ship each module once: deduplicate dependency versions (`npm dedupe`, aligned version ranges), and make sure shared code goes into a shared chunk rather than into every bundle.',
  'font-display-insight':
    'Add `font-display: swap` (or `optional`) to every `@font-face` rule so text renders immediately in a fallback font. For hosted font services, add the `display=swap` parameter to the stylesheet URL.',
  'forced-reflow-insight':
    'Stop reading layout (`offsetWidth`, `getBoundingClientRect()`, `scrollTop` and similar) right after writing styles in the same task. Batch all reads before all writes, or move reads into `requestAnimationFrame`.',
  'image-delivery-insight':
    'Serve each listed image in a modern format (AVIF or WebP), sized to its displayed dimensions with `srcset` and `sizes`, and compressed. Use the framework or CDN image pipeline if there is one.',
  'inp-breakdown-insight':
    'Make interactions respond faster: keep event handlers short, yield to the main thread (`await scheduler.yield()` or `setTimeout`) before non-urgent work, and avoid large re-renders on input.',
  'lcp-breakdown-insight':
    'Attack the largest LCP subpart listed: time to first byte means a slow server or redirects; load delay means the resource is discovered late; load duration means it is too large; render delay means scripts or styles block it.',
  'lcp-discovery-insight':
    'Make the LCP image discoverable from the HTML: use a real `<img>` with a `src` (not a CSS background or a JavaScript-inserted element), remove `loading="lazy"` from it, and add `fetchpriority="high"`.',
  'legacy-javascript-insight':
    'Stop shipping polyfills and transforms modern browsers do not need: target Baseline browsers in the build (`browserslist`, `build.target`), and drop polyfills for features every supported browser has.',
  'modern-http-insight':
    'Serve the page and its assets over HTTP/2 or HTTP/3. This is a server or CDN setting, not code: enable it on the host or put a CDN in front.',
  'network-dependency-tree-insight':
    'Shorten the critical request chains: inline or preload what the first render needs, `preconnect` to required origins, and avoid resources that are only discovered after another resource loads.',
  'render-blocking-insight':
    'Unblock the first render: inline the critical CSS and load the rest asynchronously, add `defer` or `async` to scripts in the `<head>`, and move non-critical third-party tags after load.',
  'third-parties-insight':
    'Reduce third-party cost: remove tags nobody uses, load the rest after the page is interactive (or on interaction), and self-host scripts that can be self-hosted.',
  'viewport-insight':
    'Add `<meta name="viewport" content="width=device-width, initial-scale=1">` so mobile browsers do not wait for a double-tap delay or render a desktop-width page.',

  // Performance: diagnostics
  'unminified-css': 'Minify CSS in the production build (most bundlers do this by default; check that the production mode is actually used).',
  'unminified-javascript': 'Minify JavaScript in the production build (`terser`, `esbuild` or the bundler’s production mode).',
  'unused-css-rules':
    'Remove CSS that this page never uses: split styles per route or component, purge unused utility classes, and load page-specific CSS only where it is needed.',
  'unused-javascript':
    'Ship less JavaScript to this page: split bundles per route, lazy-load components that are not visible at first, and remove unused dependencies.',
  'total-byte-weight': 'Cut the page’s total download: compress and resize images, split JavaScript, remove unused dependencies, and lazy-load below-the-fold media.',
  'bootup-time':
    'Spend less time parsing and running JavaScript: ship less of it, defer what is not needed for the first view, and replace heavy dependencies with lighter ones.',
  'mainthread-work-breakdown':
    'Reduce main-thread work in the largest categories listed: less JavaScript to evaluate, simpler CSS selectors and fewer elements for style and layout, and fewer forced reflows.',
  'long-tasks': 'Break each long task into chunks under 50 ms, yielding to the main thread between them, and defer work that is not needed during load.',
  'non-composited-animations':
    'Animate only `transform` and `opacity`, which the compositor handles without layout or paint. Replace animations of `top`, `left`, `width`, `height`, `margin` or colors with transform-based equivalents.',
  'unsized-images': 'Give every listed image explicit `width` and `height` attributes (or a CSS `aspect-ratio`) so the browser reserves its space before it loads.',
  'bf-cache':
    'Make the page eligible for the back/forward cache: remove `unload` handlers (use `pagehide`), avoid `Cache-Control: no-store` on the document unless it is truly private, and close open connections (`WebSocket`, `BroadcastChannel`) on `pagehide`.',
  redirects: 'Link straight to the final URL of the page, so the browser does not follow one or more redirects before it can start loading.',
  'server-response-time': 'Cut the time the server takes to produce the HTML: cache rendered pages, speed up slow queries, and serve from an edge location close to users.',

  // Accessibility
  accesskeys: 'Make every `accesskey` value unique on the page, or remove the attribute.',
  'aria-allowed-attr': 'Remove ARIA attributes the element’s role does not support, or change the role to one that supports them.',
  'aria-allowed-role': 'Remove `role` values that are not allowed on these elements, or use the native element that has that role.',
  'aria-command-name': 'Give each element with `role="button"`, `link` or `menuitem` an accessible name: visible text, `aria-label`, or `aria-labelledby`.',
  'aria-conditional-attr': 'Use ARIA attributes only in the way the role allows (for example, `aria-checked` on a checkbox role, not on a native checkbox).',
  'aria-deprecated-role': 'Replace deprecated ARIA roles with their current equivalents, or with the native element.',
  'aria-dialog-name': 'Give each `role="dialog"` or `alertdialog` an accessible name with `aria-label` or `aria-labelledby` pointing at its heading.',
  'aria-hidden-body': 'Remove `aria-hidden="true"` from `<body>`. It hides the whole page from assistive technology.',
  'aria-hidden-focus':
    'Content inside `aria-hidden="true"` must not be focusable: add `tabindex="-1"` to its focusable descendants, use the `inert` attribute instead, or stop hiding it.',
  'aria-input-field-name': 'Give each ARIA input field (`role="combobox"`, `textbox`, `searchbox` and similar) an accessible name with `aria-label` or `aria-labelledby`.',
  'aria-meter-name': 'Give each `role="meter"` an accessible name with `aria-label` or `aria-labelledby`.',
  'aria-progressbar-name': 'Give each `role="progressbar"` an accessible name with `aria-label` or `aria-labelledby`.',
  'aria-prohibited-attr': 'Remove ARIA attributes the role prohibits (commonly `aria-label` on a `div` or `span` with no role); give the element a role or put the text in the content.',
  'aria-required-attr': 'Add the attributes each role requires (for example, `aria-checked` for `role="checkbox"`, `aria-level` for `role="heading"`).',
  'aria-required-children': 'Give each listed role the children it requires (for example, `role="listitem"` inside `role="list"`), or use the native elements.',
  'aria-required-parent': 'Put each listed role inside the parent role it requires (for example, `role="option"` inside `role="listbox"`), or use the native elements.',
  'aria-roles': 'Replace invalid `role` values with valid ARIA roles, or remove them.',
  'aria-text': 'Remove focusable descendants from elements with `role="text"`, or drop the role.',
  'aria-toggle-field-name': 'Give each ARIA toggle (`role="checkbox"`, `switch`, `radio`, `menuitemcheckbox`) an accessible name with visible text or `aria-label`.',
  'aria-tooltip-name': 'Give each `role="tooltip"` text content or an `aria-label`.',
  'aria-treeitem-name': 'Give each `role="treeitem"` visible text or an `aria-label`.',
  'aria-valid-attr': 'Fix misspelled or invented `aria-*` attribute names; only attributes defined in the WAI-ARIA spec work.',
  'aria-valid-attr-value': 'Give each `aria-*` attribute a valid value (for example, `aria-expanded="true"`, and `aria-controls` pointing at an element id that exists).',
  'button-name': 'Give every listed button an accessible name: visible text, or `aria-label` for icon-only buttons. A decorative icon inside should have `aria-hidden="true"`.',
  bypass: 'Add a "skip to main content" link as the first focusable element, and wrap the main content in `<main>`, so keyboard users can skip repeated navigation.',
  'color-contrast':
    'Raise the contrast of each listed text to at least 4.5:1 against its background (3:1 for text 24px and up, or 18.66px bold). Darken the text or lighten the background in the design tokens rather than per element.',
  'definition-list': 'Make `<dl>` elements contain only `<dt>` and `<dd>` groups (optionally wrapped in `<div>`).',
  dlitem: 'Put `<dt>` and `<dd>` elements inside a `<dl>`.',
  'document-title': 'Add a `<title>` in the `<head>` that describes this page specifically (for example "Pricing · Product name"), generated per route.',
  'duplicate-id-aria': 'Make every `id` referenced by ARIA attributes or labels unique on the page.',
  'empty-heading': 'Give every heading text content, or remove headings that have none.',
  'form-field-multiple-labels': 'Give each form field exactly one `<label>`; merge extra labels into it or use `aria-describedby` for hints.',
  'frame-title': 'Add a `title` attribute to every `<iframe>` that says what it contains.',
  'heading-order': 'Use heading levels in order without skipping (an `<h2>` before any `<h3>`). Style headings with CSS rather than picking a level for its size.',
  'html-has-lang': 'Add a `lang` attribute to the `<html>` element with the page’s language (for example `lang="en"`), set in the root layout or document template.',
  'html-lang-valid': 'Set the `<html lang>` value to a valid BCP 47 language tag (for example `en`, `en-GB`, `fr`).',
  'html-xml-lang-mismatch': 'Make `lang` and `xml:lang` on `<html>` name the same language, or remove `xml:lang`.',
  'identical-links-same-purpose': 'Links with the same text should go to the same place; give links to different destinations distinct text.',
  'image-alt':
    'Add an `alt` attribute to every listed image: a short description of what the image conveys, or `alt=""` if it is purely decorative. In a CMS, make the alt field required.',
  'image-redundant-alt': 'Remove words like "image", "picture" or "photo" from `alt` text, and do not repeat the adjacent caption or link text.',
  'input-button-name': 'Give every `<input type="button">`, `submit` and `reset` a `value` that names its action.',
  'input-image-alt': 'Add `alt` text to every `<input type="image">` that names the action it performs.',
  label: 'Associate a visible `<label for>` with every listed form field (or wrap the field in its label). Use `aria-label` only when no visible label is possible; placeholders are not labels.',
  'landmark-one-main': 'Wrap the page’s primary content in a single `<main>` element.',
  'link-in-text-block': 'Make links inside text distinguishable without color: underline them, or give them 3:1 contrast with the surrounding text plus a non-color indicator on focus and hover.',
  'link-name': 'Give every listed link discernible text: visible text, `aria-label` for icon links, or `alt` text on an image inside it.',
  list: 'Make `<ul>` and `<ol>` contain only `<li>` elements (and `<script>` or `<template>`).',
  listitem: 'Put every `<li>` inside a `<ul>`, `<ol>` or `<menu>`.',
  'meta-refresh': 'Remove `<meta http-equiv="refresh">` with a delay; redirect on the server instead, or let users choose to move on.',
  'meta-viewport': 'Remove `user-scalable=no` and any `maximum-scale` below 5 from the viewport meta tag, so users can zoom.',
  'object-alt': 'Give each `<object>` a text alternative with `aria-label`, `aria-labelledby` or `title`.',
  'presentation-role-conflict': 'Remove `role="presentation"` or `role="none"` from elements that are focusable or carry global ARIA attributes, or make them non-focusable.',
  'select-name': 'Associate a `<label>` with every `<select>`.',
  'skip-link': 'Make the skip link target a focusable element that exists (for example `<main id="main" tabindex="-1">`).',
  'svg-img-alt': 'Give each `<svg role="img">` an accessible name with a `<title>` child, `aria-label` or `aria-labelledby`.',
  tabindex: 'Remove positive `tabindex` values; use `0` to make custom controls focusable and order the DOM to match the visual order.',
  'table-duplicate-name': 'Make a table’s `<caption>` and `summary` say different things, or keep only one.',
  'target-size': 'Make each listed touch target at least 24 by 24 CSS pixels, or space it so a 24px circle around it does not overlap another target.',
  'td-headers-attr': 'Point every `headers` attribute on a `<td>` at `<th>` ids in the same table.',
  'th-has-data-cells': 'Make every `<th>` describe at least one data cell, or turn it into a `<td>`.',
  'valid-lang': 'Use valid BCP 47 language tags in every `lang` attribute on the page.',
  'video-caption': 'Add a `<track kind="captions">` with a captions file to every `<video>` that has speech.',
  'autocomplete-valid': 'Use valid `autocomplete` tokens on form fields (for example `email`, `given-name`, `postal-code`), or remove invalid ones.',

  // Best practices
  'is-on-https': 'Serve the page and every resource it loads over HTTPS. Update hard-coded `http://` URLs, and redirect HTTP to HTTPS at the host.',
  'redirects-http': 'Redirect every HTTP request to the HTTPS URL with a 301, at the host or CDN.',
  'geolocation-on-start': 'Ask for location only after the user does something that needs it (a "Use my location" button), never on page load.',
  'notification-on-start': 'Ask for notification permission only after the user opts in to something that needs it, never on page load.',
  'paste-preventing-inputs': 'Remove code that blocks pasting into inputs (`onpaste` handlers that call `preventDefault()`), especially on password and email fields.',
  'image-aspect-ratio': 'Display each listed image at its natural aspect ratio: fix the `width` and `height`, or crop with `object-fit: cover` instead of stretching.',
  'image-size-responsive': 'Serve each listed image at least at its displayed size times the device pixel ratio, with `srcset` offering higher-resolution versions.',
  doctype: 'Start the HTML with `<!DOCTYPE html>`, so the page renders in standards mode.',
  charset: 'Declare the character encoding in the first 1024 bytes: `<meta charset="utf-8">` as the first element in `<head>`, or a `charset` in the `Content-Type` header.',
  deprecations: 'Replace each listed deprecated API with its modern replacement before browsers remove it; update the library that calls it if it is not your code.',
  'third-party-cookies': 'Stop relying on the listed third-party cookies: update or remove the scripts that set them, or move to partitioned (CHIPS) or first-party storage.',
  'errors-in-console': 'Fix each listed console error at its source: missing resources, failed requests, and uncaught exceptions. Do not silence them.',
  'valid-source-maps': 'Publish source maps for large first-party scripts (or fix the broken ones), so errors in production can be traced to source.',
  'inspector-issues': 'Resolve each issue Chrome logged (cookie attributes, mixed content, blocked resources), as listed.',
  'has-hsts': 'Send `Strict-Transport-Security: max-age=31536000; includeSubDomains` on HTTPS responses, from the host or CDN.',
  'csp-xss': 'Add a strict Content Security Policy: nonce- or hash-based `script-src` with `strict-dynamic`, `object-src \'none\'` and `base-uri \'none\'`.',
  'clickjacking-mitigation': 'Send `Content-Security-Policy: frame-ancestors \'self\'` (or `X-Frame-Options: DENY`) so other sites cannot frame the page.',
  'origin-isolation': 'Send `Cross-Origin-Opener-Policy: same-origin` to isolate the page’s browsing context from cross-origin windows.',
  'trusted-types-xss': 'Enforce Trusted Types with `Content-Security-Policy: require-trusted-types-for \'script\'` once DOM sinks are fed only through policies.',

  // SEO
  'is-crawlable': 'Remove `noindex` from the robots meta tag and the `X-Robots-Tag` header for pages that should appear in search results.',
  'meta-description': 'Add a `<meta name="description">` that summarizes this page in one or two sentences, generated per route.',
  'http-status-code': 'Return a 2xx status for this page; fix the route or the server error behind the failing status.',
  'link-text': 'Replace generic link text ("click here", "read more") with text that says where the link goes.',
  'crawlable-anchors': 'Give every link a real `href` with a resolvable URL; use `<button>` for actions that are not navigation.',
  'robots-txt': 'Fix the robots.txt syntax errors listed, so crawlers read the rules the way they are intended.',
  hreflang: 'Use valid language codes in `hreflang` links and make each one an absolute URL.',
  canonical: 'Point `<link rel="canonical">` at the absolute URL of this page’s preferred version, and only have one.',
};
