/**
 * T-04 — shared test scaffolding: a canonical store on the real T-02 kernel, and the two
 * derivations every Map test starts from. Nothing here is a stand-in for the kernel: the store
 * is the production one, so a test that dispatches a Map act exercises the real authority guard,
 * the real `Φ_eff` no-op rule and the real RH boundary.
 */
import type { HistoricalDisclosure } from '@qandeel/runtime';

import { createCanonicalStore, sessionPosition, type CanonicalStore, type SemanticDepth } from '../../state';
import type { HistoricalDisclosureEntry } from '../../projection';
import { initialCameraIntent, viewportEnvelope, WORLD_ORIGIN, type ViewportEnvelope } from '../camera';
import { deriveMapScene, mapProjectionRequest, type MapScene } from '../projection';
import type { MapInspectionContext } from '../inspection';
import { canonicalWorldAddress, type CanonicalWorldAddress } from '../world';

export function address(x: bigint, y: bigint): CanonicalWorldAddress {
  const decoded = canonicalWorldAddress(x, y);
  if (!decoded.ok) throw new Error(`fixture address out of bounds: ${decoded.detail}`);
  return decoded.address;
}

export interface TestStoreOptions {
  readonly sessionId?: string;
  readonly liveHead?: number;
  readonly depth?: SemanticDepth;
  readonly anchor?: CanonicalWorldAddress;
}

export function testStore(options: TestStoreOptions = {}): CanonicalStore {
  return createCanonicalStore({
    session: { id: options.sessionId ?? 'session-1' },
    live: { LH: sessionPosition(options.liveHead ?? 4), LF: { value: { kind: 'NONE' }, atSp: null } },
    temporal: { kind: 'FOLLOW_LIVE' },
    inspection: null,
    camera: initialCameraIntent(options.anchor ?? WORLD_ORIGIN, undefined, options.depth ?? 'WORLD'),
  });
}

export function fetchedEntry(disclosure: HistoricalDisclosure): HistoricalDisclosureEntry {
  return { status: 'FETCHED', value: disclosure, sealed: disclosure.sealed };
}

export function sceneOf(store: CanonicalStore, disclosure: HistoricalDisclosure): MapScene {
  const request = mapProjectionRequest(store.getState());
  if (request === null) throw new Error('the fixture store must have a mirrored Live Head');
  const derivation = deriveMapScene(fetchedEntry(disclosure), request);
  if (derivation.status !== 'SCENE') throw new Error(`expected a scene, got ${derivation.status}`);
  return derivation.scene;
}

export function contextOf(store: CanonicalStore, disclosure: HistoricalDisclosure): MapInspectionContext {
  return { disclosure, scene: sceneOf(store, disclosure) };
}

export function envelope(width = 390, height = 844): ViewportEnvelope {
  const built = viewportEnvelope(width, height, { top: 48, bottom: 24 });
  if (built === null) throw new Error('fixture envelope is not a viewport');
  return built;
}
