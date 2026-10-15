import { parseHTML } from 'linkedom';

/**
 * Parsing a site's HTML without a browser DOM.
 *
 * The engine runs in Node (tests), in the MV3 service worker (which has no `DOMParser`) and in
 * extension pages, so it parses with linkedom everywhere and gets the same answer everywhere.
 * linkedom is a fast, lenient DOM, not a spec HTML5 tree builder; the shims below close the gaps
 * that change what the checks see, each verified against linkedom 0.18:
 *
 *  - A document with no `<html>` puts its nodes at the top level, and one with `<html>` but no
 *    `<body>` leaves content outside `document.body`. Both are rebuilt into html/head/body, with
 *    leading head-type elements in the head, as an HTML5 parser would.
 *  - `<template>` content is parsed as ordinary children, so it is removed (a browser keeps it out
 *    of the document's text).
 *  - `HTMLTableElement.rows` is missing; `tableRows()` provides it.
 *  - `baseURI` returns the raw `<base href>`; `documentBaseUrl()` resolves it.
 */

const HEAD_TAGS = new Set(['title', 'meta', 'link', 'base', 'style', 'script', 'noscript', 'template']);

export function parseDocument(html: string): Document {
  const hasHtmlTag = /<html[\s>]/i.test(html);
  const source = hasHtmlTag ? html : `<!DOCTYPE html><html><head></head><body>${html.replace(/^\s*<!doctype[^>]*>/i, '')}</body></html>`;
  const { document } = parseHTML(source);
  normalizeStructure(document, !hasHtmlTag);
  for (const template of Array.from(document.querySelectorAll('template'))) template.remove();
  return document;
}

function normalizeStructure(document: Document, wrapped: boolean): void {
  const root = document.documentElement;
  if (!root) return;
  let head = childByTag(root, 'head');
  if (!head) {
    head = document.createElement('head');
    root.insertBefore(head, root.firstChild);
  }
  let body = childByTag(root, 'body');
  if (!body) {
    body = document.createElement('body');
    root.appendChild(body);
  }
  // Content that ended up directly under <html>: before the body goes first (in order, ahead of the
  // body's own first child), after it goes last.
  const anchor = body.firstChild;
  let beforeBody = true;
  for (const node of Array.from(root.childNodes)) {
    if (node === head) continue;
    if (node === body) {
      beforeBody = false;
      continue;
    }
    if (node.nodeType === 3 && !(node.textContent ?? '').trim()) continue;
    if (beforeBody) body.insertBefore(node, anchor);
    else body.appendChild(node);
  }
  // A document without <html> was wrapped whole into the body: its leading head-type elements
  // (<title>, <meta>, ...) belong in the head, until the first piece of real content.
  if (wrapped) {
    for (const node of Array.from(body.childNodes)) {
      if (node.nodeType === 3 && !(node.textContent ?? '').trim()) continue;
      if (node.nodeType === 8) continue;
      if (node.nodeType !== 1 || !HEAD_TAGS.has((node as Element).tagName.toLowerCase())) break;
      head.appendChild(node);
    }
  }
}

function childByTag(parent: Element, tag: string): Element | undefined {
  return Array.from(parent.children).find((child) => child.tagName.toLowerCase() === tag);
}

/** `table.rows`: the table's own rows, thead first, then body rows, then tfoot, as the DOM spec orders them. */
export function tableRows(table: Element): Element[] {
  const sections = Array.from(table.children);
  const rowsOf = (section: Element): Element[] => Array.from(section.children).filter((child) => child.tagName.toLowerCase() === 'tr');
  const byTag = (tag: string): Element[] => sections.filter((child) => child.tagName.toLowerCase() === tag);
  const rows: Element[] = [];
  for (const thead of byTag('thead')) rows.push(...rowsOf(thead));
  for (const child of sections) {
    const tag = child.tagName.toLowerCase();
    if (tag === 'tr') rows.push(child);
    else if (tag === 'tbody') rows.push(...rowsOf(child));
  }
  for (const tfoot of byTag('tfoot')) rows.push(...rowsOf(tfoot));
  return rows;
}

/** The URL relative links on the page resolve against: `<base href>` resolved against the page URL. */
export function documentBaseUrl(document: Document, pageUrl: string): string {
  const href = document.querySelector('base[href]')?.getAttribute('href')?.trim();
  if (!href) return pageUrl;
  try {
    return new URL(href, pageUrl).toString();
  } catch {
    return pageUrl;
  }
}
