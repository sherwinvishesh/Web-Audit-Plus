/**
 * Known AI crawlers and their robots.txt tokens, ported from OpenGEO's `shared/bots.js` (the
 * community-maintained list behind `opengeo test`'s A1).
 *
 * Two fields are different levers:
 *  - `uaPatterns`  matched against a request's User-Agent. Empty means robots.txt-only.
 *  - `robotsToken` the name written into a robots.txt `User-agent:` line. Google-Extended and
 *    Applebot-Extended are tokens only: opt-out signals with no crawler of their own.
 *
 * `kind` decides how A1 reads a block: `assistant` and `search` agents answer questions about the
 * site, so blocking one is a failure; blocking a `training` crawler reads as a deliberate opt-out.
 *
 * Vendor documentation, for when this list needs updating:
 *   OpenAI     https://platform.openai.com/docs/bots
 *   Anthropic  https://support.anthropic.com/en/articles/8896518
 *   Perplexity https://docs.perplexity.ai/guides/bots
 *   Google     https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers
 *   Apple      https://support.apple.com/en-us/119829
 *   Microsoft  https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0
 *   Common Crawl https://commoncrawl.org/ccbot
 *   Meta       https://developers.facebook.com/docs/sharing/webmasters/web-crawlers
 *   Amazon     https://developer.amazon.com/amazonbot
 *   Mistral    https://docs.mistral.ai/robots
 *   DuckDuckGo https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot
 *   Ai2        https://allenai.org/crawler
 *   Huawei     https://aspiegel.com/petalbot
 */

export type BotKind = 'assistant' | 'search' | 'training';

export interface AiBot {
  name: string;
  vendor: string;
  /** Lower-case User-Agent substrings. Empty for robots.txt-only tokens. */
  uaPatterns: readonly string[];
  robotsToken: string;
  kind: BotKind;
  notes?: string;
}

export const AI_BOTS: readonly AiBot[] = [
  { name: 'GPTBot', vendor: 'OpenAI', uaPatterns: ['gptbot'], robotsToken: 'GPTBot', kind: 'training' },
  { name: 'OAI-SearchBot', vendor: 'OpenAI', uaPatterns: ['oai-searchbot'], robotsToken: 'OAI-SearchBot', kind: 'search' },
  { name: 'ChatGPT-User', vendor: 'OpenAI', uaPatterns: ['chatgpt-user'], robotsToken: 'ChatGPT-User', kind: 'assistant' },
  { name: 'ClaudeBot', vendor: 'Anthropic', uaPatterns: ['claudebot'], robotsToken: 'ClaudeBot', kind: 'training' },
  { name: 'Claude-User', vendor: 'Anthropic', uaPatterns: ['claude-user'], robotsToken: 'Claude-User', kind: 'assistant' },
  { name: 'Claude-SearchBot', vendor: 'Anthropic', uaPatterns: ['claude-searchbot'], robotsToken: 'Claude-SearchBot', kind: 'search' },
  { name: 'anthropic-ai', vendor: 'Anthropic', uaPatterns: ['anthropic-ai'], robotsToken: 'anthropic-ai', kind: 'training' },
  { name: 'PerplexityBot', vendor: 'Perplexity', uaPatterns: ['perplexitybot'], robotsToken: 'PerplexityBot', kind: 'search' },
  { name: 'Perplexity-User', vendor: 'Perplexity', uaPatterns: ['perplexity-user'], robotsToken: 'Perplexity-User', kind: 'assistant' },
  {
    name: 'Google-Extended',
    vendor: 'Google',
    uaPatterns: [],
    robotsToken: 'Google-Extended',
    kind: 'training',
    notes: 'robots.txt opt-out token for Gemini training only. It is not a crawler and never appears in a User-Agent.',
  },
  {
    name: 'Applebot-Extended',
    vendor: 'Apple',
    uaPatterns: [],
    robotsToken: 'Applebot-Extended',
    kind: 'training',
    notes: 'robots.txt opt-out token for Apple Intelligence training. Not a crawler; Applebot itself is the crawler.',
  },
  { name: 'Applebot', vendor: 'Apple', uaPatterns: ['applebot'], robotsToken: 'Applebot', kind: 'search' },
  { name: 'Bingbot', vendor: 'Microsoft', uaPatterns: ['bingbot'], robotsToken: 'bingbot', kind: 'search' },
  { name: 'CCBot', vendor: 'Common Crawl', uaPatterns: ['ccbot'], robotsToken: 'CCBot', kind: 'training' },
  { name: 'Bytespider', vendor: 'ByteDance', uaPatterns: ['bytespider'], robotsToken: 'Bytespider', kind: 'training' },
  { name: 'meta-externalagent', vendor: 'Meta', uaPatterns: ['meta-externalagent'], robotsToken: 'meta-externalagent', kind: 'training' },
  { name: 'meta-externalfetcher', vendor: 'Meta', uaPatterns: ['meta-externalfetcher'], robotsToken: 'meta-externalfetcher', kind: 'assistant' },
  { name: 'Amazonbot', vendor: 'Amazon', uaPatterns: ['amazonbot'], robotsToken: 'Amazonbot', kind: 'search' },
  { name: 'cohere-ai', vendor: 'Cohere', uaPatterns: ['cohere-ai', 'cohere-training-data-crawler'], robotsToken: 'cohere-ai', kind: 'training' },
  { name: 'MistralAI-User', vendor: 'Mistral', uaPatterns: ['mistralai-user'], robotsToken: 'MistralAI-User', kind: 'assistant' },
  { name: 'DuckAssistBot', vendor: 'DuckDuckGo', uaPatterns: ['duckassistbot'], robotsToken: 'DuckAssistBot', kind: 'assistant' },
  { name: 'YouBot', vendor: 'You.com', uaPatterns: ['youbot'], robotsToken: 'YouBot', kind: 'search' },
  { name: 'Diffbot', vendor: 'Diffbot', uaPatterns: ['diffbot'], robotsToken: 'Diffbot', kind: 'training' },
  { name: 'Ai2Bot', vendor: 'Allen Institute for AI', uaPatterns: ['ai2bot'], robotsToken: 'Ai2Bot', kind: 'training' },
  { name: 'FirecrawlAgent', vendor: 'Firecrawl', uaPatterns: ['firecrawlagent', 'firecrawl'], robotsToken: 'FirecrawlAgent', kind: 'assistant' },
  { name: 'PetalBot', vendor: 'Huawei', uaPatterns: ['petalbot'], robotsToken: 'PetalBot', kind: 'search' },
  { name: 'ImagesiftBot', vendor: 'ImageSift', uaPatterns: ['imagesiftbot'], robotsToken: 'ImagesiftBot', kind: 'training' },
  { name: 'Timpibot', vendor: 'Timpi', uaPatterns: ['timpibot'], robotsToken: 'Timpibot', kind: 'training' },
];

/** Identify an AI bot from a User-Agent string. Unrecognized means an ordinary visitor. */
export function identifyBot(userAgent: string | undefined): AiBot | undefined {
  if (!userAgent) return undefined;
  const ua = userAgent.toLowerCase();
  return AI_BOTS.find((bot) => bot.uaPatterns.some((pattern) => ua.includes(pattern)));
}
