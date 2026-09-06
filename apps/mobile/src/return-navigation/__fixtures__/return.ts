/**
 * T-07 — shared test scaffolding.
 *
 * The store is the production one, wired with the production Map, temporal and return authorities,
 * so every act exercised here runs the real per-field guard, the real `Φ_eff` no-op rule, the real
 * RH append boundary and the real RH consumption boundary. The preview controller is T-06's own. The
 * disclosures come from T-04's wire-legal fixture builder, so a projection used here is a projection
 * the server could actually send.
 *
 * History is never hand-assembled: every checkpoint in these tests was appended by a REAL act
 * through the real transaction boundary, which is the only way a Back chain proves anything.
 */
import type { HistoricalDisclosure } from '@qandeel/runtime';

import {
  createCanonicalStore,
  opaqueRef,
  sessionPosition,
  type CameraIntent,
  type CanonicalState,
  type CanonicalStore,
  type DispatchResult,
  type InspectionRef,
  type LiveFocus,
  type ReturnAction,
  type SemanticDepth,
  type SessionPosition,
  type TemporalMode,
} from '../../state';
import {
  MAP_ACTION_AUTHORITY,
  WORLD_ORIGIN,
  initialCameraIntent,
  mapInspectionContext,
  type MapInspectionContext,
} from '../../map';
import { disclosureFixture, type DisclosureFixture } from '../../map/__fixtures__/disclosure';
import {
  TEMPORAL_ACTION_AUTHORITY,
  createTemporalPreviewController,
  temporalTargeting,
  type TemporalPreviewController,
  type TemporalTargeting,
} from '../../temporal-navigation';
import { disclosedTrack, type DisclosedTrack } from '../../timeline';
import { RETURN_ACTION_AUTHORITY } from '../authority';
import type { ReturnSurface } from '../surface';
import type { ReturnMapContext } from '../focus-target';

export interface ReturnTestStoreOptions {
  readonly sessionId?: string;
  /** `null` is the technical absence sentinel: nothing has been mirrored yet. */
  readonly liveHead?: number | null;
  readonly liveFocus?: LiveFocus;
  readonly liveFocusAtSp?: number;
  readonly depth?: SemanticDepth;
  readonly temporal?: TemporalMode;
  /** A pre-existing `IF_ref`, including one no projection can render. */
  readonly inspection?: InspectionRef | null;
  /** A camera the store starts from, when a test needs one that is not the World/Z0 target. */
  readonly camera?: CameraIntent;
  /** `false` builds a store with NO return authority: every return act fails closed. */
  readonly returnAuthority?: boolean;
}

/** A reference that decodes cleanly and that no disclosure in these fixtures can render. */
export function unavailableInspectionRef(): InspectionRef {
  return Object.freeze({
    canonicalIdentity: opaqueRef('CANONICAL_IDENTITY', { family: 'READING', id: 'reading-gone' }),
    version: opaqueRef('VERSION', { version: 3 }),
    contextualAppearance: opaqueRef('CONTEXTUAL_APPEARANCE', { kind: 'THREAD_READING', bindingId: 'binding-x' }),
    depth: 'ANALYTICAL_OBJECT',
    lineage: opaqueRef('LINEAGE', { route: 'WORLD/THREAD:thread-1/THREAD_READING:binding-x/READING:reading-gone' }),
  });
}

export function returnTestStore(options: ReturnTestStoreOptions = {}): CanonicalStore {
  const focus = options.liveFocus ?? { kind: 'NONE' };
  return createCanonicalStore(
    {
      session: { id: options.sessionId ?? 'session-1' },
      live: {
        LH: options.liveHead === null ? null : sessionPosition(options.liveHead ?? 6),
        LF: { value: focus, atSp: focus.kind === 'NONE' ? null : sessionPosition(options.liveFocusAtSp ?? 1) },
      },
      temporal: options.temporal ?? { kind: 'FOLLOW_LIVE' },
      inspection: options.inspection ?? null,
      camera: options.camera ?? initialCameraIntent(WORLD_ORIGIN, undefined, options.depth ?? 'SESSION'),
    },
    options.returnAuthority === false
      ? { mapActionAuthority: MAP_ACTION_AUTHORITY, temporalActionAuthority: TEMPORAL_ACTION_AUTHORITY }
      : {
          mapActionAuthority: MAP_ACTION_AUTHORITY,
          temporalActionAuthority: TEMPORAL_ACTION_AUTHORITY,
          returnActionAuthority: RETURN_ACTION_AUTHORITY,
        },
  );
}

export function returnSurface(store: CanonicalStore, preview: TemporalPreviewController = createTemporalPreviewController()): ReturnSurface {
  return { store, preview };
}

/**
 * A store whose Return authority admits ANY action object. It exists to prove the store's own
 * preconditions directly — target present, target latest, per-field authority, exact shape — without
 * the layer's authorization standing in front of them. Nothing in production builds one.
 */
export function permissiveReturnStore(options: ReturnTestStoreOptions = {}): CanonicalStore {
  const focus = options.liveFocus ?? { kind: 'NONE' };
  return createCanonicalStore(
    {
      session: { id: options.sessionId ?? 'session-1' },
      live: {
        LH: options.liveHead === null ? null : sessionPosition(options.liveHead ?? 6),
        LF: { value: focus, atSp: focus.kind === 'NONE' ? null : sessionPosition(options.liveFocusAtSp ?? 1) },
      },
      temporal: options.temporal ?? { kind: 'FOLLOW_LIVE' },
      inspection: options.inspection ?? null,
      camera: options.camera ?? initialCameraIntent(WORLD_ORIGIN, undefined, options.depth ?? 'SESSION'),
    },
    {
      mapActionAuthority: MAP_ACTION_AUTHORITY,
      temporalActionAuthority: TEMPORAL_ACTION_AUTHORITY,
      returnActionAuthority: { consume: () => true },
    },
  );
}

/** A store that counts canonical return dispatches, so "exactly one transaction" is measured. */
export interface CountingStore {
  readonly store: CanonicalStore;
  readonly counts: { returns: number; kernel: number; map: number; temporal: number; publishes: number };
}

export function countingStore(inner: CanonicalStore): CountingStore {
  const counts = { returns: 0, kernel: 0, map: 0, temporal: 0, publishes: 0 };
  inner.subscribe(() => {
    counts.publishes += 1;
  });
  const store: CanonicalStore = {
    getState: () => inner.getState(),
    subscribe: (listener) => inner.subscribe(listener),
    dispatch: (action) => {
      counts.kernel += 1;
      return inner.dispatch(action);
    },
    dispatchMap: (action) => {
      counts.map += 1;
      return inner.dispatchMap(action);
    },
    dispatchTemporal: (action) => {
      counts.temporal += 1;
      return inner.dispatchTemporal(action);
    },
    dispatchReturn: (action: ReturnAction): DispatchResult => {
      counts.returns += 1;
      return inner.dispatchReturn(action);
    },
    ingest: (event) => inner.ingest(event),
  };
  return { store, counts };
}

/**
 * A store that runs `during` inside the canonical return dispatch, before delegating — i.e. AFTER
 * the act has bound its referent and resolved its landing, and before anything is written. It is the
 * seam a post-binding race genuinely occupies.
 */
export function mutatingDispatchStore(inner: CanonicalStore, during: () => void): CanonicalStore {
  return {
    getState: () => inner.getState(),
    subscribe: (listener) => inner.subscribe(listener),
    dispatch: (action) => inner.dispatch(action),
    dispatchMap: (action) => inner.dispatchMap(action),
    dispatchTemporal: (action) => inner.dispatchTemporal(action),
    dispatchReturn: (action) => {
      during();
      return inner.dispatchReturn(action);
    },
    ingest: (event) => inner.ingest(event),
  };
}

export const world = (fixture: DisclosureFixture): HistoricalDisclosure => disclosureFixture(fixture);

/** The Map context of ONE disclosure, at the viewpoint that disclosure describes. */
export function contextAt(disclosure: HistoricalDisclosure): MapInspectionContext {
  const resolution = mapInspectionContext(
    { status: 'FETCHED', value: disclosure, sealed: disclosure.sealed },
    { sessionId: disclosure.sessionId, tc: sessionPosition(disclosure.tc), depth: disclosure.depth },
  );
  if (!resolution.ok) throw new Error(`fixture disclosure produced no scene: ${resolution.derivation.status}`);
  return resolution.context;
}

/** A `liveContext` provider that always hands back one prepared context. */
export const providing = (context: MapInspectionContext) => (): ReturnMapContext => ({ ok: true, context });

/** A `liveContext` provider that reports a technical projection failure. */
export const providingNothing = (): ReturnMapContext => ({ ok: false, code: 'PROJECTION_NOT_AVAILABLE', detail: 'not fetched' });

/** The disclosed prefix a T-06 preview needs in order to exist at all. */
export function trackOf(sessionId: string, count: number): DisclosedTrack {
  return disclosedTrack(
    sessionId,
    Array.from({ length: count }, (_unused, index) => ({ sessionPosition: sessionPosition(index + 1) })),
  );
}

export function targetingOf(store: CanonicalStore): TemporalTargeting {
  const state = store.getState();
  return temporalTargeting(state, trackOf(state.session.id, state.live.LH ?? 0));
}

/**
 * A T-06 preview controller that runs `during` at the exact instant an act cancels it — i.e. after
 * activation and before the act resolves anything. It is the honest seam for a race that genuinely
 * happens there, and it needs no scaffolding inside production code to exist.
 */
export function interposingPreview(during: () => void, inner: TemporalPreviewController = createTemporalPreviewController()): TemporalPreviewController {
  return {
    ...inner,
    cancel: () => {
      during();
      return inner.cancel();
    },
  };
}

/** Opens a real T-06 preview at one disclosed position, and proves it opened. */
export function openPreview(store: CanonicalStore, preview: TemporalPreviewController, sp: number): void {
  const result = preview.preview(targetingOf(store), sessionPosition(sp), 'DISCLOSED_TARGET');
  if (result.outcome !== 'PREVIEWING') throw new Error(`fixture preview did not open: ${result.outcome}`);
}

export const SP = (value: number): SessionPosition => sessionPosition(value);

/** The `Φ_eff` fields, as a plain comparable snapshot. */
export function viewpoint(state: CanonicalState) {
  return { temporal: state.temporal, inspection: state.inspection, camera: state.camera };
}

/**
 * The inspection and camera half of a viewpoint. Used where the pre-act stance was `FOLLOW_LIVE`:
 * restoration is ALWAYS `PINNED(capturedTC)`, so the temporal half is asserted separately and
 * explicitly rather than expected to come back as a mode it can never come back as.
 */
export function spatialViewpoint(state: CanonicalState) {
  return { inspection: state.inspection, camera: state.camera };
}
