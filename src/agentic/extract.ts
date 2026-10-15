import { documentBaseUrl, parseDocument, tableRows } from './dom';
import { countWords } from './tokens';
import type { Evidence, ProbeResponse } from './types';

/**
 * HTML -> Markdown extraction, ported from OpenGEO's `generate/extract.js`.
 *
 * A5 (is the content in the raw HTML?), B3 (is the twin a real copy?) and B14 (has the twin drifted?)
 * all compare against this. It reads the HTML as served, without running scripts, which is exactly
 * what an AI crawler sees: main-content selection, noise stripping, absolute link resolution and a
 * word count. Parsing goes through `dom.ts`, so it behaves the same in Node, a service worker and an
 * extension page.
 */

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/** Below this word count, a page's raw HTML is not meaningfully extractable without running JS. */
export const SSR_MIN_WORDS = 60;

/** Removed everywhere: never carries page content, always costs tokens. */
const ALWAYS_STRIP = [
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'iframe',
  'object',
  'embed',
  'canvas',
  'input',
  'select',
  'textarea',
  'button',
  '[aria-hidden="true"]',
  '[hidden]',
  '.sr-only',
  '.visually-hidden',
  '.screen-reader-text',
  'nextjs-portal',
].join(',');

/**
 * Removed only when extraction had to fall back to <body>, i.e. the page gave no semantic main
 * region. Inside a real <main>/<article> these tags usually hold real content (an article's own
 * header), so stripping them unconditionally would delete the title of every well-marked-up page.
 */
const CHROME_STRIP = [
  'nav',
  'header',
  'footer',
  'aside',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[role="complementary"]',
].join(',');

/** Tried in order. The first match wins. */
const MAIN_SELECTORS = [
  'main',
  '[role="main"]',
  'article',
  '#main-content',
  '#content',
  '#main',
  '.post-content',
  '.entry-content',
  '.prose',
  '.content',
];

export interface ExtractedPage {
  title: string;
  description?: string;
  /** Absolute URL from `<link rel="canonical">`, when the page declares one. */
  canonical?: string;
  /** The modification date the page declares about itself (a W3C datetime), from meta tags or JSON-LD. */
  lastModified?: string;
  markdown: string;
  wordCount: number;
  /** Which selector supplied the content, so a bad extraction can be debugged. */
  contentRoot: string;
  warnings: string[];
  /** JSON-LD blocks that parsed. */
  jsonLd: unknown[];
}

export interface ExtractOptions {
  /** Absolute URL of the page, used to resolve relative links and images. */
  url: string;
  /** Below this, the page gets an explicit low-content warning. */
  minWords?: number;
}

export function extractPage(html: string, options: ExtractOptions): ExtractedPage {
  const doc = parseDocument(html);
  const warnings: string[] = [];
  const jsonLd = readJsonLd(doc);
  for (const error of jsonLd.errors) {
    warnings.push(`A JSON-LD block on this page does not parse and was ignored: ${error}`);
  }

  const { root, selector } = pickContentRoot(doc);
  for (const node of Array.from(root.querySelectorAll(ALWAYS_STRIP))) node.remove();
  if (selector === 'body') {
    for (const node of Array.from(root.querySelectorAll(CHROME_STRIP))) node.remove();
    warnings.push(
      'No <main>, <article> or [role="main"] found - fell back to <body> and stripped nav/header/footer. Adding a <main> landmark gives a cleaner twin.',
    );
  }
  // A <form> is usually a search box or a signup and goes, but ASP.NET WebForms and some CMSs wrap
  // the whole page in one. A form that holds most of the remaining text is the page; its controls
  // are already gone.
  const rootText = textLength(root);
  for (const form of Array.from(root.querySelectorAll('form'))) {
    if (textLength(form) <= rootText / 2) form.remove();
  }

  const baseUrl = documentBaseUrl(doc, options.url);
  const title = pickTitle(doc, root);
  const description = pickDescription(doc);
  const canonical = pickCanonical(doc, baseUrl);
  const lastModified = pickLastModified(doc, jsonLd.blocks);
  const blocks = renderChildren(root, { baseUrl });
  let markdown = blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();

  // The <h1> normally survives inside the content root; only prepend a heading when it didn't, so a
  // well-marked-up page never ends up with its title twice.
  const titleFromRoot = Boolean(root.querySelector('h1')?.textContent?.trim());
  if (title && !titleFromRoot && !/^#\s/m.test(markdown.split('\n')[0] ?? '')) {
    markdown = `# ${title}\n\n${markdown}`.trim();
  }

  const wordCount = countWords(markdown);
  const minWords = options.minWords ?? 40;
  if (wordCount < minWords) {
    warnings.push(
      `Only ${wordCount} words extracted (threshold ${minWords}). If this page renders its content with JavaScript, a crawler that does not run scripts cannot see it.`,
    );
  }

  return {
    title,
    ...(description ? { description } : {}),
    ...(canonical ? { canonical } : {}),
    ...(lastModified ? { lastModified } : {}),
    markdown,
    wordCount,
    contentRoot: selector,
    warnings,
    jsonLd: jsonLd.blocks,
  };
}

/**
 * A5, B3 and B14 all read the live page's extraction with the same options. One extraction per
 * response serves all three. Keyed on the response object and checked against the body and URL it
 * was made from, because evidence is a plain object and nothing stops a caller swapping either.
 */
const extractions = new WeakMap<ProbeResponse, { body: string; url: string; extracted: ExtractedPage }>();

/** Only called once the caller has checked that there is a body. */
export function liveExtract(e: Evidence): ExtractedPage {
  const url = e.target;
  const cached = extractions.get(e.html);
  if (cached && cached.body === e.html.body && cached.url === url) return cached.extracted;
  const extracted = extractPage(e.html.body, { url, minWords: SSR_MIN_WORDS });
  extractions.set(e.html, { body: e.html.body, url, extracted });
  return extracted;
}

/**
 * A4 and A7 read the live page's markup as it arrived, without changing it, so they share one
 * parse. Extraction cannot share it: it strips the document as it goes.
 */
const rawDocuments = new WeakMap<ProbeResponse, { body: string; doc: Document }>();

export function rawDocument(e: Evidence): Document {
  const cached = rawDocuments.get(e.html);
  if (cached && cached.body === e.html.body) return cached.doc;
  const doc = parseDocument(e.html.body);
  rawDocuments.set(e.html, { body: e.html.body, doc });
  return doc;
}

function pickContentRoot(doc: Document): { root: Element; selector: string } {
  for (const selector of MAIN_SELECTORS) {
    const found = selector === 'article' ? gatherArticles(doc) : doc.querySelector(selector);
    // A short-but-real page is still a page: only skip a landmark that is essentially empty, which
    // is what an unrendered SPA shell (`<main></main>`) looks like.
    if (found && textLength(found) >= 40) return { root: found, selector };
  }
  return { root: doc.body ?? doc.documentElement, selector: 'body' };
}

/**
 * A listing page with no <main> is often a run of sibling <article>s, and taking only the first
 * would publish a twin of one post. The top-level ones are copied into a detached container; nested
 * articles come along with their parent.
 */
function gatherArticles(doc: Document): Element | null {
  const topLevel = Array.from(doc.querySelectorAll('article')).filter((article) => !article.parentElement?.closest('article'));
  if (topLevel.length <= 1) return topLevel[0] ?? null;
  const container = doc.createElement('div');
  for (const article of topLevel) container.append(article.cloneNode(true));
  return container;
}

function textLength(el: Element): number {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim().length;
}

function pickTitle(doc: Document, root: Element): string {
  const h1 = root.querySelector('h1');
  if (h1?.textContent?.trim()) return clean(h1.textContent);
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
  if (ogTitle?.trim()) return clean(ogTitle);
  const docTitle = doc.querySelector('title')?.textContent;
  if (docTitle?.trim()) return clean(docTitle);
  return 'Untitled';
}

function pickDescription(doc: Document): string | undefined {
  const meta =
    doc.querySelector('meta[name="description"]')?.getAttribute('content') ??
    doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
  const value = meta?.trim();
  return value ? clean(value) : undefined;
}

function pickCanonical(doc: Document, baseUrl: string): string | undefined {
  const href = doc.querySelector('link[rel~="canonical" i][href]')?.getAttribute('href')?.trim();
  if (!href) return undefined;
  try {
    const url = new URL(href, baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

const MODIFIED_META = [
  'meta[property="article:modified_time"]',
  'meta[property="og:updated_time"]',
  'meta[itemprop="dateModified"]',
  'meta[name="last-modified"]',
];

/** The W3C datetime profile sitemaps.org asks <lastmod> to use. */
const W3C_DATETIME = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/;

/** Only a date the page states about itself. */
function pickLastModified(doc: Document, jsonLd: unknown[]): string | undefined {
  for (const selector of MODIFIED_META) {
    const value = doc.querySelector(selector)?.getAttribute('content')?.trim();
    if (isW3cDate(value)) return value;
  }
  const queue: unknown[] = [...jsonLd];
  // Bounded, since a JSON-LD block is page input and can be any shape.
  for (let seen = 0; queue.length > 0 && seen < 200; seen += 1) {
    const node = queue.shift();
    if (Array.isArray(node)) {
      queue.push(...(node as unknown[]));
      continue;
    }
    if (!node || typeof node !== 'object') continue;
    const record = node as Record<string, unknown>;
    const value = typeof record.dateModified === 'string' ? record.dateModified.trim() : undefined;
    if (isW3cDate(value)) return value;
    if (record['@graph']) queue.push(record['@graph']);
  }
  return undefined;
}

function isW3cDate(value: string | undefined): value is string {
  return value !== undefined && W3C_DATETIME.test(value) && !Number.isNaN(Date.parse(value));
}

export interface JsonLdScan {
  /** Blocks that actually parsed. A broken block is reported, never passed on as data. */
  blocks: unknown[];
  errors: string[];
}

export function readJsonLd(doc: Document): JsonLdScan {
  const blocks: unknown[] = [];
  const errors: string[] = [];
  for (const node of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    const raw = node.textContent?.trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw) as unknown);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { blocks, errors };
}

interface RenderContext {
  baseUrl: string;
  /** Rendering inside a table cell, where a nested table must be flattened. */
  inCell?: boolean;
}

/** Render an element's children into a list of block-level markdown chunks. */
function renderChildren(parent: Element, ctx: RenderContext): string[] {
  const blocks: string[] = [];
  let inlineBuffer = '';

  const flush = (): void => {
    const text = collapse(inlineBuffer);
    if (text) blocks.push(text);
    inlineBuffer = '';
  };

  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === TEXT_NODE) {
      inlineBuffer += escapeText(child.textContent ?? '');
      continue;
    }
    if (child.nodeType !== ELEMENT_NODE) continue;
    const el = child as Element;
    if (isInline(el.tagName.toLowerCase()) && !isBlockLink(el)) {
      inlineBuffer += renderInline(el, ctx);
      continue;
    }
    flush();
    blocks.push(...renderBlock(el, ctx));
  }
  flush();
  return blocks.filter((b) => b.trim().length > 0);
}

const INLINE_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'bdi',
  'bdo',
  'br',
  'cite',
  'code',
  'data',
  'del',
  'dfn',
  'em',
  'i',
  'img',
  'ins',
  'kbd',
  'mark',
  'q',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'u',
  'var',
  'wbr',
  'label',
]);

function isInline(tag: string): boolean {
  return INLINE_TAGS.has(tag);
}

const BLOCK_DESCENDANTS = [
  'address',
  'article',
  'aside',
  'blockquote',
  'dd',
  'div',
  'dl',
  'dt',
  'figure',
  'figcaption',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'ul',
].join(',');

/** An <a> wrapped around a whole card. Rendered inline, its heading and paragraphs would collapse. */
function isBlockLink(el: Element): boolean {
  return el.tagName.toLowerCase() === 'a' && el.querySelector(BLOCK_DESCENDANTS) !== null;
}

/**
 * Render a card link as its own blocks and hang the destination on the first single-line heading.
 * With no heading to carry it, the destination follows as an autolink so it is not lost.
 */
function renderBlockLink(el: Element, ctx: RenderContext): string[] {
  const blocks = renderChildren(el, ctx);
  const href = absolute(el.getAttribute('href'), ctx.baseUrl);
  if (!href || href.startsWith('javascript:') || blocks.length === 0) return blocks;
  const headingAt = blocks.findIndex((block) => /^#{1,6} [^\n]+$/.test(block));
  if (headingAt >= 0) {
    const heading = blocks[headingAt] ?? '';
    blocks[headingAt] = heading.replace(/^(#{1,6} )(.*)$/, (_match, marker: string, text: string) => `${marker}[${text}](${href})`);
    return blocks;
  }
  return [...blocks, `<${href}>`];
}

function renderBlock(el: Element, ctx: RenderContext): string[] {
  const tag = el.tagName.toLowerCase();

  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const level = Number(tag[1]);
      const text = collapse(renderInlineChildren(el, ctx));
      return text ? [`${'#'.repeat(level)} ${text}`] : [];
    }
    case 'p':
    case 'address':
    case 'figcaption':
    case 'summary': {
      const text = collapse(renderInlineChildren(el, ctx));
      return text ? [text] : [];
    }
    case 'br':
      return [];
    case 'hr':
      return ['---'];
    case 'pre':
      return [renderPre(el)];
    case 'blockquote': {
      const inner = renderChildren(el, ctx).join('\n\n');
      if (!inner.trim()) return [];
      return [
        inner
          .split('\n')
          .map((line) => (line ? `> ${line}` : '>'))
          .join('\n'),
      ];
    }
    case 'ul':
    case 'ol':
      return [renderList(el, ctx, '')];
    case 'dl':
      return [renderDefinitionList(el, ctx)];
    case 'table':
      return [renderTable(el, ctx)];
    case 'li':
      // A stray <li> outside a list; render as a bullet rather than dropping it.
      return [`- ${collapse(renderInlineChildren(el, ctx))}`];
    case 'a':
      return renderBlockLink(el, ctx);
    default:
      return renderChildren(el, ctx);
  }
}

function renderPre(el: Element): string {
  const code = el.querySelector('code');
  const source = code ?? el;
  const language = detectLanguage(source) ?? detectLanguage(el) ?? '';
  const text = (source.textContent ?? '').replace(/\n+$/, '');
  const fence = text.includes('```') ? '````' : '```';
  return `${fence}${language}\n${text}\n${fence}`;
}

function detectLanguage(el: Element): string | undefined {
  const className = el.getAttribute('class') ?? '';
  const match = /(?:^|\s)(?:language|lang)-([a-z0-9+#-]+)/i.exec(className);
  return match?.[1]?.toLowerCase();
}

/**
 * @param indent Where this list's markers start. CommonMark nests a block under an item only when
 *   it starts past the item's marker, which is three columns for "1. " and two for "- ".
 */
function renderList(el: Element, ctx: RenderContext, indent: string): string {
  const ordered = el.tagName.toLowerCase() === 'ol';
  const startAttr = Number(el.getAttribute('start') ?? '1');
  const start = Number.isFinite(startAttr) ? startAttr : 1;
  const lines: string[] = [];
  let index = start;

  for (const child of Array.from(el.children)) {
    if (child.tagName.toLowerCase() !== 'li') continue;
    const marker = ordered ? `${index}. ` : '- ';
    const childIndent = indent + ' '.repeat(marker.length);
    index += 1;

    const nested: string[] = [];
    const inlineParts: string[] = [];
    for (const node of Array.from(child.childNodes)) {
      if (node.nodeType === TEXT_NODE) {
        inlineParts.push(escapeText(node.textContent ?? ''));
        continue;
      }
      if (node.nodeType !== ELEMENT_NODE) continue;
      const sub = node as Element;
      const subTag = sub.tagName.toLowerCase();
      if (subTag === 'ul' || subTag === 'ol') {
        nested.push(renderList(sub, ctx, childIndent));
      } else if (isInline(subTag) && !isBlockLink(sub)) {
        inlineParts.push(renderInline(sub, ctx));
      } else {
        const rendered = renderBlock(sub, ctx).join('\n\n');
        if (rendered) nested.push(indentBlock(rendered, childIndent));
      }
    }

    const head = collapse(inlineParts.join(''));
    lines.push(`${indent}${marker}${head}`.trimEnd());
    for (const block of nested) if (block.trim()) lines.push(block);
  }
  return lines.join('\n');
}

function indentBlock(text: string, indent: string): string {
  return text
    .split('\n')
    .map((line) => (line ? `${indent}${line}` : line))
    .join('\n');
}

function renderDefinitionList(el: Element, ctx: RenderContext): string {
  const lines: string[] = [];
  for (const child of Array.from(el.children)) {
    const tag = child.tagName.toLowerCase();
    const text = collapse(renderInlineChildren(child, ctx));
    if (!text) continue;
    if (tag === 'dt') lines.push(`**${text}**`);
    else if (tag === 'dd') lines.push(`: ${text}`);
  }
  return lines.join('\n');
}

function renderTable(el: Element, ctx: RenderContext): string {
  // A GFM cell cannot hold a table, so one nested inside a cell is written as lines of
  // comma-separated values, which the outer cell then joins with <br>.
  if (ctx.inCell) {
    return ownRows(el)
      .map((tr) =>
        tr
          .map((cell) => collapse(renderInlineChildren(cell, ctx)))
          .filter(Boolean)
          .join(', '),
      )
      .filter(Boolean)
      .join('\n');
  }
  const cellCtx: RenderContext = { ...ctx, inCell: true };
  const rows: string[][] = [];
  for (const tr of ownRows(el)) {
    // A GFM row is one line, so a line break inside a cell (a <br>, a list) has to stay HTML.
    const cells = tr.map((cell) =>
      collapse(renderInlineChildren(cell, cellCtx))
        .replace(/\|/g, '\\|')
        .replace(/\n/g, '<br>'),
    );
    if (cells.length > 0) rows.push(cells);
  }
  if (rows.length === 0) return '';

  // Asked of this table's own rows: a <th> in a table nested inside a cell says nothing about this one.
  const hasHeader = tableRows(el).some(
    (tr) =>
      tr.parentElement?.tagName.toLowerCase() === 'thead' ||
      Array.from(tr.children).some((cell) => cell.tagName.toLowerCase() === 'th'),
  );
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (row: string[]): string => {
    const filled = [...row];
    while (filled.length < width) filled.push('');
    return `| ${filled.join(' | ')} |`;
  };

  const header = hasHeader ? (rows[0] ?? []) : Array.from({ length: width }, () => '');
  const body = hasHeader ? rows.slice(1) : rows;
  const separator = `| ${Array.from({ length: width }, () => '---').join(' | ')} |`;
  return [pad(header), separator, ...body.map(pad)].join('\n');
}

/** The cells of a table's own rows, never a nested table's. */
function ownRows(el: Element): Element[][] {
  return tableRows(el).map((tr) => Array.from(tr.children).filter((cell) => ['td', 'th'].includes(cell.tagName.toLowerCase())));
}

function renderInlineChildren(el: Element, ctx: RenderContext): string {
  let out = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === TEXT_NODE) out += escapeText(node.textContent ?? '');
    else if (node.nodeType === ELEMENT_NODE) {
      const child = node as Element;
      out += isInline(child.tagName.toLowerCase()) ? renderInline(child, ctx) : renderBlock(child, ctx).join(' ');
    }
  }
  return out;
}

function renderInline(el: Element, ctx: RenderContext): string {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case 'br':
      return '\n';
    case 'wbr':
      return '';
    case 'img': {
      // An attribute is page text like any other, and unescaped it could close the image early.
      const alt = escapeText(clean(el.getAttribute('alt') ?? ''));
      const src = absolute(el.getAttribute('src'), ctx.baseUrl);
      if (!src) return alt;
      return `![${alt}](${src})`;
    }
    case 'a': {
      const inner = collapse(renderInlineChildren(el, ctx));
      const href = absolute(el.getAttribute('href'), ctx.baseUrl);
      if (!href || !inner) return inner;
      if (href.startsWith('javascript:')) return inner;
      return `[${inner}](${href})`;
    }
    case 'code': {
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!text) return '';
      const fence = text.includes('`') ? '``' : '`';
      const padding = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
      return `${fence}${padding}${text}${padding}${fence}`;
    }
    case 'strong':
    case 'b': {
      const text = collapse(renderInlineChildren(el, ctx));
      return text ? `**${text}**` : '';
    }
    case 'em':
    case 'i':
    case 'cite':
    case 'dfn':
    case 'var': {
      const text = collapse(renderInlineChildren(el, ctx));
      return text ? `*${text}*` : '';
    }
    case 'del':
    case 's': {
      const text = collapse(renderInlineChildren(el, ctx));
      return text ? `~~${text}~~` : '';
    }
    default:
      return renderInlineChildren(el, ctx);
  }
}

function absolute(href: string | null, baseUrl: string): string | undefined {
  if (!href) return undefined;
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('#')) return undefined;
  try {
    // The URL serialiser encodes spaces and angle brackets but not parentheses, and a `)` would end
    // the link destination early and let the rest of the href read as markdown.
    return new URL(trimmed, baseUrl).toString().replace(/\(/g, '%28').replace(/\)/g, '%29');
  } catch {
    return undefined;
  }
}

/**
 * Escape only what would change the meaning of the rendered markdown. Over-escaping makes the twin
 * harder to read and inflates the token count for no benefit.
 */
function escapeText(text: string): string {
  return (
    text
      .replace(/([\\`*_[\]])/g, '\\$1')
      // Only a `<` that could open a tag, a comment or an autolink. "2 < 3" means what it says.
      .replace(/<(?=[A-Za-z/!?])/g, '\\<')
      .replace(/^(\s*)([-+#>])/gm, '$1\\$2')
  );
}

function collapse(text: string): string {
  return text
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
