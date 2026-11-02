import { Agent as HttpAgent, createServer, request as httpRequest, type Server } from 'node:http';
import type { Agent as HttpsAgent } from 'node:https';
import type { AddressInfo } from 'node:net';
import { LIVE_CALL_KEEP_ALIVE, liveCallKeepAliveAgent, liveCallKeepAliveFetch } from './live-call-keep-alive-fetch';

// S8B-05 CP2 (L1): the call's own keep-alive transport, exercised against a loopback server only (no provider, no network
// beyond 127.0.0.1). The request function is swapped for node:http so the test needs no certificate; everything else is
// the production code path.
describe('S8B-05 CP2 the live call keep-alive fetch (L1)', () => {
  let server: Server;
  let port: number;
  const sockets = new Set<string>();
  const seen: Array<{ method: string; headers: Record<string, unknown>; body: string }> = [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      sockets.add(`${req.socket.remotePort}`);
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString('utf8'); });
      req.on('end', () => {
        seen.push({ method: req.method ?? '', headers: req.headers, body });
        if (req.url === '/redirect') {
          res.writeHead(302, { location: 'https://elsewhere.invalid/' });
          res.end();
          return;
        }
        if (req.url === '/slow') {
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          res.write('data: first\n\n');
          return; // never ends: the caller aborts
        }
        res.writeHead(200, { 'content-type': 'application/json', 'set-cookie': ['a=1', 'b=2'] });
        res.end(JSON.stringify({ ok: true, echo: body }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  const viaHttp = (agent: HttpAgent) => liveCallKeepAliveFetch(agent as unknown as HttpsAgent, (url, options, callback) =>
    httpRequest({ hostname: url.hostname, port: url.port, path: `${url.pathname}${url.search}`, method: options.method, headers: options.headers, agent }, callback));

  it('is one dedicated keep-alive agent, never the process default', () => {
    const agent = liveCallKeepAliveAgent();
    expect(agent.options.keepAlive).toBe(true);
    expect(agent.maxSockets).toBe(LIVE_CALL_KEEP_ALIVE.maxSockets);
    agent.destroy();
  });

  it('posts the body with its headers and an identity encoding, streams the answer, and reuses one warm socket', async () => {
    const agent = new HttpAgent({ keepAlive: true, maxSockets: 1 });
    const fetchImpl = viaHttp(agent);
    sockets.clear();
    for (const word of ['one', 'two', 'three']) {
      const response = await fetchImpl(`https://127.0.0.1:${port}/v1`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' }, body: word });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true, echo: word });
      expect(response.headers.get('set-cookie')).toBe('a=1, b=2');
    }
    expect(seen.at(-1)).toMatchObject({ method: 'POST', headers: { 'accept-encoding': 'identity', authorization: 'Bearer t', 'content-length': '5' } });
    expect(sockets.size).toBe(1);
    agent.destroy();
  });

  it('never follows a redirect, refuses plain http and Request objects, and honours the AbortSignal mid-body', async () => {
    const agent = new HttpAgent({ keepAlive: true });
    const fetchImpl = viaHttp(agent);
    const redirect = await fetchImpl(`https://127.0.0.1:${port}/redirect`);
    expect([redirect.status, redirect.ok]).toEqual([302, false]);
    await expect(liveCallKeepAliveFetch()(`http://127.0.0.1:${port}/v1`)).rejects.toThrow('LIVE_CALL_FETCH_HTTPS_ONLY');
    await expect(liveCallKeepAliveFetch()(new Request(`https://127.0.0.1:${port}/v1`))).rejects.toThrow('LIVE_CALL_FETCH_REQUEST_UNSUPPORTED');
    const controller = new AbortController();
    const slow = await fetchImpl(`https://127.0.0.1:${port}/slow`, { signal: controller.signal });
    const reader = slow.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe('data: first\n\n');
    controller.abort();
    await expect(reader.read()).rejects.toThrow();
    const already = new AbortController();
    already.abort();
    await expect(fetchImpl(`https://127.0.0.1:${port}/v1`, { signal: already.signal })).rejects.toMatchObject({ name: 'AbortError' });
    agent.destroy();
  });
});
