/**
 * The markdown twin URL convention, matching OpenGEO: the page path with `.md` appended,
 * `/resume` → `/resume.md`, `/` → `/index.md`. Query and fragment are dropped.
 */

/** Leading slash, no repeated slashes, no trailing slash except on the root. */
export function normalizeRoute(pathname: string): string {
  let p = pathname.trim();
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p === '' ? '/' : p;
}

export function routeToTwinPath(route: string): string {
  const r = normalizeRoute(route);
  return r === '/' ? '/index.md' : `${r}.md`;
}

export function isMarkdownPath(pathname: string): boolean {
  return normalizeRoute(pathname).endsWith('.md');
}

/** Absolute URL of a page's markdown twin. */
export function twinUrl(pageUrl: string): string {
  const url = new URL(pageUrl);
  url.pathname = routeToTwinPath(url.pathname);
  url.search = '';
  url.hash = '';
  return url.toString();
}
