// T-03A2 - deterministic automatic commitment identity.
//
// The current runtime needs ONE stable automatic initial commitment identity
// per finalized source turn, so that a retry after a transport or provider
// failure addresses the same batch instead of creating a second one. That is
// TECHNICAL IDEMPOTENCY only. It is not SP, not Product temporal state, and NOT
// a one-batch-per-turn canonical constraint: the frozen grammar keeps several
// valid forward batches per source turn legal, and a later distinct batch
// simply uses a different batch id.
//
// Derivation is RFC 4122 / RFC 9562 name-based UUID version 5: SHA-1 over the
// namespace UUID's 16 bytes followed by the UTF-8 name, with the version and
// variant bits stamped exactly as the RFC prescribes. It is the real algorithm,
// not a SHA-256 digest relabelled as a v5 UUID.
//
// Why version 5 rather than a UUIDv8 custom-hash layout: migration 0064 froze
// the producer's caller-payload validation to `[1-5]` in the version nibble,
// and T-03A2 preserves that rejection contract rather than widening it, so a
// v8 identity would be refused by the database. SHA-1 is used here strictly as
// the RFC's identifier-derivation function over non-secret identifiers; it
// carries no security claim, and the canonical batch fingerprint that actually
// protects commitment identity stays DB-derived SHA-256 (migration 0064).
//
// Node's built-in `crypto` is the only dependency.

import { createHash } from 'node:crypto';

/** RFC 4122 appendix C URL namespace, used only to derive the two fixed domain namespaces below. */
const URL_NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

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

/**
 * The fixed domain/version namespaces. They are derived, not magic literals, so
 * the derivation is reproducible from the two documented domain URIs alone.
 * Changing either URI changes every derived identity, which is exactly why the
 * version is part of the URI.
 */
export const AUTOMATIC_COMMIT_BATCH_NAMESPACE = uuidV5(
  URL_NAMESPACE,
  'https://qandeel.app/runtime/conversational-unit-commit-batch/v1',
);
export const AUTOMATIC_COMMIT_UNIT_NAMESPACE = uuidV5(
  URL_NAMESPACE,
  'https://qandeel.app/runtime/conversational-unit-identity/v1',
);

/**
 * The automatic initial commitment batch identity of one finalized source turn.
 *
 * Stable across processes, retries and restarts for the same source turn, and
 * distinct for every other turn. A later, deliberately distinct batch for the
 * same turn is still representable: it simply carries a different id.
 */
export function automaticCommitBatchId(sourceTurnId: string): string {
  if (!UUID_PATTERN.test(sourceTurnId)) {
    throw new TypeError('automaticCommitBatchId requires a canonical source turn UUID.');
  }
  return uuidV5(AUTOMATIC_COMMIT_BATCH_NAMESPACE, sourceTurnId);
}

/**
 * The automatic initial identity of one proposed committed CU.
 *
 * Derived from the batch id, the unit's index inside the batch, and its
 * canonical source span, so equivalent segmentation output produces identical
 * unit identities across retries while a different boundary decision produces
 * different ones.
 */
export function automaticCommitUnitId(
  batchId: string,
  unit: { readonly index: number; readonly spanStart: number; readonly spanEnd: number },
): string {
  if (!UUID_PATTERN.test(batchId)) {
    throw new TypeError('automaticCommitUnitId requires a canonical batch UUID.');
  }
  if (!Number.isSafeInteger(unit.index) || unit.index < 0
    || !Number.isSafeInteger(unit.spanStart) || unit.spanStart < 0
    || !Number.isSafeInteger(unit.spanEnd) || unit.spanEnd <= unit.spanStart) {
    throw new TypeError('automaticCommitUnitId requires a non-negative index and a forward source span.');
  }
  return uuidV5(AUTOMATIC_COMMIT_UNIT_NAMESPACE, `${batchId}:${unit.index}:${unit.spanStart}:${unit.spanEnd}`);
}
