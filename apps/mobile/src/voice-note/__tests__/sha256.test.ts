/**
 * S8B-03 (CP2, B9) — the export's byte-for-byte check: the incremental SHA-256 equals Node's for every length around
 * the block and padding boundaries, however the bytes are chunked.
 */
import { createHash } from 'node:crypto';

import { Sha256, sha256Hex } from '../sha256';

const bytes = (length: number) => Uint8Array.from({ length }, (_, i) => (i * 131 + 7) & 0xff);
const node = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

describe('sha256', () => {
  it('matches the FIPS 180-4 vectors', () => {
    expect(sha256Hex(new Uint8Array(0))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it.each([1, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 1000, 65_537])('matches Node for %i bytes, whole and chunked', (length) => {
    const data = bytes(length);
    expect(sha256Hex(data)).toBe(node(data));
    const hash = new Sha256();
    for (let at = 0; at < data.length; at += 37) hash.update(data.subarray(at, at + 37));
    expect(hash.hex()).toBe(node(data));
  });

  it('matches Node for a ten-minute note size fed in 256 KiB chunks', () => {
    const data = bytes(2_400_123);
    const hash = new Sha256();
    for (let at = 0; at < data.length; at += 262_144) hash.update(data.subarray(at, at + 262_144));
    expect(hash.hex()).toBe(node(data));
  });

  it('refuses to be fed after its digest was taken, and answers the same digest again', () => {
    const hash = new Sha256().update(bytes(10));
    const first = hash.hex();
    expect(hash.hex()).toBe(first);
    expect(() => hash.update(bytes(1))).toThrow();
  });
});
