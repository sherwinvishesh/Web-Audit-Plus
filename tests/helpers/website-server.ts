import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';

/** Where the site lives in the repository and where it is published. */
export const WEBSITE_ROOT = resolve('website');
export const WEBSITE_BASE = 'https://sherwinvishesh.github.io/Web-Audit-Plus';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
const TEXT = new Set(['.html', '.css', '.js', '.md', '.txt', '.xml', '.svg']);

export interface WebsiteServer {
  origin: string;
  close: () => Promise<void>;
}

/**
 * Serve `website/` the way GitHub Pages does: a directory serves its `index.html`, a missing path
 * serves `404.html` with a 404, and each file gets the content type Pages sends for its extension.
 * Absolute links to the published site are rewritten to this origin so canonicals and the sitemap
 * agree with the URL under test.
 */
export function serveWebsite(): Promise<WebsiteServer> {
  return new Promise((done) => {
    let origin = '';
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      let path = decodeURIComponent(url.pathname);
      let file = join(WEBSITE_ROOT, path);
      if (existsSync(file) && statSync(file).isDirectory()) {
        if (!path.endsWith('/')) {
          response.writeHead(301, { location: `${path}/` });
          response.end();
          return;
        }
        path += 'index.html';
        file = join(WEBSITE_ROOT, path);
      }
      let status = 200;
      if (!existsSync(file) || statSync(file).isDirectory()) {
        status = 404;
        file = join(WEBSITE_ROOT, '404.html');
      }
      const extension = extname(file);
      let body: Buffer | string = readFileSync(file);
      if (TEXT.has(extension)) body = body.toString('utf8').split(WEBSITE_BASE).join(origin);
      response.writeHead(status, { 'content-type': TYPES[extension] ?? 'application/octet-stream', 'cache-control': 'max-age=600' });
      response.end(body);
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
      done({ origin, close: () => new Promise((resolveClose) => server.close(() => resolveClose())) });
    });
  });
}
