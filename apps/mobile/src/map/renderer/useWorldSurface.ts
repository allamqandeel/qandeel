/**
 * S5-03B Phase 1 — the generic mechanics of a Living Analysis World surface, extracted from `MapSurface` without
 * changing what they do: one presentation camera, the travel / drag corridor that decides what may be on the glass,
 * the rebase that keeps paint, pointer and act on one frame, and the membership record that tells an arrival from
 * navigation. The reasoning behind each of them is unchanged and lives beside the code that carries it.
 *
 * Two hooks, called at the two places `MapSurface` always performed this work, so every effect still runs in the
 * order it did:
 *
 *   `useWorldMotion`  the presentation camera and the corridor it reports into;
 *   `useWorldFrame`   what this commit does about the camera, what may be painted, what just arrived, and which
 *                     drawn node a point on the glass is.
 *
 * Neither reads a canonical store, Personal state, a disclosure or an inspection. The owner names its authority
 * (any identity: a replaced owner drops the residual and the record, exactly as a replaced store does), its
 * camera, its placement and its membership; what a node IS stays the owner's.
 */
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';

import {
  RESIDUAL_ENVELOPE_AT_REST,
  createArrivalRegistry,
  createBox,
  envelopeHull,
  expandedEnvelope,
  isPresentedWithinEnvelope,
  newlyDisclosedKeys,
  rebasedEnvelope,
  residualEnvelope,
  usePresentationCamera,
  type ArrivalRegistry,
  type PresentationCameraBinding,
  type PresentationMotionCause,
  type PresentationResidualEnvelope,
} from '../../motion';
import { cameraTransition, envelopeCenter, type ViewportEnvelope, type WorldViewCamera } from '../camera';
import { CULL_MARGIN_POINTS, hitTest } from './map-geometry';
import type { CanonicalCameraCommit, WorldNodeRegion } from './WorldCanvas';

/** What the surface needs of one placed node to cull it and hit it. */
export interface WorldSurfaceNode {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly region: WorldNodeRegion;
}

/** A record held outside React state (the motion runtime's box). */
interface RecordBox<T> {
  get(): T;
  set(next: T): void;
}

/** Which authority and which camera the last accepted commit was drawn under. */
interface CameraHistory<C extends WorldViewCamera> {
  readonly owner: object;
  readonly camera: C;
}

export interface WorldMotion<C extends WorldViewCamera> {
  readonly motion: PresentationCameraBinding;
  readonly center: { readonly x: number; readonly y: number };
  readonly arrivals: ArrivalRegistry;
  /**
   * S5-03B Phase 2 — whether the plane is at rest: no travel and no drag holds a corridor open. Class D, read from
   * the corridor itself, so an owner's screen-space chrome laid over the plane can wait for the world to settle.
   */
  readonly atRest: boolean;
  /** @internal the records `useWorldFrame` reads and writes. */
  readonly records: {
    readonly cameraHistory: RecordBox<CameraHistory<C> | null>;
    readonly disclosureHistory: RecordBox<ReadonlySet<string> | null>;
    readonly corridor: PresentationResidualEnvelope;
    readonly setCorridor: (update: (current: PresentationResidualEnvelope) => PresentationResidualEnvelope) => void;
  };
}

/** The presentation camera of one world surface, and the corridor it reports into. */
export function useWorldMotion<C extends WorldViewCamera>(envelope: ViewportEnvelope): WorldMotion<C> {
  const center = useMemo(() => envelopeCenter(envelope), [envelope]);
  const diagonalPoints = useMemo(() => Math.hypot(envelope.width, envelope.height), [envelope.width, envelope.height]);

  // Three records with deliberately different lifetimes, held in boxes rather than state: none is
  // rendering input in its own right, and flipping state from an effect would cost a cascading
  // render per commit to say something that changes nothing about what is drawn.
  const [cameraHistory] = useState(() => createBox<CameraHistory<C> | null>(null));
  const [disclosureHistory] = useState(() => createBox<ReadonlySet<string> | null>(null));
  const [cameraBox] = useState(() => createBox<PresentationCameraBinding | null>(null));
  const [arrivals] = useState(() => createArrivalRegistry());
  // The corridor IS rendering input — it decides what is painted — so unlike the two records above
  // it is state. Every writer returns the current value unchanged when nothing moved, so React bails
  // out and an idle world costs no render at all.
  const [corridor, setCorridor] = useState<PresentationResidualEnvelope>(RESIDUAL_ENVELOPE_AT_REST);

  // R3-02a — the corridor retires when the presentation actually stops.
  //
  // Without this the widened candidate set of the LAST movement stays alive for as long as the
  // surface does: the documented travel is ≤540 ms, but nothing ever narrowed the corridor again, so
  // an idle world went on paying for a journey it finished long ago. This is Class D and nothing
  // else — it dispatches nothing, writes no canonical state, names no target, and cannot change what
  // exists or where the camera is. It only says: the extra candidates are no longer needed.
  const retireTravelCorridor = useCallback(
    (restEpoch: number) => {
      const binding = cameraBox.get();
      // A notification that lost a race to a newer motion is discarded rather than applied: the
      // plane it described is not the plane on the glass.
      if (binding === null || restEpoch !== binding.epoch.get()) return;
      setCorridor((current) => (envelopesEqual(current, RESIDUAL_ENVELOPE_AT_REST) ? current : RESIDUAL_ENVELOPE_AT_REST));
    },
    [cameraBox],
  );

  // R4 — a DRAG opens a corridor too, and this is the half that was missing.
  //
  // A travel declares its whole path when it is authorized, so `commitCamera` below can open a
  // corridor that already contains every frame of it. A drag declares nothing: no canonical camera
  // changes until the finger lifts, so nothing widened the corridor and `presented` went on being
  // computed against the RESTING viewport for the entire gesture. Measured on a device: the leading
  // edge of the glass was blank while the reader dragged — two whole slices of the world at zero ink —
  // and every object the drag had brought on screen appeared at once at the moment of release.
  //
  // The plane now reports where it has got to, once per cull margin of travel, and the corridor is
  // hulled with a band around that position. Painting a margin ahead of the hand is the same idea the
  // cull margin already expresses; it simply has to follow the hand instead of the resting viewport.
  // It is state, like the travel corridor, and it retires with it at rest, so an idle world is
  // unchanged and the cost is bounded by how far the reader actually dragged.
  const advancePresentation = useCallback(
    (tx: number, ty: number, residualZoom: number, padPlaneUnits: number, advanceEpoch: number) => {
      const binding = cameraBox.get();
      // A report that lost a race to a newer motion describes a plane that is no longer on the glass.
      if (binding === null || advanceEpoch !== binding.epoch.get()) return;
      const reached = expandedEnvelope(residualEnvelope({ tx, ty, zoom: residualZoom }), padPlaneUnits);
      setCorridor((current) => {
        const next = envelopeHull(current, reached);
        return envelopesEqual(current, next) ? current : next;
      });
    },
    [cameraBox],
  );

  const motion = usePresentationCamera({
    center,
    diagonalPoints,
    onTravelCorridorRetired: retireTravelCorridor,
    onPresentationAdvanced: advancePresentation,
    // The renderer's own margin, so the plane reports exactly as often as the painted band allows and
    // there is no second number to keep in step with this one.
    advancePoints: CULL_MARGIN_POINTS,
  });
  useLayoutEffect(() => {
    cameraBox.set(motion);
  }, [cameraBox, motion]);

  return {
    motion,
    center,
    arrivals,
    atRest: envelopesEqual(corridor, RESIDUAL_ENVELOPE_AT_REST),
    records: { cameraHistory, disclosureHistory, corridor, setCorridor },
  };
}

export interface WorldFrameInput<C extends WorldViewCamera, N extends WorldSurfaceNode> {
  /** The authority this surface draws under. A different identity is a replaced authority. */
  readonly owner: object;
  readonly camera: C | null;
  readonly envelope: ViewportEnvelope;
  /** The full current placement, or `null` while the owner has nothing it may draw. */
  readonly placed: { readonly nodes: readonly N[] } | null;
  /** The node keys of the current accepted projection, or `null` in a technical gap (the record survives it). */
  readonly membership: ReadonlySet<string> | null;
  /** The composite spatial cause of the transition being applied, asked once, at apply time. */
  readonly cause: () => PresentationMotionCause | null;
}

export interface WorldFrame<N extends WorldSurfaceNode> {
  readonly cameraCommit: CanonicalCameraCommit;
  /** What the motion could still put on the glass. */
  readonly presented: readonly N[];
  readonly newlyDisclosed: ReadonlySet<string>;
  /** The drawn node under a point on the glass, through the SAME residual and arrival progress it is painted at. */
  readonly nodeAt: (x: number, y: number) => N | null;
}

/** What one commit of a world surface does about its camera, and what it may paint. */
export function useWorldFrame<C extends WorldViewCamera, N extends WorldSurfaceNode>(
  { motion, center, arrivals, records: { cameraHistory, disclosureHistory, corridor, setCorridor } }: WorldMotion<C>,
  { owner, camera, envelope, placed, membership, cause }: WorldFrameInput<C, N>,
): WorldFrame<N> {
  // What this commit does about the canonical camera, and what the presented viewport is while it
  // does it. Read during render because the presented set is rendering input; applied inside the
  // Skia root, after the positions it preserves.
  const history = cameraHistory.get();
  const authorityReplaced = history !== null && history.owner !== owner;
  const cameraChanged = history !== null && !authorityReplaced && history.camera !== camera && camera !== null;
  const transition = cameraChanged && history !== null && camera !== null ? cameraTransition(history.camera, camera, envelope) : null;

  // R3-02b — the corridor is REBASED, exactly as the camera rebases the residual it is showing.
  //
  // The previous version rebased `RESIDUAL_AT_REST` through the new transition, which assumes the
  // plane was already home. Mid-flight it is not, and the camera itself rebases from the live
  // residual — so paint motion and culling continuity started from two different frames, and the
  // renderer could cull an object that was on the glass at the exact retarget commit.
  //
  // Carrying an envelope rather than one residual removes the disagreement without reading a shared
  // value during render and without a per-frame bridge: whatever the plane is actually showing lies
  // inside the corridor by construction, the rebase is affine so it maps the corridor exactly, and
  // the destination — always rest — is added to it. One presentation state, two readers.
  const travelCorridor: PresentationResidualEnvelope =
    authorityReplaced || camera === null
      ? RESIDUAL_ENVELOPE_AT_REST
      : transition === null
        ? corridor
        : envelopeHull(
            transition.destination === null
              ? RESIDUAL_ENVELOPE_AT_REST
              : rebasedEnvelope(corridor, transition.k, transition.destination),
            RESIDUAL_ENVELOPE_AT_REST,
          );

  const commitCamera = useCallback(() => {
    const previous = cameraHistory.get();
    if (previous === null || previous.owner !== owner || previous.camera !== camera) {
      if (camera !== null) cameraHistory.set({ owner, camera });
    }
    // The corridor of the motion that is ACTUALLY running, read once here — after the change has
    // been applied — rather than predicted from the last one.
    //
    // The render above had to be conservative: it could only widen the previous corridor through
    // this transition, because a travel that finished long ago and a travel still in flight look
    // identical from render. Here they do not: the plane's own residual says where it is, so the
    // corridor becomes exactly "from here to rest" and inherits nothing from a journey already made.
    // It narrows on every commit as a travel proceeds, and it is a bounded read at a commit
    // boundary — never during render, never per frame.
    const exact = envelopeHull(residualEnvelope(motion.readResidual()), RESIDUAL_ENVELOPE_AT_REST);
    // R4 — while a FINGER owns the plane, a commit may widen this corridor and may not narrow it.
    //
    // Narrowing to "from here to rest" is right for a travel: the path is known, the plane is on its
    // way home, and everything behind it is finished with. A drag is the opposite case. It is going
    // somewhere nobody knows yet, the band the advance opened AHEAD of the hand is the entire reason
    // the leading edge is painted at all, and this read happens on the very next commit — so without
    // this distinction a canonical commit would take that band away again a frame after it was
    // granted, and the blank edge would come straight back. `dragging` is one bounded read at the
    // same boundary as the residual beside it, never during render and never per frame.
    const held = motion.dragging.get() === 1;
    // Only a corridor that actually differs costs a second pass; the frame already painted was a
    // superset of this one, so nothing was ever wrongly culled while the two disagreed.
    setCorridor((current) => {
      const next = held ? envelopeHull(current, exact) : exact;
      return envelopesEqual(current, next) ? current : next;
    });
  }, [camera, cameraHistory, motion, owner, setCorridor]);

  const cameraCommit: CanonicalCameraCommit = useMemo(
    () => ({ transition, reset: authorityReplaced, commit: commitCamera, cause }),
    [authorityReplaced, cause, commitCamera, transition],
  );

  // Presentation culling: what the motion could still put on the glass. At rest the corridor is the
  // degenerate envelope and this is exactly the resting viewport test, so a still world paints what
  // it always painted.
  const presented: readonly N[] = useMemo(
    () =>
      placed === null
        ? (EMPTY_NODES as readonly N[])
        : placed.nodes.filter((node) =>
            isPresentedWithinEnvelope(
              { x: node.x, y: node.y, radius: node.radius },
              // R3-02 — the screen-space register is not camera-transformed, so a world travel must
              // not widen its culling. It is tested against the resting viewport, always.
              node.region === 'UNGEOGRAPHIC_REGISTER' ? RESIDUAL_ENVELOPE_AT_REST : travelCorridor,
              center,
              envelope,
              CULL_MARGIN_POINTS,
            ),
          ),
    [center, envelope, placed, travelCorridor],
  );
  // Which nodes BECAME part of the accepted current projection in this commit (R3-01).
  //
  // Membership is asked of the PROJECTION, never of a placement. A placement omits a locus that is not
  // finitely representable from the current camera, so a set built from placements would call that
  // locus new the moment the camera made it representable again — presentation answering a question
  // only the record may answer.
  //
  // And it survives a projection handoff: in a technical gap the owner passes no membership, and the
  // record of what was disclosed is kept — EVIDENCE and not a world: a set of identities, no geometry,
  // no pixels, never painted, and kept only long enough to be compared with the next accepted one.
  //
  // A REPLACED authority is the one thing that does erase it, for the same reason the drag and its
  // residual are dropped: the record belongs to the owner it was taken under.
  const newlyDisclosed = useMemo(
    () => (membership === null ? EMPTY_KEYS : newlyDisclosedKeys(authorityReplaced ? null : disclosureHistory.get(), [...membership])),
    [membership, authorityReplaced, disclosureHistory],
  );
  useLayoutEffect(() => {
    // Only an ACCEPTED projection updates the record. A technical stale gap leaves it exactly as it
    // was — that is the whole fix — and only a replaced authority discards it.
    if (membership !== null) disclosureHistory.set(membership);
    else if (authorityReplaced) disclosureHistory.set(null);
  });

  const nodeAt = useCallback(
    (x: number, y: number): N | null => {
      // Through the SAME residual the frame was painted with, and the SAME arrival progress each
      // object is drawn at: paint, pointer and act agree while the plane travels AND while an
      // object is still resolving out from its host. Nothing waits for an animation to finish.
      const point = motion.canonicalPointAt({ x, y });
      const visibleNodes = presented.map((node) => {
        const shown = arrivals.presentationOf(node.key);
        return shown === null ? node : { ...node, x: node.x + shown.dx, y: node.y + shown.dy, radius: node.radius * shown.scale };
      });
      return hitTest({ visibleNodes }, point);
    },
    [arrivals, motion, presented],
  );

  return { cameraCommit, presented, newlyDisclosed, nodeAt };
}

const EMPTY_NODES: readonly WorldSurfaceNode[] = Object.freeze([]);
const EMPTY_KEYS: ReadonlySet<string> = Object.freeze(new Set<string>());

/** Component-wise, because a corridor is six numbers and a new object with the same six is the same. */
function envelopesEqual(a: PresentationResidualEnvelope, b: PresentationResidualEnvelope): boolean {
  return (
    a.txMin === b.txMin && a.txMax === b.txMax && a.tyMin === b.tyMin && a.tyMax === b.tyMax && a.zoomMin === b.zoomMin && a.zoomMax === b.zoomMax
  );
}
