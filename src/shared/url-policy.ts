/**
 * Which tabs can be audited. Web Audit+ audits what a site serves over HTTP, so anything that is not
 * an http(s) page gets a clear explanation instead of an error from deep inside a run.
 */

export type Auditability = { ok: true; url: string } | { ok: false; title: string; message: string };

const BROWSER_SCHEMES = new Set([
  'about:',
  'brave:',
  'chrome:',
  'chrome-extension:',
  'chrome-search:',
  'chrome-untrusted:',
  'devtools:',
  'edge:',
  'extension:',
  'opera:',
  'view-source:',
  'vivaldi:',
]);

/** Chrome does not let extensions script or debug its extension store. */
function isWebStore(url: URL): boolean {
  return url.hostname === 'chromewebstore.google.com' || (url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore'));
}

export function auditability(raw: string | undefined): Auditability {
  if (!raw) {
    return { ok: false, title: 'Nothing to audit', message: 'This tab has no page loaded. Open a website and try again.' };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, title: 'Not a web address', message: 'This tab has no web address that can be audited.' };
  }
  if (BROWSER_SCHEMES.has(url.protocol)) {
    return {
      ok: false,
      title: 'This is a browser page',
      message: 'Browser and extension pages are not websites and cannot be audited. Open a website in this tab.',
    };
  }
  if (url.protocol === 'file:') {
    return {
      ok: false,
      title: 'Local files cannot be audited',
      message:
        'Web Audit+ checks what a server sends: headers, robots.txt, the markdown twin. Serve the folder with a local server (for example `npx serve`) and audit the http://localhost address instead.',
    };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, title: 'Not a web page', message: 'Only http and https pages can be audited.' };
  }
  if (isWebStore(url)) {
    return {
      ok: false,
      title: 'The Chrome Web Store is off limits',
      message: 'Chrome does not allow extensions to inspect the Chrome Web Store. Any other website works.',
    };
  }
  if (/\.pdf$/i.test(url.pathname)) {
    return {
      ok: false,
      title: 'PDFs cannot be audited',
      message: 'This tab shows a PDF document. Web Audit+ audits web pages; open the page that links to it instead.',
    };
  }
  url.hash = '';
  return { ok: true, url: url.toString() };
}

/**
 * Whether a Content-Type is a document a browser renders as a page. Checked on the live response,
 * because a URL does not say what it serves.
 */
export function isPageContentType(contentType: string | undefined): boolean {
  if (!contentType) return true;
  const type = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return type === '' || type === 'text/html' || type === 'application/xhtml+xml';
}
