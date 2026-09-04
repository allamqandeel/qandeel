// T-03B2b1 - the one hashing primitive of the Canonical Home Placement Engine.
// Node's built-in crypto only: no new dependency, no randomness, no clock.
//
// Every input is a canonical UTF-8 string built by the engine (decimal BigInt
// coordinates, `\t` / `\n` separated, ids restricted to a closed ASCII
// charset), so the digest is byte-for-byte identical across calls, processes,
// operating systems and CI.

import { createHash } from 'node:crypto';

/** SHA-256 of the UTF-8 encoding of `canonical`, as lowercase hex. */
export function sha256Hex(canonical: string): string {
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/** SHA-256 of the UTF-8 encoding of `canonical`, as the raw 32 bytes. */
export function sha256Bytes(canonical: string): Uint8Array {
  return new Uint8Array(createHash('sha256').update(canonical, 'utf8').digest());
}
