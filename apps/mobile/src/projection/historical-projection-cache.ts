/**
 * T-03C — the Class-B holder of fetched disclosures.
 *
 * `K(TC)` and `V` are Class B (Stage 6.5 v3 §9–§11): derived, re-fetchable,
 * never a key of the T-02 `CanonicalState`, never persisted, never an RH entry.
 * This holder keeps what the transport has already delivered so a reader can
 * distinguish, exactly as the frozen three-state contract demands:
 *
 *   NOT_FETCHED   — the client has not (yet) obtained V for (Session, TC, depth);
 *                   it says NOTHING about history;
 *   FETCHED       — V as the server disclosed it; an identity absent from a
 *                   DISCLOSED rung is UNKNOWN_AT_TC, a rung that is
 *                   DEPTH_WITHHELD is withheld, never unknown;
 *   UNAVAILABLE   — the server refused with a typed code (a LEGACY UNCOVERED
 *                   SESSION, no Live Head yet, a technical gap, an
 *                   unaddressable TC, a Session not visible); never UNKNOWN_AT_TC.
 *
 * Sealed disclosures (`tc < liveHead` at fetch time) are stable forever and are
 * never invalidated. An open-head disclosure (`tc === liveHead`) legitimately
 * evolves while TC stays the Live Head: it is invalidated when a newer
 * revision or a greater Live Head of the same Session is observed. Nothing here
 * reads the wall clock, polls, or writes canonical state.
 */
import type { HistoricalDisclosure, HistoricalProjectionUnavailableCode, HistoricalRevision, HistoricalSemanticDepth } from '@qandeel/runtime';

export type HistoricalDisclosureEntry =
  | { readonly status: 'NOT_FETCHED' }
  | { readonly status: 'FETCHED'; readonly value: HistoricalDisclosure; readonly sealed: boolean }
  | { readonly status: 'UNAVAILABLE'; readonly code: HistoricalProjectionUnavailableCode };

const keyOf = (sessionId: string, tc: number, depth: HistoricalSemanticDepth): string => [sessionId, String(tc), depth].join(' ');
const belongsTo = (key: string, sessionId: string): boolean => key.startsWith(sessionId + ' ');

const revisionEquals = (a: HistoricalRevision, b: HistoricalRevision): boolean =>
  a.liveHead === b.liveHead && a.worldVersion === b.worldVersion && a.pendingExpiries === b.pendingExpiries;

export class HistoricalDisclosureCache {
  private readonly entries = new Map<string, HistoricalDisclosureEntry>();
  private readonly revisions = new Map<string, HistoricalRevision>();

  /** What the client holds for (Session, TC, depth). NOT_FETCHED is the absence of a fetch, not the absence of history. */
  lookup(sessionId: string, tc: number, depth: HistoricalSemanticDepth): HistoricalDisclosureEntry {
    return this.entries.get(keyOf(sessionId, tc, depth)) ?? { status: 'NOT_FETCHED' };
  }

  /** Observes the delivered revision for the Session (dropping older open-head disclosures), then holds the disclosure. */
  hold(value: HistoricalDisclosure): void {
    this.observeRevision(value.sessionId, value.revision);
    this.entries.set(keyOf(value.sessionId, value.tc, value.depth), Object.freeze({ status: 'FETCHED', value, sealed: value.sealed }));
  }

  /** Holds a typed refusal so a reader never mistakes "refused" for "unknown" or "not fetched". */
  holdUnavailable(sessionId: string, tc: number, depth: HistoricalSemanticDepth, code: HistoricalProjectionUnavailableCode): void {
    this.entries.set(keyOf(sessionId, tc, depth), Object.freeze({ status: 'UNAVAILABLE', code }));
  }

  /**
   * A newer authoritative revision (or a greater Live Head) of a Session makes
   * every held open-head disclosure of that Session stale; sealed disclosures
   * stay. Typed refusals that depend on the Live Head are cleared as well, so
   * a Session that has just gained its first Moment can be fetched again. The
   * first observation of a Session invalidates no disclosure; an older
   * revision never rewinds what was observed.
   */
  observeRevision(sessionId: string, revision: HistoricalRevision): void {
    const known = this.revisions.get(sessionId);
    if (known && revisionEquals(known, revision)) return;
    if (known && (revision.liveHead < known.liveHead || revision.worldVersion < known.worldVersion)) return;
    this.revisions.set(sessionId, revision);
    for (const [key, entry] of this.entries) {
      if (!belongsTo(key, sessionId)) continue;
      if (known && entry.status === 'FETCHED' && !entry.sealed) this.entries.delete(key);
      if (entry.status === 'UNAVAILABLE' && (entry.code === 'LIVE_HEAD_NOT_ESTABLISHED' || entry.code === 'SESSION_POSITION_NOT_ADDRESSABLE')) this.entries.delete(key);
    }
  }

  /** The Live Head the cache last observed for a Session, or null when it observed nothing. */
  observedLiveHead(sessionId: string): number | null {
    return this.revisions.get(sessionId)?.liveHead ?? null;
  }

  forgetSession(sessionId: string): void {
    for (const key of [...this.entries.keys()]) if (belongsTo(key, sessionId)) this.entries.delete(key);
    this.revisions.delete(sessionId);
  }
}
