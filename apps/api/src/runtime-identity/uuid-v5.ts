// Neutral RFC 4122 / RFC 9562 name-based UUID (version 5) helper.
//
// Extracted from the T-03A2 deterministic identity module in T-03B1b1 so that
// the conversational-focus canonicalizer can derive stable reference handle
// and Emerging Focus identities with the EXACT same algorithm without
// importing anything from the T-03A1/A2 substrate directory (the T-03B1a
// boundary allows only the pure anchor helper from there). The algorithm is
// byte for byte the one T-03A2 shipped: SHA-1 over the namespace UUID's 16
// bytes followed by the UTF-8 name, with the version and variant bits stamped
// as the RFC prescribes. Every T-03A2 identity vector is preserved and pinned
// by the T-03A2 identity spec.
//
// SHA-1 is used strictly as the RFC's identifier-derivation function over
// non-secret identifiers; it carries no security claim. Node's built-in
// `crypto` is the only dependency.

import { createHash } from 'node:crypto';

/** RFC 4122 appendix C URL namespace. Domain namespaces are derived from it and a documented URI. */
export const RFC4122_URL_NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

/** Canonical lowercase UUID shape, RFC versions 1-5 with the RFC variant. */
export const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function uuidToBytes(value: string): Buffer {
  return Buffer.from(value.replace(/-/gu, ''), 'hex');
}

function bytesToUuid(bytes: Buffer): string {
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** RFC 4122 §4.3 name-based UUID, version 5 (SHA-1). Deterministic for a given namespace and name. */
export function uuidV5(namespace: string, name: string): string {
  const digest = createHash('sha1').update(uuidToBytes(namespace)).update(Buffer.from(name, 'utf8')).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytesToUuid(bytes);
}
