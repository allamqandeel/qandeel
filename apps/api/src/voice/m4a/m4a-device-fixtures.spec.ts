import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { proveM4aAudioDuration } from './m4a-audio-duration';

/**
 * S8B-03 (CP2, contract §8.2 B5) — files RECORDED BY A DEVICE, not written by the synthetic fixture writer.
 *
 * Each was recorded by the shipped capture (S8B-03's expo-audio recorder port: Android `mpeg4` / `aac`, mono, 32 000 bps,
 * 16 000 Hz) in the validation-only proof build, on the local Android 16 emulator (API 36, x86_64, google_apis) started
 * WITHOUT `-allow-host-audio`, which "zeroes out audio": digital silence, no person's voice, no room. Each was uploaded
 * through the shipped API client to the fake voice server (scripts/s8b-03/fake-voice-server.cjs). The PO's phone files
 * were proof only and are not in the repository.
 *
 * The container is exactly the S8B-03 recording format (AAC-LC, one channel, 16 kHz, about 32 kbps, moov before mdat).
 * Android's software AAC path (MPEG4Writer) gives the FIRST sample the encoder's start offset: stts = [1 × 1792] then
 * n × 1024. Contract v1.2 §4.6.2 step 4 requires every delta but the last to be 1024, so the CP1 prover refuses these
 * files AUDIO_CONTAINER_INCONSISTENT — a true device recording that the approved rule does not accept. That is the open
 * residue QAN-BL-VOICE-03 (S8B-03 record §12): this spec pins the current truth; the controlled amendment that decides
 * it flips the verdict expected here. The Product Owner's phone (HONOR) wrote 1024 throughout and its files were PROVEN.
 */
// Binary fixtures live outside src/: every file under apps/api/src is TypeScript source (the HIM authority scan).
const FIXTURES = join(__dirname, '../../../fixtures/voice-m4a');
const DEVICE_FILES = [
  { file: 'android-emulator-silence-2416ms.m4a', sha256: 'a25f043be07f0d7a8d4c982325c41c66de40446bc23aa609b37f820f6c6c223d', ms: 2416, frames: 37 },
  { file: 'android-emulator-silence-4720ms.m4a', sha256: 'ed35e50d81668fe339ca109d088710bf217c1daac6aa863c2c200f3457944fe8', ms: 4720, frames: 73 },
  { file: 'android-emulator-silence-11760ms.m4a', sha256: '3e06b8cbb05a58b9f0b70853fa88b2119b0594a19c8aba90f2e9ada40ed8cb78', ms: 11760, frames: 183 },
] as const;

interface Box {
  readonly type: string;
  readonly payload: number;
  readonly end: number;
}

/** The boxes this spec reads, found by a plain walk of the container (never the audio). */
function boxes(bytes: Buffer): Map<string, Box[]> {
  const found = new Map<string, Box[]>();
  const walk = (start: number, end: number) => {
    let at = start;
    while (at + 8 <= end) {
      let size = bytes.readUInt32BE(at);
      const type = bytes.toString('latin1', at + 4, at + 8);
      let header = 8;
      if (size === 1) {
        size = Number(bytes.readBigUInt64BE(at + 8));
        header = 16;
      } else if (size === 0) size = end - at;
      found.set(type, [...(found.get(type) ?? []), { type, payload: at + header, end: at + size }]);
      if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) walk(at + header, at + size);
      if (type === 'stsd') walk(at + header + 8, at + size);
      if (type === 'mp4a') walk(at + header + 28, at + size);
      at += size;
    }
  };
  walk(0, bytes.length);
  return found;
}
const one = (found: Map<string, Box[]>, type: string): Box => {
  const list = found.get(type) ?? [];
  if (list.length !== 1) throw new Error(`${type}: ${list.length}`);
  return list[0];
};

describe('S8B-03 device-recorded M4A fixtures (B5)', () => {
  it.each(DEVICE_FILES)('$file is the recorded file, unchanged, in the S8B-03 format', ({ file, sha256, ms, frames }) => {
    const bytes = readFileSync(join(FIXTURES, file));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha256);
    const found = boxes(bytes);
    expect([...found.keys()].slice(0, 2)).toEqual(['ftyp', 'moov']);
    const mp4a = one(found, 'mp4a');
    expect(bytes.readUInt16BE(mp4a.payload + 16)).toBe(1); // one channel
    expect(bytes.readUInt32BE(mp4a.payload + 24) >>> 16).toBe(16_000);
    // The AudioSpecificConfig (DecoderSpecificInfo, tag 0x05) names AAC-LC: audio object type 2, channel configuration 1.
    const esds = one(found, 'esds');
    const config = bytes.indexOf(0x05, esds.payload + 4);
    const asc = bytes.readUInt16BE(config + 2);
    expect(asc >> 11).toBe(2);
    expect((asc >> 3) & 0x0f).toBe(1);
    const mdhd = one(found, 'mdhd');
    expect(bytes[mdhd.payload]).toBe(0);
    expect(bytes.readUInt32BE(mdhd.payload + 12)).toBe(16_000);
    const stts = one(found, 'stts');
    expect(bytes.readUInt32BE(stts.payload + 4)).toBe(2);
    expect([bytes.readUInt32BE(stts.payload + 8), bytes.readUInt32BE(stts.payload + 12)]).toEqual([1, 1792]);
    expect([bytes.readUInt32BE(stts.payload + 16), bytes.readUInt32BE(stts.payload + 20)]).toEqual([frames - 1, 1024]);
    const ticks = 1792 + (frames - 1) * 1024;
    expect(bytes.readUInt32BE(mdhd.payload + 16)).toBe(ticks);
    expect(Math.round((ticks * 1000) / 16_000)).toBe(ms);
    // About 32 kbps of audio payload.
    const mdat = one(found, 'mdat');
    const bitsPerSecond = ((mdat.end - mdat.payload) * 8 * 1000) / ms;
    expect(bitsPerSecond).toBeGreaterThan(28_000);
    expect(bitsPerSecond).toBeLessThan(36_000);
  });

  it.each(DEVICE_FILES)('$file: the CP1 prover refuses it under contract §4.6.2 step 4 (QAN-BL-VOICE-03, open)', async ({ file }) => {
    const bytes = readFileSync(join(FIXTURES, file));
    const proof = await proveM4aAudioDuration(async (offset, length) => bytes.subarray(offset, offset + length), bytes.length);
    expect(proof).toEqual({ kind: 'REJECTED', rejection: 'AUDIO_CONTAINER_INCONSISTENT' });
  });
});
