import { describe, expect, it } from 'vitest';
import { auditability, isPageContentType } from '../../src/shared/url-policy';

describe('auditability', () => {
  it('accepts http and https pages and drops the fragment', () => {
    expect(auditability('https://example.com/docs#intro')).toEqual({ ok: true, url: 'https://example.com/docs' });
    expect(auditability('http://localhost:3000/')).toEqual({ ok: true, url: 'http://localhost:3000/' });
  });

  it('keeps the query string', () => {
    expect(auditability('https://example.com/search?q=a')).toEqual({ ok: true, url: 'https://example.com/search?q=a' });
  });

  it.each([
    ['chrome://settings', 'This is a browser page'],
    ['chrome-extension://abc/page.html', 'This is a browser page'],
    ['about:blank', 'This is a browser page'],
    ['edge://flags', 'This is a browser page'],
    ['view-source:https://example.com', 'This is a browser page'],
    ['file:///Users/me/index.html', 'Local files cannot be audited'],
    ['ftp://example.com/', 'Not a web page'],
    ['data:text/html,hi', 'Not a web page'],
    ['https://chromewebstore.google.com/detail/x', 'The Chrome Web Store is off limits'],
    ['https://chrome.google.com/webstore/category/extensions', 'The Chrome Web Store is off limits'],
    ['https://example.com/report.PDF', 'PDFs cannot be audited'],
  ])('refuses %s', (url, title) => {
    const result = auditability(url);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.title).toBe(title);
      expect(result.message.length).toBeGreaterThan(20);
    }
  });

  it('allows chrome.google.com outside the store', () => {
    expect(auditability('https://chrome.google.com/').ok).toBe(true);
  });

  it('explains an empty tab and a malformed address', () => {
    expect(auditability(undefined)).toMatchObject({ ok: false, title: 'Nothing to audit' });
    expect(auditability('')).toMatchObject({ ok: false, title: 'Nothing to audit' });
    expect(auditability('not a url')).toMatchObject({ ok: false, title: 'Not a web address' });
  });
});

describe('isPageContentType', () => {
  it.each([
    [undefined, true],
    ['', true],
    ['text/html', true],
    ['text/html; charset=utf-8', true],
    ['TEXT/HTML', true],
    ['application/xhtml+xml', true],
    ['application/pdf', false],
    ['image/png', false],
    ['application/json; charset=utf-8', false],
    ['text/plain', false],
  ])('%s → %s', (contentType, expected) => {
    expect(isPageContentType(contentType)).toBe(expected);
  });
});
