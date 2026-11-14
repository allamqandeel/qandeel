// NASIJ proof (experimental, isolated) — the three world owners. VALIDATION ONLY.
//
// An owner is the thin seam between the NASIJ host and the PRODUCTION authority of one world:
//
//   Public    `createPublicFieldController` over the production `PublicFieldApiClient` and the S5-03B fixture;
//   Shared    `createSharedFieldController` over the production `SharedWorldApiClient` and the SHARED-VIS-01 fixture;
//   Personal  the production integration runtime (store, projection cache, T-04 executors) over the VPORT-01 world.
//
// An owner decides NOTHING. It translates what the fingers did into the authority's own act (one pan, one semantic
// step, one field tap, one focus, one inspection), then reads the authority's state back: the canonical camera becomes
// the NASIJ target camera, the served entries become the draw list. Whether an act applied, which place is nearest,
// what a rung discloses and what "empty" means are all the production controller's answers.
//
// No React and no Skia here, so the whole seam is exercised headlessly by `__tests__/proof-owners.test.ts`.

import { createEphemeralAppearancePreferenceStore } from '../../appearance';
import { createIntegrationRuntime, type IntegrationRuntime, type IntegrationSessionRuntime } from '../../integration/runtime/integration-runtime';
import { currentCamera, panByTranslation, zoomSemanticStep } from '../../map/camera/map-camera-actions';
import { viewportEnvelope, type ScreenPoint, type ViewportEnvelope } from '../../map/camera/viewport';
import { decodeInspectionRef } from '../../map/inspection/entitlement';
import { inspectObject, mapInspectionContext, type MapInspectionContext } from '../../map/inspection/map-actions';
import { mapProjectionRequest } from '../../map/projection/map-scene';
import type { CanonicalWorldAddress, MapScale } from '../../map/world';
import { inspectionSentence } from '../../orientation-chrome/product-copy';
import { createPublicFieldController, type PublicFieldController } from '../../public-world/field/public-field-controller';
import { createEphemeralPushDeviceStore, createInertPushPlatformPort } from '../../push';
import { createEphemeralProductRecoveryStorage } from '../../recovery';
import { backOneStep } from '../../return-navigation/return-actions';
import { createManualForegroundSignal } from '../../runtime-entry';
import { publicEntryLabel } from '../../runtime-entry/public-field-api';
import { createSharedFieldController, type SharedFieldController } from '../../shared-world/field/shared-field-controller';
import { effectiveTC } from '../../state';
import { commitLiveEdge, commitMoment } from '../../temporal-navigation/targeting/commit';
import { createInertVoiceNoteDevice } from '../../voice-note';
import { FAR_UNITS_PER_POINT, PERSONAL_DEPTHS, personalDrawList, personalScene, publicScene, sharedScene, toFarX, toFarY } from '../core/adapters';
import { project, unproject, type NasijCamera, type NasijView } from '../core/camera';
import { compileNasij, rungScale, type NasijDrawList, type NasijSceneInput, type NasijWorldKind } from '../core/scene';
import { NASIJ_COPY, type NasijLanguage } from './copy';
import { SHARED_FIXTURE_WORLD_ID, createPersonalFixtureWorld, createPublicFixtureTransport, createSharedFixtureTransport, type NasijFault } from './fixture-transports';

/** The lantern card's fixed peek height: the same from its first frame, whatever its read does. */
export const CARD_PEEK = 156;
const ORIGIN = { x: 0n, y: 0n };
const HOME: NasijCamera = { cx: 0, cy: 0, scale: 1 };

export interface NasijPoint { readonly id: string; readonly x: number; readonly y: number }

export interface NasijCard {
  readonly status: 'LOADING' | 'SERVED' | 'ABSENT' | 'UNAVAILABLE';
  readonly title: string;
  readonly meta: string;
  readonly lines: readonly string[];
}

export interface NasijTime { readonly liveHead: number; readonly tc: number; readonly pinned: boolean; readonly fringe: number }

export interface NasijWorldSnapshot {
  readonly world: NasijWorldKind;
  readonly status: 'LOADING' | 'READY' | 'UNAVAILABLE' | 'REFUSED';
  readonly list: NasijDrawList;
  readonly held: readonly boolean[] | null;
  readonly rungs: number;
  /** The canonical rung and camera, as the authority holds them. */
  readonly rung: number;
  readonly camera: NasijCamera;
  readonly focusId: string | null;
  readonly card: NasijCard | null;
  /** True when the open card lifts the focus point (the field worlds; Personal inspection writes no camera). */
  readonly liftsFocus: boolean;
  readonly shown: readonly NasijPoint[];
  /** What a WHOLE-WORLD read established, or null. Never updated by a viewport read (Problem 7). */
  readonly worldIndex: readonly NasijPoint[] | null;
  readonly entityCount: number;
  readonly time: NasijTime | null;
}

export type NasijTapResult = 'FOCUS' | 'FIELD' | 'NONE';
export interface NasijStepResult { readonly applied: boolean; /** The step was taken about the fingers: the settle may keep its anchor. */ readonly aboutFingers: boolean }

export interface NasijWorldOwner {
  getSnapshot(): NasijWorldSnapshot;
  subscribe(listener: () => void): () => void;
  /** Enter the world afresh: the authority reads again, and nothing of an earlier visit is kept. */
  enter(): void;
  setView(width: number, height: number): void;
  /** One completed drag that left the presentation camera at `released`. */
  pan(released: NasijCamera): boolean;
  /** One semantic step; `focal` and `released` describe a pinch, and are null on the accessible route. */
  step(direction: 'IN' | 'OUT', focal: ScreenPoint | null, released: NasijCamera | null): NasijStepResult;
  tap(x: number, y: number, released: NasijCamera): NasijTapResult;
  focus(id: string): void;
  /** Local Back: true when it did something. */
  back(): boolean;
  /** Move the camera to a FAR-point position at the current rung (the "go to the nearest" act): one pan. */
  goTo(x: number, y: number): boolean;
  labelOf(id: string): string;
  /** Personal only: commit one Moment, or the Live Edge, through the production temporal API. */
  commitMoment?(sp: number): void;
  goLive?(): void;
  dispose(): void;
}

export interface NasijOwnerOptions {
  readonly language: NasijLanguage;
  readonly fault: () => NasijFault;
  /** Multiplies the fixture network's simulated latency; 0 in tests. */
  readonly latency?: number;
}

/** Where the camera's centre is drawn: the centre of the glass, or of the area above an open card. */
export function focusYOf(snapshot: Pick<NasijWorldSnapshot, 'liftsFocus' | 'focusId'>, height: number): number {
  return snapshot.liftsFocus && snapshot.focusId !== null ? (height - CARD_PEEK) / 2 : height / 2;
}

/** A canonical camera as the NASIJ target camera: the anchor in FAR points, the scale as points per FAR point. */
export function nasijCameraOf(camera: { readonly anchor: CanonicalWorldAddress; readonly scale: MapScale }): NasijCamera {
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

const EMPTY_LIST = (world: NasijWorldKind, rungs: number, rtl: boolean): NasijDrawList => compileNasij({ world, rungs, entities: [], focusId: null, rtl });

function nearestHit(list: NasijDrawList, rung: number, camera: NasijCamera, view: NasijView, x: number, y: number): string | null {
  const w = unproject(camera, view, x, y);
  let hit: string | null = null;
  let best = Infinity;
  for (const h of list.layers[rung]?.hits ?? []) {
    const d = Math.hypot(h.x - w.x, h.y - w.y) * camera.scale;
    if (d <= h.r && d < best) { best = d; hit = h.id; }
  }
  return hit;
}

function emitter() {
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    emit() { for (const listener of Array.from(listeners)) listener(); },
    clear() { listeners.clear(); },
  };
}

// ── the two field worlds ──────────────────────────────────────────────────────────────────────────────────────────

interface FieldEntry { readonly id: string; readonly address: CanonicalWorldAddress }
interface FieldRead {
  readonly status: 'IDLE' | 'LOADING' | 'READY' | 'UNAVAILABLE';
  readonly entries: readonly FieldEntry[];
  readonly camera: { readonly anchor: CanonicalWorldAddress; readonly scale: MapScale; readonly depth: 'FAR' | 'MID' | 'NEAR' } | null;
  readonly focusId: string | null;
}
type FieldOutcome = { readonly outcome: string };

/** What a field controller offers, in the words the two production controllers share. */
interface FieldAuthority {
  readonly world: 'PUBLIC' | 'SHARED';
  read(): FieldRead;
  subscribe(listener: () => void): () => void;
  start(): void;
  setEnvelope(envelope: ViewportEnvelope): void;
  pan(tx: number, ty: number): FieldOutcome;
  step(direction: 'IN' | 'OUT', focal: ScreenPoint | null): FieldOutcome;
  tapField(x: number, y: number): void;
  focus(id: string): void;
  back(): boolean;
  /** Read again what is on the glass (only where the read depends on the glass: Public). */
  rereadGlass?(): void;
  /** The entry refusal, where the world has one. */
  refused(): boolean;
  compile(): NasijDrawList;
  card(): NasijCard | null;
  labelOf(id: string): string;
  retire(): void;
}

const FIELD_DEPTHS = ['FAR', 'MID', 'NEAR'] as const;

function createFieldOwner(authority: FieldAuthority, rtl: boolean): NasijWorldOwner {
  const changes = emitter();
  let size: { width: number; height: number } | null = null;
  let lifted = false;
  let worldIndex: NasijPoint[] | null = null;
  let wasReady = false;
  let lastCamera: NasijCamera = HOME;
  let snapshot: NasijWorldSnapshot | null = null;
  const pointOf = (entry: FieldEntry): NasijPoint => ({ id: entry.id, x: toFarX(ORIGIN, entry.address), y: toFarY(ORIGIN, entry.address) });

  /** The envelope the controller projects through: the NASIJ glass, with the anchor where NASIJ draws it (CA-O1). */
  const applyEnvelope = () => {
    if (size === null) return;
    const plain = viewportEnvelope(size.width, size.height);
    if (plain === null) return;
    authority.setEnvelope(lifted ? Object.freeze({ ...plain, anchorY: (size.height - CARD_PEEK) / 2 }) : plain);
  };
  /** After an act: if a card opened or closed, the anchor's place on the glass changed, so the glass is read again. */
  const afterAct = () => {
    const now = authority.read().focusId !== null;
    if (now === lifted) return;
    lifted = now;
    applyEnvelope();
    authority.rereadGlass?.();
  };
  const viewNow = (): NasijView | null => (size === null ? null : { width: size.width, height: size.height, focusX: size.width / 2, focusY: lifted ? (size.height - CARD_PEEK) / 2 : size.height / 2 });

  const unsubscribe = authority.subscribe(() => {
    const read = authority.read();
    // Problem 7: the whole-world evidence is captured ONCE per entry, at the moment the entry's own whole-world read
    // answers (the only publish that turns the field READY), before any viewport read can replace the entries.
    if (read.status === 'READY' && !wasReady) { worldIndex = read.entries.map(pointOf); wasReady = true; }
    if (read.status !== 'READY') wasReady = false;
    snapshot = null;
    changes.emit();
  });

  const build = (): NasijWorldSnapshot => {
    const read = authority.read();
    const refused = authority.refused();
    if (read.camera !== null) lastCamera = nasijCameraOf(read.camera);
    const ready = read.status === 'READY';
    const list = ready ? authority.compile() : EMPTY_LIST(authority.world, 3, rtl);
    return {
      world: authority.world,
      status: refused ? 'REFUSED' : read.status === 'READY' ? 'READY' : read.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'LOADING',
      list, held: null, rungs: 3,
      rung: read.camera === null ? 0 : FIELD_DEPTHS.indexOf(read.camera.depth),
      camera: read.camera === null ? HOME : lastCamera,
      focusId: read.focusId, card: authority.card(), liftsFocus: true,
      shown: ready ? read.entries.map(pointOf) : [],
      worldIndex: ready ? worldIndex : null,
      entityCount: ready ? read.entries.length : 0,
      time: null,
    };
  };
  const current = () => { snapshot ??= build(); return snapshot; };

  return {
    getSnapshot: current,
    subscribe: changes.subscribe,
    enter() {
      worldIndex = null; wasReady = false; lifted = false;
      applyEnvelope();
      snapshot = null;
      authority.start();
      changes.emit();
    },
    setView(width, height) {
      if (size !== null && size.width === width && size.height === height) return;
      size = { width, height };
      applyEnvelope();
    },
    pan(released) {
      const s = current();
      const scale = rungScale(s.rung);
      const tx = (s.camera.cx - released.cx) * scale;
      const ty = (s.camera.cy - released.cy) * scale;
      if (Math.abs(tx) < 0.5 && Math.abs(ty) < 0.5) return false;
      const applied = authority.pan(tx, ty).outcome === 'APPLIED';
      afterAct();
      return applied;
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
      afterAct();
      return { applied, aboutFingers: applied && aboutFingers };
    },
    tap(x, y, released) {
      const s = current();
      const view = viewNow();
      if (view === null || s.status !== 'READY') return 'NONE';
      const hit = nearestHit(s.list, s.rung, released, view, x, y);
      if (hit !== null) { this.focus(hit); return 'FOCUS'; }
      if (s.rung !== 0) return 'NONE';
      // A FAR tap discloses that place at MID, by the controller's own rule. It is handed the screen point (in the
      // canonical camera) of the world point that was tapped.
      const w = unproject(released, view, x, y);
      const p = project(s.camera, view, w.x, w.y);
      authority.tapField(p.x, p.y);
      afterAct();
      return 'FIELD';
    },
    focus(id) {
      if (authority.read().entries.some((entry) => entry.id === id) && !lifted) {
        // The card will open: the controller's glass read must already see the anchor where it will be drawn.
        lifted = true;
        applyEnvelope();
      }
      authority.focus(id);
      afterAct();
    },
    back() {
      let did = authority.back();
      if (!did && current().rung > 0) did = authority.step('OUT', null).outcome === 'APPLIED';
      afterAct();
      return did;
    },
    goTo(x, y) {
      const s = current();
      const scale = rungScale(s.rung);
      const applied = authority.pan((s.camera.cx - x) * scale, (s.camera.cy - y) * scale).outcome === 'APPLIED';
      afterAct();
      return applied;
    },
    labelOf: (id) => authority.labelOf(id),
    dispose() {
      unsubscribe();
      authority.retire();
      changes.clear();
    },
  };
}

function memo<K extends readonly unknown[], V>(compute: () => V): (key: K) => V {
  let last: { key: K; value: V } | null = null;
  return (key) => {
    if (last !== null && last.key.length === key.length && last.key.every((part, i) => part === key[i])) return last.value;
    last = { key, value: compute() };
    return last.value;
  };
}

export function createPublicOwner({ language, fault, latency }: NasijOwnerOptions): NasijWorldOwner {
  const copy = NASIJ_COPY[language];
  const rtl = language === 'ar';
  const controller: PublicFieldController = createPublicFieldController({ transport: createPublicFixtureTransport({ fault, latency }), isCurrent: () => true });
  // The Public ENTRY verdict belongs to another production controller (`createPublicWorldController`), which this
  // proof does not mount. Its refusal is therefore simulated at this seam: the field is simply never entered.
  let refusedAtEntry = false;
  const refusal = emitter();
  const related = () => {
    const panel = controller.getState().focus?.panel;
    return panel?.status === 'SERVED' ? panel.experience.relations.map((relation) => relation.other.id) : [];
  };
  const compiled = memo<readonly unknown[], NasijDrawList>(() => {
    const state = controller.getState();
    return compileNasij(publicScene({ entries: state.entries, focusId: state.focus?.id ?? null, relatedIds: related(), section: state.section.key, rtl }, ORIGIN));
  });
  return createFieldOwner({
    world: 'PUBLIC',
    read: () => {
      const state = controller.getState();
      return { status: state.status, entries: state.entries, camera: state.camera, focusId: state.focus?.id ?? null };
    },
    subscribe: (listener) => { const a = controller.subscribe(listener); const b = refusal.subscribe(listener); return () => { a(); b(); }; },
    start: () => {
      refusedAtEntry = fault() === 'REFUSED';
      if (refusedAtEntry) { refusal.emit(); return; }
      controller.enter();
    },
    setEnvelope: (envelope) => controller.setEnvelope(envelope),
    pan: (tx, ty) => controller.pan(tx, ty),
    step: (direction, focal) => controller.step(direction, focal),
    tapField: (x, y) => controller.tapField(x, y),
    focus: (id) => controller.focus(id),
    back: () => controller.back(),
    rereadGlass: () => controller.revalidate(),
    refused: () => refusedAtEntry,
    compile: () => { const state = controller.getState(); return compiled([state.entries, state.focus?.id ?? null, related().join(','), state.section.key]); },
    card: () => {
      const state = controller.getState();
      const focus = state.focus;
      if (focus === null) return null;
      const held = state.entries.find((entry) => entry.id === focus.id);
      const title = held === undefined ? '' : publicEntryLabel(held);
      if (focus.panel.status !== 'SERVED') return { status: focus.panel.status, title, meta: '', lines: [] };
      const experience = focus.panel.experience;
      return {
        status: 'SERVED', title: publicEntryLabel(experience.entry),
        meta: experience.publisher.label === null ? '' : `${copy.by} ${experience.publisher.label}`,
        lines: experience.content.map((item) => item.text),
      };
    },
    labelOf: (id) => { const entry = controller.getState().entries.find((e) => e.id === id); return entry === undefined ? '' : publicEntryLabel(entry); },
    retire: () => { controller.retire(); refusal.clear(); },
  }, rtl);
}

export function createSharedOwner({ language, fault, latency }: NasijOwnerOptions): NasijWorldOwner {
  const copy = NASIJ_COPY[language];
  const rtl = language === 'ar';
  let denied = false;
  const refusal = emitter();
  const controller: SharedFieldController = createSharedFieldController({
    transport: createSharedFixtureTransport({ fault, latency }, language), isCurrent: () => true,
    // The exact World's authority was refused: production hands this to the Shared area; here it is the REFUSED state.
    onDenied: () => { denied = true; refusal.emit(); },
  });
  const compiled = memo<readonly unknown[], NasijDrawList>(() => {
    const state = controller.getState();
    return compileNasij(sharedScene(state.entries, state.focus?.id ?? null, rtl, ORIGIN));
  });
  return createFieldOwner({
    world: 'SHARED',
    read: () => {
      const state = controller.getState();
      return { status: state.status, entries: state.entries, camera: state.camera, focusId: state.focus?.id ?? null };
    },
    subscribe: (listener) => { const a = controller.subscribe(listener); const b = refusal.subscribe(listener); return () => { a(); b(); }; },
    start: () => { denied = false; controller.forget(SHARED_FIXTURE_WORLD_ID); controller.open(SHARED_FIXTURE_WORLD_ID); },
    setEnvelope: (envelope) => controller.setEnvelope(envelope),
    pan: (tx, ty) => controller.pan(tx, ty),
    step: (direction, focal) => controller.step(direction, focal),
    tapField: (x, y) => controller.tapField(x, y),
    focus: (id) => controller.focus(id),
    back: () => controller.back(),
    refused: () => denied,
    compile: () => { const state = controller.getState(); return compiled([state.entries, state.focus?.id ?? null]); },
    card: () => {
      const state = controller.getState();
      const focus = state.focus;
      if (focus === null) return null;
      const title = state.entries.find((entry) => entry.id === focus.id)?.meaning ?? '';
      if (focus.panel.status !== 'SERVED') return { status: focus.panel.status, title, meta: '', lines: [] };
      const place = focus.panel.place;
      return {
        status: 'SERVED', title: place.entry.meaning,
        meta: `${copy.sources} ${[...place.primaryThemes, ...place.secondaryThemes].join(' · ')}`,
        lines: place.sources.map((source) => source.text),
      };
    },
    labelOf: (id) => controller.getState().entries.find((e) => e.id === id)?.meaning ?? '',
    retire: () => { controller.retire(); refusal.clear(); },
  }, rtl);
}

// ── Personal ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** A Personal mark's id back to the production inspection request: `THREAD:<id>` or `READING:<id>@<bindingId>`. */
function inspectionRequestOf(markId: string): { family: 'THREAD'; id: string } | { family: 'READING'; id: string; appearance: { kind: 'THREAD_READING'; bindingId: string } } | null {
  if (markId.startsWith('THREAD:')) return { family: 'THREAD', id: markId.slice('THREAD:'.length) };
  if (markId.startsWith('READING:')) {
    const at = markId.lastIndexOf('@');
    if (at <= 'READING:'.length) return null;
    return { family: 'READING', id: markId.slice('READING:'.length, at), appearance: { kind: 'THREAD_READING', bindingId: markId.slice(at + 1) } };
  }
  return null;
}

export function createPersonalOwner({ language, fault, latency }: NasijOwnerOptions): NasijWorldOwner {
  const copy = NASIJ_COPY[language];
  const rtl = language === 'ar';
  const changes = emitter();
  let runtime: IntegrationRuntime | null = null;
  let session: IntegrationSessionRuntime | null = null;
  let detach: (() => void)[] = [];
  let size: { width: number; height: number } | null = null;
  let snapshot: NasijWorldSnapshot | null = null;
  /** The viewpoint whose read ENDED without an answer (a failed read is not "still loading"; QAN-BL-MOB-05's rule). */
  let unanswered: string | null = null;
  let failed = false;
  const invalidate = () => { snapshot = null; changes.emit(); };
  const keyOf = (r: { sessionId: string; tc: number; depth: string }) => `${r.sessionId}|${r.tc}|${r.depth}`;

  /** Ask for the current viewpoint and for the other four rungs, so the layers of held rungs exist. One cache; idempotent. */
  const ensureAll = () => {
    const live = session;
    if (live === null) return;
    const request = mapProjectionRequest(live.store.getState());
    if (request === null) return;
    const ordered = [request.depth, ...PERSONAL_DEPTHS.filter((depth) => depth !== request.depth)];
    for (const depth of ordered) {
      const asked = { sessionId: request.sessionId, tc: request.tc, depth };
      void live.projection.ensure(asked).then((outcome) => {
        if (session !== live) return;
        if (depth === request.depth && (outcome === 'NOT_FETCHED' || outcome === 'NOT_AUTHENTICATED' || outcome === 'IDENTITY_MISMATCH')) {
          unanswered = keyOf(asked);
          invalidate();
        }
      });
    }
  };

  const attach = (next: IntegrationSessionRuntime) => {
    session = next;
    detach.push(next.store.subscribe(() => { ensureAll(); invalidate(); }));
    detach.push(next.projection.subscribe(invalidate));
    ensureAll();
    invalidate();
  };
  const release = () => {
    for (const off of detach) off();
    detach = [];
    session = null;
    runtime?.dispose();
    runtime = null;
  };

  const contexts = (live: IntegrationSessionRuntime): { request: NonNullable<ReturnType<typeof mapProjectionRequest>> | null; byRung: (MapInspectionContext | null)[] } => {
    const request = mapProjectionRequest(live.store.getState());
    if (request === null) return { request: null, byRung: PERSONAL_DEPTHS.map(() => null) };
    return {
      request,
      byRung: PERSONAL_DEPTHS.map((depth) => {
        const at = { sessionId: request.sessionId, tc: request.tc, depth };
        // The production derivation, per rung: T-04's own context, or nothing at all when it refuses.
        const resolved = mapInspectionContext(live.bundle.projection.lookup(at.sessionId, at.tc, at.depth), at);
        return resolved.ok ? resolved.context : null;
      }),
    };
  };

  const compiled = memo<readonly unknown[], { list: NasijDrawList; held: boolean[]; inputs: (NasijSceneInput | null)[] }>(() => {
    const live = session as IntegrationSessionRuntime;
    const { byRung } = contexts(live);
    const ref = decodeInspectionRef(live.store.getState().inspection);
    const inspected = ref === null ? null : `${ref.family}:${ref.id}${ref.appearance === null ? '' : `@${ref.appearance.bindingId}`}`;
    const inputs = byRung.map((context) => (context === null ? null : personalScene(context.scene, inspected, rtl, ORIGIN)));
    return { ...personalDrawList(inputs), inputs };
  });

  const loading = (status: NasijWorldSnapshot['status']): NasijWorldSnapshot => ({
    world: 'PERSONAL', status, list: EMPTY_LIST('PERSONAL', PERSONAL_DEPTHS.length, rtl), held: PERSONAL_DEPTHS.map(() => false), rungs: PERSONAL_DEPTHS.length, rung: 0,
    camera: HOME, focusId: null, card: null, liftsFocus: false, shown: [], worldIndex: null, entityCount: 0, time: null,
  });

  const build = (): NasijWorldSnapshot => {
    const live = session;
    if (live === null) return loading(failed ? 'UNAVAILABLE' : 'LOADING');
    const state = live.store.getState();
    const request = mapProjectionRequest(state);
    const decoded = currentCamera(live.store);
    if (request === null || !decoded.ok) return loading('LOADING');
    const entry = live.bundle.projection.lookup(request.sessionId, request.tc, request.depth);
    const status: NasijWorldSnapshot['status'] = entry.status === 'FETCHED' ? 'READY'
      : entry.status === 'UNAVAILABLE' ? (entry.code === 'SESSION_NOT_VISIBLE' ? 'REFUSED' : 'UNAVAILABLE')
        : unanswered === keyOf(request) ? 'UNAVAILABLE' : 'LOADING';
    const { list, held, inputs } = compiled([live, live.projection.revision(), state.inspection, request.sessionId, request.tc]);
    const rung = PERSONAL_DEPTHS.indexOf(request.depth);
    const points = (input: NasijSceneInput | null): NasijPoint[] => (input === null ? [] : input.entities.map((e) => ({ id: e.id, x: e.x, y: e.y })));
    const ref = decodeInspectionRef(state.inspection);
    const focusId = inputs[rung]?.focusId ?? null;
    return {
      world: 'PERSONAL', status, list, held, rungs: PERSONAL_DEPTHS.length, rung, camera: nasijCameraOf(decoded.camera),
      focusId,
      // The Personal card names the object's family and how it is placed, and says what the production chrome says of
      // an inspection this view does not resolve. No name is invented.
      card: ref === null ? null : {
        status: 'SERVED', title: ref.family === 'THREAD' ? copy.thread : ref.family === 'READING' ? copy.reading : ref.family,
        meta: ref.family === 'THREAD' ? copy.home : ref.family === 'READING' ? copy.hosted : '',
        lines: [inspectionSentence(language, { kind: 'INSPECTION_NOT_RESOLVED' })],
      },
      liftsFocus: false,
      shown: status === 'READY' ? points(inputs[rung]) : [],
      // The WORLD rung is a read of the whole authorised world at this time (no rectangle), so it is whole-world evidence.
      worldIndex: status === 'READY' && inputs[0] !== null ? points(inputs[0]) : null,
      entityCount: inputs[rung]?.entities.length ?? 0,
      time: state.live.LH === null ? null : { liveHead: state.live.LH, tc: effectiveTC(state) ?? state.live.LH, pinned: state.temporal.kind === 'PINNED', fringe: list.fringe },
    };
  };
  const current = () => { snapshot ??= build(); return snapshot; };
  const viewNow = (): NasijView | null => (size === null ? null : { width: size.width, height: size.height, focusX: size.width / 2, focusY: size.height / 2 });

  const inspect = (markId: string): boolean => {
    const live = session;
    const request = inspectionRequestOf(markId);
    if (live === null || request === null) return false;
    const at = contexts(live);
    const context = at.request === null ? null : at.byRung[PERSONAL_DEPTHS.indexOf(at.request.depth)];
    if (context === null) return false;
    // The executor the pointer tap and the accessible "inspect" action call. It writes IF_ref and no camera.
    return inspectObject(live.store, context, request).outcome === 'APPLIED';
  };

  return {
    getSnapshot: current,
    subscribe: changes.subscribe,
    enter() {
      release();
      unanswered = null; failed = false;
      const world = createPersonalFixtureWorld({ fault, latency }, language);
      const built = createIntegrationRuntime({
        config: world.config, authPort: world.auth, httpFetch: world.fetch, foreground: createManualForegroundSignal('INACTIVE'),
        // Nothing of the device is touched by the proof: no SQLite, no microphone, no push registration, no appearance write.
        recoveryStorage: createEphemeralProductRecoveryStorage(), appearanceStore: createEphemeralAppearancePreferenceStore(),
        nativeAppearance: { apply: () => undefined }, voiceNoteDevice: createInertVoiceNoteDevice(),
        pushPlatform: createInertPushPlatformPort(), pushDeviceStore: createEphemeralPushDeviceStore({ declined: true }),
      });
      if (!built.ok) { failed = true; invalidate(); return; }
      const mine = built.runtime;
      runtime = mine;
      const onPhase = () => {
        if (runtime !== mine) return;
        const phase = mine.getPhase();
        if (phase.kind === 'READY') { if (session !== phase.runtime) { for (const off of detach.splice(1)) off(); attach(phase.runtime); } return; }
        if (phase.kind === 'BOOTSTRAP_FAILED' || phase.kind === 'RECOVERY_FAILED' || phase.kind === 'AUTH_ERROR' || phase.kind === 'SIGNED_OUT') { failed = true; invalidate(); }
      };
      detach.push(mine.subscribe(onPhase));
      invalidate();
      void mine.start().then(onPhase);
    },
    setView(width, height) { size = { width, height }; },
    pan(released) {
      const live = session;
      if (live === null) return false;
      const s = current();
      const scale = rungScale(s.rung);
      const tx = (s.camera.cx - released.cx) * scale;
      const ty = (s.camera.cy - released.cy) * scale;
      if (Math.abs(tx) < 0.5 && Math.abs(ty) < 0.5) return false;
      return panByTranslation(live.store, tx, ty).outcome === 'APPLIED';
    },
    step(direction, focal, released) {
      const live = session;
      if (live === null) return { applied: false, aboutFingers: false };
      const s = current();
      const view = viewNow();
      const next = s.rung + (direction === 'IN' ? 1 : -1);
      const envelope = size === null ? null : viewportEnvelope(size.width, size.height);
      let point: ScreenPoint | null = null;
      if (focal !== null && released !== null && view !== null && envelope !== null && next >= 0 && next < PERSONAL_DEPTHS.length) {
        point = gestureFixedPoint(s.camera, released, view, focal, rungScale(s.rung), rungScale(next));
      }
      const applied = zoomSemanticStep(live.store, direction, point === null || envelope === null ? null : { envelope, point }).outcome === 'APPLIED';
      return { applied, aboutFingers: applied && point !== null };
    },
    tap(x, y, released) {
      const s = current();
      const view = viewNow();
      if (view === null || s.status !== 'READY') return 'NONE';
      const hit = nearestHit(s.list, s.rung, released, view, x, y);
      if (hit === null) return 'NONE';
      inspect(hit);
      return 'FOCUS';
    },
    focus(id) { inspect(id); },
    back() {
      const live = session;
      // Production Back: one step of the recorded history (T-07), which restores the viewpoint the last act left.
      return live !== null && backOneStep(live.returnSurface).outcome === 'APPLIED';
    },
    goTo(x, y) {
      const live = session;
      if (live === null) return false;
      const s = current();
      const scale = rungScale(s.rung);
      return panByTranslation(live.store, (s.camera.cx - x) * scale, (s.camera.cy - y) * scale).outcome === 'APPLIED';
    },
    labelOf: (id) => (id.startsWith('THREAD:') ? `${copy.thread} · ${copy.home}` : `${copy.reading} · ${copy.hosted}`),
    commitMoment(sp) { if (session !== null) commitMoment(session.store, sp); },
    goLive() { if (session !== null) commitLiveEdge(session.store); },
    dispose() {
      release();
      changes.clear();
    },
  };
}

export function createNasijOwner(world: NasijWorldKind, options: NasijOwnerOptions): NasijWorldOwner {
  return world === 'PUBLIC' ? createPublicOwner(options) : world === 'SHARED' ? createSharedOwner(options) : createPersonalOwner(options);
}
