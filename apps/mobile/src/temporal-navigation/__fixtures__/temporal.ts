/**
 * T-06 — shared test scaffolding.
 *
 * The store is the production one, wired with the production authorities, so a test that commits
 * exercises the real per-field guard, the real `Φ_eff` no-op rule and the real RH boundary. The
 * disclosures come from T-04's own wire-legal fixture builder, so a projection used here is a
 * projection the server could actually send.
 */
import type { HistoricalDisclosure } from '@qandeel/runtime';

import { createCanonicalStore, sessionPosition, type CanonicalStore, type SemanticDepth, type TemporalMode } from '../../state';
import { MAP_ACTION_AUTHORITY, initialCameraIntent, mapInspectionContext, WORLD_ORIGIN, type MapInspectionContext } from '../../map';
import { disclosedTrack, type DisclosedTrack } from '../../timeline';
import { TEMPORAL_ACTION_AUTHORITY, temporalTargeting, type TemporalTargeting } from '../targeting';

export interface TemporalTestStoreOptions {
  readonly sessionId?: string;
  readonly liveHead?: number;
  readonly depth?: SemanticDepth;
  readonly temporal?: TemporalMode;
  /** `false` builds a store with NO temporal authority: every promoted temporal act fails closed. */
  readonly temporalAuthority?: boolean;
}

export function temporalTestStore(options: TemporalTestStoreOptions = {}): CanonicalStore {
  return createCanonicalStore(
    {
      session: { id: options.sessionId ?? 'session-1' },
      live: { LH: sessionPosition(options.liveHead ?? 4), LF: { value: { kind: 'NONE' }, atSp: null } },
      temporal: options.temporal ?? { kind: 'FOLLOW_LIVE' },
      inspection: null,
      camera: initialCameraIntent(WORLD_ORIGIN, undefined, options.depth ?? 'SESSION'),
    },
    options.temporalAuthority === false
      ? { mapActionAuthority: MAP_ACTION_AUTHORITY }
      : { mapActionAuthority: MAP_ACTION_AUTHORITY, temporalActionAuthority: TEMPORAL_ACTION_AUTHORITY },
  );
}

/**
 * The Map context of ONE disclosure, at the position that disclosure describes. Deliberately not
 * derived from the store's current position: a composite temporal act's landing must come from the
 * projection of the position it commits to.
 */
export function contextAt(disclosure: HistoricalDisclosure): MapInspectionContext {
  const resolution = mapInspectionContext(
    { status: 'FETCHED', value: disclosure, sealed: disclosure.sealed },
    { sessionId: disclosure.sessionId, tc: sessionPosition(disclosure.tc), depth: disclosure.depth },
  );
  if (!resolution.ok) throw new Error(`fixture disclosure produced no scene: ${resolution.derivation.status}`);
  return resolution.context;
}

/** The complete SP1-anchored disclosed prefix a Timeline presentation is built from. */
export function trackOf(sessionId: string, count: number): DisclosedTrack {
  return disclosedTrack(
    sessionId,
    Array.from({ length: count }, (_unused, index) => ({ sessionPosition: sessionPosition(index + 1) })),
  );
}

/**
 * The two authorities a T-06 interaction needs. `disclosedCount` is deliberately independent of the
 * store's Live Head, because the whole point of R1-01 is that they are different numbers: a Live Head
 * of 100 with a disclosed prefix through 80 is an ordinary, expected state.
 */
export function targetingOf(store: CanonicalStore, disclosedCount: number, sessionId = 'session-1'): TemporalTargeting {
  return temporalTargeting(store.getState(), trackOf(sessionId, disclosedCount));
}

/** The targeting authority whose disclosed prefix reaches exactly the current Live Head. */
export function fullyDisclosedTargeting(store: CanonicalStore): TemporalTargeting {
  const state = store.getState();
  return temporalTargeting(state, trackOf(state.session.id, state.live.LH ?? 0));
}
