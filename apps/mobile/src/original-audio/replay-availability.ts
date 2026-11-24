/**
 * RB-2 / S3 (the Product Owner's "RB-2 / M-2 + S3 PRODUCTION IMPLEMENTATION" authorization, 2026-11-24, CP5) — the
 * phone's typed reading of the Replay Media Service's availability answer: WHEN each moment's analysis may appear, as the
 * database placed it (migration 0202) and the service translated it into the playback map. Pure: no request, no clock, no
 * storage, no repair. A decoder and nothing else; RB-2 / S4 adds the binding the phone checks before using it (the map
 * digest by the server's serialization, the revision, the source windows and watermark pinned across answers) —
 * fetching it is `replay-availability-source.ts`, consuming it the Replay timeline's.
 *
 * The answer is refused WHOLE (null: every moment stays UNRECORDED) unless it is exactly well formed AND bound to what the
 * player holds: the same Replay, the same version, and every in-recording placement inside a run of the map it plays
 * (runIndex < runs.length, fileMs ≤ that run's duration). A revision, a re-derived map or another version is never
 * reused: its identity differs, and the caller compares the revision and the digests it holds.
 *
 *   IN_RECORDING  { runIndex, fileMs }   the first presented instant at or after the certified capture position
 *   AFTER_END                            no certified position inside the presented recordings: after the whole Replay
 *   UNRECORDED                           UNESTABLISHED, BROKEN or ORDINAL_ONLY: no time is claimed, never a guess
 */
import { sha256Hex } from '../voice-note/sha256';
import type { PresentationBoundary, PresentationRun, PresentationSpan } from './presentation-map';

export type ReplayAvailabilityState ='RECORDED' | 'UNESTABLISHED' | 'BROKEN' | 'ORDINAL_ONLY';

export type ReplayMomentAvailability =
  | { readonly kind: 'IN_RECORDING'; readonly runIndex: number; readonly fileMs: number }
  | { readonly kind: 'AFTER_END' }
  | { readonly kind: 'UNRECORDED'; readonly state: Exclude<ReplayAvailabilityState, 'RECORDED'> };

export interface ReplayAvailabilityBinding {
  readonly replayId: string;
  readonly versionId: string;
  readonly revision: number;
  readonly sourceWindowBindingDigest: string | null;
  readonly mapDigest: string | null;
  readonly ledgerWatermark: { readonly sp: number; readonly seq: number } | null;
}

export interface ReplayAvailability {
  readonly binding: ReplayAvailabilityBinding;
  /** selected ordinal → its availability; an ordinal the answer does not name is UNRECORDED for the caller. */
  readonly moments: ReadonlyMap<number, ReplayMomentAvailability>;
}

/** What the player holds: the version it plays and the runs of the map it decoded for it (none for a V1 version). */
export interface ReplayAvailabilityExpectation {
  readonly replayId: string;
  readonly versionId: string;
  readonly runs: ReadonlyArray<{ readonly durationMs: number }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const STATES: readonly string[] = ['RECORDED', 'UNESTABLISHED', 'BROKEN', 'ORDINAL_ONLY'];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
};
const digestOrNull = (value: unknown): value is string | null => value === null || (typeof value === 'string' && DIGEST.test(value));
const sameId = (value: unknown, expected: string): boolean => typeof value === 'string' && UUID.test(value) && value.toLowerCase() === expected.toLowerCase();

function decodePlacement(value: unknown, runs: ReplayAvailabilityExpectation['runs']): ReplayMomentAvailability | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'AFTER_END') return hasExactly(value, ['kind']) ? { kind: 'AFTER_END' } : null;
  if (value.kind !== 'IN_RECORDING' || !hasExactly(value, ['kind', 'runIndex', 'fileMs'])) return null;
  const { runIndex, fileMs } = value;
  if (!isCount(runIndex) || !isCount(fileMs)) return null;
  const run = runs[runIndex];
  if (run === undefined || fileMs > run.durationMs) return null;
  return { kind: 'IN_RECORDING', runIndex, fileMs };
}

/** The availability answer, bound to what the player holds, or null: refused whole, never repaired. */
export function decodeReplayAvailability(body: unknown, expected: ReplayAvailabilityExpectation): ReplayAvailability | null {
  if (!isRecord(body) || !hasExactly(body, ['replayId', 'versionId', 'revision', 'sourceWindowBindingDigest', 'mapDigest', 'ledgerWatermark', 'moments'])) {
    return null;
  }
  if (!sameId(body.replayId, expected.replayId) || !sameId(body.versionId, expected.versionId)) return null;
  if (!isCount(body.revision) || body.revision < 1 || !digestOrNull(body.sourceWindowBindingDigest) || !digestOrNull(body.mapDigest)) return null;
  let ledgerWatermark: ReplayAvailabilityBinding['ledgerWatermark'] = null;
  if (body.ledgerWatermark !== null) {
    const w = body.ledgerWatermark;
    if (!isRecord(w) || !hasExactly(w, ['sp', 'seq']) || !isCount(w.sp) || w.sp < 1 || !isCount(w.seq)) return null;
    ledgerWatermark = { sp: w.sp, seq: w.seq };
  }
  if (!Array.isArray(body.moments) || body.moments.length === 0) return null;
  const moments = new Map<number, ReplayMomentAvailability>();
  let recorded = false;
  for (const m of body.moments) {
    if (!isRecord(m) || !hasExactly(m, ['ordinal', 'state', 'placement'])) return null;
    const { ordinal, state, placement } = m;
    if (!isCount(ordinal) || ordinal < 1 || moments.has(ordinal) || typeof state !== 'string' || !STATES.includes(state)) return null;
    if (state === 'RECORDED') {
      const decoded = decodePlacement(placement, expected.runs);
      if (decoded === null) return null;
      moments.set(ordinal, decoded);
      recorded = true;
    } else {
      if (placement !== null) return null;
      moments.set(ordinal, { kind: 'UNRECORDED', state: state as Exclude<ReplayAvailabilityState, 'RECORDED'> });
    }
  }
  // A RECORDED answer is placed in a map: it names that map and the ledger it was read at.
  if (recorded && (body.mapDigest === null || ledgerWatermark === null)) return null;
  return {
    binding: {
      replayId: expected.replayId, versionId: expected.versionId, revision: body.revision,
      sourceWindowBindingDigest: body.sourceWindowBindingDigest, mapDigest: body.mapDigest, ledgerWatermark,
    },
    moments,
  };
}

/**
 * RB-2 / S4: the digest of the presentation map the player holds, by the SERVER's reference serialization
 * (`presentationMapDigest`, apps/api/src/replay-media/transient-presentation-map.ts): JSON of { runs: [{ durationMs,
 * spans }], boundaries } with every object's keys in the order the server builds them, then SHA-256 over its bytes. Built
 * here field by field in that order, never from the decoded objects' own key order, so a decoder change cannot move it.
 * The map is numbers and bounded words only (printable ASCII); anything else refuses (null), never a guessed encoding.
 */
export function presentationMapDigest(runs: readonly PresentationRun[], boundaries: readonly PresentationBoundary[]): string | null {
  const span = (s: PresentationSpan) => {
    switch (s.kind) {
      case 'WINDOW': return { kind: s.kind, fromMs: s.fromMs, toMs: s.toMs, track: s.track, momentOrdinal: s.momentOrdinal };
      case 'MIX': return { kind: s.kind, fromMs: s.fromMs, toMs: s.toMs };
      case 'GAP': return { kind: s.kind, fromMs: s.fromMs, toMs: s.toMs, track: s.track, gapKind: s.gapKind };
      case 'HELD': return { kind: s.kind, fromMs: s.fromMs, toMs: s.toMs, elapsedMs: s.elapsedMs, shortened: s.shortened };
    }
  };
  const boundary = (b: PresentationBoundary) => (b.kind === 'SAME_RECORDING' ? { kind: b.kind, elapsedMs: b.elapsedMs, shortened: b.shortened } : { kind: b.kind });
  const canonical = JSON.stringify({ runs: runs.map((r) => ({ durationMs: r.durationMs, spans: r.spans.map(span) })), boundaries: boundaries.map(boundary) });
  const bytes = new Uint8Array(canonical.length);
  for (let i = 0; i < canonical.length; i += 1) {
    const code = canonical.charCodeAt(i);
    if (code > 0x7e || code < 0x20) return null;
    bytes[i] = code;
  }
  return `sha256:${sha256Hex(bytes)}`;
}

/** What the phone holds when it binds an answer: the version's revision, its map's digest, and the previous bound answer. */
export interface ReplayAvailabilityHeld {
  readonly revision: number;
  readonly mapDigest: string;
  /** Every ordinal of the version: the answer must name exactly these. */
  readonly ordinals: readonly number[];
  /** The answer bound before for this version in this session, if any (pins its source windows and its watermark). */
  readonly previous: ReplayAvailabilityBinding | null;
}

export type ReplayAvailabilityBindingRefusal =
  | 'REVISION_MISMATCH' | 'MAP_DIGEST_MISMATCH' | 'SOURCE_WINDOWS_UNBOUND' | 'SOURCE_WINDOWS_CHANGED'
  | 'WATERMARK_REGRESSED' | 'MOMENTS_MISMATCH';

const watermarkBefore = (a: { sp: number; seq: number }, b: { sp: number; seq: number }): boolean => a.sp < b.sp || (a.sp === b.sp && a.seq < b.seq);

/**
 * RB-2 / S4: a decoded answer is used only when it is bound to exactly what the player presents (contract v1.1 §6.2, §8):
 * the revision of the version the player holds; the same map, by the server's own digest of it; source windows named (a
 * V2 answer always carries them) and the same as any answer bound before in this session; a ledger watermark never lower
 * than one bound before; exactly the version's moments. Anything else refuses the WHOLE answer — the caller shows the
 * neutral stage, never a partial or a previous answer. The phone holds no independent copy of the source-window digest
 * (the history wire carries none): it is pinned across answers here, and its equality with the version's is the
 * server's guarantee (0202 binds every row to it) — the remaining gap, recorded in the RB-2 / S4 record.
 */
export function bindReplayAvailability(
  answer: ReplayAvailability,
  held: ReplayAvailabilityHeld,
): { readonly ok: true } | { readonly ok: false; readonly reason: ReplayAvailabilityBindingRefusal } {
  const b = answer.binding;
  if (b.revision !== held.revision) return { ok: false, reason: 'REVISION_MISMATCH' };
  if (b.mapDigest !== held.mapDigest) return { ok: false, reason: 'MAP_DIGEST_MISMATCH' };
  if (b.sourceWindowBindingDigest === null) return { ok: false, reason: 'SOURCE_WINDOWS_UNBOUND' };
  const before = held.previous;
  if (before !== null) {
    if (before.sourceWindowBindingDigest !== b.sourceWindowBindingDigest) return { ok: false, reason: 'SOURCE_WINDOWS_CHANGED' };
    if (before.ledgerWatermark !== null && (b.ledgerWatermark === null || watermarkBefore(b.ledgerWatermark, before.ledgerWatermark))) {
      return { ok: false, reason: 'WATERMARK_REGRESSED' };
    }
  }
  if (answer.moments.size !== held.ordinals.length || held.ordinals.some((o) => !answer.moments.has(o))) return { ok: false, reason: 'MOMENTS_MISMATCH' };
  return { ok: true };
}

/** One moment's availability from a decoded answer (or none): never a time the answer did not establish. */
export function momentAvailability(answer: ReplayAvailability | null, ordinal: number): ReplayMomentAvailability {
  return answer?.moments.get(ordinal) ?? { kind: 'UNRECORDED', state: 'UNESTABLISHED' };
}
