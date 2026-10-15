/**
 * Why each Agentic check matters, in one or two sentences, for the report's expanded rows. The
 * check's title says what is verified; this says what an agent loses when it fails.
 */
export const WHY: Readonly<Record<string, string>> = {
  A1: 'robots.txt is the first file every well-behaved crawler reads. A Disallow that covers an AI agent keeps the page out of that agent’s answers, citations and training data entirely.',
  A2: 'llms.txt is a short, curated map of the site written for language models. Agents that support it read it instead of guessing which pages matter.',
  A3: 'A sitemap is how crawlers find pages that are not linked prominently. A page missing from it may never be fetched at all.',
  A4: 'Structured data tells an agent what the page is (a product, an article, a person) without inferring it from layout, and is quoted directly in answers.',
  A5: 'Most agents fetch the raw HTML and never run JavaScript. Content that only appears after scripts run is invisible to them.',
  A6: 'Agents fetch pages on demand while a user waits for an answer, with tight timeouts. A slow first byte gets the page skipped or truncated.',
  A7: 'A noai or noimageai directive tells AI systems not to use the page. Left in by accident, it silently removes the site from AI answers.',
  A8: 'Agents and their users increasingly refuse or downrank plain HTTP. HSTS makes sure every later request stays on HTTPS.',
  B1: 'A markdown twin gives agents the page’s content without markup, navigation or scripts: fewer tokens, nothing to misparse. Every other implementation check reads it.',
  B2: 'Agents decide how to parse a response from its Content-Type. Anything other than text/markdown makes the twin look like an unknown file.',
  B3: 'An empty or partial twin is worse than none: agents trust it and answer from what is missing.',
  B4: 'A token count lets an agent budget its context window before downloading the body, and skip or chunk long pages up front.',
  B5: 'nosniff stops browsers and proxies from reinterpreting the markdown as HTML, which keeps the twin from becoming a script injection surface.',
  B6: 'Without noindex, search engines index the twin as a duplicate of the HTML page and split its ranking.',
  B7: 'One URL that answers in two formats must say so with Vary: Accept, or a CDN caches one format and serves it to everyone.',
  B8: 'The Link header is how an agent that fetched the HTML discovers the twin, without guessing the .md convention.',
  B9: 'Agents that ask for markdown in the Accept header should get it at the URL they requested, with no extra round trip.',
  B10: 'Most AI crawlers send Accept: */*. Recognising them by User-Agent is the only way to serve them markdown without a redirect.',
  B11: 'A 406 for a format the site cannot produce tells a client the truth, instead of handing it a body it did not ask for.',
  B12: 'A version header lets agents detect which markdown-serving convention the site follows, and what they can rely on.',
  B13: 'Serving markdown to agents must never change what people get. A browser request that receives markdown or a redirect is a broken page.',
  B14: 'A twin that drifted from the page feeds agents stale prices, dates and facts, and they repeat them with confidence.',
};
