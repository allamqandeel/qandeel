import { muxOggOpus, oggCrc32, readOggOpus } from './ogg-opus';
import { synthPcm } from '../testing/synthetic-voice';
import { DOWNLINK_OPUS, isUplinkPacket, OpusPacketDecoder, OpusPacketEncoder, opusPacketSamples48k, opusPacketShape, UPLINK_OPUS } from './opus-codec';

function encodeAll(rate: 16_000 | 24_000, bitrate: number, frames: number): Buffer[] {
  const encoder = new OpusPacketEncoder(rate, bitrate);
  try {
    return synthPcm(rate, frames).map((pcm) => encoder.encode(pcm));
  } finally {
    encoder.close();
  }
}

describe('S8B-05 CP1 the Opus codec (D-C1), real libopus packets', () => {
  it('encodes the uplink as mono 20 ms packets at about 24 kbps and decodes them to PCM s16le 16 kHz', () => {
    const packets = encodeAll(UPLINK_OPUS.rate, UPLINK_OPUS.bitrate, 100);
    expect(packets.every(isUplinkPacket)).toBe(true);
    const bytes = packets.reduce((n, p) => n + p.length, 0);
    const kbps = (bytes * 8) / 2 / 1000;
    expect(kbps).toBeGreaterThan(10);
    expect(kbps).toBeLessThan(40);
    const decoder = new OpusPacketDecoder(16_000);
    try {
      const pcm = packets.map((p) => decoder.decode(p));
      expect(pcm.every((b) => b.length === 320 * 2)).toBe(true);
      const energy = Buffer.concat(pcm.slice(10)).reduce((acc, _v, i, all) => (i % 2 === 0 ? acc + Math.abs(all.readInt16LE(i)) : acc), 0);
      expect(energy).toBeGreaterThan(0);
    } finally {
      decoder.close();
    }
  });

  it('encodes the downlink at 24 kHz 20 ms (the same codec, the other direction)', () => {
    const packets = encodeAll(DOWNLINK_OPUS.rate, DOWNLINK_OPUS.bitrate, 10);
    expect(packets.every((p) => opusPacketShape(p)?.durationTenthsMs === 200 && opusPacketShape(p)?.channels === 1)).toBe(true);
    const decoder = new OpusPacketDecoder(24_000);
    try {
      expect(decoder.decode(packets[0]!).length).toBe(480 * 2);
    } finally {
      decoder.close();
    }
  });

  it('reads the TOC: frame durations, stereo, code 3 counts; refuses a malformed header', () => {
    expect(opusPacketShape(Buffer.from([0x08]))).toEqual({ channels: 1, frames: 1, durationTenthsMs: 200 }); // SILK NB 20 ms
    expect(opusPacketShape(Buffer.from([0x0c]))?.channels).toBe(2);
    expect(opusPacketShape(Buffer.from([0x01]))?.durationTenthsMs).toBe(200); // SILK NB 10 ms x2
    expect(opusPacketShape(Buffer.from([0xfb, 0x03]))?.durationTenthsMs).toBe(600); // CELT FB 20 ms, code 3, 3 frames
    expect(opusPacketShape(Buffer.from([0x03]))).toBeNull();
    expect(opusPacketShape(Buffer.from([0x03, 0x00]))).toBeNull();
    expect(isUplinkPacket(Buffer.from([0x00]))).toBe(false); // 10 ms
    expect(isUplinkPacket(Buffer.from([0x0c]))).toBe(false); // stereo
    expect(opusPacketSamples48k(Buffer.from([0x08]))).toBe(960);
  });

  it('refuses work after close and refuses a wrong frame size', () => {
    const encoder = new OpusPacketEncoder(16_000, 24_000);
    expect(() => encoder.encode(Buffer.alloc(100))).toThrow('OPUS_FRAME_SIZE');
    encoder.close();
    expect(() => encoder.encode(Buffer.alloc(640))).toThrow('OPUS_CODEC_CLOSED');
  });
});

describe('S8B-05 CP1 Ogg Opus segments (RFC 3533 / RFC 7845)', () => {
  it('muxes packets into a valid standalone file that reads back byte-identical with honest granules', () => {
    const packets = encodeAll(16_000, 24_000, 500); // 10 s
    const file = muxOggOpus(packets, { serial: 7, inputRate: 16_000 });
    const read = readOggOpus(file);
    expect(read.channels).toBe(1);
    expect(read.preSkip).toBe(0);
    expect(read.inputRate).toBe(16_000);
    expect(read.vendor).toBe('qandeel-live-call-v1');
    expect(read.packets.length).toBe(500);
    expect(read.packets.every((p, i) => p.equals(packets[i]!))).toBe(true);
    expect(read.finalGranule).toBe(500n * 960n);
    const decoder = new OpusPacketDecoder(16_000);
    try {
      const samples = read.packets.reduce((n, p) => n + decoder.decode(p).length / 2, 0);
      expect(samples).toBe(10 * 16_000); // the decoded length equals the clock range
    } finally {
      decoder.close();
    }
  });

  it('laces packets of 255 and 510 bytes with a terminating zero, and survives many pages', () => {
    const p255 = Buffer.concat([Buffer.from([0x08]), Buffer.alloc(254, 7)]);
    const p510 = Buffer.concat([Buffer.from([0x08]), Buffer.alloc(509, 9)]);
    const packets = [p255, p510, Buffer.from([0x08, 1, 2])];
    const read = readOggOpus(muxOggOpus(packets, { serial: 1, inputRate: 16_000 }));
    expect(read.packets.map((p) => p.length)).toEqual([255, 510, 3]);
    expect(read.finalGranule).toBe(3n * 960n);
  });

  it('detects corruption: a flipped byte fails the CRC, a truncated file has no EOS', () => {
    const file = muxOggOpus(encodeAll(16_000, 24_000, 60), { serial: 3, inputRate: 16_000 });
    const flipped = Buffer.from(file);
    flipped[flipped.length - 5] ^= 0xff;
    expect(() => readOggOpus(flipped)).toThrow('OGG_CRC');
    expect(() => readOggOpus(file.subarray(0, file.length - 10))).toThrow();
    expect(() => muxOggOpus([], { serial: 1, inputRate: 16_000 })).toThrow('OGG_OPUS_EMPTY');
  });

  it('uses the Ogg CRC-32 (polynomial 0x04c11db7, unreflected): the check value of "123456789"', () => {
    expect(oggCrc32(Buffer.from('123456789', 'ascii'))).toBe(0x89a1897f);
  });
});
