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
 * satisfy. It is served on 127.0.0.1, so A8 is na.
 */
export function compliantSite(): Promise<FixtureSite> {
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
