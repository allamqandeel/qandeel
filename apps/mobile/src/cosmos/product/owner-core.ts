/**
 * COSMOS-INT-01 Slice B — the production owner seam: the thin translation between the COSMOS stage and ONE world's
 * PRODUCTION authority.
 *
 * An owner decides NOTHING. It translates what the fingers did into the authority's own act (one pan, one semantic
 * step, one field tap, one focus, one inspection), then reads the authority's state back: the canonical camera becomes
 * the COSMOS target camera, the served entries become the draw list. Whether an act applied, which place is nearest,
 * what a rung discloses and what "empty" means are all the production controller's answers (Product Owner
 * authorisation, 2026-11-15: the real controllers, authorization, privacy and temporal state are the source of truth;
 * nothing here replaces server-authoritative state).
 *
 * The glass is the host's: the envelope the ONE Living Analysis surface measured for its STAGE presentation (its top
 * band and its support band are the glass's insets), steadied by CA-O1 in the host. The authority projects through it
 * and the stage draws the camera's centre at its safe-area centre, so paint, hit testing and the authority agree.
 *
 * No React and no Skia here. The pure pieces (`cosmosCameraOf`, `gestureFixedPoint`, `nearestHit`) are the ones the
 * device proof was accepted with (`__validation__/owners.ts` keeps the proof's own fixture seam, unchanged).
 */

import { envelopeCenter, type ScreenPoint, type ViewportEnvelope } from '../../map/camera';
import type { CanonicalWorldAddress, MapScale } from '../../map/world';
import { FAR_UNITS_PER_POINT, toFarX, toFarY } from '../core/adapters';
import { project, unproject, type NasijCamera, type NasijView } from '../core/camera';
import { compileStage, rungScale, type Stage, type WorldKind } from '../core/stage';

/** The scene origin: every FAR-point coordinate is the exact-integer difference from the canonical origin. */
export const ORIGIN = { x: 0n, y: 0n };
export const HOME: NasijCamera = { cx: 0, cy: 0, scale: 1 };

export interface CosmosPoint { readonly id: string; readonly x: number; readonly y: number }

/** A Personal object the production derivation disclosed with NO place (G-6): shown in the register, never placed. */
export interface CosmosUnplaced { readonly id: string; readonly family: 'THREAD' | 'READING' | 'EMERGING_FOCUS' }
/** One explicit, served relation of the focused entity (S5-03C), with its approved accessible name: the strand the stage draws at NEAR. */
export interface CosmosRelation { readonly id: string; readonly label: string }

export interface CosmosWorldSnapshot {
  readonly world: WorldKind;
  readonly status: 'LOADING' | 'READY' | 'UNAVAILABLE';
  readonly list: Stage;
  readonly held: readonly boolean[] | null;
  readonly rungs: number;
  /** The canonical rung and camera, as the authority holds them. */
  readonly rung: number;
  readonly camera: NasijCamera;
  /** The focused (field) or inspected (Personal, placed) entity's stage id, or null. */
  readonly focusId: string | null;
  /** Personal: the inspected object's scene key (`${family}:${id}`), placed or not; the fields leave it undefined. */
  readonly inspectedId?: string | null;
  readonly shown: readonly CosmosPoint[];
  /** What a WHOLE-WORLD read established, or null. Never updated by a viewport read (Problem 7). */
  readonly worldIndex: readonly CosmosPoint[] | null;
  readonly entityCount: number;
  readonly unplaced: readonly CosmosUnplaced[];
  /** The focused entity's explicit relations as the authority serves them at NEAR (S5-03C); empty elsewhere and for the Personal world. */
  readonly relations: readonly CosmosRelation[];
}

export type CosmosTapResult = 'FOCUS' | 'FIELD' | 'NONE';
export interface CosmosStepResult { readonly applied: boolean; /** The step was taken about the fingers: the settle may keep its anchor. */ readonly aboutFingers: boolean }

export interface CosmosWorldOwner {
  getSnapshot(): CosmosWorldSnapshot;
  subscribe(listener: () => void): () => void;
  /** The glass the host measured: the authority projects through it from now on. */
  setGlass(glass: ViewportEnvelope): void;
  /** One completed drag that left the presentation camera at `released`. */
  pan(released: NasijCamera): boolean;
  /** One semantic step; `focal` and `released` describe a pinch (or a double tap), and are null on the accessible route. */
  step(direction: 'IN' | 'OUT', focal: ScreenPoint | null, released: NasijCamera | null): CosmosStepResult;
  tap(x: number, y: number, released: NasijCamera): CosmosTapResult;
  focus(id: string): void;
  /** Local Back: true when it did something. */
  back(): boolean;
  /** Move the camera to a FAR-point position at the current rung (the "go to the nearest" act): one pan. */
  goTo(x: number, y: number): boolean;
  labelOf(id: string): string;
  dispose(): void;
}

/** The stage's view of the glass: the camera's centre is drawn at the safe-area centre the authority projects through. */
export function viewOf(glass: ViewportEnvelope): NasijView {
  const centre = envelopeCenter(glass);
  return { width: glass.width, height: glass.height, focusX: centre.x, focusY: centre.y };
}

/** A canonical camera as the COSMOS target camera: the anchor in FAR points, the scale as points per FAR point. */
export function cosmosCameraOf(camera: { readonly anchor: CanonicalWorldAddress; readonly scale: MapScale }): NasijCamera {
  return {
    // `+ 0` turns the -0 a flipped zero ordinate gives into 0.
    cx: toFarX(ORIGIN, camera.anchor) + 0, cy: toFarY(ORIGIN, camera.anchor) + 0,
    // A MapScale is world units per point; the cloth's scale is points per FAR point (8192 units).
    scale: (FAR_UNITS_PER_POINT * Number(camera.scale.denominator)) / Number(camera.scale.numerator),
  };
}

/**
 * The screen point a canonical step must be taken about so that it lands where the fingers left the cloth.
 *
 * The production step keeps the world point under ITS focal point fixed, starting from the canonical camera. The
 * presentation camera at release may differ from the canonical one (the fingers also dragged), so the point to hand
 * over is the fixed point of the whole gesture: the one screen point whose world position is the same before (in the
 * canonical camera) and after (in the camera the fingers ask for). For a pure pinch it is the fingers themselves.
 */
export function gestureFixedPoint(canonical: NasijCamera, released: NasijCamera, view: NasijView, focal: ScreenPoint, from: number, to: number): ScreenPoint {
  const w = unproject(released, view, focal.x, focal.y);
  const wanted = { cx: w.x - (focal.x - view.focusX) / to, cy: w.y - (focal.y - view.focusY) / to };
  const g = 1 / from - 1 / to;
  const fixed = { x: view.focusX + (wanted.cx - canonical.cx) / g, y: view.focusY + (wanted.cy - canonical.cy) / g };
  const inside = Number.isFinite(fixed.x) && Number.isFinite(fixed.y) && fixed.x >= 0 && fixed.x <= view.width && fixed.y >= 0 && fixed.y <= view.height;
  return inside ? fixed : focal;
}

export const EMPTY_LIST = (world: WorldKind, rungs: number, rtl: boolean): Stage => compileStage({ world, rungs, entities: [], focusId: null, rtl });

export function nearestHit(list: Stage, rung: number, camera: NasijCamera, view: NasijView, x: number, y: number): string | null {
  const w = unproject(camera, view, x, y);
  let hit: string | null = null;
  let best = Infinity;
  for (const h of list.layers[rung]?.hits ?? []) {
    const d = Math.hypot(h.x - w.x, h.y - w.y) * camera.scale;
    if (d <= h.r && d < best) { best = d; hit = h.id; }
  }
  return hit;
}

export function emitter() {
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    emit() { for (const listener of Array.from(listeners)) listener(); },
    clear() { listeners.clear(); },
  };
}

export function memo<K extends readonly unknown[], V>(compute: () => V): (key: K) => V {
  let last: { key: K; value: V } | null = null;
  return (key) => {
    if (last !== null && last.key.length === key.length && last.key.every((part, i) => part === key[i])) return last.value;
    last = { key, value: compute() };
    return last.value;
  };
}

// ── the two field worlds ──────────────────────────────────────────────────────────────────────────────────────────

export interface FieldEntry { readonly id: string; readonly address: CanonicalWorldAddress }
export interface FieldRead {
  readonly status: 'IDLE' | 'LOADING' | 'READY' | 'UNAVAILABLE';
  readonly entries: readonly FieldEntry[];
  readonly camera: { readonly anchor: CanonicalWorldAddress; readonly scale: MapScale; readonly depth: 'FAR' | 'MID' | 'NEAR' } | null;
  readonly focusId: string | null;
}
type FieldOutcome = { readonly outcome: string };

/** What a field controller offers, in the words the two production controllers share. */
export interface FieldAuthority {
  readonly world: 'PUBLIC' | 'SHARED';
  read(): FieldRead;
  subscribe(listener: () => void): () => void;
  setEnvelope(envelope: ViewportEnvelope): void;
  pan(tx: number, ty: number): FieldOutcome;
  step(direction: 'IN' | 'OUT', focal: ScreenPoint | null): FieldOutcome;
  tapField(x: number, y: number): void;
  focus(id: string): void;
  back(): boolean;
  compile(): Stage;
  labelOf(id: string): string;
  /** The focused entity's served explicit relations at NEAR, with their accessible names; none when the authority has none. */
  relations?(): readonly CosmosRelation[];
}

const FIELD_DEPTHS = ['FAR', 'MID', 'NEAR'] as const;

/**
 * One field owner over a PRODUCTION field controller the host created, entered and will retire: the owner neither
 * enters nor retires it. The controller's own lifecycle (Public `enter`, Shared `open`) is the host's, exactly as it
 * was with the old renderer.
 */
export function createFieldOwner(authority: FieldAuthority, rtl: boolean): CosmosWorldOwner {
  const changes = emitter();
  let glass: ViewportEnvelope | null = null;
  let worldIndex: CosmosPoint[] | null = null;
  let wasReady = false;
  let lastCamera: NasijCamera = HOME;
  let snapshot: CosmosWorldSnapshot | null = null;
  const pointOf = (entry: FieldEntry): CosmosPoint => ({ id: entry.id, x: toFarX(ORIGIN, entry.address), y: toFarY(ORIGIN, entry.address) });

  // Problem 7: the whole-world evidence is captured ONCE per entry, at the moment the entry's own whole-world read
  // answers (the only publish that turns the field READY), before any viewport read can replace the entries.
  const noteIndex = (read: FieldRead) => {
    if (read.status === 'READY' && !wasReady) { worldIndex = read.entries.map(pointOf); wasReady = true; }
    if (read.status !== 'READY') wasReady = false;
  };
  const unsubscribe = authority.subscribe(() => {
    noteIndex(authority.read());
    snapshot = null;
    changes.emit();
  });
  const viewNow = (): NasijView | null => (glass === null ? null : viewOf(glass));

  const build = (): CosmosWorldSnapshot => {
    const read = authority.read();
    noteIndex(read);
    if (read.camera !== null) lastCamera = cosmosCameraOf(read.camera);
    const ready = read.status === 'READY';
    const list = ready ? authority.compile() : EMPTY_LIST(authority.world, 3, rtl);
    return {
      world: authority.world,
      status: ready ? 'READY' : read.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'LOADING',
      list, held: null, rungs: 3,
      rung: read.camera === null ? 0 : FIELD_DEPTHS.indexOf(read.camera.depth),
      camera: read.camera === null ? HOME : lastCamera,
      focusId: read.focusId,
      shown: ready ? read.entries.map(pointOf) : [],
      worldIndex: ready ? worldIndex : null,
      entityCount: ready ? read.entries.length : 0,
      unplaced: [],
      relations: ready ? (authority.relations?.() ?? []) : [],
    };
  };
  const current = () => { snapshot ??= build(); return snapshot; };

  return {
    getSnapshot: current,
    subscribe: changes.subscribe,
    setGlass(next) {
      glass = next;
      authority.setEnvelope(next);
    },
    pan(released) {
      const s = current();
      const scale = rungScale(s.rung);
      const tx = (s.camera.cx - released.cx) * scale;
      const ty = (s.camera.cy - released.cy) * scale;
      if (Math.abs(tx) < 0.5 && Math.abs(ty) < 0.5) return false;
      return authority.pan(tx, ty).outcome === 'APPLIED';
    },
    step(direction, focal, released) {
      const s = current();
      const view = viewNow();
      const next = s.rung + (direction === 'IN' ? 1 : -1);
      let point: ScreenPoint | null = null;
      let aboutFingers = false;
      if (focal !== null && released !== null && view !== null && next >= 0 && next < 3) {
        if (direction === 'IN' && s.rung === 1) {
          // NEAR is focus: the controller picks the place nearest this point, so hand it the screen point (in the
          // canonical camera) of the world point the fingers were actually on.
          const w = unproject(released, view, focal.x, focal.y);
          point = project(s.camera, view, w.x, w.y);
        } else {
          point = gestureFixedPoint(s.camera, released, view, focal, rungScale(s.rung), rungScale(next));
          aboutFingers = true;
        }
      }
      const applied = authority.step(direction, point).outcome === 'APPLIED';
      return { applied, aboutFingers: applied && aboutFingers };
    },
    tap(x, y, released) {
      const s = current();
      const view = viewNow();
      if (view === null || s.status !== 'READY') return 'NONE';
      const hit = nearestHit(s.list, s.rung, released, view, x, y);
      if (hit !== null) { authority.focus(hit); return 'FOCUS'; }
      if (s.rung !== 0) return 'NONE';
      // A FAR tap discloses that place at MID, by the controller's own rule. It is handed the screen point (in the
      // canonical camera) of the world point that was tapped.
      const w = unproject(released, view, x, y);
      const p = project(s.camera, view, w.x, w.y);
      authority.tapField(p.x, p.y);
      return 'FIELD';
    },
    focus(id) { authority.focus(id); },
    back() {
      let did = authority.back();
      if (!did && current().rung > 0) did = authority.step('OUT', null).outcome === 'APPLIED';
      return did;
    },
    goTo(x, y) {
      const s = current();
      const scale = rungScale(s.rung);
      return authority.pan((s.camera.cx - x) * scale, (s.camera.cy - y) * scale).outcome === 'APPLIED';
    },
    labelOf: (id) => authority.labelOf(id),
    dispose() {
      unsubscribe();
      changes.clear();
    },
  };
}
