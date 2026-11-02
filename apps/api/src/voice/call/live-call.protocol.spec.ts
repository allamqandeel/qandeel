import { acceptKey, encodeClientFrame, encodeFrame, FrameParser, OPCODE } from './gateway/websocket-frames';
import {
  CLIENT_MESSAGES, decodeAudioFrame, decodeReplyAudioFrame, encodeAudioFrame, encodeReplyAudioFrame, FRAME_HEADER_BYTES, MAX_BINARY_FRAME_BYTES,
  MAX_OPUS_PACKET_BYTES, MAX_TEXT_FRAME_BYTES, NOT_YET_SUPPORTED, parseClientMessage, SERVER_MESSAGES,
} from './live-call.protocol';

const U = '00000000-0000-4000-8000-000000000001';
const S = '00000000-0000-4000-8000-000000000002';
const I = '00000000-0000-4000-8000-000000000003';

describe('S8B-05 CP1 protocol v1 (frozen)', () => {
  it('names exactly the frozen client and server messages; CP2-CP4 shapes are parsed but never supported yet', () => {
    expect([...CLIENT_MESSAGES]).toEqual(['HELLO', 'AUDIO', 'PLAYOUT', 'BARGE_IN', 'TEXT_TURN', 'MUTE', 'UNMUTE', 'TOKEN_REFRESH', 'HEARTBEAT', 'END']);
    expect([...SERVER_MESSAGES]).toEqual(['STATE', 'TURN_COMMITTED', 'REPLY_AUDIO', 'REPLY_END', 'REFUSED', 'CALL_ENDING', 'ACK']);
    expect([...NOT_YET_SUPPORTED].sort()).toEqual(['BARGE_IN', 'PLAYOUT', 'TEXT_TURN']);
  });

  it('parses each text message only in its exact shape', () => {
    const ok = [
      { type: 'HELLO', v: 1, callId: U, sessionId: S, clientInstanceId: I, resume: false },
      { type: 'HEARTBEAT', n: 7 },
      { type: 'MUTE', msgId: 1, captureMs: 400 },
      { type: 'UNMUTE', msgId: 2, captureMs: 1000 },
      { type: 'TOKEN_REFRESH', msgId: 3, accessToken: 'a.b.c' },
      { type: 'END', msgId: 4 },
      { type: 'PLAYOUT', msgId: 5, callTurnIndex: 0, chunkSeq: 0, playedMs: 20 },
      { type: 'BARGE_IN', msgId: 6, callTurnIndex: 0, captureMs: 20 },
      { type: 'TEXT_TURN', msgId: 7, clientTurnId: U, text: 'مرحبا' },
    ];
    for (const message of ok) expect(parseClientMessage(JSON.stringify(message))).toEqual(message);
    const bad = [
      'not json', '[]', 'null', '{"type":"AUDIO"}', '{"type":"STATE"}',
      JSON.stringify({ type: 'HELLO', v: 2, callId: U, sessionId: S, clientInstanceId: I, resume: false }),
      JSON.stringify({ type: 'HELLO', v: 1, callId: 'x', sessionId: S, clientInstanceId: I, resume: false }),
      JSON.stringify({ type: 'HELLO', v: 1, callId: U, sessionId: S, clientInstanceId: I, resume: false, extra: 1 }),
      JSON.stringify({ type: 'MUTE', msgId: 1, captureMs: 15 }),
      JSON.stringify({ type: 'MUTE', msgId: -1, captureMs: 20 }),
      JSON.stringify({ type: 'END', msgId: 1.5 }),
      JSON.stringify({ type: 'TOKEN_REFRESH', msgId: 1, accessToken: 'has space' }),
      JSON.stringify({ type: 'TEXT_TURN', msgId: 1, clientTurnId: U, text: '   ' }),
      'x'.repeat(MAX_TEXT_FRAME_BYTES + 1),
    ];
    for (const text of bad) expect(parseClientMessage(text)).toBeNull();
  });

  it('frames AUDIO and REPLY_AUDIO in the 20-byte header, exactly', () => {
    const packet = Buffer.from([0x48, 1, 2, 3]);
    const audio = encodeAudioFrame({ epoch: 3, seq: 9, captureMs: 180, packet });
    expect(audio.length).toBe(FRAME_HEADER_BYTES + 4);
    expect([...audio.subarray(0, 4)]).toEqual([0x01, 1, 0, 0]);
    expect(audio.readUInt32BE(4)).toBe(3);
    expect(audio.readUInt32BE(8)).toBe(9);
    expect(audio.readUInt32BE(12)).toBe(180);
    expect(audio.readUInt32BE(16)).toBe(0);
    expect(decodeAudioFrame(audio)).toEqual({ epoch: 3, seq: 9, captureMs: 180, packet });
    const reply = encodeReplyAudioFrame({ epoch: 3, callTurnIndex: 2, chunkSeq: 5, offsetMs: 100, packet });
    expect(reply[0]).toBe(0x02);
    expect(decodeReplyAudioFrame(reply)).toEqual({ epoch: 3, callTurnIndex: 2, chunkSeq: 5, offsetMs: 100, packet });
    expect(decodeAudioFrame(reply)).toBeNull();
  });

  it('refuses a malformed AUDIO frame (kind, version, flags, reserved, clock, size)', () => {
    const good = encodeAudioFrame({ epoch: 1, seq: 0, captureMs: 0, packet: Buffer.from([0x48, 0]) });
    const mutate = (at: number, value: number) => {
      const copy = Buffer.from(good);
      copy[at] = value;
      return copy;
    };
    expect(decodeAudioFrame(mutate(1, 2))).toBeNull();
    expect(decodeAudioFrame(mutate(2, 1))).toBeNull();
    expect(decodeAudioFrame(mutate(19, 1))).toBeNull();
    expect(decodeAudioFrame(mutate(15, 7))).toBeNull(); // captureMs not a multiple of 20
    expect(decodeAudioFrame(good.subarray(0, FRAME_HEADER_BYTES))).toBeNull();
    expect(decodeAudioFrame(Buffer.alloc(MAX_BINARY_FRAME_BYTES + 1, 0))).toBeNull();
    expect(() => encodeAudioFrame({ epoch: 1, seq: 0, captureMs: 0, packet: Buffer.alloc(MAX_OPUS_PACKET_BYTES + 1) })).toThrow();
  });
});

describe('S8B-05 CP1 RFC 6455 frames (server side)', () => {
  it('computes the RFC 6455 accept key and refuses a malformed key', () => {
    expect(acceptKey('dGhlIHNhbXBsZSBub25jZQ==')).toBe('s3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
    expect(acceptKey('short')).toBeNull();
    expect(acceptKey(undefined)).toBeNull();
  });

  it('parses masked text, binary, ping and close frames split across chunks', () => {
    const parser = new FrameParser();
    const bytes = Buffer.concat([
      encodeClientFrame(OPCODE.TEXT, Buffer.from('{"type":"HEARTBEAT","n":1}')),
      encodeClientFrame(OPCODE.BINARY, Buffer.alloc(300, 7)),
      encodeClientFrame(OPCODE.PING, Buffer.from('p')),
      encodeClientFrame(OPCODE.CLOSE, Buffer.from([0x03, 0xe8])),
    ]);
    const events = [];
    for (let i = 0; i < bytes.length; i += 7) events.push(...parser.push(bytes.subarray(i, i + 7)));
    expect(events.map((e) => e.kind)).toEqual(['text', 'binary', 'ping', 'close']);
    expect(events[0]).toEqual({ kind: 'text', text: '{"type":"HEARTBEAT","n":1}' });
    expect((events[1] as { data: Buffer }).data.equals(Buffer.alloc(300, 7))).toBe(true);
    expect(events[3]).toEqual({ kind: 'close', code: 1000 });
    expect(parser.push(encodeClientFrame(OPCODE.TEXT, Buffer.from('late')))).toEqual([]);
  });

  it('refuses unmasked, fragmented, reserved-bit, unknown-opcode, oversize and non-UTF-8 frames', () => {
    const one = (frame: Buffer) => new FrameParser().push(frame);
    expect(one(encodeFrame(OPCODE.TEXT, Buffer.from('x')))).toEqual([{ kind: 'error', code: 1002 }]); // unmasked
    const fragment = encodeClientFrame(OPCODE.TEXT, Buffer.from('x'));
    fragment[0] = fragment[0]! & 0x7f;
    expect(one(fragment)).toEqual([{ kind: 'error', code: 1002 }]);
    const rsv = encodeClientFrame(OPCODE.TEXT, Buffer.from('x'));
    rsv[0] = rsv[0]! | 0x40;
    expect(one(rsv)).toEqual([{ kind: 'error', code: 1002 }]);
    expect(one(encodeClientFrame(0x3, Buffer.from('x')))).toEqual([{ kind: 'error', code: 1002 }]);
    expect(one(encodeClientFrame(OPCODE.TEXT, Buffer.alloc(MAX_TEXT_FRAME_BYTES + 1, 0x61)))).toEqual([{ kind: 'error', code: 1009 }]);
    expect(one(encodeClientFrame(OPCODE.BINARY, Buffer.alloc(MAX_BINARY_FRAME_BYTES + 1)))).toEqual([{ kind: 'error', code: 1009 }]);
    expect(one(encodeClientFrame(OPCODE.TEXT, Buffer.from([0xff, 0xfe])))).toEqual([{ kind: 'error', code: 1007 }]);
  });

  it('bounds a declared length before buffering the payload', () => {
    const header = Buffer.from([0x82, 0x80 | 127, 0, 0, 0, 0, 0x7f, 0xff, 0xff, 0xff]);
    expect(new FrameParser().push(header)).toEqual([{ kind: 'error', code: 1009 }]);
  });
});
