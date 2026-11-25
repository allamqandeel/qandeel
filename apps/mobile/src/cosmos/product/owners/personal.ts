/**
 * COSMOS-INT-01 Slice B — the Personal world's owner: the COSMOS stage over the PRODUCTION integration runtime the
 * Product composition holds (its canonical store, its ONE projection cache, T-04's executors, T-07's history).
 *
 * The owner attaches to the runtime it is given and creates nothing: the store it reads is the store every other
 * surface reads, and every act it dispatches is the act the old Map dispatched for the same gesture — one completed
 * drag is one `PAN`, one finished pinch (or double tap, D-9) is one `ZOOM_SEMANTIC` with its focal, one tap on a mark is
 * one `INSPECT_OBJECT` through T-04's own entitlement. Every outcome is handed to the composition's observer, so the
 * inspection journey (T-12 §11) and the composite spatial cause (T-12 §15) see exactly the step they saw before.
 *
 * Reads: the viewpoint's own depth is read by the Product composition, exactly as before — it is the one that tells a
 * read that ENDED without an answer from one still on its way (QAN-BL-MOB-05), and the coordinator answers `IN_FLIGHT`
 * to a second asker, so the owner never pre-empts it. The owner asks the ONE cache only for the OTHER four rungs of the
 * same viewpoint (so the layers around the reader's own exist), once per viewpoint, never per store change; a rung the
 * client does not hold is reported unheld and drawn as nothing.
 *
 * G-6: an object the derivation disclosed with NO place (an EMERGING_FOCUS, a Reading without a current appearance) is
 * listed as `unplaced` and never given a place; the host shows it in a register the reader can inspect from, with the
 * T-08 family word and nothing invented. The Personal map names nothing (N4 is not authorised): the accessible label of
 * a mark is the family word alone.
 *
 * INTEL-LIVE-01 CP2 (D-5): while a call runs, its provisional attention (the call owner's layer, from what the server
 * disclosed) is folded into every rung's scene as `attention`: a subject on one of the person's Threads names that body;
 * any other is an ember. The person's attention and QANDEEL's stay distinct subjects. No call, or an empty layer, leaves the
 * scenes exactly as before.
 */

import { analysisCopy, type AnalysisLanguage } from '../../../analysis-language';
import type { IntegrationSessionRuntime } from '../../../integration';
import { currentCamera, panByTranslation, zoomSemanticStep, type ScreenPoint, type ViewportEnvelope } from '../../../map/camera';
import { decodeInspectionRef, inspectObject, mapInspectionContext, type MapInspectionContext } from '../../../map/inspection';
import type { MapActionOutcome } from '../../../map/outcome';
import { mapProjectionRequest } from '../../../map/projection';
import type { CameraIntent } from '../../../state';
import { PERSONAL_DEPTHS, personalDrawList, personalScene } from '../../core/adapters';
import type { NasijView } from '../../core/camera';
import { rungScale, type AttentionMark, type SceneInput, type Stage } from '../../core/stage';
import type { ProvisionalAttentionLayer } from '../../../call/provisional-attention';
import {
  EMPTY_LIST, HOME, ORIGIN, aimFixedPoint, cosmosCameraOf, emitter, gestureFixedPoint, memo, nearestHit, soleHit, viewOf,
  type CosmosPoint, type CosmosUnplaced, type CosmosWorldOwner, type CosmosWorldSnapshot,
} from '../owner-core';

export interface PersonalCosmosOwnerOptions {
  readonly runtime: IntegrationSessionRuntime;
  readonly language: AnalysisLanguage;
  /** Every completed act's outcome, for the inspection journey — the same step the old renderer reported (T-12 §11). */
  readonly onOutcome?: (outcome: MapActionOutcome) => void;
  /**
   * Asked once per canonical camera change, with the destination (T-12 §15). Under D-5 the COSMOS motion wins and the
   * answer steers nothing; asking is what consumes the composite binding, so an unrelated act retires it as before.
   */
  readonly spatialCause?: (destination: CameraIntent) => unknown;
}

/** A Personal mark's id back to the production inspection request: `THREAD:<id>`, `READING:<id>@<bindingId>`, or an unplaced `${family}:<id>`. */
export function inspectionRequestOf(markId: string): { family: 'THREAD' | 'EMERGING_FOCUS'; id: string } | { family: 'READING'; id: string; appearance?: { kind: 'THREAD_READING'; bindingId: string } } | null {
  if (markId.startsWith('THREAD:')) return { family: 'THREAD', id: markId.slice('THREAD:'.length) };
  if (markId.startsWith('EMERGING_FOCUS:')) return { family: 'EMERGING_FOCUS', id: markId.slice('EMERGING_FOCUS:'.length) };
  if (markId.startsWith('READING:')) {
    const at = markId.lastIndexOf('@');
    // An unplaced Reading has no appearance: the then-current version at TC, which the kernel stores exactly.
    if (at < 0) return { family: 'READING', id: markId.slice('READING:'.length) };
    if (at <= 'READING:'.length) return null;
    return { family: 'READING', id: markId.slice('READING:'.length, at), appearance: { kind: 'THREAD_READING', bindingId: markId.slice(at + 1) } };
  }
  return null;
}

/** The names the server disclosed for this context's Threads (COSMOS E-2 Slice A): alias or grounding wording, never invented. */
/** INTEL-LIVE-01 CP2: the call's layer as stage marks (oldest first; the stage draws the newest it can). */
export function attentionMarksOf(layer: ProvisionalAttentionLayer): readonly AttentionMark[] | undefined {
  if (layer.marks.length === 0) return undefined;
  return layer.marks.map((m) => ({
    subjectKey: `${m.track}:${m.subjectKey}`, label: m.label, entityId: m.threadRef === null ? null : `THREAD:${m.threadRef}`, confidence: m.confidence,
  }));
}

function threadNames(context: MapInspectionContext): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const thread of context.disclosure.world.threads) if (thread.name.text !== null) names.set(thread.id, thread.name.text);
  return names;
}

export function createPersonalCosmosOwner({ runtime, language, onOutcome, spatialCause }: PersonalCosmosOwnerOptions): CosmosWorldOwner {
  const copy = analysisCopy(language);
  const rtl = language === 'ar';
  const changes = emitter();
  const { store, projection, bundle, call } = runtime;
  let glass: ViewportEnvelope | null = null;
  let snapshot: CosmosWorldSnapshot | null = null;
  let lastCameraIntent: CameraIntent | null = store.getState().camera;
  let lastViewpoint: string | null = null;
  const invalidate = () => { snapshot = null; changes.emit(); };
  const keyOf = (r: { sessionId: string; tc: number; depth: string }) => `${r.sessionId}|${r.tc}|${r.depth}`;
  const report = (outcome: MapActionOutcome): boolean => { onOutcome?.(outcome); return outcome.outcome === 'APPLIED'; };

  /**
   * The OTHER four rungs of the viewpoint, asked of the ONE cache once per viewpoint (idempotent per key). The viewpoint's
   * own depth is the composition's read, never asked here (see the header).
   */
  const ensureOthers = () => {
    const request = mapProjectionRequest(store.getState());
    const viewpoint = request === null ? null : keyOf(request);
    if (request === null || viewpoint === lastViewpoint) return;
    lastViewpoint = viewpoint;
    for (const depth of PERSONAL_DEPTHS) {
      if (depth !== request.depth) void projection.ensure({ sessionId: request.sessionId, tc: request.tc, depth });
    }
  };

  const detach = [
    store.subscribe(() => {
      // The canonical camera changed: the composite binding is asked (and consumed) with the destination it names.
      const camera = store.getState().camera;
      if (camera !== lastCameraIntent) { lastCameraIntent = camera; spatialCause?.(camera); }
      ensureOthers();
      invalidate();
    }),
    projection.subscribe(invalidate),
    call.subscribeAttention(invalidate),
  ];
  ensureOthers();

  const contexts = (): { request: NonNullable<ReturnType<typeof mapProjectionRequest>> | null; byRung: (MapInspectionContext | null)[] } => {
    const request = mapProjectionRequest(store.getState());
    if (request === null) return { request: null, byRung: PERSONAL_DEPTHS.map(() => null) };
    return {
      request,
      byRung: PERSONAL_DEPTHS.map((depth) => {
        const at = { sessionId: request.sessionId, tc: request.tc, depth };
        // The production derivation, per rung: T-04's own context, or nothing at all when it refuses.
        const resolved = mapInspectionContext(bundle.projection.lookup(at.sessionId, at.tc, at.depth), at);
        return resolved.ok ? resolved.context : null;
      }),
    };
  };

  const compiled = memo<readonly unknown[], { list: Stage; held: boolean[]; inputs: (SceneInput | null)[]; unplaced: CosmosUnplaced[] }>(() => {
    const { request, byRung } = contexts();
    const ref = decodeInspectionRef(store.getState().inspection);
    const inspected = ref === null ? null : `${ref.family}:${ref.id}${ref.appearance === null ? '' : `@${ref.appearance.bindingId}`}`;
    const attention = attentionMarksOf(call.getAttention());
    const inputs = byRung.map((context) => {
      if (context === null) return null;
      const scene = personalScene(context.scene, inspected, rtl, ORIGIN, threadNames(context));
      return attention === undefined ? scene : { ...scene, attention };
    });
    const here = request === null ? null : byRung[PERSONAL_DEPTHS.indexOf(request.depth)];
    const unplaced: CosmosUnplaced[] = here === null ? [] : here.scene.objects.filter((object) => object.loci.length === 0).map((object) => ({ id: object.key, family: object.family }));
    return { ...personalDrawList(inputs), inputs, unplaced };
  });

  const loading = (status: CosmosWorldSnapshot['status']): CosmosWorldSnapshot => ({
    world: 'PERSONAL', status, list: EMPTY_LIST('PERSONAL', PERSONAL_DEPTHS.length, rtl), held: PERSONAL_DEPTHS.map(() => false), rungs: PERSONAL_DEPTHS.length, rung: 0,
    camera: HOME, focusId: null, inspectedId: null, shown: [], worldIndex: null, entityCount: 0, unplaced: [], relations: [],
  });

  const build = (): CosmosWorldSnapshot => {
    const state = store.getState();
    const request = mapProjectionRequest(state);
    const decoded = currentCamera(store);
    if (request === null || !decoded.ok) return loading('LOADING');
    const entry = bundle.projection.lookup(request.sessionId, request.tc, request.depth);
    // A read not held is LOADING to the stage, which says nothing for it either way: the production chrome (T-08) is
    // what tells a reader that a read failed, exactly as before.
    const status: CosmosWorldSnapshot['status'] = entry.status === 'FETCHED' ? 'READY' : entry.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'LOADING';
    const { list, held, inputs, unplaced } = compiled([projection.revision(), state.inspection, request.sessionId, request.tc, request.depth, call.getAttention().marks]);
    const rung = PERSONAL_DEPTHS.indexOf(request.depth);
    const points = (input: SceneInput | null): CosmosPoint[] => (input === null ? [] : input.entities.map((e) => ({ id: e.id, x: e.x, y: e.y })));
    const ref = decodeInspectionRef(state.inspection);
    return {
      world: 'PERSONAL', status, list, held, rungs: PERSONAL_DEPTHS.length, rung, camera: cosmosCameraOf(decoded.camera),
      focusId: inputs[rung]?.focusId ?? null,
      inspectedId: ref === null ? null : `${ref.family}:${ref.id}`,
      shown: status === 'READY' ? points(inputs[rung]) : [],
      // The WORLD rung is a read of the whole authorised world at this time (no rectangle), so it is whole-world evidence.
      worldIndex: status === 'READY' && inputs[0] !== null ? points(inputs[0]) : null,
      entityCount: inputs[rung]?.entities.length ?? 0,
      unplaced: status === 'READY' ? unplaced : [],
      relations: [],
    };
  };
  const current = () => { snapshot ??= build(); return snapshot; };
  const viewNow = (): NasijView | null => (glass === null ? null : viewOf(glass));

  const inspect = (markId: string): boolean => {
    const request = inspectionRequestOf(markId);
    if (request === null) return false;
    const at = contexts();
    const context = at.request === null ? null : at.byRung[PERSONAL_DEPTHS.indexOf(at.request.depth)];
    if (context === null) return false;
    // The executor the pointer tap and the accessible "inspect" action call. It writes IF_ref and no camera.
    return report(inspectObject(store, context, request));
  };

  return {
    getSnapshot: current,
    subscribe: changes.subscribe,
    setGlass(next) { glass = next; },
    pan(released) {
      const s = current();
      const scale = rungScale(s.rung);
      const tx = (s.camera.cx - released.cx) * scale;
      const ty = (s.camera.cy - released.cy) * scale;
      if (Math.abs(tx) < 0.5 && Math.abs(ty) < 0.5) return false;
      return report(panByTranslation(store, tx, ty));
    },
    step(direction, focal, released, aim) {
      const s = current();
      const view = viewNow();
      const next = s.rung + (direction === 'IN' ? 1 : -1);
      let point: ScreenPoint | null = null;
      if (focal !== null && released !== null && view !== null && glass !== null && next >= 0 && next < PERSONAL_DEPTHS.length) {
        point = gestureFixedPoint(s.camera, released, view, focal, rungScale(s.rung), rungScale(next));
        // Target centring (PO, 2026-11-16; contract §18): a pinch IN whose fingers rest on ONE disclosed mark takes the
        // same one step about the point that brings that mark, where the next rung draws it, to the usable centre. No
        // mark, two marks, a rung not held, a mark the next rung does not draw, OUT, a double tap or the accessible
        // route: the step stays about the fingers, exactly as before.
        if (direction === 'IN' && aim != null && s.status === 'READY' && s.held?.[next] === true) {
          const id = soleHit(s.list, s.rung, released, view, focal.x, focal.y);
          const there = id === null ? undefined : s.list.layers[next]?.hits.find((h) => h.id === id);
          if (there !== undefined) point = aimFixedPoint(s.camera, view, there, aim, rungScale(s.rung), rungScale(next)) ?? point;
        }
      }
      const applied = report(zoomSemanticStep(store, direction, point === null || glass === null ? null : { envelope: glass, point }));
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
    // The stage's Back names the shallower rung it returns to: one `ZOOM_SEMANTIC` out. T-07's history Back keeps its
    // one home in the T-08 chrome's Return controls, with its own words (Slice B decision B-1, for the Product Owner).
    back() {
      if (current().rung === 0) return false;
      return report(zoomSemanticStep(store, 'OUT'));
    },
    goTo(x, y) {
      const s = current();
      const scale = rungScale(s.rung);
      return report(panByTranslation(store, (s.camera.cx - x) * scale, (s.camera.cy - y) * scale));
    },
    // The accessible label is the T-08 family word; a Thread the SERVER named (COSMOS E-2 Slice A, D-3 / D-4: the person's
    // alias, else their grounding wording) carries that name after it. Nothing is invented here (N4 is not authorised).
    labelOf: (id) => {
      const family = id.split(':')[0];
      if (family !== 'THREAD' && family !== 'READING' && family !== 'EMERGING_FOCUS') return '';
      if (family !== 'THREAD') return copy.family[family];
      const { request, byRung } = contexts();
      const here = request === null ? null : byRung[PERSONAL_DEPTHS.indexOf(request.depth)];
      const name = here === null ? undefined : threadNames(here).get(id.slice('THREAD:'.length));
      return name === undefined ? copy.family.THREAD : `${copy.family.THREAD} · ${name}`;
    },
    dispose() {
      for (const off of detach) off();
      changes.clear();
    },
  };
}
