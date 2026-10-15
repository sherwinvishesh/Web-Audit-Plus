import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { GOOD_HTML, GOOD_TWIN, SPA_SHELL } from '../helpers/evidence';

export interface FixtureSite {
  origin: string;
  close: () => Promise<void>;
}

type Handler = (request: IncomingMessage, response: ServerResponse, origin: string) => void;

async function serve(handler: Handler): Promise<FixtureSite> {
  let origin = '';
  const server: Server = createServer((request, response) => handler(request, response, origin));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    origin,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

const TWIN_HEADERS = {
  'content-type': 'text/markdown; charset=utf-8',
  'x-markdown-tokens': '180',
  'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex',
  vary: 'Accept',
  'x-aeo-version': '1.0',
};

/**
 * A site that implements every convention: robots, llms.txt, sitemap, JSON-LD, a twin at
 * /resume.md, Accept and User-Agent negotiation at the page URL, and 406 for an Accept it cannot
 * satisfy. It is served on 127.0.0.1, so A8 is na. `csp` is sent with the HTML page.
 */
export function compliantSite(options: { csp?: string } = {}): Promise<FixtureSite> {
  return serve((request, response, origin) => {
    const path = new URL(request.url ?? '/', origin).pathname;
    const accept = request.headers.accept ?? '';
    const userAgent = request.headers['user-agent'] ?? '';
    const send = (status: number, headers: Record<string, string>, body: string): void => {
      response.writeHead(status, headers);
      response.end(body);
    };
    switch (path) {
      case '/robots.txt':
        return send(200, { 'content-type': 'text/plain' }, `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
      case '/llms.txt':
        return send(200, { 'content-type': 'text/plain' }, `# Example\n\n> A site.\n\n## Pages\n\n- [Resume](${origin}/resume.md)\n`);
      case '/sitemap.xml':
        return send(200, { 'content-type': 'application/xml' }, `<?xml version="1.0"?><urlset><url><loc>${origin}/resume</loc></url></urlset>`);
      case '/resume.md':
        return send(200, TWIN_HEADERS, GOOD_TWIN);
      case '/resume': {
        const wantsMarkdown = /text\/markdown/.test(accept) || /GPTBot/i.test(userAgent);
        if (wantsMarkdown) return send(200, TWIN_HEADERS, GOOD_TWIN);
        if (!/text\/html|\*\/\*/.test(accept)) return send(406, { 'content-type': 'text/plain', vary: 'Accept' }, 'Not Acceptable');
        return send(
          200,
          {
            'content-type': 'text/html; charset=utf-8',
            vary: 'Accept',
            link: '</resume.md>; rel="alternate"; type="text/markdown"',
            'x-aeo-version': '1.0',
            ...(options.csp ? { 'content-security-policy': options.csp } : {}),
          },
          GOOD_HTML,
        );
      }
      default:
        return send(404, { 'content-type': 'text/plain' }, 'Not found');
    }
  });
}

/** A client-rendered app whose catch-all route answers every path with the same HTML shell. */
export function spaCatchAllSite(): Promise<FixtureSite> {
  return serve((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(SPA_SHELL);
  });
}

/** Every request redirects to the next path, forever. */
export function redirectLoopSite(): Promise<FixtureSite> {
  return serve((request, response) => {
    const n = Number(new URL(request.url ?? '/', 'http://x').searchParams.get('n') ?? '0');
    response.writeHead(302, { location: `/loop?n=${n + 1}` });
    response.end();
  });
}

/** A 1×1 transparent PNG. */
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

const FLAWED_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Flawed fixture</title>
<script src="/blocking.js"></script>
<style>body { font: 16px/1.5 sans-serif; margin: 2rem; } .faint { color: #c8c8c8; }</style>
</head>
<body>
<main>
<h1>A page with known problems</h1>
<p class="faint">This paragraph is too faint to read comfortably.</p>
<img src="/pixel.png" width="40" height="40">
<button><svg width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="6"></circle></svg></button>
<form><input type="text" name="q"></form>
<p><a href="/more">click here</a></p>
</main>
<script>console.error('Fixture error: something went wrong');</script>
</body>
</html>
`;

/**
 * A page that fails specific Lighthouse audits on purpose: no `lang` (html-has-lang), an image with
 * no `alt` (image-alt), an icon button with no name (button-name), an unlabeled input (label), faint
 * text (color-contrast), a vague link (link-text), no meta description, a console error
 * (errors-in-console), and a render-blocking script.
 */
export function flawedSite(): Promise<FixtureSite> {
  return serve((request, response, origin) => {
    const path = new URL(request.url ?? '/', origin).pathname;
    if (path === '/blocking.js') {
      setTimeout(() => {
        response.writeHead(200, { 'content-type': 'text/javascript' });
        response.end('window.fixtureLoaded = true;\n');
      }, 300);
      return;
    }
    if (path === '/pixel.png') {
      response.writeHead(200, { 'content-type': 'image/png' });
      response.end(PIXEL);
      return;
    }
    if (path === '/robots.txt') {
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.end('User-agent: *\nAllow: /\n');
      return;
    }
    if (path === '/' || path === '/more') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(FLAWED_HTML);
      return;
    }
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('Not found');
  });
}
