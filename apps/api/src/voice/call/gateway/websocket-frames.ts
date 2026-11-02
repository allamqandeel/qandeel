import { createHash } from 'node:crypto';
import { MAX_BINARY_FRAME_BYTES, MAX_TEXT_FRAME_BYTES } from '../live-call.protocol';

/**
 * S8B-05 CP1 — the server side of RFC 6455, only as much as protocol v1 needs, written here instead of adding a socket
 * package (the repository's dependency pins forbid one): no extension, no fragmentation, client frames masked, every
 * frame bounded BEFORE its payload is buffered. Pure: bytes in, events out.
 */

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
export const OPCODE = Object.freeze({ TEXT: 0x1, BINARY: 0x2, CLOSE: 0x8, PING: 0x9, PONG: 0xa });
const CONTROL_MAX = 125;

/** RFC 6455 §4.2.2: the Sec-WebSocket-Accept for a client key (base64 of 16 bytes). Null for a malformed key. */
export function acceptKey(key: string | undefined): string | null {
  if (typeof key !== 'string' || !/^[A-Za-z0-9+/]{22}==$/u.test(key) || Buffer.from(key, 'base64').length !== 16) return null;
  return createHash('sha1').update(key + GUID).digest('base64');
}

export type FrameEvent =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'binary'; readonly data: Buffer }
  | { readonly kind: 'close'; readonly code: number | null }
  | { readonly kind: 'ping'; readonly data: Buffer }
  | { readonly kind: 'pong' }
  /** The peer broke RFC 6455 or the protocol's bounds: close with this code. */
  | { readonly kind: 'error'; readonly code: 1002 | 1007 | 1009 };

const utf8 = new TextDecoder('utf-8', { fatal: true });

/** Incremental parser of client frames. After an `error` or a `close` it parses nothing more. */
export class FrameParser {
  private pending: Buffer = Buffer.alloc(0);
  private done = false;

  push(chunk: Buffer): FrameEvent[] {
    if (this.done) return [];
    this.pending = this.pending.length === 0 ? chunk : Buffer.concat([this.pending, chunk]);
    const events: FrameEvent[] = [];
    while (!this.done) {
      const event = this.next();
      if (!event) break;
      events.push(event);
      if (event.kind === 'error' || event.kind === 'close') this.done = true;
    }
    return events;
  }

  private fail(code: 1002 | 1007 | 1009): FrameEvent {
    this.pending = Buffer.alloc(0);
    return { kind: 'error', code };
  }

  private next(): FrameEvent | null {
    const b = this.pending;
    if (b.length < 2) return null;
    const fin = (b[0]! & 0x80) !== 0;
    const rsv = b[0]! & 0x70;
    const opcode = b[0]! & 0x0f;
    const masked = (b[1]! & 0x80) !== 0;
    let length = b[1]! & 0x7f;
    let offset = 2;
    if (rsv !== 0 || !masked || !fin) return this.fail(1002);
    const control = opcode >= 0x8;
    if (![OPCODE.TEXT, OPCODE.BINARY, OPCODE.CLOSE, OPCODE.PING, OPCODE.PONG].includes(opcode as never)) return this.fail(1002);
    if (length === 126) {
      if (b.length < 4) return null;
      length = b.readUInt16BE(2);
      offset = 4;
    } else if (length === 127) {
      if (b.length < 10) return null;
      const high = b.readUInt32BE(2);
      if (high !== 0) return this.fail(1009);
      length = b.readUInt32BE(6);
      offset = 10;
    }
    if (control && length > CONTROL_MAX) return this.fail(1002);
    const max = opcode === OPCODE.TEXT ? MAX_TEXT_FRAME_BYTES : opcode === OPCODE.BINARY ? MAX_BINARY_FRAME_BYTES : CONTROL_MAX;
    if (length > max) return this.fail(1009);
    if (b.length < offset + 4 + length) return null;
    const mask = b.subarray(offset, offset + 4);
    const payload = Buffer.alloc(length);
    for (let i = 0; i < length; i += 1) payload[i] = b[offset + 4 + i]! ^ mask[i % 4]!;
    this.pending = b.subarray(offset + 4 + length);
    switch (opcode) {
      case OPCODE.TEXT:
        try {
          return { kind: 'text', text: utf8.decode(payload) };
        } catch {
          return this.fail(1007);
        }
      case OPCODE.BINARY:
        return { kind: 'binary', data: payload };
      case OPCODE.CLOSE:
        if (length === 1) return this.fail(1002);
        return { kind: 'close', code: length >= 2 ? payload.readUInt16BE(0) : null };
      case OPCODE.PING:
        return { kind: 'ping', data: payload };
      default:
        return { kind: 'pong' };
    }
  }
}

/** One unmasked server frame (FIN set). */
export function encodeFrame(opcode: number, payload: Buffer): Buffer {
  const length = payload.length;
  const header = length < 126 ? Buffer.alloc(2) : length < 65536 ? Buffer.alloc(4) : Buffer.alloc(10);
  header[0] = 0x80 | opcode;
  if (length < 126) header[1] = length;
  else if (length < 65536) {
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header[1] = 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(length, 6);
  }
  return Buffer.concat([header, payload]);
}

export function encodeClose(code: number, reason: string): Buffer {
  const text = Buffer.from(reason.slice(0, 100), 'utf8');
  const payload = Buffer.alloc(2 + text.length);
  payload.writeUInt16BE(code, 0);
  text.copy(payload, 2);
  return encodeFrame(OPCODE.CLOSE, payload);
}

/** A masked CLIENT frame: for tests and the synthetic client only (the server never masks). */
export function encodeClientFrame(opcode: number, payload: Buffer, mask: Buffer = Buffer.from([0x37, 0xfa, 0x21, 0x3d])): Buffer {
  const length = payload.length;
  const header = length < 126 ? Buffer.alloc(2) : length < 65536 ? Buffer.alloc(4) : Buffer.alloc(10);
  header[0] = 0x80 | opcode;
  if (length < 126) header[1] = 0x80 | length;
  else if (length < 65536) {
    header[1] = 0x80 | 126;
    header.writeUInt16BE(length, 2);
  } else {
    header[1] = 0x80 | 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(length, 6);
  }
  const body = Buffer.alloc(length);
  for (let i = 0; i < length; i += 1) body[i] = payload[i]! ^ mask[i % 4]!;
  return Buffer.concat([header, mask, body]);
}
