import { randomBytes } from 'node:crypto';
import { muxOggOpus, oggCrc32 } from '../voice/call/codec/ogg-opus';
import { OpusPacketEncoder } from '../voice/call/codec/opus-codec';
import { synthPcm } from '../voice/call/testing/synthetic-voice';
import { checkOggOpusPages, oggPageCrc32 } from './ogg-page-check';

// S8B-07 CP1-B — the strict container check of every call segment (contract §10), against the call writer's own files.
function segment(frames = 50): Buffer {
  const encoder = new OpusPacketEncoder(16_000, 24_000);
  try {
    return muxOggOpus(synthPcm(16_000, frames).map((pcm) => encoder.encode(pcm)), { serial: 3, inputRate: 16_000 });
  } finally {
    encoder.close();
  }
}

/** Rewrites one page's granule and re-seals its CRC (a container that starts at a non-zero timestamp). */
function withGranuleOffset(file: Buffer, offset: bigint): Buffer {
  const copy = Buffer.from(file);
  let at = 0;
  let page = 0;
  while (at < copy.length) {
    const count = copy.readUInt8(at + 26);
    const size = 27 + count + [...copy.subarray(at + 27, at + 27 + count)].reduce((a, b) => a + b, 0);
    if (page >= 2) copy.writeBigInt64LE(copy.readBigInt64LE(at + 6) + offset, at + 6);
    copy.writeUInt32LE(0, at + 22);
    copy.writeUInt32LE(oggCrc32(copy.subarray(at, at + size)), at + 22);
    at += size;
    page += 1;
  }
  return copy;
}

describe('the Replay pool\'s Ogg Opus page check', () => {
  it('its CRC is the call writer\'s CRC, byte for byte', () => {
    for (let i = 0; i < 50; i += 1) {
      const bytes = randomBytes(1 + (i * 37) % 4000);
      expect(oggPageCrc32(bytes)).toBe(oggCrc32(bytes));
    }
  });

  it('accepts the shipped writer\'s segment, and a container that starts at a non-zero timestamp (V-10)', () => {
    const file = segment();
    expect(checkOggOpusPages(file)).toBe(true);
    expect(checkOggOpusPages(withGranuleOffset(file, 48_000n * 37n))).toBe(true);
  });

  it('refuses a corrupt page, a truncated file, data after EOS, a broken sequence and a stereo head (fail-closed)', () => {
    const file = segment();
    const flipped = Buffer.from(file);
    flipped[flipped.length - 10] ^= 0x40;
    expect(checkOggOpusPages(flipped)).toBe(false);
    expect(checkOggOpusPages(file.subarray(0, file.length - 7))).toBe(false);
    expect(checkOggOpusPages(Buffer.concat([file, file.subarray(0, 40)]))).toBe(false);
    const resequenced = Buffer.from(file);
    // The second page's sequence number moved, its CRC re-sealed: still refused (a missing page).
    const firstSize = 27 + resequenced.readUInt8(26) + [...resequenced.subarray(27, 27 + resequenced.readUInt8(26))].reduce((a, b) => a + b, 0);
    resequenced.writeUInt32LE(5, firstSize + 18);
    resequenced.writeUInt32LE(0, firstSize + 22);
    const secondCount = resequenced.readUInt8(firstSize + 26);
    const secondSize = 27 + secondCount + [...resequenced.subarray(firstSize + 27, firstSize + 27 + secondCount)].reduce((a, b) => a + b, 0);
    resequenced.writeUInt32LE(oggCrc32(resequenced.subarray(firstSize, firstSize + secondSize)), firstSize + 22);
    expect(checkOggOpusPages(resequenced)).toBe(false);
    const stereo = Buffer.from(file);
    stereo[28 + stereo.readUInt8(26) - 1 + 9] = 2; // OpusHead channel count, on the first page
    stereo.writeUInt32LE(0, 22);
    stereo.writeUInt32LE(oggCrc32(stereo.subarray(0, firstSize)), 22);
    expect(checkOggOpusPages(stereo)).toBe(false);
    expect(checkOggOpusPages(Buffer.from('not an ogg file at all'))).toBe(false);
  });
});
