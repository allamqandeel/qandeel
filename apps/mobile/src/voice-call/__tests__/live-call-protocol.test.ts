import {
  decodeAudioFrame, decodeReplyAudioFrame, encodeAudioFrame, encodeClientMessage, encodeReplyAudioFrame, FRAME_HEADER_BYTES,
  isMono20msOpusPacket, isValidClientMessage, MAX_BINARY_FRAME_BYTES, parseServerMessage,
} from '../live-call-protocol';
import { decodeBase64 } from '../base64';
import { CALL_ID, packet, state } from '../__fixtures__/live-call-test-kit';

describe('S8B-06 CP1 — the phone statement of the frozen live-call protocol v1', () => {
  it('writes AUDIO with the frozen 20-byte big-endian header and reads it back', () => {
    const frame = encodeAudioFrame({ epoch: 7, seq: 0x01020304, captureMs: 40, packet: packet(9) });
    expect(frame.length).toBe(FRAME_HEADER_BYTES + 5);
    expect(Array.from(frame.subarray(0, 20))).toEqual([1, 1, 0, 0, 0, 0, 0, 7, 1, 2, 3, 4, 0, 0, 0, 40, 0, 0, 0, 0]);
    expect(decodeAudioFrame(frame)).toEqual({ epoch: 7, seq: 0x01020304, captureMs: 40, packet: packet(9) });
  });

  it('refuses a capture instant off the 20 ms grid, an empty or oversized packet', () => {
    expect(() => encodeAudioFrame({ epoch: 1, seq: 0, captureMs: 30, packet: packet(1) })).toThrow('LIVE_CALL_FRAME_INVALID');
    expect(() => encodeAudioFrame({ epoch: 1, seq: 0, captureMs: 0, packet: new Uint8Array(0) })).toThrow();
    expect(() => encodeAudioFrame({ epoch: 1, seq: 0, captureMs: 0, packet: new Uint8Array(1276) })).toThrow();
    expect(decodeAudioFrame(new Uint8Array(MAX_BINARY_FRAME_BYTES + 1))).toBeNull();
  });

  it('reads REPLY_AUDIO: epoch, call_turn_index, chunkSeq, offsetMs', () => {
    const bytes = encodeReplyAudioFrame({ epoch: 2, callTurnIndex: 5, chunkSeq: 3, offsetMs: 60, packet: packet(1) });
    expect(bytes[0]).toBe(2);
    expect(decodeReplyAudioFrame(bytes)).toEqual({ epoch: 2, callTurnIndex: 5, chunkSeq: 3, offsetMs: 60, packet: packet(1) });
    expect(decodeAudioFrame(bytes)).toBeNull();
    const wrongVersion = bytes.slice();
    wrongVersion[1] = 2;
    expect(decodeReplyAudioFrame(wrongVersion)).toBeNull();
  });

  it('writes PLAYOUT and BARGE_IN with exactly the frozen keys (no turn epoch field)', () => {
    expect(JSON.parse(encodeClientMessage({ type: 'PLAYOUT', msgId: 4, callTurnIndex: 2, chunkSeq: 9, playedMs: 200 }))).toEqual(
      { type: 'PLAYOUT', msgId: 4, callTurnIndex: 2, chunkSeq: 9, playedMs: 200 });
    expect(Object.keys(JSON.parse(encodeClientMessage({ type: 'BARGE_IN', msgId: 5, callTurnIndex: 2, captureMs: 1240 })))).toEqual(
      ['type', 'msgId', 'callTurnIndex', 'captureMs']);
    expect(isValidClientMessage({ type: 'BARGE_IN', msgId: 5, callTurnIndex: 2, captureMs: 1250 })).toBe(false);
  });

  it('parses server messages by exact keys only', () => {
    expect(parseServerMessage(JSON.stringify(state({})))).toEqual(state({}));
    expect(parseServerMessage(JSON.stringify({ ...state({}), extra: 1 }))).toBeNull();
    expect(parseServerMessage(JSON.stringify({ type: 'ACK', msgId: 3 }))).toEqual({ type: 'ACK', msgId: 3 });
    expect(parseServerMessage(JSON.stringify({ type: 'ACK' }))).toBeNull();
    expect(parseServerMessage(JSON.stringify({ type: 'REFUSED', reason: 'NOT_SUPPORTED_YET', msgId: 2 }))).not.toBeNull();
    expect(parseServerMessage(JSON.stringify({ type: 'REFUSED', reason: 'MADE_UP', msgId: 2 }))).toBeNull();
    expect(parseServerMessage(JSON.stringify({ type: 'REPLY_END', callTurnIndex: 1, chunks: 10, deliveryState: 'INTERRUPTED' }))).not.toBeNull();
    expect(parseServerMessage(JSON.stringify({ type: 'TURN_COMMITTED', callTurnIndex: 1, role: 'USER', turnId: CALL_ID, clientTurnId: null }))).not.toBeNull();
    expect(parseServerMessage('not json')).toBeNull();
  });

  it('checks the uplink TOC rule: mono, exactly 20 ms', () => {
    expect(isMono20msOpusPacket(new Uint8Array([0x48, 1]))).toBe(true); // SILK WB 20 ms, code 0
    expect(isMono20msOpusPacket(new Uint8Array([0x40, 1]))).toBe(false); // SILK WB 10 ms
    expect(isMono20msOpusPacket(new Uint8Array([0x4c, 1]))).toBe(false); // stereo
    expect(isMono20msOpusPacket(new Uint8Array([0x49, 1]))).toBe(false); // two 20 ms frames = 40 ms
    expect(isMono20msOpusPacket(new Uint8Array([0x41, 1]))).toBe(true); // two 10 ms frames = 20 ms
  });

  it('decodes base64 like the platform', () => {
    expect(Array.from(decodeBase64('SAECAw=='))).toEqual([0x48, 1, 2, 3]);
    expect(Array.from(decodeBase64(''))).toEqual([]);
    expect(() => decodeBase64('**')).toThrow('BASE64_INVALID');
  });
});
