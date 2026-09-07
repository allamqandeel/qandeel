/**
 * T-08 — shared test scaffolding.
 *
 * The store, the preview controller and the disclosures are the REAL ones: T-07's own fixture
 * builder wires the production Map, temporal and return authorities, so every act exercised here
 * runs the real per-field guard, the real no-op rule, the real RH boundaries and the real
 * authorization seam. Disclosures come from T-04's wire-legal builder, so a projection used here is
 * one the server could actually send.
 *
 * Nothing is hand-assembled that the Product would mint: an `IF_ref` is produced by a real
 * inspection act through T-04's executor, a checkpoint target by a real act through T-07's, and a
 * chrome projection by T-08's own public builder over the entry the projection boundary would hold.
 */
import type { HistoricalDisclosure, HistoricalInspectionResolution, HistoricalSemanticDepth } from '@qandeel/runtime';

import { inspectObject, mapProjectionRequest, type MapInspectionContext } from '../../map';
import type { HistoricalDisclosureEntry } from '../../projection';
import { sessionPosition, type CanonicalStore, type InspectionRef } from '../../state';
import { chromeProjection, type ChromeProjection } from '../model';
import type { OrientationModel, ReturnOpportunityId } from '../types';
import { contextAt, returnSurface, returnTestStore, world, type ReturnTestStoreOptions } from '../../return-navigation/__fixtures__/return';

export { contextAt, returnSurface as chromeSurface, returnTestStore as chromeStore, world };
export type { ReturnTestStoreOptions };

/** Which return acts the model currently OFFERS, in the frozen logical order. */
export const offeredIds = (model: OrientationModel): readonly ReturnOpportunityId[] => model.returns.offered.map((candidate) => candidate.id);

/** Whether one frozen identity is offered right now. Being unoffered is a fact, not an absence of one. */
export const isOffered = (model: OrientationModel, id: ReturnOpportunityId): boolean =>
  model.returns.offered.some((candidate) => candidate.id === id);

/**
 * Everything a reader can actually see or hear: rendered text, accessibility labels and hints.
 *
 * Deliberately NOT the whole serialized tree — a `testID` and a style key are engineering surface a
 * reader never encounters, and scanning them would make the "no internals" proof fail on
 * `flexDirection`. This is the honest definition of user-visible.
 */
export function readableText(node: unknown, out: string[] = []): string[] {
  if (node === null || node === undefined) return out;
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) readableText(child, out);
    return out;
  }
  const element = node as { props?: Record<string, unknown>; children?: unknown };
  const props = element.props ?? {};
  for (const key of ['accessibilityLabel', 'accessibilityHint']) {
    if (typeof props[key] === 'string') out.push(props[key] as string);
  }
  const actions = props.accessibilityActions;
  if (Array.isArray(actions)) {
    for (const action of actions as readonly { name?: unknown; label?: unknown }[]) {
      if (typeof action.name === 'string') out.push(action.name);
      if (typeof action.label === 'string') out.push(action.label);
    }
  }
  readableText(element.children, out);
  return out;
}

/** A React Native style prop, flattened the way the platform composes it, for structural assertions. */
export function flattenStyle(style: unknown): Record<string, unknown> {
  const entries = (Array.isArray(style) ? style.flat(Infinity) : [style]).filter(
    (entry): entry is Record<string, unknown> => entry !== null && typeof entry === 'object',
  );
  return Object.assign({}, ...entries) as Record<string, unknown>;
}

/** The disclosure entry the projection boundary holds once a disclosure has arrived. */
export const fetched = (disclosure: HistoricalDisclosure): HistoricalDisclosureEntry => ({
  status: 'FETCHED',
  value: disclosure,
  sealed: disclosure.sealed,
});

/**
 * The chrome projection for whatever the store's CURRENT viewpoint is.
 *
 * The request is derived from canonical state exactly as production derives it, so pairing a
 * disclosure with a viewpoint it does not describe produces the real typed rejection rather than a
 * plausible-looking wrong Map.
 */
export function projectionFor(store: CanonicalStore, entry: HistoricalDisclosureEntry): ChromeProjection {
  const request = mapProjectionRequest(store.getState());
  if (request === null) throw new Error('fixture store has no addressable Session Position');
  return chromeProjection(entry, request);
}

/** Attaches a resolution to a disclosure, exactly as `V = Disclose(K(TC), depth, inspection)` would. */
export const withInspection = (disclosure: HistoricalDisclosure, inspection: HistoricalInspectionResolution | null): HistoricalDisclosure => ({
  ...disclosure,
  inspection,
});

type KnownResolution = Extract<HistoricalInspectionResolution, { knowledge: 'KNOWN_AND_CURRENT_AT_TC' | 'KNOWN_NONCURRENT_AT_TC' }>;

export const unknownAtTc = (): HistoricalInspectionResolution => ({ knowledge: 'UNKNOWN_AT_TC' });

/** A legal "known and renderable" answer, with any one field overridden for the case under test. */
export const known = (over: Partial<KnownResolution> = {}): HistoricalInspectionResolution => ({
  knowledge: 'KNOWN_AND_CURRENT_AT_TC',
  noncurrent: null,
  context: 'NOT_REQUESTED',
  disclosure: 'AVAILABLE_AND_RENDERABLE',
  requiredDepth: 'ANALYTICAL_OBJECT' as HistoricalSemanticDepth,
  ...over,
});

/**
 * The standard scenario: one Reading disclosed in TWO Threads, at a historical position behind a
 * Live Head that has moved on. It is the shape most of the hard cases need — a real contextual
 * ambiguity, a real historical stance, and a real Live that has continued.
 */
export const TWO_CONTEXT_WORLD = (over: { readonly tc?: number; readonly liveHead?: number; readonly depth?: HistoricalSemanticDepth } = {}): HistoricalDisclosure =>
  world({
    depth: over.depth ?? 'ANALYTICAL_OBJECT',
    tc: over.tc ?? 4,
    liveHead: over.liveHead ?? 6,
    threads: [
      { id: 'thread-a', x: '1000000', y: '0' },
      { id: 'thread-b', x: '3000000', y: '0' },
    ],
    appearances: [
      { bindingId: 'binding-a', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 },
      { bindingId: 'binding-b', threadId: 'thread-b', readingId: 'reading-1', boundSp: 3 },
    ],
    readings: [{ id: 'reading-1' }],
  });

/** A store standing historically at SP(4) with Live at SP(6), disclosing the analytical-object rung. */
export const historicalStore = (over: ReturnTestStoreOptions = {}): CanonicalStore =>
  returnTestStore({ liveHead: 6, depth: 'ANALYTICAL_OBJECT', temporal: { kind: 'PINNED', at: sessionPosition(4) }, ...over });

/**
 * Establishes a real `IF_ref` by running the REAL inspection act through T-04's executor.
 *
 * Hand-writing a reference would prove nothing: the entitlement brand, the projection tuple and the
 * exact lineage all come from `V` admitting the target, and those are precisely what the chrome then
 * reads back.
 */
export function inspect(store: CanonicalStore, context: MapInspectionContext, request: { readonly family: 'THREAD' | 'READING' | 'EMERGING_FOCUS'; readonly id: string; readonly version?: number; readonly appearance?: { readonly kind: 'THREAD_READING'; readonly bindingId: string } }): InspectionRef {
  const outcome = inspectObject(store, context, request);
  if (outcome.outcome !== 'APPLIED') throw new Error(`fixture inspection did not apply: ${JSON.stringify(outcome)}`);
  const ref = store.getState().inspection;
  if (ref === null) throw new Error('fixture inspection left no reference');
  return ref;
}
