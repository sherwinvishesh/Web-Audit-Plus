import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gatherEvidence } from '../../src/agentic/evidence';
import { BROWSER_UA, GPTBOT_UA, WEBAUDIT_UA } from '../../src/agentic/http';
import { buildAgenticReport } from '../../src/agentic/report';
import { createFetchTransport, ReadWriteGate, type UserAgentControl } from '../../src/agentic/transports/fetch';
import { compliantSite, type FixtureSite } from '../fixtures/sites';

/**
 * A stand-in for the extension's debugger override: one User-Agent for the whole context, applied
 * to every request in flight, exactly the property that makes the override dangerous.
 */
function contextUserAgent(): { control: UserAgentControl; fetch: typeof fetch; calls: Array<string | undefined> } {
  let current: string | undefined;
  const calls: Array<string | undefined> = [];
  return {
    calls,
    control: {
      set: async (userAgent) => {
        calls.push(userAgent);
        current = userAgent;
      },
    },
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set('user-agent', current ?? 'BrowserOwn/1.0');
      return fetch(input, { ...init, headers });
    },
  };
}

describe('fetch transport against a compliant site', () => {
  let site: FixtureSite;
  beforeAll(async () => {
    site = await compliantSite();
  });
  afterAll(() => site.close());

  it('scores 100 with the User-Agent sent as a header', async () => {
    const evidence = await gatherEvidence(`${site.origin}/resume`, createFetchTransport(), { measuredFrom: 'browser' });
    const report = buildAgenticReport(evidence);
    expect(report.score.value).toBe(100);
    expect(report.checks.find((check) => check.id === 'A6')?.reason).toContain('measured from this browser');
  });

  it('scores 100 with a context-wide User-Agent override', async () => {
    const context = contextUserAgent();
    const transport = createFetchTransport({ fetch: context.fetch, userAgent: context.control, nativeUserAgent: BROWSER_UA });
    const report = buildAgenticReport(await gatherEvidence(`${site.origin}/resume`, transport));
    expect(report.score.value).toBe(100);
    // Two overrides, each restored before anything else ran; the browser probe used the browser's own.
    expect(context.calls).toEqual(expect.arrayContaining([WEBAUDIT_UA, GPTBOT_UA]));
    expect(context.calls).toHaveLength(4);
    expect(context.calls.filter((call) => call === undefined)).toHaveLength(2);
  });
});

describe('fetch transport mechanics', () => {
  let server: Server;
  let origin = '';
  const seen: Array<{ path: string; userAgent: string; cookie?: string }> = [];

  beforeAll(async () => {
    server = createServer((request, response) => {
      const path = request.url ?? '/';
      const entry: { path: string; userAgent: string; cookie?: string } = { path, userAgent: request.headers['user-agent'] ?? '' };
      if (request.headers.cookie) entry.cookie = request.headers.cookie;
      seen.push(entry);
      if (path === '/slow') return void setTimeout(() => response.end('late'), 500);
      if (path === '/hang') return;
      if (path === '/redirect') {
        response.writeHead(302, { location: '/landing' });
        return void response.end();
      }
      if (path === '/big') {
        response.writeHead(200, { 'content-type': 'text/plain' });
        return void response.end('x'.repeat(10_000));
      }
      response.writeHead(200, { 'content-type': 'text/plain', 'x-a': '1' });
      response.end(`ok ${path}`);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    server.closeAllConnections();
    return new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('never lets an override reach a probe that did not ask for it', async () => {
    const context = contextUserAgent();
    const transport = createFetchTransport({ fetch: context.fetch, userAgent: context.control });
    seen.length = 0;
    await Promise.all([
      transport.probe({ url: `${origin}/slow` }),
      transport.probe({ url: `${origin}/bot`, userAgent: GPTBOT_UA }),
      transport.probe({ url: `${origin}/plain` }),
      transport.probe({ url: `${origin}/ours`, userAgent: WEBAUDIT_UA }),
      transport.probe({ url: `${origin}/after` }),
    ]);
    const byPath = Object.fromEntries(seen.map((entry) => [entry.path, entry.userAgent]));
    expect(byPath).toEqual({ '/slow': 'BrowserOwn/1.0', '/bot': GPTBOT_UA, '/plain': 'BrowserOwn/1.0', '/ours': WEBAUDIT_UA, '/after': 'BrowserOwn/1.0' });
  });

  it('follows redirects and records both ends of the chain', async () => {
    const response = await createFetchTransport().probe({ url: `${origin}/redirect` });
    expect(response).toMatchObject({ status: 200, redirected: true, finalUrl: `${origin}/landing`, redirectChain: [`${origin}/redirect`, `${origin}/landing`] });
    expect(response.body).toBe('ok /landing');
    expect(response.headers['x-a']).toBe('1');
  });

  it('caps the body and says so', async () => {
    const response = await createFetchTransport().probe({ url: `${origin}/big`, maxBytes: 1000 });
    expect(response.body).toHaveLength(1000);
    expect(response.truncated).toBe(true);
  });

  it('records a timeout as a response', async () => {
    const response = await createFetchTransport().probe({ url: `${origin}/hang`, timeoutMs: 150 });
    expect(response).toMatchObject({ status: 0, ok: false, error: 'Timed out waiting for a response' });
  });

  it('records a cancelled run as a response', async () => {
    const controller = new AbortController();
    const pending = createFetchTransport({ signal: controller.signal }).probe({ url: `${origin}/hang` });
    setTimeout(() => controller.abort(), 50);
    expect(await pending).toMatchObject({ status: 0, error: 'Cancelled' });
  });

  it('records a refused connection as a response', async () => {
    const response = await createFetchTransport().probe({ url: 'http://127.0.0.1:1/' });
    expect(response.status).toBe(0);
    expect(response.error).toBeTruthy();
  });

  it('reports a failed override instead of probing with the wrong User-Agent', async () => {
    seen.length = 0;
    const transport = createFetchTransport({
      userAgent: {
        set: async (userAgent) => {
          if (userAgent) throw new Error('Debugger is not attached');
        },
      },
    });
    const response = await transport.probe({ url: `${origin}/bot`, userAgent: GPTBOT_UA });
    expect(response).toMatchObject({ status: 0, error: 'Could not set the User-Agent: Debugger is not attached' });
    expect(seen).toHaveLength(0);
  });

  it('prefers resource timing for TTFB when the platform has it', async () => {
    const response = await createFetchTransport({ measure: () => 42 }).probe({ url: `${origin}/plain` });
    expect(response.ttfbMs).toBe(42);
  });
});

describe('ReadWriteGate', () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

  it('runs readers together, writers alone, in arrival order', async () => {
    const gate = new ReadWriteGate();
    const log: string[] = [];
    const task = (name: string) => async () => {
      log.push(`+${name}`);
      await tick();
      log.push(`-${name}`);
    };
    await Promise.all([
      gate.shared(task('r1')),
      gate.shared(task('r2')),
      gate.exclusive(task('w1')),
      gate.shared(task('r3')),
      gate.exclusive(task('w2')),
    ]);
    expect(log).toEqual(['+r1', '+r2', '-r1', '-r2', '+w1', '-w1', '+r3', '-r3', '+w2', '-w2']);
  });

  it('releases after a task throws', async () => {
    const gate = new ReadWriteGate();
    await expect(gate.exclusive(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(gate.shared(async () => 'ok')).resolves.toBe('ok');
  });
});
