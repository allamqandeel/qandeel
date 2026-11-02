import { createHash } from 'node:crypto';
import type { IncomingMessage, Server } from 'node:http';
import type { Socket } from 'node:net';
import type { Duplex } from 'node:stream';
import { HttpException, Injectable, OnApplicationBootstrap, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { SupabaseAuthService } from '../../../auth/supabase-auth.service';
import { rateLimitTrackerOf } from '../../../http-security/rate-limit.policy';
import { LiveCallService } from '../live-call.service';
import { tokenDeadline, type CallTransport } from '../live-call.connection';
import { LIVE_CALL_CLOSE, LIVE_CALL_PATH, LIVE_CALL_PROTOCOL } from '../live-call.protocol';
import { acceptKey, encodeClose, encodeFrame, FrameParser, OPCODE } from './websocket-frames';

/** Engineering safety bounds of the upgrade (code, not configuration; a change is a reviewed change). */
export const LIVE_CALL_GATEWAY_LIMITS = Object.freeze({
  /** Upgrades per client address per minute: a phone reconnecting inside the 30 s grace needs a few, never this many. */
  upgradesPerAddressPerMinute: 20,
  /** Sockets (open and handshaking) one instance carries. */
  connectionsPerInstance: 200,
  /** Sockets one person holds on one instance at once (a takeover briefly needs two). */
  connectionsPerUser: 3,
  /** The handshake (authentication included) must finish within this. */
  handshakeTimeoutMs: 10_000,
  /** A closing socket that does not answer the close is destroyed after this. */
  closeLingerMs: 2_000,
});

const MINUTE_MS = 60_000;

/** The socket under one accepted connection: RFC 6455 frames out, a hard close after the close frame. */
class SocketTransport implements CallTransport {
  private closed = false;

  constructor(private readonly socket: Duplex) {}

  get bufferedBytes(): number {
    return this.socket.writableLength;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  sendText(text: string): void {
    if (this.closed || this.socket.destroyed) return;
    this.socket.write(encodeFrame(OPCODE.TEXT, Buffer.from(text, 'utf8')));
  }

  pong(data: Buffer): void {
    if (this.closed || this.socket.destroyed) return;
    this.socket.write(encodeFrame(OPCODE.PONG, data));
  }

  close(code: number, reason: string): void {
    if (this.closed) return;
    this.closed = true;
    if (this.socket.destroyed) return;
    this.socket.end(encodeClose(code, reason));
    const linger = setTimeout(() => this.socket.destroy(), LIVE_CALL_GATEWAY_LIMITS.closeLingerMs);
    linger.unref();
  }
}

/** A refused upgrade: a plain HTTP answer on the raw socket, then the socket is gone. Generic, content-free bodies. */
function refuse(socket: Duplex, status: number, text: string, extra: Record<string, string> = {}): void {
  if (socket.destroyed) return;
  const body = JSON.stringify({ outcome: text });
  const headers = { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)), 'Cache-Control': 'no-store', Connection: 'close', ...extra };
  socket.end(`HTTP/1.1 ${status} ${text}\r\n${Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n${body}`);
  setTimeout(() => socket.destroy(), LIVE_CALL_GATEWAY_LIMITS.closeLingerMs).unref();
}

const header = (request: IncomingMessage, name: string): string | undefined => {
  const value = request.headers[name];
  return typeof value === 'string' ? value : undefined;
};

const tokens = (value: string | undefined): string[] => (value ?? '').split(',').map((t) => t.trim()).filter((t) => t !== '');

/**
 * S8B-05 CP1 — the live call's WebSocket gateway (protocol v1 at `/voice/calls/connect`, `live-call.protocol.ts`).
 *
 * It answers the HTTP server's `upgrade` event itself (Nest routes, guards and the HTTP throttler never see an upgrade),
 * so it carries the same boundary on its own:
 *
 *   - only `GET /voice/calls/connect` (no query) with WebSocket version 13, a valid key and the subprotocol
 *     `qandeel.live-call.v1`; any other upgrade path is 404, never a socket;
 *   - a per-address upgrade rate (the client address Express resolves under the startup proxy topology, `trust proxy`
 *     unchanged, IPv6 by /64, SHA-256 keys held only for their minute: the HTTP throttler's tracker), then a per-instance
 *     and, after authentication, a per-person socket cap;
 *   - the Supabase access token in `Authorization: Bearer` (the same check as every guarded route): no token, an invalid
 *     or expired one is 401 before any socket exists; the token's own expiry closes the socket unless TOKEN_REFRESH
 *     renews it (the connection);
 *   - TLS is the trusted proxy's (the API listens behind it, as every route does); nothing here reads a forwarded header;
 *   - no extension is negotiated (an offered per-message deflate is simply not accepted, RFC 6455 §9.1);
 *   - frames are parsed by `FrameParser` (masked, bounded before buffering); call ownership, epoch and every message
 *     rule are the connection's (`LiveCallConnection`) and the call authority's (0189);
 *   - nothing is logged: no token, address, person, call, frame or byte.
 */
@Injectable()
export class LiveCallGateway implements OnApplicationBootstrap, OnModuleDestroy {
  private server: Server | null = null;
  private expressApp: { request: object } | null = null;
  private handshaking = 0;
  private stopping = false;
  private readonly upgrades = new Map<string, { count: number; resetAt: number }>();
  private readonly listener = (request: IncomingMessage, socket: Duplex, head: Buffer) => void this.handleUpgrade(request, socket, head);

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly calls: LiveCallService,
    private readonly auth: SupabaseAuthService,
  ) {}

  onApplicationBootstrap(): void {
    const adapter = this.adapterHost.httpAdapter;
    const server = adapter?.getHttpServer() as Server | undefined;
    if (!adapter || !server) return;
    this.expressApp = adapter.getInstance() as { request: object };
    this.server = server;
    server.on('upgrade', this.listener);
  }

  onModuleDestroy(): void {
    this.stopping = true;
    this.server?.off('upgrade', this.listener);
    this.server = null;
  }

  /** Exposed for tests: the handshake of one upgrade request. */
  async handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    socket.on('error', () => socket.destroy());
    if (request.url !== LIVE_CALL_PATH) return refuse(socket, 404, 'NOT_FOUND');
    if (this.stopping) return refuse(socket, 503, 'UNAVAILABLE');
    const key = acceptKey(header(request, 'sec-websocket-key'));
    if (request.method !== 'GET' || header(request, 'upgrade')?.toLowerCase() !== 'websocket'
      || !tokens(header(request, 'connection')).some((t) => t.toLowerCase() === 'upgrade') || key === null) {
      return refuse(socket, 400, 'BAD_REQUEST');
    }
    if (header(request, 'sec-websocket-version') !== '13') return refuse(socket, 426, 'UPGRADE_REQUIRED', { 'Sec-WebSocket-Version': '13' });
    if (!tokens(header(request, 'sec-websocket-protocol')).includes(LIVE_CALL_PROTOCOL)) return refuse(socket, 400, 'BAD_REQUEST');
    if (!this.admitAddress(request, socket)) {
      this.calls.signal('upgrade', 'overloaded');
      return refuse(socket, 429, 'RATE_LIMITED', { 'Retry-After': '60' });
    }
    if (this.calls.connectionCount + this.handshaking >= LIVE_CALL_GATEWAY_LIMITS.connectionsPerInstance) {
      this.calls.signal('upgrade', 'overloaded');
      return refuse(socket, 503, 'CAPACITY_FULL', { 'Retry-After': '5' });
    }

    this.handshaking += 1;
    const deadline = setTimeout(() => socket.destroy(), LIVE_CALL_GATEWAY_LIMITS.handshakeTimeoutMs);
    deadline.unref();
    let identity: { userId: string; accessToken: string };
    try {
      identity = await this.auth.authenticate(header(request, 'authorization'));
    } catch (error) {
      clearTimeout(deadline);
      this.handshaking -= 1;
      const unavailable = error instanceof ServiceUnavailableException || !(error instanceof HttpException);
      this.calls.signal('upgrade', unavailable ? 'transport_failure' : 'refused_expected');
      return unavailable ? refuse(socket, 503, 'UNAVAILABLE') : refuse(socket, 401, 'UNAUTHORIZED');
    }
    clearTimeout(deadline);
    this.handshaking -= 1;
    if (socket.destroyed || this.stopping) return;
    if (this.calls.connectionsOf(identity.userId) >= LIVE_CALL_GATEWAY_LIMITS.connectionsPerUser) {
      this.calls.signal('upgrade', 'overloaded');
      return refuse(socket, 429, 'RATE_LIMITED', { 'Retry-After': '5' });
    }

    socket.write([
      'HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${key}`,
      `Sec-WebSocket-Protocol: ${LIVE_CALL_PROTOCOL}`, '', '',
    ].join('\r\n'));
    const raw = socket as Socket;
    raw.setNoDelay?.(true);
    raw.setTimeout?.(0);
    this.calls.signal('upgrade', 'success');
    this.wire(socket, identity, head);
  }

  private wire(socket: Duplex, identity: { userId: string; accessToken: string }, head: Buffer): void {
    const transport = new SocketTransport(socket);
    const { connection, forget } = this.calls.attach(transport, identity.userId, tokenDeadline(identity.accessToken, Date.now()));
    const parser = new FrameParser();
    let gone = false;
    const lost = () => {
      if (gone) return;
      gone = true;
      forget();
      connection.onTransportClosed();
    };
    const feed = (chunk: Buffer) => {
      for (const event of parser.push(chunk)) {
        switch (event.kind) {
          case 'text':
            connection.onText(event.text);
            break;
          case 'binary':
            connection.onBinary(event.data);
            break;
          case 'ping':
            transport.pong(event.data);
            break;
          case 'pong':
            break;
          case 'close':
            // The phone closed without END: the call is not ended; the connection is lost (RECONNECTING for the grace).
            transport.close(event.code === LIVE_CALL_CLOSE.NORMAL ? LIVE_CALL_CLOSE.NORMAL : LIVE_CALL_CLOSE.GOING_AWAY, '');
            lost();
            return;
          case 'error':
            transport.close(event.code, 'PROTOCOL');
            lost();
            return;
        }
      }
    };
    socket.on('data', (chunk: Buffer) => feed(chunk));
    socket.on('close', lost);
    socket.on('end', lost);
    if (head.length > 0) feed(head);
  }

  private admitAddress(request: IncomingMessage, socket: Duplex): boolean {
    const now = Date.now();
    if (this.upgrades.size > 10_000) {
      for (const [k, v] of this.upgrades) if (v.resetAt <= now) this.upgrades.delete(k);
    }
    const key = createHash('sha256').update(JSON.stringify(['live_call_upgrade', rateLimitTrackerOf(this.requestView(request, socket))])).digest('hex');
    const window = this.upgrades.get(key);
    if (!window || window.resetAt <= now) {
      this.upgrades.set(key, { count: 1, resetAt: now + MINUTE_MS });
      return true;
    }
    window.count += 1;
    return window.count <= LIVE_CALL_GATEWAY_LIMITS.upgradesPerAddressPerMinute;
  }

  /**
   * The upgrade request seen through Express's own request prototype, so `req.ip` is resolved exactly as for every routed
   * request (the startup `trust proxy` topology; never a hand-read forwarded header).
   */
  private requestView(request: IncomingMessage, socket: Duplex): { readonly ip?: unknown } {
    if (!this.expressApp) return {};
    return Object.create(this.expressApp.request, {
      headers: { value: request.headers },
      socket: { value: socket },
      connection: { value: socket },
    }) as { readonly ip?: unknown };
  }
}
