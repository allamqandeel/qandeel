import { createServer, request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SupabaseAuthService } from '../../../auth/supabase-auth.service';
import { VoiceMediaService } from '../../../voice-media/voice-media.service';
import { readOggOpus } from '../codec/ogg-opus';
import { LIVE_CALL_SPEECH_SINK, NULL_LIVE_CALL_SPEECH_SINK } from '../live-call-speech.port';
import { LiveCallService } from '../live-call.service';
import { encodeAudioFrame, LIVE_CALL_PATH, LIVE_CALL_PROTOCOL, MAX_BINARY_FRAME_BYTES } from '../live-call.protocol';
import { LIVE_CALL_STORE } from '../live-call.store';
import { InMemoryCallAuthority } from '../testing/in-memory-call-authority';
import { syntheticUplinkPackets } from '../testing/synthetic-voice';
import { LIVE_CALL_GATEWAY_LIMITS, LiveCallGateway } from './live-call.gateway';

const USER_A = '00000000-0000-4000-8000-0000000000a1';
const USER_B = '00000000-0000-4000-8000-0000000000a2';
const SESSION = '00000000-0000-4000-8000-0000000000b1';
const CALL = '00000000-0000-4000-8000-0000000000c1';
const PHONE = '00000000-0000-4000-8000-0000000000d1';
const PACKETS = syntheticUplinkPackets(250);

/** A stand-in for Supabase Auth's `/auth/v1/user`: the real SupabaseAuthService talks HTTP to it. */
function fakeAuth(): Promise<Server> {
  const server = createServer((req, res) => {
    const token = /^Bearer (.+)$/u.exec(String(req.headers.authorization ?? ''))?.[1];
    if (req.url !== '/auth/v1/user' || req.headers.apikey !== 'test-publishable') return void res.writeHead(404).end();
    if (token === 'down') return void req.socket.destroy();
    const id = token === 'token-a' ? USER_A : token === 'token-b' ? USER_B : null;
    if (!id) return void res.writeHead(401, { 'Content-Type': 'application/json' }).end('{"msg":"invalid JWT"}');
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ id }));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

interface Booted {
  app: INestApplication;
  authority: InMemoryCallAuthority;
  url: string;
  port: number;
}

async function boot(): Promise<Booted> {
  const authority = new InMemoryCallAuthority();
  const module = await Test.createTestingModule({
    providers: [
      SupabaseAuthService,
      { provide: LIVE_CALL_STORE, useValue: authority },
      { provide: VoiceMediaService, useValue: authority },
      { provide: LIVE_CALL_SPEECH_SINK, useValue: NULL_LIVE_CALL_SPEECH_SINK },
      LiveCallService,
      LiveCallGateway,
    ],
  }).compile();
  const app = module.createNestApplication();
  await app.listen(0, '127.0.0.1');
  const port = (app.getHttpServer().address() as AddressInfo).port;
  return { app, authority, port, url: `ws://127.0.0.1:${port}${LIVE_CALL_PATH}` };
}

/** A raw upgrade request: the HTTP status of a refused handshake. */
function upgradeStatus(port: number, headers: Record<string, string>, path = LIVE_CALL_PATH): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      host: '127.0.0.1', port, path, method: 'GET',
      headers: {
        Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Protocol': LIVE_CALL_PROTOCOL, ...headers,
      },
    });
    req.on('upgrade', (_res, socket) => {
      socket.destroy();
      resolve(101);
    });
    req.on('response', (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('error', reject);
    req.end();
  });
}

class Client {
  readonly messages: Array<Record<string, unknown>> = [];
  closed: Promise<{ code: number }>;
  private readonly ws: WebSocket;

  constructor(url: string, token: string) {
    this.ws = new WebSocket(url, { protocols: [LIVE_CALL_PROTOCOL], headers: { authorization: `Bearer ${token}` } } as never);
    this.ws.binaryType = 'arraybuffer';
    this.ws.onmessage = (event) => void this.messages.push(JSON.parse(String(event.data)) as Record<string, unknown>);
    this.closed = new Promise((resolve) => {
      this.ws.onclose = (event) => resolve({ code: event.code });
    });
  }

  opened(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve(this.ws.protocol);
      this.ws.onerror = () => reject(new Error('NOT_OPENED'));
    });
  }

  send(message: object | Buffer): void {
    this.ws.send(Buffer.isBuffer(message) ? message : JSON.stringify(message));
  }

  close(): void {
    this.ws.close(1000);
  }

  async waitFor(predicate: (m: Record<string, unknown>) => boolean, ms = 4000): Promise<Record<string, unknown>> {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      const found = this.messages.find(predicate);
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('MESSAGE_NOT_SEEN');
  }

  /** Real-time pacing, 20 ms per packet, like a phone. */
  async audio(epoch: number, count: number, seq0 = 0, capture0 = 0): Promise<void> {
    for (let i = 0; i < count; i += 1) {
      this.send(encodeAudioFrame({ epoch, seq: seq0 + i, captureMs: capture0 + i * 20, packet: PACKETS[i % PACKETS.length]! }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
}

const hello = (resume = false) => ({ type: 'HELLO', v: 1, callId: CALL, sessionId: SESSION, clientInstanceId: PHONE, resume });

describe('S8B-05 CP1 the live call gateway over a real WebSocket, with real authentication', () => {
  let auth: Server;
  let booted: Booted;
  const env = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_PUBLISHABLE_KEY };

  beforeAll(async () => {
    auth = await fakeAuth();
    process.env.SUPABASE_URL = `http://127.0.0.1:${(auth.address() as AddressInfo).port}`;
    process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable';
  });

  afterAll(async () => {
    process.env.SUPABASE_URL = env.url;
    process.env.SUPABASE_PUBLISHABLE_KEY = env.key;
    await new Promise((resolve) => auth.close(resolve));
  });

  beforeEach(async () => {
    booted = await boot();
  });

  afterEach(async () => {
    await booted.app.close();
  });

  it('refuses every invalid handshake before a socket exists', async () => {
    const { port } = booted;
    expect(await upgradeStatus(port, {})).toBe(401); // no token
    expect(await upgradeStatus(port, { Authorization: 'Bearer expired-or-forged' })).toBe(401);
    expect(await upgradeStatus(port, { Authorization: 'Bearer down' })).toBe(503); // auth unreachable: never admitted
    expect(await upgradeStatus(port, { Authorization: 'Bearer token-a' }, '/voice/calls/other')).toBe(404);
    expect(await upgradeStatus(port, { Authorization: 'Bearer token-a' }, `${LIVE_CALL_PATH}?token=x`)).toBe(404);
    expect(await upgradeStatus(port, { Authorization: 'Bearer token-a', 'Sec-WebSocket-Protocol': 'other' })).toBe(400);
    expect(await upgradeStatus(port, { Authorization: 'Bearer token-a', 'Sec-WebSocket-Version': '8' })).toBe(426);
    expect(await upgradeStatus(port, { Authorization: 'Bearer token-a', 'Sec-WebSocket-Key': 'bad' })).toBe(400);
    expect(await upgradeStatus(port, { Authorization: 'Bearer token-a' })).toBe(101);
    expect(booted.authority.calls.size).toBe(0);
  });

  it('carries a call: HELLO, real Opus audio, ACTIVE, END; the USER track is valid Ogg Opus', async () => {
    const client = new Client(booted.url, 'token-a');
    expect(await client.opened()).toBe(LIVE_CALL_PROTOCOL);
    client.send(hello());
    expect(await client.waitFor((m) => m.type === 'STATE')).toMatchObject({ state: 'CONNECTING', epoch: 1 });
    await client.audio(1, 150);
    expect(await client.waitFor((m) => m.state === 'ACTIVE')).toMatchObject({ epoch: 1 });
    // S8B-05 CP2: PLAYOUT is supported; a mark for no reply of this connection is ignored and still acknowledged.
    client.send({ type: 'PLAYOUT', msgId: 1, callTurnIndex: 0, chunkSeq: 0, playedMs: 0 });
    expect(await client.waitFor((m) => m.type === 'ACK' && m.msgId === 1)).toMatchObject({ msgId: 1 });
    client.send({ type: 'BARGE_IN', msgId: 3, callTurnIndex: 0, captureMs: 3000 });
    expect(await client.waitFor((m) => m.type === 'REFUSED')).toMatchObject({ reason: 'NOT_SUPPORTED_YET', msgId: 3 });
    client.send({ type: 'END', msgId: 2 });
    expect(await client.waitFor((m) => m.state === 'ENDED')).toMatchObject({ endReason: 'USER_ENDED' });
    expect((await client.closed).code).toBe(1000);
    const [segment] = booted.authority.segments;
    expect(booted.authority.segments.length).toBe(1);
    expect([segment!.startMs, segment!.endMs]).toEqual([0, 3000]);
    const ogg = readOggOpus(segment!.bytes);
    expect(ogg.packets.length).toBe(150);
    expect(ogg.packets.every((p, i) => p.equals(PACKETS[i]!))).toBe(true);
  }, 20_000);

  it('a dropped socket leaves the call RECONNECTING, and a new socket resumes it (never a new call)', async () => {
    const first = new Client(booted.url, 'token-a');
    await first.opened();
    first.send(hello());
    await first.waitFor((m) => m.type === 'STATE');
    await first.audio(1, 50);
    await first.waitFor((m) => m.state === 'ACTIVE');
    first.close();
    await first.closed;
    const deadline = Date.now() + 3000;
    while (booted.authority.calls.get(CALL)?.state !== 'RECONNECTING' && Date.now() < deadline) await new Promise((r) => setTimeout(r, 10));
    expect(booted.authority.calls.get(CALL)!.state).toBe('RECONNECTING');

    const second = new Client(booted.url, 'token-a');
    await second.opened();
    second.send(hello(true));
    expect(await second.waitFor((m) => m.type === 'STATE')).toMatchObject({ state: 'ACTIVE', epoch: 2, resumeFromCaptureMs: 1000 });
    second.send({ type: 'END', msgId: 1 });
    await second.closed;
    expect(booted.authority.calls.size).toBe(1);
  }, 20_000);

  it('another person cannot resume the call: their HELLO finds nothing', async () => {
    const owner = new Client(booted.url, 'token-a');
    await owner.opened();
    owner.send(hello());
    await owner.waitFor((m) => m.type === 'STATE');
    const intruder = new Client(booted.url, 'token-b');
    await intruder.opened();
    intruder.send(hello(true));
    expect(await intruder.waitFor((m) => m.type === 'REFUSED')).toMatchObject({ reason: 'NOT_FOUND' });
    expect((await intruder.closed).code).toBe(4004);
    expect(booted.authority.calls.get(CALL)!.epoch).toBe(1);
    owner.close();
  }, 20_000);

  it('closes on an oversize frame (1009) and on bytes that are not an Opus uplink packet (4002)', async () => {
    const big = new Client(booted.url, 'token-a');
    await big.opened();
    big.send(Buffer.alloc(MAX_BINARY_FRAME_BYTES + 1));
    expect((await big.closed).code).toBe(1009);

    const random = new Client(booted.url, 'token-a');
    await random.opened();
    random.send(hello());
    await random.waitFor((m) => m.type === 'STATE');
    random.send(encodeAudioFrame({ epoch: 1, seq: 0, captureMs: 0, packet: Buffer.from([0xfc, 9, 9, 9, 9]) }));
    expect((await random.closed).code).toBe(4002);
  }, 20_000);

  it('caps sockets per person and upgrades per address', async () => {
    const held: Client[] = [];
    for (let i = 0; i < LIVE_CALL_GATEWAY_LIMITS.connectionsPerUser; i += 1) {
      const client = new Client(booted.url, 'token-a');
      await client.opened();
      held.push(client);
    }
    expect(await upgradeStatus(booted.port, { Authorization: 'Bearer token-a' })).toBe(429);
    for (const client of held) client.close();
    const statuses: number[] = [];
    for (let i = 0; i < LIVE_CALL_GATEWAY_LIMITS.upgradesPerAddressPerMinute; i += 1) statuses.push(await upgradeStatus(booted.port, {}));
    expect(statuses.at(-1)).toBe(429); // this address already spent its minute's upgrades
    expect(await upgradeStatus(booted.port, { Authorization: 'Bearer token-a' })).toBe(429);
  }, 20_000);

  it('the service knows how many sockets are attached, per person', async () => {
    const calls = booted.app.get(LiveCallService);
    const client = new Client(booted.url, 'token-a');
    await client.opened();
    expect(calls.connectionsOf(USER_A)).toBe(1);
    client.close();
    await client.closed;
    const deadline = Date.now() + 2000;
    while (calls.connectionsOf(USER_A) !== 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 10));
    expect(calls.connectionCount).toBe(0);
  });
});
