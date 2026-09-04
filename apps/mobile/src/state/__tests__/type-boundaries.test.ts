/**
 * Compile-time boundaries. Each `@ts-expect-error` line must fail to compile for the boundary to
 * hold: `npm run typecheck:mobile` rejects an unused directive (TS2578). The runtime expectations
 * prove the same boundary holds when TypeScript is bypassed.
 */
import type { CatalogEntry } from '../actions';
import { opaqueRef, sessionPosition, type CameraIntent, type CanonicalState, type LiveTruth, type RhCheckpoint, type RhEntry } from '../classes';
import type { CommittedNavigationIntent, TemporalOrientation } from '../selectors';
import { createCanonicalStore, type CanonicalStateInit } from '../store';
import type { ClientWritable } from '../transitions';

const SP = sessionPosition;

function init(): CanonicalStateInit {
  return {
    session: { id: 'session-1' },
    live: { LH: SP(5), LF: { value: { kind: 'NONE' }, atSp: null } },
    temporal: { kind: 'FOLLOW_LIVE' },
    inspection: null,
    camera: { anchor: opaqueRef('WORLD_ANCHOR', 'a0'), scale: opaqueRef('SCALE_INTENT', 's0'), depth: 'WORLD' },
  };
}

type HasKey<T, K extends string> = K extends keyof T ? true : false;

const stateHasNoK: HasKey<CanonicalState, 'K'> = false;
const stateHasNoV: HasKey<CanonicalState, 'V'> = false;
const stateHasNoIfRender: HasKey<CanonicalState, 'ifRender'> = false;
const stateHasNoPtc: HasKey<CanonicalState, 'PTC'> = false;
const stateHasNoWindow: HasKey<CanonicalState, 'window'> = false;
const cameraHasNoWidth: HasKey<CameraIntent, 'width'> = false;
const cameraHasNoHeight: HasKey<CameraIntent, 'height'> = false;
const cameraHasNoFootprint: HasKey<CameraIntent, 'footprint'> = false;
const intentHasNoLive: HasKey<CommittedNavigationIntent, 'live'> = false;
const intentHasNoLh: HasKey<CommittedNavigationIntent, 'LH'> = false;
const orientationHasNoProjection: HasKey<TemporalOrientation, 'projection'> = false;

describe('type-level boundaries', () => {
  it('rejects at compile time what the runtime boundary also rejects', () => {
    const store = createCanonicalStore(init());

    expect(() => {
      // @ts-expect-error a Class D presentation identity is not a KernelAction (row 3)
      store.dispatch({ type: 'PRESENTATION_WINDOW_MOVE', offset: 0.5 });
    }).toThrow();
    expect(() => {
      // @ts-expect-error a Class C Preview identity is not a KernelAction (row 4)
      store.dispatch({ type: 'PREVIEW_TEMPORAL_TARGET', ptc: SP(4) });
    }).toThrow();
    expect(() => {
      // @ts-expect-error an authoritative event cannot enter the Product action path (row 2)
      store.dispatch({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(9) });
    }).toThrow();
    expect(() => {
      // @ts-expect-error a later-owner identity has no executable payload type (row 16)
      store.dispatch({ type: 'BACK_ONE_STEP' });
    }).toThrow();
    expect(() => {
      // @ts-expect-error a generic navigate() does not exist (row 12)
      store.dispatch({ type: 'NAVIGATE', to: 'live' });
    }).toThrow();
    expect(() => {
      // @ts-expect-error a Product action cannot be ingested as an authoritative event
      store.ingest({ type: 'PAN', to: { anchor: opaqueRef('WORLD_ANCHOR', 'a1') } });
    }).toThrow();
    expect(() => {
      // @ts-expect-error the event catalog is closed: no generic world-truth event (row 19)
      store.ingest({ type: 'WORLD_TRUTH_UPDATED' });
    }).toThrow();
    expect(() => {
      // @ts-expect-error a derived K(TC) cannot be dispatched as state (row 8)
      store.dispatch({ type: 'SET_K_TC', value: {} });
    }).toThrow();

    // Transition return types exclude the fields no Product action may write (rows 1, 2).
    // @ts-expect-error `live` (LH, LF) is not part of ClientWritable
    const rogueLive = (state: CanonicalState): ClientWritable => ({ temporal: state.temporal, inspection: state.inspection, camera: state.camera, live: state.live });
    // @ts-expect-error `history` (RH) is not part of ClientWritable
    const rogueHistory = (state: CanonicalState): ClientWritable => ({ temporal: state.temporal, inspection: state.inspection, camera: state.camera, history: state.history });
    // @ts-expect-error an event transition returns LiveTruth only; `temporal` is unreachable
    const rogueEvent = (state: CanonicalState): LiveTruth => ({ LH: state.live.LH, LF: state.live.LF, temporal: state.temporal });
    expect([rogueLive, rogueHistory, rogueEvent].every((fn) => typeof fn === 'function')).toBe(true);

    // RH can only record an explicit Class-A Product act (FIX-T02-03) over an addressable TC (FIX-T02-04).
    const checkpoint: RhCheckpoint = { tmProvenance: { kind: 'FOLLOW_LIVE' }, tc: SP(5), ifRef: null, camera: init().camera };
    // @ts-expect-error an authoritative event is never an RH act
    const rhEvent: RhEntry = { act: 'LIVE_HEAD_ADVANCED', captured: checkpoint };
    // @ts-expect-error an authoritative LF transition is never an RH act
    const rhFocus: RhEntry = { act: 'LIVE_FOCUS_TRANSITION', captured: checkpoint };
    // @ts-expect-error a Class C Preview identity is never an RH act
    const rhPreview: RhEntry = { act: 'PREVIEW_TEMPORAL_TARGET', captured: checkpoint };
    // @ts-expect-error a Class D presentation identity is never an RH act
    const rhWindow: RhEntry = { act: 'PRESENTATION_WINDOW_MOVE', captured: checkpoint };
    // @ts-expect-error a checkpoint can never capture TC = null
    const rhNullTc: RhCheckpoint = { tmProvenance: { kind: 'FOLLOW_LIVE' }, tc: null, ifRef: null, camera: init().camera };
    const rhKernel: RhEntry = { act: 'PAN', captured: checkpoint };
    const rhLater: RhEntry = { act: 'BACK_ONE_STEP', captured: checkpoint };
    expect([rhEvent, rhFocus, rhPreview, rhWindow, rhNullTc, rhKernel, rhLater].length).toBe(7);

    // The authority policy is a readonly array, never a mutable Set (FIX-T02-01).
    const authorityIsArray: CatalogEntry['authority'] extends readonly unknown[] ? true : false = true;
    expect(authorityIsArray).toBe(true);

    // Positive type assertions: these constants only compile because the keys are absent.
    expect(
      [
        stateHasNoK,
        stateHasNoV,
        stateHasNoIfRender,
        stateHasNoPtc,
        stateHasNoWindow,
        cameraHasNoWidth,
        cameraHasNoHeight,
        cameraHasNoFootprint,
        intentHasNoLive,
        intentHasNoLh,
        orientationHasNoProjection,
      ].every((flag) => flag === false),
    ).toBe(true);
  });
});
