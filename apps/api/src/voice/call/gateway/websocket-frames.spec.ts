import { MAX_BINARY_FRAME_BYTES, MAX_TEXT_FRAME_BYTES } from '../live-call.protocol';
import { acceptKey, encodeClientFrame, encodeClose, encodeFrame, FrameParser, OPCODE } from './websocket-frames';

/** A client frame with its first two header bytes overridden (to break one rule at a time). */
function tamper(frame: Buffer, byte0: number | null, byte1: number | null = null): Buffer {
  const copy = Buffer.from(frame);
  if (byte0 !== null) copy[0] = byte0;
  if (byte1 !== null) copy[1] = byte1;
  return copy;
}

describe('S8B-05 CP1 the RFC 6455 frame parser refuses what protocol v1 does not allow, before buffering it', () => {
  it('derives the RFC 6455 accept key and refuses a malformed client key', () => {
    expect(acceptKey('dGhlIHNhbXBsZSBub25jZQ==')).toBe('s3pPLMBiTxaQ9kYGzzhZRbK+xOo='); // RFC 6455 §1.3
    for (const bad of [undefined, '', 'short', 'dGhlIHNhbXBsZSBub25jZQ=', 'dGhlIHNhbXBsZSBub25jZQ==x', '!GhlIHNhbXBsZSBub25jZQ==']) {
      expect(acceptKey(bad)).toBeNull();
    }
  });

  it('parses a masked frame delivered byte by byte, and two frames in one chunk', () => {
    const parser = new FrameParser();
    const bytes = encodeClientFrame(OPCODE.TEXT, Buffer.from('{"type":"HEARTBEAT","n":1}'));
    const events = [];
    for (const byte of bytes) events.push(...parser.push(Buffer.from([byte])));
    expect(events).toEqual([{ kind: 'text', text: '{"type":"HEARTBEAT","n":1}' }]);
    const both = new FrameParser().push(Buffer.concat([encodeClientFrame(OPCODE.BINARY, Buffer.from([1, 2, 3])), encodeClientFrame(OPCODE.PING, Buffer.from('p'))]));
    expect(both).toEqual([{ kind: 'binary', data: Buffer.from([1, 2, 3]) }, { kind: 'ping', data: Buffer.from('p') }]);
  });

  it('refuses an unmasked client frame, reserved bits, fragmentation, continuations and unknown opcodes (1002)', () => {
    const text = encodeClientFrame(OPCODE.TEXT, Buffer.from('x'));
    const cases: Array<[string, Buffer]> = [
      ['unmasked', encodeFrame(OPCODE.TEXT, Buffer.from('x'))],
      ['RSV1 (no extension was negotiated)', tamper(text, 0x80 | 0x40 | OPCODE.TEXT)],
      ['RSV3', tamper(text, 0x80 | 0x10 | OPCODE.TEXT)],
      ['a fragment (FIN clear)', tamper(text, OPCODE.TEXT)],
      ['a continuation frame', tamper(text, 0x80)],
      ['a reserved data opcode', tamper(text, 0x80 | 0x3)],
      ['a reserved control opcode', tamper(text, 0x80 | 0xb)],
      ['a fragmented ping', tamper(encodeClientFrame(OPCODE.PING, Buffer.alloc(0)), OPCODE.PING)],
      ['a one-byte close payload', encodeClientFrame(OPCODE.CLOSE, Buffer.from([3]))],
    ];
    for (const [label, frame] of cases) expect([label, new FrameParser().push(frame)]).toEqual([label, [{ kind: 'error', code: 1002 }]]);
  });

  it('refuses a control frame over 125 bytes (1002) and an oversize data frame from its header alone (1009)', () => {
    expect(new FrameParser().push(encodeClientFrame(OPCODE.PING, Buffer.alloc(126)))).toEqual([{ kind: 'error', code: 1002 }]);
    // Only the header and the mask arrive: the bound is decided before any payload is buffered.
    const textHeader = encodeClientFrame(OPCODE.TEXT, Buffer.alloc(MAX_TEXT_FRAME_BYTES + 1)).subarray(0, 8);
    expect(new FrameParser().push(textHeader)).toEqual([{ kind: 'error', code: 1009 }]);
    const binaryHeader = encodeClientFrame(OPCODE.BINARY, Buffer.alloc(MAX_BINARY_FRAME_BYTES + 1)).subarray(0, 8);
    expect(new FrameParser().push(binaryHeader)).toEqual([{ kind: 'error', code: 1009 }]);
    // A 64-bit length with its high word set (petabytes announced) is refused at once.
    const huge = Buffer.from([0x80 | OPCODE.BINARY, 0x80 | 127, 0, 0, 0, 1, 0, 0, 0, 0]);
    expect(new FrameParser().push(huge)).toEqual([{ kind: 'error', code: 1009 }]);
    // At the bound exactly, the frame is accepted.
    expect(new FrameParser().push(encodeClientFrame(OPCODE.TEXT, Buffer.alloc(MAX_TEXT_FRAME_BYTES, 0x20)))[0]).toMatchObject({ kind: 'text' });
  });

  it('refuses text that is not valid UTF-8 (1007)', () => {
    expect(new FrameParser().push(encodeClientFrame(OPCODE.TEXT, Buffer.from([0x7b, 0xc3, 0x28, 0x7d])))).toEqual([{ kind: 'error', code: 1007 }]);
  });

  it('parses nothing after an error or a close, and reads the close code', () => {
    const afterError = new FrameParser();
    expect(afterError.push(Buffer.concat([encodeFrame(OPCODE.TEXT, Buffer.from('x')), encodeClientFrame(OPCODE.TEXT, Buffer.from('y'))])))
      .toEqual([{ kind: 'error', code: 1002 }]);
    expect(afterError.push(encodeClientFrame(OPCODE.TEXT, Buffer.from('z')))).toEqual([]);
    const closing = new FrameParser();
    const close = encodeClientFrame(OPCODE.CLOSE, Buffer.from(encodeClose(1000, 'bye').subarray(2)));
    expect(closing.push(Buffer.concat([close, encodeClientFrame(OPCODE.TEXT, Buffer.from('late'))]))).toEqual([{ kind: 'close', code: 1000 }]);
    expect(closing.push(encodeClientFrame(OPCODE.TEXT, Buffer.from('later')))).toEqual([]);
    expect(new FrameParser().push(encodeClientFrame(OPCODE.CLOSE, Buffer.alloc(0)))).toEqual([{ kind: 'close', code: null }]);
  });

  it('frames server messages unmasked with the minimal length encoding', () => {
    expect([...encodeFrame(OPCODE.TEXT, Buffer.from('hi')).subarray(0, 2)]).toEqual([0x81, 2]);
    expect([...encodeFrame(OPCODE.BINARY, Buffer.alloc(200)).subarray(0, 4)]).toEqual([0x82, 126, 0, 200]);
    expect([...encodeFrame(OPCODE.BINARY, Buffer.alloc(70_000)).subarray(0, 2)]).toEqual([0x82, 127]);
    expect(encodeClose(4003, 'FENCED').subarray(2, 4).readUInt16BE(0)).toBe(4003);
  });
});
